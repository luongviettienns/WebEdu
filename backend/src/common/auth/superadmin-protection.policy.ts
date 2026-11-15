import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, UserStatus, type Prisma } from '@prisma/client';
import type { AuthenticatedUser } from './auth.types.js';

/**
 * Shared protection rules around ADMIN / SUPERADMIN accounts.
 * These are reused by Students, Teachers and System Settings so that the
 * "last active Superadmin" invariant is enforced identically everywhere.
 */

export interface LockedUserRow {
  id: string;
  roles?: Role[];
  status?: UserStatus;
}

/**
 * Locks only the target user row in the transaction.
 * Used for ordinary student/teacher mutations where Superadmin
 * demotion or deactivation is not at stake, eliminating global lock contention.
 */
export async function lockTargetUser(
  tx: Prisma.TransactionClient,
  targetUserId: string,
): Promise<LockedUserRow | null> {
  const rows = await tx.$queryRaw<LockedUserRow[]>`
    SELECT id, roles, status FROM "users"
    WHERE id = ${targetUserId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * Locks the target user plus every ACTIVE Superadmin in ONE statement with a
 * deterministic `ORDER BY id ASC FOR UPDATE`. Acquiring locks in ascending
 * primary-key order across all services makes AB-BA deadlocks (40P01)
 * impossible and serializes concurrent Superadmin demotions.
 */
export async function lockUserAndActiveSuperadmins(
  tx: Prisma.TransactionClient,
  targetUserId: string,
): Promise<LockedUserRow[]> {
  return tx.$queryRaw<LockedUserRow[]>`
    SELECT id, roles, status FROM "users"
    WHERE id = ${targetUserId} OR ('SUPERADMIN' = ANY("roles") AND "status" = 'ACTIVE')
    ORDER BY id ASC
    FOR UPDATE
  `;
}

/** Only a Superadmin may modify an ADMIN or SUPERADMIN account. */
export function assertActorMayModifyAccount(
  actor: AuthenticatedUser,
  targetRoles: Role[],
): void {
  const targetIsPrivileged =
    targetRoles.includes(Role.SUPERADMIN) || targetRoles.includes(Role.ADMIN);
  if (targetIsPrivileged && !actor.roles.includes(Role.SUPERADMIN)) {
    throw new ForbiddenException(
      'Admin không có quyền chỉnh sửa hoặc khóa tài khoản Quản trị viên / Quản trị tối cao',
    );
  }
}

/** True when the update would take a Superadmin account out of ACTIVE status. */
export function isLeavingActiveSuperadmin(
  targetRoles: Role[],
  nextStatus: UserStatus,
): boolean {
  return (
    targetRoles.includes(Role.SUPERADMIN) && nextStatus !== UserStatus.ACTIVE
  );
}

/** A Superadmin may never deactivate their own account. */
export function assertSuperadminNotSelfDeactivating(
  actor: AuthenticatedUser,
  target: { id: string; roles: Role[] },
  nextStatus: UserStatus,
): void {
  if (
    isLeavingActiveSuperadmin(target.roles, nextStatus) &&
    actor.id === target.id
  ) {
    throw new BadRequestException(
      'Superadmin không thể tự vô hiệu hóa tài khoản của chính mình',
    );
  }
}

/**
 * At least one OTHER active Superadmin must remain. Evaluated against
 * the rows locked by `lockUserAndActiveSuperadmins` in the same transaction.
 */
export function assertAnotherActiveSuperadminRemains(
  targetUserId: string,
  lockedRows: LockedUserRow[],
): void {
  const otherActiveCount = lockedRows.filter((row) => {
    if (row.id === targetUserId) return false;
    return (
      Array.isArray(row.roles) &&
      row.roles.includes(Role.SUPERADMIN) &&
      row.status === UserStatus.ACTIVE
    );
  }).length;

  if (otherActiveCount < 1) {
    throw new BadRequestException(
      'Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động',
    );
  }
}

/**
 * Re-verifies inside an active transaction (after row locks are acquired) that
 * the acting Superadmin is still ACTIVE, holds `SUPERADMIN`, and matches `tokenVersion`.
 */
export async function assertFreshActiveSuperadminActorInTx(
  tx: Prisma.TransactionClient,
  actor: Pick<AuthenticatedUser, 'id' | 'tokenVersion'>,
  forbiddenMessage: string,
): Promise<void> {
  const freshActor = await tx.user.findUnique({
    where: { id: actor.id },
    select: { id: true, roles: true, status: true, tokenVersion: true },
  });
  if (
    !freshActor ||
    freshActor.status !== UserStatus.ACTIVE ||
    !freshActor.roles.includes(Role.SUPERADMIN)
  ) {
    throw new ForbiddenException(forbiddenMessage);
  }
  if (freshActor.tokenVersion !== actor.tokenVersion) {
    throw new UnauthorizedException(
      'Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại',
    );
  }
}

/** Thrown inside a fast-path tx on concurrent SUPERADMIN promotion to retry with canonical locks. */
export class RetryWithSuperadminLocksError extends Error {
  constructor() {
    super('Retry transaction with canonical superadmin locks');
    this.name = 'RetryWithSuperadminLocksError';
  }
}

export interface SuperadminTransactionRunner {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

/** Runs a tx with fast-path locking first, retrying once with `forceSuperadminLocks = true`. */
export async function runWithSuperadminLockRetry<T>(
  prisma: SuperadminTransactionRunner,
  executeTx: (tx: Prisma.TransactionClient, forceSuperadminLocks: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction((tx) => executeTx(tx, false));
  } catch (err: unknown) {
    if (err instanceof RetryWithSuperadminLocksError) {
      return prisma.$transaction((tx) => executeTx(tx, true));
    }
    throw err;
  }
}

export interface LockAndLoadUserParams<TUser> {
  actor: AuthenticatedUser;
  targetUserId: string;
  requiredRole: Role;
  notFoundMessage: string;
  requestedStatus: UserStatus | undefined;
  forceSuperadminLocks: boolean;
  loadLockedUser: () => Promise<TUser | null>;
}

/**
 * Acquires row locks without intra-tx lock upgrades, reloads via `loadLockedUser`,
 * verifies actor/self-deactivation/last-Superadmin invariants, or triggers retry.
 */
export async function lockAndLoadUserWithSuperadminCheck<
  TUser extends { roles: Role[]; status: UserStatus },
>(
  tx: Prisma.TransactionClient,
  params: LockAndLoadUserParams<TUser>,
): Promise<{ targetUser: TUser; nextStatus: UserStatus }> {
  const { actor, targetUserId, requiredRole, notFoundMessage, requestedStatus, forceSuperadminLocks } =
    params;

  const preliminary = await tx.user.findUnique({
    where: { id: targetUserId },
    select: { roles: true, status: true },
  });
  if (!preliminary || !preliminary.roles.includes(requiredRole)) {
    throw new NotFoundException(notFoundMessage);
  }

  assertActorMayModifyAccount(actor, preliminary.roles);
  const prelimNextStatus = requestedStatus ?? preliminary.status;
  assertSuperadminNotSelfDeactivating(actor, { id: targetUserId, roles: preliminary.roles }, prelimNextStatus);

  const shouldLockSuperadmins =
    forceSuperadminLocks || isLeavingActiveSuperadmin(preliminary.roles, prelimNextStatus);
  const lockedSuperadmins = shouldLockSuperadmins
    ? await lockUserAndActiveSuperadmins(tx, targetUserId)
    : undefined;
  if (!shouldLockSuperadmins) {
    await lockTargetUser(tx, targetUserId);
  }

  const targetUser = await params.loadLockedUser();
  if (!targetUser || !targetUser.roles.includes(requiredRole)) {
    throw new NotFoundException(notFoundMessage);
  }

  const nextStatus = requestedStatus ?? targetUser.status;
  assertActorMayModifyAccount(actor, targetUser.roles);
  assertSuperadminNotSelfDeactivating(actor, { id: targetUserId, roles: targetUser.roles }, nextStatus);

  if (isLeavingActiveSuperadmin(targetUser.roles, nextStatus)) {
    if (!lockedSuperadmins) {
      throw new RetryWithSuperadminLocksError();
    }
    assertAnotherActiveSuperadminRemains(targetUserId, lockedSuperadmins);
  }

  return { targetUser, nextStatus };
}

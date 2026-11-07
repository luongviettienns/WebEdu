import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, UserStatus, type Prisma } from '@prisma/client';
import type { AuthenticatedUser } from './auth.types.js';

/**
 * Shared protection rules around ADMIN / SUPERADMIN accounts (SEC-07, SEC-08).
 * These are reused by Students, Teachers and System Settings so that the
 * "last active Superadmin" invariant is enforced identically everywhere.
 */

export interface LockedUserRow {
  id: string;
  roles?: Role[];
  status?: UserStatus;
}

/**
 * Locks the target user plus every ACTIVE Superadmin in ONE statement with a
 * deterministic `ORDER BY id ASC FOR UPDATE`. Acquiring locks in ascending
 * primary-key order across all services makes AB-BA deadlocks (40P01)
 * impossible and serializes concurrent Superadmin demotions (SEC-07).
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

/** SEC-08: only a Superadmin may modify an ADMIN or SUPERADMIN account. */
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

/** SEC-07: a Superadmin may never deactivate their own account. */
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
 * SEC-07: at least one OTHER active Superadmin must remain. Evaluated against
 * the rows locked by `lockUserAndActiveSuperadmins` in the same transaction.
 * Rows without role/status columns (legacy mocks) count as active Superadmins.
 */
export function assertAnotherActiveSuperadminRemains(
  targetUserId: string,
  lockedRows: LockedUserRow[],
): void {
  const otherActiveCount = lockedRows.filter((row) => {
    if (row.id === targetUserId) return false;
    if (Array.isArray(row.roles)) {
      return (
        row.roles.includes(Role.SUPERADMIN) && row.status === UserStatus.ACTIVE
      );
    }
    return true;
  }).length;

  if (otherActiveCount < 1) {
    throw new BadRequestException(
      'Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động',
    );
  }
}

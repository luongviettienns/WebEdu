import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, UserStatus, type Prisma } from '@prisma/client';
import type { AuthenticatedUser } from './auth.types.js';
import {
  RetryWithSuperadminLocksError,
  type SuperadminTransactionRunner,
  assertActorMayModifyAccount,
  assertAnotherActiveSuperadminRemains,
  assertSuperadminNotSelfDeactivating,
  isLeavingActiveSuperadmin,
  lockAndLoadUserWithSuperadminCheck,
  lockTargetUser,
  lockUserAndActiveSuperadmins,
  runWithSuperadminLockRetry,
} from './superadmin-protection.policy.js';

describe('superadmin-protection.policy (FUNC-013, SEC-07)', () => {
  const adminActor: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@webedu.vn',
    fullName: 'Admin One',
    phone: '0901111111',
    roles: [Role.ADMIN],
    effectiveRole: Role.ADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const superadminActor: AuthenticatedUser = {
    id: 'sa-1',
    email: 'sa@webedu.vn',
    fullName: 'Superadmin One',
    phone: '0909999999',
    roles: [Role.SUPERADMIN],
    effectiveRole: Role.SUPERADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  it('locks target user row with FOR UPDATE and returns null when missing', async () => {
    const queryRawMock = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'u-1', roles: [Role.STUDENT], status: UserStatus.ACTIVE }])
      .mockResolvedValueOnce([]);
    const tx = { $queryRaw: queryRawMock } as unknown as Prisma.TransactionClient;

    const found = await lockTargetUser(tx, 'u-1');
    expect(found).toEqual({ id: 'u-1', roles: [Role.STUDENT], status: UserStatus.ACTIVE });
    expect(String(queryRawMock.mock.calls[0]?.[0]?.join(' '))).toContain('FOR UPDATE');

    const missing = await lockTargetUser(tx, 'u-missing');
    expect(missing).toBeNull();
  });

  it('locks target user and all active Superadmins ordered by id ASC FOR UPDATE', async () => {
    const queryRawMock = vi
      .fn()
      .mockResolvedValue([{ id: 'sa-1', roles: [Role.SUPERADMIN], status: UserStatus.ACTIVE }]);
    const tx = { $queryRaw: queryRawMock } as unknown as Prisma.TransactionClient;

    const rows = await lockUserAndActiveSuperadmins(tx, 'sa-1');
    expect(rows).toHaveLength(1);
    const sql = String(queryRawMock.mock.calls[0]?.[0]?.join(' '));
    expect(sql).toContain('ORDER BY id ASC');
    expect(sql).toContain('FOR UPDATE');
  });

  it('enforces assertActorMayModifyAccount so only SUPERADMIN can modify ADMIN/SUPERADMIN accounts', () => {
    expect(() => assertActorMayModifyAccount(adminActor, [Role.STUDENT])).not.toThrow();
    expect(() => assertActorMayModifyAccount(adminActor, [Role.TEACHER])).not.toThrow();
    expect(() => assertActorMayModifyAccount(adminActor, [Role.ADMIN])).toThrow(
      new ForbiddenException(
        'Admin không có quyền chỉnh sửa hoặc khóa tài khoản Quản trị viên / Quản trị tối cao',
      ),
    );
    expect(() => assertActorMayModifyAccount(adminActor, [Role.SUPERADMIN])).toThrow(
      ForbiddenException,
    );
    expect(() => assertActorMayModifyAccount(superadminActor, [Role.ADMIN])).not.toThrow();
    expect(() => assertActorMayModifyAccount(superadminActor, [Role.SUPERADMIN])).not.toThrow();
  });

  it('checks isLeavingActiveSuperadmin and prevents Superadmin self-deactivation', () => {
    expect(isLeavingActiveSuperadmin([Role.SUPERADMIN], UserStatus.INACTIVE)).toBe(true);
    expect(isLeavingActiveSuperadmin([Role.SUPERADMIN], UserStatus.ACTIVE)).toBe(false);
    expect(isLeavingActiveSuperadmin([Role.ADMIN], UserStatus.INACTIVE)).toBe(false);

    expect(() =>
      assertSuperadminNotSelfDeactivating(
        superadminActor,
        { id: 'sa-1', roles: [Role.SUPERADMIN] },
        UserStatus.INACTIVE,
      ),
    ).toThrow(
      new BadRequestException('Superadmin không thể tự vô hiệu hóa tài khoản của chính mình'),
    );

    expect(() =>
      assertSuperadminNotSelfDeactivating(
        superadminActor,
        { id: 'sa-2', roles: [Role.SUPERADMIN] },
        UserStatus.INACTIVE,
      ),
    ).not.toThrow();

    expect(() =>
      assertSuperadminNotSelfDeactivating(
        superadminActor,
        { id: 'sa-1', roles: [Role.SUPERADMIN] },
        UserStatus.ACTIVE,
      ),
    ).not.toThrow();
  });

  it('enforces assertAnotherActiveSuperadminRemains across all row shapes', () => {
    // Only the target Superadmin is present -> throws
    expect(() =>
      assertAnotherActiveSuperadminRemains('sa-1', [
        { id: 'sa-1', roles: [Role.SUPERADMIN], status: UserStatus.ACTIVE },
      ]),
    ).toThrow(
      new BadRequestException('Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động'),
    );

    // Other user is INACTIVE Superadmin -> throws
    expect(() =>
      assertAnotherActiveSuperadminRemains('sa-1', [
        { id: 'sa-1', roles: [Role.SUPERADMIN], status: UserStatus.ACTIVE },
        { id: 'sa-2', roles: [Role.SUPERADMIN], status: UserStatus.INACTIVE },
      ]),
    ).toThrow(BadRequestException);

    // Other user is ACTIVE ADMIN (not Superadmin) -> throws
    expect(() =>
      assertAnotherActiveSuperadminRemains('sa-1', [
        { id: 'sa-1', roles: [Role.SUPERADMIN], status: UserStatus.ACTIVE },
        { id: 'admin-2', roles: [Role.ADMIN], status: UserStatus.ACTIVE },
      ]),
    ).toThrow(BadRequestException);

    // Exactly 1 other ACTIVE Superadmin remains -> allowed
    expect(() =>
      assertAnotherActiveSuperadminRemains('sa-1', [
        { id: 'sa-1', roles: [Role.SUPERADMIN], status: UserStatus.ACTIVE },
        { id: 'sa-2', roles: [Role.SUPERADMIN], status: UserStatus.ACTIVE },
      ]),
    ).not.toThrow();

    // Incomplete row missing roles/status must NOT be assumed to be an active Superadmin (TD-04)
    expect(() =>
      assertAnotherActiveSuperadminRemains('sa-1', [{ id: 'sa-1' }, { id: 'sa-2' }]),
    ).toThrow(BadRequestException);
  });

  it('runWithSuperadminLockRetry retries once with forceSuperadminLocks=true only on RetryWithSuperadminLocksError', async () => {
    const fakeTx = {} as Prisma.TransactionClient;
    const prisma: SuperadminTransactionRunner = {
      $transaction: (cb) => cb(fakeTx),
    };
    const txSpy = vi.spyOn(prisma, '$transaction');

    const flags: boolean[] = [];
    const res = await runWithSuperadminLockRetry(prisma, async (_tx, force) => {
      flags.push(force);
      if (!force) throw new RetryWithSuperadminLocksError();
      return 'ok';
    });
    expect(res).toBe('ok');
    expect(flags).toEqual([false, true]);
    expect(txSpy).toHaveBeenCalledTimes(2);

    txSpy.mockClear();
    await expect(
      runWithSuperadminLockRetry(prisma, async () => {
        throw new BadRequestException('other error');
      }),
    ).rejects.toThrowError(new BadRequestException('other error'));
    expect(txSpy).toHaveBeenCalledTimes(1);
  });

  it('lockAndLoadUserWithSuperadminCheck throws RetryWithSuperadminLocksError when promoted concurrently before lock', async () => {
    const queryRawMock = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'u-1', roles: [Role.TEACHER], status: UserStatus.ACTIVE }]);
    const findUniqueMock = vi
      .fn()
      .mockResolvedValueOnce({ roles: [Role.TEACHER], status: UserStatus.ACTIVE });
    const tx = {
      $queryRaw: queryRawMock,
      user: { findUnique: findUniqueMock },
    } as unknown as Prisma.TransactionClient;

    await expect(
      lockAndLoadUserWithSuperadminCheck(tx, {
        actor: superadminActor,
        targetUserId: 'u-1',
        requiredRole: Role.TEACHER,
        notFoundMessage: 'Không tìm thấy giáo viên',
        requestedStatus: UserStatus.INACTIVE,
        forceSuperadminLocks: false,
        loadLockedUser: async () => ({
          roles: [Role.TEACHER, Role.SUPERADMIN],
          status: UserStatus.ACTIVE,
        }),
      }),
    ).rejects.toThrowError(RetryWithSuperadminLocksError);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });
});

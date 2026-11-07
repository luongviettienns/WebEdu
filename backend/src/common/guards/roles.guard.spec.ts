import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

describe('RolesGuard', () => {
  const handlerDummy = () => {};
  const classDummy = class {};

  const createMockContext = (user?: AuthenticatedUser): ExecutionContext => {
    return {
      getHandler: () => handlerDummy,
      getClass: () => classDummy,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('allows access when no @Roles metadata or empty @Roles() array is specified on route', () => {
    const getAllAndOverride = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce([]);
    const reflector = {
      getAllAndOverride,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext())).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handlerDummy,
      classDummy,
    ]);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('allows ADMIN to access route requiring TEACHER role (FUNC-009)', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.TEACHER]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    const adminUser: AuthenticatedUser = {
      id: 'u-1',
      email: 'admin@webedu.vn',
      fullName: 'Admin User',
      phone: '0901234567',
      roles: [Role.ADMIN],
      effectiveRole: Role.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    expect(guard.canActivate(createMockContext(adminUser))).toBe(true);
  });

  it('blocks missing user or SUPERADMIN from accessing route restricted to TEACHER/STUDENT learning data (FUNC-013)', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.TEACHER]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createMockContext(undefined))).toThrow(
      new ForbiddenException('Bạn không có quyền truy cập'),
    );

    const superadminUser: AuthenticatedUser = {
      id: 'u-sa',
      email: 'sa@webedu.vn',
      fullName: 'Superadmin User',
      phone: '0909999999',
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    expect(() => guard.canActivate(createMockContext(superadminUser))).toThrow(
      new ForbiddenException('Bạn không có quyền truy cập'),
    );
  });
});

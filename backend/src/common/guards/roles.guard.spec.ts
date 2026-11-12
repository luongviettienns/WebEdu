import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserStatus } from '@prisma/client';
import {
  AUTHENTICATED_ONLY_KEY,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from '../decorators/roles.decorator.js';
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

  const makeReflector = (
    resolver: (key: string, target: unknown) => unknown,
  ): Reflector =>
    ({
      get: vi.fn(resolver),
    }) as unknown as Reflector;

  const studentUser: AuthenticatedUser = {
    id: 'u-1',
    email: 'student@webedu.vn',
    fullName: 'Student',
    phone: '0901234567',
    roles: [Role.STUDENT],
    effectiveRole: Role.STUDENT,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  it('denies access by default when neither @Public(), @AuthenticatedOnly(), nor non-empty @Roles() is specified (SEC-RISK-01)', () => {
    const guard = new RolesGuard(makeReflector(() => undefined));
    expect(() => guard.canActivate(createMockContext(studentUser))).toThrow(
      new ForbiddenException('Bạn không có quyền truy cập'),
    );

    const emptyGuard = new RolesGuard(
      makeReflector((key) => (key === ROLES_KEY ? [] : undefined)),
    );
    expect(() => emptyGuard.canActivate(createMockContext(studentUser))).toThrow(
      new ForbiddenException('Bạn không có quyền truy cập'),
    );
  });

  it('allows @Public() without user and @AuthenticatedOnly() only with authenticated user', () => {
    const publicGuard = new RolesGuard(
      makeReflector((key) => (key === IS_PUBLIC_KEY ? true : undefined)),
    );
    expect(publicGuard.canActivate(createMockContext())).toBe(true);

    const authOnlyGuard = new RolesGuard(
      makeReflector((key) => (key === AUTHENTICATED_ONLY_KEY ? true : undefined)),
    );
    expect(() => authOnlyGuard.canActivate(createMockContext())).toThrow(
      new ForbiddenException('Bạn không có quyền truy cập'),
    );
    expect(authOnlyGuard.canActivate(createMockContext(studentUser))).toBe(true);
  });

  it('ensures handler-level @Roles() takes precedence over class-level @AuthenticatedOnly() (LOW-02)', () => {
    const guard = new RolesGuard(
      makeReflector((key, target) => {
        if (target === handlerDummy && key === ROLES_KEY) {
          return [Role.ADMIN];
        }
        if (target === classDummy && key === AUTHENTICATED_ONLY_KEY) {
          return true;
        }
        return undefined;
      }),
    );

    expect(() => guard.canActivate(createMockContext(studentUser))).toThrow(
      new ForbiddenException('Bạn không có quyền truy cập'),
    );

    const adminUser: AuthenticatedUser = {
      ...studentUser,
      id: 'u-admin',
      roles: [Role.ADMIN],
      effectiveRole: Role.ADMIN,
    };
    expect(guard.canActivate(createMockContext(adminUser))).toBe(true);
  });

  it('allows ADMIN to access route requiring TEACHER role (FUNC-009)', () => {
    const guard = new RolesGuard(
      makeReflector((key) => (key === ROLES_KEY ? [Role.TEACHER] : undefined)),
    );

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
    const guard = new RolesGuard(
      makeReflector((key) => (key === ROLES_KEY ? [Role.TEACHER] : undefined)),
    );

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

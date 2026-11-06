import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import {
  getHighestRole,
  expandAuthorizedRoles,
  hasRequiredRole,
  getDefaultRedirectByRole,
} from './role-hierarchy.util.js';

describe('Role Hierarchy & RBAC Utilities (FUNC-009 & FUNC-013)', () => {
  it('calculates effective highest role according to SUPERADMIN > ADMIN > TEACHER > STUDENT', () => {
    expect(getHighestRole([Role.STUDENT])).toBe(Role.STUDENT);
    expect(getHighestRole([Role.TEACHER, Role.ADMIN])).toBe(Role.ADMIN);
    expect(getHighestRole([Role.TEACHER, Role.ADMIN, Role.SUPERADMIN])).toBe(Role.SUPERADMIN);
  });

  it('expands ADMIN role to include TEACHER privileges (FUNC-009 & FUNC-012)', () => {
    const expanded = expandAuthorizedRoles([Role.ADMIN]);
    expect(expanded.has(Role.ADMIN)).toBe(true);
    expect(expanded.has(Role.TEACHER)).toBe(true);
    expect(expanded.has(Role.SUPERADMIN)).toBe(false);
    expect(expanded.has(Role.STUDENT)).toBe(false);
  });

  it('prevents SUPERADMIN from automatically inheriting ADMIN/TEACHER/STUDENT learning data access (FUNC-013)', () => {
    const expanded = expandAuthorizedRoles([Role.SUPERADMIN]);
    expect(expanded.has(Role.SUPERADMIN)).toBe(true);
    expect(expanded.has(Role.ADMIN)).toBe(false);
    expect(expanded.has(Role.TEACHER)).toBe(false);
    expect(expanded.has(Role.STUDENT)).toBe(false);

    // Endpoint for learning data (@Roles(Role.TEACHER, Role.ADMIN)) MUST block pure SUPERADMIN
    expect(hasRequiredRole([Role.SUPERADMIN], [Role.TEACHER, Role.ADMIN])).toBe(false);

    // Endpoint for teacher/student management (@Roles(Role.ADMIN, Role.SUPERADMIN)) allows SUPERADMIN
    expect(hasRequiredRole([Role.SUPERADMIN], [Role.ADMIN, Role.SUPERADMIN])).toBe(true);
  });

  it('returns correct default redirect path for each effective role (FUNC-003)', () => {
    expect(getDefaultRedirectByRole(Role.STUDENT)).toBe('/student/overview');
    expect(getDefaultRedirectByRole(Role.TEACHER)).toBe('/teacher/classes');
    expect(getDefaultRedirectByRole(Role.ADMIN)).toBe('/admin/students');
    expect(getDefaultRedirectByRole(Role.SUPERADMIN)).toBe('/superadmin/settings');
  });
});

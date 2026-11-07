import { Role } from '@prisma/client';

const ROLE_PRIORITY: Record<Role, number> = {
  [Role.SUPERADMIN]: 4,
  [Role.ADMIN]: 3,
  [Role.TEACHER]: 2,
  [Role.STUDENT]: 1,
};

/**
 * Returns the highest role from a user's assigned roles array.
 */
export function getHighestRole(roles: Role[]): Role {
  if (!roles || roles.length === 0) {
    return Role.STUDENT;
  }
  return roles.reduce((highest, current) =>
    ROLE_PRIORITY[current] > ROLE_PRIORITY[highest] ? current : highest,
  );
}

/**
 * Expands authorized capabilities while strictly enforcing role boundaries:
 * - ADMIN inherits TEACHER operational capabilities.
 * - SUPERADMIN does NOT automatically inherit ADMIN/TEACHER/STUDENT learning data capabilities.
 */
export function expandAuthorizedRoles(userRoles: Role[]): Set<Role> {
  const expanded = new Set<Role>(userRoles);
  if (expanded.has(Role.ADMIN)) {
    expanded.add(Role.TEACHER);
  }
  return expanded;
}

/**
 * Checks if a user's roles satisfy any of the required endpoint roles.
 */
export function hasRequiredRole(userRoles: Role[], requiredRoles: Role[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  const authorizedSet = expandAuthorizedRoles(userRoles);
  return requiredRoles.some((reqRole) => authorizedSet.has(reqRole));
}

/**
 * Default post-login navigation path based on effective role.
 */
export function getDefaultRedirectByRole(effectiveRole: Role): string {
  switch (effectiveRole) {
    case Role.SUPERADMIN:
      return '/superadmin/settings';
    case Role.ADMIN:
      return '/admin/students';
    case Role.TEACHER:
      return '/teacher/classes';
    case Role.STUDENT:
    default:
      return '/student/overview';
  }
}

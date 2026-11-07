import type { Role } from '@/types/user';
import type { AuthUserDto } from './api/auth.api';

/**
 * Lấy đường dẫn mặc định theo vai trò cao nhất
 */
export function getDefaultRouteForRole(role: Role): string {
  switch (role) {
    case 'SUPERADMIN':
      return '/superadmin/settings';
    case 'ADMIN':
      return '/admin/students';
    case 'TEACHER':
      return '/teacher/classes';
    case 'STUDENT':
    default:
      return '/student/overview';
  }
}

export function userHasAnyRole(
  user: Pick<AuthUserDto, 'roles' | 'effectiveRole'> | null | undefined,
  allowedRoles: readonly Role[],
): boolean {
  if (!user) {
    return false;
  }
  const assignedRoles =
    Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : [user.effectiveRole];
  return allowedRoles.some(
    (role) => assignedRoles.includes(role) || user.effectiveRole === role,
  );
}

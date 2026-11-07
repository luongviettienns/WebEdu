import type { Role } from '@/types/user';

export interface NavLinkItem {
  href: string;
  label: string;
  badge?: number;
}

export function getNavLinks(
  role: Role | undefined,
  assignedRoles: readonly Role[] | undefined,
  pendingCount: number,
): NavLinkItem[] {
  const hasAdminRole = Boolean(assignedRoles?.includes('ADMIN'));
  const hasTeacherRole = Boolean(assignedRoles?.includes('TEACHER'));
  switch (role) {
    case 'SUPERADMIN':
      return [
        { href: '/superadmin/settings', label: 'Vận hành hệ thống' },
        { href: '/admin/students', label: 'Học viên' },
        ...(hasAdminRole
          ? [
              {
                href: '/admin/students/pending',
                label: 'Chờ xếp lớp',
                badge: pendingCount,
              },
            ]
          : []),
        { href: '/admin/teachers', label: 'Giáo viên' },
        ...(hasTeacherRole
          ? [{ href: '/teacher/classes', label: 'Lớp học phụ trách' }]
          : []),
        { href: '/profile', label: 'Hồ sơ cá nhân' },
      ];
    case 'ADMIN':
      return [
        { href: '/admin/students', label: 'Học viên' },
        {
          href: '/admin/students/pending',
          label: 'Chờ xếp lớp',
          badge: pendingCount,
        },
        { href: '/admin/teachers', label: 'Giáo viên' },
        ...(hasTeacherRole
          ? [{ href: '/teacher/classes', label: 'Lớp học phụ trách' }]
          : []),
        { href: '/profile', label: 'Hồ sơ cá nhân' },
      ];
    case 'TEACHER':
      return [
        { href: '/teacher/classes', label: 'Lớp học phụ trách' },
        { href: '/profile', label: 'Hồ sơ cá nhân' },
      ];
    case 'STUDENT':
    default:
      return [
        { href: '/student/overview', label: 'Tình trạng học cá nhân' },
        { href: '/profile', label: 'Hồ sơ cá nhân' },
      ];
  }
}

import type { Role } from '@/types/user';

export interface NavItem {
  href: string;
  label: string;
  han: string;
  badge?: number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export function getGroupedNavLinks(
  role: Role | undefined,
  assignedRoles: readonly Role[] | undefined,
  pendingCount: number,
): NavGroup[] {
  const hasAdminRole = Boolean(assignedRoles?.includes('ADMIN'));
  const hasTeacherRole = Boolean(assignedRoles?.includes('TEACHER'));
  const hasStudentRole = Boolean(assignedRoles?.includes('STUDENT'));

  switch (role) {
    case 'SUPERADMIN':
      return [
        {
          title: 'HỆ THỐNG',
          items: [
            { href: '/superadmin/settings', label: 'Vận hành hệ thống', han: '系统' },
            { href: '/admin/students', label: 'Học viên', han: '学员' },
            ...(hasAdminRole
              ? [
                  {
                    href: '/admin/students/pending',
                    label: 'Chờ xếp lớp',
                    han: '待分班',
                    badge: pendingCount,
                  },
                  { href: '/admin/courses', label: 'Khóa học HSK', han: '课程' },
                  { href: '/admin/classes', label: 'Quản lý lớp học', han: '班级' },
                  { href: '/admin/schedules', label: 'Lịch học', han: '课表' },
                  { href: '/teacher/assessments', label: 'Ngân hàng đề', han: '题库' },
                ]
              : []),
            { href: '/admin/schedule-logs', label: 'Nhật ký đổi lịch', han: '日志' },
            { href: '/admin/teachers', label: 'Giáo viên', han: '教师' },
            ...(hasTeacherRole
              ? [{ href: '/teacher/classes', label: 'Lớp học phụ trách', han: '班级' }]
              : []),
          ],
        },
        ...(hasStudentRole
          ? [
              {
                title: 'HỌC TẬP',
                items: [
                  { href: '/student/overview', label: 'Tình trạng học cá nhân', han: '概览' },
                ],
              },
            ]
          : []),
        {
          title: 'TÀI KHOẢN',
          items: [{ href: '/profile', label: 'Hồ sơ cá nhân', han: '个人' }],
        },
      ];

    case 'ADMIN':
      return [
        {
          title: 'VẬN HÀNH & DANH MỤC',
          items: [
            { href: '/admin/students', label: 'Học viên', han: '学员' },
            {
              href: '/admin/students/pending',
              label: 'Chờ xếp lớp',
              han: '待分班',
              badge: pendingCount,
            },
            { href: '/admin/courses', label: 'Khóa học HSK', han: '课程' },
            { href: '/admin/classes', label: 'Quản lý lớp học', han: '班级' },
            { href: '/admin/schedules', label: 'Lịch học', han: '课表' },
            { href: '/admin/schedule-logs', label: 'Nhật ký đổi lịch', han: '日志' },
            { href: '/admin/teachers', label: 'Giáo viên', han: '教师' },
            { href: '/teacher/assessments', label: 'Ngân hàng đề', han: '题库' },
            ...(hasTeacherRole
              ? [{ href: '/teacher/classes', label: 'Lớp học phụ trách', han: '班级' }]
              : []),
          ],
        },
        ...(hasStudentRole
          ? [
              {
                title: 'HỌC TẬP',
                items: [
                  { href: '/student/overview', label: 'Tình trạng học cá nhân', han: '概览' },
                ],
              },
            ]
          : []),
        {
          title: 'TÀI KHOẢN',
          items: [{ href: '/profile', label: 'Hồ sơ cá nhân', han: '个人' }],
        },
      ];

    case 'TEACHER':
      return [
        {
          title: 'GIẢNG DẠY',
          items: [
            { href: '/teacher/classes', label: 'Lớp học phụ trách', han: '班级' },
            { href: '/teacher/schedules', label: 'Lịch dạy', han: '课表' },
            { href: '/teacher/assessments', label: 'Ngân hàng đề', han: '题库' },
          ],
        },
        ...(hasStudentRole
          ? [
              {
                title: 'HỌC TẬP',
                items: [
                  { href: '/student/overview', label: 'Tình trạng học cá nhân', han: '概览' },
                  { href: '/student/schedule', label: 'Lịch học & điểm danh', han: '课表' },
                ],
              },
            ]
          : []),
        {
          title: 'TÀI KHOẢN',
          items: [{ href: '/profile', label: 'Hồ sơ cá nhân', han: '个人' }],
        },
      ];

    case 'STUDENT':
    default:
      return [
        {
          title: 'HỌC TẬP',
          items: [
            { href: '/student/overview', label: 'Tình trạng học cá nhân', han: '概览' },
            { href: '/student/schedule', label: 'Lịch học & điểm danh', han: '课表' },
          ],
        },
        {
          title: 'TÀI KHOẢN',
          items: [{ href: '/profile', label: 'Hồ sơ cá nhân', han: '个人' }],
        },
      ];
  }
}

export function getNavLinks(
  role: Role | undefined,
  assignedRoles: readonly Role[] | undefined,
  pendingCount: number = 0,
): NavItem[] {
  const groups = getGroupedNavLinks(role, assignedRoles, pendingCount);
  return groups.flatMap((group) => group.items);
}

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

const SUPERADMIN_SETTINGS_ITEM: NavItem = {
  href: '/superadmin/settings',
  label: 'Vận hành hệ thống',
  han: '系统',
};

const TEACHER_CLASS_ITEM: NavItem = {
  href: '/teacher/classes',
  label: 'Lớp học phụ trách',
  han: '班级',
};

const TEACHER_SCHEDULE_ITEM: NavItem = {
  href: '/teacher/schedules',
  label: 'Lịch dạy',
  han: '课表',
};

const TEACHER_ASSESSMENT_ITEM: NavItem = {
  href: '/teacher/assessments',
  label: 'Ngân hàng đề',
  han: '题库',
};

interface AdminSectionOptions {
  pendingCount: number;
  includeSuperadmin: boolean;
  includeAdminOnly: boolean;
  includeAssessments: boolean;
  includeTeacherPersonal: boolean;
}

/** Builds the shared admin/superadmin primary section without duplicating item definitions. */
function buildAdminSectionItems({
  pendingCount,
  includeSuperadmin,
  includeAdminOnly,
  includeAssessments,
  includeTeacherPersonal,
}: AdminSectionOptions): NavItem[] {
  return [
    ...(includeSuperadmin ? [SUPERADMIN_SETTINGS_ITEM] : []),
    { href: '/admin/students', label: 'Học viên', han: '学员' },
    ...(includeAdminOnly
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
        ]
      : []),
    { href: '/admin/schedule-logs', label: 'Nhật ký đổi lịch', han: '日志' },
    { href: '/admin/teachers', label: 'Giáo viên', han: '教师' },
    ...(includeAssessments ? [TEACHER_ASSESSMENT_ITEM] : []),
    ...(includeTeacherPersonal ? [TEACHER_CLASS_ITEM, TEACHER_SCHEDULE_ITEM] : []),
  ];
}

function createStudentStudyGroup(): NavGroup {
  return {
    title: 'HỌC TẬP',
    items: [
      { href: '/student/overview', label: 'Tình trạng học cá nhân', han: '概览' },
      { href: '/student/schedule', label: 'Lịch học & điểm danh', han: '课表' },
    ],
  };
}

function createAccountGroup(): NavGroup {
  return {
    title: 'TÀI KHOẢN',
    items: [{ href: '/profile', label: 'Hồ sơ cá nhân', han: '个人' }],
  };
}

/** Appends the optional student study group and the universal account group. */
function appendStudentAndAccountGroups(
  primaryGroups: NavGroup[],
  includeStudentGroup: boolean,
): NavGroup[] {
  return [
    ...primaryGroups,
    ...(includeStudentGroup ? [createStudentStudyGroup()] : []),
    createAccountGroup(),
  ];
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
      return appendStudentAndAccountGroups(
        [
          {
            title: 'HỆ THỐNG',
            items: buildAdminSectionItems({
              pendingCount,
              includeSuperadmin: true,
              includeAdminOnly: hasAdminRole,
              includeAssessments: hasAdminRole || hasTeacherRole,
              includeTeacherPersonal: hasTeacherRole,
            }),
          },
        ],
        hasStudentRole,
      );

    case 'ADMIN':
      return appendStudentAndAccountGroups(
        [
          {
            title: 'VẬN HÀNH & DANH MỤC',
            items: buildAdminSectionItems({
              pendingCount,
              includeSuperadmin: false,
              includeAdminOnly: true,
              includeAssessments: true,
              includeTeacherPersonal: hasTeacherRole,
            }),
          },
        ],
        hasStudentRole,
      );

    case 'TEACHER':
      return appendStudentAndAccountGroups(
        [
          {
            title: 'GIẢNG DẠY',
            items: [TEACHER_CLASS_ITEM, TEACHER_SCHEDULE_ITEM, TEACHER_ASSESSMENT_ITEM],
          },
        ],
        hasStudentRole,
      );

    case 'STUDENT':
    default:
      return appendStudentAndAccountGroups([], true);
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

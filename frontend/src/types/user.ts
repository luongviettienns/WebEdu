export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPERADMIN';

export type UserStatus = 'PENDING_CLASS' | 'ACTIVE' | 'INACTIVE';

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học viên',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_CLASS: 'Chờ xếp lớp',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Vô hiệu hóa',
};

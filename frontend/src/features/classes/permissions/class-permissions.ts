import type { Role } from '@/types/user';
import type {
  ClassAccessMode,
  ClassDetail,
  ClassEffectiveRole,
  ClassItem,
} from '@/features/classes/api/classes.types';

/**
 * Điểm DUY NHẤT quyết định hiển thị chức năng của module Lớp học.
 * - `assignedRoles`: toàn bộ vai trò được gán cho tài khoản (từ phiên đăng nhập).
 * - `effectiveRole` / `accessMode` / `capabilities`: do Backend tính theo từng lớp.
 * Đường dẫn (/admin | /teacher) chỉ là ngữ cảnh điều hướng, KHÔNG phải căn cứ phân quyền.
 * Frontend không mở rộng quyền Backend: mọi thao tác ghi cần cả vai trò ADMIN lẫn capability từ Backend.
 */

export type ClassRouteOrigin = 'admin' | 'teacher';

export interface ClassListPermissions {
  /** Tài khoản có vai trò ADMIN (kể cả kiêm nhiệm) -> thấy toàn bộ lớp và tạo/sửa lớp. */
  canCreateClass: boolean;
  canViewAllClasses: boolean;
  canEditClass: (cls: Pick<ClassItem, 'status'>) => boolean;
}

export function resolveClassListPermissions(
  assignedRoles: readonly Role[],
): ClassListPermissions {
  const isAdmin = assignedRoles.includes('ADMIN');
  return {
    canCreateClass: isAdmin,
    canViewAllClasses: isAdmin,
    canEditClass: (cls) => isAdmin && (cls.status === 'UPCOMING' || cls.status === 'ACTIVE'),
  };
}

export interface ClassDetailPermissions {
  assignedRoles: readonly Role[];
  effectiveRole: ClassEffectiveRole;
  accessMode: ClassAccessMode;
  isReadOnly: boolean;
  canEditClass: boolean;
  canManageEnrollments: boolean;
  canComplete: boolean;
  canReopen: boolean;
  /** Có ít nhất một thao tác ghi để hiển thị cột/thanh thao tác. */
  hasAnyWriteAction: boolean;
}

export function resolveClassDetailPermissions(
  detail: Pick<ClassDetail, 'accessMode' | 'effectiveRole' | 'capabilities'>,
  assignedRoles: readonly Role[],
): ClassDetailPermissions {
  const isAdmin = assignedRoles.includes('ADMIN');
  const isFull = detail.accessMode === 'FULL';
  const caps = detail.capabilities;
  const canEditClass = isAdmin && isFull && caps.canEditClass;
  const canManageEnrollments = isAdmin && isFull && caps.canManageEnrollments;
  const canComplete = isAdmin && isFull && caps.canComplete;
  const canReopen = isAdmin && caps.canReopen;
  return {
    assignedRoles,
    effectiveRole: detail.effectiveRole,
    accessMode: detail.accessMode,
    isReadOnly: detail.accessMode === 'READ_ONLY',
    canEditClass,
    canManageEnrollments,
    canComplete,
    canReopen,
    hasAnyWriteAction: canEditClass || canManageEnrollments || canComplete || canReopen,
  };
}

export function resolveClassBackHref(origin: ClassRouteOrigin): string {
  return origin === 'admin' ? '/admin/classes' : '/teacher/classes';
}

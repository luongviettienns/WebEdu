import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClassStatus, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type {
  ClassAccessMode,
  ClassCapabilitiesDto,
  ClassEffectiveRole,
} from '../classes.types.js';

export const CLASS_REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ClassAccessService {
  assertCanListClasses(actor: AuthenticatedUser): {
    restrictToTeacherId?: string;
  } {
    if (actor.roles.includes(Role.ADMIN)) {
      return {};
    }
    if (actor.roles.includes(Role.TEACHER)) {
      return { restrictToTeacherId: actor.id };
    }
    throw new ForbiddenException(
      'Bạn không có quyền truy cập danh sách lớp học',
    );
  }

  resolveClassDetailAccess(
    actor: AuthenticatedUser,
    targetClass: { id: string; teacherId: string; status: ClassStatus },
  ): ClassAccessMode {
    const isEnded =
      targetClass.status === ClassStatus.COMPLETED ||
      targetClass.status === ClassStatus.ARCHIVED;

    if (actor.roles.includes(Role.ADMIN)) {
      return isEnded ? 'READ_ONLY' : 'FULL';
    }

    if (actor.roles.includes(Role.TEACHER)) {
      if (targetClass.teacherId !== actor.id) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập lớp học này (chỉ giáo viên đang phụ trách chính thức của lớp mới được xem)',
        );
      }
      return isEnded ? 'READ_ONLY' : 'FULL';
    }

    throw new ForbiddenException(
      'Bạn không có quyền truy cập thông tin lớp học này',
    );
  }

  resolveEffectiveRole(actor: AuthenticatedUser): ClassEffectiveRole {
    return actor.roles.includes(Role.ADMIN) ? 'ADMIN' : 'TEACHER';
  }

  /** Quyền ghi chỉ thuộc ADMIN (kể cả tài khoản kiêm nhiệm); giáo viên luôn chỉ xem. */
  resolveCapabilities(
    actor: AuthenticatedUser,
    targetClass: { status: ClassStatus; closedAt: Date | null },
    now: Date = new Date(),
  ): ClassCapabilitiesDto {
    const isAdmin = actor.roles.includes(Role.ADMIN);
    const isEnded =
      targetClass.status === ClassStatus.COMPLETED ||
      targetClass.status === ClassStatus.ARCHIVED;
    const withinReopenWindow =
      targetClass.closedAt !== null &&
      now.getTime() - targetClass.closedAt.getTime() <= CLASS_REOPEN_WINDOW_MS;
    return {
      canEditClass: isAdmin && !isEnded,
      canManageEnrollments: isAdmin && !isEnded,
      canComplete: isAdmin && !isEnded,
      canReopen: isAdmin && isEnded && withinReopenWindow,
    };
  }
}

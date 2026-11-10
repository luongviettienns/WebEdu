import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClassStatus, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { ClassAccessMode } from '../classes.types.js';

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
}

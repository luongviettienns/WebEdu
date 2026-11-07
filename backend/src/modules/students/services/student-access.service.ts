import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Role, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { ClassLifecycleStatus } from '../students.types.js';

/**
 * FUNC-011 & DEC-024/025: A teacher is authorized to view student learning records ONLY when:
 * 1. The student is currently ACTIVE in an UPCOMING/ACTIVE class assigned to that teacher, OR
 * 2. The student completed (COMPLETED/ACTIVE) a COMPLETED class formerly led by that teacher (DEC-025 Case 1).
 * Students who TRANSFERRED or DROPPED out of an ongoing class are NOT operationally accessible.
 */
export function buildTeacherAuthorizedEnrollmentFilter(
  teacherId: string,
): Prisma.EnrollmentWhereInput {
  return {
    OR: [
      {
        status: EnrollmentStatus.ACTIVE,
        class: {
          teacherId,
          status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
        },
      },
      {
        status: { in: [EnrollmentStatus.COMPLETED, EnrollmentStatus.ACTIVE] },
        class: {
          teacherId,
          status: ClassStatus.COMPLETED,
        },
      },
    ],
  };
}

export type LearningAccessMode = 'FULL' | 'READ_ONLY';

export interface LearningRecordScope {
  /** Set when the actor is a Teacher: results must be limited to their own classes. */
  restrictToTeacherId?: string;
}

/**
 * Object-level authorization (anti IDOR/BOLA) for student data. Owns every
 * "who may see which student" decision so query/crud services never duplicate
 * role checks. Pure Superadmin never gains learning-data access (FUNC-013).
 */
@Injectable()
export class StudentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** FUNC-007 / FUNC-010: Admin/Superadmin view any profile; a Student only their own. */
  assertCanViewProfile(actor: AuthenticatedUser, studentId: string): void {
    const canViewAnyProfile =
      actor.roles.includes(Role.ADMIN) || actor.roles.includes(Role.SUPERADMIN);
    if (canViewAnyProfile) {
      return;
    }
    const canViewSelf =
      actor.roles.includes(Role.STUDENT) && actor.id === studentId;
    if (!canViewSelf) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập hồ sơ của học viên khác',
      );
    }
  }

  /** FUNC-007 & FUNC-013: internalNotes is strictly Admin-only (pure SUPERADMIN cannot view or modify). */
  assertCanWriteInternalNotes(actor: AuthenticatedUser): void {
    if (!actor.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên (Admin) mới có quyền xem hoặc cập nhật ghi chú học vụ nội bộ',
      );
    }
  }

  /**
   * FUNC-009/010/011 & DEC-026: decides whether the actor may read learning
   * records and, for teachers, which classes they are restricted to.
   */
  async resolveLearningRecordScope(
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<LearningRecordScope> {
    if (actor.roles.includes(Role.ADMIN)) {
      // Admin has full access to academic learning records (FUNC-009, DEC-026)
      return {};
    }
    if (actor.roles.includes(Role.STUDENT) && actor.id === studentId) {
      // Student viewing own learning records (FUNC-010)
      return {};
    }
    if (actor.roles.includes(Role.TEACHER)) {
      const isAssigned = await this.hasTeacherStudentClassAssignment(
        actor.id,
        studentId,
      );
      if (!isAssigned) {
        throw new ForbiddenException(
          'Giáo viên chỉ được truy cập dữ liệu học tập của học viên thuộc lớp mình đang hoặc đã hoàn thành phụ trách',
        );
      }
      return { restrictToTeacherId: actor.id };
    }
    throw new ForbiddenException('Bạn không có quyền truy cập');
  }

  /**
   * DEC-024: Quyền xem lịch sử lớp của học viên:
   * - Học viên: chỉ xem lịch sử lớp của chính mình.
   * - Giáo viên hiện tại: KHÔNG được xem lịch sử lớp cũ của học viên.
   * - Admin: xem lịch sử của tất cả học viên.
   * - Superadmin (thuần): không được xem dữ liệu học tập.
   */
  assertCanViewClassHistory(actor: AuthenticatedUser, studentId: string): void {
    const canViewClassHistory =
      actor.roles.includes(Role.ADMIN) ||
      (actor.roles.includes(Role.STUDENT) && actor.id === studentId);
    if (canViewClassHistory) {
      return;
    }
    if (actor.roles.includes(Role.TEACHER)) {
      throw new ForbiddenException(
        'Giáo viên không có quyền xem lịch sử lớp cũ của học viên',
      );
    }
    throw new ForbiddenException('Bạn không có quyền truy cập');
  }

  /**
   * DEC-025: FULL only while the enrollment is ACTIVE in an UPCOMING/ACTIVE
   * class; any teacher-visible completed-class record is READ_ONLY.
   * Non-teacher actors (Admin / the student) always get FULL.
   */
  resolveAccessMode(
    scope: LearningRecordScope,
    enrollment: { status: EnrollmentStatus; class: { status: ClassStatus } },
  ): LearningAccessMode {
    if (!scope.restrictToTeacherId) {
      return 'FULL';
    }
    const isOngoing =
      enrollment.status === EnrollmentStatus.ACTIVE &&
      (enrollment.class.status === ClassStatus.UPCOMING ||
        enrollment.class.status === ClassStatus.ACTIVE);
    return isOngoing ? 'FULL' : 'READ_ONLY';
  }

  /**
   * DEC-025 & DEC-026: Kiểm tra quyền truy cập dữ liệu lớp học của Giáo viên / Admin:
   * - Admin: có toàn quyền truy cập & thao tác nghiệp vụ đào tạo (DEC-026).
   * - Superadmin thuần: bị chặn truy cập dữ liệu học tập (FUNC-013).
   * - Giáo viên:
   *   + Lớp UPCOMING / ACTIVE do GV đang phụ trách -> FULL.
   *   + Case 1 (DEC-025): Lớp đã kết thúc (COMPLETED/ARCHIVED) mà GV vẫn là người phụ trách -> READ_ONLY.
   *   + Case 2 (DEC-025): GV đang dạy nhưng bị thay bằng GV khác (assignedTeacherId !== actor.id) -> 403 Forbidden.
   */
  verifyClassLearningAccess(
    actor: AuthenticatedUser,
    classContext: {
      classId: string;
      assignedTeacherId: string;
      classStatus: ClassLifecycleStatus;
    },
  ): { allowed: true; mode: LearningAccessMode } {
    if (actor.roles.includes(Role.ADMIN)) {
      return { allowed: true, mode: 'FULL' };
    }

    if (actor.roles.includes(Role.TEACHER)) {
      if (classContext.assignedTeacherId !== actor.id) {
        throw new ForbiddenException(
          'Giáo viên đã được thay thế không còn quyền truy cập lớp học này',
        );
      }
      const isEditableLifecycle =
        classContext.classStatus === 'UPCOMING' ||
        classContext.classStatus === 'ACTIVE';
      return {
        allowed: true,
        mode: isEditableLifecycle ? 'FULL' : 'READ_ONLY',
      };
    }

    throw new ForbiddenException('Bạn không có quyền truy cập');
  }

  private async hasTeacherStudentClassAssignment(
    teacherId: string,
    studentId: string,
  ): Promise<boolean> {
    const matchingCount = await this.prisma.enrollment.count({
      where: {
        studentId,
        ...buildTeacherAuthorizedEnrollmentFilter(teacherId),
      },
    });
    return matchingCount > 0;
  }
}

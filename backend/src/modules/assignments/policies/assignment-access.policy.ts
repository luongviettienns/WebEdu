import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';

export type DbClient = Prisma.TransactionClient | PrismaService;
export type AssignmentActor = Pick<AuthenticatedUser, 'id' | 'roles'>;

export interface ClassAccessRecord {
  id: string;
  code: string;
  teacherId: string;
  courseId: string;
  status: ClassStatus;
  course: { name: string };
  teacherHistory: Array<{ teacherId: string }>;
}

export type ClassAssignmentViewerResolution =
  | { role: 'ADMIN'; cls: ClassAccessRecord }
  | { role: 'TEACHER'; cls: ClassAccessRecord }
  | { role: 'STUDENT'; cls: ClassAccessRecord };

@Injectable()
export class AssignmentAccessPolicy {
  async loadClassForAccess(db: DbClient, classId: string): Promise<ClassAccessRecord> {
    const cls = await db.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        code: true,
        teacherId: true,
        courseId: true,
        status: true,
        course: { select: { name: true } },
        teacherHistory: {
          where: { assignedTo: null },
          select: { teacherId: true },
        },
      },
    });
    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }
    return cls;
  }

  async assertTeacherOrAdminCanAccessClass(
    db: DbClient,
    actor: AssignmentActor,
    classId: string,
  ): Promise<ClassAccessRecord> {
    const cls = await this.loadClassForAccess(db, classId);
    if (actor.roles.includes(Role.ADMIN)) {
      return cls;
    }
    if (actor.roles.includes(Role.TEACHER) && this.isClassTeacher(actor.id, cls)) {
      return cls;
    }
    throw new ForbiddenException('Bạn không có quyền thao tác bài tập của lớp này');
  }

  async assertStudentEnrolledInClass(
    db: DbClient,
    studentId: string,
    classId: string,
  ): Promise<void> {
    const enrolled = await this.hasActiveOrCompletedEnrollment(db, studentId, classId);
    if (!enrolled) {
      throw new ForbiddenException('Bạn không có quyền truy cập bài tập của lớp này');
    }
  }

  async resolveClassAssignmentViewer(
    db: DbClient,
    actor: AssignmentActor,
    classId: string,
  ): Promise<ClassAssignmentViewerResolution> {
    const cls = await this.loadClassForAccess(db, classId);
    if (actor.roles.includes(Role.ADMIN)) {
      return { role: 'ADMIN', cls };
    }
    if (actor.roles.includes(Role.TEACHER) && this.isClassTeacher(actor.id, cls)) {
      return { role: 'TEACHER', cls };
    }
    if (
      actor.roles.includes(Role.STUDENT) &&
      (await this.hasActiveOrCompletedEnrollment(db, actor.id, classId))
    ) {
      return { role: 'STUDENT', cls };
    }
    throw new ForbiddenException('Bạn không có quyền xem bài tập của lớp này');
  }

  private isClassTeacher(teacherId: string, cls: ClassAccessRecord): boolean {
    return (
      cls.teacherId === teacherId ||
      cls.teacherHistory.some((assignment) => assignment.teacherId === teacherId)
    );
  }

  private async hasActiveOrCompletedEnrollment(
    db: DbClient,
    studentId: string,
    classId: string,
  ): Promise<boolean> {
    const enrollment = await db.enrollment.findFirst({
      where: {
        classId,
        studentId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      select: { id: true },
    });
    return enrollment !== null;
  }
}

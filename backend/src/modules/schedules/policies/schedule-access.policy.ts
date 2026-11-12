import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Role } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';

export interface ClassAccessTarget {
  id: string;
  code: string;
  teacherId: string;
  status: ClassStatus;
  totalSessions: number;
  expectedEndDate: Date | null;
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  startDate: Date;
  course: { name: string };
  teacher: { id: string; fullName: string };
}

@Injectable()
export class ScheduleAccessPolicy {
  async loadClassOrThrow(prisma: PrismaService, classId: string): Promise<ClassAccessTarget> {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        code: true,
        teacherId: true,
        status: true,
        totalSessions: true,
        expectedEndDate: true,
        scheduleDays: true,
        scheduleStartTime: true,
        scheduleEndTime: true,
        startDate: true,
        course: { select: { name: true } },
        teacher: { select: { id: true, fullName: true } },
      },
    });
    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }
    return cls;
  }

  /**
   * Resolves read access to a class's sessions (`FUNC-028`, `DEC-024`, `DEC-025`):
   * - ADMIN: all classes
   * - TEACHER: currently assigned lead teacher (including completed/archived classes per `DEC-025`)
   * - STUDENT: only classes where student holds an enrollment (`ACTIVE`, `COMPLETED`, etc.)
   * - Pure SUPERADMIN: denied unless also ADMIN
   */
  async resolveClassScheduleViewerRole(
    prisma: PrismaService,
    actor: AuthenticatedUser,
    targetClass: Pick<ClassAccessTarget, 'id' | 'teacherId'>,
  ): Promise<'ADMIN' | 'TEACHER' | 'STUDENT'> {
    if (actor.roles.includes(Role.ADMIN)) {
      return 'ADMIN';
    }
    if (actor.roles.includes(Role.TEACHER) && targetClass.teacherId === actor.id) {
      return 'TEACHER';
    }
    if (actor.roles.includes(Role.STUDENT)) {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          classId: targetClass.id,
          studentId: actor.id,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        },
        select: { id: true, status: true },
      });
      if (enrollment) {
        return 'STUDENT';
      }
    }
    throw new ForbiddenException('Bạn không có quyền xem lịch học của lớp này');
  }

  /** Only `ADMIN` may mutate schedule rules, reschedule, cancel, or add manual/makeup sessions (`DEC-031`). */
  assertAdminCanMutateSchedule(actor: AuthenticatedUser, classStatus: ClassStatus): void {
    if (!actor.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên (Admin) mới có quyền điều chỉnh lịch học, hủy buổi hoặc tạo buổi học bù',
      );
    }
    if (classStatus === ClassStatus.COMPLETED || classStatus === ClassStatus.ARCHIVED) {
      throw new ForbiddenException(
        'Lớp học đã kết thúc hoặc lưu trữ (chỉ đọc), không thể thay đổi lịch học',
      );
    }
  }

  /** Calendar-wide scope filter by actor role (`DEC-024`, `DEC-025`). */
  async resolveCalendarClassScope(
    prisma: PrismaService,
    actor: AuthenticatedUser,
    requestedClassId?: string,
    requestedTeacherId?: string,
  ): Promise<{ effectiveRole: 'ADMIN' | 'TEACHER' | 'STUDENT'; classIds?: string[]; teacherId?: string }> {
    if (actor.roles.includes(Role.ADMIN)) {
      return {
        effectiveRole: 'ADMIN',
        ...(requestedClassId ? { classIds: [requestedClassId] } : {}),
        ...(requestedTeacherId ? { teacherId: requestedTeacherId } : {}),
      };
    }

    if (actor.roles.includes(Role.TEACHER)) {
      if (requestedClassId) {
        const cls = await prisma.class.findUnique({
          where: { id: requestedClassId },
          select: { id: true, teacherId: true },
        });
        if (!cls || cls.teacherId !== actor.id) {
          throw new ForbiddenException('Bạn chỉ được xem lịch của các lớp mình phụ trách');
        }
        return { effectiveRole: 'TEACHER', classIds: [cls.id], teacherId: actor.id };
      }
      return { effectiveRole: 'TEACHER', teacherId: actor.id };
    }

    if (actor.roles.includes(Role.STUDENT)) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          studentId: actor.id,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
          ...(requestedClassId ? { classId: requestedClassId } : {}),
        },
        select: { classId: true },
      });
      if (requestedClassId && enrollments.length === 0) {
        throw new ForbiddenException('Bạn không có quyền xem lịch của lớp học này');
      }
      return {
        effectiveRole: 'STUDENT',
        classIds: enrollments.map((e) => e.classId),
      };
    }

    throw new ForbiddenException('Bạn không có quyền xem lịch học');
  }

  assertCanViewScheduleLogs(actor: AuthenticatedUser): void {
    if (!actor.roles.includes(Role.ADMIN) && !actor.roles.includes(Role.SUPERADMIN)) {
      throw new ForbiddenException('Chỉ Admin hoặc Superadmin mới được xem nhật ký thay đổi lịch học');
    }
  }
}

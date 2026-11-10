import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { resolveVnCalendarDateForDb } from '../../../common/utils/timezone.util.js';
import { syncTeacherActiveClassesCount } from '../../../common/policies/teacher-invariants.policy.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { CompleteClassDto, ReopenClassDto } from '../dto/classes.dto.js';
import type { ClassDetailDto } from '../classes.types.js';
import { ClassQueryService } from './class-query.service.js';

const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ClassLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: ClassQueryService,
  ) {}

  async completeClass(
    actor: AuthenticatedUser,
    classId: string,
    dto: CompleteClassDto,
  ): Promise<ClassDetailDto> {
    const actualEndDate = resolveVnCalendarDateForDb(dto.actualEndDate);
    if (!actualEndDate) {
      throw new BadRequestException('Ngày kết thúc thực tế không hợp lệ');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${classId} FOR UPDATE`;

      const targetClass = await tx.class.findUnique({ where: { id: classId } });
      if (!targetClass) throw new NotFoundException('Không tìm thấy lớp học');

      if (
        targetClass.status === ClassStatus.COMPLETED ||
        targetClass.status === ClassStatus.ARCHIVED
      ) {
        throw new BadRequestException('Lớp học đã ở trạng thái kết thúc hoặc lưu trữ');
      }

      if (actualEndDate.getTime() < targetClass.startDate.getTime()) {
        throw new BadRequestException(
          'Ngày kết thúc thực tế không được nhỏ hơn ngày khai giảng',
        );
      }

      const activeEnrollments = await tx.enrollment.findMany({
        where: { classId, status: EnrollmentStatus.ACTIVE },
        select: { id: true, studentId: true },
      });

      const sortedStudentIds = Array.from(
        new Set(activeEnrollments.map((e) => e.studentId)),
      ).sort((a, b) => a.localeCompare(b));

      for (const sid of sortedStudentIds) {
        await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${sid} FOR UPDATE`;
      }

      await tx.enrollment.updateMany({
        where: { classId, status: EnrollmentStatus.ACTIVE },
        data: { status: EnrollmentStatus.COMPLETED, leftDate: actualEndDate },
      });

      for (const sid of sortedStudentIds) {
        await tx.studentProfile.updateMany({
          where: { userId: sid },
          data: { currentClassId: null, assignedClass: null, enrolledAt: null },
        });
        const studentUser = await tx.user.findUnique({ where: { id: sid } });
        const isPureStudent =
          studentUser !== null &&
          studentUser.roles.length === 1 &&
          studentUser.roles[0] === Role.STUDENT;
        if (isPureStudent) {
          await tx.user.updateMany({
            where: { id: sid, status: UserStatus.ACTIVE },
            data: { status: UserStatus.PENDING_CLASS },
          });
        }
      }

      await tx.classTeacherAssignment.updateMany({
        where: { classId, assignedTo: null },
        data: { assignedTo: actualEndDate },
      });

      const closedReason = dto.reason?.trim() || 'Hoàn thành khóa học';
      await tx.class.update({
        where: { id: classId },
        data: {
          status: ClassStatus.COMPLETED,
          actualEndDate,
          closedReason,
          closedAt: new Date(),
        },
      });

      await syncTeacherActiveClassesCount(tx, targetClass.teacherId);

      await writeAuditLog(tx, actor, {
        action: 'CLASS_COMPLETED',
        targetType: 'Class',
        targetId: classId,
        metadata: {
          classCode: targetClass.code,
          actualEndDate: actualEndDate.toISOString(),
          completedStudentsCount: sortedStudentIds.length,
          reason: dto.reason?.trim() ?? null,
        },
      });
    });

    return this.queryService.getClassById(actor, classId, {
      includeInactiveEnrollments: true,
    });
  }

  async reopenClass(
    actor: AuthenticatedUser,
    classId: string,
    dto?: ReopenClassDto,
    now: Date = new Date(),
  ): Promise<ClassDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${classId} FOR UPDATE`;

      const targetClass = await tx.class.findUnique({
        where: { id: classId },
        include: { teacher: true },
      });
      if (!targetClass) throw new NotFoundException('Không tìm thấy lớp học');

      if (
        targetClass.status !== ClassStatus.COMPLETED &&
        targetClass.status !== ClassStatus.ARCHIVED
      ) {
        throw new BadRequestException(
          'Chỉ có thể mở lại lớp học đã kết thúc hoặc lưu trữ',
        );
      }

      if (
        !targetClass.closedAt ||
        now.getTime() - targetClass.closedAt.getTime() > REOPEN_WINDOW_MS
      ) {
        throw new BadRequestException(
          'Đã quá thời hạn 7 ngày kể từ khi kết thúc lớp, không thể mở lại lớp học',
        );
      }

      const completedEnrollments = await tx.enrollment.findMany({
        where: { classId, status: EnrollmentStatus.COMPLETED },
      });
      const sortedCompleted = [...completedEnrollments].sort((a, b) =>
        a.studentId.localeCompare(b.studentId),
      );

      const userIdsToLock = Array.from(
        new Set([
          targetClass.teacherId,
          ...sortedCompleted.map((enr) => enr.studentId),
        ]),
      ).sort((a, b) => a.localeCompare(b));

      for (const uid of userIdsToLock) {
        await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${uid} FOR UPDATE`;
      }

      const lockedTeacher = await tx.user.findUnique({
        where: { id: targetClass.teacherId },
      });
      if (
        !lockedTeacher ||
        !lockedTeacher.roles.includes(Role.TEACHER) ||
        lockedTeacher.status !== UserStatus.ACTIVE
      ) {
        throw new BadRequestException(
          'Giáo viên phụ trách lớp hiện đã ngừng hoạt động, không thể mở lại lớp học',
        );
      }

      for (const enr of sortedCompleted) {
        const completedAtClassClose =
          !targetClass.actualEndDate ||
          (enr.leftDate !== null &&
            enr.leftDate.getTime() === targetClass.actualEndDate.getTime());

        const studentUser = await tx.user.findUnique({ where: { id: enr.studentId } });
        const otherActiveEnrollment = await tx.enrollment.findFirst({
          where: { studentId: enr.studentId, status: EnrollmentStatus.ACTIVE },
        });
        const newerOtherEnrollment = await tx.enrollment.findFirst({
          where: {
            studentId: enr.studentId,
            classId: { not: classId },
            enrolledDate: { gte: targetClass.actualEndDate ?? enr.enrolledDate },
          },
        });

        if (
          completedAtClassClose &&
          studentUser &&
          studentUser.roles.includes(Role.STUDENT) &&
          studentUser.status !== UserStatus.INACTIVE &&
          !otherActiveEnrollment &&
          !newerOtherEnrollment
        ) {
          await tx.enrollment.update({
            where: { id: enr.id },
            data: { status: EnrollmentStatus.ACTIVE, leftDate: null },
          });
          await tx.user.update({
            where: { id: enr.studentId },
            data: { status: UserStatus.ACTIVE },
          });
          await tx.studentProfile.updateMany({
            where: { userId: enr.studentId },
            data: {
              currentClassId: classId,
              assignedClass: targetClass.code,
              enrolledAt: enr.enrolledDate,
            },
          });
        }
      }

      const latestAssignment = await tx.classTeacherAssignment.findFirst({
        where: { classId, teacherId: targetClass.teacherId },
        orderBy: [{ assignedFrom: 'desc' }, { createdAt: 'desc' }],
      });

      if (latestAssignment) {
        await tx.classTeacherAssignment.update({
          where: { id: latestAssignment.id },
          data: { assignedTo: null },
        });
      } else {
        await tx.classTeacherAssignment.create({
          data: {
            classId,
            teacherId: targetClass.teacherId,
            assignedFrom: targetClass.startDate,
            changedById: actor.id,
            reason: dto?.reason?.trim() || 'Mở lại lớp học trong thời hạn 7 ngày',
          },
        });
      }

      await tx.class.update({
        where: { id: classId },
        data: {
          status: ClassStatus.ACTIVE,
          actualEndDate: null,
          closedReason: null,
          closedAt: null,
        },
      });

      await syncTeacherActiveClassesCount(tx, targetClass.teacherId);

      await writeAuditLog(tx, actor, {
        action: 'CLASS_REOPENED',
        targetType: 'Class',
        targetId: classId,
        metadata: {
          classCode: targetClass.code,
          reason: dto?.reason?.trim() ?? null,
        },
      });
    });

    return this.queryService.getClassById(actor, classId, {
      includeInactiveEnrollments: true,
    });
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-error.util.js';
import { formatIsoDateUtc, isVnFutureDate, resolveVnCalendarDateForDb } from '../../../common/utils/timezone.util.js';
import { syncTeacherActiveClassesCount } from '../../../common/policies/teacher-invariants.policy.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { CreateClassDto, UpdateClassDto } from '../dto/classes.dto.js';
import type { ClassItemDto } from '../classes.types.js';
import {
  assertClassIsEditable,
  assertOpenClassStatus,
  assertValidActiveCourseInDb,
  assertValidActiveTeacherInDb,
  assertValidTimeRange,
  calculateExpectedEndDate,
  findTeacherScheduleConflictWarning,
  normalizeScheduleDays,
  parseRequiredCalendarDate,
  resolveUpdatedClassSchedule,
} from '../policies/class-schedule.util.js';
import {
  CLASS_ITEM_INCLUDE,
  normalizeAndValidateClassCode,
  toClassItemDto,
  validateClassTotalSessions,
  type ClassItemEntity,
} from '../mappers/class.mapper.js';
import { SessionGeneratorService } from '../../schedules/services/session-generator.service.js';

@Injectable()
export class ClassCrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionGenerator: SessionGeneratorService,
  ) {}

  async createClass(actor: AuthenticatedUser, dto: CreateClassDto): Promise<ClassItemDto> {
    const code = normalizeAndValidateClassCode(dto.code ?? '');
    const scheduleDays = normalizeScheduleDays(dto.scheduleDays ?? []);
    const { startTime: scheduleStartTime, endTime: scheduleEndTime } =
      assertValidTimeRange(dto.scheduleStartTime ?? '', dto.scheduleEndTime ?? '');
    const startDate = parseRequiredCalendarDate(dto.startDate, 'Ngày khai giảng không hợp lệ');
    const status = dto.status ?? ClassStatus.UPCOMING;
    assertOpenClassStatus(status);

    const notes = dto.notes?.trim() || null;

    try {
      const { created, scheduleConflictWarning } = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${dto.teacherId} FOR UPDATE`;
        await assertValidActiveTeacherInDb(tx, dto.teacherId);
        await tx.$queryRaw`SELECT id FROM "courses" WHERE id = ${dto.courseId} FOR SHARE`;
        const course = await assertValidActiveCourseInDb(tx, dto.courseId);

        const duplicate = await tx.class.findUnique({ where: { code } });
        if (duplicate) throw new ConflictException('Mã lớp học đã tồn tại trong hệ thống');

        const totalSessions = validateClassTotalSessions(dto.totalSessions ?? course.defaultSessions ?? 24);
        const expectedEndDate = calculateExpectedEndDate(startDate, scheduleDays, totalSessions);
        const warning = await findTeacherScheduleConflictWarning(tx, dto.teacherId, {
          scheduleDays,
          scheduleStartTime,
          scheduleEndTime,
          startDate,
          endDate: expectedEndDate,
        });

        const cls = (await tx.class.create({
          data: {
            code,
            courseId: course.id,
            teacherId: dto.teacherId,
            status,
            startDate,
            totalSessions,
            scheduleDays,
            scheduleStartTime,
            scheduleEndTime,
            expectedEndDate,
            notes,
          },
          include: CLASS_ITEM_INCLUDE,
        })) as unknown as ClassItemEntity;

        await tx.classTeacherAssignment.create({
          data: {
            classId: cls.id,
            teacherId: dto.teacherId,
            assignedFrom: startDate,
            changedById: actor.id,
            reason: 'Phân công giáo viên khi khởi tạo lớp học',
          },
        });
        await this.sessionGenerator.generateInitialSessionsForClass(tx, actor, {
          id: cls.id,
          code: cls.code,
          startDate,
          scheduleDays,
          scheduleStartTime,
          scheduleEndTime,
          totalSessions,
        });
        await syncTeacherActiveClassesCount(tx, dto.teacherId);
        await writeAuditLog(tx, actor, {
          action: 'CLASS_CREATED',
          targetType: 'Class',
          targetId: cls.id,
          metadata: {
            code: cls.code,
            courseId: course.id,
            teacherId: dto.teacherId,
            totalSessions,
            startDate: formatIsoDateUtc(startDate),
            expectedEndDate: formatIsoDateUtc(expectedEndDate),
          },
        });
        return { created: cls, scheduleConflictWarning: warning };
      });
      return toClassItemDto(created, scheduleConflictWarning);
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Mã lớp học đã tồn tại trong hệ thống');
      }
      throw err;
    }
  }

  async updateClass(actor: AuthenticatedUser, classId: string, dto: UpdateClassDto): Promise<ClassItemDto> {
    if (dto.status !== undefined) assertOpenClassStatus(dto.status);

    try {
      const { updated, warning } = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${classId} FOR UPDATE`;
        const existing = (await tx.class.findUnique({
          where: { id: classId },
          include: CLASS_ITEM_INCLUDE,
        })) as unknown as ClassItemEntity | null;
        if (!existing) throw new NotFoundException('Không tìm thấy lớp học');

        assertClassIsEditable(existing.status);

        const nextCode = dto.code !== undefined ? normalizeAndValidateClassCode(dto.code) : existing.code;
        if (nextCode !== existing.code) {
          const duplicate = await tx.class.findFirst({ where: { code: nextCode, id: { not: classId } } });
          if (duplicate) throw new ConflictException('Mã lớp học đã tồn tại trong hệ thống');
        }

        let nextCourseId = existing.courseId;
        if (dto.courseId !== undefined && dto.courseId !== existing.courseId) {
          const hasEnrollments =
            (existing.enrollments?.length ?? 0) > 0 || (existing._count?.enrollments ?? 0) > 0;
          if (hasEnrollments || existing.status === ClassStatus.ACTIVE) {
            throw new BadRequestException(
              'Không thể đổi khóa học HSK khi lớp đã có học viên hoặc đang diễn ra',
            );
          }
          nextCourseId = (await assertValidActiveCourseInDb(tx, dto.courseId)).id;
        }

        const nextTeacherId = dto.teacherId ?? existing.teacherId;
        const teacherChanged = nextTeacherId !== existing.teacherId;
        const assignedFromDate = teacherChanged
          ? await this.validateAndLockTeacherReassignment(
              tx,
              classId,
              existing.teacherId,
              nextTeacherId,
              dto.teacherAssignedFrom,
            )
          : null;

        const {
          nextScheduleDays,
          nextStartTime,
          nextEndTime,
          nextStartDate,
          nextTotalSessions,
          nextExpectedEndDate,
          nextStatus,
          nextNotes,
        } = resolveUpdatedClassSchedule(existing, dto, validateClassTotalSessions);

        const scheduleWarning = await findTeacherScheduleConflictWarning(
          tx,
          nextTeacherId,
          {
            scheduleDays: nextScheduleDays,
            scheduleStartTime: nextStartTime,
            scheduleEndTime: nextEndTime,
            startDate: nextStartDate,
            endDate: nextExpectedEndDate,
          },
          classId,
        );

        const reason = dto.teacherChangeReason?.trim() || 'Thay đổi giáo viên phụ trách lớp';
        if (teacherChanged && assignedFromDate) {
          await tx.classTeacherAssignment.updateMany({
            where: { classId, assignedTo: null },
            data: { assignedTo: assignedFromDate },
          });
          await tx.classTeacherAssignment.create({
            data: { classId, teacherId: nextTeacherId, assignedFrom: assignedFromDate, changedById: actor.id, reason },
          });
        }

        const cls = (await tx.class.update({
          where: { id: classId },
          data: {
            code: nextCode,
            courseId: nextCourseId,
            teacherId: nextTeacherId,
            status: nextStatus,
            startDate: nextStartDate,
            totalSessions: nextTotalSessions,
            scheduleDays: nextScheduleDays,
            scheduleStartTime: nextStartTime,
            scheduleEndTime: nextEndTime,
            expectedEndDate: existing.expectedEndDate ?? nextExpectedEndDate,
            notes: nextNotes,
          },
          include: CLASS_ITEM_INCLUDE,
        })) as unknown as ClassItemEntity;

        const reconciled = await this.sessionGenerator.reconcileRecurringSessionsAfterRuleUpdate(
          tx,
          actor,
          {
            classId: cls.id,
            classCode: cls.code,
            previousRule: {
              startDate: existing.startDate,
              scheduleDays: existing.scheduleDays,
              scheduleStartTime: existing.scheduleStartTime,
              scheduleEndTime: existing.scheduleEndTime,
              totalSessions: existing.totalSessions,
              expectedEndDate: existing.expectedEndDate,
            },
            nextRule: {
              startDate: nextStartDate,
              scheduleDays: nextScheduleDays,
              scheduleStartTime: nextStartTime,
              scheduleEndTime: nextEndTime,
              totalSessions: nextTotalSessions,
            },
          },
        );
        cls.expectedEndDate = reconciled.expectedEndDate;

        if (nextCode !== existing.code) {
          await tx.studentProfile.updateMany({
            where: { currentClassId: classId },
            data: { assignedClass: nextCode },
          });
        }

        if (teacherChanged && assignedFromDate) {
          await syncTeacherActiveClassesCount(tx, existing.teacherId);
          await syncTeacherActiveClassesCount(tx, nextTeacherId);
          await writeAuditLog(tx, actor, {
            action: 'CLASS_TEACHER_CHANGED',
            targetType: 'Class',
            targetId: classId,
            metadata: {
              previousTeacherId: existing.teacherId,
              newTeacherId: nextTeacherId,
              assignedFrom: formatIsoDateUtc(assignedFromDate),
              reason,
            },
          });
        } else if (nextStatus !== existing.status) {
          await syncTeacherActiveClassesCount(tx, nextTeacherId);
        }

        await writeAuditLog(tx, actor, {
          action: 'CLASS_UPDATED',
          targetType: 'Class',
          targetId: classId,
          metadata: {
            code: cls.code,
            courseId: cls.courseId,
            teacherId: cls.teacherId,
            status: cls.status,
            totalSessions: cls.totalSessions,
            expectedEndDate: formatIsoDateUtc(reconciled.expectedEndDate ?? nextExpectedEndDate),
          },
        });
        return { updated: cls, warning: scheduleWarning };
      });
      return toClassItemDto(updated, warning);
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Mã lớp học đã tồn tại trong hệ thống');
      }
      throw err;
    }
  }

  private async validateAndLockTeacherReassignment(
    tx: Prisma.TransactionClient,
    classId: string,
    previousTeacherId: string,
    nextTeacherId: string,
    rawAssignedFrom?: string,
  ): Promise<Date> {
    const assignedFromDate = resolveVnCalendarDateForDb(rawAssignedFrom);
    if (!assignedFromDate) {
      throw new BadRequestException('Ngày bàn giao giáo viên không hợp lệ (YYYY-MM-DD)');
    }
    if (isVnFutureDate(assignedFromDate)) {
      throw new BadRequestException(
        'Chưa hỗ trợ lên lịch bàn giao giáo viên vào ngày tương lai: quyền phụ trách thay đổi ngay khi lưu. Vui lòng chọn ngày hôm nay hoặc ngày đã qua, hoặc đổi giáo viên đúng vào ngày bàn giao',
      );
    }
    const sortedTeachers = [previousTeacherId, nextTeacherId].sort((a, b) => a.localeCompare(b));
    for (const tid of sortedTeachers) {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${tid} FOR UPDATE`;
    }
    await assertValidActiveTeacherInDb(tx, nextTeacherId);

    const openAssignment = await tx.classTeacherAssignment.findFirst({
      where: { classId, assignedTo: null },
    });
    if (openAssignment && assignedFromDate.getTime() < openAssignment.assignedFrom.getTime()) {
      throw new BadRequestException(
        'Ngày bàn giao giáo viên mới không được nhỏ hơn ngày bắt đầu phân công hiện tại',
      );
    }
    return assignedFromDate;
  }
}

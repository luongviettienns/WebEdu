import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassStatus, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-error.util.js';
import {
  formatIsoDateUtc,
  resolveVnCalendarDateForDb,
} from '../../../common/utils/timezone.util.js';
import { syncTeacherActiveClassesCount } from '../../../common/policies/teacher-invariants.policy.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { CreateClassDto, UpdateClassDto } from '../dto/classes.dto.js';
import type { ClassItemDto } from '../classes.types.js';
import {
  assertClassIsEditable,
  assertOpenClassStatus,
  assertValidTimeRange,
  buildScheduleConflictWarning,
  calculateExpectedEndDate,
  normalizeScheduleDays,
  parseRequiredCalendarDate,
} from '../policies/class-schedule.util.js';
import {
  CLASS_ITEM_INCLUDE,
  normalizeAndValidateClassCode,
  toClassItemDto,
  validateClassTotalSessions,
  type ClassItemEntity,
} from '../mappers/class.mapper.js';

@Injectable()
export class ClassCrudService {
  constructor(private readonly prisma: PrismaService) {}

  async createClass(actor: AuthenticatedUser, dto: CreateClassDto): Promise<ClassItemDto> {
    const code = normalizeAndValidateClassCode(dto.code ?? '');
    const scheduleDays = normalizeScheduleDays(dto.scheduleDays ?? []);
    const { startTime: scheduleStartTime, endTime: scheduleEndTime } =
      assertValidTimeRange(dto.scheduleStartTime ?? '', dto.scheduleEndTime ?? '');
    const startDate = parseRequiredCalendarDate(dto.startDate, 'Ngày khai giảng không hợp lệ');
    const status = dto.status ?? ClassStatus.UPCOMING;
    assertOpenClassStatus(status);

    const course = await this.assertValidActiveCourse(dto.courseId);
    const totalSessions = validateClassTotalSessions(
      dto.totalSessions ?? course.defaultSessions ?? 24,
    );
    await this.assertValidActiveTeacher(dto.teacherId);

    const duplicate = await this.prisma.class.findUnique({ where: { code } });
    if (duplicate) {
      throw new ConflictException('Mã lớp học đã tồn tại trong hệ thống');
    }

    const expectedEndDate = calculateExpectedEndDate(startDate, scheduleDays, totalSessions);
    const notes = dto.notes?.trim() || null;
    const scheduleConflictWarning = await this.findTeacherScheduleWarning(dto.teacherId, {
      scheduleDays,
      scheduleStartTime,
      scheduleEndTime,
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
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
        return cls;
      });
      return toClassItemDto(created, scheduleConflictWarning);
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Mã lớp học đã tồn tại trong hệ thống');
      }
      throw err;
    }
  }

  async updateClass(
    actor: AuthenticatedUser,
    classId: string,
    dto: UpdateClassDto,
  ): Promise<ClassItemDto> {
    const existing = (await this.prisma.class.findUnique({
      where: { id: classId },
      include: CLASS_ITEM_INCLUDE,
    })) as unknown as ClassItemEntity | null;
    if (!existing) throw new NotFoundException('Không tìm thấy lớp học');

    assertClassIsEditable(existing.status);
    if (dto.status !== undefined) assertOpenClassStatus(dto.status);

    const nextCode =
      dto.code !== undefined ? normalizeAndValidateClassCode(dto.code) : existing.code;
    if (nextCode !== existing.code) {
      const duplicate = await this.prisma.class.findFirst({
        where: { code: nextCode, id: { not: classId } },
      });
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
      nextCourseId = (await this.assertValidActiveCourse(dto.courseId)).id;
    }

    const nextTeacherId = dto.teacherId ?? existing.teacherId;
    const teacherChanged = nextTeacherId !== existing.teacherId;
    let assignedFromDate: Date | null = null;
    if (teacherChanged) {
      await this.assertValidActiveTeacher(nextTeacherId);
      assignedFromDate = resolveVnCalendarDateForDb(dto.teacherAssignedFrom);
      if (!assignedFromDate) {
        throw new BadRequestException('Ngày bàn giao giáo viên không hợp lệ (YYYY-MM-DD)');
      }
    }

    const nextScheduleDays =
      dto.scheduleDays !== undefined
        ? normalizeScheduleDays(dto.scheduleDays)
        : existing.scheduleDays;
    const { startTime: nextStartTime, endTime: nextEndTime } = assertValidTimeRange(
      dto.scheduleStartTime ?? existing.scheduleStartTime,
      dto.scheduleEndTime ?? existing.scheduleEndTime,
    );
    const nextStartDate =
      dto.startDate !== undefined
        ? parseRequiredCalendarDate(dto.startDate, 'Ngày khai giảng không hợp lệ')
        : existing.startDate;
    const nextTotalSessions =
      dto.totalSessions !== undefined
        ? validateClassTotalSessions(dto.totalSessions)
        : existing.totalSessions;
    const nextExpectedEndDate = calculateExpectedEndDate(
      nextStartDate,
      nextScheduleDays,
      nextTotalSessions,
    );
    const nextStatus = dto.status ?? existing.status;
    const nextNotes = dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes;
    const scheduleConflictWarning = await this.findTeacherScheduleWarning(
      nextTeacherId,
      { scheduleDays: nextScheduleDays, scheduleStartTime: nextStartTime, scheduleEndTime: nextEndTime },
      classId,
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const reason = dto.teacherChangeReason?.trim() || 'Thay đổi giáo viên phụ trách lớp';
        if (teacherChanged && assignedFromDate) {
          await tx.classTeacherAssignment.updateMany({
            where: { classId, assignedTo: null },
            data: { assignedTo: assignedFromDate },
          });
          await tx.classTeacherAssignment.create({
            data: {
              classId,
              teacherId: nextTeacherId,
              assignedFrom: assignedFromDate,
              changedById: actor.id,
              reason,
            },
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
            expectedEndDate: nextExpectedEndDate,
            notes: nextNotes,
          },
          include: CLASS_ITEM_INCLUDE,
        })) as unknown as ClassItemEntity;

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
            expectedEndDate: formatIsoDateUtc(nextExpectedEndDate),
          },
        });
        return cls;
      });
      return toClassItemDto(updated, scheduleConflictWarning);
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Mã lớp học đã tồn tại trong hệ thống');
      }
      throw err;
    }
  }

  private async assertValidActiveCourse(
    courseId: string,
  ): Promise<{ id: string; defaultSessions: number | null }> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Không tìm thấy khóa học');
    if (!course.isActive) {
      throw new BadRequestException('Khóa học đã ngừng sử dụng, không thể mở lớp mới');
    }
    return course;
  }

  private async assertValidActiveTeacher(teacherId: string): Promise<void> {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, roles: true, status: true },
    });
    if (
      !teacher ||
      !teacher.roles.includes(Role.TEACHER) ||
      teacher.status !== UserStatus.ACTIVE
    ) {
      throw new BadRequestException('Giáo viên phụ trách không hợp lệ hoặc đã ngừng hoạt động');
    }
  }

  private async findTeacherScheduleWarning(
    teacherId: string,
    candidate: {
      scheduleDays: readonly number[];
      scheduleStartTime: string;
      scheduleEndTime: string;
    },
    excludeClassId?: string,
  ): Promise<string | null> {
    const otherActiveClasses = await this.prisma.class.findMany({
      where: {
        teacherId,
        ...(excludeClassId ? { id: { not: excludeClassId } } : {}),
        status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
      },
      select: {
        code: true,
        scheduleDays: true,
        scheduleStartTime: true,
        scheduleEndTime: true,
      },
    });
    return buildScheduleConflictWarning(candidate, otherActiveClasses);
  }
}

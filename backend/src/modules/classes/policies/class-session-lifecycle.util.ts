import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassStatus,
  Prisma,
  Role,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import {
  formatIsoDateUtc,
  resolveVnToday,
  VN_TIMEZONE,
} from '../../../common/utils/timezone.util.js';
import { formatInTimeZone } from 'date-fns-tz';
import { hasTimeRangeOverlap } from '../../schedules/policies/session-schedule.policy.js';
import {
  assertValidTimeRange,
  buildScheduleConflictWarning,
  calculateExpectedEndDate,
  normalizeScheduleDays,
  parseRequiredCalendarDate,
  type ClassScheduleSlice,
} from './class-schedule.util.js';

export {
  AUTO_CANCEL_ON_COMPLETE_REASON,
  RESTORE_ON_REOPEN_REASON,
  cancelScheduledSessionsOnCompleteInTx,
  restoreAutoCancelledSessionsOnReopenInTx,
  getCompletedSessionsCountMap,
  getAttendanceRecordsCountMap,
  toClassNextSessionDto,
  getNextSessionMap,
  findNextScheduledSession,
} from './class-session-counts.util.js';

export async function findTeacherScheduleConflictWarning(
  db: Prisma.TransactionClient | PrismaService,
  teacherId: string,
  candidate: ClassScheduleSlice,
  excludeClassId?: string,
): Promise<string | null> {
  const others = await db.class.findMany({
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
      startDate: true,
      expectedEndDate: true,
      actualEndDate: true,
    },
  });
  return buildScheduleConflictWarning(
    candidate,
    others.map(({ actualEndDate, expectedEndDate, ...rest }) => ({
      ...rest,
      endDate: actualEndDate ?? expectedEndDate,
    })),
  );
}

/**
 * Evaluates teacher schedule conflicts inside `updateClass` after session reconciliation.
 * When `classId` has `lesson_sessions` persisted, compares actual `SCHEDULED` sessions
 * against the new teacher's non-`CANCELLED` sessions in `UPCOMING`/`ACTIVE` classes;
 * otherwise falls back to template-range overlap using `effectiveEndDate`.
 */
export async function resolveUpdateClassScheduleConflictInTx(
  tx: Prisma.TransactionClient,
  params: {
    classId: string;
    nextTeacherId: string;
    teacherChanged: boolean;
    assignedFromDate: Date | null;
    scheduleDays: number[];
    scheduleStartTime: string;
    scheduleEndTime: string;
    nextStartDate: Date;
    effectiveEndDate: Date;
  },
  now: Date = new Date(),
): Promise<string | null> {
  if (!params.teacherChanged || !params.assignedFromDate) {
    return findTeacherScheduleConflictWarning(
      tx,
      params.nextTeacherId,
      {
        scheduleDays: params.scheduleDays,
        scheduleStartTime: params.scheduleStartTime,
        scheduleEndTime: params.scheduleEndTime,
        startDate: params.nextStartDate,
        endDate: params.effectiveEndDate,
      },
      params.classId,
    );
  }

  const totalClassSessionsCount = await tx.lessonSession.count({
    where: { classId: params.classId },
  });

  if (totalClassSessionsCount === 0) {
    const templateConflict = await findTeacherScheduleConflictWarning(
      tx,
      params.nextTeacherId,
      {
        scheduleDays: params.scheduleDays,
        scheduleStartTime: params.scheduleStartTime,
        scheduleEndTime: params.scheduleEndTime,
        startDate: params.assignedFromDate,
        endDate: params.effectiveEndDate,
      },
      params.classId,
    );
    if (templateConflict) {
      throw new ConflictException(templateConflict);
    }
    return null;
  }

  const candidateSessions = await tx.lessonSession.findMany({
    where: {
      classId: params.classId,
      status: SessionStatus.SCHEDULED,
      sessionDate: { gte: params.assignedFromDate },
    },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
    select: { sessionDate: true, startTime: true, endTime: true },
  });
  const todayVn = resolveVnToday(now);
  const localTime = formatInTimeZone(now, VN_TIMEZONE, 'HH:mm');
  // Match recurring-rule regeneration cutoff so already-started sessions today do not block a same-day reassignment.
  const activeCandidates =
    params.assignedFromDate.getTime() === todayVn.getTime()
      ? candidateSessions.filter(
          (session) =>
            session.sessionDate.getTime() > todayVn.getTime() || session.startTime > localTime,
        )
      : candidateSessions;
  if (activeCandidates.length === 0) {
    return null;
  }

  const otherSessions = await tx.lessonSession.findMany({
    where: {
      classId: { not: params.classId },
      status: { not: SessionStatus.CANCELLED },
      sessionDate: { gte: params.assignedFromDate },
      class: {
        teacherId: params.nextTeacherId,
        status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
      },
    },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
    select: {
      sessionDate: true,
      startTime: true,
      endTime: true,
      class: { select: { code: true } },
    },
  });

  const byDate = new Map<string, typeof otherSessions>();
  for (const session of otherSessions) {
    const dateKey = formatIsoDateUtc(session.sessionDate);
    const list = byDate.get(dateKey);
    if (list) {
      list.push(session);
    } else {
      byDate.set(dateKey, [session]);
    }
  }

  for (const candidate of activeCandidates) {
    const dateKey = formatIsoDateUtc(candidate.sessionDate);
    const sameDaySessions = byDate.get(dateKey);
    if (!sameDaySessions) continue;

    for (const other of sameDaySessions) {
      if (
        hasTimeRangeOverlap(
          candidate.startTime,
          candidate.endTime,
          other.startTime,
          other.endTime,
        )
      ) {
        throw new ConflictException(
          `Giáo viên đang có lịch dạy trùng giờ tại lớp ${other.class.code} (${dateKey} · ${other.startTime}–${other.endTime})`,
        );
      }
    }
  }

  return null;
}

export function resolveUpdatedClassSchedule(
  existing: {
    scheduleDays: number[];
    scheduleStartTime: string;
    scheduleEndTime: string;
    startDate: Date;
    totalSessions: number;
    status: ClassStatus;
    notes: string | null;
  },
  dto: {
    scheduleDays?: number[];
    scheduleStartTime?: string;
    scheduleEndTime?: string;
    startDate?: string;
    totalSessions?: number;
    status?: ClassStatus;
    notes?: string | null;
  },
  validateSessions: (value: number) => number,
) {
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
      ? validateSessions(dto.totalSessions)
      : existing.totalSessions;
  const nextExpectedEndDate = calculateExpectedEndDate(
    nextStartDate,
    nextScheduleDays,
    nextTotalSessions,
  );
  return {
    nextScheduleDays,
    nextStartTime,
    nextEndTime,
    nextStartDate,
    nextTotalSessions,
    nextExpectedEndDate,
    nextStatus: dto.status ?? existing.status,
    nextNotes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
  };
}

export async function assertValidActiveCourseInDb(
  db: Prisma.TransactionClient | PrismaService,
  courseId: string,
): Promise<{ id: string; defaultSessions: number | null }> {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundException('Không tìm thấy khóa học');
  if (!course.isActive) {
    throw new BadRequestException('Khóa học đã ngừng sử dụng, không thể mở lớp mới');
  }
  return course;
}

export async function assertValidActiveTeacherInDb(
  db: Prisma.TransactionClient | PrismaService,
  teacherId: string,
): Promise<void> {
  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { id: true, roles: true, status: true },
  });
  if (!teacher || !teacher.roles.includes(Role.TEACHER) || teacher.status !== UserStatus.ACTIVE) {
    throw new BadRequestException('Giáo viên phụ trách không hợp lệ hoặc đã ngừng hoạt động');
  }
}

export async function getClassMutabilityCountsInTx(
  tx: Prisma.TransactionClient,
  classId: string,
): Promise<{ completedSessionsCount: number; attendanceRecordsCount: number; isStartDateLocked: boolean }> {
  const [completedSessionsCount, attendanceRecordsCount] = await Promise.all([
    tx.lessonSession.count({ where: { classId, status: SessionStatus.COMPLETED } }),
    tx.attendanceRecord.count({ where: { classId } }),
  ]);
  return {
    completedSessionsCount,
    attendanceRecordsCount,
    isStartDateLocked: completedSessionsCount > 0 || attendanceRecordsCount > 0,
  };
}

export async function assertStartDateMutableInTx(
  tx: Prisma.TransactionClient,
  classId: string,
): Promise<void> {
  const { completedSessionsCount, attendanceRecordsCount } =
    await getClassMutabilityCountsInTx(tx, classId);
  if (completedSessionsCount > 0 || attendanceRecordsCount > 0) {
    throw new BadRequestException(
      'Không thể thay đổi ngày khai giảng khi lớp đã có buổi học hoàn thành hoặc đã có dữ liệu điểm danh',
    );
  }
}

export function computeStudentAbsencesMap(
  enrollments: ReadonlyArray<{ studentId: string; enrolledDate: Date; leftDate: Date | null }>,
  absenceRecords: ReadonlyArray<{ studentId: string; session: { sessionDate: Date } }>,
): Map<string, number> {
  const rangesByStudent = new Map<string, Array<{ enrolledDate: Date; leftDate: Date | null }>>();
  for (const enr of enrollments) {
    const list = rangesByStudent.get(enr.studentId) ?? [];
    list.push({ enrolledDate: enr.enrolledDate, leftDate: enr.leftDate });
    rangesByStudent.set(enr.studentId, list);
  }

  const absencesByStudentId = new Map<string, number>();
  for (const r of absenceRecords) {
    const sTime = r.session.sessionDate.getTime();
    const ranges = rangesByStudent.get(r.studentId) ?? [];
    const eligible = ranges.some(
      (e) =>
        e.enrolledDate.getTime() <= sTime &&
        (e.leftDate === null || e.leftDate.getTime() >= sTime),
    );
    if (eligible) {
      absencesByStudentId.set(r.studentId, (absencesByStudentId.get(r.studentId) ?? 0) + 1);
    }
  }
  return absencesByStudentId;
}

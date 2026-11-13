import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ClassStatus,
  Prisma,
  Role,
  SessionChangeAction,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import {
  assertVnDateNotInFuture,
  resolveVnCalendarDateForDb,
} from '../../../common/utils/timezone.util.js';

export const AUTO_CANCEL_ON_COMPLETE_REASON = 'Tự động hủy khi kết thúc lớp';
export const RESTORE_ON_REOPEN_REASON = 'Khôi phục buổi học khi mở lại lớp';

const TIME_24H_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const ACADEMIC_WEEKDAY_ORDER: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  0: 7,
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  0: 'CN',
};

export interface ClassScheduleSlice {
  scheduleDays: readonly number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  /** Ngày khai giảng (UTC midnight). Bỏ trống = không giới hạn đầu. */
  startDate?: Date | null;
  /** Ngày kết thúc thực tế hoặc dự kiến (UTC midnight). Bỏ trống = không giới hạn cuối. */
  endDate?: Date | null;
}

/**
 * Hai khoảng hoạt động [startDate, endDate] giao nhau (biên inclusive, null = mở).
 */
export function hasActivePeriodOverlap(
  a: ClassScheduleSlice,
  b: ClassScheduleSlice,
): boolean {
  const aStart = a.startDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  const aEnd = a.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const bStart = b.startDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  const bEnd = b.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
  return aStart <= bEnd && bStart <= aEnd;
}

export function normalizeScheduleDays(days: readonly number[]): number[] {
  if (!Array.isArray(days) || days.length === 0) {
    throw new BadRequestException(
      'Lịch học định kỳ trong tuần không hợp lệ (chỉ nhận các thứ từ T2 đến CN)',
    );
  }

  const unique = new Set<number>();
  for (const day of days) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new BadRequestException(
        'Lịch học định kỳ trong tuần không hợp lệ (chỉ nhận các thứ từ T2 đến CN)',
      );
    }
    unique.add(day);
  }

  return Array.from(unique).sort(
    (a, b) => (ACADEMIC_WEEKDAY_ORDER[a] ?? 99) - (ACADEMIC_WEEKDAY_ORDER[b] ?? 99),
  );
}

export function assertValidTimeRange(
  startTime: string,
  endTime: string,
): { startTime: string; endTime: string } {
  const start = startTime.trim();
  const end = endTime.trim();

  if (!TIME_24H_REGEX.test(start) || !TIME_24H_REGEX.test(end) || start >= end) {
    throw new BadRequestException(
      'Khung giờ học không hợp lệ (giờ kết thúc phải sau giờ bắt đầu)',
    );
  }

  return { startTime: start, endTime: end };
}

export function formatScheduleText(
  scheduleDays: readonly number[],
  startTime: string,
  endTime: string,
): string {
  const normalizedDays = [...scheduleDays].sort(
    (a, b) => (ACADEMIC_WEEKDAY_ORDER[a] ?? 99) - (ACADEMIC_WEEKDAY_ORDER[b] ?? 99),
  );
  const daysLabel = normalizedDays
    .map((d) => WEEKDAY_LABELS[d] ?? `T${d}`)
    .join('-');
  return `${daysLabel} · ${startTime}–${endTime}`;
}

/**
 * Sinh danh sách N ngày học định kỳ chuẩn UTC midnight từ `startDateUtc` theo các thứ `scheduleDays`.
 * Dùng làm nguồn chân lý duy nhất cho cả preview ngày kết thúc lớp và `SessionGeneratorService`.
 */
export function generateRecurringSessionDates(
  startDateUtc: Date,
  scheduleDays: readonly number[],
  totalSessions: number,
  excludedDateYmds?: ReadonlySet<string>,
): Date[] {
  const normalizedDays = normalizeScheduleDays(scheduleDays);
  if (!Number.isInteger(totalSessions) || totalSessions < 1) {
    throw new BadRequestException('Tổng số buổi học phải từ 1 buổi trở lên');
  }

  const daySet = new Set(normalizedDays);
  const cursor = new Date(
    Date.UTC(
      startDateUtc.getUTCFullYear(),
      startDateUtc.getUTCMonth(),
      startDateUtc.getUTCDate(),
    ),
  );

  const result: Date[] = [];
  let guardIterations = 0;
  const maxIterations = Math.max(totalSessions * 14 + 365, 2000);
  while (result.length < totalSessions && guardIterations < maxIterations) {
    guardIterations += 1;
    if (daySet.has(cursor.getUTCDay())) {
      const ymd = cursor.toISOString().slice(0, 10);
      if (!excludedDateYmds?.has(ymd)) {
        result.push(new Date(cursor.getTime()));
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (result.length < totalSessions) {
    throw new BadRequestException('Không thể sinh đủ số buổi học hợp lệ theo cấu hình lịch');
  }
  return result;
}

export function calculateExpectedEndDate(
  startDateUtc: Date,
  scheduleDays: readonly number[],
  totalSessions: number,
): Date {
  const dates = generateRecurringSessionDates(startDateUtc, scheduleDays, totalSessions);
  return dates[dates.length - 1]!;
}

export function hasScheduleOverlap(
  a: ClassScheduleSlice,
  b: ClassScheduleSlice,
): boolean {
  const aDays = new Set(a.scheduleDays);
  const sharesWeekday = b.scheduleDays.some((day) => aDays.has(day));
  if (!sharesWeekday || !hasActivePeriodOverlap(a, b)) {
    return false;
  }
  return (
    a.scheduleStartTime < b.scheduleEndTime &&
    b.scheduleStartTime < a.scheduleEndTime
  );
}

export function buildScheduleConflictWarning(
  candidate: ClassScheduleSlice,
  otherActiveClasses: ReadonlyArray<ClassScheduleSlice & { code: string }>,
): string | null {
  const conflicts = otherActiveClasses.filter((other) =>
    hasScheduleOverlap(candidate, other),
  );
  if (conflicts.length === 0) {
    return null;
  }
  const summary = conflicts
    .map(
      (c) =>
        `${c.code} (${formatScheduleText(c.scheduleDays, c.scheduleStartTime, c.scheduleEndTime)})`,
    )
    .join(', ');
  return `Cảnh báo: Giáo viên đang có lịch dạy trùng giờ tại lớp ${summary}`;
}

export function parseRequiredCalendarDate(
  rawDate: string | undefined,
  errorMessage: string,
): Date {
  if (!rawDate || !rawDate.trim()) {
    throw new BadRequestException(errorMessage);
  }
  const parsed = resolveVnCalendarDateForDb(rawDate);
  if (!parsed) {
    throw new BadRequestException(errorMessage);
  }
  return parsed;
}

export function assertClassIsEditable(status: ClassStatus): void {
  if (status === ClassStatus.COMPLETED || status === ClassStatus.ARCHIVED) {
    throw new BadRequestException(
      'Lớp học đã kết thúc hoặc lưu trữ (chỉ đọc), không thể chỉnh sửa',
    );
  }
}

/**
 * Hệ thống chưa có bộ lập lịch (scheduler) cho thao tác có hiệu lực tương lai:
 * mọi thao tác đổi trạng thái ngay lập tức nên không chấp nhận ngày hiệu lực sau hôm nay (GMT+7).
 */
export function assertEffectiveDateNotInFuture(
  date: Date,
  actionLabel: string,
): void {
  assertVnDateNotInFuture(date, actionLabel);
}

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

export function assertOpenClassStatus(status: ClassStatus): void {
  if (status !== ClassStatus.UPCOMING && status !== ClassStatus.ACTIVE) {
    throw new BadRequestException(
      'Không thể đóng lớp trực tiếp qua cập nhật thông tin; vui lòng dùng chức năng Kết thúc lớp',
    );
  }
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

export async function getCompletedSessionsCountInTx(
  tx: Prisma.TransactionClient,
  classId: string,
): Promise<number> {
  return tx.lessonSession.count({
    where: { classId, status: SessionStatus.COMPLETED },
  });
}

export async function assertStartDateMutableInTx(
  tx: Prisma.TransactionClient,
  classId: string,
): Promise<void> {
  const [completedCount, attendanceCount] = await Promise.all([
    tx.lessonSession.count({ where: { classId, status: SessionStatus.COMPLETED } }),
    tx.attendanceRecord.count({ where: { classId } }),
  ]);
  if (completedCount > 0 || attendanceCount > 0) {
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

export async function cancelScheduledSessionsOnCompleteInTx(
  tx: Prisma.TransactionClient,
  classId: string,
  actor: Pick<AuthenticatedUser, 'id' | 'fullName'>,
  cancelAt: Date = new Date(),
): Promise<number> {
  const scheduled = await tx.lessonSession.findMany({
    where: { classId, status: SessionStatus.SCHEDULED },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, sessionDate: true, startTime: true, endTime: true },
  });
  if (scheduled.length === 0) return 0;

  await tx.lessonSession.updateMany({
    where: { id: { in: scheduled.map((s) => s.id) }, status: SessionStatus.SCHEDULED },
    data: {
      status: SessionStatus.CANCELLED,
      sessionNumber: null,
      cancelReason: AUTO_CANCEL_ON_COMPLETE_REASON,
      cancelledById: actor.id,
      cancelledAt: cancelAt,
    },
  });

  for (const s of scheduled) {
    await tx.sessionChangeLog.create({
      data: {
        classId,
        sessionId: s.id,
        action: SessionChangeAction.CANCEL,
        actorId: actor.id,
        actorName: actor.fullName,
        previousDate: s.sessionDate,
        previousStartTime: s.startTime,
        previousEndTime: s.endTime,
        reason: AUTO_CANCEL_ON_COMPLETE_REASON,
      },
    });
  }
  return scheduled.length;
}

export async function restoreAutoCancelledSessionsOnReopenInTx(
  tx: Prisma.TransactionClient,
  classId: string,
  actor: Pick<AuthenticatedUser, 'id' | 'fullName'>,
  renumberAndSyncFn?: (tx: Prisma.TransactionClient, classId: string) => Promise<unknown>,
): Promise<number> {
  const autoCancelled = await tx.lessonSession.findMany({
    where: {
      classId,
      status: SessionStatus.CANCELLED,
      cancelReason: AUTO_CANCEL_ON_COMPLETE_REASON,
      makeupReplacement: { is: null },
    },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, sessionDate: true, startTime: true, endTime: true },
  });
  if (autoCancelled.length === 0) return 0;

  for (const [idx, s] of autoCancelled.entries()) {
    await tx.lessonSession.update({
      where: { id: s.id },
      data: {
        status: SessionStatus.SCHEDULED,
        sessionNumber: 200001 + idx,
        cancelReason: null,
        cancelledById: null,
        cancelledAt: null,
      },
    });
    await tx.sessionChangeLog.create({
      data: {
        classId,
        sessionId: s.id,
        action: SessionChangeAction.GENERATE,
        actorId: actor.id,
        actorName: actor.fullName,
        newDate: s.sessionDate,
        newStartTime: s.startTime,
        newEndTime: s.endTime,
        reason: RESTORE_ON_REOPEN_REASON,
      },
    });
  }

  if (renumberAndSyncFn) {
    await renumberAndSyncFn(tx, classId);
  }
  return autoCancelled.length;
}

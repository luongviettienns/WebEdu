import { BadRequestException } from '@nestjs/common';
import { ClassStatus } from '@prisma/client';
import { resolveVnCalendarDateForDb } from '../../../common/utils/timezone.util.js';

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

export function calculateExpectedEndDate(
  startDateUtc: Date,
  scheduleDays: readonly number[],
  totalSessions: number,
): Date {
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

  let count = 0;
  while (count < totalSessions) {
    if (daySet.has(cursor.getUTCDay())) {
      count += 1;
      if (count === totalSessions) {
        return new Date(cursor.getTime());
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return new Date(cursor.getTime());
}

export function hasScheduleOverlap(
  a: ClassScheduleSlice,
  b: ClassScheduleSlice,
): boolean {
  const aDays = new Set(a.scheduleDays);
  const sharesWeekday = b.scheduleDays.some((day) => aDays.has(day));
  if (!sharesWeekday) {
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

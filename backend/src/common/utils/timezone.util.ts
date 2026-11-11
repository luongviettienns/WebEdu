import { BadRequestException } from '@nestjs/common';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Calculates the deadline for teachers to edit attendance.
 * According to TD Hán Ngữ business rules:
 * Teachers may edit attendance until the end of the 2nd day following the lesson (23:59:59.999 in VN timezone).
 */
export function calculateTeacherAttendanceDeadline(lessonDate: Date): Date {
  const zonedDate = toZonedTime(lessonDate, VN_TIMEZONE);
  const dayPlus2 = addDays(zonedDate, 2);
  const deadlineZoned = endOfDay(dayPlus2);
  return fromZonedTime(deadlineZoned, VN_TIMEZONE);
}

/**
 * Checks whether the current moment (or specified moment) is within the teacher attendance edit window.
 * Window starts at the beginning of the lesson date (00:00:00.000 in VN timezone)
 * and ends at 23:59:59.999 of the 2nd day following the lesson date.
 */
export function isWithinTeacherAttendanceWindow(lessonDate: Date, now: Date = new Date()): boolean {
  const zonedLesson = toZonedTime(lessonDate, VN_TIMEZONE);
  const windowStart = fromZonedTime(startOfDay(zonedLesson), VN_TIMEZONE);
  const windowEnd = calculateTeacherAttendanceDeadline(lessonDate);
  return now.getTime() >= windowStart.getTime() && now.getTime() <= windowEnd.getTime();
}

/**
 * Calculates integer age in years based on calendar date of birth (@db.Date in UTC)
 * compared against referenceInstant in Asia/Ho_Chi_Minh timezone.
 * Handles 00:00-06:59 GMT+7 boundary and Feb 29 leap year birthdays accurately.
 */
export function calculateAgeInVnTimezone(dob: Date | string, referenceInstant: Date = new Date()): number {
  let dobYear: number;
  let dobMonth: number;
  let dobDay: number;

  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
    const parts = dob.trim().split('-').map(Number);
    dobYear = parts[0]!;
    dobMonth = parts[1]!;
    dobDay = parts[2]!;
  } else {
    const d = typeof dob === 'string' ? new Date(dob) : dob;
    dobYear = d.getUTCFullYear();
    dobMonth = d.getUTCMonth() + 1;
    dobDay = d.getUTCDate();
  }

  const refFormatted = formatInTimeZone(referenceInstant, VN_TIMEZONE, 'yyyy-MM-dd');
  const refParts = refFormatted.split('-').map(Number);
  const refYear = refParts[0]!;
  const refMonth = refParts[1]!;
  const refDay = refParts[2]!;

  let age = refYear - dobYear;
  if (refMonth < dobMonth || (refMonth === dobMonth && refDay < dobDay)) {
    age -= 1;
  }
  return age;
}

/**
 * Formats a calendar date (@db.Date) as dd/mm/yyyy
 */
export function formatDateVn(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a timestamp in Asia/Ho_Chi_Minh as dd/mm/yyyy HH:mm
 */
export function formatDateTimeVn(date: Date | string, includeSeconds = false): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, VN_TIMEZONE, includeSeconds ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm');
}

/**
 * Resolves a calendar date (@db.Date stored as UTC midnight YYYY-MM-DDT00:00:00.000Z)
 * anchored to Asia/Ho_Chi_Minh timezone, rejecting invalid calendar rollovers (e.g. 2026-02-30).
 * Returns null when dateInput is malformed or represents a nonexistent calendar day.
 */
export function resolveVnCalendarDateForDb(
  dateInput?: string,
  nowInstant: Date = new Date(),
): Date | null {
  if (dateInput === undefined || dateInput.trim() === '') {
    const vnYmd = formatInTimeZone(nowInstant, VN_TIMEZONE, 'yyyy-MM-dd');
    return new Date(`${vnYmd}T00:00:00.000Z`);
  }

  const trimmed = dateInput.trim();
  const datePrefixMatch = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(trimmed);
  if (datePrefixMatch) {
    const prefixYmd = datePrefixMatch[1]!;
    const checkUtc = new Date(`${prefixYmd}T00:00:00.000Z`);
    if (Number.isNaN(checkUtc.getTime())) {
      return null;
    }
    const roundTrip = `${checkUtc.getUTCFullYear()}-${String(checkUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(checkUtc.getUTCDate()).padStart(2, '0')}`;
    if (roundTrip !== prefixYmd) {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return checkUtc;
    }
  }

  const parsedInstant = new Date(trimmed);
  if (Number.isNaN(parsedInstant.getTime())) {
    return null;
  }

  const vnYmd = formatInTimeZone(parsedInstant, VN_TIMEZONE, 'yyyy-MM-dd');
  return new Date(`${vnYmd}T00:00:00.000Z`);
}

/**
 * Formats the UTC calendar parts of a Date as `YYYY-MM-DD`.
 * Used for Prisma `@db.Date` columns, which are stored as UTC midnight.
 */
export function formatIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's calendar date in Asia/Ho_Chi_Minh as UTC midnight (matches Prisma `@db.Date`).
 */
export function resolveVnToday(nowInstant: Date = new Date()): Date {
  return new Date(`${formatInTimeZone(nowInstant, VN_TIMEZONE, 'yyyy-MM-dd')}T00:00:00.000Z`);
}

/**
 * True when the calendar date (UTC midnight) is strictly after today in Asia/Ho_Chi_Minh.
 */
export function isVnFutureDate(date: Date, nowInstant: Date = new Date()): boolean {
  return date.getTime() > resolveVnToday(nowInstant).getTime();
}

/**
 * Chặn chọn ngày hiệu lực trong tương lai (GMT+7) cho các thao tác áp dụng ngay
 * vì hệ thống chưa hỗ trợ bộ lập lịch tự động (scheduler).
 */
export function assertVnDateNotInFuture(
  date: Date,
  actionLabel: string,
  nowInstant: Date = new Date(),
): void {
  if (isVnFutureDate(date, nowInstant)) {
    throw new BadRequestException(
      `${actionLabel} không được chọn ngày trong tương lai: thao tác có hiệu lực ngay khi lưu (chưa hỗ trợ lên lịch tự động)`,
    );
  }
}

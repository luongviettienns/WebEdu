import { addDays, endOfDay, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Calculates the deadline for teachers to edit attendance.
 * According to TD Hán Ngữ business rules (FUNC-037 & ATT-01):
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

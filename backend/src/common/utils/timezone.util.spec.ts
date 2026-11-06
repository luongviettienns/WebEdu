import { describe, it, expect } from 'vitest';
import {
  VN_TIMEZONE,
  calculateTeacherAttendanceDeadline,
  isWithinTeacherAttendanceWindow,
} from './timezone.util.js';

describe('Timezone Utilities (Asia/Ho_Chi_Minh)', () => {
  it('exports canonical timezone constant as Asia/Ho_Chi_Minh', () => {
    expect(VN_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
  });

  it('calculates the attendance edit deadline as 23:59:59.999 on day 2 following lesson date', () => {
    // Lesson on Monday 2026-11-10 at 08:00 AM (GMT+7)
    const morningLesson = new Date('2026-11-10T08:00:00+07:00');
    // Lesson on Monday 2026-11-10 at 20:30 PM (GMT+7)
    const eveningLesson = new Date('2026-11-10T20:30:00+07:00');

    const morningDeadline = calculateTeacherAttendanceDeadline(morningLesson);
    const eveningDeadline = calculateTeacherAttendanceDeadline(eveningLesson);

    // Both must result in the exact same moment: 2026-11-12 23:59:59.999 GMT+7
    // In UTC: 2026-11-12 16:59:59.999Z
    const expectedUtcIso = new Date('2026-11-12T23:59:59.999+07:00').toISOString();

    expect(morningDeadline.toISOString()).toBe(expectedUtcIso);
    expect(eveningDeadline.toISOString()).toBe(expectedUtcIso);
  });

  it('correctly assesses if now is within the attendance edit window', () => {
    const lessonDate = new Date('2026-11-10T19:30:00+07:00');

    // Before window: Sunday 2026-11-09 at 23:59:59 GMT+7 (prior day)
    const beforeLessonDay = new Date('2026-11-09T23:59:59+07:00');
    expect(isWithinTeacherAttendanceWindow(lessonDate, beforeLessonDay)).toBe(false);

    // Far before window: 2026-11-01
    const farBefore = new Date('2026-11-01T10:00:00+07:00');
    expect(isWithinTeacherAttendanceWindow(lessonDate, farBefore)).toBe(false);

    // Inside window: Beginning of lesson day 2026-11-10 at 00:00:00 GMT+7
    const startOfLessonDay = new Date('2026-11-10T00:00:00+07:00');
    expect(isWithinTeacherAttendanceWindow(lessonDate, startOfLessonDay)).toBe(true);

    // Inside window: Wednesday 2026-11-12 at 23:59:50 GMT+7
    const insideWindow = new Date('2026-11-12T23:59:50+07:00');
    expect(isWithinTeacherAttendanceWindow(lessonDate, insideWindow)).toBe(true);

    // Outside window: Thursday 2026-11-13 at 00:00:01 GMT+7
    const outsideWindow = new Date('2026-11-13T00:00:01+07:00');
    expect(isWithinTeacherAttendanceWindow(lessonDate, outsideWindow)).toBe(false);
  });
});

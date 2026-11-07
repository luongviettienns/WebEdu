import { describe, it, expect } from 'vitest';
import {
  VN_TIMEZONE,
  calculateTeacherAttendanceDeadline,
  isWithinTeacherAttendanceWindow,
  calculateAgeInVnTimezone,
  formatDateVn,
  resolveVnCalendarDateForDb,
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

  it('calculates student age accurately in Asia/Ho_Chi_Minh including early morning 00:05 GMT+7 boundary', () => {
    // Student born on 2014-11-06 (@db.Date stored as 2014-11-06T00:00:00.000Z)
    const dob = new Date('2014-11-06T00:00:00.000Z');

    // Registering at 2026-11-06 00:05:00+07:00 (which is 2026-11-05T17:05:00.000Z in UTC!)
    const earlyMorningVn = new Date('2026-11-06T00:05:00+07:00');
    expect(calculateAgeInVnTimezone(dob, earlyMorningVn)).toBe(12);

    // One minute before midnight in VN (2026-11-05 23:59:00+07:00) -> still 11 years old
    const beforeBirthdayVn = new Date('2026-11-05T23:59:00+07:00');
    expect(calculateAgeInVnTimezone(dob, beforeBirthdayVn)).toBe(11);
  });

  it('calculates leap year birthday (Feb 29) and historical registration reference instant accurately', () => {
    const leapDob = new Date('2012-02-29T00:00:00.000Z');
    expect(calculateAgeInVnTimezone(leapDob, new Date('2026-02-28T12:00:00+07:00'))).toBe(13);
    expect(calculateAgeInVnTimezone(leapDob, new Date('2026-03-01T00:01:00+07:00'))).toBe(14);
    expect(formatDateVn(leapDob)).toBe('29/02/2012');
  });

  it('resolves Asia/Ho_Chi_Minh calendar dates at 00:30 GMT+7 without -1 day UTC shift and rejects invalid calendar rollover', () => {
    // 2026-11-08 00:30:00 GMT+7 is 2026-11-07T17:30:00.000Z in UTC — must resolve to 2026-11-08!
    const earlyMorningVn = new Date('2026-11-08T00:30:00+07:00');
    const defaultResolved = resolveVnCalendarDateForDb(undefined, earlyMorningVn);
    expect(defaultResolved?.toISOString()).toBe('2026-11-08T00:00:00.000Z');

    const isoInstantResolved = resolveVnCalendarDateForDb('2026-11-07T18:15:00.000Z');
    expect(isoInstantResolved?.toISOString()).toBe('2026-11-08T00:00:00.000Z');

    expect(resolveVnCalendarDateForDb('2026-02-30')).toBeNull();
    expect(resolveVnCalendarDateForDb('2026-02-30T10:00:00Z')).toBeNull();
    expect(resolveVnCalendarDateForDb('invalid-date')).toBeNull();
  });
});

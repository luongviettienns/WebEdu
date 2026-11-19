import { NotificationType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertSafeInternalLinkPath,
  buildNotificationContent,
} from './notification-message.util.js';

describe('notification-message.util', () => {
  it('accepts safe internal link paths and rejects external, protocol-relative, or control-char paths', () => {
    expect(assertSafeInternalLinkPath('/student/assignments/a1?mode=review')).toBe(
      '/student/assignments/a1?mode=review',
    );
    expect(assertSafeInternalLinkPath('/')).toBe('/');
    expect(() => assertSafeInternalLinkPath('')).toThrow();
    expect(() => assertSafeInternalLinkPath('https://evil.example/phish')).toThrow();
    expect(() => assertSafeInternalLinkPath('//evil.example')).toThrow();
    expect(() => assertSafeInternalLinkPath('/\\evil.example')).toThrow();
    expect(() => assertSafeInternalLinkPath('student/overview')).toThrow();
    expect(() => assertSafeInternalLinkPath('/student\n/overview')).toThrow();
  });

  it('builds Vietnamese copy for all student, teacher, and admin notification types', () => {
    const newStudent = buildNotificationContent({
      type: NotificationType.NEW_STUDENT_PENDING_CLASS,
      studentName: 'Nguyễn Minh Anh',
    });
    expect(newStudent.title).toContain('chờ xếp lớp');
    expect(newStudent.body).toContain('Nguyễn Minh Anh');

    const enrolled = buildNotificationContent({
      type: NotificationType.STUDENT_ENROLLED,
      classCode: 'HSK1-K26-01',
    });
    expect(enrolled.body).toContain('HSK1-K26-01');

    const transferred = buildNotificationContent({
      type: NotificationType.STUDENT_TRANSFERRED,
      sourceClassCode: 'HSK1-A',
      targetClassCode: 'HSK1-B',
    });
    expect(transferred.body).toContain('HSK1-A');
    expect(transferred.body).toContain('HSK1-B');

    const dropped = buildNotificationContent({
      type: NotificationType.STUDENT_DROPPED,
      classCode: 'HSK1-A',
    });
    expect(dropped.body).toContain('HSK1-A');

    const assignedTeacher = buildNotificationContent({
      type: NotificationType.TEACHER_ASSIGNED_CLASS,
      classCode: 'HSK2-01',
      courseName: 'Tiếng Trung HSK 2',
      isReassignment: false,
    });
    expect(assignedTeacher.body).toContain('HSK2-01');

    const rescheduled = buildNotificationContent({
      type: NotificationType.SESSION_RESCHEDULED,
      classCode: 'HSK2-01',
      sessionNumber: 5,
      previousDate: new Date('2026-11-20T00:00:00.000Z'),
      previousStartTime: '18:00',
      newDate: new Date('2026-11-22T00:00:00.000Z'),
      newStartTime: '09:00',
      newEndTime: '10:30',
      reason: 'GV đi công tác',
    });
    expect(rescheduled.body).toContain('22/11/2026');
    expect(rescheduled.body).toContain('09:00');

    const cancelledWithMakeup = buildNotificationContent({
      type: NotificationType.SESSION_CANCELLED,
      classCode: 'HSK2-01',
      sessionNumber: 6,
      sessionDate: new Date('2026-11-21T00:00:00.000Z'),
      reason: 'Nghỉ lễ',
      makeupDate: new Date('2026-11-23T00:00:00.000Z'),
      makeupStartTime: '14:00',
      makeupEndTime: '15:30',
    });
    expect(cancelledWithMakeup.body).toContain('Học bù');
    expect(cancelledWithMakeup.body).toContain('23/11/2026');

    const makeup = buildNotificationContent({
      type: NotificationType.SESSION_MAKEUP_ADDED,
      classCode: 'HSK2-01',
      makeupDate: new Date('2026-11-24T00:00:00.000Z'),
      makeupStartTime: '19:00',
      makeupEndTime: '20:30',
    });
    expect(makeup.body).toContain('24/11/2026');

    const assigned = buildNotificationContent({
      type: NotificationType.ASSIGNMENT_ASSIGNED,
      assessmentTitle: 'BTVN Bài 8',
      classCode: 'HSK1-01',
      dueAt: new Date('2026-11-25T15:00:00.000Z'), // 22:00 GMT+7
    });
    expect(assigned.body).toContain('BTVN Bài 8');
    expect(assigned.body).toContain('25/11/2026 22:00');

    const dueSoon = buildNotificationContent({
      type: NotificationType.ASSIGNMENT_DUE_SOON,
      assessmentTitle: 'Mini-test Bài 5',
      dueAt: new Date('2026-11-20T15:00:00.000Z'),
    });
    expect(dueSoon.title).toContain('sắp hết hạn');
    expect(dueSoon.body).toContain('Mini-test Bài 5');

    const reopened = buildNotificationContent({
      type: NotificationType.SUBMISSION_REOPENED,
      assessmentTitle: 'Kiểm tra giữa kỳ',
      dueAt: new Date('2026-11-26T10:00:00.000Z'),
    });
    expect(reopened.body).toContain('Kiểm tra giữa kỳ');

    const pendingAgg = buildNotificationContent({
      type: NotificationType.SUBMISSION_PENDING_GRADING,
      assessmentTitle: 'Đề kiểm tra HSK1',
      pendingCount: 3,
    });
    expect(pendingAgg.body).toContain('3 bài nộp');
    expect(pendingAgg.body).toContain('Đề kiểm tra HSK1');

    const gradePub = buildNotificationContent({
      type: NotificationType.GRADE_PUBLISHED,
      assessmentTitle: 'Mini-test Bài 5',
      totalScore: 8.5,
      maxScore: 10,
    });
    expect(gradePub.title).toContain('Đã công bố điểm');
    expect(gradePub.body).toContain('8.5/10');

    const gradeUpdated = buildNotificationContent({
      type: NotificationType.GRADE_UPDATED,
      assessmentTitle: 'Mini-test Bài 5',
      totalScore: 9,
      maxScore: 10,
    });
    expect(gradeUpdated.title).toContain('cập nhật');
    expect(gradeUpdated.body).toContain('9/10');
  });
});

import { EnrollmentStatus, NotificationType, SubmissionStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { NotificationAcademicTriggersService } from './notification-academic-triggers.service.js';

describe('NotificationAcademicTriggersService', () => {
  it('dispatches session change only to ACTIVE students and lead teacher while excluding actorId', async () => {
    const dispatchService = {
      dispatchManyTx: vi.fn().mockResolvedValue(2),
      upsertDedupNotificationTx: vi.fn(),
      resolveActiveAdminRecipientIdsTx: vi.fn(),
    } as never;
    const tx = {
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'stu-1' },
          { studentId: 'actor-admin' },
        ]),
      },
    } as never;

    const service = new NotificationAcademicTriggersService(dispatchService);
    await service.onSessionChangedTx(tx, {
      type: NotificationType.SESSION_RESCHEDULED,
      classId: 'cls-1',
      classCode: 'HSK1-A',
      teacherId: 'teacher-1',
      actorId: 'actor-admin',
      sessionNumber: 3,
      previousDate: new Date('2026-11-20T00:00:00.000Z'),
      previousStartTime: '18:00',
      newDate: new Date('2026-11-22T00:00:00.000Z'),
      newStartTime: '09:00',
      newEndTime: '10:30',
      reason: 'Đổi giờ dạy',
    });

    expect((tx as { enrollment: { findMany: ReturnType<typeof vi.fn> } }).enrollment.findMany)
      .toHaveBeenCalledWith({
        where: { classId: 'cls-1', status: EnrollmentStatus.ACTIVE },
        select: { studentId: true },
      });

    expect((dispatchService as { dispatchManyTx: ReturnType<typeof vi.fn> }).dispatchManyTx)
      .toHaveBeenCalledWith(tx, [
        expect.objectContaining({
          recipientId: 'stu-1',
          type: NotificationType.SESSION_RESCHEDULED,
          linkPath: '/student/schedule',
        }),
        expect.objectContaining({
          recipientId: 'teacher-1',
          type: NotificationType.SESSION_RESCHEDULED,
          linkPath: '/teacher/schedules',
        }),
      ]);
  });

  it('aggregates pending grading notification per assignment for lead teacher via upsertDedupNotificationTx', async () => {
    const dispatchService = {
      dispatchManyTx: vi.fn(),
      upsertDedupNotificationTx: vi.fn().mockResolvedValue(undefined),
      resolveActiveAdminRecipientIdsTx: vi.fn(),
    } as never;
    const tx = {
      classAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'assign-1',
          assessment: { title: 'Mini-test Bài 5' },
          class: { teacherId: 'teacher-1' },
        }),
      },
      submission: {
        count: vi.fn().mockResolvedValue(2),
      },
    } as never;

    const service = new NotificationAcademicTriggersService(dispatchService);
    await service.onSubmissionPendingGradingTx(tx, {
      assignmentId: 'assign-1',
      studentId: 'stu-2',
    });

    expect((tx as { submission: { count: ReturnType<typeof vi.fn> } }).submission.count)
      .toHaveBeenCalledWith({
        where: {
          classAssignmentId: 'assign-1',
          status: {
            in: [SubmissionStatus.SUBMITTED_WAITING, SubmissionStatus.AUTO_GRADED_PENDING_REVIEW],
          },
        },
      });
    expect(
      (dispatchService as { upsertDedupNotificationTx: ReturnType<typeof vi.fn> })
        .upsertDedupNotificationTx,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientId: 'teacher-1',
        type: NotificationType.SUBMISSION_PENDING_GRADING,
        dedupKey: 'sub_pending:assign-1',
        linkPath: '/teacher/assignments/assign-1/grading',
        body: expect.stringContaining('2 bài nộp'),
      }),
    );
  });

  it('excludes actorId when publishing grades so self-graded rows never self-notify', async () => {
    const dispatchService = {
      dispatchManyTx: vi.fn().mockResolvedValue(1),
      upsertDedupNotificationTx: vi.fn(),
      resolveActiveAdminRecipientIdsTx: vi.fn(),
    } as never;
    const tx = {
      classAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          assessment: {
            title: 'Đề giữa kỳ',
            questions: [{ points: 6 }, { points: 4 }],
          },
        }),
      },
      submission: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'stu-1', totalScore: 8.5 },
        ]),
      },
    } as never;

    const service = new NotificationAcademicTriggersService(dispatchService);
    await service.onGradesPublishedTx(tx, {
      assignmentId: 'assign-9',
      studentIds: ['stu-1', 'teacher-1'],
      actorId: 'teacher-1',
    });

    expect((dispatchService as { dispatchManyTx: ReturnType<typeof vi.fn> }).dispatchManyTx)
      .toHaveBeenCalledWith(tx, [
        expect.objectContaining({
          recipientId: 'stu-1',
          type: NotificationType.GRADE_PUBLISHED,
          linkPath: '/student/assignments/assign-9?mode=review',
          body: expect.stringContaining('8.5/10'),
        }),
      ]);
  });
});

import { SubmissionStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { NotificationDeadlineService } from './notification-deadline.service.js';
import { NotificationMaintenanceService } from './notification-maintenance.service.js';

describe('NotificationDeadlineService & NotificationMaintenanceService', () => {
  it('dispatches ASSIGNMENT_DUE_SOON only for active students without submitted work and respects dueAtOverride', async () => {
    const now = new Date('2026-11-19T10:00:00.000Z');
    const prisma = {
      classAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'assign-1',
            dueAt: new Date('2026-11-19T20:00:00.000Z'), // 10h left
            assessment: { title: 'Mini-test Bài 5' },
            class: {
              enrollments: [
                { studentId: 'stu-unsubmitted' },
                { studentId: 'stu-submitted' },
                { studentId: 'stu-extended' },
              ],
            },
            submissions: [
              {
                studentId: 'stu-submitted',
                status: SubmissionStatus.SUBMITTED_WAITING,
                dueAtOverride: null,
              },
              {
                studentId: 'stu-extended',
                status: SubmissionStatus.IN_PROGRESS,
                dueAtOverride: new Date('2026-11-22T10:00:00.000Z'), // extended > 24h
              },
            ],
          },
        ]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<number>) => fn({})),
    } as never;

    const dispatchService = {
      dispatchManyTx: vi.fn().mockResolvedValue(1),
    } as never;

    const deadlineService = new NotificationDeadlineService(prisma, dispatchService);
    const created = await deadlineService.dispatchDueSoonReminders(now);

    expect(created).toBe(1);
    expect((dispatchService as { dispatchManyTx: ReturnType<typeof vi.fn> }).dispatchManyTx).toHaveBeenCalledWith(
      expect.anything(),
      [
        expect.objectContaining({
          recipientId: 'stu-unsubmitted',
          dedupKey: `due_soon:assign-1:${Date.parse('2026-11-19T20:00:00.000Z')}`,
          linkPath: '/student/assignments/assign-1',
        }),
      ],
    );
  });

  it('skips write transaction when due-soon dedupKey already exists (BUG-QA-10)', async () => {
    const now = new Date('2026-11-19T10:00:00.000Z');
    const dueAt = new Date('2026-11-19T20:00:00.000Z');
    const prisma = {
      classAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'assign-1',
            dueAt,
            assessment: { title: 'Mini-test Bài 5' },
            class: { enrollments: [{ studentId: 'stu-1' }] },
            submissions: [],
          },
        ]),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([
          { recipientId: 'stu-1', dedupKey: `due_soon:assign-1:${dueAt.getTime()}` },
        ]),
      },
      $transaction: vi.fn(),
    } as never;
    const dispatchService = { dispatchManyTx: vi.fn() } as never;

    const deadlineService = new NotificationDeadlineService(prisma, dispatchService);
    const created = await deadlineService.dispatchDueSoonReminders(now, 'stu-1');

    expect(created).toBe(0);
    expect((prisma as { $transaction: ReturnType<typeof vi.fn> }).$transaction).not.toHaveBeenCalled();
  });

  it('purges read notifications > 90 days and unread notifications > 180 days in bounded batches', async () => {
    const prisma = {
      $executeRaw: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(2),
    } as never;
    const maintenanceService = new NotificationMaintenanceService(prisma);
    const summary = await maintenanceService.purgeExpiredNotifications(
      new Date('2026-11-19T10:00:00.000Z'),
    );
    expect(summary).toEqual({ deletedRead: 4, deletedUnread: 2 });
  });
});

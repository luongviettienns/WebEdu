import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType, Role, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { NotificationQueryService } from './notification-query.service.js';

function makeActor(roles: Role[], effectiveRole: Role, id = 'user-1'): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    fullName: 'User Test',
    phone: '0901000001',
    roles,
    effectiveRole,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('NotificationQueryService', () => {
  it('blocks pure SUPERADMIN from reading or mutating notifications', async () => {
    const prisma = {
      notification: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    } as never;
    const service = new NotificationQueryService(prisma);
    const pureSa = makeActor([Role.SUPERADMIN], Role.SUPERADMIN);

    await expect(service.listForUser(pureSa, {})).rejects.toThrowError(ForbiddenException);
    await expect(service.getUnreadCount(pureSa)).rejects.toThrowError(ForbiddenException);
    await expect(service.markAsRead(pureSa, 'n-1')).rejects.toThrowError(ForbiddenException);
    await expect(service.markAllAsRead(pureSa)).rejects.toThrowError(ForbiddenException);
  });

  it('throws NotFoundException when markAsRead targets another user notification (IDOR)', async () => {
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never;
    const service = new NotificationQueryService(prisma);
    await expect(
      service.markAsRead(makeActor([Role.STUDENT], Role.STUDENT), 'n-other'),
    ).rejects.toThrowError(NotFoundException);
  });

  it('caps pagination limit to 50, filters unread when requested, and triggers student due-soon check', async () => {
    const now = new Date('2026-11-19T12:00:00.000Z');
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'n-1',
            recipientId: 'student-1',
            type: NotificationType.ASSIGNMENT_ASSIGNED,
            title: 'Bài tập mới',
            body: 'BTVN Bài 1',
            linkPath: '/student/assignments/a1',
            isRead: false,
            readAt: null,
            createdAt: now,
          },
        ]),
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      },
    } as never;
    const deadlineService = {
      ensureDueSoonForStudentIfDue: vi.fn().mockResolvedValue(undefined),
    } as never;

    const service = new NotificationQueryService(prisma, deadlineService);
    const result = await service.listForUser(
      makeActor([Role.STUDENT], Role.STUDENT, 'student-1'),
      { status: 'unread', page: 1, limit: 100 },
    );

    expect((deadlineService as { ensureDueSoonForStudentIfDue: ReturnType<typeof vi.fn> }).ensureDueSoonForStudentIfDue)
      .toHaveBeenCalledWith('student-1', 5_000);
    expect(result.limit).toBe(50);
    expect(result.unreadCount).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.items[0]?.id).toBe('n-1');
  });

  it('marks unread notification as read and resets unreadCount on markAllAsRead', async () => {
    const readAt = new Date('2026-11-19T12:05:00.000Z');
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'n-1',
          recipientId: 'teacher-1',
          isRead: false,
          readAt: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'n-1',
          isRead: true,
          readAt,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    } as never;

    const service = new NotificationQueryService(prisma);
    const actor = makeActor([Role.TEACHER], Role.TEACHER, 'teacher-1');

    const readRes = await service.markAsRead(actor, 'n-1');
    expect(readRes).toEqual({ id: 'n-1', isRead: true, readAt: readAt.toISOString() });

    const allRes = await service.markAllAsRead(actor);
    expect(allRes).toEqual({ markedCount: 3, unreadCount: 0 });
  });
});

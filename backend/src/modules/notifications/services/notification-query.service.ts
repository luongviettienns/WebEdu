import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import type { ListNotificationsQueryDto } from '../dto/notifications.dto.js';
import { toNotificationItemDto } from '../mappers/notification.mapper.js';
import type {
  MarkAllReadResponseDto,
  MarkReadResponseDto,
  NotificationListResponseDto,
  UnreadCountResponseDto,
} from '../notifications.types.js';
import { NotificationDeadlineService } from './notification-deadline.service.js';

const NOTIFICATION_ALLOWED_ROLES = new Set<Role>([
  Role.ADMIN,
  Role.TEACHER,
  Role.STUDENT,
]);

@Injectable()
export class NotificationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly deadlineService?: NotificationDeadlineService,
  ) {}

  async listForUser(
    actor: AuthenticatedUser,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    this.assertAllowedActor(actor);

    if (actor.roles.includes(Role.STUDENT) && this.deadlineService) {
      await this.deadlineService.ensureDueSoonForStudentIfDue(actor.id, 5_000);
    }

    const baseWindow = resolvePagination(query, 20);
    const limit = Math.min(50, baseWindow.limit);
    const page = baseWindow.page;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      recipientId: actor.id,
      ...(query.status === 'unread' ? { isRead: false } : {}),
    };

    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { recipientId: actor.id, isRead: false },
      }),
    ]);

    return {
      items: rows.map(toNotificationItemDto),
      unreadCount,
      total,
      page,
      limit,
      hasMore: skip + rows.length < total,
    };
  }

  async getUnreadCount(actor: AuthenticatedUser): Promise<UnreadCountResponseDto> {
    this.assertAllowedActor(actor);

    if (actor.roles.includes(Role.STUDENT) && this.deadlineService) {
      await this.deadlineService.ensureDueSoonForStudentIfDue(actor.id, 55_000);
    }

    const unreadCount = await this.prisma.notification.count({
      where: { recipientId: actor.id, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(
    actor: AuthenticatedUser,
    notificationId: string,
  ): Promise<MarkReadResponseDto> {
    this.assertAllowedActor(actor);

    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: actor.id },
      select: { id: true, isRead: true, readAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    if (existing.isRead && existing.readAt) {
      return {
        id: existing.id,
        isRead: true,
        readAt: existing.readAt.toISOString(),
      };
    }

    const now = new Date();
    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { isRead: true, readAt: now },
      select: { id: true, isRead: true, readAt: true },
    });

    return {
      id: updated.id,
      isRead: updated.isRead,
      readAt: (updated.readAt ?? now).toISOString(),
    };
  }

  async markAllAsRead(actor: AuthenticatedUser): Promise<MarkAllReadResponseDto> {
    this.assertAllowedActor(actor);

    const result = await this.prisma.notification.updateMany({
      where: { recipientId: actor.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return {
      markedCount: result.count,
      unreadCount: 0,
    };
  }

  private assertAllowedActor(actor: AuthenticatedUser): void {
    if (!actor.roles.some((role) => NOTIFICATION_ALLOWED_ROLES.has(role))) {
      throw new ForbiddenException('Tài khoản không có quyền truy cập thông báo hệ thống');
    }
  }
}

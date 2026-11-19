import type { Notification } from '@prisma/client';
import type { NotificationItemDto } from '../notifications.types.js';

export function toNotificationItemDto(row: Notification): NotificationItemDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath: row.linkPath,
    isRead: row.isRead,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

import type { NotificationType } from '@prisma/client';

export interface NotificationItemDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponseDto {
  items: NotificationItemDto[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UnreadCountResponseDto {
  unreadCount: number;
}

export interface MarkReadResponseDto {
  id: string;
  isRead: boolean;
  readAt: string;
}

export interface MarkAllReadResponseDto {
  markedCount: number;
  unreadCount: number;
}

export interface DispatchNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string;
  dedupKey?: string | null;
}

export interface UpsertDedupNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string;
  dedupKey: string;
}

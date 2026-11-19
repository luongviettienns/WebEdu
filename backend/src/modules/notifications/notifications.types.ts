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

export type SessionChangedNotificationInput =
  | {
      type: typeof NotificationType.SESSION_RESCHEDULED;
      classId: string;
      classCode: string;
      teacherId: string;
      actorId?: string;
      sessionNumber?: number | null;
      previousDate: Date;
      previousStartTime: string;
      newDate: Date;
      newStartTime: string;
      newEndTime: string;
      reason: string;
    }
  | {
      type: typeof NotificationType.SESSION_CANCELLED;
      classId: string;
      classCode: string;
      teacherId: string;
      actorId?: string;
      sessionNumber?: number | null;
      sessionDate: Date;
      reason: string;
      makeupDate?: Date;
      makeupStartTime?: string;
      makeupEndTime?: string;
    }
  | {
      type: typeof NotificationType.SESSION_MAKEUP_ADDED;
      classId: string;
      classCode: string;
      teacherId: string;
      actorId?: string;
      makeupDate: Date;
      makeupStartTime: string;
      makeupEndTime: string;
      originalDate?: Date;
    };

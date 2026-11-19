import { buildQueryString, fetchApi, type RequestOptions } from '@/lib/api-client';
import type {
  MarkAllReadResponseDto,
  MarkReadResponseDto,
  NotificationFilterStatus,
  NotificationListResponseDto,
  UnreadCountResponseDto,
} from '../types/notifications.types';

export function fetchNotifications(
  params: {
    status?: NotificationFilterStatus;
    page?: number;
    limit?: number;
  },
  options?: RequestOptions,
): Promise<NotificationListResponseDto> {
  const qs = buildQueryString({
    status: params.status,
    page: params.page,
    limit: params.limit,
  });
  return fetchApi<NotificationListResponseDto>(`/notifications${qs}`, {
    signal: options?.signal,
  });
}

export function fetchUnreadNotificationCount(
  options?: RequestOptions,
): Promise<UnreadCountResponseDto> {
  return fetchApi<UnreadCountResponseDto>('/notifications/unread-count', {
    signal: options?.signal,
  });
}

export function markNotificationRead(notificationId: string): Promise<MarkReadResponseDto> {
  return fetchApi<MarkReadResponseDto>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: 'PATCH' },
  );
}

export function markAllNotificationsRead(): Promise<MarkAllReadResponseDto> {
  return fetchApi<MarkAllReadResponseDto>('/notifications/read-all', {
    method: 'POST',
  });
}

import { formatDateDdMmYyyy } from '../../../lib/utils/date';
import type { NotificationType } from '../types/notifications.types';

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export function formatRelativeNotificationTime(
  isoTimestamp: string,
  nowMs = Date.now(),
): string {
  const parsedMs = Date.parse(isoTimestamp);
  if (Number.isNaN(parsedMs)) return '';

  const diffSeconds = Math.max(0, Math.floor((nowMs - parsedMs) / 1000));
  if (diffSeconds < 60) return 'Vừa xong';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} phút trước`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} giờ trước`;
  if (diffSeconds < 7 * 86400) return `${Math.floor(diffSeconds / 86400)} ngày trước`;
  return formatDateDdMmYyyy(isoTimestamp);
}

export function formatUnreadBadgeLabel(unreadCount: number): string {
  if (unreadCount <= 0) return '';
  return unreadCount > 99 ? '99+' : String(unreadCount);
}

export const NOTIFICATIONS_CHANGED_EVENT = 'webedu:notifications-changed';

export function dispatchNotificationsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function resolveSafeNotificationHref(linkPath: string): string {
  const trimmed = linkPath.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    hasControlChars(trimmed)
  ) {
    return '/';
  }
  return trimmed;
}

export interface NotificationCategoryMeta {
  label: string;
  pillClassName: string;
}

export function getNotificationCategoryMeta(
  type: NotificationType,
): NotificationCategoryMeta {
  switch (type) {
    case 'GRADE_PUBLISHED':
    case 'GRADE_UPDATED':
      return {
        label: 'Điểm số',
        pillClassName: 'bg-[#ECFDF5] text-[#065F46]',
      };
    case 'SESSION_RESCHEDULED':
    case 'SESSION_CANCELLED':
    case 'SESSION_MAKEUP_ADDED':
      return {
        label: 'Lịch học',
        pillClassName: 'bg-[#FEF3C7] text-[#92400E]',
      };
    case 'ASSIGNMENT_ASSIGNED':
    case 'ASSIGNMENT_DUE_SOON':
    case 'SUBMISSION_REOPENED':
    case 'SUBMISSION_PENDING_GRADING':
      return {
        label: 'Bài tập',
        pillClassName: 'bg-[var(--red-soft)] text-[var(--red-ink)]',
      };
    default:
      return {
        label: 'Học vụ',
        pillClassName: 'bg-[var(--surface-2)] text-[var(--ink-2)]',
      };
  }
}

'use client';

import type { NotificationItemDto } from '../types/notifications.types';
import {
  formatRelativeNotificationTime,
  getNotificationCategoryMeta,
} from '../utils/notification-time.util';

interface NotificationItemRowProps {
  item: NotificationItemDto;
  onSelect: (item: NotificationItemDto) => void;
}

export function NotificationItemRow({ item, onSelect }: NotificationItemRowProps) {
  const category = getNotificationCategoryMeta(item.type);
  const relativeTime = formatRelativeNotificationTime(item.createdAt);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        data-testid="notification-item"
        data-notification-id={item.id}
        data-read={item.isRead ? 'true' : 'false'}
        className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--red)] ${
          item.isRead ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]/70'
        }`}
      >
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            item.isRead ? 'bg-transparent' : 'bg-[var(--red)]'
          }`}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${category.pillClassName}`}
            >
              {category.label}
            </span>
            <span className="shrink-0 text-[11px] text-[var(--ink-2)]">{relativeTime}</span>
          </div>

          <p
            className={`text-xs leading-snug text-[var(--ink)] ${
              item.isRead ? 'font-medium' : 'font-semibold'
            }`}
          >
            {item.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--ink-2)]">
            {item.body}
          </p>
        </div>
      </button>
    </li>
  );
}

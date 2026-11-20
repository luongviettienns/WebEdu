'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUserDto } from '@/features/auth/api/auth.api';
import { useNotifications } from '../hooks/useNotifications';
import type { NotificationItemDto } from '../types/notifications.types';
import {
  dispatchNotificationsChanged,
  formatUnreadBadgeLabel,
} from '../utils/notification-time.util';
import { NotificationItemRow } from './NotificationItemRow';

interface NotificationBellPopoverProps {
  user?: AuthUserDto | null;
  pollingActive?: boolean;
}

export function NotificationBellPopover({
  user,
  pollingActive = true,
}: NotificationBellPopoverProps) {
  const router = useRouter();
  const canUseNotifications = Boolean(
    user && user.roles?.some((role) => role !== 'SUPERADMIN'),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const {
    isOpen,
    filterStatus,
    items,
    unreadCount,
    hasMore,
    isLoadingList,
    isLoadingMore,
    isMarkingAll,
    errorMessage,
    toggleOpen,
    closePopover,
    changeFilterStatus,
    loadMore,
    reloadCurrent,
    markItemReadAndResolveHref,
    markAllAsRead,
  } = useNotifications({ enabled: canUseNotifications && pollingActive });

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        closePopover();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePopover();
        bellButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePopover, isOpen]);

  if (!canUseNotifications) {
    return null;
  }

  const badgeLabel = formatUnreadBadgeLabel(unreadCount);

  const handleSelectItem = async (item: NotificationItemDto) => {
    const href = await markItemReadAndResolveHref(item);
    const targetPath = href.split('?')[0]?.split('#')[0] ?? href;
    if (typeof window !== 'undefined' && window.location.pathname === targetPath) {
      dispatchNotificationsChanged();
      router.refresh();
    } else {
      router.push(href);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={bellButtonRef}
        type="button"
        onClick={toggleOpen}
        data-testid="notification-bell-button"
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)]"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 ? (
          <span
            data-testid="notification-unread-badge"
            className="num absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--red)] px-1 text-[10px] font-bold leading-none text-white"
          >
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          data-testid="notification-popover"
          role="dialog"
          aria-label="Hộp thư thông báo"
          className="fixed inset-x-3 top-[60px] z-40 flex max-h-[calc(100dvh-76px)] flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] sm:max-h-[480px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Thông báo</h2>
              {unreadCount > 0 ? (
                <span className="num rounded-full bg-[var(--red-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--red-ink)]">
                  {unreadCount} chưa đọc
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={unreadCount === 0 || isMarkingAll}
              data-testid="notification-mark-all-read"
              className="text-xs font-medium text-[var(--red-ink)] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isMarkingAll ? 'Đang xử lý...' : 'Đánh dấu tất cả đã đọc'}
            </button>
          </div>

          {/* Filter Tabs */}
          <div
            role="tablist"
            aria-label="Bộ lọc thông báo"
            className="flex border-b border-[var(--line)] bg-[var(--surface-2)]/60 px-2 pt-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'all'}
              onClick={() => changeFilterStatus('all')}
              data-testid="notification-tab-all"
              className={`border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'border-[var(--red)] text-[var(--ink)]'
                  : 'border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'unread'}
              onClick={() => changeFilterStatus('unread')}
              data-testid="notification-tab-unread"
              className={`border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === 'unread'
                  ? 'border-[var(--red)] text-[var(--ink)]'
                  : 'border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              Chưa đọc
            </button>
          </div>

          {/* Notification List */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {errorMessage ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <p className="text-xs text-[var(--red-ink)]">{errorMessage}</p>
                <button
                  type="button"
                  onClick={reloadCurrent}
                  className="rounded border border-[var(--line-2)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  Thử lại
                </button>
              </div>
            ) : isLoadingList && items.length === 0 ? (
              <div className="space-y-2.5 p-3.5" aria-busy="true">
                <div className="h-12 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-12 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-12 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--ink-2)]">
                {filterStatus === 'unread'
                  ? 'Bạn đã đọc hết tất cả thông báo.'
                  : 'Chưa có thông báo nào.'}
              </div>
            ) : (
              <ul
                data-testid="notification-list"
                className="divide-y divide-[var(--line)]"
              >
                {items.map((item) => (
                  <NotificationItemRow
                    key={item.id}
                    item={item}
                    onSelect={(row) => void handleSelectItem(row)}
                  />
                ))}
              </ul>
            )}

            {hasMore ? (
              <div className="border-t border-[var(--line)] p-2 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  data-testid="notification-load-more"
                  className="w-full rounded py-1.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-50"
                >
                  {isLoadingMore ? 'Đang tải...' : 'Tải thêm'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--line)] bg-[var(--surface-2)]/40 px-3.5 py-2 text-center text-[11px] text-[var(--ink-2)]">
            Thông báo trong hệ thống
          </div>
        </section>
      ) : null}
    </div>
  );
}

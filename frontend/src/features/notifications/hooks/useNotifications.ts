'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api';
import type {
  NotificationFilterStatus,
  NotificationItemDto,
} from '../types/notifications.types';
import { resolveSafeNotificationHref } from '../utils/notification-time.util';

const PAGE_LIMIT = 20;
const POLL_INTERVAL_MS = 60_000;
const VISIBLE_REFRESH_THROTTLE_MS = 10_000;

interface UseNotificationsOptions {
  enabled: boolean;
}

export function useNotifications({ enabled }: UseNotificationsOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<NotificationFilterStatus>('all');
  const [items, setItems] = useState<NotificationItemDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const listAbortRef = useRef<AbortController | null>(null);
  const countAbortRef = useRef<AbortController | null>(null);
  const lastVisibleRefreshRef = useRef(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    countAbortRef.current?.abort();
    const controller = new AbortController();
    countAbortRef.current = controller;
    try {
      const res = await fetchUnreadNotificationCount({ signal: controller.signal });
      if (!controller.signal.aborted) {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // Bỏ qua lỗi polling nền / abort để không làm gián đoạn thao tác người dùng
    }
  }, [enabled]);

  const loadList = useCallback(
    async (
      targetStatus: NotificationFilterStatus,
      targetPage: number,
      append: boolean,
      silent = false,
    ) => {
      if (!enabled) return;
      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;

      if (!silent) {
        if (append) setIsLoadingMore(true);
        else setIsLoadingList(true);
      }
      setErrorMessage(null);

      try {
        const res = await fetchNotifications(
          { status: targetStatus, page: targetPage, limit: PAGE_LIMIT },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;

        setUnreadCount(res.unreadCount);
        setHasMore(res.hasMore);
        setPage(res.page);
        setItems((prev) => {
          if (!append) return res.items;
          const seen = new Set(prev.map((row) => row.id));
          return [...prev, ...res.items.filter((row) => !seen.has(row.id))];
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Không thể tải danh sách thông báo';
        setErrorMessage(msg);
      } finally {
        if (!controller.signal.aborted && !silent) {
          setIsLoadingList(false);
          setIsLoadingMore(false);
        }
      }
    },
    [enabled],
  );

  // Sync unread count on mount + visibility-gated 60s polling + throttled focus refresh
  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    lastVisibleRefreshRef.current = Date.now();
    void fetchUnreadNotificationCount({ signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setUnreadCount(res.unreadCount);
        }
      })
      .catch(() => undefined);

    const runVisibleRefresh = (enforceThrottle: boolean) => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (enforceThrottle && now - lastVisibleRefreshRef.current < VISIBLE_REFRESH_THROTTLE_MS) {
        return;
      }
      lastVisibleRefreshRef.current = now;
      void refreshUnreadCount();
      if (isOpen) {
        void loadList(filterStatus, 1, false, true);
      }
    };

    const handleVisibilityFocus = () => runVisibleRefresh(true);
    const intervalId = window.setInterval(() => runVisibleRefresh(false), POLL_INTERVAL_MS);
    window.addEventListener('focus', handleVisibilityFocus);
    document.addEventListener('visibilitychange', handleVisibilityFocus);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityFocus);
      document.removeEventListener('visibilitychange', handleVisibilityFocus);
      countAbortRef.current?.abort();
      listAbortRef.current?.abort();
    };
  }, [enabled, filterStatus, isOpen, loadList, refreshUnreadCount]);

  const toggleOpen = useCallback(() => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && enabled) {
      void loadList(filterStatus, 1, false);
    }
  }, [enabled, filterStatus, isOpen, loadList]);

  const closePopover = useCallback(() => {
    setIsOpen(false);
  }, []);

  const changeFilterStatus = useCallback(
    (nextStatus: NotificationFilterStatus) => {
      setFilterStatus(nextStatus);
      setPage(1);
      if (enabled && isOpen) {
        void loadList(nextStatus, 1, false);
      }
    },
    [enabled, isOpen, loadList],
  );

  const loadMore = useCallback(() => {
    if (isLoadingList || isLoadingMore || !hasMore) return;
    void loadList(filterStatus, page + 1, true);
  }, [filterStatus, hasMore, isLoadingList, isLoadingMore, loadList, page]);

  const reloadCurrent = useCallback(() => {
    void loadList(filterStatus, 1, false);
  }, [filterStatus, loadList]);

  const markItemReadAndResolveHref = useCallback(
    async (item: NotificationItemDto): Promise<string> => {
      const targetHref = resolveSafeNotificationHref(item.linkPath);
      if (!item.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setItems((prev) =>
          filterStatus === 'unread'
            ? prev.filter((row) => row.id !== item.id)
            : prev.map((row) =>
                row.id === item.id
                  ? { ...row, isRead: true, readAt: new Date().toISOString() }
                  : row,
              ),
        );
        try {
          await markNotificationRead(item.id);
        } catch {
          void refreshUnreadCount();
        }
      }
      setIsOpen(false);
      return targetHref;
    },
    [filterStatus, refreshUnreadCount],
  );

  const markAllAsRead = useCallback(async () => {
    if (isMarkingAll || unreadCount === 0) return;
    setIsMarkingAll(true);
    setErrorMessage(null);
    try {
      const res = await markAllNotificationsRead();
      setUnreadCount(res.unreadCount);
      setItems((prev) =>
        filterStatus === 'unread'
          ? []
          : prev.map((row) =>
              row.isRead ? row : { ...row, isRead: true, readAt: new Date().toISOString() },
            ),
      );
      if (filterStatus === 'unread') {
        setHasMore(false);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'Không thể đánh dấu tất cả đã đọc',
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [filterStatus, isMarkingAll, unreadCount]);

  return {
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
  };
}

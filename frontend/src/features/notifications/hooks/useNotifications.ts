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
import {
  dispatchNotificationsChanged,
  resolveSafeNotificationHref,
} from '../utils/notification-time.util';

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
  const prevUnreadRef = useRef<number | null>(null);
  const isOpenRef = useRef(isOpen);
  const filterStatusRef = useRef(filterStatus);
  const pageRef = useRef(page);

  const syncUnreadCountFromServer = useCallback((nextUnreadCount: number) => {
    const previous = prevUnreadRef.current;
    prevUnreadRef.current = nextUnreadCount;
    setUnreadCount(nextUnreadCount);
    if (previous !== null && nextUnreadCount > previous) {
      dispatchNotificationsChanged();
    }
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
    filterStatusRef.current = filterStatus;
    pageRef.current = page;
  }, [isOpen, filterStatus, page]);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    countAbortRef.current?.abort();
    const controller = new AbortController();
    countAbortRef.current = controller;
    try {
      const res = await fetchUnreadNotificationCount({ signal: controller.signal });
      if (!controller.signal.aborted) {
        syncUnreadCountFromServer(res.unreadCount);
      }
    } catch {
      // Bỏ qua lỗi polling nền / abort để không làm gián đoạn thao tác người dùng
    }
  }, [enabled, syncUnreadCountFromServer]);

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

        syncUnreadCountFromServer(res.unreadCount);
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
        if (listAbortRef.current === controller) {
          setIsLoadingList(false);
          setIsLoadingMore(false);
        }
      }
    },
    [enabled, syncUnreadCountFromServer],
  );

  // Sync unread count on mount + visibility-gated 60s polling + throttled focus refresh
  useEffect(() => {
    if (!enabled) return;

    countAbortRef.current?.abort();
    const mountController = new AbortController();
    countAbortRef.current = mountController;
    lastVisibleRefreshRef.current = Date.now();
    void fetchUnreadNotificationCount({ signal: mountController.signal })
      .then((res) => {
        if (!mountController.signal.aborted) {
          prevUnreadRef.current = res.unreadCount;
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
      if (isOpenRef.current && pageRef.current === 1) {
        void loadList(filterStatusRef.current, 1, false, true);
      } else {
        void refreshUnreadCount();
      }
    };

    const handleVisibilityFocus = () => runVisibleRefresh(true);
    const intervalId = window.setInterval(() => runVisibleRefresh(false), POLL_INTERVAL_MS);
    window.addEventListener('focus', handleVisibilityFocus);
    document.addEventListener('visibilitychange', handleVisibilityFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityFocus);
      document.removeEventListener('visibilitychange', handleVisibilityFocus);
      countAbortRef.current?.abort();
      listAbortRef.current?.abort();
    };
  }, [enabled, loadList, refreshUnreadCount]);

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
        countAbortRef.current?.abort();
        listAbortRef.current?.abort();
        setUnreadCount((prev) => {
          const next = Math.max(0, prev - 1);
          prevUnreadRef.current = next;
          return next;
        });
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
    countAbortRef.current?.abort();
    listAbortRef.current?.abort();
    setIsMarkingAll(true);
    setErrorMessage(null);
    try {
      const res = await markAllNotificationsRead();
      prevUnreadRef.current = res.unreadCount;
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

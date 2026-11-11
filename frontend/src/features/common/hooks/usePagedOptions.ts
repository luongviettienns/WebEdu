'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '@/lib/api-client';

export interface PagedOptionsPage<T> {
  items: T[];
  total: number;
  /** Số bản ghi server trả về trong trang (khi items đã bị lọc bớt phía client). */
  rawCount?: number;
}

export type PagedOptionsFetcher<T> = (
  params: { page: number; limit: number; search: string },
  signal: AbortSignal,
) => Promise<PagedOptionsPage<T>>;

/**
 * Tải danh sách lựa chọn theo từng trang từ server (tìm kiếm + "Tải thêm"),
 * không còn giới hạn ngầm 100 bản ghi. Lỗi giữ nguyên dữ liệu đã tải và có thể thử lại.
 */
export function usePagedOptions<T>(
  fetchPage: PagedOptionsFetcher<T>,
  search: string,
  options: { limit?: number; errorFallback: string },
) {
  const limit = options.limit ?? 10;
  const trimmedSearch = search.trim();
  const queryKey = `${trimmedSearch}::${limit}`;
  const fetchRef = useRef(fetchPage);
  const [state, setState] = useState<{
    key: string;
    items: T[];
    total: number;
    loadedRaw: number;
    page: number;
  }>({ key: queryKey, items: [], total: 0, loadedRaw: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const moreControllerRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const epochRef = useRef(0);

  useEffect(() => {
    fetchRef.current = fetchPage;
  }, [fetchPage]);

  useEffect(() => {
    const epoch = ++epochRef.current;
    moreControllerRef.current?.abort();
    loadingMoreRef.current = false;

    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      setLoadingMoreKey(null);
      try {
        const res = await fetchRef.current({ page: 1, limit, search: trimmedSearch }, controller.signal);
        if (controller.signal.aborted || epoch !== epochRef.current) return;
        setState({
          key: queryKey,
          items: res.items,
          total: res.total,
          loadedRaw: res.rawCount ?? res.items.length,
          page: 1,
        });
      } catch (err) {
        if (controller.signal.aborted || epoch !== epochRef.current) return;
        setState((prev) =>
          prev.key === queryKey
            ? prev
            : { key: queryKey, items: [], total: 0, loadedRaw: 0, page: 1 },
        );
        setError(extractErrorMessage(err, options.errorFallback));
      } finally {
        if (!controller.signal.aborted && epoch === epochRef.current) setLoading(false);
      }
    })();

    return () => {
      controller.abort();
      moreControllerRef.current?.abort();
      loadingMoreRef.current = false;
    };
  }, [queryKey, limit, trimmedSearch, reloadTick, options.errorFallback]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || state.key !== queryKey) return;
    const epoch = epochRef.current;
    const controller = new AbortController();
    moreControllerRef.current = controller;
    loadingMoreRef.current = true;
    setLoadingMoreKey(queryKey);
    setError('');
    try {
      const nextPage = state.page + 1;
      const res = await fetchRef.current({ page: nextPage, limit, search: trimmedSearch }, controller.signal);
      if (controller.signal.aborted || epoch !== epochRef.current) return;
      setState((prev) =>
        prev.key !== queryKey
          ? prev
          : {
              key: queryKey,
              items: [...prev.items, ...res.items],
              total: res.total,
              loadedRaw: prev.loadedRaw + (res.rawCount ?? res.items.length),
              page: nextPage,
            },
      );
    } catch (err) {
      if (controller.signal.aborted || epoch !== epochRef.current) return;
      setError(extractErrorMessage(err, options.errorFallback));
    } finally {
      if (moreControllerRef.current === controller) {
        moreControllerRef.current = null;
        loadingMoreRef.current = false;
        setLoadingMoreKey((prev) => (prev === queryKey ? null : prev));
      }
    }
  }, [state.key, state.page, queryKey, limit, trimmedSearch, options.errorFallback]);

  const retry = useCallback(() => setReloadTick((t) => t + 1), []);
  const isCurrentKey = state.key === queryKey;
  const items = isCurrentKey ? state.items : [];
  const total = isCurrentKey ? state.total : 0;
  const loadedRaw = isCurrentKey ? state.loadedRaw : 0;

  return {
    items,
    total,
    loading: loading || !isCurrentKey,
    loadingMore: loadingMoreKey === queryKey,
    error: isCurrentKey ? error : '',
    hasMore: loadedRaw < total,
    loadMore,
    retry,
  };
}

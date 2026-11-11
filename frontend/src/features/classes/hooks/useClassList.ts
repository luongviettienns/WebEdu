'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listClasses,
  type ClassItem,
  type ClassStatus,
} from '@/features/classes/api/classes.api';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { extractErrorMessage } from '@/lib/api-client';

export interface UseClassListOptions {
  /** Khóa cứng theo giáo viên (vd: tài khoản kiêm Admin xem "lớp của tôi"). */
  fixedTeacherId?: string;
  pageSize?: number;
  onAuthError: (error: unknown) => boolean;
  errorFallback?: string;
}

/**
 * Logic dùng chung cho danh sách lớp (Admin + Giáo viên): bộ lọc, tìm kiếm có debounce,
 * phân trang server-side, loading/error và giữ dữ liệu cũ khi làm mới thất bại.
 */
export function useClassList({
  fixedTeacherId,
  pageSize = 20,
  onAuthError,
  errorFallback = 'Không thể tải danh sách lớp học',
}: UseClassListOptions) {
  const [items, setItems] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearchRaw] = useState('');
  const [courseId, setCourseIdRaw] = useState('');
  const [status, setStatusRaw] = useState<ClassStatus | ''>('');
  const [includeEnded, setIncludeEndedRaw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const res = await listClasses(
          {
            search: debouncedSearch.trim() || undefined,
            courseId: courseId || undefined,
            status: status || undefined,
            teacherId: fixedTeacherId,
            includeEnded: includeEnded || status === 'COMPLETED' || status === 'ARCHIVED',
            page,
            limit: pageSize,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(res.total / pageSize));
        if (res.items.length === 0 && res.total > 0 && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setItems(res.items ?? []);
        setTotal(res.total ?? 0);
        setLoaded(true);
        setError('');
      } catch (err) {
        if (controller.signal.aborted || onAuthError(err)) return;
        setError(extractErrorMessage(err, errorFallback));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [
    debouncedSearch,
    courseId,
    status,
    includeEnded,
    page,
    pageSize,
    fixedTeacherId,
    tick,
    onAuthError,
    errorFallback,
  ]);

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);
  const setCourseId = useCallback((value: string) => {
    setCourseIdRaw(value);
    setPage(1);
  }, []);
  const setStatus = useCallback((value: ClassStatus | '') => {
    setStatusRaw(value);
    setPage(1);
  }, []);
  const setIncludeEnded = useCallback((value: boolean) => {
    setIncludeEndedRaw(value);
    setPage(1);
  }, []);
  const clearFilters = useCallback(() => {
    setSearchRaw('');
    setCourseIdRaw('');
    setStatusRaw('');
    setIncludeEndedRaw(false);
    setPage(1);
  }, []);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const hasActiveFilters = Boolean(search.trim() || courseId || status || includeEnded);

  return {
    items,
    total,
    page,
    pageSize,
    setPage,
    filters: { search, courseId, status, includeEnded },
    setSearch,
    setCourseId,
    setStatus,
    setIncludeEnded,
    clearFilters,
    hasActiveFilters,
    loading,
    /** Đã tải thành công ít nhất một lần. */
    loaded,
    error,
    /** Lỗi khi làm mới nhưng vẫn còn dữ liệu cũ đang hiển thị. */
    isStale: Boolean(error) && loaded,
    refresh,
  };
}

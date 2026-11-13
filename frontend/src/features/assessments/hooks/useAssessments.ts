'use client';

import { useCallback, useEffect, useState } from 'react';
import { listCourses, type CourseItemDto } from '@/features/courses/api/courses.api';
import {
  listAssessments,
  type AssessmentStatus,
  type AssessmentType,
  type TeacherAssessmentDto,
} from '@/features/assessments/api/assessments.api';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { extractErrorMessage } from '@/lib/api-client';

const PAGE_SIZE = 20;

export function useAssessments() {
  const [items, setItems] = useState<TeacherAssessmentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [courses, setCourses] = useState<CourseItemDto[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AssessmentType | ''>('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState<AssessmentStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const debouncedSearch = useDebounce(search, 300);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleType = useCallback((value: AssessmentType | '') => {
    setType(value);
    setPage(1);
  }, []);

  const handleCourseId = useCallback((value: string) => {
    setCourseId(value);
    setPage(1);
  }, []);

  const handleStatus = useCallback((value: AssessmentStatus | '') => {
    setStatus(value);
    setPage(1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await listCourses({ activeOnly: true }, { signal: controller.signal });
        if (!controller.signal.aborted) setCourses(res.items ?? []);
      } catch {
        /* list still works without course labels */
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await listAssessments(
          {
            search: debouncedSearch.trim() || undefined,
            type: type || undefined,
            courseId: courseId || undefined,
            status: status || undefined,
            page,
            limit: PAGE_SIZE,
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setItems(res.items);
          setTotal(res.total);
          setLimit(res.limit);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải ngân hàng đề'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [debouncedSearch, type, courseId, status, page, reloadTick]);

  return {
    items,
    total,
    page,
    limit,
    setPage,
    courses,
    search,
    setSearch: handleSearch,
    type,
    setType: handleType,
    courseId,
    setCourseId: handleCourseId,
    status,
    setStatus: handleStatus,
    loading,
    error,
    reload,
  };
}

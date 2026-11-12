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

export function useAssessments() {
  const [items, setItems] = useState<TeacherAssessmentDto[]>([]);
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
        const rows = await listAssessments(
          {
            search: debouncedSearch.trim() || undefined,
            type: type || undefined,
            courseId: courseId || undefined,
            status: status || undefined,
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setItems(rows);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải ngân hàng đề'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [debouncedSearch, type, courseId, status, reloadTick]);

  return {
    items,
    courses,
    search,
    setSearch,
    type,
    setType,
    courseId,
    setCourseId,
    status,
    setStatus,
    loading,
    error,
    reload,
  };
}

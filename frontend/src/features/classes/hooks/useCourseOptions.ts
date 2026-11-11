'use client';

import { useCallback, useEffect, useState } from 'react';
import { listCourses, type CourseItemDto } from '@/features/courses/api/courses.api';
import { extractErrorMessage } from '@/lib/api-client';

/** Tải danh mục khóa học cho form; lỗi được hiển thị và có thể thử lại. */
export function useCourseOptions() {
  const [courses, setCourses] = useState<CourseItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await listCourses(undefined, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setCourses(res.items ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(extractErrorMessage(err, 'Không thể tải danh mục khóa học HSK'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { courses, loading, error, retry };
}

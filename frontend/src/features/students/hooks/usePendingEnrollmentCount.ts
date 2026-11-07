'use client';

import { useEffect, useState } from 'react';
import { listPendingEnrollmentStudents } from '@/features/students/api/students.api';

/**
 * Số học viên đang chờ xếp lớp (badge trên menu của Admin).
 * Chỉ gọi API khi enabled = true; lỗi tải badge được bỏ qua.
 */
export function usePendingEnrollmentCount(enabled: boolean): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await listPendingEnrollmentStudents(undefined, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setCount(res.totalPending ?? res.items?.length ?? 0);
        }
      } catch {
        // Bỏ qua lỗi khi không tải được badge
      }
    })();
    return () => {
      controller.abort();
    };
  }, [enabled]);

  return count;
}

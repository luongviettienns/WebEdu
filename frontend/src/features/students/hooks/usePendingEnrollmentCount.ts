'use client';

import { useEffect, useState } from 'react';
import { listPendingEnrollmentStudents } from '@/features/students/api/students.api';

export const PENDING_ENROLLMENT_UPDATED_EVENT = 'webedu:pending-enrollment-updated';

export function notifyPendingEnrollmentUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PENDING_ENROLLMENT_UPDATED_EVENT));
  }
}

/**
 * Số học viên đang chờ xếp lớp (badge trên menu của Admin).
 * Chỉ gọi API khi enabled = true; tự động làm mới khi có sự kiện xếp lớp hoặc chuyển tab.
 */
export function usePendingEnrollmentCount(enabled: boolean): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const fetchCount = async () => {
      try {
        const res = await listPendingEnrollmentStudents();
        if (active) {
          setCount(res.totalPending ?? res.items?.length ?? 0);
        }
      } catch {
        // Bỏ qua lỗi khi không tải được badge
      }
    };

    void fetchCount();

    const handleUpdate = () => {
      void fetchCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchCount();
      }
    };

    window.addEventListener(PENDING_ENROLLMENT_UPDATED_EVENT, handleUpdate);
    window.addEventListener('focus', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener(PENDING_ENROLLMENT_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  return count;
}

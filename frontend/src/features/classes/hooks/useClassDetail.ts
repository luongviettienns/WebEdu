'use client';

import { useCallback, useEffect, useState } from 'react';
import { getClassDetail, type ClassDetail } from '@/features/classes/api/classes.api';
import {
  extractErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
} from '@/lib/api-client';

export interface UseClassDetailOptions {
  classId: string;
  defaultIncludeInactive?: boolean;
  onAuthError: (error: unknown) => boolean;
}

/**
 * Logic dùng chung cho trang chi tiết lớp (Admin + Giáo viên): tải, làm mới, lỗi 403,
 * thông báo thành công và giữ dữ liệu cũ (kèm lỗi) khi làm mới thất bại.
 */
export function useClassDetail({
  classId,
  defaultIncludeInactive = false,
  onAuthError,
}: UseClassDetailOptions) {
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [includeInactive, setIncludeInactive] = useState(defaultIncludeInactive);
  const [loading, setLoading] = useState(Boolean(classId));
  const [error, setError] = useState('');
  const [forbiddenMessage, setForbiddenMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!classId) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const res = await getClassDetail(
          classId,
          { includeInactiveEnrollments: includeInactive },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setDetail(res);
        setError('');
        setForbiddenMessage('');
      } catch (err) {
        if (controller.signal.aborted) return;
        if (isUnauthorizedError(err) && onAuthError(err)) return;
        if (isForbiddenError(err)) {
          setDetail(null);
          setForbiddenMessage(
            extractErrorMessage(
              err,
              'Bạn không được phân công phụ trách lớp học này hoặc lớp đã chuyển giao cho giảng viên khác.',
            ),
          );
          return;
        }
        setError(extractErrorMessage(err, 'Không thể tải thông tin chi tiết lớp học'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [classId, includeInactive, tick, onAuthError]);

  const refresh = useCallback((message?: string) => {
    setSuccessMessage(message ?? '');
    setTick((t) => t + 1);
  }, []);
  const dismissSuccess = useCallback(() => setSuccessMessage(''), []);

  return {
    detail,
    loading,
    error,
    forbiddenMessage,
    successMessage,
    dismissSuccess,
    includeInactive,
    setIncludeInactive,
    refresh,
    /** Làm mới thất bại nhưng vẫn còn dữ liệu cũ. */
    isStale: Boolean(error) && detail !== null,
  };
}

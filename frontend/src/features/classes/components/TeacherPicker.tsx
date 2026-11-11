'use client';

import React, { useCallback } from 'react';
import type { TeacherOptionItem } from '@/features/classes/api/classes.api';
import { PagedRadioPicker } from '@/features/common/components/PagedRadioPicker';
import type { PagedOptionsFetcher } from '@/features/common/hooks/usePagedOptions';
import { listTeachers } from '@/features/teachers/api/teachers.api';

export interface TeacherPickerProps {
  selected: TeacherOptionItem | null;
  onSelect: (teacher: TeacherOptionItem) => void;
}

/** Chọn giáo viên phụ trách: tìm kiếm + phân trang phía server, không tự chọn sẵn ai. */
export function TeacherPicker({ selected, onSelect }: TeacherPickerProps) {
  const fetchPage = useCallback<PagedOptionsFetcher<TeacherOptionItem>>(
    async ({ page, limit, search }, signal) => {
      const res = await listTeachers(
        { status: 'ACTIVE', search: search || undefined, page, limit },
        { signal },
      );
      return {
        total: res.total,
        items: (res.items ?? []).map((t) => ({
          id: t.id,
          fullName: t.fullName,
          email: t.email,
          activeClassesCount: t.activeClassesCount,
        })),
      };
    },
    [],
  );

  return (
    <PagedRadioPicker<TeacherOptionItem>
      testId="teacher-picker"
      legend="Giáo viên phụ trách (1 GV chính thức)"
      required
      searchPlaceholder="Tìm giáo viên theo tên, email, SĐT..."
      fetchPage={fetchPage}
      getId={(t) => t.id}
      selectedId={selected?.id ?? ''}
      onSelect={onSelect}
      selectedSummary={selected ? `${selected.fullName} (${selected.email})` : undefined}
      emptyMessage="Không tìm thấy giáo viên đang hoạt động phù hợp."
      errorFallback="Không thể tải danh sách giáo viên"
      renderOption={(t) => (
        <>
          <span className="font-semibold text-[var(--ink)]">{t.fullName}</span>{' '}
          <span className="text-xs text-[var(--ink-2)]">({t.email})</span>
          {typeof t.activeClassesCount === 'number' ? (
            <span className="ml-1 text-xs text-[var(--ink-3)]">· {t.activeClassesCount} lớp đang dạy</span>
          ) : null}
        </>
      )}
    />
  );
}

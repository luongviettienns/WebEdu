'use client';

import React from 'react';
import type { CourseItem, ClassStatus } from '@/features/classes/api/classes.api';

export interface ClassListFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  status: ClassStatus | '';
  onStatusChange: (value: ClassStatus | '') => void;
  includeEnded: boolean;
  onIncludeEndedChange: (value: boolean) => void;
  includeEndedLabel: string;
  /** Bộ lọc khóa học (chỉ hiện khi có danh mục). */
  courses?: readonly CourseItem[];
  courseId?: string;
  onCourseChange?: (value: string) => void;
  totalLabel: string;
  children?: React.ReactNode;
}

const FIELD_CLS =
  'rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function ClassListFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  includeEnded,
  onIncludeEndedChange,
  includeEndedLabel,
  courses,
  courseId,
  onCourseChange,
  totalLabel,
  children,
}: ClassListFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
        <input
          type="search"
          aria-label="Tìm kiếm lớp học"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full placeholder:text-[var(--ink-3)] sm:w-72 ${FIELD_CLS}`}
        />
        {courses && onCourseChange ? (
          <select
            aria-label="Lọc theo khóa học HSK"
            value={courseId ?? ''}
            onChange={(e) => onCourseChange(e.target.value)}
            className={`w-full sm:w-auto ${FIELD_CLS}`}
          >
            <option value="">Tất cả khóa học</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          aria-label="Lọc theo trạng thái lớp"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as ClassStatus | '')}
          className={`w-full sm:w-auto ${FIELD_CLS}`}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="UPCOMING">Sắp mở</option>
          <option value="ACTIVE">Đang học</option>
          <option value="COMPLETED">Đã kết thúc</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ink)]">
          <input
            type="checkbox"
            checked={includeEnded}
            onChange={(e) => onIncludeEndedChange(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
          />
          <span>{includeEndedLabel}</span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <span className="num text-xs font-medium text-[var(--ink-3)]" data-testid="class-total">
          {totalLabel}
        </span>
        {children}
      </div>
    </div>
  );
}

export function ListBanners({
  error,
  isStale,
  success,
  warning,
  onRetry,
  onDismissSuccess,
  onDismissWarning,
}: {
  error: string;
  isStale: boolean;
  success?: string;
  warning?: string;
  onRetry: () => void;
  onDismissSuccess?: () => void;
  onDismissWarning?: () => void;
}) {
  return (
    <>
      {error ? (
        <div
          role="alert"
          data-testid="list-error-banner"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]"
        >
          <span>
            {error}
            {isStale ? ' — đang hiển thị dữ liệu đã tải trước đó, có thể chưa mới nhất.' : ''}
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-[var(--red)]/40 bg-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--hover)]"
          >
            Thử lại
          </button>
        </div>
      ) : null}
      {warning ? (
        <div
          role="status"
          data-testid="schedule-warning-banner"
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-4 text-sm font-medium text-[var(--amber)]"
        >
          <span>Cảnh báo lịch dạy: {warning}</span>
          {onDismissWarning ? (
            <button type="button" onClick={onDismissWarning} aria-label="Ẩn cảnh báo" className="text-xs font-semibold">
              Ẩn
            </button>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]"
        >
          <span>{success}</span>
          {onDismissSuccess ? (
            <button type="button" onClick={onDismissSuccess} aria-label="Ẩn thông báo" className="text-xs font-semibold">
              Ẩn
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

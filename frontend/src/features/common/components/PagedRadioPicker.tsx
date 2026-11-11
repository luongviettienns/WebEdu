'use client';

import React, { useId, useRef, useState } from 'react';
import { usePagedOptions, type PagedOptionsFetcher } from '@/features/common/hooks/usePagedOptions';
import { useDebounce } from '@/features/common/hooks/useDebounce';

export interface PagedRadioPickerProps<T> {
  legend: string;
  required?: boolean;
  searchPlaceholder: string;
  fetchPage: PagedOptionsFetcher<T>;
  getId: (item: T) => string;
  renderOption: (item: T) => React.ReactNode;
  selectedId: string;
  onSelect: (item: T) => void;
  /** Mô tả mục đang chọn (hiển thị ngay cả khi mục đó không nằm trong trang hiện tại). */
  selectedSummary?: React.ReactNode;
  emptyMessage: string;
  errorFallback: string;
  testId: string;
}

/**
 * Bộ chọn 1 mục từ danh sách lớn: tìm kiếm + phân trang phía server ("Tải thêm"),
 * điều hướng bằng bàn phím theo radio group chuẩn, có lỗi + nút Thử lại.
 */
export function PagedRadioPicker<T>({
  legend,
  required = false,
  searchPlaceholder,
  fetchPage,
  getId,
  renderOption,
  selectedId,
  onSelect,
  selectedSummary,
  emptyMessage,
  errorFallback,
  testId,
}: PagedRadioPickerProps<T>) {
  const groupName = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { items, total, loading, loadingMore, error, hasMore, loadMore, retry } = usePagedOptions(
    fetchPage,
    debounced,
    { limit: 8, errorFallback },
  );

  return (
    <fieldset className="space-y-2" data-testid={testId}>
      <legend className="block text-sm font-medium text-[var(--ink)]">
        {legend} {required ? <span className="text-[var(--red)]">*</span> : null}
      </legend>
      <input
        ref={searchInputRef}
        type="search"
        aria-label={`Tìm kiếm: ${legend}`}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
      />
      {selectedSummary ? (
        <div className="rounded-lg border border-[var(--jade)]/30 bg-[var(--jade-soft)] px-3 py-1.5 text-xs font-medium text-[var(--jade)]">
          Đã chọn: {selectedSummary}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] px-3 py-2 text-xs font-medium text-[var(--red-ink)]"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              searchInputRef.current?.focus();
              retry();
            }}
            className="rounded-md border border-[var(--red)]/40 bg-white px-2.5 py-1 font-semibold text-[var(--red-ink)] hover:bg-[var(--hover)]"
          >
            Thử lại
          </button>
        </div>
      ) : null}
      <div
        className="max-h-48 divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-[var(--line)] bg-white"
        aria-busy={loading}
      >
        {loading ? (
          <p className="p-4 text-center text-xs text-[var(--ink-2)]">Đang tải danh sách...</p>
        ) : items.length === 0 && !error ? (
          <p className="p-4 text-center text-xs text-[var(--ink-2)]">{emptyMessage}</p>
        ) : (
          items.map((item) => {
            const id = getId(item);
            return (
              <label
                key={id}
                className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 hover:bg-[var(--hover)]"
              >
                <input
                  type="radio"
                  name={groupName}
                  value={id}
                  checked={selectedId === id}
                  onChange={() => onSelect(item)}
                  className="mt-1 h-4 w-4 border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
                />
                <span className="text-sm">{renderOption(item)}</span>
              </label>
            );
          })
        )}
      </div>
      {!loading && items.length > 0 ? (
        <div className="flex items-center justify-between text-xs text-[var(--ink-2)]">
          <span className="num">
            Đang hiển thị {items.length} / {total}
          </span>
          {hasMore ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="font-semibold text-[var(--red)] hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Đang tải...' : 'Tải thêm'}
            </button>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

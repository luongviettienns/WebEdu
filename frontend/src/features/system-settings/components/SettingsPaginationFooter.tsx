'use client';

import React from 'react';

interface SettingsPaginationFooterProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  itemLabel?: string;
  loading?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function SettingsPaginationFooter({
  page,
  totalPages,
  totalItems,
  itemLabel = 'bản ghi',
  loading = false,
  onPrevPage,
  onNextPage,
}: SettingsPaginationFooterProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-2)] font-num">
      <div className="flex items-center gap-2">
        <span>
          Trang {page} / {totalPages}
        </span>
        {typeof totalItems === 'number' ? (
          <span className="text-[var(--ink-3)]">
            ({totalItems} {itemLabel})
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={onPrevPage}
          className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1 font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trang trước
        </button>
        <button
          type="button"
          disabled={loading || page >= totalPages}
          onClick={onNextPage}
          className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1 font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

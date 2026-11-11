'use client';

import React from 'react';

export interface PaginationBarProps {
  page: number;
  limit: number;
  total: number;
  loading?: boolean;
  itemLabel?: string;
  onPageChange: (nextPage: number) => void;
}

/** Thanh phân trang server-side dùng chung (trang 1-based). */
export function PaginationBar({
  page,
  limit,
  total,
  loading = false,
  itemLabel = 'bản ghi',
  onPageChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const btnCls =
    'rounded-md border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--ink-2)]"
    >
      <span className="num" data-testid="pagination-summary">
        Hiển thị {from}–{to} / {total} {itemLabel} · Trang {page}/{totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btnCls}
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Trang trước
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Trang sau →
        </button>
      </div>
    </nav>
  );
}

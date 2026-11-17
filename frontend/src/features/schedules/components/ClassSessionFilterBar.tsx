'use client';

import React from 'react';
import type { SessionStatus } from '@/features/schedules/api/schedules.api';

interface ClassSessionFilterBarProps {
  status: '' | SessionStatus;
  from: string;
  to: string;
  onStatusChange: (status: '' | SessionStatus) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onReset: () => void;
}

export function ClassSessionFilterBar({
  status,
  from,
  to,
  onStatusChange,
  onFromChange,
  onToChange,
  onReset,
}: ClassSessionFilterBarProps) {
  const hasFilter = Boolean(status || from || to);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
      <div className="min-w-[160px]">
        <label htmlFor="class-session-status-filter" className="mb-1 block text-[11px] font-semibold uppercase text-[var(--ink-2)]">
          Trạng thái buổi
        </label>
        <select
          id="class-session-status-filter"
          aria-label="Lọc trạng thái buổi học"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as '' | SessionStatus)}
          className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="SCHEDULED">Dự kiến / Sắp tới</option>
          <option value="COMPLETED">Đã hoàn thành</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>

      <div>
        <label htmlFor="class-session-from-filter" className="mb-1 block text-[11px] font-semibold uppercase text-[var(--ink-2)]">
          Từ ngày
        </label>
        <input
          id="class-session-from-filter"
          type="date"
          aria-label="Lọc buổi học từ ngày"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="num rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="class-session-to-filter" className="mb-1 block text-[11px] font-semibold uppercase text-[var(--ink-2)]">
          Đến ngày
        </label>
        <input
          id="class-session-to-filter"
          type="date"
          aria-label="Lọc buổi học đến ngày"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="num rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
        />
      </div>

      {hasFilter ? (
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)]"
        >
          Xóa lọc
        </button>
      ) : null}
    </div>
  );
}

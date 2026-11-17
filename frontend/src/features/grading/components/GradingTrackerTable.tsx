'use client';

import React from 'react';
import { StatusTag } from '@/features/common/components/StatusTag';
import type {
  GradingTrackerFilter,
  GradingTrackerStudentRowDto,
} from '@/features/grading/api/grading.api';
import {
  formatUpdatedGradeBadge,
  getTrackerRowBadge,
} from '@/features/grading/utils/grading-status';
import { formatDateTimeVn } from '@/lib/utils/date';

const FILTERS: readonly { key: GradingTrackerFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'NEEDS_GRADING', label: 'Cần chấm' },
  { key: 'CONFIRMED', label: 'Đã xác nhận (Chưa công bố)' },
  { key: 'PUBLISHED', label: 'Đã công bố' },
  { key: 'OVERDUE_NOT_SUBMITTED', label: 'Quá hạn chưa nộp' },
];

interface GradingTrackerTableProps {
  filter: GradingTrackerFilter;
  students: GradingTrackerStudentRowDto[];
  totalPoints: number;
  loading: boolean;
  busyAction: string | null;
  onFilterChange: (next: GradingTrackerFilter) => void;
  onOpenSubmission: (submissionId: string) => void;
  onQuickConfirm: (submissionId: string) => void;
  onRecordOverdueZeroStudent: (student: GradingTrackerStudentRowDto) => void;
}

export function GradingTrackerTable({
  filter,
  students,
  totalPoints,
  loading,
  busyAction,
  onFilterChange,
  onOpenSubmission,
  onQuickConfirm,
  onRecordOverdueZeroStudent,
}: GradingTrackerTableProps) {
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Lọc trạng thái chấm bài" className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => onFilterChange(key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === key
                ? 'border-[var(--red)] bg-[var(--red)] text-white'
                : 'border-[var(--line-2)] bg-white text-[var(--ink-2)] hover:bg-[var(--hover)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="region"
        tabIndex={0}
        aria-label="Danh sách bài nộp cần chấm"
        className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white shadow-xs"
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3">Học viên</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thời gian nộp</th>
              <th className="px-4 py-3">Điểm tự động</th>
              <th className="px-4 py-3">Tổng điểm</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  Đang tải danh sách bài làm...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  Không có học viên nào thuộc bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              students.map((row) => {
                const badge = getTrackerRowBadge(row);
                const updatedBadge = formatUpdatedGradeBadge(row.gradeUpdatedAt);
                return (
                  <tr key={row.studentId} data-student-email={row.email}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--ink)]">{row.fullName}</div>
                      <div className="text-xs text-[var(--ink-3)]">{row.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusTag tone={badge.tone}>{badge.label}</StatusTag>
                        {row.isLateSubmission ? (
                          <StatusTag tone="red" dot={false}>
                            Nộp muộn
                          </StatusTag>
                        ) : null}
                        {row.hasAiDraft ? (
                          <StatusTag tone="outline" dot={false}>
                            Có nháp AI
                          </StatusTag>
                        ) : null}
                        {updatedBadge ? (
                          <StatusTag tone="blue" dot={false}>
                            {updatedBadge}
                          </StatusTag>
                        ) : null}
                      </div>
                    </td>
                    <td className="num px-4 py-3 text-xs text-[var(--ink-2)]">
                      {row.submittedAt ? formatDateTimeVn(row.submittedAt) : '—'}
                    </td>
                    <td className="num px-4 py-3 text-xs text-[var(--ink-2)]">
                      {row.autoScore !== null ? `${row.autoScore} đ` : '—'}
                    </td>
                    <td className="num px-4 py-3 font-semibold text-[var(--ink)]">
                      {row.totalScore !== null ? `${row.totalScore} / ${totalPoints}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        {row.submissionId && row.status !== 'IN_PROGRESS' ? (
                          <button
                            type="button"
                            onClick={() => onOpenSubmission(row.submissionId!)}
                            className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--hover)]"
                          >
                            {row.canGrade ? 'Chấm bài' : 'Xem / Sửa điểm'}
                          </button>
                        ) : null}

                        {row.canConfirm && row.submissionId ? (
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() => onQuickConfirm(row.submissionId!)}
                            className="rounded-md bg-[var(--blue)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Xác nhận điểm
                          </button>
                        ) : null}

                        {row.canRecordOverdueZero ? (
                          <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() => onRecordOverdueZeroStudent(row)}
                            className="rounded-md border border-[var(--red)]/40 bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--red-soft)]/80 disabled:opacity-50"
                          >
                            Ghi 0 điểm
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { StatusTag } from '@/features/common/components/StatusTag';
import { getClassProgress } from '@/features/progress/api/progress.api';
import type { ClassProgressReportDto } from '@/features/progress/types/progress.types';
import {
  formatGradingFormulaSummary,
  formatScore10,
  PASS_STATUS_CONFIG,
  sortClassProgressRows,
  type ClassProgressSortKey,
  type SortDirection,
} from '@/features/progress/utils/progress-format';
import { extractErrorMessage } from '@/lib/api-client';

export interface ClassProgressResultsTabProps {
  classId: string;
}

const ENROLLMENT_NOTE: Record<string, string> = {
  COMPLETED: 'Hoàn thành',
  TRANSFERRED: 'Đã chuyển lớp',
  DROPPED: 'Đã rút lớp',
};

const NUMERIC_COLUMNS: ReadonlyArray<{ key: ClassProgressSortKey; label: string }> = [
  { key: 'absencesCount', label: 'Buổi nghỉ' },
  { key: 'attendanceRatePercent', label: 'Chuyên cần' },
  { key: 'homeworkSubmissionRatePercent', label: 'Nộp BTVN' },
  { key: 'miniTestAvg', label: 'TB Mini-test' },
  { key: 'midtermAvg', label: 'Giữa kỳ' },
  { key: 'finalAvg', label: 'Cuối kỳ' },
  { key: 'finalScore', label: 'Tổng kết' },
];

function SortHeader({
  label,
  columnKey,
  activeKey,
  direction,
  align = 'center',
  sticky = false,
  onSort,
}: {
  label: string;
  columnKey: ClassProgressSortKey;
  activeKey: ClassProgressSortKey;
  direction: SortDirection;
  align?: 'left' | 'center';
  sticky?: boolean;
  onSort: (key: ClassProgressSortKey) => void;
}) {
  const isActive = activeKey === columnKey;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${
        sticky
          ? 'sticky left-0 z-10 min-w-48 border-r border-[var(--line)] bg-[var(--surface-2)]'
          : ''
      } whitespace-nowrap px-3.5 py-3 ${align === 'left' ? 'text-left' : 'text-center'}`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-[var(--ink-2)] hover:text-[var(--red)]"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-[10px]">
          {isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function ClassProgressResultsTab({ classId }: ClassProgressResultsTabProps) {
  const [report, setReport] = useState<ClassProgressReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<ClassProgressSortKey>('fullName');
  const [direction, setDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getClassProgress(classId, { signal: controller.signal });
        if (!controller.signal.aborted) setReport(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải báo cáo tiến độ và kết quả lớp học.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [classId]);

  const sortedStudents = useMemo(() => {
    if (!report) return [];
    return sortClassProgressRows(report.students, sortKey, direction);
  }, [report, sortKey, direction]);

  const handleSort = (nextKey: ClassProgressSortKey) => {
    if (sortKey === nextKey) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setDirection(nextKey === 'fullName' ? 'asc' : 'desc');
  };

  if (loading) {
    return (
      <div
        role="status"
        className="rounded-xl border border-[var(--line)] bg-white p-8 text-center text-xs text-[var(--ink-2)]"
      >
        Đang tổng hợp tiến độ chuyên cần và kết quả kiểm tra...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-xs text-[var(--red-ink)]"
      >
        {error || 'Không có dữ liệu tiến độ lớp học.'}
      </div>
    );
  }

  const { gradingFormula, students } = report;
  const atRiskCount = students.filter((s) => s.isAtRisk).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-xs shadow-xs">
        <div className="space-y-0.5">
          <div className="num font-semibold text-[var(--ink)]">
            Công thức tổng kết khóa học: {formatGradingFormulaSummary(gradingFormula)}
          </div>
          <p className="text-[11px] text-[var(--ink-3)]">
            Chỉ tính các bài đã công bố điểm; BTVN theo dõi riêng chuyên cần nộp bài, không tính vào
            điểm tổng kết.
          </p>
        </div>

        <div className="num flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[var(--surface-2)] px-2.5 py-1 font-semibold text-[var(--ink-2)]">
            {students.length} học viên
          </span>
          {atRiskCount > 0 ? (
            <span
              data-testid="class-progress-risk-count"
              className="rounded-md border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-2.5 py-1 font-semibold text-[var(--amber)]"
            >
              {atRiskCount} cần chú ý
            </span>
          ) : null}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-8 text-center text-xs text-[var(--ink-2)]">
          Lớp chưa có học viên nào được ghi danh để tổng hợp tiến độ.
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Bảng tiến độ và kết quả học viên"
          className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-xs"
        >
          <table data-testid="class-progress-table" className="w-full min-w-[920px] text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px]">
              <tr>
                <SortHeader
                  label="Họ tên"
                  columnKey="fullName"
                  activeKey={sortKey}
                  direction={direction}
                  align="left"
                  sticky
                  onSort={handleSort}
                />
                {NUMERIC_COLUMNS.map((col) => (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    columnKey={col.key}
                    activeKey={sortKey}
                    direction={direction}
                    onSort={handleSort}
                  />
                ))}
                <th scope="col" className="whitespace-nowrap px-3.5 py-3 text-center uppercase tracking-wider text-[var(--ink-2)]">
                  Kết quả
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {sortedStudents.map((row) => {
                const statusMeta = PASS_STATUS_CONFIG[row.passStatus];
                const lowHomework =
                  row.homeworkGivenCount > 0 && (row.homeworkSubmissionRatePercent ?? 0) < 60;
                return (
                  <tr
                    key={row.studentId}
                    data-at-risk={row.isAtRisk ? 'true' : undefined}
                    className={
                      row.isAtRisk ? 'bg-[var(--amber-soft)]/45 hover:bg-[var(--amber-soft)]/70' : 'hover:bg-[var(--hover)]/60'
                    }
                  >
                    <td
                      className={`sticky left-0 z-10 border-r border-[var(--line)] px-3.5 py-3 ${
                        row.isAtRisk ? 'bg-[#FDF7EB]' : 'bg-white'
                      }`}
                    >
                      <div className="font-semibold text-[var(--ink)]">{row.fullName}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--ink-2)]">{row.email}</div>
                      {row.isAtRisk || row.enrollmentStatus !== 'ACTIVE' ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {row.isAtRisk ? (
                            <span className="rounded border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--amber)]">
                              Cần chú ý
                            </span>
                          ) : null}
                          {row.isAt30PercentWarning ? (
                            <span className="rounded bg-[var(--red-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--red-ink)]">
                              Nghỉ ≥ 30%
                            </span>
                          ) : null}
                          {lowHomework ? (
                            <span className="rounded bg-[var(--amber-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--amber)]">
                              BTVN &lt; 60%
                            </span>
                          ) : null}
                          {row.enrollmentStatus !== 'ACTIVE' ? (
                            <span className="rounded bg-[var(--grey-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--grey)]">
                              {ENROLLMENT_NOTE[row.enrollmentStatus] ?? row.enrollmentStatus}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="num px-3.5 py-3 text-center font-semibold text-[var(--ink)]">
                      {row.absencesCount}
                    </td>
                    <td className="num px-3.5 py-3 text-center font-semibold text-[var(--ink)]">
                      {row.attendanceRatePercent !== null ? `${row.attendanceRatePercent}%` : '—'}
                    </td>
                    <td className="num px-3.5 py-3 text-center">
                      <div className="font-semibold text-[var(--ink)]">
                        {row.homeworkSubmittedCount}/{row.homeworkGivenCount} ·{' '}
                        {row.homeworkSubmissionRatePercent !== null
                          ? `${row.homeworkSubmissionRatePercent}%`
                          : '—'}
                      </div>
                      {row.homeworkAverageScore10 !== null ? (
                        <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">
                          TB tham khảo: {formatScore10(row.homeworkAverageScore10)}
                        </div>
                      ) : null}
                    </td>
                    <td className="num px-3.5 py-3 text-center text-[var(--ink)]">
                      {formatScore10(row.miniTestAvg)}
                    </td>
                    <td className="num px-3.5 py-3 text-center text-[var(--ink)]">
                      {formatScore10(row.midtermAvg)}
                    </td>
                    <td className="num px-3.5 py-3 text-center text-[var(--ink)]">
                      {formatScore10(row.finalAvg)}
                    </td>
                    <td className="num px-3.5 py-3 text-center font-bold text-[var(--ink)]">
                      {formatScore10(row.finalScore)}
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <StatusTag tone={statusMeta.tone}>{statusMeta.label}</StatusTag>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

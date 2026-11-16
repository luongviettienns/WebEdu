'use client';

import Link from 'next/link';
import React from 'react';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import { ENROLLMENT_DISPLAY_META } from '@/features/classes/utils/enrollment-status';
import { CLASS_STATUS_LABELS } from '@/features/classes/utils/schedule.util';
import { StatusTag } from '@/features/common/components/StatusTag';
import type {
  PublishedResultItemDto,
  StudentClassHistoryItemDto,
} from '@/features/progress/types/progress.types';
import { formatScore10 } from '@/features/progress/utils/progress-format';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export function StudentPublishedResultsTable({
  results,
  canReviewDetails = true,
}: {
  results: PublishedResultItemDto[];
  canReviewDetails?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--ink)]">Điểm đã công bố</h2>
            <span className="num rounded bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">
              {results.length} bài
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--ink-3)]">
            Chỉ hiển thị các bài kiểm tra và BTVN đã được giáo viên chính thức công bố điểm.
          </p>
        </div>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Bảng điểm đã công bố"
        className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]"
      >
        <table data-testid="published-results-table" className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] uppercase tracking-wider text-[var(--ink-2)]">
            <tr>
              <th scope="col" className="px-3.5 py-3 font-semibold">
                Bài kiểm tra / BTVN
              </th>
              <th scope="col" className="px-3.5 py-3 font-semibold">
                Loại
              </th>
              <th scope="col" className="px-3.5 py-3 text-right font-semibold">
                Điểm gốc
              </th>
              <th scope="col" className="px-3.5 py-3 text-right font-semibold">
                Quy đổi /10
              </th>
              <th scope="col" className="px-3.5 py-3 text-center font-semibold">
                Ngày trả bài
              </th>
              <th scope="col" className="px-3.5 py-3 font-semibold">
                Nhận xét giáo viên
              </th>
              <th scope="col" className="px-3.5 py-3 text-right font-semibold">
                Chi tiết
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {results.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-[var(--ink-2)]">
                  Chưa có bài kiểm tra hoặc BTVN nào được công bố điểm cho lớp này.
                </td>
              </tr>
            ) : (
              results.map((r) => (
                <tr
                  key={r.submissionId}
                  data-assignment-id={r.assignmentId}
                  className="hover:bg-[var(--hover)]/60"
                >
                  <td className="px-3.5 py-3">
                    <div className="font-semibold text-[var(--ink)]">{r.title}</div>
                    {r.isOverdueZero ? (
                      <div className="mt-1">
                        <StatusTag size="sm" tone="red">
                          Chốt 0đ quá hạn
                        </StatusTag>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap">
                    <StatusTag size="sm" tone="outline" dot={false}>
                      {ASSESSMENT_TYPE_LABELS[r.type]}
                    </StatusTag>
                  </td>
                  <td className="num px-3.5 py-3 text-right font-medium text-[var(--ink-2)] whitespace-nowrap">
                    {r.rawScore}/{r.maxScore}
                  </td>
                  <td
                    className={`num px-3.5 py-3 text-right font-bold whitespace-nowrap ${
                      r.isOverdueZero ? 'text-[var(--red)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    {formatScore10(r.score10)}
                  </td>
                  <td className="num px-3.5 py-3 text-center text-[var(--ink-2)] whitespace-nowrap">
                    {r.returnedAt ? formatDateDdMmYyyy(r.returnedAt) : '—'}
                  </td>
                  <td className="max-w-xs px-3.5 py-3 text-[var(--ink-2)]">
                    {r.teacherFeedback?.trim() || '—'}
                  </td>
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    {canReviewDetails ? (
                      <Link
                        href={`/student/assignments/${r.assignmentId}?mode=review`}
                        className="inline-flex items-center rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--blue)] transition-colors hover:bg-[var(--blue-soft)]"
                      >
                        Xem bài
                      </Link>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--ink-3)]">
                        Đã rời lớp
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StudentClassHistorySection({
  classHistory,
  selectedClassId,
  onSelectClass,
}: {
  classHistory: StudentClassHistoryItemDto[];
  selectedClassId?: string | null;
  onSelectClass?: (classId: string) => void;
}) {
  if (classHistory.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <h2 className="text-base font-bold text-[var(--ink)]">Lịch sử các lớp</h2>
        <span className="num text-xs font-medium text-[var(--ink-3)]">
          {classHistory.length} lớp
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {classHistory.map((item) => {
          const isSelected = item.classId === selectedClassId;
          const displayKey =
            item.enrollmentStatus === 'ACTIVE' && item.classStatus === 'UPCOMING'
              ? 'AWAITING_START'
              : item.enrollmentStatus;
          const statusMeta = ENROLLMENT_DISPLAY_META[displayKey];
          return (
            <div
              key={item.classId}
              className={`rounded-xl border p-4 text-xs transition-colors ${
                isSelected
                  ? 'border-[var(--red)]/40 bg-[var(--red-soft)]/25'
                  : 'border-[var(--line)] bg-[var(--surface-2)]/40'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 font-semibold text-[var(--ink)]">
                  <span className="num font-bold">{item.classCode}</span> — {item.courseName}
                </div>
                <StatusTag size="sm" tone={statusMeta.tone}>
                  {statusMeta.label}
                </StatusTag>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--ink-2)]">
                <span>GV: {item.teacherName}</span>
                <span>·</span>
                <span>{CLASS_STATUS_LABELS[item.classStatus] ?? item.classStatus}</span>
              </div>
              <div className="num mt-1 flex flex-wrap items-center justify-between gap-2 text-[var(--ink-2)]">
                <span>
                  {formatDateDdMmYyyy(item.enrolledDate)} –{' '}
                  {item.leftDate
                    ? formatDateDdMmYyyy(item.leftDate)
                    : item.expectedEndDate
                      ? `Dự kiến ${formatDateDdMmYyyy(item.expectedEndDate)}`
                      : '—'}
                </span>
                <span className="font-semibold text-[var(--ink)]">
                  {item.completedSessionsCount}/{item.totalSessions} buổi ({item.progressPercent}%)
                </span>
              </div>
              {onSelectClass && classHistory.length > 1 ? (
                <div className="mt-2.5 border-t border-[var(--line)] pt-2">
                  {isSelected ? (
                    <span className="text-[11px] font-semibold text-[var(--red-ink)]">
                      Đang xem lớp này
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectClass(item.classId)}
                      className="text-[11px] font-semibold text-[var(--blue)] hover:underline"
                    >
                      Xem kết quả lớp này
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

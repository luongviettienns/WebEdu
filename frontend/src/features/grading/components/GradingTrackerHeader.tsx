'use client';

import Link from 'next/link';
import React from 'react';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import type {
  GradingTrackerAssignmentDto,
  GradingTrackerSummaryDto,
} from '@/features/grading/api/grading.api';
import { formatDateTimeVn } from '@/lib/utils/date';

interface GradingTrackerHeaderProps {
  assignment: GradingTrackerAssignmentDto;
  summary: GradingTrackerSummaryDto;
  isAdminView?: boolean;
  busyAction: string | null;
  onConfirmAll: () => void;
  onPublishAllConfirmed: () => void;
  onRecordOverdueZeroAll: () => void;
}

export function GradingTrackerHeader({
  assignment,
  summary,
  isAdminView = false,
  busyAction,
  onConfirmAll,
  onPublishAllConfirmed,
  onRecordOverdueZeroAll,
}: GradingTrackerHeaderProps) {
  const needsGradingTotal =
    summary.submittedWaitingCount + summary.autoGradedPendingReviewCount;
  const backHref = isAdminView
    ? `/admin/classes/${assignment.classId}`
    : `/teacher/classes/${assignment.classId}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="space-y-1">
          <Link
            href={backHref}
            className="inline-flex text-xs font-semibold text-[var(--blue)] hover:underline"
          >
            ← Quay lại lớp học {assignment.classCode}
          </Link>
          <div className="font-han text-xs uppercase tracking-widest text-[var(--red)]">
            批改与发布 · CHẤM BÀI &amp; CÔNG BỐ ĐIỂM
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            {assignment.assessmentTitle}
          </h1>
          <div className="num flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-2)]">
            <span>Lớp: {assignment.className}</span>
            <span>Loại: {ASSESSMENT_TYPE_LABELS[assignment.assessmentType]}</span>
            <span>Hạn nộp: {formatDateTimeVn(assignment.dueAt)}</span>
            <span>
              {assignment.questionCount} câu · Tối đa {assignment.totalPoints} điểm
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryStatCard label="Tổng học viên" value={summary.totalStudents} tone="neutral" />
        <SummaryStatCard label="Cần chấm / Duyệt" value={needsGradingTotal} tone="amber" />
        <SummaryStatCard
          label="Đã xác nhận (Chưa công bố)"
          value={summary.gradedConfirmedCount}
          tone="blue"
        />
        <SummaryStatCard label="Đã công bố điểm" value={summary.returnedPublishedCount} tone="jade" />
        <SummaryStatCard
          label="Quá hạn chưa nộp"
          value={summary.overdueNotSubmittedCount}
          tone="red"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-[var(--ink)]">
            Quy trình Công bố điểm 2 bước (Zero-Leak)
          </p>
          <p className="text-xs text-[var(--ink-2)]">
            Bước 1 xác nhận điểm (GRADED — Học viên chưa thấy). Bước 2 công bố điểm (RETURNED).
            Học viên quá hạn chưa nộp được giữ nguyên, không tự gán 0 điểm (DEC-038).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-confirm-all-grades"
            type="button"
            disabled={Boolean(busyAction) || needsGradingTotal === 0}
            onClick={onConfirmAll}
            className="rounded-lg border border-[var(--blue)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)] disabled:opacity-50"
          >
            {busyAction === 'confirm-all'
              ? 'Đang xác nhận...'
              : 'Bước 1: Xác nhận bài đã chấm đủ'}
          </button>

          <button
            id="btn-publish-confirmed-grades"
            type="button"
            disabled={Boolean(busyAction) || summary.readyToPublishCount === 0}
            onClick={onPublishAllConfirmed}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
          >
            {busyAction === 'publish-all'
              ? 'Đang công bố...'
              : `Bước 2: Công bố điểm (${summary.readyToPublishCount} bài đã xác nhận)`}
          </button>

          {summary.overdueNotSubmittedCount > 0 ? (
            <button
              id="btn-record-overdue-zero"
              type="button"
              disabled={Boolean(busyAction)}
              onClick={onRecordOverdueZeroAll}
              className="rounded-lg border border-[var(--red)]/40 bg-[var(--red-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--red-soft)]/80 disabled:opacity-50"
            >
              {busyAction === 'overdue-all'
                ? 'Đang ghi nhận...'
                : `Ghi 0 điểm quá hạn (${summary.overdueNotSubmittedCount})`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'amber' | 'blue' | 'jade' | 'red';
}) {
  const toneClass = {
    neutral: 'border-[var(--line)] bg-white text-[var(--ink)]',
    amber: 'border-[var(--amber)]/30 bg-[var(--amber-soft)] text-[var(--amber)]',
    blue: 'border-[var(--blue)]/30 bg-[var(--blue-soft)] text-[var(--blue)]',
    jade: 'border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]',
    red: 'border-[var(--red)]/30 bg-[var(--red-soft)] text-[var(--red-ink)]',
  }[tone];

  return (
    <div className={`rounded-xl border px-3.5 py-3 ${toneClass}`}>
      <div className="text-[11px] font-semibold">{label}</div>
      <div className="num mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

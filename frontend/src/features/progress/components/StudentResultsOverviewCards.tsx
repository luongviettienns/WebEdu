'use client';

import React from 'react';
import { ENROLLMENT_DISPLAY_META } from '@/features/classes/utils/enrollment-status';
import { CLASS_STATUS_LABELS } from '@/features/classes/utils/schedule.util';
import { StatusTag } from '@/features/common/components/StatusTag';
import type {
  GradingFormulaDto,
  StudentAcademicSummaryDto,
  StudentAttendanceMetricsDto,
  StudentProgressSelectedClassDto,
} from '@/features/progress/types/progress.types';
import {
  formatGradingFormulaSummary,
  formatRemainingSessionsSummary,
  formatScore10,
  PASS_STATUS_CONFIG,
} from '@/features/progress/utils/progress-format';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export function StudentClassProgressCard({
  selectedClass,
  gradingFormula,
}: {
  selectedClass: StudentProgressSelectedClassDto;
  gradingFormula: GradingFormulaDto | null;
}) {
  const enrollKey =
    selectedClass.enrollmentStatus === 'ACTIVE' && selectedClass.status === 'UPCOMING'
      ? 'AWAITING_START'
      : selectedClass.enrollmentStatus;
  const enrollMeta = ENROLLMENT_DISPLAY_META[enrollKey];
  const nextSession = selectedClass.nextSession;

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-num text-xl font-bold text-[var(--ink)]">
              {selectedClass.classCode}
            </span>
            <span className="text-sm font-semibold text-[var(--ink-2)]">
              {selectedClass.courseName}
            </span>
          </div>
          <p className="text-xs text-[var(--ink-2)]">
            Giáo viên: {selectedClass.teacherName} · Trạng thái lớp:{' '}
            {CLASS_STATUS_LABELS[selectedClass.status] ?? selectedClass.status} · Vào lớp:{' '}
            <span className="num">{formatDateDdMmYyyy(selectedClass.enrolledDate)}</span>
          </p>
        </div>
        <StatusTag tone={enrollMeta.tone}>{enrollMeta.label}</StatusTag>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
        <div className="space-y-2 lg:col-span-7">
          <div className="num flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-2)]">
            <span>
              Tiến độ:{' '}
              <strong className="text-[var(--ink)]">
                {selectedClass.completedSessionsCount}/{selectedClass.totalSessions} buổi ·{' '}
                {selectedClass.progressPercent}%
              </strong>
            </span>
            <span>
              {formatRemainingSessionsSummary(
                selectedClass.remainingSessionsCount,
                selectedClass.expectedEndDate,
              )}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
            role="progressbar"
            aria-label={`Tiến độ buổi học lớp ${selectedClass.classCode}`}
            aria-valuenow={selectedClass.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[var(--jade)] transition-all duration-300"
              style={{ width: `${selectedClass.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-4 py-2.5 text-xs lg:col-span-5">
          <div className="font-semibold text-[var(--ink-2)]">Buổi tiếp theo</div>
          {nextSession ? (
            <div className="num mt-0.5 font-medium text-[var(--ink)]">
              {nextSession.sessionNumber ? `Buổi ${nextSession.sessionNumber}` : 'Buổi bổ sung'} ·{' '}
              {nextSession.weekdayLabel}, {formatDateDdMmYyyy(nextSession.sessionDate)} ·{' '}
              {nextSession.startTime}–{nextSession.endTime}
              {nextSession.isMakeup ? ' (Học bù)' : ''}
            </div>
          ) : (
            <div className="mt-0.5 text-[var(--ink-3)]">
              {selectedClass.totalSessions > 0 && selectedClass.remainingSessionsCount === 0
                ? 'Đã hoàn thành toàn bộ buổi học'
                : 'Chưa có buổi học sắp tới'}
            </div>
          )}
        </div>
      </div>

      {gradingFormula ? (
        <div className="num rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 px-4 py-2.5 text-xs text-[var(--ink-2)]">
          <span className="font-semibold text-[var(--ink)]">
            Công thức điểm tổng kết đang áp dụng:
          </span>{' '}
          {formatGradingFormulaSummary(gradingFormula)}
        </div>
      ) : null}
    </section>
  );
}

export function StudentAcademicSummaryCards({
  academicSummary,
  gradingFormula,
}: {
  academicSummary: StudentAcademicSummaryDto | null;
  gradingFormula: GradingFormulaDto | null;
}) {
  const passMeta = PASS_STATUS_CONFIG[academicSummary?.passStatus ?? 'INSUFFICIENT_DATA'];
  const componentCards = [
    {
      label: 'Điểm TB Mini-test',
      value: formatScore10(academicSummary?.miniTestAvg),
      sub: `${academicSummary?.miniTestCount ?? 0} bài · trọng số ${gradingFormula?.miniTestWeight ?? 0}%`,
    },
    {
      label: 'Giữa kỳ',
      value: formatScore10(academicSummary?.midtermAvg),
      sub: `${academicSummary?.midtermCount ?? 0} bài · trọng số ${gradingFormula?.midtermWeight ?? 0}%`,
    },
    {
      label: 'Cuối kỳ',
      value: formatScore10(academicSummary?.finalAvg),
      sub: `${academicSummary?.finalCount ?? 0} bài · trọng số ${gradingFormula?.finalWeight ?? 0}%`,
    },
  ];

  return (
    <section
      aria-label="Tổng hợp điểm thành phần"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {componentCards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            {card.label}
          </div>
          <div className="font-num mt-2 text-2xl font-bold text-[var(--ink)]">{card.value}</div>
          <div className="num mt-1 text-xs text-[var(--ink-3)]">{card.sub}</div>
        </div>
      ))}

      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Điểm tổng kết
          </span>
          <StatusTag size="sm" tone={passMeta.tone}>
            {passMeta.label}
          </StatusTag>
        </div>
        <div
          className={`font-num mt-2 text-2xl font-bold ${
            academicSummary?.passStatus === 'PASSED'
              ? 'text-[var(--jade)]'
              : academicSummary?.passStatus === 'FAILED'
                ? 'text-[var(--red)]'
                : 'text-[var(--ink)]'
          }`}
        >
          {formatScore10(academicSummary?.finalScore)}
        </div>
        <div className="mt-1 text-xs text-[var(--ink-3)]">Chỉ tính các bài đã công bố điểm</div>
      </div>
    </section>
  );
}

export function StudentAttendanceHomeworkCard({
  attendance,
  academicSummary,
}: {
  attendance: StudentAttendanceMetricsDto | null;
  academicSummary: StudentAcademicSummaryDto | null;
}) {
  const hw = academicSummary?.homeworkStats ?? null;

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <h2 className="text-base font-bold text-[var(--ink)]">Chuyên cần &amp; BTVN</h2>
        {attendance?.isAt30PercentWarning ? (
          <StatusTag tone="red">Cảnh báo vắng ≥ 30%</StatusTag>
        ) : (
          <StatusTag tone="outline" dot={false}>
            Tách biệt điểm tổng kết
          </StatusTag>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-4 text-xs">
          <div>
            <div className="text-[var(--ink-2)]">Tỷ lệ chuyên cần</div>
            <div className="font-num mt-1 text-xl font-bold text-[var(--jade)]">
              {attendance && attendance.attendanceRatePercent !== null
                ? `${attendance.attendanceRatePercent}%`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-[var(--ink-2)]">Có mặt</div>
            <div className="font-num mt-1 text-base font-bold text-[var(--ink)]">
              {attendance ? `${attendance.presentCount} buổi` : '—'}
            </div>
            {attendance ? (
              <div className="num text-[11px] text-[var(--ink-3)]">
                /{attendance.markedSessionsCount} đã điểm danh
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-[var(--ink-2)]">Buổi nghỉ</div>
            <div
              className={`font-num mt-1 text-base font-bold ${
                attendance?.isAt30PercentWarning ? 'text-[var(--red)]' : 'text-[var(--ink)]'
              }`}
            >
              {attendance ? `${attendance.totalAbsenceCount} buổi` : '—'}
            </div>
            {attendance ? (
              <div className="num text-[11px] text-[var(--ink-3)]">
                Vắng {attendance.absentCount} · Phép {attendance.excusedCount}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-4 text-xs">
          <div>
            <div className="text-[var(--ink-2)]">Tỷ lệ nộp BTVN</div>
            <div className="font-num mt-1 text-xl font-bold text-[var(--ink)]">
              {hw && hw.submissionRatePercent !== null ? `${hw.submissionRatePercent}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[var(--ink-2)]">Đã nộp</div>
            <div className="font-num mt-1 text-base font-bold text-[var(--ink)]">
              {hw ? `${hw.submittedCount}/${hw.givenCount} bài` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[var(--ink-2)]">Điểm TB BTVN</div>
            <div className="font-num mt-1 text-base font-bold text-[var(--ink)]">
              {formatScore10(hw?.averageScore10)}
            </div>
            <div className="text-[11px] text-[var(--ink-3)]">(tham khảo)</div>
          </div>
        </div>
      </div>

      <p className="text-xs italic text-[var(--ink-3)]">
        BTVN tính chuyên cần &amp; tham khảo, không cộng vào điểm tổng kết.
      </p>
    </section>
  );
}

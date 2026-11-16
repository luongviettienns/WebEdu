'use client';

import Link from 'next/link';
import React from 'react';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import type { StudentMyAttendance } from '@/features/attendance/api/attendance.api';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import type { StudentProgressResponseDto } from '@/features/progress/types/progress.types';
import {
  canReviewClassResults,
  formatScore10,
} from '@/features/progress/utils/progress-format';
import type { StudentItemDto } from '../api/students.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

interface StudentMetricsSidebarProps {
  profile: UserProfileDto;
  studentDetail: StudentItemDto | null;
  myAttendance?: StudentMyAttendance | null;
  myProgress?: StudentProgressResponseDto | null;
}

export function StudentMetricsSidebar({
  profile,
  studentDetail,
  myAttendance = null,
  myProgress = null,
}: StudentMetricsSidebarProps) {
  const metrics = myAttendance?.metrics ?? null;
  const hw = myProgress?.academicSummary?.homeworkStats ?? null;
  const publishedResults = myProgress?.publishedResults ?? [];
  const canReviewDetails = myProgress?.selectedClass
    ? canReviewClassResults(myProgress.selectedClass.enrollmentStatus)
    : true;
  const isWarning = Boolean(metrics?.isAt30PercentWarning);
  const attendanceRateDisplay = metrics
    ? metrics.attendanceRatePercent !== null
      ? `${metrics.attendanceRatePercent}%`
      : '—'
    : '—';

  return (
    <div className="space-y-6 lg:col-span-5">
      {/* Chuyên cần */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
        <div className="border-b border-[var(--line)] pb-3">
          <h2 className="text-base font-bold text-[var(--ink)]">Chuyên cần</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div
            className={`rounded-xl border p-3.5 ${
              isWarning
                ? 'border-[var(--red)]/30 bg-[var(--red-soft)]/60'
                : 'border-[var(--line)] bg-[var(--surface-2)]/60'
            }`}
          >
            <span className="block text-xs font-medium text-[var(--ink-2)]">
              Số buổi nghỉ
            </span>
            <span
              className={`mt-1 block font-num text-2xl font-bold ${
                isWarning ? 'text-[var(--red)]' : 'text-[var(--ink)]'
              }`}
            >
              {metrics ? metrics.totalAbsenceCount : 0}
            </span>
            {isWarning ? (
              <span className="mt-1 inline-block rounded bg-[var(--red-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--red-ink)]">
                Cảnh báo vắng &gt;= 30%
              </span>
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
            <span className="block text-xs font-medium text-[var(--ink-2)]">
              Tỷ lệ chuyên cần
            </span>
            <span
              className={`mt-1 block font-num text-2xl font-bold ${
                metrics ? 'text-[var(--jade)]' : 'text-[var(--ink)]'
              }`}
            >
              {attendanceRateDisplay}
            </span>
            {metrics ? (
              <span className="mt-1 block font-num text-[11px] text-[var(--ink-2)]">
                {metrics.presentCount}/{metrics.markedSessionsCount} buổi đã điểm
                danh
              </span>
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
            <span className="block text-xs font-medium text-[var(--ink-2)]">
              Có mặt
            </span>
            <span className="mt-1 block font-num text-xs font-semibold text-[var(--ink)]">
              {metrics ? `${metrics.presentCount} buổi` : '—'}
            </span>
            {metrics ? (
              <span className="mt-0.5 block font-num text-[11px] text-[var(--ink-2)]">
                Vắng {metrics.absentCount} · Phép {metrics.excusedCount}
              </span>
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
            <span className="block text-xs font-medium text-[var(--ink-2)]">
              Tỷ lệ nộp BTVN
            </span>
            <span className="mt-1 block font-num text-2xl font-bold text-[var(--ink)]">
              {hw && hw.submissionRatePercent !== null ? `${hw.submissionRatePercent}%` : '—'}
            </span>
            <span
              className={`mt-0.5 block font-num text-[11px] ${
                hw ? 'text-[var(--ink-2)]' : 'text-[var(--ink-3)]'
              }`}
            >
              {hw
                ? `${hw.submittedCount}/${hw.givenCount} bài${
                    hw.averageScore10 !== null ? ` · TB ${formatScore10(hw.averageScore10)}` : ''
                  }`
                : 'Chưa có dữ liệu'}
            </span>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-[var(--ink-3)] italic">
          Điểm BTVN chỉ tính chuyên cần, không tính vào điểm tổng kết.
        </p>
      </div>

      {/* Kết quả gần đây */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <h2 className="text-base font-bold text-[var(--ink)]">
            Kết quả gần đây
          </h2>
          <Link
            href="/student/results"
            className="text-xs font-semibold text-[var(--blue)] hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        {publishedResults.length > 0 ? (
          <ul className="divide-y divide-[var(--line)]">
            {publishedResults.slice(0, 4).map((r) => {
              const itemContent = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--ink)]">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-2)]">
                      {ASSESSMENT_TYPE_LABELS[r.type]}
                      {r.returnedAt ? ` · ${formatDateDdMmYyyy(r.returnedAt)}` : ''}
                      {r.isOverdueZero ? ' · Quá hạn 0đ' : ''}
                      {!canReviewDetails ? (
                        <span className="text-[var(--ink-3)]"> · Đã rời lớp</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-num">
                    <span
                      className={`block text-sm font-bold ${
                        r.isOverdueZero ? 'text-[var(--red)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {formatScore10(r.score10)}
                    </span>
                    <span className="block text-[11px] text-[var(--ink-3)]">
                      {r.rawScore}/{r.maxScore}
                    </span>
                  </div>
                </>
              );

              return (
                <li key={r.submissionId}>
                  {canReviewDetails ? (
                    <Link
                      href={`/student/assignments/${r.assignmentId}?mode=review`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--hover)]/60"
                    >
                      {itemContent}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 py-3 text-[var(--ink-2)]">
                      {itemContent}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-7 text-center text-xs text-[var(--ink-2)]">
            <p>Chưa có kết quả bài kiểm tra đã công bố.</p>
            <Link
              href="/student/results"
              className="mt-2 inline-block font-semibold text-[var(--blue)] hover:underline"
            >
              Xem trang kết quả học tập
            </Link>
          </div>
        )}
      </div>

      {/* Thông tin học viên */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
        <h3 className="text-base font-semibold text-[var(--ink)] border-b border-[var(--line)] pb-3">
          Thông tin học viên
        </h3>
        <dl className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between border-b border-[var(--line)] pb-2">
            <dt className="text-[var(--ink-2)]">Họ và tên</dt>
            <dd className="font-semibold text-[var(--ink)]">
              {profile.fullName}
            </dd>
          </div>
          <div className="flex justify-between border-b border-[var(--line)] pb-2">
            <dt className="text-[var(--ink-2)]">Ngày sinh</dt>
            <dd className="font-medium text-[var(--ink)] font-num">
              {formatDateDdMmYyyy(
                studentDetail?.dateOfBirth ?? profile.dateOfBirth,
              )}
            </dd>
          </div>
          <div className="flex justify-between border-b border-[var(--line)] pb-2">
            <dt className="text-[var(--ink-2)]">Số điện thoại</dt>
            <dd className="font-medium text-[var(--ink)] font-num">
              {profile.phone}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--ink-2)]">Email</dt>
            <dd className="font-medium text-[var(--ink)] truncate max-w-[180px]">
              {profile.email}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

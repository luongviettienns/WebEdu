'use client';

import Link from 'next/link';
import React from 'react';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import {
  getAssignmentStatusTone,
  isSubmittedAssignmentStatus,
  type StudentAssignmentListItemDto,
} from '@/features/assignments/api/assignments.api';
import type { StudentMyAttendance } from '@/features/attendance/api/attendance.api';
import { StatusTag } from '@/features/common/components/StatusTag';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import type { StudentProgressResponseDto } from '@/features/progress/types/progress.types';
import { formatRemainingSessionsSummary } from '@/features/progress/utils/progress-format';
import {
  PastClassesHistoryList,
  type PastClassesHistoryListProps,
} from '@/features/students/components/PastClassesHistoryList';
import { StudentMetricsSidebar } from '@/features/students/components/StudentMetricsSidebar';
import {
  AdminAccessNotice,
  PendingClassNotice,
} from '@/features/students/components/StudentOverviewNotices';
import type { StudentItemDto } from '../api/students.api';
import { formatDateDdMmYyyy, formatDateTimeVn } from '@/lib/utils/date';

export {
  AdminAccessNotice,
  PastClassesHistoryList,
  PendingClassNotice,
  type PastClassesHistoryListProps,
};

interface StudentOverviewCardsProps {
  profile: UserProfileDto;
  studentDetail: StudentItemDto | null;
  assignedClass: string | null;
  enrolledAt: string | null;
  myAttendance?: StudentMyAttendance | null;
  myAssignments?: StudentAssignmentListItemDto[];
  myProgress?: StudentProgressResponseDto | null;
}

export function ActiveStudentClassSection({
  profile,
  studentDetail,
  assignedClass,
  enrolledAt,
  myAttendance = null,
  myAssignments = [],
  myProgress = null,
}: StudentOverviewCardsProps) {
  const pendingAssignments = myAssignments.filter((item) => !isSubmittedAssignmentStatus(item.status));
  const pastClasses = studentDetail?.pastClasses ?? [];
  const classHistory = studentDetail?.classHistory ?? [];

  const currentClassRecord =
    pastClasses.find(
      (c) => c.classCode === assignedClass || c.enrollmentStatus === 'ACTIVE',
    ) ?? null;
  const progressSelected = myProgress?.selectedClass ?? null;
  const courseName =
    currentClassRecord?.courseName ??
    progressSelected?.courseName ??
    myAttendance?.activeClass?.courseName ??
    'Khóa học HSK Tiêu chuẩn';
  const teacherName =
    currentClassRecord?.teacherName ??
    progressSelected?.teacherName ??
    myAttendance?.activeClass?.teacherName ??
    'Giáo viên phụ trách';

  const sessions = myAttendance?.sessions ?? [];
  const attendanceCompleted = sessions.filter((s) => s.status === 'COMPLETED').length;
  const completedSessionsCount = progressSelected?.completedSessionsCount ?? attendanceCompleted;
  const totalSessions = progressSelected?.totalSessions ?? myAttendance?.activeClass?.totalSessions ?? 0;
  const progressPercent =
    progressSelected?.progressPercent ??
    (totalSessions > 0 ? Math.min(100, Math.round((completedSessionsCount / totalSessions) * 100)) : 0);
  const remainingSessions =
    progressSelected?.remainingSessionsCount ?? Math.max(0, totalSessions - completedSessionsCount);
  const expectedEndDate = progressSelected?.expectedEndDate ?? null;
  const attNext = sessions.find((s) => s.displayStatus === 'TODAY' || s.displayStatus === 'SCHEDULED') ?? null;
  const progNext = progressSelected?.nextSession ?? null;
  const nextSession = attNext ?? (progNext ? { ...progNext, displayStatus: 'SCHEDULED' as const } : null);
  const nextSessionLabel = nextSession
    ? nextSession.sessionNumber !== null
      ? `Buổi ${nextSession.sessionNumber}`
      : nextSession.isMakeup ? 'Buổi học bù' : 'Buổi học'
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        {/* Card 1: Lớp đang học */}
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
            <h2 className="text-base font-bold text-[var(--ink)]">
              Lớp đang học
            </h2>
            <StatusTag tone="jade">Đang học</StatusTag>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div
                className="relative flex h-24 w-24 flex-none items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(var(--jade) ${progressPercent}%, var(--surface-2) 0)`,
                }}
              >
                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center shadow-2xs">
                  <span className="font-num text-lg font-bold text-[var(--ink)] leading-none">
                    {progressPercent}%
                  </span>
                  <span className="text-[10px] text-[var(--ink-3)] font-medium mt-0.5">
                    hoàn thành
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-num text-xl font-bold text-[var(--ink)]">
                    {assignedClass}
                  </span>
                  <span className="text-sm font-medium text-[var(--ink-2)] truncate">
                    {courseName}
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-2)]">
                  {teacherName} · Lịch học định kỳ
                </p>
                <div className="space-y-1 pt-1">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--ink-2)] font-num">
                    <span>
                      <strong>
                        {completedSessionsCount}/{totalSessions}
                      </strong>{' '}
                      buổi hoàn thành
                    </span>
                    <span>
                      Vào lớp:{' '}
                      <strong>
                        {formatDateDdMmYyyy(
                          enrolledAt ??
                            progressSelected?.enrolledDate ??
                            myAttendance?.activeClass?.enrolledDate,
                        )}
                      </strong>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full bg-[var(--jade)] rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {totalSessions > 0 || progressSelected ? (
                    <p className="num text-[11px] text-[var(--ink-3)]">
                      {formatRemainingSessionsSummary(remainingSessions, expectedEndDate)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-2)]/60 px-6 py-3.5 text-xs text-[var(--ink)]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-white border border-[var(--line-2)] text-xs text-[var(--ink-2)] shadow-2xs">
                🕒
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-semibold">Buổi học tiếp theo</p>
                  {nextSession?.displayStatus === 'TODAY' ? (
                    <span className="rounded bg-[var(--amber-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--amber)]">
                      Hôm nay
                    </span>
                  ) : null}
                </div>
                {nextSession ? (
                  <p className="num text-[11px] text-[var(--ink-2)]">
                    {nextSessionLabel} · {nextSession.weekdayLabel},{' '}
                    {formatDateDdMmYyyy(nextSession.sessionDate)} ·{' '}
                    {nextSession.startTime}–{nextSession.endTime}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--ink-2)]">
                    Chưa có buổi học sắp tới
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/student/schedule"
              className="shrink-0 rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors shadow-2xs"
            >
              Xem lịch học
            </Link>
          </div>
        </div>

        {/* Card 2: Bài cần làm */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--ink)]">
                Bài cần làm
              </h2>
              <span className="num rounded bg-[var(--amber-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--amber)]">
                {pendingAssignments.length} bài
              </span>
            </div>
            <Link
              href="/student/assignments"
              className="text-xs font-semibold text-[var(--blue)] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>
          {pendingAssignments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--ink-2)] font-medium">
                Không còn bài nào cần làm.
              </p>
              <p className="mt-1 text-xs text-[var(--ink-3)]">
                Bài tập về nhà (BTVN) và đề kiểm tra HSK mới được giao sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {pendingAssignments.slice(0, 3).map((item) => (
                <li
                  key={item.assignmentId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusTag tone={getAssignmentStatusTone(item.status)} size="sm">
                        {item.displayStatusLabel}
                      </StatusTag>
                      <span className="text-xs font-semibold text-[var(--ink-2)]">
                        {ASSESSMENT_TYPE_LABELS[item.assessmentType]} · {item.classCode}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {item.assessmentTitle}
                    </p>
                    <p className="num text-xs text-[var(--ink-3)]">
                      Hạn nộp: {formatDateTimeVn(item.dueAt)}
                    </p>
                  </div>
                  {item.isOverdue ? (
                    <span className="rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-3)]">
                      Đã quá hạn
                    </span>
                  ) : (
                    <Link
                      href={`/student/assignments/${item.assignmentId}`}
                      className="shrink-0 rounded-lg bg-[var(--red)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
                    >
                      {item.status === 'IN_PROGRESS' ? 'Tiếp tục làm bài' : 'Làm bài'}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 5: Lịch sử các lớp đã học */}
        {pastClasses.length > 0 || classHistory.length > 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
            <h3 className="text-base font-semibold text-[var(--ink)]">
              Lịch sử các lớp đã học
            </h3>
            <PastClassesHistoryList
              pastClasses={pastClasses}
              classHistory={classHistory}
            />
          </div>
        ) : null}
      </div>

      <StudentMetricsSidebar
        profile={profile}
        studentDetail={studentDetail}
        myAttendance={myAttendance}
        myProgress={myProgress}
      />
    </div>
  );
}

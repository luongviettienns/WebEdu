'use client';

import Link from 'next/link';
import React from 'react';
import { StatusTag } from '@/features/common/components/StatusTag';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
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
import { formatDateDdMmYyyy } from '@/lib/utils/date';

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
}

export function ActiveStudentClassSection({
  profile,
  studentDetail,
  assignedClass,
  enrolledAt,
}: StudentOverviewCardsProps) {
  const pastClasses = studentDetail?.pastClasses ?? [];
  const classHistory = studentDetail?.classHistory ?? [];

  const currentClassRecord =
    pastClasses.find(
      (c) => c.classCode === assignedClass || c.enrollmentStatus === 'ACTIVE',
    ) ?? null;
  const courseName =
    currentClassRecord?.courseName ?? 'Khóa học HSK Tiêu chuẩn';
  const teacherName = currentClassRecord?.teacherName ?? 'Giáo viên phụ trách';

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
                  background:
                    'conic-gradient(var(--jade) 0%, var(--surface-2) 0)',
                }}
              >
                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center shadow-2xs">
                  <span className="font-num text-lg font-bold text-[var(--ink)] leading-none">
                    0%
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
                  <div className="flex justify-between text-xs text-[var(--ink-2)] font-num">
                    <span>
                      <strong>0 buổi</strong> đã học
                    </span>
                    <span>
                      Vào lớp:{' '}
                      <strong>{formatDateDdMmYyyy(enrolledAt)}</strong>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full bg-[var(--jade)] rounded-full transition-all duration-300"
                      style={{ width: '0%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-2)]/60 px-6 py-3.5 text-xs text-[var(--ink)]">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[var(--line-2)] text-xs text-[var(--ink-2)] shadow-2xs">
                🕒
              </span>
              <div>
                <p className="font-semibold">Buổi học tiếp theo</p>
                <p className="text-[11px] text-[var(--ink-2)]">
                  Lịch học và điểm danh sẽ được kích hoạt khi lớp vào học chính
                  thức
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors shadow-2xs"
            >
              Hồ sơ lớp
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
              <span className="rounded bg-[var(--amber-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--amber)]">
                0 bài
              </span>
            </div>
            <span className="text-xs font-medium text-[var(--ink-3)]">
              Tất cả bài
            </span>
          </div>
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--ink-2)] font-medium">
              Không còn bài nào cần làm.
            </p>
            <p className="mt-1 text-xs text-[var(--ink-3)]">
              Bài tập về nhà (BTVN) và đề kiểm tra HSK sẽ được giao tại đây
              trong quá trình học.
            </p>
          </div>
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

      <StudentMetricsSidebar profile={profile} studentDetail={studentDetail} />
    </div>
  );
}

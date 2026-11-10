'use client';

import Link from 'next/link';
import React from 'react';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import type {
  PastClassRecordDto,
  StudentItemDto,
} from '../api/students.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

interface StudentOverviewCardsProps {
  profile: UserProfileDto;
  studentDetail: StudentItemDto | null;
  assignedClass: string | null;
  enrolledAt: string | null;
}

const PAST_CLASS_STATUS_META: Record<
  PastClassRecordDto['enrollmentStatus'],
  { label: string; badgeCls: string }
> = {
  COMPLETED: {
    label: 'Đã hoàn thành',
    badgeCls:
      'bg-[var(--jade-soft)] text-[var(--jade)] border border-[var(--jade)]/20',
  },
  TRANSFERRED: {
    label: 'Đã chuyển lớp',
    badgeCls:
      'bg-[var(--surface-2)] text-[var(--ink-2)] border border-[var(--line-2)]',
  },
  DROPPED: {
    label: 'Tạm nghỉ / Rút lớp',
    badgeCls:
      'bg-[var(--amber-soft)] text-[var(--amber)] border border-[var(--amber)]/20',
  },
  ACTIVE: {
    label: 'Đang học',
    badgeCls:
      'bg-[var(--jade-soft)] text-[var(--jade)] border border-[var(--jade)]/20',
  },
};

export interface PastClassesHistoryListProps {
  pastClasses?: PastClassRecordDto[];
  classHistory?: string[];
}

export function PastClassesHistoryList({
  pastClasses,
  classHistory,
}: PastClassesHistoryListProps) {
  if (pastClasses && pastClasses.length > 0) {
    return (
      <div className="mt-2 space-y-2">
        {pastClasses.map((item) => {
          const statusMeta =
            PAST_CLASS_STATUS_META[item.enrollmentStatus] ??
            PAST_CLASS_STATUS_META.COMPLETED;
          return (
            <div
              key={item.enrollmentId}
              className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-[var(--ink)]">
                  <span className="num">{item.classCode}</span> —{' '}
                  {item.courseName}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.badgeCls}`}
                >
                  {statusMeta.label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--ink-2)]">
                {item.teacherName ? (
                  <span>GV: {item.teacherName}</span>
                ) : null}
                <span className="num">
                  Thời gian: {formatDateDdMmYyyy(item.enrolledDate)} –{' '}
                  {item.leftDate ? formatDateDdMmYyyy(item.leftDate) : '—'}
                </span>
              </div>
              {item.reason ? (
                <p className="mt-1 text-[11px] text-[var(--ink-2)]">
                  Ghi chú: {item.reason}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (classHistory && classHistory.length > 0) {
    return (
      <p className="mt-1 text-xs text-[var(--ink-2)]">
        Đã học: {classHistory.join(', ')}
      </p>
    );
  }

  return null;
}

export function AdminAccessNotice() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-xs sm:p-10">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--jade-soft)] text-[var(--jade)] font-bold text-base font-han">
        管
      </div>
      <h2 className="mt-4 text-lg font-bold text-[var(--ink)]">
        Bạn đang truy cập với quyền Quản trị viên
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--ink-2)]">
        Tài khoản quản trị hiện tại không gắn trực tiếp với một hồ sơ học viên cá
        nhân. Để tra cứu hoặc cập nhật tình trạng xếp lớp của từng học viên, vui
        lòng mở khu vực Quản lý hồ sơ học viên.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/admin/students"
          className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-colors"
        >
          Đi tới Quản lý hồ sơ học viên
        </Link>
        <Link
          href="/admin/students/pending"
          className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
        >
          Danh sách chờ xếp lớp
        </Link>
      </div>
    </div>
  );
}

export function PendingClassNotice({
  pastClasses,
}: {
  pastClasses?: PastClassRecordDto[];
} = {}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--amber)]/30 bg-white p-8 text-center shadow-xs sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--amber-soft)] text-[var(--amber)] font-bold text-xl font-han">
          待
        </div>
        <h2 className="mt-4 text-xl font-bold text-[var(--ink)]">
          Bạn chưa được xếp lớp. Vui lòng liên hệ trung tâm
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--ink-2)]">
          Tài khoản của bạn đã được ghi nhận trên hệ thống Trung Tâm TD Hán Ngữ.
          Sau khi bộ phận Giáo vụ liên kết tài khoản vào lớp học chính thức, lịch
          học, bài tập và bảng điểm cá nhân sẽ hiển thị tại đây.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/profile"
            className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
          >
            Kiểm tra hồ sơ cá nhân
          </Link>
        </div>
      </div>

      {pastClasses && pastClasses.length > 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <h3 className="text-base font-semibold text-[var(--ink)]">
            Lịch sử các lớp đã học
          </h3>
          <PastClassesHistoryList pastClasses={pastClasses} />
        </div>
      ) : null}
    </div>
  );
}

export function ActiveStudentClassSection({
  profile,
  studentDetail,
  assignedClass,
  enrolledAt,
}: StudentOverviewCardsProps) {
  const pastClasses = studentDetail?.pastClasses ?? [];
  const classHistory = studentDetail?.classHistory ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--jade)]">
                Lớp đang theo học
              </span>
              <h2 className="mt-1 text-xl font-bold text-[var(--ink)]">
                {assignedClass}
              </h2>
            </div>
            <span className="rounded-lg bg-[var(--jade-soft)] px-3 py-1 text-xs font-semibold text-[var(--jade)] border border-[var(--jade)]/20">
              Đang học
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface-2)] p-4 border border-[var(--line)]">
              <p className="text-xs font-medium text-[var(--ink-2)]">
                Ngày vào lớp
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)] font-num">
                {formatDateDdMmYyyy(enrolledAt)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] p-4 border border-[var(--line)]">
              <p className="text-xs font-medium text-[var(--ink-2)]">
                Trạng thái học tập
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--jade)]">
                Đang theo học chính thức ({profile.fullName})
              </p>
            </div>
          </div>
        </div>

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

      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
        <h3 className="text-base font-semibold text-[var(--ink)]">
          Thông tin học viên
        </h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between border-b border-[var(--line)] pb-2">
            <dt className="text-[var(--ink-2)]">Họ và tên</dt>
            <dd className="font-medium text-[var(--ink)]">{profile.fullName}</dd>
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

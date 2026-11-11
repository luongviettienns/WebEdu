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
      <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-xs sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--amber-soft)] text-xl font-bold text-[var(--amber)] font-han border border-[var(--amber)]/20 shadow-xs">
          等
        </div>
        <h2 className="mt-4 text-xl font-bold text-[var(--ink)]">
          Bạn chưa được xếp lớp
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-2)] leading-relaxed">
          Vui lòng liên hệ trung tâm. Sau khi bộ phận Giáo vụ xếp lớp, lịch học,
          bài tập và bảng điểm cá nhân sẽ hiển thị đầy đủ tại đây.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/profile"
            className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors shadow-2xs"
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

  const currentClassRecord =
    pastClasses.find(
      (c) => c.classCode === assignedClass || c.enrollmentStatus === 'ACTIVE',
    ) ?? null;
  const courseName = currentClassRecord?.courseName ?? 'Khóa học HSK Tiêu chuẩn';
  const teacherName = currentClassRecord?.teacherName ?? 'Giáo viên phụ trách';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Stack (lg:col-span-7) */}
      <div className="space-y-6 lg:col-span-7">
        {/* Card 1: Lớp đang học */}
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
            <h2 className="text-base font-bold text-[var(--ink)]">
              Lớp đang học
            </h2>
            <span className="rounded-full bg-[var(--jade-soft)] px-3 py-0.5 text-xs font-semibold text-[var(--jade)] border border-[var(--jade)]/20">
              Đang học
            </span>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              {/* Progress Ring */}
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

              {/* Class Info */}
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

          {/* Next Session Slot */}
          <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-2)]/60 px-6 py-3.5 text-xs text-[var(--ink)]">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[var(--line-2)] text-xs text-[var(--ink-2)] shadow-2xs">
                🕒
              </span>
              <div>
                <p className="font-semibold">Buổi học tiếp theo</p>
                <p className="text-[11px] text-[var(--ink-2)]">
                  Lịch học và điểm danh sẽ được kích hoạt khi lớp vào học chính thức
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
              Bài tập về nhà (BTVN) và đề kiểm tra HSK sẽ được giao tại đây trong quá trình học.
            </p>
          </div>
        </div>

        {/* Card 5: Lịch sử các lớp đã học (nếu có) */}
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

      {/* Right Stack (lg:col-span-5) */}
      <div className="space-y-6 lg:col-span-5">
        {/* Card 3: Chuyên cần */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <div className="border-b border-[var(--line)] pb-3">
            <h2 className="text-base font-bold text-[var(--ink)]">
              Chuyên cần
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
              <span className="block text-xs font-medium text-[var(--ink-2)]">
                Số buổi nghỉ
              </span>
              <span className="mt-1 block font-num text-2xl font-bold text-[var(--ink)]">
                0
              </span>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
              <span className="block text-xs font-medium text-[var(--ink-2)]">
                Tỷ lệ chuyên cần
              </span>
              <span className="mt-1 block font-num text-2xl font-bold text-[var(--jade)]">
                100%
              </span>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
              <span className="block text-xs font-medium text-[var(--ink-2)]">
                Có mặt
              </span>
              <span className="mt-1 block font-num text-xs font-semibold text-[var(--ink)]">
                0 buổi đã điểm danh
              </span>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
              <span className="block text-xs font-medium text-[var(--ink-2)]">
                Tỷ lệ nộp BTVN
              </span>
              <span className="mt-1 block font-num text-xs font-semibold text-[var(--ink)]">
                —
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-[var(--ink-3)] italic">
            Điểm BTVN chỉ tính chuyên cần, không tính vào điểm tổng kết.
          </p>
        </div>

        {/* Card 4: Kết quả gần đây */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <h2 className="text-base font-bold text-[var(--ink)]">
              Kết quả gần đây
            </h2>
            <span className="text-xs font-medium text-[var(--ink-3)]">
              Xem tất cả
            </span>
          </div>
          <div className="py-8 text-center text-xs text-[var(--ink-2)]">
            Chưa có kết quả bài thi mới.
          </div>
        </div>

        {/* Card: Thông tin học viên */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <h3 className="text-base font-semibold text-[var(--ink)] border-b border-[var(--line)] pb-3">
            Thông tin học viên
          </h3>
          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between border-b border-[var(--line)] pb-2">
              <dt className="text-[var(--ink-2)]">Họ và tên</dt>
              <dd className="font-semibold text-[var(--ink)]">{profile.fullName}</dd>
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
    </div>
  );
}

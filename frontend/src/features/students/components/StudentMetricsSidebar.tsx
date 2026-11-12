'use client';

import React from 'react';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import type { StudentItemDto } from '../api/students.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

interface StudentMetricsSidebarProps {
  profile: UserProfileDto;
  studentDetail: StudentItemDto | null;
}

export function StudentMetricsSidebar({
  profile,
  studentDetail,
}: StudentMetricsSidebarProps) {
  return (
    <div className="space-y-6 lg:col-span-5">
      {/* Chuyên cần */}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
        <div className="border-b border-[var(--line)] pb-3">
          <h2 className="text-base font-bold text-[var(--ink)]">Chuyên cần</h2>
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

      {/* Kết quả gần đây */}
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

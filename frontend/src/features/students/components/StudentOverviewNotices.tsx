'use client';

import Link from 'next/link';
import React from 'react';
import { PastClassesHistoryList } from '@/features/students/components/PastClassesHistoryList';
import type { PastClassRecordDto } from '../api/students.api';

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
        Tài khoản quản trị hiện tại không gắn trực tiếp với một hồ sơ học viên
        cá nhân. Để tra cứu hoặc cập nhật tình trạng xếp lớp của từng học viên,
        vui lòng mở khu vực Quản lý hồ sơ học viên.
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

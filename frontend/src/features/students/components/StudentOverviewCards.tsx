'use client';

import Link from 'next/link';
import React from 'react';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import type { StudentItemDto } from '../api/students.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

interface StudentOverviewCardsProps {
  profile: UserProfileDto;
  studentDetail: StudentItemDto | null;
  assignedClass: string | null;
  enrolledAt: string | null;
}

export function AdminAccessNotice() {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold text-base">
        QL
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">
        Bạn đang truy cập với quyền Quản trị viên
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
        Tài khoản quản trị hiện tại không gắn trực tiếp với một hồ sơ học viên cá
        nhân. Để tra cứu hoặc cập nhật tình trạng xếp lớp của từng học viên, vui
        lòng mở khu vực Quản lý hồ sơ học viên.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/admin/students"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
        >
          Đi tới Quản lý hồ sơ học viên
        </Link>
        <Link
          href="/admin/students/pending"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Danh sách chờ xếp lớp
        </Link>
      </div>
    </div>
  );
}

export function PendingClassNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-xl">
        !
      </div>
      <h2 className="mt-4 text-xl font-bold text-slate-900">
        Bạn chưa được xếp lớp. Vui lòng liên hệ trung tâm
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
        Tài khoản của bạn đã được ghi nhận trên hệ thống Trung Tâm TD Hán Ngữ.
        Sau khi bộ phận Giáo vụ liên kết tài khoản vào lớp học chính thức, lịch
        học, bài tập và bảng điểm cá nhân sẽ hiển thị tại đây.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/profile"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kiểm tra hồ sơ cá nhân
        </Link>
      </div>
    </div>
  );
}

export function ActiveStudentClassSection({
  profile,
  studentDetail,
  assignedClass,
  enrolledAt,
}: StudentOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Lớp đang theo học
            </span>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {assignedClass}
            </h2>
          </div>
          <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            Đang học
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-xs font-medium text-slate-500">Ngày vào lớp</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDateDdMmYyyy(enrolledAt)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-xs font-medium text-slate-500">
              Quyền riêng tư dữ liệu
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-800">
              Chỉ hiển thị kết quả của {profile.fullName}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Thông tin học viên
        </h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Họ và tên</dt>
            <dd className="font-medium text-slate-900">{profile.fullName}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Ngày sinh</dt>
            <dd className="font-medium text-slate-900">
              {formatDateDdMmYyyy(
                studentDetail?.dateOfBirth ?? profile.dateOfBirth,
              )}
            </dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Số điện thoại</dt>
            <dd className="font-medium text-slate-900">{profile.phone}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900 truncate max-w-[180px]">
              {profile.email}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

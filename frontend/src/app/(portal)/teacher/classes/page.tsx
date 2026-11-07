'use client';

import Link from 'next/link';
import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalProfileSession } from '@/features/auth/hooks/usePortalSession';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import { ROLE_LABELS, STATUS_LABELS, type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['TEACHER', 'ADMIN'];

interface TeacherClassesContentProps {
  profile: UserProfileDto;
}

function TeacherClassesContent({ profile }: TeacherClassesContentProps) {
  const activeClassesCount = profile.activeClassesCount ?? 0;
  const isDualAdmin = profile.roles.includes('ADMIN');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E0DED5] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[#B5322A] uppercase mb-1">
            教学工作 · LỚP PHỤ TRÁCH
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C2320]">
            Lớp Học Phụ Trách
          </h1>
          <p className="mt-1 text-sm text-[#5A6460]">
            Tổng quan lịch giảng dạy và danh sách các lớp HSK được phân công
            cho giảng viên
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile.roles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center rounded-full border border-[#2B7760]/20 bg-[#2B7760]/10 px-3 py-1 text-xs font-semibold text-[#2B7760]"
            >
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              profile.status === 'ACTIVE'
                ? 'border border-[#2B7760]/20 bg-[#2B7760]/10 text-[#2B7760]'
                : 'bg-[#EAECE6] text-[#5A6460]'
            }`}
          >
            {STATUS_LABELS[profile.status] ?? profile.status}
          </span>
        </div>
      </div>

      {/* Thống kê tổng quan giảng dạy */}
      <section
        aria-label="Tổng quan công tác giảng dạy"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div className="rounded-2xl border border-[#E0DED5] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5A6460]">
            Số lớp đang phụ trách
          </p>
          <p className="mt-2 text-3xl font-extrabold text-[#2B7760] font-num">
            {activeClassesCount}
          </p>
          <p className="mt-1 text-xs text-[#5A6460]">
            {activeClassesCount > 0
              ? 'Đang trong thời gian giảng dạy'
              : 'Chưa có lớp đang mở được phân công'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E0DED5] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5A6460]">
            Lịch giảng dạy trong tuần
          </p>
          <p className="mt-2 text-base font-bold text-[#1C2320]">
            {activeClassesCount > 0
              ? 'Theo thời khóa biểu lớp phụ trách'
              : 'Chưa có ca dạy trong tuần'}
          </p>
          <p className="mt-1 text-xs text-[#5A6460]">
            Múi giờ chuẩn Việt Nam (GMT+7)
          </p>
        </div>

        <div className="rounded-2xl border border-[#E0DED5] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5A6460]">
            Giảng viên đăng nhập
          </p>
          <p className="mt-2 text-base font-bold text-[#1C2320] truncate">
            {profile.fullName}
          </p>
          <p className="mt-1 text-xs text-[#5A6460] truncate">
            {profile.email} • {profile.phone}
          </p>
        </div>
      </section>

      {/* Danh sách lớp đang phụ trách */}
      <section className="rounded-2xl border border-[#E0DED5] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#EAECE6] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1C2320]">
              Danh sách lớp đang phụ trách
            </h2>
            <p className="mt-0.5 text-xs text-[#5A6460]">
              Hiển thị các lớp học được bộ phận Giáo vụ phân công giảng dạy
              trực tiếp
            </p>
          </div>
          <span className="rounded-lg border border-[#E0DED5] bg-[#F5F6F2] px-3 py-1 text-xs font-semibold text-[#1C2320] font-num">
            {activeClassesCount} lớp
          </span>
        </div>

        {activeClassesCount > 0 ? (
          <div className="mt-6 rounded-xl border border-[#2B7760]/20 bg-[#2B7760]/5 p-6">
            <h3 className="text-base font-semibold text-[#2B7760]">
              Hồ sơ của bạn đang ghi nhận {activeClassesCount} lớp phụ trách
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#5A6460]">
              Danh sách học viên theo từng lớp, lịch buổi học chi tiết và sổ
              điểm danh trực tuyến được đồng bộ trực tiếp theo phân công của
              Trung Tâm TD Hán Ngữ.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-[#E0DED5] bg-[#F5F6F2] p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#2B7760]/10 text-[#2B7760] font-bold text-base font-han">
              师
            </div>
            <h3 className="mt-3 text-base font-bold text-[#1C2320]">
              Hiện chưa có lớp học nào được phân công giảng dạy
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[#5A6460]">
              Khi bộ phận Giáo vụ mở lớp HSK mới và gán giáo viên phụ trách,
              thông tin lớp học, danh sách học viên cùng lịch lên lớp sẽ
              hiển thị đầy đủ tại đây.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#EAECE6] pt-4">
          <Link
            href="/profile"
            className="rounded-lg border border-[#D5D3CA] bg-white px-4 py-2 text-sm font-semibold text-[#1C2320] hover:bg-[#F5F6F2] transition-colors"
          >
            Cập nhật hồ sơ cá nhân
          </Link>
          {isDualAdmin ? (
            <Link
              href="/admin/teachers"
              className="rounded-lg bg-[#B5322A] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#962821] transition-colors"
            >
              Quản lý đội ngũ giáo viên
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default function TeacherClassesPage() {
  const { status, user, errorMessage } =
    usePortalProfileSession(ALLOWED_ROLES);

  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }

  return <TeacherClassesContent profile={user} />;
}

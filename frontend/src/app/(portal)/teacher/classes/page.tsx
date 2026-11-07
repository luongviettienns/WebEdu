'use client';

import Link from 'next/link';
import React from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
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
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={profile} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-950">
              Lớp Học Phụ Trách
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tổng quan lịch giảng dạy và danh sách các lớp HSK được phân công
              cho giảng viên
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile.roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
              >
                {ROLE_LABELS[role] ?? role}
              </span>
            ))}
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                profile.status === 'ACTIVE'
                  ? 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-700'
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Số lớp đang phụ trách
            </p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-800">
              {activeClassesCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {activeClassesCount > 0
                ? 'Đang trong thời gian giảng dạy'
                : 'Chưa có lớp đang mở được phân công'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lịch giảng dạy trong tuần
            </p>
            <p className="mt-2 text-base font-bold text-slate-900">
              {activeClassesCount > 0
                ? 'Theo thời khóa biểu lớp phụ trách'
                : 'Chưa có ca dạy trong tuần'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Múi giờ chuẩn Việt Nam (GMT+7)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Giảng viên đăng nhập
            </p>
            <p className="mt-2 text-base font-bold text-slate-900 truncate">
              {profile.fullName}
            </p>
            <p className="mt-1 text-xs text-slate-500 truncate">
              {profile.email} • {profile.phone}
            </p>
          </div>
        </section>

        {/* Lịch giảng dạy & Danh sách lớp đang phụ trách */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Danh sách lớp đang phụ trách
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hiển thị các lớp học được bộ phận Giáo vụ phân công giảng dạy
                  trực tiếp
                </p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {activeClassesCount} lớp
              </span>
            </div>

            {activeClassesCount > 0 ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-6">
                <h3 className="text-base font-semibold text-emerald-950">
                  Hồ sơ của bạn đang ghi nhận {activeClassesCount} lớp phụ trách
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  Danh sách học viên theo từng lớp, lịch buổi học chi tiết và sổ
                  điểm danh trực tuyến được đồng bộ trực tiếp theo phân công của
                  Trung Tâm TD Hán Ngữ.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold text-base">
                  GV
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900">
                  Hiện chưa có lớp học nào được phân công giảng dạy
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
                  Khi bộ phận Giáo vụ mở lớp HSK mới và gán giáo viên phụ trách,
                  thông tin lớp học, danh sách học viên cùng lịch lên lớp sẽ
                  hiển thị đầy đủ tại đây.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <Link
                href="/profile"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cập nhật hồ sơ cá nhân
              </Link>
              {isDualAdmin ? (
                <Link
                  href="/admin/teachers"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
                >
                  Quản lý đội ngũ giáo viên
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Trạng thái lịch giảng dạy
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tóm tắt quy trình vận hành buổi học của giáo viên
            </p>

            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <p className="font-semibold text-slate-900">
                  1. Lịch dạy theo ca học
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Tự động cập nhật ca sáng, chiều, tối theo từng lớp HSK đang
                  hoạt động.
                </p>
              </li>
              <li className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <p className="font-semibold text-slate-900">
                  2. Điểm danh & nhận xét buổi học
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Ghi nhận chuyên cần và tiến độ của từng học viên ngay trong
                  buổi dạy.
                </p>
              </li>
              <li className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <p className="font-semibold text-slate-900">
                  3. Giao bài tập & đánh giá định kỳ
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Theo dõi kết quả rèn luyện kỹ năng Nghe — Nói — Đọc — Viết của
                  lớp phụ trách.
                </p>
              </li>
            </ul>
          </section>
        </div>
      </main>
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

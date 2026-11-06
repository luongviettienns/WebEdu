import Link from 'next/link';
import React from 'react';
import { AppHeader } from '@/components/layout/AppHeader';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <AppHeader />

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-4 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <span>Nền Tảng Đào Tạo Chuẩn HSK 3.0</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Học Tập & Quản Trị Giáo Dục{' '}
              <span className="mt-1 block font-serif text-emerald-700">
                TD 汉语学习平台
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Hệ thống vận hành chuyên sâu cho trung tâm: Quản lý tài khoản đa
              vai trò, khóa học HSK, phân công giáo viên, điểm danh buổi học
              chính xác và ngân hàng đề thi tương tác bảo mật.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
              >
                Đăng nhập hệ thống
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-emerald-700 bg-white px-6 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
              >
                Đăng ký học viên mới
              </Link>
            </div>
          </div>

          {/* Core Modules & Portal Quick Links */}
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/student/overview"
              className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                HV
              </div>
              <h2 className="text-base font-semibold text-slate-900">
                Cổng Học Viên
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Theo dõi tình trạng xếp lớp, lịch học HSK, bài tập được giao và
                bảng điểm cá nhân bảo mật.
              </p>
            </Link>

            <Link
              href="/admin/students"
              className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                QL
              </div>
              <h2 className="text-base font-semibold text-slate-900">
                Quản Trị Học Viên & Xếp Lớp
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Quản lý hồ sơ học viên, đối soát đồng ý của cha mẹ và duyệt danh
                sách tài khoản chờ xếp lớp.
              </p>
            </Link>

            <Link
              href="/admin/teachers"
              className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                GV
              </div>
              <h2 className="text-base font-semibold text-slate-900">
                Đội Ngũ Giáo Viên
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Quản lý giảng viên HSK, theo dõi số lớp đang phụ trách và hỗ trợ
                kiêm nhiệm vai trò Admin.
              </p>
            </Link>

            <Link
              href="/superadmin/settings"
              className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                SA
              </div>
              <h2 className="text-base font-semibold text-slate-900">
                Vận Hành Hệ Thống
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Phân quyền đa vai trò, thiết lập thương hiệu Trung tâm và tra cứu
                nhật ký kiểm toán hệ thống.
              </p>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-xs text-slate-500">
          Trung Tâm TD Hán Ngữ © 2026 — Nền Tảng Quản Lý Giáo Dục Trực Tuyến
          WebEdu
        </div>
      </footer>
    </div>
  );
}

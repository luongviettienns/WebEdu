import React from 'react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Navigation Header */}
      <header className="border-b border-emerald-900/10 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white font-bold text-xl shadow-sm">
              TD
            </div>
            <div>
              <span className="font-semibold text-lg text-emerald-950 tracking-tight block">
                Trung Tâm TD Hán Ngữ
              </span>
              <span className="text-xs text-slate-500 font-medium block">
                Hệ Thống Quản Trị Học Tập & Lớp Học
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Backend v1.0 • Asia/Ho_Chi_Minh
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/70 px-4 py-1.5 text-xs font-semibold text-emerald-800 mb-6">
              <span>🌿 Nền Tảng Đào Tạo Chuẩn HSK 3.0</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Học Tập & Quản Trị Giáo Dục{' '}
              <span className="text-emerald-700 block mt-1 font-serif">
                TD 汉语学习平台
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Hệ thống vận hành chuyên sâu cho trung tâm: Quản lý khóa học HSK,
              phân công giáo viên, điểm danh buổi học chuẩn múi giờ và ngân hàng đề thi
              tương tác hai bước bảo mật.
            </p>
          </div>

          {/* Core Modules Grid */}
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-lg mb-4">
                01
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Khóa Học & Lớp Học
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Đào tạo HSK1–HSK4 và Giao tiếp cơ bản. Ràng buộc chuẩn: 1 lớp = 1 giáo viên, 1 học viên học 1 lớp đang hoạt động.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-lg mb-4">
                02
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Lịch Học & Điểm Danh
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Điểm danh 3 trạng thái. Cửa sổ sửa điểm danh 2 ngày theo giờ Việt Nam (GMT+7) và lưu vết kiểm toán đầy đủ.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-lg mb-4">
                03
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Ngân Hàng Đề Thi
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Hỗ trợ 7 dạng câu hỏi HSK tương tác, chuyển đổi từ đề Word/PDF có bước giáo viên kiểm duyệt trước khi giao.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-lg mb-4">
                04
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Chấm Điểm & Công Bố
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Quy trình hai bước độc lập: Xác nhận điểm $\rightarrow$ Công bố. Điểm và đáp án bảo mật tuyệt đối trước khi công bố.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-xs text-slate-500">
          Trung Tâm TD Hán Ngữ © 2026 — Nền Tảng Quản Lý Giáo Dục Trực Tuyến WebEdu
        </div>
      </footer>
    </div>
  );
}

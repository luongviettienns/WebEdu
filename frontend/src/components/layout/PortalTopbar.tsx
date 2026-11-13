'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useBrandConfig } from '@/features/system-settings/hooks/useBrandConfig';

interface PortalTopbarProps {
  onOpenMobileMenu: () => void;
}

const STATIC_ROUTE_LABELS: Record<string, string> = {
  '/student/overview': 'Tổng quan học tập',
  '/student/schedule': 'Lịch học của tôi',
  '/teacher/classes': 'Lớp học phụ trách',
  '/teacher/schedules': 'Lịch dạy',
  '/teacher/assessments': 'Ngân hàng đề',
  '/admin/courses': 'Khóa học HSK',
  '/admin/classes': 'Quản lý lớp học',
  '/admin/schedules': 'Quản lý lịch học',
  '/admin/schedule-logs': 'Nhật ký đổi lịch',
  '/admin/students': 'Quản lý học viên',
  '/admin/students/pending': 'Chờ xếp lớp',
  '/admin/teachers': 'Quản lý giáo viên',
  '/superadmin/settings': 'Cấu hình hệ thống & Kiểm toán',
  '/profile': 'Hồ sơ cá nhân & Bảo mật',
};

const DYNAMIC_ROUTE_LABELS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /^\/teacher\/classes\/[^/]+$/, label: 'Chi tiết lớp học' },
  { pattern: /^\/admin\/classes\/[^/]+$/, label: 'Chi tiết lớp học' },
];

/** Resolves a portal pathname (static or dynamic) into its Vietnamese topbar breadcrumb label. */
export function resolveRouteLabel(pathname: string): string {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const staticLabel = STATIC_ROUTE_LABELS[normalized];
  if (staticLabel) {
    return staticLabel;
  }

  for (const { pattern, label } of DYNAMIC_ROUTE_LABELS) {
    if (pattern.test(normalized)) {
      return label;
    }
  }

  return 'Cổng thông tin';
}

export function PortalTopbar({ onOpenMobileMenu }: PortalTopbarProps) {
  const pathname = usePathname();
  const { centerName } = useBrandConfig();
  const currentLabel = resolveRouteLabel(pathname ?? '');

  return (
    <header className="sticky top-0 z-20 flex h-[57px] w-full items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger Mobile Trigger */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-md text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink)] focus:outline-none"
          aria-label="Mở menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-3)] font-medium">
          <span className="hidden sm:inline">Hệ thống</span>
          <span className="hidden sm:inline text-[var(--line-2)]">/</span>
          <span className="text-[var(--ink)] font-semibold">{currentLabel}</span>
        </div>
      </div>

      {/* Center Branding Name */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-[var(--ink-2)] truncate max-w-[200px] sm:max-w-none">
          {centerName}
        </span>
      </div>
    </header>
  );
}

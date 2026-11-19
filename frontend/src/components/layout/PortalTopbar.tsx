'use client';

import Link from 'next/link';
import React from 'react';
import { usePathname } from 'next/navigation';
import type { AuthUserDto } from '@/features/auth/api/auth.api';
import { NotificationBellPopover } from '@/features/notifications/components/NotificationBellPopover';
import { useBrandConfig } from '@/features/system-settings/hooks/useBrandConfig';
import { getUserInitials, resolveActiveRoleView } from './nav-links';

interface PortalTopbarProps {
  user?: AuthUserDto | null;
  preferredRoleView?: 'ADMIN' | 'TEACHER';
  notificationsActive?: boolean;
  onOpenMobileMenu: () => void;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const STATIC_ROUTE_LABELS: Record<string, string> = {
  '/student/overview': 'Tổng quan học tập',
  '/student/schedule': 'Lịch học của tôi',
  '/student/assignments': 'Bài tập & Đề thi',
  '/student/results': 'Kết quả học tập',
  '/teacher/classes': 'Lớp học phụ trách',
  '/teacher/schedules': 'Lịch dạy',
  '/teacher/assessments': 'Ngân hàng đề',
  '/admin/overview': 'Tổng quan các lớp',
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
  { pattern: /^\/student\/assignments\/[^/]+$/, label: 'Làm bài & Bài nộp' },
  { pattern: /^\/teacher\/assignments\/[^/]+\/grading$/, label: 'Chấm điểm bài tập' },
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

/** Resolves a multi-level breadcrumb trail with clickable parent links where applicable. */
export function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/admin/students/pending') {
    return [{ label: 'Quản lý học viên', href: '/admin/students' }, { label: 'Chờ xếp lớp' }];
  }
  if (/^\/admin\/classes\/[^/]+$/.test(normalized)) {
    return [{ label: 'Quản lý lớp học', href: '/admin/classes' }, { label: 'Chi tiết lớp học' }];
  }
  if (/^\/teacher\/classes\/[^/]+$/.test(normalized)) {
    return [{ label: 'Lớp học phụ trách', href: '/teacher/classes' }, { label: 'Chi tiết lớp học' }];
  }
  if (/^\/student\/assignments\/[^/]+$/.test(normalized)) {
    return [{ label: 'Bài tập & Đề thi', href: '/student/assignments' }, { label: 'Làm bài & Bài nộp' }];
  }
  return [{ label: 'Hệ thống' }, { label: resolveRouteLabel(normalized) }];
}

export function PortalTopbar({
  user,
  preferredRoleView = 'ADMIN',
  notificationsActive = true,
  onOpenMobileMenu,
}: PortalTopbarProps) {
  const pathname = usePathname();
  const { centerName } = useBrandConfig();
  const normalizedPath = pathname ?? '';
  const crumbs = resolveBreadcrumbs(normalizedPath);
  const parentHref = crumbs.length > 1 ? crumbs[0]?.href : undefined;
  const hasAdminTeacherSwitch = Boolean(
    user?.roles?.includes('ADMIN') && user?.roles?.includes('TEACHER') && user?.effectiveRole !== 'SUPERADMIN',
  );
  const activeRoleView = resolveActiveRoleView(
    normalizedPath,
    user?.effectiveRole,
    user?.roles,
    preferredRoleView,
  );

  return (
    <header className="z-20 flex h-[57px] min-h-[57px] shrink-0 w-full items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface)]/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
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

        {parentHref ? (
          <Link
            href={parentHref}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-[var(--line-2)] bg-white px-2 py-1 text-xs font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            ← Quay lại
          </Link>
        ) : null}

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-[var(--ink-3)]">
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <React.Fragment key={crumb.label}>
                {idx > 0 ? (
                  <span className="hidden sm:inline text-[var(--line-2)]" aria-hidden="true">
                    /
                  </span>
                ) : null}
                {isLast ? (
                  <span className="truncate font-semibold text-[var(--ink)]">{crumb.label}</span>
                ) : crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hidden sm:inline truncate hover:text-[var(--ink)] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="hidden sm:inline">{crumb.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Role Context Badge, Center Branding Name & Profile Quick Avatar */}
      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        {hasAdminTeacherSwitch ? (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[var(--line-2)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--red)]" aria-hidden="true" />
            {activeRoleView === 'TEACHER' ? 'Đang xem: Giáo viên' : 'Đang xem: Quản lý Admin'}
          </span>
        ) : null}
        <span className="text-xs font-semibold text-[var(--ink-2)] truncate max-w-[110px] sm:max-w-none">
          {centerName}
        </span>
        <NotificationBellPopover user={user} pollingActive={notificationsActive} />
        {user ? (
          <Link
            href="/profile"
            title="Hồ sơ cá nhân"
            aria-label="Hồ sơ cá nhân"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[var(--red)]/25 bg-[var(--red-soft)] text-xs font-bold text-[var(--red-ink)] transition-colors hover:bg-[var(--red)] hover:text-white"
          >
            <span aria-hidden="true">{getUserInitials(user.fullName)}</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}

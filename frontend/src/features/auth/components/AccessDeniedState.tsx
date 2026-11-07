'use client';

import Link from 'next/link';
import React from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import type { AuthUserDto } from '@/features/auth/api/auth.api';
import { getDefaultRouteForRole } from '@/features/auth/roles';
import { ROLE_LABELS, type Role } from '@/types/user';

export interface AccessDeniedStateProps {
  currentUser?: AuthUserDto | null;
  title?: string;
  description?: string;
}

function getHomeLabelForRole(role?: Role): string {
  switch (role) {
    case 'SUPERADMIN':
      return 'Về trang Vận hành hệ thống';
    case 'ADMIN':
      return 'Về trang Quản lý học viên';
    case 'TEACHER':
      return 'Về trang Lớp học phụ trách';
    case 'STUDENT':
      return 'Về trang Tình trạng học cá nhân';
    default:
      return 'Về trang chủ hệ thống';
  }
}

export function AccessDeniedState({
  currentUser,
  title = 'Bạn không có quyền truy cập trang này',
  description,
}: AccessDeniedStateProps) {
  const effectiveRole = currentUser?.effectiveRole;
  const homeHref = effectiveRole
    ? getDefaultRouteForRole(effectiveRole)
    : '/';
  const homeLabel = getHomeLabelForRole(effectiveRole);

  const resolvedDescription =
    description ??
    (effectiveRole
      ? `Tài khoản của bạn đang đăng nhập với vai trò ${ROLE_LABELS[effectiveRole]} và không được cấp quyền truy cập khu vực này.`
      : 'Tài khoản hiện tại không có quyền xem hoặc thực hiện thao tác tại khu vực này.');

  return (
    <div
      role="alert"
      className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm sm:p-10"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <span className="mt-4 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-xs font-semibold text-rose-800">
        403 — Giới hạn quyền truy cập
      </span>

      <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        {title}
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {resolvedDescription}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={homeHref}
          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
        >
          {homeLabel}
        </Link>
        {currentUser ? (
          <Link
            href="/profile"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Hồ sơ cá nhân
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Đăng nhập lại
          </Link>
        )}
      </div>
    </div>
  );
}

export type PortalGuardStatus =
  | 'checking'
  | 'authorized'
  | 'unauthorized'
  | 'forbidden'
  | 'error';

export interface PortalGuardViewProps {
  status: Exclude<PortalGuardStatus, 'authorized'>;
  currentUser?: AuthUserDto | null;
  errorMessage?: string;
}

export function PortalGuardView({
  status,
  currentUser = null,
  errorMessage,
}: PortalGuardViewProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        currentUser={currentUser}
        authLoading={status === 'checking' || status === 'unauthorized'}
      />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {status === 'checking' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Đang kiểm tra phiên đăng nhập và quyền truy cập...
          </div>
        ) : status === 'unauthorized' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Đang chuyển hướng về
            trang đăng nhập...
          </div>
        ) : status === 'forbidden' ? (
          <AccessDeniedState currentUser={currentUser} />
        ) : (
          <div
            role="alert"
            className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm"
          >
            <p className="text-sm font-semibold text-red-800">
              {errorMessage ||
                'Không thể xác minh phiên đăng nhập lúc này. Vui lòng thử lại.'}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/login"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Đến trang Đăng nhập
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

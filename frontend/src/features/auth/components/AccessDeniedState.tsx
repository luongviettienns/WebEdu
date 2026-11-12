'use client';

import Link from 'next/link';
import React from 'react';
import type { AuthUserDto } from '@/features/auth/api/auth.api';
import { getDefaultRouteForRole } from '@/features/auth/roles';
import { StatusTag } from '@/features/common/components/StatusTag';
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
      className="mx-auto max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs sm:p-10"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--red-soft)] text-[var(--red)] ring-1 ring-[var(--red)]/20">
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

      <StatusTag tone="red" className="mt-4">
        403 — Giới hạn quyền truy cập
      </StatusTag>

      <h1 className="mt-3 text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
        {title}
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-2)]">
        {resolvedDescription}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={homeHref}
          className="rounded-xl bg-[var(--red)] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-colors"
        >
          {homeLabel}
        </Link>
        {currentUser ? (
          <Link
            href="/profile"
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] transition-colors"
          >
            Hồ sơ cá nhân
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] transition-colors"
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
    <div className="mx-auto max-w-5xl py-8">
      {status === 'checking' ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--ink-3)] shadow-xs">
          Đang kiểm tra phiên đăng nhập và quyền truy cập...
        </div>
      ) : status === 'unauthorized' ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--ink-3)] shadow-xs">
          Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Đang chuyển hướng về
          trang đăng nhập...
        </div>
      ) : status === 'forbidden' ? (
        <AccessDeniedState currentUser={currentUser} />
      ) : (
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-2xl border border-[var(--red)]/20 bg-[var(--red-soft)] p-6 text-center shadow-xs"
        >
          <p className="text-sm font-semibold text-[var(--red-ink)]">
            {errorMessage ||
              'Không thể xác minh phiên đăng nhập lúc này. Vui lòng thử lại.'}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] transition-colors"
            >
              Đến trang Đăng nhập
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

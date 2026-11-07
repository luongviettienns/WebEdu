'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  AuthUserDto,
  getCurrentUser,
  logoutUser,
} from '@/features/auth/api/auth.api';
import { useIdleTimeout } from '@/features/auth/hooks/useIdleTimeout';
import { usePendingEnrollmentCount } from '@/features/students/hooks/usePendingEnrollmentCount';
import { useBrandConfig } from '@/features/system-settings/hooks/useBrandConfig';
import { ROLE_LABELS } from '@/types/user';
import { getNavLinks } from './nav-links';

export interface AppHeaderProps {
  currentUser?: AuthUserDto | null;
  pendingCountOverride?: number;
  authLoading?: boolean;
}

function AppHeaderInner({
  currentUser: externalUser,
  pendingCountOverride,
  authLoading = false,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [fetchedUser, setFetchedUser] = useState<AuthUserDto | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const { centerName, centerLogo } = useBrandConfig();

  const user = externalUser !== undefined ? externalUser : fetchedUser;
  const hasAdminRole = Boolean(user?.roles?.includes('ADMIN'));
  const fetchedPendingCount = usePendingEnrollmentCount(
    pendingCountOverride === undefined && hasAdminRole,
  );
  const pendingCount =
    pendingCountOverride !== undefined
      ? pendingCountOverride
      : fetchedPendingCount;

  useEffect(() => {
    if (externalUser !== undefined || authLoading) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const me = await getCurrentUser({ signal: controller.signal });
        if (!controller.signal.aborted) {
          setFetchedUser(me);
        }
      } catch {
        // Người dùng chưa đăng nhập hoặc phiên hết hạn
      }
    })();

    return () => {
      controller.abort();
    };
  }, [externalUser, authLoading]);

  const handleLogout = useCallback(
    async (isIdleTimeout = false) => {
      if (loggingOut) return;
      setLoggingOut(true);
      setMenuOpen(false);
      try {
        await logoutUser();
      } finally {
        const target = isIdleTimeout
          ? '/login?reason=idle_timeout'
          : '/login';
        router.replace(target);
      }
    },
    [loggingOut, router],
  );

  const { remainingSeconds, markActive } = useIdleTimeout(
    Boolean(user),
    () => void handleLogout(true),
  );

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        menuContainerRef.current &&
        event.target instanceof Node &&
        !menuContainerRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleKeepSessionAlive = async () => {
    markActive();
    try {
      const refreshed = await getCurrentUser();
      setFetchedUser(refreshed);
    } catch {
      // Bỏ qua nếu mạng chập chờn
    }
  };

  const navLinks = getNavLinks(user?.effectiveRole, user?.roles, pendingCount);
  const avatarInitials = user?.fullName
    ? user.fullName
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : 'TD';

  return (
    <>
      {remainingSeconds !== null && (
        <div
          role="alert"
          className="bg-amber-600 px-4 py-2.5 text-white shadow-sm"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="font-medium">
              Cảnh báo phiên làm việc: Bạn sẽ tự động đăng xuất sau{' '}
              <strong>
                {Math.floor(remainingSeconds / 60)} phút{' '}
                {remainingSeconds % 60} giây
              </strong>{' '}
              do không có hoạt động.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleKeepSessionAlive()}
                className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 transition-colors"
              >
                Tiếp tục phiên làm việc
              </button>
              <button
                type="button"
                onClick={() => void handleLogout(false)}
                className="rounded-md border border-white/40 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Đăng xuất ngay
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Thương hiệu Trung tâm */}
          <Link
            href="/"
            className="flex items-center gap-3 focus:outline-none"
          >
            {centerLogo ? (
              <Image
                src={centerLogo}
                alt={centerName}
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-lg border border-emerald-200 object-contain bg-white"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white font-bold text-lg shadow-sm">
                TD
              </div>
            )}
            <div>
              <span className="block text-base font-bold tracking-tight text-emerald-950 sm:text-lg">
                {centerName}
              </span>
              <span className="block text-xs font-medium text-slate-500">
                Hệ Thống Quản Trị Học Tập HSK
              </span>
            </div>
          </Link>

          {/* Điều hướng theo vai trò */}
          {user ? (
            <nav
              aria-label="Điều hướng chính"
              className="hidden md:flex items-center gap-1"
            >
              {navLinks.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin/students' &&
                    pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          {/* Menu Tài khoản góc trên bên phải */}
          <div className="flex items-center gap-3" ref={menuContainerRef}>
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-left hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                    {avatarInitials}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-semibold text-slate-900 leading-tight">
                      {user.fullName}
                    </p>
                    <p className="text-[11px] font-medium text-emerald-700">
                      {ROLE_LABELS[user.effectiveRole] ?? user.effectiveRole}
                    </p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5"
                  >
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user.email}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {user.roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200"
                          >
                            {ROLE_LABELS[r]}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="py-1 md:hidden border-b border-slate-100">
                      {navLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                        >
                          <span>{item.label}</span>
                          {typeof item.badge === 'number' && item.badge > 0 ? (
                            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                              {item.badge}
                            </span>
                          ) : null}
                        </Link>
                      ))}
                    </div>

                    <div className="py-1">
                      <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                      >
                        <span>Hồ sơ của tôi</span>
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={loggingOut}
                        onClick={() => void handleLogout(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <span>
                          {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : authLoading ? (
              <div
                aria-hidden="true"
                className="h-9 w-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                >
                  Đăng ký học viên
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-lg font-bold text-white shadow-sm">
                TD
              </div>
              <div>
                <span className="block text-base font-bold tracking-tight text-emerald-950 sm:text-lg">
                  Trung Tâm TD Hán Ngữ
                </span>
                <span className="block text-xs font-medium text-slate-500">
                  Hệ Thống Quản Trị Học Tập HSK
                </span>
              </div>
            </div>
          </div>
        </header>
      }
    >
      <AppHeaderInner {...props} />
    </Suspense>
  );
}

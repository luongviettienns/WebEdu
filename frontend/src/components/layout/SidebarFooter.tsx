'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { logoutUser, type AuthUserDto } from '@/features/auth/api/auth.api';
import { ROLE_LABELS } from '@/types/user';

interface SidebarFooterProps {
  user: AuthUserDto | null;
}

export function SidebarFooter({ user }: SidebarFooterProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      router.replace('/login');
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
    : 'TD';

  return (
    <div className="mt-auto pt-2 border-t border-[var(--line)] px-2 pb-3">
      <div className="fret" aria-hidden="true" />

      {user ? (
        <div className="flex items-center gap-2.5 p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--red)] text-white text-xs font-bold flex-none shadow-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[var(--ink)] truncate">
              {user.fullName}
            </div>
            <div className="text-[11px] text-[var(--ink-3)] truncate">
              {ROLE_LABELS[user.effectiveRole] ?? user.effectiveRole}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="flex-none p-1.5 rounded-md text-[var(--ink-3)] hover:text-[var(--red)] hover:bg-[var(--hover)] transition-colors focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M19 10a.75.75 0 0 0-.75-.75H8.66l2.1-1.95a.75.75 0 1 0-1.02-1.1l-3.5 3.25a.75.75 0 0 0 0 1.1l3.5 3.25a.75.75 0 0 0 1.02-1.1l-2.1-1.95h9.59A.75.75 0 0 0 19 10Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}

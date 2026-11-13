'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCurrentUser,
  logoutUser,
  type AuthUserDto,
} from '@/features/auth/api/auth.api';
import { IdleTimeoutWarningModal } from '@/features/auth/components/IdleTimeoutWarningModal';
import { useIdleTimeout } from '@/features/auth/hooks/useIdleTimeout';
import { usePendingEnrollmentCount } from '@/features/students/hooks/usePendingEnrollmentCount';
import { PortalSidebar } from './PortalSidebar';
import { PortalTopbar } from './PortalTopbar';
import { MobileNavDrawer } from './MobileNavDrawer';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const me = await getCurrentUser({ signal: controller.signal });
        if (!controller.signal.aborted) {
          setUser(me);
        }
      } catch {
        // Unauthenticated or expired
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  const executeLogout = useCallback(
    async (redirectUrl: string) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      setLoggingOut(true);
      try {
        await logoutUser().catch(() => undefined);
      } finally {
        router.replace(redirectUrl);
      }
    },
    [router],
  );

  const handleIdleExpire = useCallback(() => {
    void executeLogout('/login?reason=idle_timeout');
  }, [executeLogout]);

  const handleManualLogout = useCallback(() => {
    void executeLogout('/login');
  }, [executeLogout]);

  const isAuthenticated = Boolean(user) && !loading;
  const { remainingSeconds, markActive } = useIdleTimeout(
    isAuthenticated,
    handleIdleExpire,
  );

  const hasAdminRole = Boolean(user?.roles?.includes('ADMIN'));
  const pendingCount = usePendingEnrollmentCount(hasAdminRole);

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-[var(--paper)]">
        {/* Zero-CLS Skeleton Sidebar */}
        <aside
          className="hidden lg:flex w-[252px] h-screen flex-col bg-[var(--surface)] border-r border-[var(--line)] p-4 animate-pulse"
          aria-hidden="true"
        >
          <div className="h-9 w-36 bg-[var(--surface-2)] rounded mb-6" />
          <div className="space-y-3">
            <div className="h-4 w-20 bg-[var(--surface-2)] rounded mb-2" />
            <div className="h-8 w-full bg-[var(--surface-2)] rounded" />
            <div className="h-8 w-full bg-[var(--surface-2)] rounded" />
            <div className="h-8 w-full bg-[var(--surface-2)] rounded" />
          </div>
        </aside>

        {/* Skeleton Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-[57px] w-full border-b border-[var(--line)] bg-[var(--surface)] px-6 flex items-center justify-between" />
          <div className="p-6">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--paper)]">
      {/* 252px Desktop Sidebar */}
      <PortalSidebar user={user} pendingCount={pendingCount} />

      {/* Mobile Off-canvas Drawer */}
      <MobileNavDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        pendingCount={pendingCount}
      />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <PortalTopbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1240px] w-full mx-auto">
          {children}
        </main>
      </div>

      <IdleTimeoutWarningModal
        remainingSeconds={remainingSeconds}
        onContinue={markActive}
        onLogoutNow={handleManualLogout}
        loggingOut={loggingOut}
      />
    </div>
  );
}

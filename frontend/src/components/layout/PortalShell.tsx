'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useCallback, useRef, useState } from 'react';
import { logoutUser } from '@/features/auth/api/auth.api';
import { PortalSessionContext, usePortalIdentity } from '@/features/auth/hooks/usePortalSession';
import { IdleTimeoutWarningModal } from '@/features/auth/components/IdleTimeoutWarningModal';
import { useIdleTimeout } from '@/features/auth/hooks/useIdleTimeout';
import { usePendingEnrollmentCount } from '@/features/students/hooks/usePendingEnrollmentCount';
import { PortalSidebar } from './PortalSidebar';
import { PortalTopbar } from './PortalTopbar';
import { MobileNavDrawer } from './MobileNavDrawer';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = usePortalIdentity();
  const { user } = session;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [preferredRoleView, setPreferredRoleView] = useState<'ADMIN' | 'TEACHER'>('ADMIN');
  const loggingOutRef = useRef(false);

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

  const isAuthenticated = session.status === 'authorized';
  const { remainingSeconds, markActive } = useIdleTimeout(
    isAuthenticated,
    handleIdleExpire,
  );

  const hasAdminRole = Boolean(user?.roles?.includes('ADMIN'));
  const hasAdminTeacherSwitch = Boolean(
    hasAdminRole && user?.roles?.includes('TEACHER') && user?.effectiveRole !== 'SUPERADMIN',
  );
  const pendingCount = usePendingEnrollmentCount(hasAdminRole);

  const handleSwitchRoleView = useCallback(
    (nextRole: 'ADMIN' | 'TEACHER') => {
      setPreferredRoleView(nextRole);
      setMobileMenuOpen(false);
      router.push(nextRole === 'ADMIN' ? '/admin/classes' : '/teacher/classes');
    },
    [router],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--paper)]">
      <Suspense fallback={null}>
        <PortalSidebar
          user={user}
          pendingCount={pendingCount}
          preferredRoleView={preferredRoleView}
          onSwitchRoleView={hasAdminTeacherSwitch ? handleSwitchRoleView : undefined}
        />
        <MobileNavDrawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          user={user}
          pendingCount={pendingCount}
          preferredRoleView={preferredRoleView}
          onSwitchRoleView={hasAdminTeacherSwitch ? handleSwitchRoleView : undefined}
        />
      </Suspense>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Suspense fallback={null}>
          <PortalTopbar
            user={user}
            preferredRoleView={preferredRoleView}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        </Suspense>
        <div className="portal-scroll flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <main className="p-4 sm:p-6 lg:p-7 max-w-[1240px] w-full mx-auto">
            <PortalSessionContext.Provider value={session}>{children}</PortalSessionContext.Provider>
          </main>
        </div>
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

'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentUser, logoutUser, setActiveLogoutRedirect } from '@/features/auth/api/auth.api';
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
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [preferredRoleView, setPreferredRoleView] = useState<'ADMIN' | 'TEACHER'>('ADMIN');
  const loggingOutRef = useRef(false);

  const executeLogout = useCallback(
    async (redirectUrl: string) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      setLoggingOut(true);
      setLogoutFailed(false);
      setActiveLogoutRedirect(redirectUrl);
      try {
        await logoutUser();
        router.replace(redirectUrl);
      } catch {
        loggingOutRef.current = false;
        setLoggingOut(false);
        setLogoutFailed(true);
        setActiveLogoutRedirect(null);
      }
    },
    [router],
  );

  useEffect(() => {
    loggingOutRef.current = false;
    setActiveLogoutRedirect(null);
    const timer = window.setTimeout(() => {
      setLoggingOut(false);
      setLogoutFailed(false);
      setMobileMenuOpen(false);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      loggingOutRef.current = false;
      setLoggingOut(false);
      setLogoutFailed(false);
    };
  }, [user?.id]);

  const handleIdleExpire = useCallback(() => {
    void executeLogout('/login?reason=idle_timeout');
  }, [executeLogout]);

  const handleManualLogout = useCallback(() => {
    void executeLogout('/login');
  }, [executeLogout]);

  const { handleApiAuthError } = session;
  const keepAlive = useCallback(async () => {
    try {
      await getCurrentUser({ signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      handleApiAuthError(error);
      throw error;
    }
  }, [handleApiAuthError]);
  const { checkingIdle, remainingSeconds, markActive, continuing, continueFailed } = useIdleTimeout(
    session.status === 'authorized' ? user?.id : undefined,
    handleIdleExpire,
    keepAlive,
  );
  const logoutError = logoutFailed ? 'Không thể đăng xuất. Vui lòng thử lại.' : '';

  const canRenderChildren =
    session.status !== 'checking' && !checkingIdle && remainingSeconds !== 0 && !loggingOut;

  const hasAdminRole = Boolean(user?.roles?.includes('ADMIN'));
  const hasAdminTeacherSwitch = Boolean(
    hasAdminRole && user?.roles?.includes('TEACHER') && user?.effectiveRole !== 'SUPERADMIN',
  );
  const pendingCount = usePendingEnrollmentCount(hasAdminRole && canRenderChildren);

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
      <div className={checkingIdle || remainingSeconds === 0 ? 'hidden' : 'contents'} inert={remainingSeconds !== null}>
        <Suspense fallback={null}>
          <PortalSidebar
            user={user}
            pendingCount={pendingCount}
            preferredRoleView={preferredRoleView}
            onSwitchRoleView={hasAdminTeacherSwitch ? handleSwitchRoleView : undefined}
            onLogout={handleManualLogout}
            loggingOut={loggingOut}
          />
          <MobileNavDrawer
            open={mobileMenuOpen && remainingSeconds === null}
            onClose={() => setMobileMenuOpen(false)}
            user={user}
            pendingCount={pendingCount}
            preferredRoleView={preferredRoleView}
            onSwitchRoleView={hasAdminTeacherSwitch ? handleSwitchRoleView : undefined}
            onLogout={handleManualLogout}
            loggingOut={loggingOut}
          />
        </Suspense>
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <Suspense fallback={null}>
            <PortalTopbar
              user={user}
              preferredRoleView={preferredRoleView}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
            />
          </Suspense>
          <div
            tabIndex={0}
            className="portal-scroll flex-1 overflow-y-auto [scrollbar-gutter:stable] focus:outline-none"
          >
            <main className="p-4 sm:p-6 lg:p-7 max-w-[1240px] w-full mx-auto">
              <PortalSessionContext.Provider value={session}>
                {canRenderChildren ? children : null}
              </PortalSessionContext.Provider>
            </main>
          </div>
        </div>
      </div>

      {logoutError && remainingSeconds === null ? (
        <p role="alert" className="fixed left-4 right-4 top-4 z-[60] rounded-lg border border-[var(--red)] bg-[var(--red-soft)] p-3 text-sm font-semibold text-[var(--red-ink)] sm:left-auto">
          {logoutError}
        </p>
      ) : null}

      <IdleTimeoutWarningModal
        key={remainingSeconds === 0 ? 'expired' : 'warning'}
        remainingSeconds={remainingSeconds}
        onContinue={markActive}
        onLogoutNow={remainingSeconds === 0 ? handleIdleExpire : handleManualLogout}
        loggingOut={loggingOut}
        continuing={continuing}
        actionError={logoutError || (remainingSeconds !== 0 && continueFailed
          ? 'Không thể tiếp tục phiên làm việc. Vui lòng thử lại.'
          : '')}
      />
    </div>
  );
}

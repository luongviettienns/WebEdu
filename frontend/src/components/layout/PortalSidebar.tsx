'use client';

import { usePathname } from 'next/navigation';
import React from 'react';
import type { AuthUserDto } from '@/features/auth/api/auth.api';
import { SidebarBrand } from './SidebarBrand';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';
import { getGroupedNavLinks, resolveActiveRoleView } from './nav-links';

interface PortalSidebarProps {
  user: AuthUserDto | null;
  pendingCount: number;
  preferredRoleView?: 'ADMIN' | 'TEACHER';
  onSwitchRoleView?: (role: 'ADMIN' | 'TEACHER') => void;
  onLogout: () => void;
  loggingOut: boolean;
}

export function PortalSidebar({
  user,
  pendingCount,
  preferredRoleView = 'ADMIN',
  onSwitchRoleView,
  onLogout,
  loggingOut,
}: PortalSidebarProps) {
  const pathname = usePathname() ?? '';
  const activeRoleView = resolveActiveRoleView(
    pathname,
    user?.effectiveRole,
    user?.roles,
    preferredRoleView,
  );
  const groups = getGroupedNavLinks(activeRoleView, user?.roles, pendingCount);

  return (
    <aside
      className="hidden lg:flex w-[252px] h-screen sticky top-0 flex-col bg-[var(--surface)] border-r border-[var(--line)] z-30"
      aria-label="Điều hướng thanh bên"
    >
      <SidebarBrand />
      <SidebarNav groups={groups} />
      <SidebarFooter
        user={user}
        activeRoleView={activeRoleView}
        onSwitchRoleView={onSwitchRoleView}
        onLogout={onLogout}
        loggingOut={loggingOut}
      />
    </aside>
  );
}

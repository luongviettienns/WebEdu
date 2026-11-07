'use client';

import React from 'react';
import type { AuthUserDto } from '@/features/auth/api/auth.api';
import { SidebarBrand } from './SidebarBrand';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';
import { getGroupedNavLinks } from './nav-links';

interface PortalSidebarProps {
  user: AuthUserDto | null;
  pendingCount: number;
}

export function PortalSidebar({ user, pendingCount }: PortalSidebarProps) {
  const groups = getGroupedNavLinks(user?.effectiveRole, user?.roles, pendingCount);

  return (
    <aside
      className="hidden lg:flex w-[252px] h-screen sticky top-0 flex-col bg-[var(--surface)] border-r border-[var(--line)] z-30"
      aria-label="Điều hướng thanh bên"
    >
      <SidebarBrand />
      <SidebarNav groups={groups} />
      <SidebarFooter user={user} />
    </aside>
  );
}

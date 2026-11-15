'use client';

import React, { useRef } from 'react';
import { useDialogFocus } from '@/features/common/components/BaseDialog';
import type { AuthUserDto } from '@/features/auth/api/auth.api';
import { SidebarBrand } from './SidebarBrand';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';
import { getGroupedNavLinks } from './nav-links';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  user: AuthUserDto | null;
  pendingCount: number;
}

export function MobileNavDrawer({ open, onClose, user, pendingCount }: MobileNavDrawerProps) {
  const groups = getGroupedNavLinks(user?.effectiveRole, user?.roles, pendingCount);

  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, onClose, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop Scrim */}
      <div
        className="fixed inset-0 bg-[var(--scrim)] backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Body */}
      <div
        className="relative w-[280px] max-w-[85vw] h-full bg-[var(--surface)] shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng di động"
      >
        <div className="flex items-center justify-between pr-2">
          <div className="flex-1">
            <SidebarBrand />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--ink-3)] hover:text-[var(--ink)] focus:outline-none"
            aria-label="Đóng menu"
            data-dialog-close
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <SidebarNav groups={groups} onItemClick={onClose} />
        <SidebarFooter user={user} />
      </div>
    </div>
  );
}

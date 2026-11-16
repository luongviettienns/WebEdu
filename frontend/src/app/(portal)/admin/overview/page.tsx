'use client';

import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { AdminOverviewDashboard } from '@/features/progress/components/AdminOverviewDashboard';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];

export default function AdminOverviewPage() {
  const { status, user, errorMessage, handleApiAuthError } =
    usePortalSession(ALLOWED_ROLES);

  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <div className="font-han mb-1 text-xs uppercase tracking-widest text-[var(--red)]">
          概览 · TỔNG QUAN VẬN HÀNH
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          Tổng Quan Các Lớp
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Theo dõi tình trạng các lớp HSK, chuyên cần trung bình và lịch dạy trong 5 ngày tới
        </p>
      </div>

      <AdminOverviewDashboard onAuthError={handleApiAuthError} />
    </div>
  );
}

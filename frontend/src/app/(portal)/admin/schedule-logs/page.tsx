'use client';

import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { ScheduleChangeLogsView } from '@/features/schedules/components/ScheduleChangeLogsView';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'SUPERADMIN'];

export default function AdminScheduleLogsPage() {
  const { status, user, errorMessage } = usePortalSession(ALLOWED_ROLES);

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
          调课日志 · NHẬT KÝ THAY ĐỔI LỊCH HỌC
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Lịch Sử Thay Đổi Lịch Học</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Bản ghi kiểm toán bất biến cho mọi thao tác sinh lịch, chỉnh sửa lịch cố định, đổi lịch, hủy buổi và xếp học bù.
        </p>
      </div>

      <ScheduleChangeLogsView />
    </div>
  );
}

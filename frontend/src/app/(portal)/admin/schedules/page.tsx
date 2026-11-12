'use client';

import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { ScheduleCalendarView } from '@/features/schedules/components/ScheduleCalendarView';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];

export default function AdminSchedulesPage() {
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
          课表管理 · LỊCH HỌC TOÀN TRUNG TÂM
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Lịch Học &amp; Điểm Danh Toàn Trung Tâm</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Theo dõi lịch giảng dạy theo tháng, tuần hoặc danh sách; đổi lịch, hủy buổi, tạo buổi học bù và kiểm soát điểm danh.
        </p>
      </div>

      <ScheduleCalendarView isAdmin />
    </div>
  );
}

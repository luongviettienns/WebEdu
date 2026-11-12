'use client';

import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { ScheduleCalendarView } from '@/features/schedules/components/ScheduleCalendarView';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['TEACHER'];

export default function TeacherSchedulesPage() {
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
          我的课表 · LỊCH GIẢNG DẠY
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Lịch Dạy &amp; Điểm Danh Lớp Phụ Trách</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Xem toàn bộ buổi dạy của bạn theo tháng, tuần hoặc danh sách và mở điểm danh trực tiếp từ từng buổi học.
        </p>
      </div>

      <ScheduleCalendarView isAdmin={user.roles.includes('ADMIN')} />
    </div>
  );
}

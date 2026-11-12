'use client';

import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { StudentAttendanceView } from '@/features/attendance/components/StudentAttendanceView';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['STUDENT'];

export default function StudentSchedulePage() {
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
          我的课表 · LỊCH HỌC &amp; ĐIỂM DANH
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Lịch Học &amp; Chuyên Cần Cá Nhân</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Theo dõi lịch các buổi học sắp tới, kết quả điểm danh từng buổi và cảnh báo tỷ lệ vắng mặt.
        </p>
      </div>

      <StudentAttendanceView />
    </div>
  );
}

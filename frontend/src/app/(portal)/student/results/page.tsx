'use client';

import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { StudentResultsView } from '@/features/progress/components/StudentResultsView';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['STUDENT'];

export default function StudentResultsPage() {
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
          成绩 · KẾT QUẢ HỌC TẬP
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          Kết quả học tập &amp; Tiến độ
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Theo dõi tiến độ buổi học, điểm các bài kiểm tra đã công bố, chuyên cần và điểm tổng kết khóa học.
        </p>
      </div>

      <StudentResultsView onAuthError={handleApiAuthError} />
    </div>
  );
}

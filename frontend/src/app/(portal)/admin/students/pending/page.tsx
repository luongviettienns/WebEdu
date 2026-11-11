'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { type AuthUserDto } from '@/features/auth/api/auth.api';
import {
  listAvailableClasses,
  listPendingEnrollmentStudents,
  type AvailableClassDto,
  type PendingStudentDto,
} from '@/features/students/api/students.api';
import { AssignInitialClassModal } from '@/features/students/components/AssignInitialClassModal';
import { PendingStudentListTable } from '@/features/students/components/PendingStudentListTable';
import { extractErrorMessage } from '@/lib/api-client';
import { type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];

interface PendingEnrollmentStudentsContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function PendingEnrollmentStudentsContent({
  onAuthError,
}: PendingEnrollmentStudentsContentProps) {
  const [pendingStudents, setPendingStudents] = useState<PendingStudentDto[]>(
    [],
  );
  const [availableClasses, setAvailableClasses] = useState<AvailableClassDto[]>(
    [],
  );
  const [totalPending, setTotalPending] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [targetStudent, setTargetStudent] = useState<PendingStudentDto | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [queueResp, classesResp] = await Promise.all([
          listPendingEnrollmentStudents(undefined, {
            signal: controller.signal,
          }),
          listAvailableClasses({ signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const items = queueResp.items ?? [];
        const classes = classesResp.items ?? [];
        setPendingStudents(items);
        setAvailableClasses(classes);
        setTotalPending(queueResp.totalPending ?? items.length);
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (onAuthError(error)) return;
        setErrorBanner(
          extractErrorMessage(
            error,
            'Không thể tải danh sách tài khoản chờ xếp lớp',
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [refreshTick, onAuthError]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="mb-2">
            <Link
              href="/admin/students"
              className="text-xs font-semibold text-[var(--red)] hover:text-[var(--red-ink)] transition-colors inline-flex items-center gap-1"
            >
              &larr; Quay lại danh sách tất cả học viên
            </Link>
          </div>
          <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
            待分班 · HÀNG ĐỢI XẾP LỚP
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Tài Khoản Chờ Xếp Lớp
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)] font-normal">
            Tài khoản học viên tự đăng ký đang chờ quản trị viên phân công lớp học ban đầu.
          </p>
        </div>
        <span className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-4 py-2 text-sm font-semibold text-[var(--amber)] shadow-xs num">
          Chờ xử lý: <strong>{totalPending}</strong> tài khoản
        </span>
      </div>

      {successBanner && (
        <div
          role="status"
          className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          {successBanner}
        </div>
      )}

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {errorBanner}
        </div>
      )}

      <PendingStudentListTable
        students={pendingStudents}
        loading={loading}
        onAssignClass={setTargetStudent}
      />

      {targetStudent && (
        <AssignInitialClassModal
          targetStudent={targetStudent}
          availableClasses={availableClasses}
          onClose={() => setTargetStudent(null)}
          onSuccess={(studentFullName, assignedClassCode) => {
            setTargetStudent(null);
            setSuccessBanner(
              `Đã xếp học viên ${studentFullName} vào lớp ${assignedClassCode} thành công.`,
            );
            setLoading(true);
            setRefreshTick((t) => t + 1);
          }}
          onAuthError={onAuthError}
        />
      )}
    </div>
  );
}

export default function PendingStudentsPage() {
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
    <PendingEnrollmentStudentsContent
      currentUser={user}
      onAuthError={handleApiAuthError}
    />
  );
}

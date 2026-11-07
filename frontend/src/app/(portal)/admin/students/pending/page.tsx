'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
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
  currentUser,
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
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        currentUser={currentUser}
        pendingCountOverride={totalPending}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2">
              <Link
                href="/admin/students"
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950"
              >
                &larr; Quay lại danh sách tất cả học viên
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-emerald-950">
              Tài Khoản Chờ Xếp Lớp
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tài khoản học viên tự đăng ký đang chờ admin xếp lớp ban đầu (FUNC-008).
            </p>
          </div>
          <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm">
            Chờ xử lý: <strong>{totalPending}</strong> tài khoản
          </span>
        </div>

        {successBanner ? (
          <div
            role="status"
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
          >
            {successBanner}
          </div>
        ) : null}

        {errorBanner ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
          >
            {errorBanner}
          </div>
        ) : null}

        <PendingStudentListTable
          students={pendingStudents}
          loading={loading}
          onAssignClass={setTargetStudent}
        />
      </main>

      {targetStudent ? (
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
      ) : null}
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

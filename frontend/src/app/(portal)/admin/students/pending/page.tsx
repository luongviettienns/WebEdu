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
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy, formatDateTimeVn } from '@/lib/utils/date';
import { type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];

function renderGuardianConsentLabel(
  status: PendingStudentDto['guardianConsentStatus'],
): { label: 'Đã xác nhận' | 'Không áp dụng'; isConfirmed: boolean } {
  if (status === 'CONFIRMED') {
    return { label: 'Đã xác nhận', isConfirmed: true };
  }
  return { label: 'Không áp dụng', isConfirmed: false };
}

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
        if (onAuthError(error)) {
          return;
        }
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
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-emerald-950">
                  Tài Khoản Chờ Xếp Lớp
                </h1>
                <span className="inline-flex items-center rounded-full bg-amber-500 px-3 py-0.5 text-xs font-bold text-white shadow-sm">
                  {totalPending} chờ xếp lớp
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Liên kết tài khoản học viên mới đăng ký vào lớp học chính thức
                để kích hoạt quyền học tập
              </p>
            </div>
          </div>

          <Link
            href="/admin/students"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Quay lại danh sách học viên
          </Link>
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">Họ và tên</th>
                  <th className="px-4 py-3.5">Ngày sinh</th>
                  <th className="px-4 py-3.5">Số điện thoại</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Ngày đăng ký</th>
                  <th className="px-4 py-3.5">Đồng ý cha mẹ</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Đang tải danh sách tài khoản chờ xếp lớp...
                    </td>
                  </tr>
                ) : pendingStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Hiện không có tài khoản học viên nào đang chờ xếp lớp.
                    </td>
                  </tr>
                ) : (
                  pendingStudents.map((student) => {
                    const consentDisplay = renderGuardianConsentLabel(
                      student.guardianConsentStatus,
                    );
                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {student.fullName}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {formatDateDdMmYyyy(student.dateOfBirth)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {student.phone}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {student.email}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {formatDateTimeVn(
                            student.registeredAt ?? student.createdAt,
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              consentDisplay.isConfirmed
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {consentDisplay.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setTargetStudent(student)}
                            className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
                          >
                            Xếp lớp
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {targetStudent ? (
        <AssignInitialClassModal
          targetStudent={targetStudent}
          availableClasses={availableClasses}
          onClose={() => setTargetStudent(null)}
          onAuthError={onAuthError}
          onSuccess={(studentFullName, assignedClassCode) => {
            setTargetStudent(null);
            setSuccessBanner(
              `Đã xếp học viên ${studentFullName} vào lớp ${assignedClassCode} thành công. Trạng thái tài khoản đã chuyển sang Đang hoạt động.`,
            );
            setLoading(true);
            setRefreshTick((t) => t + 1);
          }}
        />
      ) : null}
    </div>
  );
}

export default function PendingEnrollmentStudentsPage() {
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

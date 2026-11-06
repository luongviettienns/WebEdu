'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/components/auth/AccessDeniedState';
import { usePortalSession } from '@/components/auth/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  assignStudentInitialClass,
  AuthUserDto,
  extractErrorMessage,
  formatDateDdMmYyyy,
  formatDateTimeVn,
  listPendingEnrollmentStudents,
  PendingStudentDto,
  Role,
} from '@/lib/auth-api';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'SUPERADMIN'];

const AVAILABLE_CLASSES = [
  { id: 'HSK1-K26-01', label: 'HSK1-K26-01 — HSK 1 Tiêu chuẩn (Đang học)' },
  {
    id: 'HSK1-K26-02',
    label: 'HSK1-K26-02 — HSK 1 Tối 2-4-6 (Sắp khai giảng)',
  },
  { id: 'HSK2-K26-01', label: 'HSK2-K26-01 — HSK 2 Sơ trung cấp (Đang học)' },
  {
    id: 'HSK3-K26-01',
    label: 'HSK3-K26-01 — HSK 3 Trung cấp (Sắp khai giảng)',
  },
  { id: 'GT-CB-01', label: 'GT-CB-01 — Giao tiếp cơ bản (Đang học)' },
];

function getTodayDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
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
  const [totalPending, setTotalPending] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');

  // Popup Xếp lớp
  const [targetStudent, setTargetStudent] = useState<PendingStudentDto | null>(
    null,
  );
  const [selectedClass, setSelectedClass] = useState<string>(
    AVAILABLE_CLASSES[0]?.id ?? 'HSK1-K26-01',
  );
  const [enrolledAt, setEnrolledAt] = useState<string>('');
  const [assignError, setAssignError] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  const reloadPendingQueue = async () => {
    setLoading(true);
    setErrorBanner('');
    try {
      const response = await listPendingEnrollmentStudents();
      const items = response.items ?? [];
      setPendingStudents(items);
      setTotalPending(response.totalPending ?? items.length);
    } catch (error) {
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
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listPendingEnrollmentStudents();
        if (cancelled) return;
        const items = response.items ?? [];
        setPendingStudents(items);
        setTotalPending(response.totalPending ?? items.length);
      } catch (error) {
        if (cancelled) return;
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onAuthError]);

  const openAssignModal = (student: PendingStudentDto) => {
    setTargetStudent(student);
    setSelectedClass(AVAILABLE_CLASSES[0]?.id ?? 'HSK1-K26-01');
    setEnrolledAt(getTodayDateString());
    setAssignError('');
  };

  const handleConfirmAssignClass = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!targetStudent) return;
    setAssignError('');

    if (!selectedClass.trim()) {
      setAssignError('Vui lòng chọn lớp học');
      return;
    }
    if (!enrolledAt) {
      setAssignError('Vui lòng chọn ngày vào lớp');
      return;
    }

    setAssigning(true);
    try {
      await assignStudentInitialClass(targetStudent.id, {
        classNameOrId: selectedClass.trim(),
        enrolledAt,
      });
      setSuccessBanner(
        `Đã xếp học viên ${targetStudent.fullName} vào lớp ${selectedClass} thành công. Trạng thái tài khoản đã chuyển sang Đang hoạt động.`,
      );
      setTargetStudent(null);
      await reloadPendingQueue();
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setAssignError(
        extractErrorMessage(error, 'Không thể xếp lớp cho học viên này'),
      );
    } finally {
      setAssigning(false);
    }
  };

  /**
   * Cột "Đồng ý cha mẹ" chỉ hiển thị "Đã xác nhận" hoặc "Không áp dụng".
   */
  const renderGuardianConsentLabel = (
    status: PendingStudentDto['guardianConsentStatus'],
  ): { label: 'Đã xác nhận' | 'Không áp dụng'; isConfirmed: boolean } => {
    if (status === 'CONFIRMED') {
      return { label: 'Đã xác nhận', isConfirmed: true };
    }
    return { label: 'Không áp dụng', isConfirmed: false };
  };

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
                            onClick={() => openAssignModal(student)}
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

      {/* Popup Xếp lớp */}
      {targetStudent ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-emerald-950">
              Xếp Lớp Cho Học Viên
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Học viên: <strong>{targetStudent.fullName}</strong> (
              {targetStudent.email})
            </p>

            {assignError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                {assignError}
              </div>
            ) : null}

            <form
              onSubmit={(e) => void handleConfirmAssignClass(e)}
              noValidate
              className="mt-4 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="assign-class-select"
                  className="block text-sm font-medium text-slate-800"
                >
                  Lớp học (Sắp khai giảng / Đang học){' '}
                  <span className="text-red-600">*</span>
                </label>
                <select
                  id="assign-class-select"
                  required
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  {AVAILABLE_CLASSES.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="assign-enrolled-date"
                  className="block text-sm font-medium text-slate-800"
                >
                  Ngày vào lớp ({formatDateDdMmYyyy(enrolledAt)}){' '}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="assign-enrolled-date"
                  type="date"
                  required
                  value={enrolledAt}
                  onChange={(e) => setEnrolledAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setTargetStudent(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {assigning ? 'Đang xếp lớp...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

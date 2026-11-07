'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import { type AuthUserDto } from '@/features/auth/api/auth.api';
import {
  listStudents,
  type StudentItemDto,
} from '@/features/students/api/students.api';
import { StudentDetailModal } from '@/features/students/components/StudentDetailModal';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';
import { STATUS_LABELS, type Role } from '@/types/user';

const PAGE_LIMIT = 20;
const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'SUPERADMIN'];

interface AdminStudentsContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function AdminStudentsContent({
  currentUser,
  onAuthError,
}: AdminStudentsContentProps) {
  const [students, setStudents] = useState<StudentItemDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');

  const [selectedStudent, setSelectedStudent] =
    useState<StudentItemDto | null>(null);

  const canManageInternalNotes = currentUser.roles.includes('ADMIN');

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await listStudents(
          {
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            className: classFilter.trim() || undefined,
            page,
            limit: PAGE_LIMIT,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setStudents(response.items ?? []);
        setTotal(
          response.total ?? (response.items ? response.items.length : 0),
        );
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (onAuthError(error)) {
          return;
        }
        setErrorBanner(
          extractErrorMessage(error, 'Không thể tải danh sách học viên'),
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
  }, [search, statusFilter, classFilter, page, refreshTick, onAuthError]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={currentUser} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-950">
              Quản Lý Hồ Sơ Học Viên
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tra cứu thông tin học viên, đối soát xác nhận đồng ý của cha mẹ và
              cập nhật trạng thái tài khoản
            </p>
          </div>
          {canManageInternalNotes ? (
            <Link
              href="/admin/students/pending"
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
            >
              Danh sách chờ xếp lớp
            </Link>
          ) : null}
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setLoading(true);
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo Họ tên, Số điện thoại hoặc Email..."
              className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <input
              type="text"
              value={classFilter}
              onChange={(e) => {
                setLoading(true);
                setClassFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Lọc theo lớp học..."
              className="w-44 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <select
              aria-label="Lọc theo trạng thái tài khoản"
              value={statusFilter}
              onChange={(e) => {
                setLoading(true);
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING_CLASS">Chờ xếp lớp</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Vô hiệu hóa</option>
            </select>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Tổng số: <strong>{total}</strong> học viên
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">STT</th>
                  <th className="px-4 py-3.5">Họ và tên</th>
                  <th className="px-4 py-3.5">Ngày sinh</th>
                  <th className="px-4 py-3.5">Số điện thoại</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Lớp đang học</th>
                  <th className="px-4 py-3.5">Trạng thái tài khoản</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Đang tải danh sách học viên...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Không tìm thấy hồ sơ học viên phù hợp.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-slate-500">
                        {(page - 1) * PAGE_LIMIT + idx + 1}
                      </td>
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
                      <td className="px-4 py-3.5 text-slate-800">
                        {student.assignedClass || (
                          <span className="text-xs italic text-slate-400">
                            Chưa xếp lớp
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            student.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : student.status === 'PENDING_CLASS'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {STATUS_LABELS[student.status] ?? student.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(student)}
                          className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          Chi tiết & Sửa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      </main>

      {selectedStudent ? (
        <StudentDetailModal
          initialStudent={selectedStudent}
          canManageInternalNotes={canManageInternalNotes}
          onClose={() => setSelectedStudent(null)}
          onAuthError={onAuthError}
          onSuccess={(updatedFullName) => {
            setSelectedStudent(null);
            setSuccessBanner(
              `Đã cập nhật hồ sơ học viên ${updatedFullName} thành công`,
            );
            setLoading(true);
            setRefreshTick((t) => t + 1);
          }}
        />
      ) : null}
    </div>
  );
}

export default function AdminStudentsPage() {
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
    <AdminStudentsContent
      currentUser={user}
      onAuthError={handleApiAuthError}
    />
  );
}

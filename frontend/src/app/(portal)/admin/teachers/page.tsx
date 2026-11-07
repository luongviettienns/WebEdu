'use client';

import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import { type AuthUserDto } from '@/features/auth/api/auth.api';
import {
  listTeachers,
  updateTeacher,
  type TeacherItemDto,
} from '@/features/teachers/api/teachers.api';
import { BlockedTeacherDeactivationModal } from '@/features/teachers/components/BlockedTeacherDeactivationModal';
import { TeacherFormModal } from '@/features/teachers/components/TeacherFormModal';
import { extractErrorMessage } from '@/lib/api-client';
import { STATUS_LABELS, type Role, type UserStatus } from '@/types/user';

const PAGE_LIMIT = 20;
const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'SUPERADMIN'];

interface AdminTeachersContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function AdminTeachersContent({
  currentUser,
  onAuthError,
}: AdminTeachersContentProps) {
  const [teachers, setTeachers] = useState<TeacherItemDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');

  const [modalState, setModalState] = useState<{
    mode: 'create' | 'edit' | 'view';
    teacher: TeacherItemDto | null;
  } | null>(null);

  const [blockedTeacherAlert, setBlockedTeacherAlert] = useState<{
    name: string;
    activeClassesCount: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await listTeachers(
          {
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            page,
            limit: PAGE_LIMIT,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setTeachers(response.items ?? []);
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
          extractErrorMessage(error, 'Không thể tải danh sách giáo viên'),
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
  }, [search, statusFilter, page, refreshTick, onAuthError]);

  const handleToggleTeacherStatus = async (teacher: TeacherItemDto) => {
    setErrorBanner('');
    setSuccessBanner('');

    if (teacher.status === 'ACTIVE' && teacher.activeClassesCount > 0) {
      setBlockedTeacherAlert({
        name: teacher.fullName,
        activeClassesCount: teacher.activeClassesCount,
      });
      return;
    }

    const nextStatus: UserStatus =
      teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await updateTeacher(teacher.id, { status: nextStatus });
      setSuccessBanner(
        nextStatus === 'INACTIVE'
          ? `Đã vô hiệu hóa tài khoản giáo viên ${teacher.fullName}`
          : `Đã kích hoạt lại tài khoản giáo viên ${teacher.fullName}`,
      );
      setLoading(true);
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setErrorBanner(
        extractErrorMessage(
          error,
          'Không thể thay đổi trạng thái tài khoản giáo viên',
        ),
      );
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={currentUser} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-950">
              Quản Lý Tài Khoản Giáo Viên
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tạo mới, cập nhật thông tin và quản lý trạng thái hoạt động của
              đội ngũ giảng viên HSK
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalState({ mode: 'create', teacher: null })}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
          >
            + Tạo tài khoản giáo viên
          </button>
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
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <select
              aria-label="Lọc theo trạng thái"
              value={statusFilter}
              onChange={(e) => {
                setLoading(true);
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Vô hiệu hóa</option>
            </select>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Tổng số: <strong>{total}</strong> giáo viên
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
                  <th className="px-4 py-3.5">Số điện thoại</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5 text-center">
                    Số lớp đang phụ trách
                  </th>
                  <th className="px-4 py-3.5">Trạng thái</th>
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
                      Đang tải danh sách giáo viên...
                    </td>
                  </tr>
                ) : teachers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Không tìm thấy giáo viên phù hợp.
                    </td>
                  </tr>
                ) : (
                  teachers.map((teacher, idx) => {
                    const isTeacherAdmin =
                      teacher.isAdmin ||
                      (Array.isArray(teacher.roles) &&
                        teacher.roles.includes('ADMIN'));
                    return (
                      <tr
                        key={teacher.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-medium text-slate-500">
                          {(page - 1) * PAGE_LIMIT + idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {teacher.fullName}
                            </span>
                            {isTeacherAdmin ? (
                              <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">
                                Admin
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {teacher.phone}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {teacher.email}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                          {teacher.activeClassesCount ?? 0}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              teacher.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {STATUS_LABELS[teacher.status] ?? teacher.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setModalState({ mode: 'view', teacher })
                              }
                              className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModalState({ mode: 'edit', teacher })
                              }
                              className="rounded-md px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleTeacherStatus(teacher)
                              }
                              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                                teacher.status === 'ACTIVE'
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {teacher.status === 'ACTIVE'
                                ? 'Vô hiệu hóa'
                                : 'Kích hoạt'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang {page} / {totalPages} (Hiển thị tối đa {PAGE_LIMIT}{' '}
              dòng/trang)
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

      {blockedTeacherAlert ? (
        <BlockedTeacherDeactivationModal
          activeClassesCount={blockedTeacherAlert.activeClassesCount}
          onClose={() => setBlockedTeacherAlert(null)}
        />
      ) : null}

      {modalState ? (
        <TeacherFormModal
          key={`${modalState.mode}-${modalState.teacher?.id ?? 'new'}`}
          mode={modalState.mode}
          selectedTeacher={modalState.teacher}
          onClose={() => setModalState(null)}
          onAuthError={onAuthError}
          onSuccess={(bannerMessage) => {
            setModalState(null);
            setSuccessBanner(bannerMessage);
            setLoading(true);
            setRefreshTick((t) => t + 1);
          }}
        />
      ) : null}
    </div>
  );
}

export default function AdminTeachersPage() {
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
    <AdminTeachersContent
      currentUser={user}
      onAuthError={handleApiAuthError}
    />
  );
}

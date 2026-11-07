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
import { StudentListTable } from '@/features/students/components/StudentListTable';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { extractErrorMessage } from '@/lib/api-client';
import { type Role } from '@/types/user';

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
  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        const response = await listStudents(
          {
            search: debouncedSearch.trim() || undefined,
            status: statusFilter || undefined,
            className: classFilter.trim() || undefined,
            page,
            limit: PAGE_LIMIT,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setStudents(response.items ?? []);
        setTotal(response.total ?? (response.items ? response.items.length : 0));
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (onAuthError(error)) return;
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
  }, [debouncedSearch, statusFilter, classFilter, page, refreshTick, onAuthError]);

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
          <Link
            href="/admin/students/pending"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100 transition-colors"
          >
            📋 Danh sách chờ xếp lớp
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Tìm theo họ tên, email, SĐT..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-72 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <input
              type="text"
              placeholder="Lọc theo lớp..."
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="w-44 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <select
              value={statusFilter}
              aria-label="Lọc theo trạng thái học viên"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="PENDING_CLASS">Chờ xếp lớp</option>
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

        <StudentListTable
          students={students}
          loading={loading}
          page={page}
          total={total}
          pageLimit={PAGE_LIMIT}
          onPageChange={setPage}
          onSelectStudent={setSelectedStudent}
        />
      </main>

      {selectedStudent ? (
        <StudentDetailModal
          initialStudent={selectedStudent}
          canManageInternalNotes={canManageInternalNotes}
          onClose={() => setSelectedStudent(null)}
          onSuccess={(bannerMessage) => {
            setSuccessBanner(bannerMessage);
            setRefreshTick((t) => t + 1);
          }}
          onAuthError={onAuthError}
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

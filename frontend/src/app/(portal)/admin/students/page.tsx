'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
            学员管理 · HỒ SƠ HỌC VIÊN
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
            Quản Lý Hồ Sơ Học Viên
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)] font-normal">
            Tra cứu thông tin học viên, đối soát xác nhận đồng ý của cha mẹ và
            cập nhật trạng thái tài khoản
          </p>
        </div>
        <Link
          href="/admin/students/pending"
          className="rounded-lg border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--amber)] hover:bg-[var(--amber-soft)]/80 transition-colors shadow-xs"
        >
          📋 Danh sách chờ xếp lớp
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Tìm theo họ tên, email, SĐT..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-72 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
          <input
            type="text"
            placeholder="Lọc theo lớp..."
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setPage(1);
            }}
            className="w-44 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
          <select
            value={statusFilter}
            aria-label="Lọc theo trạng thái học viên"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="PENDING_CLASS">Chờ xếp lớp</option>
            <option value="INACTIVE">Vô hiệu hóa</option>
          </select>
        </div>
        <span className="text-xs font-medium text-[var(--ink-3)] num">
          Tổng số: <strong>{total}</strong> học viên
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

      <StudentListTable
        students={students}
        loading={loading}
        page={page}
        total={total}
        pageLimit={PAGE_LIMIT}
        onPageChange={setPage}
        onSelectStudent={setSelectedStudent}
      />

      {selectedStudent && (
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
      )}
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

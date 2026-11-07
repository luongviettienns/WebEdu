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
import { TeacherListTable } from '@/features/teachers/components/TeacherListTable';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { extractErrorMessage } from '@/lib/api-client';
import { type Role, type UserStatus } from '@/types/user';

const PAGE_LIMIT = 20;
const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'SUPERADMIN'];

type ModalState = { mode: 'create' | 'edit' | 'view'; teacher: TeacherItemDto | null } | null;
type BlockedAlert = { name: string; activeClassesCount: number } | null;

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
  const [modalState, setModalState] = useState<ModalState>(null);
  const [blockedTeacherAlert, setBlockedTeacherAlert] = useState<BlockedAlert>(null);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        const response = await listTeachers(
          {
            search: debouncedSearch.trim() || undefined,
            status: statusFilter || undefined,
            page,
            limit: PAGE_LIMIT,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setTeachers(response.items ?? []);
        setTotal(response.total ?? (response.items ? response.items.length : 0));
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (onAuthError(error)) return;
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
  }, [debouncedSearch, statusFilter, page, refreshTick, onAuthError]);

  const handleToggleTeacherStatus = async (teacher: TeacherItemDto) => {
    const nextStatus: UserStatus =
      teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (nextStatus === 'INACTIVE' && (teacher.activeClassesCount ?? 0) > 0) {
      setBlockedTeacherAlert({
        name: teacher.fullName,
        activeClassesCount: teacher.activeClassesCount ?? 0,
      });
      return;
    }

    try {
      setErrorBanner('');
      setSuccessBanner('');
      await updateTeacher(teacher.id, { status: nextStatus });
      setSuccessBanner(
        `Đã ${nextStatus === 'ACTIVE' ? 'kích hoạt' : 'vô hiệu hóa'} giáo viên ${teacher.fullName}`,
      );
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) return;
      const apiMsg = extractErrorMessage(
        error,
        'Không thể cập nhật trạng thái giáo viên',
      );
      if (
        apiMsg.toLowerCase().includes('đang phụ trách') ||
        apiMsg.toLowerCase().includes('lớp')
      ) {
        setBlockedTeacherAlert({
          name: teacher.fullName,
          activeClassesCount: teacher.activeClassesCount || 1,
        });
      } else {
        setErrorBanner(apiMsg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={currentUser} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-950">
              Quản Lý Tài Khoản Giáo Viên
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Quản lý danh sách giáo viên, chuyên môn và trạng thái giảng dạy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalState({ mode: 'create', teacher: null })}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
          >
            + Tạo tài khoản giáo viên
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Tìm theo tên, email, SĐT..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-72 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <select
              value={statusFilter}
              aria-label="Lọc theo trạng thái giáo viên"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Vô hiệu hóa</option>
            </select>
          </div>
        </div>

        {errorBanner ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {errorBanner}
          </div>
        ) : null}

        {successBanner ? (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
          >
            {successBanner}
          </div>
        ) : null}

        <TeacherListTable
          teachers={teachers}
          loading={loading}
          page={page}
          total={total}
          pageLimit={PAGE_LIMIT}
          onPageChange={setPage}
          onView={(teacher) => setModalState({ mode: 'view', teacher })}
          onEdit={(teacher) => setModalState({ mode: 'edit', teacher })}
          onToggleStatus={handleToggleTeacherStatus}
        />
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

  return <AdminTeachersContent currentUser={user} onAuthError={handleApiAuthError} />;
}

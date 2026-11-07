'use client';

import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
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
  _currentUser?: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function AdminTeachersContent({
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
    setErrorBanner('');
    setSuccessBanner('');
    const newStatus: UserStatus =
      teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateTeacher(teacher.id, { status: newStatus });
      setSuccessBanner(
        newStatus === 'ACTIVE'
          ? `Đã kích hoạt lại tài khoản của giáo viên ${teacher.fullName}.`
          : `Đã vô hiệu hóa tài khoản của giáo viên ${teacher.fullName}.`,
      );
      setRefreshTick((t) => t + 1);
    } catch (error: unknown) {
      if (onAuthError(error)) return;
      const apiMsg = extractErrorMessage(
        error,
        'Không thể cập nhật trạng thái giáo viên',
      );
      if (
        newStatus === 'INACTIVE' &&
        (apiMsg.includes('lớp') ||
          apiMsg.includes('phụ trách') ||
          apiMsg.includes('hoạt động'))
      ) {
        setBlockedTeacherAlert({
          name: teacher.fullName,
          activeClassesCount: 1,
        });
      } else {
        setErrorBanner(apiMsg);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
            教师管理 · ĐỘI NGŨ GIÁO VIÊN
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Quản Lý Tài Khoản Giáo Viên
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)] font-normal">
            Quản lý danh sách giáo viên, chuyên môn và trạng thái giảng dạy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalState({ mode: 'create', teacher: null })}
          className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-colors active:scale-[0.98]"
        >
          + Tạo tài khoản giáo viên
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Tìm theo tên, email, SĐT..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-72 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
          <select
            value={statusFilter}
            aria-label="Lọc theo trạng thái giáo viên"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Vô hiệu hóa</option>
          </select>
        </div>
        <span className="text-xs font-medium text-[var(--ink-3)] num">
          Tổng số: <strong>{total}</strong> giáo viên
        </span>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]"
        >
          {errorBanner}
        </div>
      )}

      {successBanner && (
        <div
          role="status"
          className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]"
        >
          {successBanner}
        </div>
      )}

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

      {blockedTeacherAlert && (
        <BlockedTeacherDeactivationModal
          activeClassesCount={blockedTeacherAlert.activeClassesCount}
          onClose={() => setBlockedTeacherAlert(null)}
        />
      )}

      {modalState && (
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
      )}
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

  return <AdminTeachersContent onAuthError={handleApiAuthError} />;
}

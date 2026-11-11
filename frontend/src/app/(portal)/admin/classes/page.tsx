'use client';

import React, { useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import type { ClassItem } from '@/features/classes/api/classes.api';
import { ClassFormModal } from '@/features/classes/components/ClassFormModal';
import { ClassListFilters, ListBanners } from '@/features/classes/components/ClassListFilters';
import { ClassesTableSection } from '@/features/classes/components/ClassesTableSection';
import { useClassList } from '@/features/classes/hooks/useClassList';
import { useCourseOptions } from '@/features/classes/hooks/useCourseOptions';
import { resolveClassListPermissions } from '@/features/classes/permissions/class-permissions';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];

type ModalState = { mode: 'create'; initialData: null } | { mode: 'edit'; initialData: ClassItem } | null;

function AdminClassesContent({
  roles,
  onAuthError,
}: {
  roles: readonly Role[];
  onAuthError: (error: unknown) => boolean;
}) {
  const list = useClassList({ onAuthError });
  const courseOptions = useCourseOptions();
  const permissions = resolveClassListPermissions(roles);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [successBanner, setSuccessBanner] = useState('');
  const [warningBanner, setWarningBanner] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han mb-1 text-xs uppercase tracking-widest text-[var(--red)]">
            班级管理 · QUẢN LÝ LỚP HỌC
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Quản Lý Lớp Học &amp; Phân Công Giảng Dạy</h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Mở lớp học HSK mới, phân công 1 giáo viên phụ trách chính thức và quản lý danh sách học viên theo từng
            lớp.
          </p>
        </div>
        {permissions.canCreateClass ? (
          <button
            type="button"
            onClick={() => setModalState({ mode: 'create', initialData: null })}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[var(--red-ink)]"
          >
            + Mở lớp học mới
          </button>
        ) : null}
      </div>

      <ClassListFilters
        search={list.filters.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Tìm theo mã lớp, tên khóa hoặc giáo viên..."
        status={list.filters.status}
        onStatusChange={list.setStatus}
        includeEnded={list.filters.includeEnded}
        onIncludeEndedChange={list.setIncludeEnded}
        includeEndedLabel="Hiện lớp đã kết thúc"
        courses={courseOptions.courses}
        courseId={list.filters.courseId}
        onCourseChange={list.setCourseId}
        totalLabel={`Tổng: ${list.total} lớp học`}
      />

      {courseOptions.error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-xs font-medium text-[var(--amber)]"
        >
          <span>{courseOptions.error} — bộ lọc khóa học tạm thời chưa dùng được.</span>
          <button
            type="button"
            onClick={courseOptions.retry}
            className="rounded-md border border-[var(--amber)]/40 bg-white px-3 py-1 font-semibold hover:bg-[var(--hover)]"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      <ListBanners
        error={list.error}
        isStale={list.isStale}
        success={successBanner}
        warning={warningBanner}
        onRetry={list.refresh}
        onDismissSuccess={() => setSuccessBanner('')}
        onDismissWarning={() => setWarningBanner('')}
      />

      <ClassesTableSection
        classes={list.items}
        loading={list.loading}
        detailBasePath="/admin/classes"
        hasActiveFilters={list.hasActiveFilters}
        onClearFilters={list.clearFilters}
        emptyTitle="Chưa có lớp học nào được mở"
        emptyDescription="Nhấn “Mở lớp học mới” để tạo lớp HSK đầu tiên."
        canEditClass={permissions.canEditClass}
        onEditClass={(cls) => setModalState({ mode: 'edit', initialData: cls })}
        pagination={{ page: list.page, limit: list.pageSize, total: list.total, onPageChange: list.setPage }}
      />

      {modalState ? (
        <ClassFormModal
          isOpen
          mode={modalState.mode}
          initialData={modalState.initialData}
          onClose={() => setModalState(null)}
          onSuccess={(saved) => {
            const wasCreate = modalState.mode === 'create';
            setModalState(null);
            setSuccessBanner(wasCreate ? `Đã mở lớp học ${saved.code} thành công.` : `Đã cập nhật lớp học ${saved.code}.`);
            setWarningBanner(saved.scheduleConflictWarning ?? '');
            list.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

export default function AdminClassesPage() {
  const { status, user, errorMessage, handleApiAuthError } = usePortalSession(ALLOWED_ROLES);
  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }
  return <AdminClassesContent roles={user.roles} onAuthError={handleApiAuthError} />;
}

'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalProfileSession } from '@/features/auth/hooks/usePortalSession';
import { listClasses } from '@/features/classes/api/classes.api';
import { ClassListFilters, ListBanners } from '@/features/classes/components/ClassListFilters';
import { ClassesTableSection } from '@/features/classes/components/ClassesTableSection';
import { useClassList } from '@/features/classes/hooks/useClassList';
import { resolveClassListPermissions } from '@/features/classes/permissions/class-permissions';
import { StatusTag, getUserStatusTone } from '@/features/common/components/StatusTag';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import { ROLE_LABELS, STATUS_LABELS, type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['TEACHER', 'ADMIN'];

/**
 * Số lớp đang phụ trách (Sắp mở + Đang học) — độc lập bộ lọc/phân trang của bảng:
 * luôn đếm trên toàn bộ lớp của giáo viên từ server.
 */
function useResponsibleClassCount(
  teacherId: string | undefined,
  onAuthError: (error: unknown) => boolean,
  refreshKey: number,
) {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await listClasses({ teacherId, includeEnded: false, page: 1, limit: 1 }, controller.signal);
        if (controller.signal.aborted) return;
        setCount(res.total);
        setFailed(false);
      } catch (error) {
        if (controller.signal.aborted || onAuthError(error)) return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [teacherId, onAuthError, refreshKey]);

  return { count, failed };
}

function TeacherClassesContent({
  profile,
  onAuthError,
}: {
  profile: UserProfileDto;
  onAuthError: (error: unknown) => boolean;
}) {
  const hasAdminRole = resolveClassListPermissions(profile.roles).canViewAllClasses;
  // Tài khoản kiêm Admin: API trả toàn bộ lớp nên khóa cứng theo chính mình để xem "lớp của tôi".
  const fixedTeacherId = hasAdminRole ? profile.id : undefined;
  const list = useClassList({
    fixedTeacherId,
    onAuthError,
    errorFallback: 'Không thể tải danh sách lớp học phụ trách',
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const responsible = useResponsibleClassCount(fixedTeacherId, onAuthError, refreshKey);

  const retry = useCallback(() => {
    list.refresh();
    setRefreshKey((k) => k + 1);
  }, [list]);

  const countText =
    responsible.count !== null ? String(responsible.count) : responsible.failed ? '—' : '…';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han mb-1 text-xs uppercase tracking-widest text-[var(--red)]">教学工作 · LỚP PHỤ TRÁCH</div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Lớp Học Phụ Trách</h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Tổng quan lịch giảng dạy và danh sách các lớp HSK được phân công cho giảng viên
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile.roles.map((role) => (
            <StatusTag key={role} tone="jade" dot={false}>
              {ROLE_LABELS[role] ?? role}
            </StatusTag>
          ))}
          <StatusTag tone={getUserStatusTone(profile.status)}>
            {STATUS_LABELS[profile.status] ?? profile.status}
          </StatusTag>
        </div>
      </div>

      <section aria-label="Tổng quan công tác giảng dạy" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Số lớp đang phụ trách</p>
          <p className="num mt-2 text-3xl font-extrabold text-[var(--jade)]" data-testid="responsible-class-count">
            {countText}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-2)]">
            {responsible.failed
              ? 'Không thể tải số lớp đang phụ trách'
              : responsible.count && responsible.count > 0
                ? 'Sắp mở + đang học, không phụ thuộc bộ lọc bên dưới'
                : 'Chưa có lớp đang mở được phân công'}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Lịch giảng dạy trong tuần</p>
          <p className="mt-2 text-base font-bold text-[var(--ink)]">
            {responsible.count ? 'Theo thời khóa biểu lớp phụ trách' : 'Chưa có ca dạy trong tuần'}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-2)]">Múi giờ chuẩn Việt Nam (GMT+7)</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Giảng viên đăng nhập</p>
          <p className="mt-2 truncate text-base font-bold text-[var(--ink)]">{profile.fullName}</p>
          <p className="num mt-1 truncate text-xs text-[var(--ink-2)]">
            {profile.email} • {profile.phone}
          </p>
        </div>
      </section>

      <ClassListFilters
        search={list.filters.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Tìm theo mã lớp hoặc tên khóa học..."
        status={list.filters.status}
        onStatusChange={list.setStatus}
        includeEnded={list.filters.includeEnded}
        onIncludeEndedChange={list.setIncludeEnded}
        includeEndedLabel="Hiện lớp đã kết thúc (Chỉ xem)"
        totalLabel={`Tổng: ${list.total} lớp học`}
      >
        {hasAdminRole ? (
          <Link
            href="/admin/classes"
            className="rounded-lg bg-[var(--red)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--red-ink)]"
          >
            Quản lý toàn bộ lớp học
          </Link>
        ) : null}
      </ClassListFilters>

      <ListBanners error={list.error} isStale={list.isStale} onRetry={retry} />

      <ClassesTableSection
        classes={list.items}
        loading={list.loading}
        detailBasePath="/teacher/classes"
        showTeacherColumn={false}
        hasActiveFilters={list.hasActiveFilters}
        onClearFilters={list.clearFilters}
        emptyTitle="Hiện chưa có lớp học nào được phân công giảng dạy"
        emptyDescription="Khi bộ phận Giáo vụ mở lớp HSK mới và gán giáo viên phụ trách, thông tin lớp học, danh sách học viên cùng lịch lên lớp sẽ hiển thị đầy đủ tại đây."
        pagination={{ page: list.page, limit: list.pageSize, total: list.total, onPageChange: list.setPage }}
      />
    </div>
  );
}

export default function TeacherClassesPage() {
  const { status, user, errorMessage, handleApiAuthError } = usePortalProfileSession(ALLOWED_ROLES);

  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }

  return <TeacherClassesContent profile={user} onAuthError={handleApiAuthError} />;
}

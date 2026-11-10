'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalProfileSession } from '@/features/auth/hooks/usePortalSession';
import {
  listClasses,
  type ClassItem,
  type ClassStatus,
} from '@/features/classes/api/classes.api';
import { ClassesTableSection } from '@/features/classes/components/ClassesTableSection';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import { extractErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS, STATUS_LABELS, type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['TEACHER', 'ADMIN'];

interface TeacherClassesContentProps {
  profile: UserProfileDto;
  onAuthError: (error: unknown) => boolean;
}

function TeacherClassesContent({
  profile,
  onAuthError,
}: TeacherClassesContentProps) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ClassStatus | ''>('');
  const [includeEnded, setIncludeEnded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');

  const debouncedSearch = useDebounce(search, 300);
  const isDualAdmin = profile.roles.includes('ADMIN');
  const activeClassesCount =
    classes.filter((c) => c.status === 'UPCOMING' || c.status === 'ACTIVE')
      .length ||
    profile.activeClassesCount ||
    0;

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        const res = await listClasses(
          {
            search: debouncedSearch.trim() || undefined,
            status: statusFilter || undefined,
            includeEnded:
              includeEnded ||
              statusFilter === 'COMPLETED' ||
              statusFilter === 'ARCHIVED',
            teacherId: isDualAdmin ? profile.id : undefined,
            limit: 100,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setClasses(res.items ?? []);
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted || onAuthError(error)) return;
        setErrorBanner(
          extractErrorMessage(
            error,
            'Không thể tải danh sách lớp học phụ trách',
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [
    debouncedSearch,
    statusFilter,
    includeEnded,
    isDualAdmin,
    profile.id,
    onAuthError,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
            教学工作 · LỚP PHỤ TRÁCH
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Lớp Học Phụ Trách
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Tổng quan lịch giảng dạy và danh sách các lớp HSK được phân công cho
            giảng viên
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile.roles.map((role) => (
            <span key={role} className="inline-flex items-center rounded-full border border-[var(--jade)]/20 bg-[var(--jade-soft)] px-3 py-1 text-xs font-semibold text-[var(--jade)]">
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${profile.status === 'ACTIVE' ? 'border border-[var(--jade)]/20 bg-[var(--jade-soft)] text-[var(--jade)]' : 'bg-[var(--surface-2)] text-[var(--ink-2)]'}`}>
            {STATUS_LABELS[profile.status] ?? profile.status}
          </span>
        </div>
      </div>

      <section aria-label="Tổng quan công tác giảng dạy" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Số lớp đang phụ trách</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--jade)] num">{activeClassesCount}</p>
          <p className="mt-1 text-xs text-[var(--ink-2)]">
            {activeClassesCount > 0 ? 'Đang trong thời gian giảng dạy' : 'Chưa có lớp đang mở được phân công'}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Lịch giảng dạy trong tuần</p>
          <p className="mt-2 text-base font-bold text-[var(--ink)]">
            {activeClassesCount > 0 ? 'Theo thời khóa biểu lớp phụ trách' : 'Chưa có ca dạy trong tuần'}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-2)]">Múi giờ chuẩn Việt Nam (GMT+7)</p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Giảng viên đăng nhập</p>
          <p className="mt-2 text-base font-bold text-[var(--ink)] truncate">{profile.fullName}</p>
          <p className="mt-1 text-xs text-[var(--ink-2)] truncate num">{profile.email} • {profile.phone}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Tìm theo mã lớp hoặc tên khóa học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none"
          />
          <select
            aria-label="Lọc theo trạng thái lớp"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ClassStatus | '')
            }
            className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="UPCOMING">Sắp mở</option>
            <option value="ACTIVE">Đang học</option>
            <option value="COMPLETED">Đã kết thúc</option>
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ink)]">
            <input
              type="checkbox"
              checked={includeEnded}
              onChange={(e) => setIncludeEnded(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
            />
            <span>Hiện lớp đã kết thúc (Chỉ xem)</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          {isDualAdmin ? (
            <Link
              href="/admin/classes"
              className="rounded-lg bg-[var(--red)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--red-ink)] transition-colors"
            >
              Quản lý toàn bộ lớp học
            </Link>
          ) : null}
        </div>
      </div>

      {errorBanner ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]"
        >
          {errorBanner}
        </div>
      ) : null}

      <ClassesTableSection
        classes={classes}
        loading={loading}
        detailBasePath="/teacher/classes"
        showTeacherColumn={false}
        emptyTitle="Hiện chưa có lớp học nào được phân công giảng dạy"
        emptyDescription="Khi bộ phận Giáo vụ mở lớp HSK mới và gán giáo viên phụ trách, thông tin lớp học, danh sách học viên cùng lịch lên lớp sẽ hiển thị đầy đủ tại đây."
      />
    </div>
  );
}

export default function TeacherClassesPage() {
  const { status, user, errorMessage, handleApiAuthError } =
    usePortalProfileSession(ALLOWED_ROLES);

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
    <TeacherClassesContent
      profile={user}
      onAuthError={handleApiAuthError}
    />
  );
}

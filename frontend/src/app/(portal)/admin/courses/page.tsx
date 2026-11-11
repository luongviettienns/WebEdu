'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import {
  COURSE_LEVEL_OPTIONS,
  listCourses,
  updateCourse,
  type CourseItemDto,
  type CourseLevel,
} from '@/features/courses/api/courses.api';
import { CourseFormModal } from '@/features/courses/components/CourseFormModal';
import { CourseTable } from '@/features/courses/components/CourseTable';
import { ListBanners } from '@/features/classes/components/ClassListFilters';
import { ConfirmDialog } from '@/features/common/components/ConfirmDialog';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { extractErrorMessage } from '@/lib/api-client';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];
type ModalState = { mode: 'create' | 'edit'; course: CourseItemDto | null } | null;

function AdminCoursesContent({ onAuthError }: { onAuthError: (error: unknown) => boolean }) {
  const [courses, setCourses] = useState<CourseItemDto[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<CourseLevel | ''>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [modalState, setModalState] = useState<ModalState>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<CourseItemDto | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        const response = await listCourses(
          { search: debouncedSearch.trim() || undefined, level: levelFilter || undefined },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setCourses(response.items ?? []);
        setLoaded(true);
        setListError('');
      } catch (error) {
        if (controller.signal.aborted || onAuthError(error)) return;
        setListError(extractErrorMessage(error, 'Không thể tải danh mục khóa học HSK'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [debouncedSearch, levelFilter, refreshTick, onAuthError]);

  const filteredCourses = useMemo(() => {
    if (statusFilter === 'ACTIVE') return courses.filter((c) => c.isActive);
    if (statusFilter === 'INACTIVE') return courses.filter((c) => !c.isActive);
    return courses;
  }, [courses, statusFilter]);

  const handleReactivate = async (course: CourseItemDto) => {
    setMutationError('');
    setSuccessBanner('');
    try {
      await updateCourse(course.id, { isActive: true });
      setSuccessBanner(`Đã kích hoạt lại khóa học ${course.code}.`);
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) return;
      setMutationError(extractErrorMessage(error, 'Không thể cập nhật trạng thái khóa học'));
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setMutationError('');
    try {
      await updateCourse(deactivateTarget.id, { isActive: false });
      const code = deactivateTarget.code;
      setDeactivateTarget(null);
      setSuccessBanner(`Đã ngừng sử dụng khóa học ${code} đối với các lớp mở mới.`);
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        setDeactivateTarget(null);
        return;
      }
      throw error;
    }
  };

  const hasFilters = Boolean(search.trim() || levelFilter || statusFilter !== 'ALL');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">课程 · DANH MỤC KHÓA HỌC</div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Quản lý danh mục khóa học HSK</h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">Thiết lập chương trình đào tạo HSK 1–4, Giao tiếp cơ bản và số buổi tiêu chuẩn cho các lớp mở mới.</p>
        </div>
        <button type="button" onClick={() => setModalState({ mode: 'create', course: null })} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-colors">
          + Thêm khóa học
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <input type="search" aria-label="Tìm kiếm khóa học" placeholder="Tìm theo mã khóa hoặc tên khóa học..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-72 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none" />
          <select aria-label="Lọc theo cấp độ khóa học" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as CourseLevel | '')} className="w-full sm:w-auto rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none">
            <option value="">Tất cả cấp độ</option>
            {COURSE_LEVEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select aria-label="Lọc theo trạng thái sử dụng" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')} className="w-full sm:w-auto rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang sử dụng</option>
            <option value="INACTIVE">Ngừng sử dụng</option>
          </select>
        </div>
        <span className="text-xs font-medium text-[var(--ink-3)] num">Hiển thị: <strong>{filteredCourses.length}</strong> khóa học</span>
      </div>

      <ListBanners
        error={listError}
        isStale={loaded}
        success={successBanner}
        onRetry={() => setRefreshTick((t) => t + 1)}
        onDismissSuccess={() => setSuccessBanner('')}
      />

      {mutationError ? (
        <div
          role="alert"
          data-testid="course-mutation-error"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-xs font-medium text-[var(--red-ink)]"
        >
          <span>{mutationError}</span>
          <button
            type="button"
            onClick={() => setMutationError('')}
            className="rounded-md border border-[var(--red)]/30 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--hover)]"
          >
            Đóng
          </button>
        </div>
      ) : null}

      <CourseTable
        loading={loading}
        loaded={loaded}
        courses={filteredCourses}
        hasFilters={hasFilters}
        onClearFilters={() => {
          setSearch('');
          setLevelFilter('');
          setStatusFilter('ALL');
        }}
        onEdit={(course) => setModalState({ mode: 'edit', course })}
        onDeactivate={setDeactivateTarget}
        onReactivate={(course) => void handleReactivate(course)}
      />

      {modalState ? (
        <CourseFormModal
          key={`${modalState.mode}-${modalState.course?.id ?? 'new'}`}
          mode={modalState.mode}
          selectedCourse={modalState.course}
          onClose={() => setModalState(null)}
          onAuthError={onAuthError}
          onSuccess={(msg) => {
            setModalState(null);
            setMutationError('');
            setSuccessBanner(msg);
            setRefreshTick((t) => t + 1);
          }}
        />
      ) : null}

      {deactivateTarget ? (
        <ConfirmDialog
          eyebrow="课程 · NGỪNG SỬ DỤNG KHÓA HỌC"
          title={`Ngừng sử dụng khóa học ${deactivateTarget.code}?`}
          confirmLabel="Xác nhận ngừng sử dụng"
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={handleConfirmDeactivate}
          describeError={(err) => extractErrorMessage(err, 'Không thể cập nhật trạng thái khóa học')}
        >
          Khóa học <strong>{deactivateTarget.code} — {deactivateTarget.name}</strong> sẽ không còn xuất hiện khi mở lớp mới. Các lớp đang mở ({deactivateTarget.activeClassesCount} lớp) và dữ liệu lịch sử vẫn được giữ nguyên.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

export default function AdminCoursesPage() {
  const { status, user, errorMessage, handleApiAuthError } = usePortalSession(ALLOWED_ROLES);
  if (status !== 'authorized' || !user) {
    return <PortalGuardView status={status === 'authorized' ? 'checking' : status} currentUser={user} errorMessage={errorMessage} />;
  }
  return <AdminCoursesContent onAuthError={handleApiAuthError} />;
}

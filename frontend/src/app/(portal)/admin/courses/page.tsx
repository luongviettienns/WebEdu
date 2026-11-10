'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import {
  COURSE_LEVEL_HAN,
  COURSE_LEVEL_OPTIONS,
  listCourses,
  updateCourse,
  type CourseItemDto,
  type CourseLevel,
} from '@/features/courses/api/courses.api';
import { CourseFormModal } from '@/features/courses/components/CourseFormModal';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { extractErrorMessage } from '@/lib/api-client';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];
type ModalState = { mode: 'create' | 'edit'; course: CourseItemDto | null } | null;

function AdminCoursesContent({ onAuthError }: { onAuthError: (error: unknown) => boolean }) {
  const [courses, setCourses] = useState<CourseItemDto[]>([]);
  const [search, setSearch] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<CourseLevel | ''>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');
  const [modalState, setModalState] = useState<ModalState>(null);

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
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted || onAuthError(error)) return;
        setErrorBanner(extractErrorMessage(error, 'Không thể tải danh mục khóa học HSK'));
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

  const handleToggleActive = async (course: CourseItemDto) => {
    setErrorBanner('');
    setSuccessBanner('');
    try {
      const nextActive = !course.isActive;
      await updateCourse(course.id, { isActive: nextActive });
      setSuccessBanner(
        nextActive
          ? `Đã kích hoạt lại khóa học ${course.code}.`
          : `Đã ngừng sử dụng khóa học ${course.code} đối với các lớp mở mới.`,
      );
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) return;
      setErrorBanner(extractErrorMessage(error, 'Không thể cập nhật trạng thái khóa học'));
    }
  };

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
        <div className="flex flex-wrap items-center gap-3">
          <input type="text" placeholder="Tìm theo mã khóa hoặc tên khóa học..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none" />
          <select aria-label="Lọc theo cấp độ khóa học" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as CourseLevel | '')} className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none">
            <option value="">Tất cả cấp độ</option>
            {COURSE_LEVEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select aria-label="Lọc theo trạng thái sử dụng" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')} className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang sử dụng</option>
            <option value="INACTIVE">Ngừng sử dụng</option>
          </select>
        </div>
        <span className="text-xs font-medium text-[var(--ink-3)] num">Hiển thị: <strong>{filteredCourses.length}</strong> khóa học</span>
      </div>

      {errorBanner ? <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]">{errorBanner}</div> : null}
      {successBanner ? <div role="status" className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]">{successBanner}</div> : null}

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th className="px-4 py-3">Mã khóa</th>
                <th className="px-4 py-3">Tên khóa học & Giáo trình</th>
                <th className="px-4 py-3">Cấp độ</th>
                <th className="px-4 py-3 text-center">Số buổi mặc định</th>
                <th className="px-4 py-3 text-center">Lớp đang mở / Tổng lớp</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">Đang tải danh mục khóa học HSK...</td></tr>
              ) : filteredCourses.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">Không tìm thấy khóa học nào phù hợp với bộ lọc.</td></tr>
              ) : (
                filteredCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-[var(--hover)]/60">
                    <td className="px-4 py-3.5 font-bold text-[var(--ink)] num">{course.code}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[var(--ink)]">{course.name}</div>
                      {course.description ? <div className="mt-0.5 text-xs text-[var(--ink-2)]">{course.description}</div> : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--red)]/25 bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)]">
                        <span className="font-han">{COURSE_LEVEL_HAN[course.level]}</span>
                        <span>{course.levelLabel}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-medium text-[var(--ink)] num">
                      {course.defaultSessions ? `${course.defaultSessions} buổi` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-medium text-[var(--ink)] num">
                      <span className="font-bold text-[var(--blue)]">{course.activeClassesCount}</span>{' / '}<span>{course.totalClassesCount}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${course.isActive ? 'bg-[var(--jade-soft)] text-[var(--jade)]' : 'bg-[var(--grey-soft)] text-[var(--grey)]'}`}>
                        {course.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button type="button" onClick={() => setModalState({ mode: 'edit', course })} className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">Chỉnh sửa</button>
                      <button type="button" onClick={() => void handleToggleActive(course)} className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]">
                        {course.isActive ? 'Ngừng sử dụng' : 'Kích hoạt lại'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalState ? (
        <CourseFormModal
          key={`${modalState.mode}-${modalState.course?.id ?? 'new'}`}
          mode={modalState.mode}
          selectedCourse={modalState.course}
          onClose={() => setModalState(null)}
          onAuthError={onAuthError}
          onSuccess={(msg) => {
            setModalState(null);
            setSuccessBanner(msg);
            setRefreshTick((t) => t + 1);
          }}
        />
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

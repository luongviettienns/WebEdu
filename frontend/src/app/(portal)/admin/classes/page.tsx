'use client';

import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import {
  listClasses,
  type ClassItem,
  type ClassStatus,
  type CourseItem,
  type TeacherOptionItem,
} from '@/features/classes/api/classes.api';
import { ClassesTableSection } from '@/features/classes/components/ClassesTableSection';
import { ClassFormModal } from '@/features/classes/components/ClassFormModal';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import { listCourses } from '@/features/courses/api/courses.api';
import { listTeachers } from '@/features/teachers/api/teachers.api';
import { extractErrorMessage } from '@/lib/api-client';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];

type ModalState =
  | { mode: 'create'; initialData: null }
  | { mode: 'edit'; initialData: ClassItem }
  | null;

function AdminClassesContent({
  onAuthError,
}: {
  onAuthError: (error: unknown) => boolean;
}) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOptionItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ClassStatus | ''>('');
  const [includeEnded, setIncludeEnded] = useState<boolean>(false);
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
        const [coursesRes, teachersRes] = await Promise.all([
          listCourses(undefined, { signal: controller.signal }),
          listTeachers({ status: 'ACTIVE', limit: 100 }, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setCourses(coursesRes.items ?? []);
        setTeachers(
          (teachersRes.items ?? []).map((t) => ({
            id: t.id,
            fullName: t.fullName,
            email: t.email,
            activeClassesCount: t.activeClassesCount,
          })),
        );
      } catch (error) {
        if (controller.signal.aborted || onAuthError(error)) return;
      }
    })();
    return () => controller.abort();
  }, [onAuthError, refreshTick]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        const res = await listClasses(
          {
            search: debouncedSearch.trim() || undefined,
            courseId: courseFilter || undefined,
            status: statusFilter || undefined,
            includeEnded:
              includeEnded ||
              statusFilter === 'COMPLETED' ||
              statusFilter === 'ARCHIVED',
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
          extractErrorMessage(error, 'Không thể tải danh sách lớp học'),
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
    courseFilter,
    statusFilter,
    includeEnded,
    refreshTick,
    onAuthError,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
            班级管理 · QUẢN LÝ LỚP HỌC
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Quản Lý Lớp Học & Phân Công Giảng Dạy
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Mở lớp học HSK mới, phân công 1 giáo viên phụ trách chính thức và
            quản lý danh sách học viên theo từng lớp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalState({ mode: 'create', initialData: null })}
          className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-colors"
        >
          + Mở lớp học mới
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Tìm theo mã lớp, tên khóa hoặc giáo viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none"
          />
          <select
            aria-label="Lọc theo khóa học HSK"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
          >
            <option value="">Tất cả khóa học</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
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
            <span>Hiện lớp đã kết thúc</span>
          </label>
        </div>
        <span className="text-xs font-medium text-[var(--ink-3)] num">
          Hiển thị: <strong>{classes.length}</strong> lớp học
        </span>
      </div>

      {errorBanner ? <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]">{errorBanner}</div> : null}
      {successBanner ? <div role="status" className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]">{successBanner}</div> : null}

      <ClassesTableSection
        classes={classes}
        loading={loading}
        detailBasePath="/admin/classes"
        onEditClass={(cls) => setModalState({ mode: 'edit', initialData: cls })}
      />

      {modalState ? (
        <ClassFormModal
          isOpen={Boolean(modalState)}
          mode={modalState.mode}
          initialData={modalState.initialData}
          courses={courses}
          teachers={teachers}
          onClose={() => setModalState(null)}
          onSuccess={(saved) => {
            const wasCreate = modalState.mode === 'create';
            setModalState(null);
            setSuccessBanner(
              wasCreate
                ? `Đã mở lớp học ${saved.code} thành công.`
                : `Đã cập nhật lớp học ${saved.code}.`,
            );
            setRefreshTick((t) => t + 1);
          }}
        />
      ) : null}
    </div>
  );
}

export default function AdminClassesPage() {
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
  return <AdminClassesContent onAuthError={handleApiAuthError} />;
}

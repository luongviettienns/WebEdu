'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import {
  getClassDetail,
  listClasses,
  type ClassDetail,
  type ClassItem,
  type CourseItem,
  type TeacherOptionItem,
} from '@/features/classes/api/classes.api';
import { ClassDetailView } from '@/features/classes/components/ClassDetailView';
import { listCourses } from '@/features/courses/api/courses.api';
import { listTeachers } from '@/features/teachers/api/teachers.api';
import { extractErrorMessage } from '@/lib/api-client';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN'];

function AdminClassDetailContent({
  classId,
  onAuthError,
}: {
  classId: string;
  onAuthError: (error: unknown) => boolean;
}) {
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOptionItem[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [includeInactiveEnrollments, setIncludeInactiveEnrollments] =
    useState<boolean>(true);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');

  useEffect(() => {
    if (!classId) return;
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        const [classDetail, coursesRes, teachersRes, classesRes] =
          await Promise.all([
            getClassDetail(
              classId,
              { includeInactiveEnrollments },
              controller.signal,
            ),
            listCourses(undefined, { signal: controller.signal }),
            listTeachers(
              { status: 'ACTIVE', limit: 100 },
              { signal: controller.signal },
            ),
            listClasses(
              { includeEnded: false, limit: 100 },
              controller.signal,
            ),
          ]);
        if (controller.signal.aborted) return;

        setDetail(classDetail);
        setCourses(coursesRes.items ?? []);
        setTeachers(
          (teachersRes.items ?? []).map((t) => ({
            id: t.id,
            fullName: t.fullName,
            email: t.email,
            activeClassesCount: t.activeClassesCount,
          })),
        );
        setAvailableClasses(classesRes.items ?? []);
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted || onAuthError(error)) return;
        setErrorBanner(
          extractErrorMessage(
            error,
            'Không thể tải thông tin chi tiết lớp học',
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [classId, includeInactiveEnrollments, refreshTick, onAuthError]);

  if (loading && !detail) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]">
        Đang tải thông tin chi tiết lớp học...
      </div>
    );
  }

  if (errorBanner && !detail) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-2xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-6 text-sm font-medium text-[var(--red-ink)]"
        >
          {errorBanner}
        </div>
        <Link
          href="/admin/classes"
          className="inline-flex rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
        >
          ← Quay lại danh sách lớp học
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="space-y-4">
      {successBanner ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]"
        >
          {successBanner}
        </div>
      ) : null}

      <ClassDetailView
        detail={detail}
        viewerRole="ADMIN"
        includeInactiveEnrollments={includeInactiveEnrollments}
        onToggleIncludeInactive={setIncludeInactiveEnrollments}
        courses={courses}
        teachers={teachers}
        availableClasses={availableClasses}
        onRefresh={(msg) => {
          if (msg) setSuccessBanner(msg);
          setRefreshTick((t) => t + 1);
        }}
      />
    </div>
  );
}

export default function AdminClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = typeof params?.id === 'string' ? params.id : '';
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
    <AdminClassDetailContent
      classId={classId}
      onAuthError={handleApiAuthError}
    />
  );
}

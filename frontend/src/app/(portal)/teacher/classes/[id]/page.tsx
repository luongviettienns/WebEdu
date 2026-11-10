'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import {
  getClassDetail,
  type ClassDetail,
} from '@/features/classes/api/classes.api';
import { ClassDetailView } from '@/features/classes/components/ClassDetailView';
import {
  extractErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
} from '@/lib/api-client';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['TEACHER', 'ADMIN'];

function TeacherClassDetailContent({
  classId,
  onAuthError,
}: {
  classId: string;
  onAuthError: (error: unknown) => boolean;
}) {
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [includeInactiveEnrollments, setIncludeInactiveEnrollments] =
    useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [forbiddenMessage, setForbiddenMessage] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');

  useEffect(() => {
    if (!classId) return;
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        const classDetail = await getClassDetail(
          classId,
          { includeInactiveEnrollments },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setDetail(classDetail);
        setForbiddenMessage('');
        setErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isUnauthorizedError(error) && onAuthError(error)) return;
        if (isForbiddenError(error)) {
          setForbiddenMessage(
            extractErrorMessage(
              error,
              'Bạn không được phân công phụ trách lớp học này hoặc lớp đã chuyển giao cho giảng viên khác.',
            ),
          );
          return;
        }
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
  }, [classId, includeInactiveEnrollments, onAuthError]);

  if (loading && !detail && !forbiddenMessage) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]">
        Đang tải thông tin lớp học phụ trách...
      </div>
    );
  }

  if (forbiddenMessage) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded-2xl border border-[var(--red)]/30 bg-white p-8 text-center shadow-xs space-y-4"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--red-soft)] text-[var(--red)] font-bold text-base font-han">
          禁
        </div>
        <h1 className="text-lg font-bold text-[var(--ink)]">
          Không có quyền truy cập lớp học này
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink-2)]">
          {forbiddenMessage}
        </p>
        <div>
          <Link
            href="/teacher/classes"
            className="inline-flex rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] transition-colors"
          >
            ← Quay lại danh sách Lớp học phụ trách
          </Link>
        </div>
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
          href="/teacher/classes"
          className="inline-flex rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
        >
          ← Quay lại danh sách Lớp học phụ trách
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <ClassDetailView
      detail={detail}
      viewerRole="TEACHER"
      includeInactiveEnrollments={includeInactiveEnrollments}
      onToggleIncludeInactive={setIncludeInactiveEnrollments}
    />
  );
}

export default function TeacherClassDetailPage() {
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
    <TeacherClassDetailContent
      classId={classId}
      onAuthError={handleApiAuthError}
    />
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalProfileSession } from '@/features/auth/hooks/usePortalSession';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import {
  getStudentDetail,
  type StudentItemDto,
} from '@/features/students/api/students.api';
import {
  ActiveStudentClassSection,
  AdminAccessNotice,
  PendingClassNotice,
} from '@/features/students/components/StudentOverviewCards';
import { ApiClientError, extractErrorMessage } from '@/lib/api-client';
import { STATUS_LABELS, type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['STUDENT', 'ADMIN'];

interface StudentOverviewContentProps {
  profile: UserProfileDto;
  onAuthError: (error: unknown) => boolean;
}

function StudentOverviewContent({
  profile,
  onAuthError,
}: StudentOverviewContentProps) {
  const isStudentAccount = profile.roles.includes('STUDENT');

  const [studentDetail, setStudentDetail] = useState<StudentItemDto | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState<boolean>(isStudentAccount);
  const [detailError, setDetailError] = useState<string>('');

  useEffect(() => {
    if (!isStudentAccount) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const detail = await getStudentDetail(profile.id, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setStudentDetail(detail);
          setDetailError('');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (onAuthError(error)) return;
        if (error instanceof ApiClientError && error.status === 404) {
          setDetailError('');
        } else {
          setDetailError(
            extractErrorMessage(
              error,
              'Không thể tải chi tiết học tập lúc này. Vui lòng thử lại.',
            ),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isStudentAccount, profile.id, onAuthError]);

  const currentStatus = studentDetail?.status ?? profile.status;
  const assignedClass =
    studentDetail?.assignedClass ?? profile.assignedClass ?? null;
  const enrolledAt = studentDetail?.enrolledAt ?? profile.enrolledAt ?? null;
  const isPendingClass = currentStatus === 'PENDING_CLASS' || !assignedClass;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E0DED5] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[#B5322A] uppercase mb-1">
            个人学情 · TÌNH TRẠNG HỌC TẬP
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C2320]">
            Tình Trạng Học Tập Cá Nhân
          </h1>
          <p className="mt-1 text-sm text-[#5A6460]">
            Theo dõi thông tin lớp học, lịch học và tiến độ học tập tại Trung Tâm TD Hán Ngữ
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold ${
            currentStatus === 'ACTIVE'
              ? 'bg-[#2B7760]/10 text-[#2B7760] border border-[#2B7760]/20'
              : currentStatus === 'PENDING_CLASS'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-[#EAECE6] text-[#5A6460]'
          }`}
        >
          {STATUS_LABELS[currentStatus]}
        </span>
      </div>

      {detailLoading ? (
        <div className="rounded-2xl border border-[#E0DED5] bg-white p-10 text-center text-sm text-[#5A6460]">
          Đang tải dữ liệu học tập cá nhân...
        </div>
      ) : detailError ? (
        <div
          role="alert"
          className="rounded-2xl border border-[#B5322A]/20 bg-[#B5322A]/10 p-6 text-sm font-medium text-[#B5322A]"
        >
          {detailError}
        </div>
      ) : !isStudentAccount ? (
        <AdminAccessNotice />
      ) : isPendingClass ? (
        <PendingClassNotice />
      ) : (
        <ActiveStudentClassSection
          profile={profile}
          studentDetail={studentDetail}
          assignedClass={assignedClass}
          enrolledAt={enrolledAt}
        />
      )}
    </div>
  );
}

export default function StudentOverviewPage() {
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
    <StudentOverviewContent
      profile={user}
      onAuthError={handleApiAuthError}
    />
  );
}

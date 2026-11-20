'use client';

import React, { useEffect, useState } from 'react';
import {
  getMyAssignments,
  type StudentAssignmentListItemDto,
} from '@/features/assignments/api/assignments.api';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalProfileSession } from '@/features/auth/hooks/usePortalSession';
import {
  getMyAttendance,
  type StudentMyAttendance,
} from '@/features/attendance/api/attendance.api';
import { StatusTag, getUserStatusTone } from '@/features/common/components/StatusTag';
import { useWindowEventRefreshTick } from '@/features/common/hooks/useWindowEventRefreshTick';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/features/notifications/utils/notification-time.util';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import { getMyProgress } from '@/features/progress/api/progress.api';
import type { StudentProgressResponseDto } from '@/features/progress/types/progress.types';
import {
  getStudentDetail,
  type StudentItemDto,
} from '@/features/students/api/students.api';
import {
  ActiveStudentClassSection,
  AdminAccessNotice,
  PendingClassNotice,
} from '@/features/students/components/StudentOverviewCards';
import { useBrandConfig } from '@/features/system-settings/hooks/useBrandConfig';
import { ApiClientError, extractErrorMessage } from '@/lib/api-client';
import { STATUS_LABELS, type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['STUDENT', 'ADMIN'];
const STUDENT_OVERVIEW_REFRESH_EVENTS = [NOTIFICATIONS_CHANGED_EVENT] as const;

interface StudentOverviewContentProps {
  profile: UserProfileDto;
  onAuthError: (error: unknown) => boolean;
}

function StudentOverviewContent({
  profile,
  onAuthError,
}: StudentOverviewContentProps) {
  const { centerName } = useBrandConfig();
  const isStudentAccount = profile.roles.includes('STUDENT');

  const [studentDetail, setStudentDetail] = useState<StudentItemDto | null>(
    null,
  );
  const [myAttendance, setMyAttendance] = useState<StudentMyAttendance | null>(
    null,
  );
  const [myAssignments, setMyAssignments] = useState<
    StudentAssignmentListItemDto[]
  >([]);
  const [myProgress, setMyProgress] = useState<StudentProgressResponseDto | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState<boolean>(isStudentAccount);
  const [detailError, setDetailError] = useState<string>('');
  const syncTick = useWindowEventRefreshTick(STUDENT_OVERVIEW_REFRESH_EVENTS);

  useEffect(() => {
    if (!isStudentAccount) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const [detailRes, attendanceRes, assignmentsRes, progressRes] =
          await Promise.allSettled([
            getStudentDetail(profile.id, { signal: controller.signal }),
            getMyAttendance(undefined, controller.signal),
            getMyAssignments({ signal: controller.signal }),
            getMyProgress(undefined, { signal: controller.signal }),
          ]);
        if (controller.signal.aborted) return;

        if (detailRes.status === 'fulfilled') {
          setStudentDetail(detailRes.value);
          setDetailError('');
        } else {
          const error = detailRes.reason;
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
        }

        if (attendanceRes.status === 'fulfilled') {
          setMyAttendance(attendanceRes.value);
        } else {
          setMyAttendance(null);
        }

        if (assignmentsRes.status === 'fulfilled') {
          setMyAssignments(assignmentsRes.value.items ?? []);
        } else {
          setMyAssignments([]);
        }

        if (progressRes.status === 'fulfilled') {
          setMyProgress(progressRes.value);
        } else {
          setMyProgress(null);
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
  }, [isStudentAccount, profile.id, onAuthError, syncTick]);

  const currentStatus = studentDetail?.status ?? profile.status;
  const assignedClass =
    studentDetail?.assignedClass ?? profile.assignedClass ?? null;
  const enrolledAt = studentDetail?.enrolledAt ?? profile.enrolledAt ?? null;
  const isPendingClass = currentStatus === 'PENDING_CLASS' || !assignedClass;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
            概览 · TỔNG QUAN HỌC TẬP
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            Chào {profile.fullName ? profile.fullName.trim().split(/\s+/).slice(-2).join(' ') : 'Học viên'}, hôm nay học gì?
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)] font-normal">
            Theo dõi thông tin lớp học, lịch học và tiến độ học tập tại {centerName}
          </p>
        </div>
        <StatusTag tone={getUserStatusTone(currentStatus)}>
          {STATUS_LABELS[currentStatus]}
        </StatusTag>
      </div>

      {detailLoading ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]">
          Đang tải dữ liệu học tập cá nhân...
        </div>
      ) : detailError ? (
        <div
          role="alert"
          className="rounded-2xl border border-[var(--red)]/20 bg-[var(--red-soft)] p-6 text-sm font-medium text-[var(--red-ink)]"
        >
          {detailError}
        </div>
      ) : !isStudentAccount ? (
        <AdminAccessNotice />
      ) : isPendingClass ? (
        <PendingClassNotice pastClasses={studentDetail?.pastClasses} />
      ) : (
        <ActiveStudentClassSection
          profile={profile}
          studentDetail={studentDetail}
          assignedClass={assignedClass}
          enrolledAt={enrolledAt}
          myAttendance={myAttendance}
          myAssignments={myAssignments}
          myProgress={myProgress}
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

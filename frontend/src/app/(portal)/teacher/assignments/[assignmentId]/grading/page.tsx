'use client';

import { useParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { PaginationBar } from '@/features/common/components/PaginationBar';
import {
  confirmAllGradedSubmissions,
  confirmSubmissionGrade,
  getAssignmentGradingTracker,
  publishConfirmedGrades,
  recordOverdueZero,
  type AssignmentGradingTrackerDto,
  type GradingTrackerFilter,
  type GradingTrackerStudentRowDto,
} from '@/features/grading/api/grading.api';
import {
  GradingTrackerHeader,
  type PendingOverdueZeroTarget,
} from '@/features/grading/components/GradingTrackerHeader';
import { GradingTrackerTable } from '@/features/grading/components/GradingTrackerTable';
import { SubmissionGradingModal } from '@/features/grading/components/SubmissionGradingModal';
import { extractErrorMessage } from '@/lib/api-client';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['TEACHER', 'ADMIN'];

function TeacherGradingWorkspace({
  assignmentId,
  isAdminView,
  onAuthError,
}: {
  assignmentId: string;
  isAdminView: boolean;
  onAuthError: (err: unknown) => boolean;
}) {
  const [filter, setFilter] = useState<GradingTrackerFilter>('ALL');
  const [page, setPage] = useState(1);
  const [tracker, setTracker] = useState<AssignmentGradingTrackerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [pendingOverdueZero, setPendingOverdueZero] = useState<PendingOverdueZeroTarget | null>(
    null,
  );
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getAssignmentGradingTracker(assignmentId, { status: filter, page }, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          const lastPage = Math.max(1, Math.ceil(res.total / res.limit));
          if (page > lastPage) setPage(lastPage);
          else setTracker(res);
        }
      } catch (err) {
        if (controller.signal.aborted || onAuthError(err)) return;
        setError(extractErrorMessage(err, 'Không thể tải bảng theo dõi chấm bài'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [assignmentId, filter, page, reloadTick, onAuthError]);

  const runAction = async (
    key: string,
    fn: () => Promise<string>,
    fallbackError: string,
  ) => {
    setError('');
    setNotice('');
    setBusyAction(key);
    try {
      const msg = await fn();
      setNotice(msg);
      reload();
    } catch (err) {
      if (onAuthError(err)) return;
      setError(extractErrorMessage(err, fallbackError));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {tracker ? (
        <GradingTrackerHeader
          assignment={tracker.assignment}
          summary={tracker.summary}
          isAdminView={isAdminView}
          busyAction={busyAction}
          pendingOverdueZero={pendingOverdueZero}
          onConfirmAll={() =>
            void runAction(
              'confirm-all',
              async () => {
                const res = await confirmAllGradedSubmissions(assignmentId);
                return `Đã xác nhận ${res.confirmedCount} bài nộp (chờ công bố).`;
              },
              'Không thể xác nhận điểm hàng loạt',
            )
          }
          onPublishAllConfirmed={() =>
            void runAction(
              'publish-all',
              async () => {
                const res = await publishConfirmedGrades(assignmentId);
                return `Đã công bố điểm cho ${res.publishedCount} bài (Giữ nguyên ${res.overdueUntouchedCount} học viên quá hạn chưa nộp).`;
              },
              'Không thể công bố điểm',
            )
          }
          onRecordOverdueZeroAll={() =>
            setPendingOverdueZero({ mode: 'ALL', count: tracker.summary.overdueNotSubmittedCount })
          }
          onCancelOverdueZero={() => setPendingOverdueZero(null)}
          onConfirmOverdueZero={() => {
            if (!pendingOverdueZero) return;
            const target = pendingOverdueZero;
            const actionKey = target.mode === 'ALL' ? 'overdue-all' : `overdue-${target.student.studentId}`;
            void runAction(
              actionKey,
              async () => {
                try {
                  if (target.mode === 'ALL') {
                    const res = await recordOverdueZero(assignmentId, {
                      reason: 'Quá hạn chưa nộp bài — giáo viên ghi nhận 0 điểm',
                    });
                    return `Đã ghi nhận 0 điểm cho ${res.recordedCount} học viên quá hạn chưa nộp.`;
                  }
                  await recordOverdueZero(assignmentId, {
                    studentIds: [target.student.studentId],
                    reason: `Học viên ${target.student.fullName} quá hạn chưa nộp — ghi nhận 0 điểm`,
                  });
                  return `Đã ghi nhận 0 điểm cho học viên ${target.student.fullName}.`;
                } finally {
                  setPendingOverdueZero(null);
                }
              },
              target.mode === 'ALL' ? 'Không thể ghi 0 điểm quá hạn' : 'Không thể ghi nhận 0 điểm',
            );
          }}
        />
      ) : null}

      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          {notice}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {error}
        </div>
      ) : null}

      <GradingTrackerTable
        filter={filter}
        students={tracker?.students ?? []}
        totalPoints={tracker?.assignment.totalPoints ?? 0}
        loading={loading}
        busyAction={busyAction}
        onFilterChange={(nextFilter) => { setFilter(nextFilter); setPage(1); }}
        onOpenSubmission={(id) => setActiveSubmissionId(id)}
        onQuickConfirm={(subId) =>
          void runAction(
            `confirm-${subId}`,
            async () => {
              await confirmSubmissionGrade(subId);
              return 'Đã xác nhận điểm bài nộp (Chờ công bố).';
            },
            'Không thể xác nhận điểm',
          )
        }
        onRecordOverdueZeroStudent={(row: GradingTrackerStudentRowDto) =>
          setPendingOverdueZero({ mode: 'STUDENT', student: row })
        }
      />

      {tracker && tracker.total > tracker.limit ? (
        <PaginationBar page={tracker.page} limit={tracker.limit} total={tracker.total}
          loading={loading} itemLabel="học viên" onPageChange={setPage} />
      ) : null}

      <SubmissionGradingModal
        submissionId={activeSubmissionId}
        onClose={() => setActiveSubmissionId(null)}
        onNavigateSubmission={(id) => setActiveSubmissionId(id)}
        onChanged={reload}
      />
    </div>
  );
}

function TeacherAssignmentGradingInner() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = typeof params?.assignmentId === 'string' ? params.assignmentId : '';
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
    <TeacherGradingWorkspace
      assignmentId={assignmentId}
      isAdminView={user.effectiveRole === 'ADMIN'}
      onAuthError={handleApiAuthError}
    />
  );
}

export default function TeacherAssignmentGradingPage() {
  return (
    <Suspense fallback={<PortalGuardView status="checking" currentUser={null} errorMessage="" />}>
      <TeacherAssignmentGradingInner />
    </Suspense>
  );
}

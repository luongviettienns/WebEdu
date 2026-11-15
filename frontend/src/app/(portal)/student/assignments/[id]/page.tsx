'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';
import { StudentExamRunner } from '@/features/assignments/components/StudentExamRunner';
import { StudentSubmittedView } from '@/features/assignments/components/StudentSubmittedView';
import { useStudentExamSession } from '@/features/assignments/hooks/useStudentExamSession';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['STUDENT'];

function StudentAssignmentWorkspace({
  assignmentId,
  mode,
}: {
  assignmentId: string;
  mode: string | null;
}) {
  const exam = useStudentExamSession(assignmentId, mode);

  if (exam.viewMode === 'loading') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]"
      >
        Đang chuẩn bị bài làm...
      </div>
    );
  }

  if (exam.viewMode === 'error' || !exam.session) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[var(--red)]/30 bg-white p-8 text-center shadow-xs">
        <div className="font-han mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--red-soft)] text-base font-bold text-[var(--red)]">
          误
        </div>
        <h1 className="text-lg font-bold text-[var(--ink)]">Không thể mở bài làm</h1>
        <p role="alert" className="text-sm text-[var(--red-ink)]">
          {exam.errorMessage || 'Bài tập không tồn tại hoặc không thuộc quyền truy cập của bạn.'}
        </p>
        <Link
          href="/student/assignments"
          className="inline-flex rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)]"
        >
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  if (exam.viewMode === 'review') {
    return <StudentSubmittedView session={exam.session} />;
  }

  return (
    <StudentExamRunner
      session={exam.session}
      answers={exam.answers}
      audioPlayCounts={exam.audioPlayCounts}
      flaggedIds={exam.flaggedIds}
      currentIndex={exam.currentIndex}
      remainingSeconds={exam.remainingSeconds}
      saveState={exam.saveState}
      lastSavedText={exam.lastSavedText}
      actionError={exam.actionError}
      submitting={exam.submitting}
      isOffline={exam.isOffline}
      onSelectQuestion={exam.selectQuestion}
      onToggleFlag={exam.toggleFlag}
      onUpdateAnswer={exam.updateAnswer}
      onAudioPlay={exam.recordAudioPlay}
      onSaveDraft={() => void exam.saveDraftNow()}
      onSubmit={() => void exam.submitNow(false)}
    />
  );
}

function StudentAssignmentDetailInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const assignmentId = typeof params?.id === 'string' ? params.id : '';
  const mode = searchParams.get('mode');
  const { status, user, errorMessage } = usePortalSession(ALLOWED_ROLES);

  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }

  return <StudentAssignmentWorkspace assignmentId={assignmentId} mode={mode} />;
}

export default function StudentAssignmentDetailPage() {
  return (
    <Suspense fallback={<PortalGuardView status="checking" currentUser={null} errorMessage="" />}>
      <StudentAssignmentDetailInner />
    </Suspense>
  );
}

'use client';

import React, { useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { AssessmentEditor } from '@/features/assessments/components/AssessmentEditor';
import { AssessmentList } from '@/features/assessments/components/AssessmentList';
import { ImportReviewPane } from '@/features/assessments/components/ImportReviewPane';
import { ImportUploadPane } from '@/features/assessments/components/ImportUploadPane';
import { useAssessments } from '@/features/assessments/hooks/useAssessments';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'TEACHER'];

type View =
  | { mode: 'list' }
  | { mode: 'edit'; id: string | null }
  | { mode: 'review'; id: string }
  | { mode: 'upload' };

function AssessmentsContent() {
  const bank = useAssessments();
  const [view, setView] = useState<View>({ mode: 'list' });

  if (view.mode === 'edit') {
    return (
      <AssessmentEditor
        assessmentId={view.id}
        courses={bank.courses}
        onBack={() => {
          setView({ mode: 'list' });
          bank.reload();
        }}
      />
    );
  }

  if (view.mode === 'upload') {
    return (
      <ImportUploadPane
        courses={bank.courses}
        onBack={() => setView({ mode: 'list' })}
        onImported={(id) => setView({ mode: 'review', id })}
      />
    );
  }

  if (view.mode === 'review') {
    return (
      <ImportReviewPane
        assessmentId={view.id}
        onBack={() => {
          setView({ mode: 'list' });
          bank.reload();
        }}
        onPublished={() => {
          setView({ mode: 'list' });
          bank.reload();
        }}
      />
    );
  }

  return (
    <>
      {bank.error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-ink)]">
          {bank.error}
        </div>
      ) : null}
      <AssessmentList
        items={bank.items}
        courses={bank.courses}
        search={bank.search}
        type={bank.type}
        courseId={bank.courseId}
        status={bank.status}
        loading={bank.loading}
        page={bank.page}
        limit={bank.limit}
        total={bank.total}
        onSearch={bank.setSearch}
        onType={bank.setType}
        onCourse={bank.setCourseId}
        onStatus={bank.setStatus}
        onPage={bank.setPage}
        onCreate={() => setView({ mode: 'edit', id: null })}
        onOpen={(id) => setView({ mode: 'edit', id })}
        onReview={(id) => setView({ mode: 'review', id })}
        onUpload={() => setView({ mode: 'upload' })}
        onChanged={bank.reload}
      />
    </>
  );
}

export default function TeacherAssessmentsPage() {
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

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <div className="font-han mb-1 text-xs uppercase tracking-widest text-[var(--red)]">题库 · NGÂN HÀNG ĐỀ</div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Ngân hàng đề</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Tạo đề thủ công hoặc tải Word/PDF, duyệt câu nhận diện rồi mới phát hành.
        </p>
      </div>
      <AssessmentsContent />
    </div>
  );
}

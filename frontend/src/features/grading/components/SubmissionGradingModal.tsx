'use client';

import React, { useRef, useState } from 'react';
import { useDialogFocusTrap } from '@/features/common/components/BaseDialog';
import { StatusTag } from '@/features/common/components/StatusTag';
import { AdjustGradeDialog } from '@/features/grading/components/AdjustGradeDialog';
import { GradeAuditLogList } from '@/features/grading/components/GradeAuditLogList';
import { GradingQuestionCard } from '@/features/grading/components/GradingQuestionCard';
import { useSubmissionGradingDetail } from '@/features/grading/hooks/useSubmissionGradingDetail';
import { formatUpdatedGradeBadge } from '@/features/grading/utils/grading-status';

interface SubmissionGradingModalProps {
  submissionId: string | null;
  onClose: () => void;
  onNavigateSubmission: (nextId: string) => void;
  onChanged: () => void;
}

export function SubmissionGradingModal({
  submissionId,
  onClose,
  onNavigateSubmission,
  onChanged,
}: SubmissionGradingModalProps) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const g = useSubmissionGradingDetail(submissionId, onChanged);
  useDialogFocusTrap(panelRef, onClose, Boolean(g.busy), Boolean(submissionId) && !adjustOpen);

  if (!submissionId) return null;

  const detail = g.detail;
  const canEditManually =
    detail?.submission.status === 'SUBMITTED_WAITING' ||
    detail?.submission.status === 'AUTO_GRADED_PENDING_REVIEW';
  const canAdjust =
    detail?.submission.status === 'GRADED' || detail?.submission.status === 'RETURNED';
  const updatedBadge = formatUpdatedGradeBadge(detail?.submission.gradeUpdatedAt);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !g.busy && !adjustOpen) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chấm bài nộp học viên"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl focus:outline-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[var(--ink)]">
              {detail ? `Chấm bài: ${detail.student.fullName}` : 'Đang tải chi tiết bài làm...'}
            </h2>
            {detail ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-2)]">
                <span>{detail.student.email}</span>
                <span>·</span>
                <StatusTag tone="blue">{detail.submission.displayStatusLabel}</StatusTag>
                {updatedBadge ? <StatusTag tone="amber">{updatedBadge}</StatusTag> : null}
                <span className="num font-bold text-[var(--ink)]">
                  Tổng: {detail.submission.totalScore ?? '—'} / {detail.assignment.totalPoints} đ
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!detail?.navigation.prevSubmissionId}
              onClick={() =>
                detail?.navigation.prevSubmissionId &&
                onNavigateSubmission(detail.navigation.prevSubmissionId)
              }
              className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] disabled:opacity-40"
            >
              ← Bài trước
            </button>
            <button
              type="button"
              disabled={!detail?.navigation.nextSubmissionId}
              onClick={() =>
                detail?.navigation.nextSubmissionId &&
                onNavigateSubmission(detail.navigation.nextSubmissionId)
              }
              className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] disabled:opacity-40"
            >
              Bài sau →
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {g.notice ? (
            <div
              role="status"
              className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3 text-xs font-medium text-[var(--jade)]"
            >
              {g.notice}
            </div>
          ) : null}
          {g.error ? (
            <div
              role="alert"
              className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
            >
              {g.error}
            </div>
          ) : null}

          {g.loading && !detail ? (
            <div className="py-12 text-center text-sm text-[var(--ink-2)]">
              Đang tải câu hỏi và bài làm...
            </div>
          ) : detail ? (
            <>
              <div className="space-y-4">
                {detail.questions.map((q) => (
                  <GradingQuestionCard
                    key={q.questionId}
                    assignmentId={detail.assignment.id}
                    question={q}
                    scoreValue={g.scores[q.questionId] ?? ''}
                    commentValue={g.comments[q.questionId] ?? ''}
                    canEditManually={Boolean(canEditManually)}
                    aiLoading={g.busy === `ai-${q.questionId}` || g.busy === 'ai-all'}
                    onScoreChange={(v) => g.setScores((p) => ({ ...p, [q.questionId]: v }))}
                    onCommentChange={(v) => g.setComments((p) => ({ ...p, [q.questionId]: v }))}
                    onRequestAi={() => void g.handleRequestAi(q.questionId)}
                    onApplyAi={(pts, fb) => {
                      g.setScores((p) => ({ ...p, [q.questionId]: String(pts) }));
                      if (fb) g.setComments((p) => ({ ...p, [q.questionId]: fb }));
                    }}
                  />
                ))}
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                <label
                  htmlFor="submission-teacher-feedback"
                  className="block text-xs font-bold uppercase text-[var(--ink-2)]"
                >
                  Nhận xét chung của giáo viên
                </label>
                <textarea
                  id="submission-teacher-feedback"
                  rows={2}
                  disabled={!canEditManually}
                  value={g.teacherFeedback}
                  onChange={(e) => g.setTeacherFeedback(e.target.value)}
                  placeholder="Nhập nhận xét tổng kết cho toàn bài..."
                  className="mt-2 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] disabled:bg-[var(--surface-2)]"
                />
              </div>

              <GradeAuditLogList logs={detail.auditLogs} />
            </>
          ) : null}
        </div>

        {detail ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-white px-5 py-3.5">
            <div className="flex flex-wrap gap-2">
              {canEditManually && detail.assignment.hasSubjectiveQuestions ? (
                <button
                  type="button"
                  disabled={Boolean(g.busy)}
                  onClick={() => void g.handleRequestAi()}
                  className="rounded-lg border border-[var(--blue)] bg-white px-3 py-2 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)] disabled:opacity-50"
                >
                  {g.busy === 'ai-all' ? 'Đang hỏi AI...' : 'Gợi ý AI toàn bài'}
                </button>
              ) : null}
              {canAdjust ? (
                <button
                  id="btn-open-adjust-grade"
                  type="button"
                  disabled={Boolean(g.busy)}
                  onClick={() => setAdjustOpen(true)}
                  className="rounded-lg border border-[var(--amber)] bg-[var(--amber-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--amber)] hover:opacity-90"
                >
                  Chỉnh sửa điểm (Bắt buộc lý do)
                </button>
              ) : null}
            </div>

            {canEditManually ? (
              <div className="flex flex-wrap items-center gap-2">
                {g.hasUnsavedChanges ? (
                  <span className="text-xs font-medium text-[var(--amber)]">
                    Lưu nháp trước khi xác nhận điểm
                  </span>
                ) : null}
                <button
                  id="btn-save-manual-grade"
                  type="button"
                  disabled={Boolean(g.busy)}
                  onClick={() => void g.handleSaveDraft()}
                  className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-50"
                >
                  {g.busy === 'save' ? 'Đang lưu...' : 'Lưu điểm & Nhận xét'}
                </button>
                <button
                  id="btn-confirm-submission-grade"
                  type="button"
                  disabled={Boolean(g.busy) || g.hasUnsavedChanges}
                  title={
                    g.hasUnsavedChanges
                      ? 'Vui lòng nhấn "Lưu điểm & Nhận xét" trước khi xác nhận điểm'
                      : undefined
                  }
                  onClick={() => void g.handleConfirmGrade()}
                  className="rounded-lg bg-[var(--blue)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {g.busy === 'confirm' ? 'Đang xác nhận...' : 'Xác nhận điểm (Bước 1)'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {detail && adjustOpen ? (
        <AdjustGradeDialog
          open={adjustOpen}
          detail={detail}
          onClose={() => setAdjustOpen(false)}
          onAdjusted={() => {
            setAdjustOpen(false);
            g.setNotice('Đã cập nhật điểm và ghi nhật ký kiểm toán.');
            g.reloadDetail();
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

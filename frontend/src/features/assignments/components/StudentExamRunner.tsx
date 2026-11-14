'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import {
  ASSESSMENT_TYPE_LABELS,
  QUESTION_TYPE_LABELS,
  type QuestionType,
} from '@/features/assessments/api/assessments.api';
import type {
  StudentAnswerPayload,
  StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import { StudentExamSidebar } from '@/features/assignments/components/StudentExamSidebar';
import { StudentQuestionBody } from '@/features/assignments/components/StudentQuestionBody';
import { SubmitConfirmModal } from '@/features/assignments/components/SubmitConfirmModal';
import type { ExamSaveState } from '@/features/assignments/hooks/useStudentExamSession';
import { isQuestionAnswered } from '@/features/assignments/utils/exam-draft';
import { StatusTag } from '@/features/common/components/StatusTag';
import { formatDateTimeVn } from '@/lib/utils/date';

export interface StudentExamRunnerProps {
  session: StudentExamSessionDto;
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
  flaggedIds: Record<string, boolean>;
  currentIndex: number;
  remainingSeconds: number | null;
  saveState: ExamSaveState;
  lastSavedText: string;
  actionError: string;
  submitting: boolean;
  isOffline: boolean;
  onSelectQuestion: (index: number) => void;
  onToggleFlag: (questionId: string) => void;
  onUpdateAnswer: (questionId: string, type: QuestionType, payload: StudentAnswerPayload) => void;
  onAudioPlay: (questionId: string) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export function StudentExamRunner({
  session,
  answers,
  audioPlayCounts,
  flaggedIds,
  currentIndex,
  remainingSeconds,
  saveState,
  lastSavedText,
  actionError,
  submitting,
  isOffline,
  onSelectQuestion,
  onToggleFlag,
  onUpdateAnswer,
  onAudioPlay,
  onSaveDraft,
  onSubmit,
}: StudentExamRunnerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const questions = session.questions;
  const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, questions.length - 1));
  const currentQuestion = questions[safeIndex];
  const answeredCount = questions.filter((q) => isQuestionAnswered(q, answers[q.id])).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="space-y-1">
          <Link
            href="/student/assignments"
            className="inline-flex text-xs font-semibold text-[var(--blue)] hover:underline"
          >
            ← Quay lại danh sách bài tập
          </Link>
          <div className="font-han text-xs uppercase tracking-widest text-[var(--red)]">
            在线测验 · ĐANG LÀM BÀI
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            {session.assignment.assessmentTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-2)]">
            <span>{session.assignment.classCode}</span>
            <span>·</span>
            <span>{ASSESSMENT_TYPE_LABELS[session.assignment.assessmentType]}</span>
            <span>·</span>
            <span className="num">Hạn nộp: {formatDateTimeVn(session.assignment.dueAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.submission.attemptNumber > 1 ? (
            <StatusTag tone="amber">Lần làm {session.submission.attemptNumber}</StatusTag>
          ) : null}
          <StatusTag tone="blue">{session.submission.displayStatusLabel}</StatusTag>
        </div>
      </div>

      {session.submission.reopenReason ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] p-3.5 text-xs font-medium text-[var(--amber)]"
        >
          Giáo viên đã mở lại lượt làm: {session.submission.reopenReason}
        </div>
      ) : null}

      {session.assignment.instructions ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3.5 text-xs text-[var(--ink-2)]">
          <strong className="text-[var(--ink)]">Hướng dẫn:</strong> {session.assignment.instructions}
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-8">
          {currentQuestion ? (
            <div className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num rounded-md bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
                    Câu {safeIndex + 1} / {questions.length}
                  </span>
                  <StatusTag tone="outline" dot={false}>
                    {QUESTION_TYPE_LABELS[currentQuestion.type]}
                  </StatusTag>
                  <span className="num text-xs font-semibold text-[var(--ink-2)]">
                    {currentQuestion.points} điểm
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFlag(currentQuestion.id)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    flaggedIds[currentQuestion.id]
                      ? 'border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]'
                      : 'border-[var(--line-2)] bg-white text-[var(--ink-2)] hover:bg-[var(--hover)]'
                  }`}
                >
                  {flaggedIds[currentQuestion.id] ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại'}
                </button>
              </div>

              <div className="whitespace-pre-line text-base font-medium leading-relaxed text-[var(--ink)]">
                {currentQuestion.prompt}
              </div>

              <StudentQuestionBody
                key={currentQuestion.id}
                question={currentQuestion}
                assignmentId={session.assignment.assignmentId}
                answer={answers[currentQuestion.id]}
                audioPlayCount={audioPlayCounts[currentQuestion.id] ?? 0}
                onChangeAnswer={(payload) =>
                  onUpdateAnswer(currentQuestion.id, currentQuestion.type, payload)
                }
                onAudioPlay={() => onAudioPlay(currentQuestion.id)}
              />

              <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  disabled={safeIndex === 0}
                  onClick={() => onSelectQuestion(safeIndex - 1)}
                  className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-40"
                >
                  Câu trước
                </button>
                <button
                  type="button"
                  disabled={safeIndex >= questions.length - 1}
                  onClick={() => onSelectQuestion(safeIndex + 1)}
                  className="rounded-lg border border-[var(--blue)] bg-white px-4 py-2 text-sm font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)] disabled:opacity-40"
                >
                  Câu tiếp
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <div className="lg:col-span-4">
          <StudentExamSidebar
            questions={questions}
            answers={answers}
            flaggedIds={flaggedIds}
            currentIndex={safeIndex}
            remainingSeconds={remainingSeconds}
            saveState={saveState}
            lastSavedText={lastSavedText}
            isOffline={isOffline}
            submitting={submitting}
            onSelectQuestion={onSelectQuestion}
            onSaveDraft={onSaveDraft}
            onRequestSubmit={() => setConfirmOpen(true)}
          />
        </div>
      </div>

      <SubmitConfirmModal
        open={confirmOpen}
        answeredCount={answeredCount}
        totalQuestions={questions.length}
        submitting={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onSubmit();
        }}
      />
    </div>
  );
}

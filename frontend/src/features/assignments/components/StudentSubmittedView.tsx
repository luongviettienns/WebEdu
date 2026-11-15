'use client';

import Link from 'next/link';
import React from 'react';
import {
  ASSESSMENT_TYPE_LABELS,
  QUESTION_TYPE_LABELS,
} from '@/features/assessments/api/assessments.api';
import {
  getAssignmentStatusTone,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import { StudentQuestionBody } from '@/features/assignments/components/StudentQuestionBody';
import { StatusTag } from '@/features/common/components/StatusTag';
import { formatDateTimeVn } from '@/lib/utils/date';

export interface StudentSubmittedViewProps {
  session: StudentExamSessionDto;
}

export function StudentSubmittedView({ session }: StudentSubmittedViewProps) {
  const answerMap = new Map<string, { payload: StudentAnswerPayload; audioPlayCount: number }>();
  for (const ans of session.answers) {
    answerMap.set(ans.questionId, {
      payload: ans.answerPayload,
      audioPlayCount: ans.audioPlayCount,
    });
  }

  const { assignment, submission, questions } = session;
  const showScore =
    (submission.status === 'GRADED' || submission.status === 'RETURNED') &&
    assignment.totalScore !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div className="space-y-1">
          <Link
            href="/student/assignments"
            className="inline-flex text-xs font-semibold text-[var(--blue)] hover:underline"
          >
            ← Quay lại danh sách bài tập
          </Link>
          <div className="font-han text-xs uppercase tracking-widest text-[var(--red)]">
            已交答卷 · XEM BÀI NỘP
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            {assignment.assessmentTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-2)]">
            <span>{assignment.classCode}</span>
            <span>·</span>
            <span>{ASSESSMENT_TYPE_LABELS[assignment.assessmentType]}</span>
            <span>·</span>
            <span className="num">
              Nộp lúc: {submission.submittedAt ? formatDateTimeVn(submission.submittedAt) : '—'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusTag tone="outline" dot={false}>
            Lần làm {submission.attemptNumber}
          </StatusTag>
          <StatusTag tone={getAssignmentStatusTone(submission.status)}>
            {submission.displayStatusLabel}
          </StatusTag>
        </div>
      </div>

      {submission.status === 'SUBMITTED_WAITING' ||
      submission.status === 'AUTO_GRADED_PENDING_REVIEW' ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--amber)]/35 bg-[var(--amber-soft)] p-4 text-sm font-medium text-[var(--amber)]"
        >
          Bài đã nộp, đang chờ giáo viên chấm
          {submission.autoSubmitted ? ' (Hệ thống tự động nộp khi hết thời gian).' : '.'}
        </div>
      ) : null}

      {showScore ? (
        <div className="rounded-2xl border border-[var(--jade)]/30 bg-[var(--jade-soft)]/60 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--jade)]">Điểm tổng kết</span>
            <span className="num text-2xl font-bold text-[var(--jade)]">
              {assignment.totalScore} / {assignment.totalPoints} điểm
            </span>
          </div>
          {assignment.teacherFeedback ? (
            <p className="mt-2 text-sm text-[var(--ink)]">
              <strong>Nhận xét của giáo viên:</strong> {assignment.teacherFeedback}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {questions.map((q, idx) => {
          const entry = answerMap.get(q.id);
          return (
            <article
              key={q.id}
              className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num rounded-md bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
                    Câu {idx + 1}
                  </span>
                  <StatusTag tone="outline" dot={false}>
                    {QUESTION_TYPE_LABELS[q.type]}
                  </StatusTag>
                </div>
                <span className="num text-xs font-semibold text-[var(--ink-2)]">{q.points} điểm</span>
              </div>
              <p className="whitespace-pre-line text-base font-medium text-[var(--ink)]">{q.prompt}</p>
              <StudentQuestionBody
                question={q}
                assignmentId={assignment.assignmentId}
                answer={entry?.payload}
                audioPlayCount={entry?.audioPlayCount ?? 0}
                readOnly
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

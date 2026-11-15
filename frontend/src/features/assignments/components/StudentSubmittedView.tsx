'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import {
  ASSESSMENT_TYPE_LABELS,
  QUESTION_TYPE_LABELS,
} from '@/features/assessments/api/assessments.api';
import {
  getAssignmentStatusTone,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import { PublishedQuestionReviewCard } from '@/features/assignments/components/PublishedQuestionReviewCard';
import { StudentQuestionBody } from '@/features/assignments/components/StudentQuestionBody';
import { StatusTag } from '@/features/common/components/StatusTag';
import {
  getStudentPublishedResult,
  type StudentPublishedResultResponseDto,
} from '@/features/grading/api/grading.api';
import {
  formatUpdatedGradeBadge,
  isStudentScoreVisible,
  isWaitingForTeacherGrading,
} from '@/features/grading/utils/grading-status';
import { formatDateTimeVn } from '@/lib/utils/date';

export interface StudentSubmittedViewProps {
  session: StudentExamSessionDto;
}

export function StudentSubmittedView({ session }: StudentSubmittedViewProps) {
  const { assignment, submission, questions } = session;
  const published = isStudentScoreVisible(submission.status);
  const waitingForPublication = isWaitingForTeacherGrading(submission.status);

  const [publishedData, setPublishedData] =
    useState<StudentPublishedResultResponseDto | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  useEffect(() => {
    if (!published) return;
    const controller = new AbortController();
    void (async () => {
      setLoadingResult(true);
      try {
        const res = await getStudentPublishedResult(assignment.assignmentId, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setPublishedData(res);
      } catch {
        // Giữ fallback tóm tắt bài nộp nếu không tải được chi tiết
      } finally {
        if (!controller.signal.aborted) setLoadingResult(false);
      }
    })();
    return () => controller.abort();
  }, [assignment.assignmentId, published]);

  const answerMap = new Map<string, { payload: StudentAnswerPayload; audioPlayCount: number }>();
  for (const ans of session.answers) {
    answerMap.set(ans.questionId, {
      payload: ans.answerPayload,
      audioPlayCount: ans.audioPlayCount,
    });
  }

  const publishedResult =
    published && publishedData?.isPublished ? publishedData.result : null;
  const displayedTotalScore = publishedResult?.totalScore ?? assignment.totalScore;
  const displayedMaxScore = publishedResult?.maxScore ?? assignment.totalPoints;
  const displayedFeedback = publishedResult?.teacherFeedback ?? assignment.teacherFeedback;
  const updatedBadge = formatUpdatedGradeBadge(publishedResult?.gradeUpdatedAt);

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
          {updatedBadge ? <StatusTag tone="blue">{updatedBadge}</StatusTag> : null}
          <StatusTag tone={getAssignmentStatusTone(submission.status)}>
            {submission.status === 'GRADED' ? 'Đã nộp - Chờ công bố' : submission.displayStatusLabel}
          </StatusTag>
        </div>
      </div>

      {waitingForPublication ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--amber)]/35 bg-[var(--amber-soft)] p-4 text-sm font-medium text-[var(--amber)]"
        >
          <p>
            Bài đã nộp, đang chờ giáo viên chấm
            {submission.autoSubmitted ? ' (Hệ thống tự động nộp khi hết thời gian).' : ' và công bố điểm.'}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-2)]">
            Điểm số, đáp án đúng và nhận xét chi tiết sẽ hiển thị sau khi giáo viên xác nhận và
            chính thức công bố kết quả.
          </p>
        </div>
      ) : null}

      {published && displayedTotalScore !== null ? (
        <div className="rounded-2xl border border-[var(--jade)]/30 bg-[var(--jade-soft)]/60 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--jade)]">Điểm tổng kết</span>
              {updatedBadge ? <StatusTag tone="blue">{updatedBadge}</StatusTag> : null}
            </div>
            <span className="num text-2xl font-bold text-[var(--jade)]">
              {displayedTotalScore} / {displayedMaxScore} điểm
            </span>
          </div>
          {publishedResult?.returnedAt ? (
            <p className="num mt-1 text-xs text-[var(--ink-2)]">
              Công bố lúc: {formatDateTimeVn(publishedResult.returnedAt)}
            </p>
          ) : null}
          {displayedFeedback ? (
            <p className="mt-2.5 text-sm text-[var(--ink)]">
              <strong>Nhận xét của giáo viên:</strong> {displayedFeedback}
            </p>
          ) : null}
        </div>
      ) : null}

      {published && loadingResult && !publishedResult ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--ink-2)]">
          Đang tải chi tiết kết quả chấm điểm...
        </div>
      ) : null}

      {publishedResult ? (
        <div className="space-y-4">
          {publishedResult.questions.map((q) => (
            <PublishedQuestionReviewCard key={q.questionId} question={q} />
          ))}
        </div>
      ) : (
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
                  <span className="num text-xs font-semibold text-[var(--ink-2)]">
                    {q.points} điểm
                  </span>
                </div>
                <p className="whitespace-pre-line text-base font-medium text-[var(--ink)]">
                  {q.prompt}
                </p>
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
      )}
    </div>
  );
}

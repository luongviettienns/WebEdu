'use client';

import React from 'react';
import { QUESTION_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import { QuestionStemMedia } from '@/features/assignments/components/QuestionStemMedia';
import { StatusTag } from '@/features/common/components/StatusTag';
import type { StudentPublishedQuestionResultDto } from '@/features/grading/api/grading.api';
import { SelectedOptionImages } from '@/features/grading/components/SelectedOptionImages';
import {
  extractSelectedOptionItems,
  formatAnswerPayloadText,
  formatCorrectAnswerText,
} from '@/features/grading/utils/grading-status';

interface PublishedQuestionReviewCardProps {
  assignmentId: string;
  question: StudentPublishedQuestionResultDto;
}

export function PublishedQuestionReviewCard({
  assignmentId,
  question,
}: PublishedQuestionReviewCardProps) {
  const { studentAnswer, isObjective, correctAnswer, explanation } = question;
  const studentText = formatAnswerPayloadText(
    question.type,
    studentAnswer.answerPayload,
    correctAnswer,
  );
  const selectedItems = extractSelectedOptionItems(
    studentAnswer.answerPayload.selectedOptionIds,
    correctAnswer,
  );
  const correctItems = extractSelectedOptionItems(
    correctAnswer?.correctOptionIds,
    correctAnswer,
  );
  const earned = studentAnswer.earnedPoints ?? 0;

  return (
    <article
      data-published-question={question.position}
      className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded-md bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
            Câu {question.position}
          </span>
          <StatusTag tone="outline" dot={false}>
            {QUESTION_TYPE_LABELS[question.type]}
          </StatusTag>
          {isObjective && studentAnswer.isCorrect !== null ? (
            <StatusTag tone={studentAnswer.isCorrect ? 'jade' : 'red'}>
              {studentAnswer.isCorrect ? 'Chính xác' : 'Chưa chính xác'}
            </StatusTag>
          ) : null}
        </div>
        <span className="num text-xs font-bold text-[var(--jade)]">
          {earned} / {question.points} điểm
        </span>
      </div>

      <p className="whitespace-pre-line text-base font-medium text-[var(--ink)]">
        {question.prompt}
      </p>

      <QuestionStemMedia
        assignmentId={assignmentId}
        questionId={question.questionId}
        questionType={question.type}
        mediaId={question.mediaId ?? correctAnswer?.mediaId}
        caption={question.caption ?? correctAnswer?.caption}
      />

      <div className="rounded-xl bg-[var(--surface-2)]/70 p-3.5 text-sm">
        <div className="text-[11px] font-semibold uppercase text-[var(--ink-3)]">
          Câu trả lời của bạn
        </div>
        <p className="mt-1 whitespace-pre-line text-[var(--ink)]">{studentText}</p>
        <SelectedOptionImages assignmentId={assignmentId} items={selectedItems} />
      </div>

      {isObjective && correctAnswer ? (
        <div className="rounded-xl border border-[var(--jade)]/25 bg-[var(--jade-soft)]/50 p-3.5 text-sm">
          <div className="text-[11px] font-semibold uppercase text-[var(--jade)]">
            Đáp án đúng
          </div>
          <p className="mt-1 font-medium text-[var(--ink)]">
            {formatCorrectAnswerText(question.type, correctAnswer)}
          </p>
          <SelectedOptionImages assignmentId={assignmentId} items={correctItems} />
          {explanation ? (
            <p className="mt-1.5 text-xs text-[var(--ink-2)]">
              <strong>Giải thích:</strong> {explanation}
            </p>
          ) : null}
        </div>
      ) : null}

      {studentAnswer.teacherComment ? (
        <div className="rounded-xl border border-[var(--blue)]/25 bg-[var(--blue-soft)]/50 p-3.5 text-sm">
          <div className="text-[11px] font-semibold uppercase text-[var(--blue)]">
            Nhận xét của giáo viên
          </div>
          <p className="mt-1 whitespace-pre-line text-[var(--ink)]">
            {studentAnswer.teacherComment}
          </p>
        </div>
      ) : null}
    </article>
  );
}

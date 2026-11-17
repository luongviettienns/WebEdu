'use client';

import React, { useState } from 'react';
import { QUESTION_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import { StatusTag } from '@/features/common/components/StatusTag';
import type { AiEssayReviewInput, TeacherGradingQuestionDetailDto } from '@/features/grading/api/grading.api';
import { SelectedOptionImages } from '@/features/grading/components/SelectedOptionImages';
import {
  extractSelectedOptionItems,
  formatAnswerPayloadText,
  formatCorrectAnswerText,
} from '@/features/grading/utils/grading-status';

interface GradingQuestionCardProps {
  assignmentId: string;
  question: TeacherGradingQuestionDetailDto;
  scoreValue: string;
  commentValue: string;
  canEditManually: boolean;
  aiLoading: boolean;
  onScoreChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onRequestAi: (review: AiEssayReviewInput) => Promise<boolean>;
  onApplyAi: (suggestedPoints: number, aiFeedback: string | null) => void;
}

export function GradingQuestionCard({
  assignmentId,
  question,
  scoreValue,
  commentValue,
  canEditManually,
  aiLoading,
  onScoreChange,
  onCommentChange,
  onRequestAi,
  onApplyAi,
}: GradingQuestionCardProps) {
  const [review, setReview] = useState<AiEssayReviewInput | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const { studentAnswer, questionPayload, isObjective } = question;
  const studentText = formatAnswerPayloadText(
    question.type,
    studentAnswer.answerPayload,
    questionPayload,
  );
  const keyText = formatCorrectAnswerText(question.type, questionPayload);
  const selectedItems = extractSelectedOptionItems(
    studentAnswer.answerPayload.selectedOptionIds,
    questionPayload,
  );
  const correctItems = extractSelectedOptionItems(
    questionPayload.correctOptionIds,
    questionPayload,
  );
  const rubricText =
    typeof questionPayload.rubric === 'string' && questionPayload.rubric.trim()
      ? questionPayload.rubric.trim()
      : null;
  const reviewId = `ai-review-${question.questionId}`;
  const openReview = () => {
    const clean = (value: unknown) => typeof value === 'string' ? value.trim().normalize('NFKC') : '';
    setReviewConfirmed(false);
    setReview({
      prompt: clean(question.prompt),
      sampleAnswer: clean(questionPayload.sampleAnswer),
      rubric: clean(questionPayload.rubric),
      studentAnswer: clean(studentAnswer.answerPayload.text),
    });
  };

  return (
    <article
      data-question-id={question.questionId}
      className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs font-bold text-[var(--ink)]">
            Câu {question.position}
          </span>
          <StatusTag tone="outline" dot={false}>
            {QUESTION_TYPE_LABELS[question.type]}
          </StatusTag>
          {isObjective && studentAnswer.isCorrect !== null ? (
            <StatusTag tone={studentAnswer.isCorrect ? 'jade' : 'red'}>
              {studentAnswer.isCorrect ? 'Đúng' : 'Sai'}
            </StatusTag>
          ) : null}
        </div>
        <span className="num text-xs font-semibold text-[var(--ink-2)]">
          Tối đa {question.points} điểm
        </span>
      </div>

      <p className="whitespace-pre-line text-sm font-semibold text-[var(--ink)]">
        {question.prompt}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-[var(--surface-2)]/70 p-3">
          <div className="text-[11px] font-semibold uppercase text-[var(--ink-3)]">
            Bài làm của học viên
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-[var(--ink)]">{studentText}</p>
          <SelectedOptionImages assignmentId={assignmentId} items={selectedItems} />
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="text-[11px] font-semibold uppercase text-[var(--ink-3)]">
            {isObjective ? 'Đáp án đúng' : 'Đáp án mẫu / Hướng dẫn chấm'}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-[var(--ink-2)]">{keyText}</p>
          <SelectedOptionImages assignmentId={assignmentId} items={correctItems} />
          {rubricText ? (
            <p className="mt-1.5 border-t border-[var(--line)] pt-1.5 text-xs text-[var(--ink-3)]">
              <strong>Rubric:</strong> {rubricText}
            </p>
          ) : null}
        </div>
      </div>

      {question.type === 'ESSAY' ? (
        <div className="rounded-xl border border-[var(--blue)]/25 bg-[var(--blue-soft)]/50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--blue)]">
              Gợi ý AI chấm tự luận (Nháp nội bộ — Học viên không thấy)
            </span>
            {canEditManually ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={aiLoading}
                  aria-expanded={review !== null}
                  aria-controls={review ? reviewId : undefined}
                  onClick={review ? () => setReview(null) : openReview}
                  className="rounded-md border border-[var(--blue)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)] disabled:opacity-50"
                >
                  {review ? 'Đóng phần duyệt' : 'Gợi ý chấm bằng AI'}
                </button>
                {studentAnswer.aiSuggestedPoints !== null ? (
                  <button
                    type="button"
                    onClick={() =>
                      onApplyAi(studentAnswer.aiSuggestedPoints!, studentAnswer.aiFeedback)
                    }
                    className="rounded-md bg-[var(--blue)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Áp dụng gợi ý AI ({studentAnswer.aiSuggestedPoints} đ)
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {review && canEditManually ? (
            <fieldset id={reviewId} disabled={aiLoading} className="mt-3 space-y-2">
              <legend className="text-xs font-bold">Nội dung gửi cho nhà cung cấp AI</legend>
              <p className="text-xs">Loại tên, địa chỉ và thông tin nhận dạng, giữ nguyên nội dung cần chấm. Điểm tối đa gửi đi là {question.points}.</p>
              {([
                ['prompt', 'Câu hỏi gửi AI'], ['studentAnswer', 'Bài làm gửi AI'],
                ['sampleAnswer', 'Đáp án mẫu gửi AI'], ['rubric', 'Hướng dẫn chấm gửi AI'],
              ] as const).map(([field, label]) => (
                <label key={field} className="block text-xs font-semibold">
                  {label}
                  <textarea value={review[field]} rows={2} maxLength={50_000}
                    className="mt-1 block w-full rounded-md border border-[var(--line-2)] bg-white p-2"
                    onChange={(event) => {
                      setReview({ ...review, [field]: event.target.value });
                      setReviewConfirmed(false);
                    }} />
                </label>
              ))}
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />
                Tôi đã duyệt và loại thông tin định danh khỏi nội dung này
              </label>
              <button type="button" disabled={!reviewConfirmed}
                onClick={async () => { if (await onRequestAi(review)) setReview(null); }}
                className="rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {aiLoading ? 'Đang hỏi AI...' : 'Gửi nội dung đã duyệt'}
              </button>
            </fieldset>
          ) : null}

          {studentAnswer.aiSuggestedPoints !== null || studentAnswer.aiFeedback ? (
            <div className="mt-2 space-y-1 text-xs text-[var(--ink)]">
              <div className="num font-semibold">
                Điểm AI đề xuất: {studentAnswer.aiSuggestedPoints ?? '—'} / {question.points}
              </div>
              {studentAnswer.aiFeedback ? (
                <p className="text-[var(--ink-2)]">Gợi ý nhận xét: {studentAnswer.aiFeedback}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-[var(--ink-2)]">
              Chưa có gợi ý AI cho câu hỏi này. Giáo viên có thể chấm trực tiếp hoặc nhấn nút Gợi ý.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label
            htmlFor={`score-${question.questionId}`}
            className="block text-xs font-semibold text-[var(--ink-2)]"
          >
            Điểm chấm (0 – {question.points})
          </label>
          <input
            id={`score-${question.questionId}`}
            type="number"
            min={0}
            max={question.points}
            step={0.25}
            disabled={!canEditManually}
            value={scoreValue}
            onChange={(e) => onScoreChange(e.target.value)}
            className="num w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)] disabled:bg-[var(--surface-2)]"
          />
        </div>

        <div className="space-y-1 sm:col-span-3">
          <label
            htmlFor={`comment-${question.questionId}`}
            className="block text-xs font-semibold text-[var(--ink-2)]"
          >
            Nhận xét cho câu {question.position}
          </label>
          <input
            id={`comment-${question.questionId}`}
            type="text"
            disabled={!canEditManually}
            value={commentValue}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Nhập nhận xét chi tiết cho câu trả lời (tùy chọn)..."
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] disabled:bg-[var(--surface-2)]"
          />
        </div>
      </div>
    </article>
  );
}

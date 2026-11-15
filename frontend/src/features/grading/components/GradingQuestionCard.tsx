'use client';

import React from 'react';
import { QUESTION_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import { StatusTag } from '@/features/common/components/StatusTag';
import type { TeacherGradingQuestionDetailDto } from '@/features/grading/api/grading.api';
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
  onRequestAi: () => void;
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

      {!isObjective ? (
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
                  onClick={onRequestAi}
                  className="rounded-md border border-[var(--blue)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)] disabled:opacity-50"
                >
                  {aiLoading ? 'Đang hỏi AI...' : 'Gợi ý chấm bằng AI'}
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

'use client';

import React from 'react';
import {
  QUESTION_TYPE_LABELS,
  type TeacherQuestionDto,
} from '@/features/assessments/api/assessments.api';
import type { MediaItem } from '@/features/assessments/components/MediaAttach';
import { QuestionTypeFields } from '@/features/assessments/components/QuestionTypeFields';
import {
  buildConfirmQuestionPatch,
  buildDirtyQuestionPatch,
  type QuestionDraft,
  type QuestionUpdatePatch,
} from '@/features/assessments/utils/question-payload';

const PROMPT_INPUT =
  'min-w-0 flex-1 rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)]';
const POINTS_INPUT =
  'w-20 rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)]';

export function AssessmentQuestionCard({
  question,
  draft,
  index,
  total,
  preview,
  disabled,
  saving = false,
  assessmentId,
  mediaLibrary,
  onUploadMedia,
  onDraftChange,
  onSave,
  onConfirm,
  onMove,
  onDelete,
  onValidationError,
}: {
  question: TeacherQuestionDto;
  draft: QuestionDraft;
  index: number;
  total: number;
  preview: boolean;
  disabled: boolean;
  saving?: boolean;
  assessmentId: string;
  mediaLibrary: MediaItem[];
  onUploadMedia?: (file: File) => Promise<string>;
  onDraftChange: (questionId: string, next: QuestionDraft) => void;
  onSave: (question: TeacherQuestionDto, patch: QuestionUpdatePatch) => void;
  onConfirm: (question: TeacherQuestionDto, patch: QuestionUpdatePatch) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (question: TeacherQuestionDto) => void;
  onValidationError?: (message: string) => void;
}) {
  const isDirty =
    draft.prompt !== question.prompt ||
    draft.points !== String(question.points) ||
    JSON.stringify(draft.payload) !== JSON.stringify(question.payload);

  const handleSave = () => {
    try {
      const patch = buildDirtyQuestionPatch(question, draft, true);
      if (patch) onSave(question, patch);
    } catch (err) {
      onValidationError?.(err instanceof Error ? err.message : 'Dữ liệu câu hỏi không hợp lệ');
    }
  };

  const handleConfirm = () => {
    try {
      onConfirm(question, buildConfirmQuestionPatch(draft));
    } catch (err) {
      onValidationError?.(err instanceof Error ? err.message : 'Dữ liệu câu hỏi không hợp lệ');
    }
  };

  return (
    <article
      aria-label={`Câu ${index + 1}`}
      className={`space-y-2.5 rounded-xl border p-3.5 ${
        question.needsReview ? 'border-[var(--amber)] bg-[var(--amber-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-[var(--ink)]">
          {index + 1}. {draft.prompt}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[var(--ink-2)]">
            {QUESTION_TYPE_LABELS[question.type]}
          </span>
          {question.needsReview ? (
            <span className="rounded bg-[var(--surface)] px-2 py-0.5 font-semibold text-[var(--amber)]">
              Cần kiểm tra
            </span>
          ) : null}
          {preview ? <span className="text-[var(--ink-3)]">{question.points} điểm</span> : null}
        </div>
      </div>

      {!preview ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={PROMPT_INPUT}
            value={draft.prompt}
            aria-label={`Nội dung câu ${index + 1}`}
            disabled={disabled || saving}
            onChange={(e) => onDraftChange(question.id, { ...draft, prompt: e.target.value })}
          />
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-2)]">
            <span>Điểm</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              className={POINTS_INPUT}
              value={draft.points}
              aria-label={`Điểm câu ${index + 1}`}
              disabled={disabled || saving}
              onChange={(e) => onDraftChange(question.id, { ...draft, points: e.target.value })}
            />
          </label>
        </div>
      ) : null}

      <QuestionTypeFields
        type={question.type}
        payload={draft.payload}
        groupId={question.id}
        hideAnswer={preview}
        disabled={disabled || saving}
        assessmentId={assessmentId}
        mediaLibrary={mediaLibrary}
        onUploadMedia={onUploadMedia}
        onChange={(next) => onDraftChange(question.id, { ...draft, payload: next })}
      />

      {!preview ? (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold">
          {question.needsReview ? (
            <button
              type="button"
              disabled={disabled || saving}
              className="rounded-md bg-[var(--blue)] px-2.5 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleConfirm}
            >
              Lưu &amp; xác nhận
            </button>
          ) : isDirty ? (
            <button
              type="button"
              disabled={disabled || saving}
              className="rounded-md border border-[var(--blue)] px-2.5 py-1 text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSave}
            >
              Lưu câu
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled || saving || index === 0}
            className="text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onMove(index, -1)}
          >
            Lên
          </button>
          <button
            type="button"
            disabled={disabled || saving || index === total - 1}
            className="text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onMove(index, 1)}
          >
            Xuống
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            className="text-[var(--red)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onDelete(question)}
          >
            Xóa câu
          </button>
        </div>
      ) : null}
    </article>
  );
}

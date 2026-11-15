'use client';

import React from 'react';
import {
  QUESTION_TYPE_LABELS,
  type TeacherQuestionDto,
} from '@/features/assessments/api/assessments.api';
import type { MediaItem } from '@/features/assessments/components/MediaAttach';
import { QuestionTypeFields } from '@/features/assessments/components/QuestionTypeFields';
import {
  asOptions,
  asStrings,
  buildConfirmQuestionPatch,
  buildDirtyQuestionPatch,
  type QuestionDraft,
  type QuestionUpdatePatch,
} from '@/features/assessments/utils/question-payload';

const PROMPT_INPUT =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)]';
const POINTS_INPUT =
  'w-20 rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)]';

function getNeedsReviewHint(question: TeacherQuestionDto, draft: QuestionDraft): string {
  if (!draft.prompt.trim()) {
    return 'Chưa có nội dung câu hỏi — hãy nhập đề bài vào ô bên dưới.';
  }
  if (
    (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') &&
    asStrings(draft.payload, 'correctOptionIds').length === 0
  ) {
    return 'Chưa chọn đáp án đúng — hãy tích chọn phương án đúng (A/B/C/D) bên dưới rồi bấm "Lưu & xác nhận".';
  }
  if (question.type === 'FILL_BLANK' && asStrings(draft.payload, 'acceptedAnswers').length === 0) {
    return 'Chưa có đáp án điền khuyết — hãy gõ ít nhất 1 đáp án đúng bên dưới rồi bấm "Lưu & xác nhận".';
  }
  if (question.type === 'ORDERING' && !String(draft.payload.correctSentence ?? '').trim()) {
    return 'Chưa có câu hoàn chỉnh — hãy kiểm tra các mảnh từ và nhập câu đúng sau khi sắp xếp.';
  }
  if (question.type === 'LISTENING' && !String(draft.payload.mediaId ?? '').trim()) {
    return 'Câu nghe chưa có file âm thanh — hãy chọn hoặc tải lên file MP3/WAV bên dưới.';
  }
  if (
    question.type === 'IMAGE_BASED' &&
    !String(draft.payload.imageMediaId ?? '').trim() &&
    asOptions(draft.payload).length === 0
  ) {
    return 'Câu nhìn hình chưa gắn ảnh — hãy chọn hoặc tải ảnh minh họa bên dưới.';
  }
  return 'Hãy kiểm tra lại nội dung và đáp án máy vừa tách tự động, nếu đã chuẩn hãy bấm "Lưu & xác nhận".';
}

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
      id={`question-card-${question.id}`}
      data-needs-review={question.needsReview ? 'true' : 'false'}
      aria-label={`Câu ${index + 1}`}
      className={`space-y-2.5 rounded-xl border p-3.5 ${
        question.needsReview ? 'border-[var(--amber)] bg-[var(--amber-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {preview ? (
          <div className="text-sm font-medium text-[var(--ink)]">
            {index + 1}. {draft.prompt}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[var(--ink)]">Câu {index + 1}</span>
            <span className="sr-only">
              {index + 1}. {draft.prompt}
            </span>
            <span className="rounded border border-[var(--line-2)] bg-white px-2 py-0.5 text-xs text-[var(--ink-2)]">
              {QUESTION_TYPE_LABELS[question.type]}
            </span>
            {question.needsReview ? (
              <span className="rounded bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--amber)]">
                Cần kiểm tra
              </span>
            ) : (
              <span className="rounded bg-[var(--jade-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--jade)]">
                Đã khớp
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          {preview ? (
            <>
              <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[var(--ink-2)]">
                {QUESTION_TYPE_LABELS[question.type]}
              </span>
              {question.needsReview ? (
                <span className="rounded bg-[var(--surface)] px-2 py-0.5 font-semibold text-[var(--amber)]">
                  Cần kiểm tra
                </span>
              ) : null}
              <span className="text-[var(--ink-3)]">{question.points} điểm</span>
            </>
          ) : (
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-2)]">
              <span>Điểm</span>
              <input
                type="number"
                min="0.25"
                step="0.25"
                className={POINTS_INPUT}
                value={draft.points}
                aria-label={`Điểm câu ${index + 1}`}
                disabled={disabled || saving}
                onChange={(e) => onDraftChange(question.id, { ...draft, points: e.target.value })}
              />
            </label>
          )}
        </div>
      </div>

      {!preview && question.needsReview ? (
        <div className="rounded-lg border border-[var(--amber)]/40 bg-white/85 px-3 py-1.5 text-xs text-[var(--ink-2)]">
          <strong className="font-semibold text-[var(--amber)]">Hướng dẫn: </strong>
          {getNeedsReviewHint(question, draft)}
        </div>
      ) : null}

      {!preview ? (
        <input
          className={PROMPT_INPUT}
          value={draft.prompt}
          aria-label={`Nội dung câu ${index + 1}`}
          disabled={disabled || saving}
          onChange={(e) => onDraftChange(question.id, { ...draft, prompt: e.target.value })}
        />
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

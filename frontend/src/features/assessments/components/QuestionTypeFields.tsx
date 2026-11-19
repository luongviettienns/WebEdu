'use client';

import React from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import { ChoiceOptionsBlock } from '@/features/assessments/components/ChoiceOptionsBlock';
import { MediaAttach, type MediaItem } from '@/features/assessments/components/MediaAttach';
import { QuestionImageBasedFields } from '@/features/assessments/components/QuestionImageBasedFields';
import { QuestionPreviewFields } from '@/features/assessments/components/QuestionPreviewFields';
import {
  asOptions,
  asStrings,
  setMultipleChoiceMode,
  splitTeacherLines,
  withOptionalPositiveInt,
} from '@/features/assessments/utils/question-payload';

const FIELD =
  'w-full min-w-0 rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function QuestionTypeFields({
  type,
  payload,
  onChange,
  hideAnswer = false,
  disabled = false,
  groupId = 'new',
  onUploadMedia,
  assessmentId,
  mediaLibrary = [],
}: {
  type: QuestionType;
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  hideAnswer?: boolean;
  disabled?: boolean;
  groupId?: string;
  onUploadMedia?: (file: File) => Promise<string>;
  assessmentId?: string;
  mediaLibrary?: MediaItem[];
}) {
  if (hideAnswer) {
    return (
      <QuestionPreviewFields
        type={type}
        payload={payload}
        groupId={groupId}
        assessmentId={assessmentId}
      />
    );
  }

  const explanation = (
    <textarea
      className={FIELD}
      rows={2}
      value={String(payload.explanation ?? '')}
      readOnly={disabled}
      onChange={(e) => onChange({ ...payload, explanation: e.target.value })}
      placeholder="Giải thích (tuỳ chọn)"
      aria-label="Giải thích"
    />
  );

  if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
    return (
      <div className="min-w-0 space-y-2">
        <ChoiceOptionsBlock
          payload={payload}
          onChange={onChange}
          disabled={disabled}
          groupId={groupId}
          multiple={type === 'MULTIPLE_CHOICE'}
        />
        {explanation}
      </div>
    );
  }

  if (type === 'FILL_BLANK') {
    const answers = asStrings(payload, 'acceptedAnswers');
    return (
      <div className="min-w-0 space-y-2">
        <p className="text-xs text-[var(--ink-2)]">
          Mỗi dòng 1 đáp án đúng, hoặc ngăn cách bằng dấu | (ví dụ: 您好 | 你好)
        </p>
        <textarea
          className={FIELD}
          rows={3}
          value={answers.join('\n')}
          readOnly={disabled}
          onChange={(e) => onChange({ ...payload, acceptedAnswers: splitTeacherLines(e.target.value, '|') })}
          placeholder="Mỗi dòng một đáp án chấp nhận"
          aria-label="Đáp án chấp nhận"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(payload.pinyinSensitive)}
            disabled={disabled}
            onChange={(e) => onChange({ ...payload, pinyinSensitive: e.target.checked })}
          />
          Phân biệt pinyin
        </label>
        {explanation}
      </div>
    );
  }

  if (type === 'ORDERING') {
    const tokens = asStrings(payload, 'tokens');
    return (
      <div className="min-w-0 space-y-2">
        <p className="text-xs text-[var(--ink-2)]">
          Mỗi dòng 1 từ/cụm từ, hoặc ngăn cách bằng dấu / (ví dụ: 我 / 姓 / 王)
        </p>
        <textarea
          className={FIELD}
          rows={3}
          value={tokens.join('\n')}
          onChange={(e) => onChange({ ...payload, tokens: splitTeacherLines(e.target.value, '/') })}
          placeholder="Mỗi dòng một mảnh từ"
          aria-label="Mảnh từ"
          readOnly={disabled}
        />
        <input
          className={FIELD}
          value={String(payload.correctSentence ?? '')}
          readOnly={disabled}
          onChange={(e) => onChange({ ...payload, correctSentence: e.target.value })}
          placeholder="Câu đúng sau khi sắp xếp"
          aria-label="Câu đúng"
        />
        {explanation}
      </div>
    );
  }

  if (type === 'ESSAY') {
    return (
      <div className="min-w-0 space-y-2">
        <textarea
          className={FIELD}
          rows={2}
          value={String(payload.sampleAnswer ?? '')}
          readOnly={disabled}
          onChange={(e) => onChange({ ...payload, sampleAnswer: e.target.value })}
          placeholder="Đáp án mẫu"
          aria-label="Đáp án mẫu"
        />
        <textarea
          className={FIELD}
          rows={2}
          value={String(payload.rubric ?? '')}
          readOnly={disabled}
          onChange={(e) => onChange({ ...payload, rubric: e.target.value })}
          placeholder="Tiêu chí chấm (tuỳ chọn)"
          aria-label="Rubric"
        />
        <input
          type="number"
          min={1}
          max={50000}
          className={FIELD}
          value={String(payload.maxLength ?? '')}
          readOnly={disabled}
          onChange={(e) => onChange(withOptionalPositiveInt(payload, 'maxLength', e.target.value))}
          placeholder="Số ký tự tối đa"
          aria-label="Số ký tự tối đa"
        />
        {explanation}
      </div>
    );
  }

  if (type === 'LISTENING') {
    const options = asOptions(payload);
    const multiple = Boolean(payload.multiple);
    return (
      <div className="min-w-0 space-y-2.5">
        <p className="text-xs text-[var(--ink-2)]">Gắn file nghe tại đây. Không ghi tên file trong Word.</p>
        <MediaAttach
          kind="AUDIO"
          value={String(payload.mediaId ?? '')}
          library={mediaLibrary}
          assessmentId={assessmentId}
          onChange={(id) => {
            if (!disabled) onChange({ ...payload, mediaId: id });
          }}
          onUpload={disabled ? undefined : onUploadMedia}
        />
        <input
          type="number"
          min={1}
          max={20}
          className={FIELD}
          value={String(payload.maxListens ?? '')}
          readOnly={disabled}
          onChange={(e) => onChange(withOptionalPositiveInt(payload, 'maxListens', e.target.value))}
          placeholder="Số lần nghe tối đa"
          aria-label="Số lần nghe tối đa"
        />
        {options.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-[var(--line)] bg-white/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--ink-2)]">
                <input
                  type="checkbox"
                  checked={multiple}
                  disabled={disabled}
                  onChange={(e) => onChange(setMultipleChoiceMode(payload, e.target.checked))}
                />
                Cho phép chọn nhiều đáp án
              </label>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...payload, options: [], correctOptionIds: [], multiple: false })}
                  className="text-xs font-semibold text-[var(--ink-3)] hover:text-[var(--red)]"
                >
                  Bỏ phương án trắc nghiệm
                </button>
              ) : null}
            </div>
            <ChoiceOptionsBlock
              payload={payload}
              onChange={onChange}
              disabled={disabled}
              groupId={groupId}
              multiple={multiple}
            />
          </div>
        ) : !disabled ? (
          <button
            type="button"
            className="text-xs font-semibold text-[var(--blue)]"
            onClick={() =>
              onChange({
                ...payload,
                options: [
                  { id: 'a', text: '' },
                  { id: 'b', text: '' },
                ],
                correctOptionIds: [],
              })
            }
          >
            + Thêm phương án trắc nghiệm (tuỳ chọn)
          </button>
        ) : null}
        {explanation}
      </div>
    );
  }

  return (
    <QuestionImageBasedFields
      payload={payload}
      onChange={onChange}
      hideAnswer={false}
      disabled={disabled}
      groupId={groupId}
      onUploadMedia={onUploadMedia}
      assessmentId={assessmentId}
      mediaLibrary={mediaLibrary}
    />
  );
}

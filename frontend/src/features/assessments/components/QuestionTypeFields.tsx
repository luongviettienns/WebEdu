'use client';

import React from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import { MediaAttach, type MediaItem } from '@/features/assessments/components/MediaAttach';
import { QuestionImageBasedFields } from '@/features/assessments/components/QuestionImageBasedFields';
import {
  addBlankOption,
  asOptions,
  asStrings,
  removeOptionAt,
  toggleCorrectOption,
  updateOptionField,
  withOptionalPositiveInt,
} from '@/features/assessments/utils/question-payload';

const FIELD =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

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
  const locked = hideAnswer || disabled;
  const explanation = hideAnswer ? null : (
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
    const options = asOptions(payload);
    const correct = asStrings(payload, 'correctOptionIds');
    const multiple = type === 'MULTIPLE_CHOICE';
    return (
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <label key={opt.id} className="flex items-center gap-2">
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={`correct-${groupId}`}
              checked={hideAnswer ? false : correct.includes(opt.id)}
              onChange={() => onChange(toggleCorrectOption(payload, opt.id, multiple))}
              disabled={locked}
              aria-label={`Đáp án ${opt.id.toUpperCase()}`}
            />
            <span className="w-5 text-xs font-semibold text-[var(--ink-2)]">{opt.id.toUpperCase()}</span>
            <input
              className={FIELD}
              value={opt.text}
              onChange={(e) => onChange({ ...payload, options: updateOptionField(options, idx, 'text', e.target.value) })}
              placeholder={`Phương án ${opt.id.toUpperCase()}`}
              readOnly={locked}
            />
            {!locked && options.length > 2 ? (
              <button
                type="button"
                className="text-xs font-semibold text-[var(--red)]"
                onClick={() => onChange(removeOptionAt(payload, idx))}
              >
                Xóa
              </button>
            ) : null}
          </label>
        ))}
        {!locked && options.length < 4 ? (
          <button
            type="button"
            className="text-xs font-semibold text-[var(--blue)]"
            onClick={() => onChange(addBlankOption(payload))}
          >
            + Thêm phương án
          </button>
        ) : null}
        {explanation}
      </div>
    );
  }

  if (type === 'FILL_BLANK') {
    const answers = asStrings(payload, 'acceptedAnswers');
    return hideAnswer ? null : (
      <div className="space-y-2">
        <textarea
          className={FIELD}
          rows={3}
          value={answers.join('\n')}
          readOnly={disabled}
          onChange={(e) => onChange({ ...payload, acceptedAnswers: e.target.value.split('\n') })}
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
      <div className="space-y-2">
        <textarea
          className={FIELD}
          rows={3}
          value={tokens.join('\n')}
          onChange={(e) => onChange({ ...payload, tokens: e.target.value.split('\n') })}
          placeholder="Mỗi dòng một mảnh từ"
          aria-label="Mảnh từ"
          readOnly={locked}
        />
        {hideAnswer ? null : (
          <input
            className={FIELD}
            value={String(payload.correctSentence ?? '')}
            readOnly={disabled}
            onChange={(e) => onChange({ ...payload, correctSentence: e.target.value })}
            placeholder="Câu đúng"
            aria-label="Câu đúng"
          />
        )}
        {explanation}
      </div>
    );
  }

  if (type === 'ESSAY') {
    return hideAnswer ? null : (
      <div className="space-y-2">
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
          placeholder="Rubric / tiêu chí chấm"
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
    return (
      <div className="space-y-2">
        <MediaAttach
          kind="AUDIO"
          value={String(payload.mediaId ?? '')}
          library={mediaLibrary}
          assessmentId={assessmentId}
          onChange={(id) => {
            if (!locked) onChange({ ...payload, mediaId: id });
          }}
          onUpload={locked ? undefined : onUploadMedia}
        />
        {hideAnswer ? null : (
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
        )}
        {explanation}
      </div>
    );
  }

  return (
    <QuestionImageBasedFields
      payload={payload}
      onChange={onChange}
      hideAnswer={hideAnswer}
      disabled={disabled}
      groupId={groupId}
      onUploadMedia={onUploadMedia}
      assessmentId={assessmentId}
      mediaLibrary={mediaLibrary}
    />
  );
}

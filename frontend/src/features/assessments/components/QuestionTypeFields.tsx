'use client';

import React from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import { MediaAttach, type MediaItem } from '@/features/assessments/components/MediaAttach';
import {
  asOptions,
  asStrings,
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
  groupId = 'new',
  onUploadMedia,
  assessmentId,
  mediaLibrary = [],
}: {
  type: QuestionType;
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  hideAnswer?: boolean;
  groupId?: string;
  onUploadMedia?: (file: File) => Promise<string>;
  assessmentId?: string;
  mediaLibrary?: MediaItem[];
}) {
  const explanation = hideAnswer ? null : (
    <textarea
      className={FIELD}
      rows={2}
      value={String(payload.explanation ?? '')}
      onChange={(e) => onChange({ ...payload, explanation: e.target.value })}
      placeholder="Giải thích (tuỳ chọn)"
      aria-label="Giải thích"
    />
  );

  if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
    const options = asOptions(payload);
    const correct = asStrings(payload, 'correctOptionIds');
    const toggle = (id: string) => {
      if (type === 'SINGLE_CHOICE') {
        onChange({ ...payload, correctOptionIds: [id] });
        return;
      }
      const next = correct.includes(id) ? correct.filter((c) => c !== id) : [...correct, id];
      onChange({ ...payload, correctOptionIds: next });
    };
    return (
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <label key={opt.id} className="flex items-center gap-2">
            <input
              type={type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
              name={`correct-${groupId}`}
              checked={correct.includes(opt.id)}
              onChange={() => toggle(opt.id)}
              disabled={hideAnswer}
              aria-label={`Đáp án ${opt.id.toUpperCase()}`}
            />
            <span className="w-5 text-xs font-semibold text-[var(--ink-2)]">{opt.id.toUpperCase()}</span>
            <input
              className={FIELD}
              value={opt.text}
              onChange={(e) => onChange({ ...payload, options: updateOptionField(options, idx, 'text', e.target.value) })}
              placeholder={`Phương án ${opt.id.toUpperCase()}`}
              readOnly={hideAnswer}
            />
            {!hideAnswer && options.length > 2 ? (
              <button
                type="button"
                className="text-xs font-semibold text-[var(--red)]"
                onClick={() => {
                  const next = options.filter((_, i) => i !== idx);
                  onChange({
                    ...payload,
                    options: next,
                    correctOptionIds: correct.filter((id) => next.some((o) => o.id === id)),
                  });
                }}
              >
                Xóa
              </button>
            ) : null}
          </label>
        ))}
        {!hideAnswer && options.length < 4 ? (
          <button
            type="button"
            className="text-xs font-semibold text-[var(--blue)]"
            onClick={() => {
              const id = String.fromCharCode(97 + options.length);
              onChange({ ...payload, options: [...options, { id, text: '' }] });
            }}
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
          onChange={(e) => onChange({ ...payload, acceptedAnswers: e.target.value.split('\n') })}
          placeholder="Mỗi dòng một đáp án chấp nhận"
          aria-label="Đáp án chấp nhận"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(payload.pinyinSensitive)}
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
          readOnly={hideAnswer}
        />
        {hideAnswer ? null : (
          <input
            className={FIELD}
            value={String(payload.correctSentence ?? '')}
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
          onChange={(e) => onChange({ ...payload, sampleAnswer: e.target.value })}
          placeholder="Đáp án mẫu"
          aria-label="Đáp án mẫu"
        />
        <textarea
          className={FIELD}
          rows={2}
          value={String(payload.rubric ?? '')}
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
        <MediaAttach kind="AUDIO" value={String(payload.mediaId ?? '')} library={mediaLibrary} assessmentId={assessmentId}
          onChange={(id) => onChange({ ...payload, mediaId: id })} onUpload={hideAnswer ? undefined : onUploadMedia} />
        {hideAnswer ? null : (
          <input
            type="number"
            min={1}
            max={20}
            className={FIELD}
            value={String(payload.maxListens ?? '')}
            onChange={(e) => onChange(withOptionalPositiveInt(payload, 'maxListens', e.target.value))}
            placeholder="Số lần nghe tối đa"
            aria-label="Số lần nghe tối đa"
          />
        )}
        {explanation}
      </div>
    );
  }

  const options = asOptions(payload);
  const correct = asStrings(payload, 'correctOptionIds');
  return (
    <div className="space-y-2">
      <MediaAttach kind="IMAGE" value={String(payload.mediaId ?? '')} library={mediaLibrary} assessmentId={assessmentId}
        onChange={(id) => onChange({ ...payload, mediaId: id })} onUpload={hideAnswer ? undefined : onUploadMedia} />
      {hideAnswer ? null : (
        <input
          className={FIELD}
          value={String(payload.caption ?? '')}
          onChange={(e) => onChange({ ...payload, caption: e.target.value })}
          placeholder="Chú thích ảnh"
          aria-label="Chú thích ảnh"
        />
      )}
      {options.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {options.map((opt, idx) => (
            <div key={opt.id} className="space-y-1 rounded-lg border border-[var(--line)] p-2">
              <label className="flex items-center gap-1 text-xs font-semibold">
                <input
                  type="radio"
                  name={`img-correct-${groupId}`}
                  checked={correct.includes(opt.id)}
                  disabled={hideAnswer}
                  onChange={() => onChange({ ...payload, correctOptionIds: [opt.id] })}
                  aria-label={`Đáp án ${opt.id.toUpperCase()}`}
                />
                {opt.id.toUpperCase()}
              </label>
              <MediaAttach kind="IMAGE" value={opt.imageMediaId ?? ''} library={mediaLibrary} assessmentId={assessmentId}
                onChange={(id) => onChange({ ...payload, options: updateOptionField(options, idx, 'imageMediaId', id) })}
                onUpload={hideAnswer ? undefined : onUploadMedia} />
              <input
                className={FIELD}
                value={opt.text}
                readOnly={hideAnswer}
                onChange={(e) => onChange({ ...payload, options: updateOptionField(options, idx, 'text', e.target.value) })}
                placeholder="Nhãn"
                aria-label={`Nhãn phương án ${opt.id.toUpperCase()}`}
              />
            </div>
          ))}
        </div>
      ) : null}
      {!hideAnswer && options.length < 4 ? (
        <button
          type="button"
          className="text-xs font-semibold text-[var(--blue)]"
          onClick={() => {
            const id = String.fromCharCode(97 + options.length);
            onChange({ ...payload, options: [...options, { id, text: '' }] });
          }}
        >
          + Thêm phương án ảnh
        </button>
      ) : null}
      {explanation}
    </div>
  );
}

'use client';

import React from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';

const FIELD =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

type Option = { id: string; text: string };

function asOptions(payload: Record<string, unknown>): Option[] {
  return Array.isArray(payload.options) ? (payload.options as Option[]) : [];
}

function asStrings(payload: Record<string, unknown>, key: string): string[] {
  return Array.isArray(payload[key]) ? (payload[key] as unknown[]).map((v) => String(v)) : [];
}

export function QuestionTypeFields({
  type,
  payload,
  onChange,
  hideAnswer = false,
}: {
  type: QuestionType;
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  hideAnswer?: boolean;
}) {
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
              name="correct"
              checked={correct.includes(opt.id)}
              onChange={() => toggle(opt.id)}
              disabled={hideAnswer}
              aria-label={`Đáp án ${opt.id.toUpperCase()}`}
            />
            <span className="w-5 text-xs font-semibold text-[var(--ink-2)]">{opt.id.toUpperCase()}</span>
            <input
              className={FIELD}
              value={opt.text}
              onChange={(e) => {
                const next = options.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o));
                onChange({ ...payload, options: next });
              }}
              placeholder={`Phương án ${opt.id.toUpperCase()}`}
              readOnly={hideAnswer}
            />
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
      </div>
    );
  }

  if (type === 'FILL_BLANK') {
    const answers = asStrings(payload, 'acceptedAnswers');
    return hideAnswer ? null : (
      <textarea
        className={FIELD}
        rows={3}
        value={answers.join('\n')}
        onChange={(e) => onChange({ ...payload, acceptedAnswers: e.target.value.split('\n') })}
        placeholder="Mỗi dòng một đáp án chấp nhận"
        aria-label="Đáp án chấp nhận"
      />
    );
  }

  if (type === 'ORDERING') {
    const tokens = asStrings(payload, 'tokens');
    return (
      <textarea
        className={FIELD}
        rows={3}
        value={tokens.join('\n')}
        onChange={(e) => onChange({ ...payload, tokens: e.target.value.split('\n') })}
        placeholder="Mỗi dòng một mảnh từ"
        aria-label="Mảnh từ"
        readOnly={hideAnswer}
      />
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
      </div>
    );
  }

  return (
    <input
      className={FIELD}
      value={String(payload.mediaId ?? '')}
      onChange={(e) => onChange({ ...payload, mediaId: e.target.value })}
      placeholder="mediaId (ảnh/audio)"
      aria-label="Mã media"
      readOnly={hideAnswer}
    />
  );
}

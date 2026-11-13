'use client';

import React, { useState } from 'react';
import {
  QUESTION_TYPE_LABELS,
  emptyPayload,
  type QuestionType,
} from '@/features/assessments/api/assessments.api';
import type { MediaItem } from '@/features/assessments/components/MediaAttach';
import { QuestionTypeFields } from '@/features/assessments/components/QuestionTypeFields';

const FIELD =
  'rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)]';

export function NewQuestionComposer({
  assessmentId,
  mediaLibrary,
  onUploadMedia,
  onAdd,
  disabled = false,
  saving = false,
}: {
  assessmentId: string;
  mediaLibrary: MediaItem[];
  onUploadMedia?: (file: File) => Promise<string>;
  onAdd: (input: {
    type: QuestionType;
    prompt: string;
    payload: Record<string, unknown>;
    points: number;
  }) => Promise<boolean>;
  disabled?: boolean;
  saving?: boolean;
}) {
  const [qType, setQType] = useState<QuestionType>('SINGLE_CHOICE');
  const [prompt, setPrompt] = useState('');
  const [points, setPoints] = useState('1');
  const [payload, setPayload] = useState<Record<string, unknown>>(() => emptyPayload('SINGLE_CHOICE'));
  const locked = disabled || saving;

  const handleAdd = async () => {
    const parsedPoints = Number(points);
    const ok = await onAdd({
      type: qType,
      prompt: prompt.trim(),
      payload,
      points: Number.isFinite(parsedPoints) ? parsedPoints : 0,
    });
    if (ok) {
      setPrompt('');
      setPoints('1');
      setPayload(emptyPayload(qType));
    }
  };

  return (
    <section aria-label="Thêm câu hỏi mới" className="space-y-2.5 border-t border-[var(--line)] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={FIELD}
          value={qType}
          aria-label="Dạng câu"
          disabled={locked}
          onChange={(e) => {
            const next = e.target.value as QuestionType;
            setQType(next);
            setPayload(emptyPayload(next));
          }}
        >
          {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-2)]">
          <span>Điểm</span>
          <input
            type="number"
            min="0.5"
            step="0.5"
            className={`${FIELD} w-24`}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            aria-label="Điểm"
            disabled={locked}
          />
        </label>
      </div>
      <textarea
        className={`${FIELD} w-full`}
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Nội dung câu hỏi"
        aria-label="Nội dung câu hỏi"
        disabled={locked}
      />
      <QuestionTypeFields
        type={qType}
        payload={payload}
        onChange={setPayload}
        disabled={locked}
        onUploadMedia={onUploadMedia}
        assessmentId={assessmentId}
        mediaLibrary={mediaLibrary}
      />
      <button
        type="button"
        disabled={locked}
        onClick={() => void handleAdd()}
        className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Thêm câu
      </button>
    </section>
  );
}

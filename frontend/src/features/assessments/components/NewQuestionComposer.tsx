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

const TEXT_TYPES: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'FILL_BLANK',
  'ORDERING',
  'ESSAY',
];
const MEDIA_TYPES: QuestionType[] = ['LISTENING', 'IMAGE_BASED'];

const TYPE_HINTS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Viết câu hỏi, điền A B C D, bấm ô tròn cạnh đáp án đúng.',
  MULTIPLE_CHOICE: 'Tích mọi ô vuông là đáp án đúng.',
  FILL_BLANK: 'Dùng ____ cho chỗ trống. Mỗi dòng một đáp án, hoặc dán 您好 | 你好.',
  ORDERING: 'Mỗi dòng một mảnh từ, hoặc dán 我 / 姓 / 王 như file Word. Điền câu đúng.',
  ESSAY: 'Điền đáp án mẫu và tiêu chí chấm nếu có.',
  LISTENING: 'Gắn file nghe tại đây. Không ghi tên file trong Word.',
  IMAGE_BASED: 'Gắn ảnh tại đây, rồi chọn đáp án.',
};

const PROMPT_HINT: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Ví dụ: 你好吗？',
  MULTIPLE_CHOICE: 'Ví dụ: 玛丽会说哪些语言？',
  FILL_BLANK: 'Dùng ____ cho chỗ trống. Ví dụ: 老师，____！',
  ORDERING: 'Ví dụ: Sắp xếp thành câu',
  ESSAY: 'Ví dụ: Dịch sang tiếng Trung: ...',
  LISTENING: 'Câu hỏi phần nghe',
  IMAGE_BASED: 'Câu hỏi kèm hình',
};

const CHIP =
  'rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50';

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

  const pickType = (next: QuestionType) => {
    setQType(next);
    setPayload(emptyPayload(next));
  };

  const renderChips = (types: QuestionType[]) =>
    types.map((t) => (
      <button
        key={t}
        type="button"
        role="radio"
        aria-checked={qType === t}
        disabled={locked}
        onClick={() => pickType(t)}
        className={`${CHIP} ${
          qType === t
            ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]'
            : 'border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--hover)]'
        }`}
      >
        {QUESTION_TYPE_LABELS[t]}
      </button>
    ));

  return (
    <section aria-label="Thêm câu hỏi mới" className="space-y-2.5 border-t border-[var(--line)] pt-3">
      <p className="text-xs font-medium text-[var(--ink-2)]">Chọn dạng câu, viết nội dung, rồi bấm Thêm câu.</p>
      <div role="radiogroup" aria-label="Dạng câu" className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          Câu chữ — giống file Word mẫu
        </p>
        <div className="flex flex-wrap gap-1.5">{renderChips(TEXT_TYPES)}</div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          Nghe / hình — gắn file tại đây
        </p>
        <div className="flex flex-wrap gap-1.5">{renderChips(MEDIA_TYPES)}</div>
      </div>
      <p className="text-xs text-[var(--ink-2)]">{TYPE_HINTS[qType]}</p>
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
      <textarea
        className={`${FIELD} w-full`}
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={PROMPT_HINT[qType]}
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

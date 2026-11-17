'use client';

import React from 'react';
import {
  addBlankOption,
  asOptions,
  asStrings,
  removeOptionAt,
  toggleCorrectOption,
  updateOptionField,
} from '@/features/assessments/utils/question-payload';

const FIELD =
  'w-full min-w-0 rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function ChoiceOptionsBlock({
  payload,
  onChange,
  disabled,
  groupId,
  multiple,
  minOptions = 2,
}: {
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled: boolean;
  groupId: string;
  multiple: boolean;
  minOptions?: number;
}) {
  const options = asOptions(payload);
  const correct = asStrings(payload, 'correctOptionIds');
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--ink-2)]">
        {multiple ? 'Tích mọi ô vuông là đáp án đúng.' : 'Bấm ô tròn cạnh đáp án đúng.'}
      </p>
      {options.map((opt, idx) => (
        <label key={`${opt.id}-${idx}`} className="flex min-w-0 items-center gap-2">
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={`correct-${groupId}`}
            checked={correct.includes(opt.id)}
            onChange={() => onChange(toggleCorrectOption(payload, opt.id, multiple))}
            disabled={disabled}
            aria-label={`Đáp án ${opt.id.toUpperCase()}`}
          />
          <span className="w-5 shrink-0 text-xs font-semibold text-[var(--ink-2)]">{opt.id.toUpperCase()}</span>
          <input
            className={FIELD}
            value={opt.text}
            onChange={(e) => onChange({ ...payload, options: updateOptionField(options, idx, 'text', e.target.value) })}
            placeholder={`Phương án ${opt.id.toUpperCase()}`}
            readOnly={disabled}
          />
          {!disabled && options.length > minOptions ? (
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-[var(--red)]"
              onClick={() => onChange(removeOptionAt(payload, idx))}
            >
              Xóa
            </button>
          ) : null}
        </label>
      ))}
      {!disabled && options.length < 4 ? (
        <button
          type="button"
          className="text-xs font-semibold text-[var(--blue)]"
          onClick={() => onChange(addBlankOption(payload))}
        >
          + Thêm phương án
        </button>
      ) : null}
    </div>
  );
}

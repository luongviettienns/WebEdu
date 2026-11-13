'use client';

import React from 'react';
import { MediaAttach, type MediaItem } from '@/features/assessments/components/MediaAttach';
import {
  addBlankOption,
  asOptions,
  asStrings,
  removeOptionAt,
  setMultipleChoiceMode,
  toggleCorrectOption,
  updateOptionField,
} from '@/features/assessments/utils/question-payload';

const FIELD =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function QuestionImageBasedFields({
  payload,
  onChange,
  hideAnswer = false,
  disabled = false,
  groupId = 'new',
  onUploadMedia,
  assessmentId,
  mediaLibrary = [],
}: {
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  hideAnswer?: boolean;
  disabled?: boolean;
  groupId?: string;
  onUploadMedia?: (file: File) => Promise<string>;
  assessmentId?: string;
  mediaLibrary?: MediaItem[];
}) {
  const options = asOptions(payload);
  const correct = asStrings(payload, 'correctOptionIds');
  const multiple = Boolean(payload.multiple);
  const locked = hideAnswer || disabled;

  return (
    <div className="space-y-2">
      <MediaAttach
        kind="IMAGE"
        value={String(payload.mediaId ?? '')}
        library={mediaLibrary}
        assessmentId={assessmentId}
        onChange={(id) => {
          if (!locked) onChange({ ...payload, mediaId: id });
        }}
        onUpload={locked ? undefined : onUploadMedia}
      />
      {hideAnswer ? null : (
        <>
          <input
            className={FIELD}
            value={String(payload.caption ?? '')}
            readOnly={disabled}
            onChange={(e) => onChange({ ...payload, caption: e.target.value })}
            placeholder="Chú thích ảnh"
            aria-label="Chú thích ảnh"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
            <input
              type="checkbox"
              checked={multiple}
              disabled={disabled}
              onChange={(e) => onChange(setMultipleChoiceMode(payload, e.target.checked))}
            />
            Cho phép chọn nhiều đáp án
          </label>
        </>
      )}
      {options.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {options.map((opt, idx) => (
            <div key={opt.id} className="space-y-1 rounded-lg border border-[var(--line)] p-2">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-xs font-semibold">
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={`img-correct-${groupId}`}
                    checked={hideAnswer ? false : correct.includes(opt.id)}
                    disabled={locked}
                    onChange={() => onChange(toggleCorrectOption(payload, opt.id, multiple))}
                    aria-label={`Đáp án ${opt.id.toUpperCase()}`}
                  />
                  {opt.id.toUpperCase()}
                </label>
                {!locked ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--red)]"
                    onClick={() => onChange(removeOptionAt(payload, idx))}
                  >
                    Xóa
                  </button>
                ) : null}
              </div>
              <MediaAttach
                kind="IMAGE"
                value={opt.imageMediaId ?? ''}
                library={mediaLibrary}
                assessmentId={assessmentId}
                onChange={(id) => {
                  if (!locked) {
                    onChange({ ...payload, options: updateOptionField(options, idx, 'imageMediaId', id) });
                  }
                }}
                onUpload={locked ? undefined : onUploadMedia}
              />
              <input
                className={FIELD}
                value={opt.text}
                readOnly={locked}
                onChange={(e) => onChange({ ...payload, options: updateOptionField(options, idx, 'text', e.target.value) })}
                placeholder={`Phương án ${opt.id.toUpperCase()}`}
                aria-label={`Nhãn phương án ${opt.id.toUpperCase()}`}
              />
            </div>
          ))}
        </div>
      ) : null}
      {!locked && options.length < 4 ? (
        <button
          type="button"
          className="text-xs font-semibold text-[var(--blue)]"
          onClick={() => onChange(addBlankOption(payload))}
        >
          + Thêm phương án ảnh
        </button>
      ) : null}
      {hideAnswer ? null : (
        <textarea
          className={FIELD}
          rows={2}
          value={String(payload.explanation ?? '')}
          readOnly={disabled}
          onChange={(e) => onChange({ ...payload, explanation: e.target.value })}
          placeholder="Giải thích (tuỳ chọn)"
          aria-label="Giải thích"
        />
      )}
    </div>
  );
}

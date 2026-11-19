'use client';

import React from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import { MediaAudioPlayer, MediaThumb } from '@/features/assessments/components/MediaAttach';
import { asOptions, asStrings } from '@/features/assessments/utils/question-payload';

export function deterministicShuffleTokens(tokens: readonly string[], seedKey: string): string[] {
  if (tokens.length < 2) return [...tokens];
  let seed = 0;
  for (let i = 0; i < seedKey.length; i += 1) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const indexed = tokens.map((text, idx) => ({ text, idx }));
  for (let i = indexed.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = indexed[i]!;
    indexed[i] = indexed[j]!;
    indexed[j] = tmp;
  }
  if (indexed.every((item, idx) => item.idx === idx)) {
    const first = indexed.shift()!;
    indexed.push(first);
  }
  return indexed.map((item) => item.text);
}

const PREVIEW_FIELD =
  'w-full min-w-0 rounded-lg border border-[var(--line-2)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-2)]';

export function QuestionPreviewFields({
  type,
  payload,
  groupId,
  assessmentId,
}: {
  type: QuestionType;
  payload: Record<string, unknown>;
  groupId: string;
  assessmentId?: string;
}) {
  const options = asOptions(payload);
  const multiple = Boolean(payload.multiple) || type === 'MULTIPLE_CHOICE';

  if (type === 'FILL_BLANK') {
    return (
      <input
        type="text"
        disabled
        readOnly
        className={PREVIEW_FIELD}
        placeholder="Học viên sẽ nhập đáp án điền khuyết tại đây..."
        aria-label="Ô nhập đáp án học viên"
      />
    );
  }

  if (type === 'ORDERING') {
    const tokens = deterministicShuffleTokens(asStrings(payload, 'tokens'), groupId);
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-dashed border-[var(--line-2)] bg-white px-3 py-2.5 text-xs text-[var(--ink-3)]">
          Khu vực học viên ghép các mảnh từ theo đúng thứ tự
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Các mảnh từ xáo trộn">
          {tokens.map((tok, idx) => (
            <span
              key={`${tok}-${idx}`}
              className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1 text-sm font-medium text-[var(--ink)]"
            >
              {tok}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'ESSAY') {
    return (
      <textarea
        disabled
        readOnly
        rows={3}
        className={PREVIEW_FIELD}
        placeholder="Học viên sẽ viết bài tự luận tại đây..."
        aria-label="Ô trả lời tự luận học viên"
      />
    );
  }

  const mediaId = String(payload.mediaId ?? '').trim();

  return (
    <div className="space-y-2.5">
      {type === 'LISTENING' ? (
        mediaId && assessmentId ? (
          <div className="space-y-1">
            <MediaAudioPlayer assessmentId={assessmentId} mediaId={mediaId} />
            {payload.maxListens ? (
              <p className="text-xs text-[var(--ink-2)]">
                Số lần nghe tối đa: {String(payload.maxListens)} lần
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs italic text-[var(--ink-3)]">Chưa gắn file âm thanh.</p>
        )
      ) : null}

      {type === 'IMAGE_BASED' ? (
        <div className="space-y-1.5">
          {mediaId && assessmentId ? (
            <MediaThumb
              assessmentId={assessmentId}
              mediaId={mediaId}
              className="max-h-56 w-auto rounded-lg border border-[var(--line)] object-contain"
            />
          ) : null}
          {payload.caption ? (
            <p className="text-xs italic text-[var(--ink-2)]">{String(payload.caption)}</p>
          ) : null}
        </div>
      ) : null}

      {options.length > 0 ? (
        <div className={type === 'IMAGE_BASED' ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'space-y-1.5'}>
          {options.map((opt, idx) => (
            <label
              key={`${opt.id}-${idx}`}
              className="flex items-start gap-2.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={`preview-${groupId}`}
                checked={false}
                disabled
                onChange={() => undefined}
                aria-label={`Phương án ${opt.id.toUpperCase()}`}
                className="mt-1"
              />
              <span className="font-semibold text-[var(--ink-2)]">{opt.id.toUpperCase()}.</span>
              <span className="min-w-0 flex-1 space-y-1.5">
                {opt.text ? <span className="block break-words">{opt.text}</span> : null}
                {opt.imageMediaId && assessmentId ? (
                  <MediaThumb
                    assessmentId={assessmentId}
                    mediaId={opt.imageMediaId}
                    className="max-h-32 w-auto rounded border border-[var(--line)] object-contain"
                  />
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : type === 'LISTENING' || type === 'IMAGE_BASED' ? (
        <input
          type="text"
          disabled
          readOnly
          className={PREVIEW_FIELD}
          placeholder={
            type === 'LISTENING'
              ? 'Học viên sẽ nhập câu trả lời nghe tại đây...'
              : 'Học viên sẽ nhập câu trả lời hình ảnh tại đây...'
          }
          aria-label={
            type === 'LISTENING' ? 'Ô trả lời nghe học viên' : 'Ô trả lời hình ảnh học viên'
          }
        />
      ) : null}
    </div>
  );
}

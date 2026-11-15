'use client';

import React from 'react';
import type { TeacherQuestionDto } from '@/features/assessments/api/assessments.api';
import { asOptions, asStrings } from '@/features/assessments/utils/question-payload';

export interface OriginalPaperPreviewProps {
  title: string;
  originalFileName?: string | null;
  original: { url: string; name: string; isPdf: boolean } | null;
  questions: TeacherQuestionDto[];
}

/**
 * Sticky left-hand comparison pane showing the uploaded PDF iframe or a structured paper preview for Word imports.
 */
export function OriginalPaperPreview({
  title,
  originalFileName,
  original,
  questions,
}: OriginalPaperPreviewProps) {
  const displayFileName = original?.name || originalFileName || 'Bản xem đối chiếu';

  return (
    <aside
      aria-label="Đề gốc đối chiếu"
      className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs lg:sticky lg:top-20"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[var(--ink)]">Đề gốc</h2>
          <p className="truncate text-xs text-[var(--ink-3)]" title={displayFileName}>
            {displayFileName}
          </p>
        </div>
        {original ? (
          <a
            href={original.url}
            download={original.name}
            className="shrink-0 rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--hover)]"
          >
            Tải file gốc
          </a>
        ) : null}
      </div>

      <div className="bg-[var(--surface-2)]/60 p-3.5 text-sm text-[var(--ink-2)]">
        {original?.isPdf ? (
          <iframe
            title="Xem file gốc"
            src={original.url}
            className="h-[520px] w-full rounded-lg border border-[var(--line)] bg-white"
          />
        ) : (
          <div className="max-h-[540px] space-y-3 overflow-y-auto rounded-lg border border-[var(--line)] bg-[#FBFBF8] p-4 text-[13px] leading-relaxed text-[var(--ink)] shadow-inner">
            <div className="border-b border-[var(--line)] pb-2.5 text-center">
              <div className="text-sm font-bold text-[var(--ink)]">{title || 'Bản xem đề đã tách'}</div>
              <div className="num text-xs text-[var(--ink-3)]">
                {questions.length} câu hỏi nhận diện từ file tải lên
              </div>
            </div>

            {questions.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--ink-3)]">
                File gốc được giữ để đối chiếu khi tải lên. Kiểm tra từng câu bên phải trước khi phát hành.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {questions.map((q, idx) => {
                  const options = asOptions(q.payload);
                  const tokens = asStrings(q.payload, 'tokens');
                  return (
                    <li
                      key={q.id}
                      className={
                        q.needsReview
                          ? 'rounded-r-md border-l-[3px] border-[var(--amber)] bg-[var(--amber-soft)] px-2.5 py-2'
                          : 'px-1 py-0.5'
                      }
                    >
                      <div className="font-medium text-[var(--ink)]">
                        <span className="num font-bold">Câu {idx + 1}</span>{' '}
                        <span className="num text-xs text-[var(--ink-3)]">({q.points}đ)</span>:{' '}
                        <span>{q.prompt}</span>
                      </div>
                      {options.length > 0 ? (
                        <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 pl-3 text-xs text-[var(--ink-2)] sm:grid-cols-2">
                          {options.map((opt, optIdx) => (
                            <div key={opt.id}>
                              <span className="font-semibold">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>{' '}
                              {opt.text || '—'}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {q.type === 'ORDERING' && tokens.length > 0 ? (
                        <div className="mt-1 pl-3 text-xs text-[var(--ink-2)]">
                          Từ/cụm: {tokens.join(' / ')}
                        </div>
                      ) : null}
                      {q.needsReview ? (
                        <div className="mt-1 pl-1 text-[11px] font-medium text-[var(--amber)]">
                          Không tìm thấy đáp án hoặc cần rà soát lại ở cột bên phải.
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

'use client';

import Image from 'next/image';
import React from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import { getAssignmentMediaUrl } from '@/features/assignments/api/assignments.api';

interface QuestionStemMediaProps {
  assignmentId: string;
  questionId: string;
  questionType: QuestionType;
  mediaId?: unknown;
  caption?: unknown;
}

export function QuestionStemMedia({
  assignmentId,
  questionId,
  questionType,
  mediaId,
  caption,
}: QuestionStemMediaProps) {
  const cleanMediaId = typeof mediaId === 'string' && mediaId.trim() ? mediaId.trim() : null;
  if (!cleanMediaId) return null;

  const cleanCaption = typeof caption === 'string' && caption.trim() ? caption.trim() : null;
  const mediaUrl = getAssignmentMediaUrl(assignmentId, cleanMediaId, questionId);

  if (questionType === 'LISTENING') {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase text-[var(--ink-3)]">
          File âm thanh câu hỏi
        </div>
        <audio
          controls
          preload="metadata"
          crossOrigin="use-credentials"
          src={mediaUrl}
          aria-label={`Âm thanh câu hỏi ${questionId}`}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  if (questionType === 'IMAGE_BASED') {
    return (
      <figure className="space-y-1.5">
        <Image
          src={mediaUrl}
          alt={cleanCaption || 'Hình minh họa câu hỏi'}
          width={560}
          height={320}
          unoptimized
          crossOrigin="use-credentials"
          className="max-h-64 w-auto rounded-xl border border-[var(--line)] object-contain bg-white"
        />
        {cleanCaption ? (
          <figcaption className="text-xs italic text-[var(--ink-2)]">{cleanCaption}</figcaption>
        ) : null}
      </figure>
    );
  }

  return null;
}

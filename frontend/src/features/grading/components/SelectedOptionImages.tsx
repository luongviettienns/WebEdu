'use client';

import Image from 'next/image';
import React from 'react';
import { getAssignmentMediaUrl } from '@/features/assignments/api/assignments.api';
import type { SelectedOptionDisplayItem } from '@/features/grading/utils/grading-status';

export function SelectedOptionImages({
  assignmentId,
  items,
}: {
  assignmentId: string;
  items: ReadonlyArray<SelectedOptionDisplayItem>;
}) {
  const withImages = items.filter((item) => item.imageMediaId);
  if (withImages.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {withImages.map((item) => (
        <figure
          key={item.id}
          className="overflow-hidden rounded-lg border border-[var(--line)] bg-white p-1.5"
        >
          <Image
            src={getAssignmentMediaUrl(assignmentId, item.imageMediaId!)}
            alt={item.text || `Hình phương án ${item.letter || item.id}`}
            width={180}
            height={110}
            unoptimized
            crossOrigin="use-credentials"
            className="max-h-28 w-auto rounded object-contain"
          />
          {item.letter ? (
            <figcaption className="mt-1 text-center text-[11px] font-semibold text-[var(--ink-2)]">
              Phương án {item.letter}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

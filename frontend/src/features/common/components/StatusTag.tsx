'use client';

import React from 'react';
import type { UserStatus } from '@/types/user';

export type StatusTagTone = 'jade' | 'amber' | 'blue' | 'grey' | 'red' | 'outline';

const TONE_CLASSES: Record<StatusTagTone, string> = {
  jade: 'bg-[var(--jade-soft)] text-[var(--jade)]',
  amber: 'bg-[var(--amber-soft)] text-[var(--amber)]',
  blue: 'bg-[var(--blue-soft)] text-[var(--blue)]',
  grey: 'bg-[var(--grey-soft)] text-[var(--grey)]',
  red: 'bg-[var(--red-soft)] text-[var(--red-ink)]',
  outline: 'border border-[var(--line-2)] bg-transparent text-[var(--ink-2)]',
};

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-5 px-1.5 text-[11px]',
  md: 'h-[22px] px-2 text-xs',
};

export interface StatusTagProps {
  tone?: StatusTagTone;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Thẻ trạng thái chuẩn mực Paper-Ink (khớp `.tag` trong prototype TD Hán Ngữ):
 * bo góc 5px đồng bộ con dấu `.seal`, chấm mực 6px và luôn giữ trên 1 dòng.
 */
export function StatusTag({
  tone = 'grey',
  size = 'md',
  dot = true,
  className = '',
  children,
}: StatusTagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium leading-none ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-85"
        />
      ) : null}
      <span>{children}</span>
    </span>
  );
}

export function getUserStatusTone(status: UserStatus | string): StatusTagTone {
  if (status === 'ACTIVE') return 'jade';
  if (status === 'PENDING_CLASS') return 'amber';
  return 'grey';
}

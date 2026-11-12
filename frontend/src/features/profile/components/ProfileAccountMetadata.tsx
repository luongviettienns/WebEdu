'use client';

import React from 'react';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import { ROLE_LABELS, STATUS_LABELS } from '@/types/user';

interface ProfileAccountMetadataProps {
  profile: UserProfileDto;
}

export function ProfileAccountMetadata({
  profile,
}: ProfileAccountMetadataProps) {
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-3">
      <div>
        <span className="block text-xs font-medium text-[var(--ink-2)]">
          Vai trò
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {(profile.roles ?? []).map((r) => (
            <span
              key={r}
              className="inline-flex rounded-md bg-[var(--jade-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--jade)] border border-[var(--jade)]/20"
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-[var(--ink-2)]">
          Trạng thái tài khoản
        </span>
        <span className="mt-1 inline-flex rounded-md bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]">
          {profile.status ? STATUS_LABELS[profile.status] : 'Đang hoạt động'}
        </span>
      </div>

      <div>
        <span className="block text-xs font-medium text-[var(--ink-2)]">
          Lớp đang học / phụ trách
        </span>
        <span className="mt-1 block text-sm font-semibold text-[var(--ink)]">
          {profile.assignedClass ||
            (typeof profile.activeClassesCount === 'number' &&
            profile.activeClassesCount > 0
              ? `${profile.activeClassesCount} lớp đang phụ trách`
              : 'Chưa xếp lớp')}
        </span>
      </div>
    </div>
  );
}

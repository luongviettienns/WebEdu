'use client';

import Link from 'next/link';
import React from 'react';
import { ClassDetailView } from '@/features/classes/components/ClassDetailView';
import { useClassDetail } from '@/features/classes/hooks/useClassDetail';
import {
  resolveClassBackHref,
  resolveClassDetailPermissions,
  type ClassRouteOrigin,
} from '@/features/classes/permissions/class-permissions';
import type { Role } from '@/types/user';

export interface ClassDetailScreenProps {
  classId: string;
  /** Ngữ cảnh điều hướng (nút quay lại). KHÔNG dùng để phân quyền. */
  origin: ClassRouteOrigin;
  assignedRoles: readonly Role[];
  defaultIncludeInactive: boolean;
  onAuthError: (error: unknown) => boolean;
}

/** Màn hình chi tiết lớp dùng chung cho /admin/classes/[id] và /teacher/classes/[id]. */
export function ClassDetailScreen({
  classId,
  origin,
  assignedRoles,
  defaultIncludeInactive,
  onAuthError,
}: ClassDetailScreenProps) {
  const state = useClassDetail({ classId, defaultIncludeInactive, onAuthError });
  const backHref = resolveClassBackHref(origin);
  const backLabel = origin === 'admin' ? 'Quay lại danh sách lớp học' : 'Quay lại danh sách Lớp học phụ trách';

  if (state.forbiddenMessage) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[var(--red)]/30 bg-white p-8 text-center shadow-xs"
      >
        <div className="font-han mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--red-soft)] text-base font-bold text-[var(--red)]">
          禁
        </div>
        <h1 className="text-lg font-bold text-[var(--ink)]">Không có quyền truy cập lớp học này</h1>
        <p className="text-sm leading-relaxed text-[var(--ink-2)]">{state.forbiddenMessage}</p>
        <Link
          href={backHref}
          className="inline-flex rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--red-ink)]"
        >
          ← {backLabel}
        </Link>
      </div>
    );
  }

  if (!state.detail) {
    if (state.loading) {
      return (
        <div
          role="status"
          className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]"
        >
          Đang tải thông tin chi tiết lớp học...
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-6 text-sm font-medium text-[var(--red-ink)]"
        >
          <span>{state.error || 'Không thể tải thông tin chi tiết lớp học'}</span>
          <button
            type="button"
            onClick={() => state.refresh()}
            className="rounded-lg border border-[var(--red)]/40 bg-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--hover)]"
          >
            Thử lại
          </button>
        </div>
        <Link
          href={backHref}
          className="inline-flex rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
        >
          ← {backLabel}
        </Link>
      </div>
    );
  }

  const permissions = resolveClassDetailPermissions(state.detail, assignedRoles);

  return (
    <div className="space-y-4">
      {state.successMessage ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]"
        >
          <span>{state.successMessage}</span>
          <button type="button" onClick={state.dismissSuccess} aria-label="Ẩn thông báo" className="text-xs font-semibold">
            Ẩn
          </button>
        </div>
      ) : null}
      {state.isStale ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-xs font-medium text-[var(--amber)]"
        >
          <span>{state.error} — đang hiển thị dữ liệu đã tải trước đó, có thể chưa mới nhất.</span>
          <button
            type="button"
            onClick={() => state.refresh()}
            className="rounded-md border border-[var(--amber)]/40 bg-white px-3 py-1 font-semibold hover:bg-[var(--hover)]"
          >
            Thử lại
          </button>
        </div>
      ) : null}
      <div aria-busy={state.loading}>
        <ClassDetailView
          detail={state.detail}
          permissions={permissions}
          backHref={backHref}
          includeInactiveEnrollments={state.includeInactive}
          onToggleIncludeInactive={state.setIncludeInactive}
          onRefresh={state.refresh}
        />
      </div>
    </div>
  );
}

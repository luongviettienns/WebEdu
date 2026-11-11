'use client';

import Link from 'next/link';
import React from 'react';
import type { ClassDetail } from '@/features/classes/api/classes.api';
import { ClassStatusBadge } from '@/features/classes/components/ClassesTableSection';
import type { ClassDetailPermissions } from '@/features/classes/permissions/class-permissions';

export interface ClassHeaderProps {
  detail: ClassDetail;
  permissions: ClassDetailPermissions;
  backHref: string;
  reopening: boolean;
  onEdit: () => void;
  onAddStudents: () => void;
  onComplete: () => void;
  onReopen: () => void;
}

export function ClassHeader({
  detail,
  permissions,
  backHref,
  reopening,
  onEdit,
  onAddStudents,
  onComplete,
  onReopen,
}: ClassHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-2)]">
          <Link href={backHref} className="font-medium hover:text-[var(--red)]">
            ← Danh sách lớp học
          </Link>
          <span>·</span>
          <span className="font-han uppercase tracking-widest text-[var(--red)]">班级详情 · CHI TIẾT LỚP HỌC</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="num text-2xl font-bold tracking-tight text-[var(--ink)]">{detail.code}</h1>
          <ClassStatusBadge status={detail.status} />
          {permissions.isReadOnly ? (
            <span className="inline-flex items-center rounded-md border border-[var(--red)]/30 bg-[var(--red-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--red-ink)]">
              印 · CHỈ ĐỌC (READ_ONLY)
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Khóa học:{' '}
          <strong className="text-[var(--ink)]">
            {detail.course.code} — {detail.course.name}
          </strong>{' '}
          · GV phụ trách: <strong className="text-[var(--ink)]">{detail.teacher.fullName}</strong>
        </p>
      </div>

      {permissions.hasAnyWriteAction ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Thao tác lớp học">
          {permissions.canEditClass ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              Chỉnh sửa lớp / Đổi GV
            </button>
          ) : null}
          {permissions.canManageEnrollments ? (
            <button
              type="button"
              onClick={onAddStudents}
              className="rounded-lg bg-[var(--jade)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95"
            >
              + Thêm học viên vào lớp
            </button>
          ) : null}
          {permissions.canComplete ? (
            <button
              type="button"
              onClick={onComplete}
              className="rounded-lg bg-[var(--red)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
            >
              Kết thúc lớp học
            </button>
          ) : null}
          {permissions.canReopen ? (
            <button
              type="button"
              disabled={reopening}
              onClick={onReopen}
              className="rounded-lg border border-[var(--amber)] bg-[var(--amber-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--amber)] hover:opacity-90 disabled:opacity-50"
            >
              Mở lại lớp học (trong 7 ngày)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

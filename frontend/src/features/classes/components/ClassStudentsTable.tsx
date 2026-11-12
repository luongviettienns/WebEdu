'use client';

import React from 'react';
import type { ClassDetail, ClassEnrollmentItem } from '@/features/classes/api/classes.api';
import {
  ENROLLMENT_DISPLAY_META,
  resolveEnrollmentDisplayKey,
} from '@/features/classes/utils/enrollment-status';
import { StatusTag } from '@/features/common/components/StatusTag';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface ClassStudentsTableProps {
  detail: Pick<ClassDetail, 'enrollments' | 'status' | 'startDate'>;
  includeInactive: boolean;
  onToggleIncludeInactive: (next: boolean) => void;
  /** Chỉ truyền khi người xem có quyền quản lý ghi danh. */
  onTransfer?: (enrollment: ClassEnrollmentItem) => void;
  onDrop?: (enrollment: ClassEnrollmentItem) => void;
  canManageEnrollments: boolean;
}

export function ClassStudentsTable({
  detail,
  includeInactive,
  onToggleIncludeInactive,
  onTransfer,
  onDrop,
  canManageEnrollments,
}: ClassStudentsTableProps) {
  const colCount = canManageEnrollments ? 6 : 5;
  return (
    <section className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">Danh sách học viên trong lớp</h2>
          <p className="text-xs text-[var(--ink-2)]">
            Theo dõi thời gian vào lớp, chuyển lớp hoặc bảo lưu của từng học viên
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ink)]">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => onToggleIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
          />
          <span>Hiện cả học viên đã chuyển / rời lớp</span>
        </label>
      </div>

      <div tabIndex={0} role="region" aria-label="Danh sách học viên trong lớp" className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            <tr>
              <th className="px-3.5 py-2.5">Họ và tên</th>
              <th className="px-3.5 py-2.5">Liên hệ</th>
              <th className="px-3.5 py-2.5">Ngày vào lớp</th>
              <th className="px-3.5 py-2.5">Ngày rời lớp</th>
              <th className="px-3.5 py-2.5">Trạng thái</th>
              {canManageEnrollments ? <th className="px-3.5 py-2.5 text-right">Thao tác</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {detail.enrollments.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-xs text-[var(--ink-3)]">
                  {includeInactive
                    ? 'Lớp học này chưa có học viên nào.'
                    : 'Chưa có học viên đang học trong lớp. Bật "Hiện cả học viên đã chuyển / rời lớp" để xem lịch sử.'}
                </td>
              </tr>
            ) : (
              detail.enrollments.map((enr) => {
                const key = resolveEnrollmentDisplayKey(enr.status, detail);
                const meta = ENROLLMENT_DISPLAY_META[key];
                return (
                  <tr key={enr.id} className="hover:bg-[var(--hover)]/60" data-enrollment-status={key}>
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-[var(--ink)]">{enr.studentFullName}</div>
                      {enr.reason ? <div className="mt-0.5 text-xs text-[var(--ink-2)]">Ghi chú: {enr.reason}</div> : null}
                    </td>
                    <td className="num px-3.5 py-3 text-xs text-[var(--ink-2)]">
                      <div>{enr.studentPhone}</div>
                      <div>{enr.studentEmail}</div>
                    </td>
                    <td className="num px-3.5 py-3 text-xs font-medium text-[var(--ink)]">
                      {formatDateDdMmYyyy(enr.enrolledDate)}
                    </td>
                    <td className="num px-3.5 py-3 text-xs text-[var(--ink-2)]">{formatDateDdMmYyyy(enr.leftDate)}</td>
                    <td className="px-3.5 py-3">
                      <StatusTag tone={meta.tone}>{meta.label}</StatusTag>
                    </td>
                    {canManageEnrollments ? (
                      <td className="space-x-1.5 whitespace-nowrap px-3.5 py-3 text-right">
                        {enr.status === 'ACTIVE' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onTransfer?.(enr)}
                              aria-label={`Chuyển lớp cho ${enr.studentFullName}`}
                              className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                            >
                              Chuyển lớp
                            </button>
                            <button
                              type="button"
                              onClick={() => onDrop?.(enr)}
                              aria-label={`Rút ${enr.studentFullName} khỏi lớp`}
                              className="rounded-md border border-[var(--red)]/30 bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--red)] hover:text-white"
                            >
                              Rút khỏi lớp
                            </button>
                          </>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

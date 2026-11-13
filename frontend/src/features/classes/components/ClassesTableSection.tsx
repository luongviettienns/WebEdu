'use client';

import Link from 'next/link';
import React from 'react';
import type { ClassItem, ClassStatus } from '@/features/classes/api/classes.api';
import { hasClassStarted } from '@/features/classes/utils/enrollment-status';
import { formatClassStatusLabel } from '@/features/classes/utils/schedule.util';
import { PaginationBar } from '@/features/common/components/PaginationBar';
import { StatusTag, type StatusTagTone } from '@/features/common/components/StatusTag';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const CLASS_STATUS_TONE: Record<ClassStatus, StatusTagTone> = {
  UPCOMING: 'amber',
  ACTIVE: 'jade',
  COMPLETED: 'grey',
  ARCHIVED: 'grey',
};

export function ClassStatusBadge({ status }: { status: ClassStatus }) {
  return (
    <StatusTag tone={CLASS_STATUS_TONE[status] ?? 'amber'}>
      {formatClassStatusLabel(status)}
    </StatusTag>
  );
}

export interface ClassesTableSectionProps {
  classes: readonly ClassItem[];
  loading: boolean;
  detailBasePath: '/admin/classes' | '/teacher/classes';
  showTeacherColumn?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  /** Quyền sửa lớp từ danh sách (lấy từ resolveClassListPermissions). */
  canEditClass?: (cls: ClassItem) => boolean;
  onEditClass?: (cls: ClassItem) => void;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function ClassesTableSection({
  classes,
  loading,
  detailBasePath,
  showTeacherColumn = true,
  emptyTitle = 'Chưa có lớp học nào',
  emptyDescription = 'Hãy mở lớp học HSK mới để bắt đầu.',
  hasActiveFilters = false,
  onClearFilters,
  canEditClass,
  onEditClass,
  pagination,
}: ClassesTableSectionProps) {
  const colSpan = showTeacherColumn ? 7 : 6;
  const isInitialLoading = loading && classes.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs" aria-busy={loading}>
      <div tabIndex={0} role="region" aria-label="Danh sách lớp học" className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Mã lớp</th>
              <th className="whitespace-nowrap px-4 py-3">Khóa học HSK</th>
              <th className="whitespace-nowrap px-4 py-3">Lịch học &amp; Thời gian</th>
              {showTeacherColumn ? <th className="whitespace-nowrap px-4 py-3">Giáo viên phụ trách</th> : null}
              <th className="whitespace-nowrap px-4 py-3 text-center">Sĩ số</th>
              <th className="whitespace-nowrap px-4 py-3">Trạng thái</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-[var(--line)] ${loading && !isInitialLoading ? 'opacity-60' : ''}`}>
            {isInitialLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  Đang tải danh sách lớp học...
                </td>
              </tr>
            ) : classes.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center">
                  <div className="font-han mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--jade-soft)] text-base font-bold text-[var(--jade)]">
                    班
                  </div>
                  {hasActiveFilters ? (
                    <>
                      <p className="mt-2.5 text-sm font-bold text-[var(--ink)]">
                        Không có lớp học nào khớp với bộ lọc hiện tại
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-xs text-[var(--ink-2)]">
                        Hãy thử đổi từ khóa, khóa học hoặc trạng thái — hoặc xóa bộ lọc để xem toàn bộ.
                      </p>
                      {onClearFilters ? (
                        <button
                          type="button"
                          onClick={onClearFilters}
                          className="mt-3 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                        >
                          Xóa bộ lọc
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="mt-2.5 text-sm font-bold text-[var(--ink)]">{emptyTitle}</p>
                      <p className="mx-auto mt-1 max-w-md text-xs text-[var(--ink-2)]">{emptyDescription}</p>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              classes.map((cls) => {
                const isEnded = cls.status === 'COMPLETED' || cls.status === 'ARCHIVED';
                const endDisplay = cls.actualEndDate ?? cls.expectedEndDate;
                const started = hasClassStarted(cls);
                const completed = Math.max(0, cls.completedSessionsCount ?? 0);
                const pct =
                  cls.totalSessions > 0
                    ? Math.min(100, Math.round((completed / cls.totalSessions) * 100))
                    : 0;
                return (
                  <tr key={cls.id} className="hover:bg-[var(--hover)]/60">
                    <td className="px-4 py-3.5">
                      <Link href={`${detailBasePath}/${cls.id}`} className="num font-bold text-[var(--red)] hover:underline">
                        {cls.code}
                      </Link>
                      {isEnded ? (
                        <div className="mt-0.5 text-[11px] font-medium text-[var(--ink-3)]">Chỉ xem (Đã đóng)</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[var(--ink)]">{cls.course.name}</div>
                      <div className="num mt-0.5 text-xs text-[var(--ink-2)]">
                        Mã khóa: {cls.course.code} · {cls.totalSessions} buổi
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="num font-semibold text-[var(--ink)]">{cls.scheduleText}</div>
                      <div className="num mt-0.5 text-xs text-[var(--ink-2)]">
                        Khai giảng: {formatDateDdMmYyyy(cls.startDate)}
                        {endDisplay ? ` → ${formatDateDdMmYyyy(endDisplay)}` : ''}
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <div className="num flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--ink-2)]">
                          <span>Tiến độ</span>
                          <span>
                            {completed}/{cls.totalSessions} buổi ({pct}%)
                          </span>
                        </div>
                        <div
                          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
                          role="progressbar"
                          aria-label={`Tiến độ lớp ${cls.code}`}
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-[var(--jade)] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {showTeacherColumn ? (
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[var(--ink)]">{cls.teacher.fullName}</div>
                        <div className="mt-0.5 text-xs text-[var(--ink-2)]">{cls.teacher.email}</div>
                      </td>
                    ) : null}
                    <td className="num px-4 py-3.5 text-center">
                      <span className="font-bold text-[var(--blue)]">{cls.activeStudentsCount}</span>
                      <span className="text-xs text-[var(--ink-3)]"> / {cls.totalEnrollmentsCount} HV</span>
                      {!isEnded && !started ? (
                        <div className="mt-0.5 text-[11px] font-medium text-[var(--blue)]">
                          Đã xếp lớp – chờ khai giảng
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <ClassStatusBadge status={cls.status} />
                    </td>
                    <td className="space-x-2 whitespace-nowrap px-4 py-3.5 text-right">
                      {onEditClass && canEditClass?.(cls) ? (
                        <button
                          type="button"
                          onClick={() => onEditClass(cls)}
                          aria-label={`Chỉnh sửa lớp ${cls.code}`}
                          className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                        >
                          Chỉnh sửa
                        </button>
                      ) : null}
                      <Link
                        href={`${detailBasePath}/${cls.id}`}
                        aria-label={`Xem chi tiết lớp ${cls.code}`}
                        className="inline-flex items-center rounded-md border border-[var(--red)]/30 bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)] transition-colors hover:bg-[var(--red)] hover:text-white"
                      >
                        Xem chi tiết lớp
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <PaginationBar
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          loading={loading}
          itemLabel="lớp học"
          onPageChange={pagination.onPageChange}
        />
      ) : null}
    </div>
  );
}

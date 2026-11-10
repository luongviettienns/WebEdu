'use client';

import Link from 'next/link';
import React from 'react';
import type {
  ClassItem,
  ClassStatus,
} from '@/features/classes/api/classes.api';
import { formatClassStatusLabel } from '@/features/classes/utils/schedule.util';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const STATUS_BADGE_STYLES: Record<ClassStatus, string> = {
  UPCOMING:
    'border border-[var(--amber)]/30 bg-[var(--amber-soft)] text-[var(--amber)]',
  ACTIVE:
    'border border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]',
  COMPLETED:
    'border border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]',
  ARCHIVED:
    'border border-[var(--line-2)] bg-[var(--grey-soft)] text-[var(--grey)]',
};

export function ClassStatusBadge({ status }: { status: ClassStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.UPCOMING}`}
    >
      {formatClassStatusLabel(status)}
    </span>
  );
}

export interface ClassesTableSectionProps {
  classes: readonly ClassItem[];
  loading: boolean;
  detailBasePath: '/admin/classes' | '/teacher/classes';
  showTeacherColumn?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onEditClass?: (cls: ClassItem) => void;
}

export function ClassesTableSection({
  classes,
  loading,
  detailBasePath,
  showTeacherColumn = true,
  emptyTitle = 'Không tìm thấy lớp học nào phù hợp',
  emptyDescription = 'Hãy thử thay đổi bộ lọc tìm kiếm hoặc mở lớp học HSK mới.',
  onEditClass,
}: ClassesTableSectionProps) {
  const colSpan = showTeacherColumn ? 7 : 6;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
      <div
        tabIndex={0}
        role="region"
        aria-label="Danh sách lớp học"
        className="overflow-x-auto"
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3">Mã lớp</th>
              <th className="px-4 py-3">Khóa học HSK</th>
              <th className="px-4 py-3">Lịch học & Thời gian</th>
              {showTeacherColumn ? (
                <th className="px-4 py-3">Giáo viên phụ trách</th>
              ) : null}
              <th className="px-4 py-3 text-center">Sĩ số đang học</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-8 text-center text-[var(--ink-3)]"
                >
                  Đang tải danh sách lớp học...
                </td>
              </tr>
            ) : classes.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--jade-soft)] text-[var(--jade)] font-bold text-base font-han">
                    班
                  </div>
                  <p className="mt-2.5 text-sm font-bold text-[var(--ink)]">
                    {emptyTitle}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-[var(--ink-2)]">
                    {emptyDescription}
                  </p>
                </td>
              </tr>
            ) : (
              classes.map((cls) => {
                const isEnded =
                  cls.status === 'COMPLETED' || cls.status === 'ARCHIVED';
                const endDisplay = cls.actualEndDate ?? cls.expectedEndDate;
                return (
                  <tr key={cls.id} className="hover:bg-[var(--hover)]/60">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`${detailBasePath}/${cls.id}`}
                        className="font-bold text-[var(--red)] hover:underline num"
                      >
                        {cls.code}
                      </Link>
                      {isEnded ? (
                        <div className="mt-0.5 text-[11px] font-medium text-[var(--ink-3)]">
                          Chỉ xem (Đã đóng)
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[var(--ink)]">
                        {cls.course.name}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-2)] num">
                        Mã khóa: {cls.course.code} · {cls.totalSessions} buổi
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[var(--ink)] num">
                        {cls.scheduleText}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-2)] num">
                        Khai giảng: {formatDateDdMmYyyy(cls.startDate)}
                        {endDisplay
                          ? ` → ${formatDateDdMmYyyy(endDisplay)}`
                          : ''}
                      </div>
                    </td>

                    {showTeacherColumn ? (
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[var(--ink)]">
                          {cls.teacher.fullName}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--ink-2)]">
                          {cls.teacher.email}
                        </div>
                      </td>
                    ) : null}

                    <td className="px-4 py-3.5 text-center num">
                      <span className="font-bold text-[var(--blue)]">
                        {cls.activeStudentsCount}
                      </span>
                      <span className="text-xs text-[var(--ink-3)]">
                        {' '}
                        / {cls.totalEnrollmentsCount} HV
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <ClassStatusBadge status={cls.status} />
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      {onEditClass && !isEnded ? (
                        <button
                          type="button"
                          onClick={() => onEditClass(cls)}
                          className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                        >
                          Chỉnh sửa
                        </button>
                      ) : null}
                      <Link
                        href={`${detailBasePath}/${cls.id}`}
                        className="inline-flex items-center rounded-md border border-[var(--red)]/30 bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--red)] hover:text-white transition-colors"
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
    </div>
  );
}

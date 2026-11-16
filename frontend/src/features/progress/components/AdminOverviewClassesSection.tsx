'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import type { ClassStatus } from '@/features/classes/api/classes.types';
import { ClassStatusBadge } from '@/features/classes/components/ClassesTableSection';
import type {
  AdminOverviewClassItemDto,
  AdminOverviewResponseDto,
} from '@/features/progress/types/progress.types';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const SELECT_CLS =
  'rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export interface AdminOverviewClassesSectionProps {
  classes: AdminOverviewClassItemDto[];
  filterOptions: AdminOverviewResponseDto['filterOptions'];
  loading: boolean;
  courseId: string;
  teacherId: string;
  status: ClassStatus | '';
  includeEnded: boolean;
  onCourseChange: (value: string) => void;
  onTeacherChange: (value: string) => void;
  onStatusChange: (value: ClassStatus | '') => void;
  onIncludeEndedChange: (checked: boolean) => void;
  onClearFilters: () => void;
}

export function AdminOverviewClassesSection({
  classes,
  filterOptions,
  loading,
  courseId,
  teacherId,
  status,
  includeEnded,
  onCourseChange,
  onTeacherChange,
  onStatusChange,
  onIncludeEndedChange,
  onClearFilters,
}: AdminOverviewClassesSectionProps) {
  const router = useRouter();
  const hasFilters = Boolean(courseId || teacherId || status || includeEnded);

  return (
    <div className="min-w-0 space-y-4 xl:col-span-8">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <div className="flex min-w-[170px] flex-col gap-1">
            <label htmlFor="overview-filter-course" className="text-xs font-semibold text-[var(--ink-2)]">
              Khóa HSK
            </label>
            <select
              id="overview-filter-course"
              value={courseId}
              onChange={(e) => onCourseChange(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Tất cả khóa học</option>
              {filterOptions.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-[170px] flex-col gap-1">
            <label htmlFor="overview-filter-teacher" className="text-xs font-semibold text-[var(--ink-2)]">
              Giáo viên
            </label>
            <select
              id="overview-filter-teacher"
              value={teacherId}
              onChange={(e) => onTeacherChange(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Tất cả giáo viên</option>
              {filterOptions.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-[150px] flex-col gap-1">
            <label htmlFor="overview-filter-status" className="text-xs font-semibold text-[var(--ink-2)]">
              Trạng thái
            </label>
            <select
              id="overview-filter-status"
              value={status}
              onChange={(e) => onStatusChange(e.target.value as ClassStatus | '')}
              className={SELECT_CLS}
            >
              <option value="">Tất cả</option>
              <option value="UPCOMING">Sắp mở</option>
              <option value="ACTIVE">Đang học</option>
              <option value="COMPLETED">Đã kết thúc</option>
              <option value="ARCHIVED">Đã lưu trữ</option>
            </select>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-xs font-medium text-[var(--ink)]">
            <input
              id="overview-filter-include-ended"
              type="checkbox"
              checked={includeEnded}
              onChange={(e) => onIncludeEndedChange(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
            />
            <span>Hiện lớp đã kết thúc</span>
          </label>
        </div>

        <div className="flex items-center gap-3 pb-1 text-xs">
          <span className="num font-medium text-[var(--ink-3)]">{classes.length} lớp</span>
          {hasFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="font-semibold text-[var(--blue)] hover:underline"
            >
              Xóa lọc
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xs"
        aria-busy={loading}
      >
        <div
          tabIndex={0}
          role="region"
          aria-label="Bảng tổng quan tình trạng các lớp học"
          className="overflow-x-auto"
        >
          <table
            data-testid="admin-overview-classes-table"
            className="w-full min-w-[760px] text-left text-xs"
          >
            <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th scope="col" className="px-4 py-3">Mã lớp &amp; Khóa học</th>
                <th scope="col" className="px-3.5 py-3">Giáo viên</th>
                <th scope="col" className="px-3.5 py-3">Tiến độ</th>
                <th scope="col" className="px-3.5 py-3">Buổi tiếp theo</th>
                <th scope="col" className="px-3 py-3 text-center">Sĩ số</th>
                <th scope="col" className="px-3 py-3 text-center">Chuyên cần TB</th>
                <th scope="col" className="px-3.5 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-[var(--line)] ${loading ? 'opacity-60' : ''}`}>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="font-han mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-base font-bold text-[var(--red)]">
                      班
                    </div>
                    <p className="mt-2 text-sm font-bold text-[var(--ink)]">
                      Không có lớp học nào phù hợp với bộ lọc hiện tại
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-2)]">
                      Hãy thay đổi tiêu chí lọc hoặc bật tùy chọn xem lớp đã kết thúc.
                    </p>
                  </td>
                </tr>
              ) : (
                classes.map((row) => (
                  <tr
                    key={row.classId}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('a, button')) return;
                      router.push(`/admin/classes/${row.classId}`);
                    }}
                    className="cursor-pointer hover:bg-[var(--hover)]/60"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/classes/${row.classId}`}
                        className="num font-bold text-[var(--red)] hover:underline"
                      >
                        {row.classCode}
                      </Link>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--ink-2)]">
                        {row.courseName}
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5 font-medium text-[var(--ink)]">
                      {row.teacherName}
                    </td>
                    <td className="px-3.5 py-3.5">
                      <div className="num font-semibold text-[var(--ink)]">
                        {row.completedSessionsCount}/{row.totalSessions} buổi · {row.progressPercent}%
                      </div>
                      <div
                        className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-[var(--surface-2)]"
                        role="progressbar"
                        aria-label={`Tiến độ lớp ${row.classCode}`}
                        aria-valuenow={row.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full bg-[var(--jade)] transition-all duration-300"
                          style={{ width: `${row.progressPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="num px-3.5 py-3.5 text-[var(--ink-2)]">
                      {row.nextSession ? (
                        <>
                          <div className="font-semibold text-[var(--ink)]">
                            {formatDateDdMmYyyy(row.nextSession.sessionDate)}
                          </div>
                          <div className="text-[11px]">
                            {row.nextSession.startTime}–{row.nextSession.endTime}
                            {row.nextSession.isMakeup ? ' · Học bù' : ''}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num px-3 py-3.5 text-center font-semibold text-[var(--ink)]">
                      {row.enrolledCount}
                    </td>
                    <td className="num px-3 py-3.5 text-center font-semibold text-[var(--ink)]">
                      {row.averageAttendanceRatePercent !== null
                        ? `${row.averageAttendanceRatePercent}%`
                        : '—'}
                    </td>
                    <td className="px-3.5 py-3.5">
                      <ClassStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

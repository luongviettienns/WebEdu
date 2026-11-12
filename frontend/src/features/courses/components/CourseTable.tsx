'use client';

import React from 'react';
import { StatusTag } from '@/features/common/components/StatusTag';
import { COURSE_LEVEL_HAN, type CourseItemDto } from '@/features/courses/api/courses.api';

export interface CourseTableProps {
  loading: boolean;
  loaded: boolean;
  courses: readonly CourseItemDto[];
  hasFilters: boolean;
  onClearFilters: () => void;
  onEdit: (course: CourseItemDto) => void;
  onDeactivate: (course: CourseItemDto) => void;
  onReactivate: (course: CourseItemDto) => void;
}

export function CourseTable({
  loading,
  loaded,
  courses,
  hasFilters,
  onClearFilters,
  onEdit,
  onDeactivate,
  onReactivate,
}: CourseTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Danh sách khóa học HSK">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3">Mã khóa</th>
              <th className="px-4 py-3">Tên khóa học & Giáo trình</th>
              <th className="px-4 py-3">Cấp độ</th>
              <th className="px-4 py-3 text-center">Số buổi mặc định</th>
              <th className="px-4 py-3 text-center">Lớp đang mở / Tổng lớp</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading && !loaded ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  Đang tải danh mục khóa học HSK...
                </td>
              </tr>
            ) : courses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  {hasFilters ? (
                    <div className="space-y-2">
                      <p>Không tìm thấy khóa học nào phù hợp với bộ lọc.</p>
                      <button
                        type="button"
                        onClick={onClearFilters}
                        className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  ) : (
                    'Chưa có khóa học nào trong danh mục.'
                  )}
                </td>
              </tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id} className="hover:bg-[var(--hover)]/60">
                  <td className="px-4 py-3.5 font-bold text-[var(--ink)] num">{course.code}</td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-[var(--ink)]">{course.name}</div>
                    {course.description ? (
                      <div className="mt-0.5 text-xs text-[var(--ink-2)]">{course.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-[var(--red)]/25 bg-[var(--red-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--red-ink)]">
                      <span className="font-han">{COURSE_LEVEL_HAN[course.level]}</span>
                      <span>{course.levelLabel}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center font-medium text-[var(--ink)] num">
                    {course.defaultSessions ? `${course.defaultSessions} buổi` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center font-medium text-[var(--ink)] num">
                    <span className="font-bold text-[var(--blue)]">{course.activeClassesCount}</span>
                    {' / '}
                    <span>{course.totalClassesCount}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusTag tone={course.isActive ? 'jade' : 'grey'}>
                      {course.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                    </StatusTag>
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => onEdit(course)}
                      className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => (course.isActive ? onDeactivate(course) : onReactivate(course))}
                      className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
                    >
                      {course.isActive ? 'Ngừng sử dụng' : 'Kích hoạt lại'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { type TeacherItemDto } from '../api/teachers.api';
import { STATUS_LABELS } from '@/types/user';

interface TeacherListTableProps {
  teachers: TeacherItemDto[];
  loading: boolean;
  page: number;
  total: number;
  pageLimit: number;
  onPageChange: (newPage: number) => void;
  onView: (teacher: TeacherItemDto) => void;
  onEdit: (teacher: TeacherItemDto) => void;
  onToggleStatus: (teacher: TeacherItemDto) => void;
}

export function TeacherListTable({
  teachers,
  loading,
  page,
  total,
  pageLimit,
  onPageChange,
  onView,
  onEdit,
  onToggleStatus,
}: TeacherListTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3.5">STT</th>
              <th className="px-4 py-3.5">Họ và tên</th>
              <th className="px-4 py-3.5">Số điện thoại</th>
              <th className="px-4 py-3.5">Email</th>
              <th className="px-4 py-3.5 text-center">Số lớp đang phụ trách</th>
              <th className="px-4 py-3.5">Trạng thái</th>
              <th className="px-4 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-[var(--ink-2)]"
                >
                  Đang tải danh sách giáo viên...
                </td>
              </tr>
            ) : teachers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-[var(--ink-2)]"
                >
                  Không tìm thấy giáo viên phù hợp.
                </td>
              </tr>
            ) : (
              teachers.map((teacher, idx) => {
                const isTeacherAdmin =
                  teacher.isAdmin ||
                  (Array.isArray(teacher.roles) &&
                    teacher.roles.includes('ADMIN'));
                return (
                  <tr
                    key={teacher.id}
                    className="hover:bg-[var(--hover)] transition-colors"
                  >
                    <td className="px-4 py-3.5 font-medium text-[var(--ink-2)] font-num">
                      {(page - 1) * pageLimit + idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--ink)]">
                          {teacher.fullName}
                        </span>
                        {isTeacherAdmin ? (
                          <span className="inline-flex items-center rounded-md bg-[var(--jade-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--jade)] border border-[var(--jade)]/20">
                            Admin
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--ink-2)] font-num">
                      {teacher.phone}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--ink-2)]">
                      {teacher.email}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-[var(--ink)] font-num">
                      {teacher.activeClassesCount ?? 0}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          teacher.status === 'ACTIVE'
                            ? 'bg-[var(--jade-soft)] text-[var(--jade)] border border-[var(--jade)]/20'
                            : 'bg-[var(--surface-2)] text-[var(--ink-2)]'
                        }`}
                      >
                        {STATUS_LABELS[teacher.status] ?? teacher.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onView(teacher)}
                          className="rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(teacher)}
                          className="rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--jade)] hover:bg-[var(--jade-soft)]"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(teacher)}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                            teacher.status === 'ACTIVE'
                              ? 'text-[var(--red)] hover:bg-[var(--red-soft)]'
                              : 'text-[var(--jade)] hover:bg-[var(--jade-soft)]'
                          }`}
                        >
                          {teacher.status === 'ACTIVE'
                            ? 'Vô hiệu hóa'
                            : 'Kích hoạt'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--ink-2)] font-num">
        <span>
          Trang {page} / {totalPages} (Hiển thị tối đa {pageLimit} dòng/trang)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1 font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-40"
          >
            Trang trước
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1 font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
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
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Đang tải danh sách giáo viên...
                </td>
              </tr>
            ) : teachers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-slate-500"
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
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-medium text-slate-500">
                      {(page - 1) * pageLimit + idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {teacher.fullName}
                        </span>
                        {isTeacherAdmin ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">
                            Admin
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {teacher.phone}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {teacher.email}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                      {teacher.activeClassesCount ?? 0}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          teacher.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-200 text-slate-700'
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
                          className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(teacher)}
                          className="rounded-md px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(teacher)}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                            teacher.status === 'ACTIVE'
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
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

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>
          Trang {page} / {totalPages} (Hiển thị tối đa {pageLimit} dòng/trang)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Trang trước
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>
    </div>
  );
}

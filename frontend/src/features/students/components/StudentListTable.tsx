'use client';

import React from 'react';
import { type StudentItemDto } from '../api/students.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';
import { STATUS_LABELS } from '@/types/user';

interface StudentListTableProps {
  students: StudentItemDto[];
  loading: boolean;
  page: number;
  total: number;
  pageLimit: number;
  onPageChange: (newPage: number) => void;
  onSelectStudent: (student: StudentItemDto) => void;
}

export function StudentListTable({
  students,
  loading,
  page,
  total,
  pageLimit,
  onPageChange,
  onSelectStudent,
}: StudentListTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3.5">STT</th>
              <th className="px-4 py-3.5">Họ và tên</th>
              <th className="px-4 py-3.5">Ngày sinh</th>
              <th className="px-4 py-3.5">Số điện thoại</th>
              <th className="px-4 py-3.5">Email</th>
              <th className="px-4 py-3.5">Lớp đang học</th>
              <th className="px-4 py-3.5">Trạng thái tài khoản</th>
              <th className="px-4 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Đang tải danh sách học viên...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Không tìm thấy hồ sơ học viên phù hợp.
                </td>
              </tr>
            ) : (
              students.map((student, idx) => (
                <tr
                  key={student.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-4 py-3.5 font-medium text-slate-500">
                    {(page - 1) * pageLimit + idx + 1}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900">
                    {student.fullName}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">
                    {formatDateDdMmYyyy(student.dateOfBirth)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">{student.phone}</td>
                  <td className="px-4 py-3.5 text-slate-700">{student.email}</td>
                  <td className="px-4 py-3.5 text-slate-800">
                    {student.assignedClass || (
                      <span className="text-xs italic text-slate-400">
                        Chưa xếp lớp
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        student.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : student.status === 'PENDING_CLASS'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {STATUS_LABELS[student.status] ?? student.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectStudent(student)}
                      className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                    >
                      Chi tiết & Sửa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>
          Trang {page} / {totalPages}
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

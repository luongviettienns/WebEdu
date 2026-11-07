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
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xs">
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Bảng danh sách học viên"
      >
        <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
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
          <tbody className="divide-y divide-[var(--line)] bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-[var(--ink-2)]"
                >
                  Đang tải danh sách học viên...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-[var(--ink-2)]"
                >
                  Không tìm thấy hồ sơ học viên phù hợp.
                </td>
              </tr>
            ) : (
              students.map((student, idx) => (
                <tr
                  key={student.id}
                  className="hover:bg-[var(--hover)] transition-colors"
                >
                  <td className="px-4 py-3.5 font-medium text-[var(--ink-2)] font-num">
                    {(page - 1) * pageLimit + idx + 1}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-[var(--ink)]">
                    {student.fullName}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--ink-2)] font-num">
                    {formatDateDdMmYyyy(student.dateOfBirth)}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--ink-2)] font-num">{student.phone}</td>
                  <td className="px-4 py-3.5 text-[var(--ink-2)]">{student.email}</td>
                  <td className="px-4 py-3.5 text-[var(--ink)] font-medium">
                    {student.assignedClass || (
                      <span className="text-xs italic text-[var(--ink-3)] font-normal">
                        Chưa xếp lớp
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        student.status === 'ACTIVE'
                          ? 'bg-[var(--jade-soft)] text-[var(--jade)] border border-[var(--jade)]/20'
                          : student.status === 'PENDING_CLASS'
                            ? 'bg-[var(--amber-soft)] text-[var(--amber)] border border-[var(--amber)]/20'
                            : 'bg-[var(--surface-2)] text-[var(--ink-2)]'
                      }`}
                    >
                      {STATUS_LABELS[student.status] ?? student.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectStudent(student)}
                      className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
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

      <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--ink-2)] font-num">
        <span>
          Trang {page} / {totalPages}
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

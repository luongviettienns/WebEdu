'use client';

import React from 'react';
import { type PendingStudentDto } from '../api/students.api';
import { formatDateDdMmYyyy, formatDateTimeVn } from '@/lib/utils/date';

function renderGuardianConsentLabel(
  status: PendingStudentDto['guardianConsentStatus'],
): { label: 'Đã xác nhận' | 'Không áp dụng'; isConfirmed: boolean } {
  if (status === 'CONFIRMED') {
    return { label: 'Đã xác nhận', isConfirmed: true };
  }
  return { label: 'Không áp dụng', isConfirmed: false };
}

interface PendingStudentListTableProps {
  students: PendingStudentDto[];
  loading: boolean;
  onAssignClass: (student: PendingStudentDto) => void;
}

export function PendingStudentListTable({
  students,
  loading,
  onAssignClass,
}: PendingStudentListTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3.5">Họ và tên</th>
              <th className="px-4 py-3.5">Ngày sinh</th>
              <th className="px-4 py-3.5">Số điện thoại</th>
              <th className="px-4 py-3.5">Email</th>
              <th className="px-4 py-3.5">Ngày đăng ký</th>
              <th className="px-4 py-3.5">Đồng ý cha mẹ</th>
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
                  Đang tải danh sách tài khoản chờ xếp lớp...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Hiện không có tài khoản học viên nào đang chờ xếp lớp.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const consentDisplay = renderGuardianConsentLabel(
                  student.guardianConsentStatus,
                );
                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {student.fullName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {formatDateDdMmYyyy(student.dateOfBirth)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {student.phone}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {student.email}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {formatDateTimeVn(
                        student.registeredAt ?? student.createdAt,
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          consentDisplay.isConfirmed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {consentDisplay.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onAssignClass(student)}
                        className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
                      >
                        Xếp lớp
                      </button>
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

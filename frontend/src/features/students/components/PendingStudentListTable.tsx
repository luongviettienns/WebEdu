'use client';

import React from 'react';
import { StatusTag } from '@/features/common/components/StatusTag';
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
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xs">
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Bảng danh sách học viên chờ xếp lớp"
      >
        <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
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
          <tbody className="divide-y divide-[var(--line)] bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-[var(--ink-2)]"
                >
                  Đang tải danh sách tài khoản chờ xếp lớp...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-[var(--ink-2)]"
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
                    className="hover:bg-[var(--hover)] transition-colors"
                  >
                    <td className="px-4 py-3.5 font-semibold text-[var(--ink)]">
                      {student.fullName}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--ink-2)] font-num">
                      {formatDateDdMmYyyy(student.dateOfBirth)}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--ink-2)] font-num">
                      {student.phone}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--ink-2)]">
                      {student.email}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--ink-2)] font-num">
                      {formatDateTimeVn(
                        student.registeredAt ?? student.createdAt,
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusTag tone={consentDisplay.isConfirmed ? 'jade' : 'grey'}>
                        {consentDisplay.label}
                      </StatusTag>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onAssignClass(student)}
                        className="rounded-lg bg-[var(--red)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-colors"
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

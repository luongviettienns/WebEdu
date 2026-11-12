'use client';

import Link from 'next/link';
import React from 'react';
import type { StudentItemDto } from '@/features/students/api/students.api';
import { PastClassesHistoryList } from '@/features/students/components/PastClassesHistoryList';
import { formatDateDdMmYyyy } from '@/lib/utils/date';
import type { UserStatus } from '@/types/user';

interface StudentClassStatusSectionProps {
  selectedStudent: StudentItemDto;
  isSelectedStudentEnrolled: boolean;
  editStatus: UserStatus;
  setEditStatus: (status: UserStatus) => void;
  canManageInternalNotes: boolean;
  editInternalNotes: string;
  setEditInternalNotes: (notes: string) => void;
  inputClass: string;
  labelClass: string;
}

export function StudentClassStatusSection({
  selectedStudent,
  isSelectedStudentEnrolled,
  editStatus,
  setEditStatus,
  canManageInternalNotes,
  editInternalNotes,
  setEditInternalNotes,
  inputClass,
  labelClass,
}: StudentClassStatusSectionProps) {
  return (
    <>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
          Lớp học & Lịch sử
        </h3>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--ink)]">
              {selectedStudent.assignedClass ? (
                <>
                  <span className="font-num text-[var(--jade)] font-bold">
                    {selectedStudent.assignedClass}
                  </span>
                  {selectedStudent.enrolledAt ? (
                    <span className="ml-2 text-xs font-normal text-[var(--ink-2)]">
                      (Từ {formatDateDdMmYyyy(selectedStudent.enrolledAt)})
                    </span>
                  ) : null}
                </>
              ) : (
                'Chưa được xếp lớp'
              )}
            </p>
            {selectedStudent.assignedClass ? (
              <span className="rounded-md bg-[var(--jade-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--jade)]">
                Đang học
              </span>
            ) : null}
          </div>
          <PastClassesHistoryList
            pastClasses={selectedStudent.pastClasses}
            classHistory={selectedStudent.classHistory}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="stu-status" className={labelClass}>
            Trạng thái tài khoản
          </label>
          <select
            id="stu-status"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as UserStatus)}
            className={inputClass}
          >
            {!isSelectedStudentEnrolled ? (
              <>
                <option value="PENDING_CLASS">Chờ xếp lớp</option>
                <option value="INACTIVE">Vô hiệu hóa</option>
              </>
            ) : (
              <>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Vô hiệu hóa</option>
              </>
            )}
          </select>
          {!isSelectedStudentEnrolled ? (
            <p className="text-[11px] text-[var(--ink-2)]">
              Để kích hoạt sang <strong>Đang hoạt động</strong>, vui lòng thực
              hiện tại{' '}
              <Link
                href="/admin/students/pending"
                className="font-semibold text-[var(--red)] underline hover:text-[var(--red-ink)]"
              >
                Danh sách chờ xếp lớp
              </Link>
              .
            </p>
          ) : null}
        </div>
      </div>

      {canManageInternalNotes ? (
        <>
          <div className="h-px bg-[var(--line)]" />
          <div className="space-y-1.5">
            <label htmlFor="stu-internal-notes" className={labelClass}>
              Ghi chú nội bộ (Chỉ Admin xem)
            </label>
            <textarea
              id="stu-internal-notes"
              rows={3}
              value={editInternalNotes}
              onChange={(e) => setEditInternalNotes(e.target.value)}
              placeholder="Ghi chú xếp lớp, nhu cầu học tập, lưu ý phụ huynh..."
              className={inputClass}
            />
          </div>
        </>
      ) : null}
    </>
  );
}

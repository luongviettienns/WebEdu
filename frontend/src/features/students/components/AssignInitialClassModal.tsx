'use client';

import React, { useState } from 'react';
import {
  assignStudentInitialClass,
  type AvailableClassDto,
  type PendingStudentDto,
} from '@/features/students/api/students.api';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

function getTodayDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function formatAvailableClassOption(cls: AvailableClassDto): string {
  const statusLabel =
    cls.status === 'UPCOMING' ? 'Sắp khai giảng' : 'Đang học';
  return `${cls.code} — ${cls.courseName} (${statusLabel} • GV: ${cls.teacherName})`;
}

interface AssignInitialClassModalProps {
  targetStudent: PendingStudentDto;
  availableClasses: AvailableClassDto[];
  onClose: () => void;
  onSuccess: (studentFullName: string, assignedClassCode: string) => void;
  onAuthError: (error: unknown) => boolean;
}

export function AssignInitialClassModal({
  targetStudent,
  availableClasses,
  onClose,
  onSuccess,
  onAuthError,
}: AssignInitialClassModalProps) {
  const [selectedClass, setSelectedClass] = useState<string>(
    availableClasses[0]?.code ?? '',
  );
  const [enrolledAt, setEnrolledAt] = useState<string>(() =>
    getTodayDateString(),
  );
  const [assignError, setAssignError] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  const handleConfirmAssignClass = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setAssignError('');

    if (!selectedClass.trim()) {
      setAssignError('Vui lòng chọn lớp học hợp lệ trong hệ thống');
      return;
    }
    if (!enrolledAt) {
      setAssignError('Vui lòng chọn ngày vào lớp');
      return;
    }

    setAssigning(true);
    try {
      const result = await assignStudentInitialClass(targetStudent.id, {
        classNameOrId: selectedClass.trim(),
        enrolledAt,
      });
      onSuccess(
        targetStudent.fullName,
        result.assignedClass ?? selectedClass,
      );
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setAssignError(
        extractErrorMessage(error, 'Không thể xếp lớp cho học viên này'),
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[var(--ink)]">
          Xếp Lớp Cho Học Viên
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-2)]">
          Học viên: <strong>{targetStudent.fullName}</strong> (
          {targetStudent.email})
        </p>

        {assignError ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
          >
            {assignError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleConfirmAssignClass(e)}
          noValidate
          className="mt-4 space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="assign-class-select"
              className="block text-sm font-medium text-[var(--ink)]"
            >
              Lớp học (Sắp khai giảng / Đang học){' '}
              <span className="text-[var(--red)]">*</span>
            </label>
            {availableClasses.length === 0 ? (
              <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3 text-xs font-medium text-[var(--amber)]">
                Hiện chưa có lớp học Sắp khai giảng hoặc Đang học trong hệ
                thống. Vui lòng khởi tạo lớp học trước khi xếp lớp cho học viên.
              </div>
            ) : (
              <select
                id="assign-class-select"
                required
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              >
                {availableClasses.map((cls) => (
                  <option key={cls.id} value={cls.code}>
                    {formatAvailableClassOption(cls)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="assign-enrolled-date"
              className="block text-sm font-medium text-[var(--ink)]"
            >
              Ngày vào lớp ({formatDateDdMmYyyy(enrolledAt)}){' '}
              <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="assign-enrolled-date"
              type="date"
              required
              value={enrolledAt}
              onChange={(e) => setEnrolledAt(e.target.value)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] font-num focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={assigning || availableClasses.length === 0}
              className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
            >
              {assigning ? 'Đang xếp lớp...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

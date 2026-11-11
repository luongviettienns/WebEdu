'use client';

import React from 'react';

interface BlockedTeacherDeactivationModalProps {
  activeClassesCount: number;
  onClose: () => void;
}

export function BlockedTeacherDeactivationModal({
  activeClassesCount,
  onClose,
}: BlockedTeacherDeactivationModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[var(--ink)]">
          Không thể vô hiệu hóa giáo viên
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          Giáo viên đang phụ trách <strong>{activeClassesCount}</strong> lớp.
          Vui lòng phân công giáo viên khác.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)]"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

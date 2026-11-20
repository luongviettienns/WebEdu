'use client';

import React from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';

interface BlockedTeacherDeactivationModalProps {
  activeClassesCount: number;
  onClose: () => void;
}

export function BlockedTeacherDeactivationModal({
  activeClassesCount,
  onClose,
}: BlockedTeacherDeactivationModalProps) {
  return (
    <BaseDialog
      title="Không thể vô hiệu hóa giáo viên"
      onClose={onClose}
      maxWidthClass="max-w-md"
    >
      <p className="text-sm text-[var(--ink-2)]">
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
    </BaseDialog>
  );
}

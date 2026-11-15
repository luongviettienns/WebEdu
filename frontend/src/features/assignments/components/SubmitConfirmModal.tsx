'use client';

import React from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';

export interface SubmitConfirmModalProps {
  open: boolean;
  answeredCount: number;
  totalQuestions: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SubmitConfirmModal({
  open,
  answeredCount,
  totalQuestions,
  submitting,
  onCancel,
  onConfirm,
}: SubmitConfirmModalProps) {
  if (!open) return null;
  const unanswered = Math.max(0, totalQuestions - answeredCount);

  return (
    <BaseDialog
      eyebrow="交卷确认 · XÁC NHẬN NỘP BÀI"
      title="Xác nhận nộp bài?"
      onClose={onCancel}
      busy={submitting}
      maxWidthClass="max-w-md"
    >
      <div className="mt-4 space-y-3 text-sm text-[var(--ink)]">
        <p>
          Bạn đã trả lời{' '}
          <strong className="num text-[var(--ink)]">
            {answeredCount} / {totalQuestions}
          </strong>{' '}
          câu hỏi.
        </p>
        {unanswered > 0 ? (
          <p className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] p-3 text-xs font-medium text-[var(--amber)]">
            Còn <strong className="num">{unanswered}</strong> câu chưa trả lời. Bạn có thể quay lại kiểm tra trước khi nộp.
          </p>
        ) : null}
        <p className="rounded-xl border border-[var(--red)]/20 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]">
          Bài chỉ được nộp 1 lượt chính thức. Sau khi nộp, bạn không thể chỉnh sửa bài làm trừ khi giáo viên mở lại lượt làm.
        </p>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-50"
          >
            Quay lại làm tiếp
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
          >
            {submitting ? 'Đang nộp bài...' : 'Xác nhận nộp bài'}
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}

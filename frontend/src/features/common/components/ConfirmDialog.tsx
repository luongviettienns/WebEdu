'use client';

import React, { useState } from 'react';
import { BaseDialog, DialogActions, DialogError } from '@/features/common/components/BaseDialog';

export interface ConfirmDialogProps {
  eyebrow?: string;
  title: string;
  /** Nội dung cảnh báo hậu quả của thao tác. */
  children: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Thực thi thao tác; ném lỗi để hiển thị ngay trong hộp thoại. Trả về khi thành công. */
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  errorFallback?: string;
  describeError?: (error: unknown) => string;
}

export function ConfirmDialog({
  eyebrow,
  title,
  children,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
  errorFallback = 'Không thể thực hiện thao tác lúc này',
  describeError,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(describeError ? describeError(err) : errorFallback);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog eyebrow={eyebrow} title={title} onClose={onCancel} busy={submitting}>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
        <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-sm leading-relaxed text-[var(--ink)]">
          {children}
        </div>
        <DialogError message={error} />
        <DialogActions
          onCancel={onCancel}
          submitLabel={confirmLabel}
          submittingLabel="Đang xử lý..."
          submitting={submitting}
          tone={tone}
        />
      </form>
    </BaseDialog>
  );
}

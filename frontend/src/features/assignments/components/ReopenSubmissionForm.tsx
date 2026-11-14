'use client';

import React, { useState } from 'react';
import {
  reopenSubmission,
  type TeacherTrackerStudentRowDto,
} from '@/features/assignments/api/assignments.api';
import { parseVnDateTimeLocalToIso } from '@/features/assignments/utils/exam-draft';
import {
  DIALOG_INPUT_CLS,
  DIALOG_LABEL_CLS,
  DialogError,
} from '@/features/common/components/BaseDialog';
import { extractErrorMessage } from '@/lib/api-client';

export function ReopenSubmissionForm({
  target,
  isOverdue,
  defaultNewDueAt,
  reopening,
  onBusyChange,
  onCancel,
  onSuccess,
}: {
  target: TeacherTrackerStudentRowDto;
  isOverdue: boolean;
  defaultNewDueAt: string;
  reopening: boolean;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [newDueAt, setNewDueAt] = useState(defaultNewDueAt);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.submissionId) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Vui lòng nhập lý do mở lại lượt làm.');
      return;
    }

    let isoNewDue: string | undefined;
    if (isOverdue || newDueAt.trim()) {
      const parsedIso = parseVnDateTimeLocalToIso(newDueAt);
      if (!parsedIso || new Date(parsedIso).getTime() <= Date.now()) {
        setError('Hạn nộp mới phải nằm ở tương lai.');
        return;
      }
      isoNewDue = parsedIso;
    }

    onBusyChange(true);
    setError('');
    try {
      await reopenSubmission(target.submissionId, {
        reason: trimmedReason,
        ...(isoNewDue ? { newDueAt: isoNewDue } : {}),
      });
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể mở lại lượt làm'));
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)]/50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--ink)]">
          Mở lại lượt làm cho: {target.fullName}
        </p>
        <button
          type="button"
          disabled={reopening}
          onClick={onCancel}
          className="text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)]"
        >
          Đóng biểu mẫu
        </button>
      </div>
      <DialogError message={error} />
      <div>
        <label htmlFor="reopen-reason" className={DIALOG_LABEL_CLS}>
          Lý do mở lại <span className="text-[var(--red)]">*</span>
        </label>
        <input
          id="reopen-reason"
          type="text"
          required
          className={`${DIALOG_INPUT_CLS} mt-1`}
          value={reason}
          disabled={reopening}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ví dụ: Học viên mất kết nối mạng, cho phép làm lại..."
        />
      </div>
      <div>
        <label htmlFor="reopen-due-at" className={DIALOG_LABEL_CLS}>
          Hạn nộp mới {isOverdue ? <span className="text-[var(--red)]">*</span> : '(tuỳ chọn)'}
        </label>
        <input
          id="reopen-due-at"
          type="datetime-local"
          required={isOverdue}
          className={`${DIALOG_INPUT_CLS} mt-1`}
          value={newDueAt}
          disabled={reopening}
          onChange={(e) => setNewDueAt(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={reopening}
          onClick={onCancel}
          className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={reopening}
          className="rounded-lg bg-[var(--red)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {reopening ? 'Đang mở lại...' : 'Xác nhận mở lại'}
        </button>
      </div>
    </form>
  );
}

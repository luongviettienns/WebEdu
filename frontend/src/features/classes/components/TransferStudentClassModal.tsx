'use client';

import React, { useMemo, useState } from 'react';
import {
  transferStudentClass,
  type ClassItem,
} from '@/features/classes/api/classes.api';
import {
  formatClassStatusLabel,
  getTodayVnIsoDate,
} from '@/features/classes/utils/schedule.util';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface TransferStudentClassModalProps {
  isOpen: boolean;
  sourceClassId: string;
  sourceClassCode: string;
  studentId: string;
  studentFullName: string;
  enrolledDate: string;
  availableClasses: readonly ClassItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';
const LABEL_CLS = 'block text-sm font-medium text-[var(--ink)]';

export function TransferStudentClassModal(props: TransferStudentClassModalProps) {
  if (!props.isOpen) return null;
  return (
    <TransferStudentClassModalContent
      key={`${props.sourceClassId}-${props.studentId}`}
      {...props}
    />
  );
}

function TransferStudentClassModalContent({
  sourceClassId,
  sourceClassCode,
  studentId,
  studentFullName,
  enrolledDate,
  availableClasses,
  onClose,
  onSuccess,
}: TransferStudentClassModalProps) {
  const targetOptions = useMemo(
    () =>
      availableClasses.filter(
        (cls) =>
          cls.id !== sourceClassId &&
          (cls.status === 'UPCOMING' || cls.status === 'ACTIVE'),
      ),
    [availableClasses, sourceClassId],
  );

  const [targetClassId, setTargetClassId] = useState<string>(
    () => targetOptions[0]?.id ?? '',
  );
  const [transferDate, setTransferDate] = useState<string>(() =>
    getTodayVnIsoDate(),
  );
  const [reason, setReason] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (!targetClassId) {
      setFormError('Vui lòng chọn lớp chuyển đến');
      return;
    }
    const trimmedDate = transferDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setFormError('Ngày chuyển lớp không hợp lệ');
      return;
    }
    if (enrolledDate && trimmedDate < enrolledDate) {
      setFormError(
        `Ngày chuyển lớp không được nhỏ hơn ngày vào lớp hiện tại (${formatDateDdMmYyyy(enrolledDate)})`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await transferStudentClass(sourceClassId, studentId, {
        targetClassId,
        transferDate: trimmedDate,
        reason: reason.trim() || undefined,
      });
      onSuccess();
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Không thể chuyển lớp cho học viên'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase">转班办理 · CHUYỂN LỚP HỌC VIÊN</div>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--ink)]">Chuyển Lớp Cho Học Viên</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]">Đóng</button>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-xs text-[var(--ink-2)]">
          <div>Học viên: <strong className="text-[var(--ink)]">{studentFullName}</strong></div>
          <div className="mt-0.5">
            Lớp hiện tại: <strong className="text-[var(--ink)] num">{sourceClassCode}</strong> (Ngày vào lớp: <span className="num">{formatDateDdMmYyyy(enrolledDate)}</span>)
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3 text-xs font-medium text-[var(--jade)]">
          Lịch sử học tập, điểm danh và điểm số tại lớp cũ được giữ nguyên 100%
        </div>

        {formError ? (
          <div role="alert" className="mt-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]">{formError}</div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="transfer-target-class" className={LABEL_CLS}>
              Lớp chuyển đến <span className="text-[var(--red)]">*</span>
            </label>
            {targetOptions.length === 0 ? (
              <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3 text-xs font-medium text-[var(--amber)]">
                Hiện không có lớp học Sắp mở hoặc Đang học khác để chuyển đến.
              </div>
            ) : (
              <select
                id="transfer-target-class"
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">-- Chọn lớp chuyển đến --</option>
                {targetOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.code} — {cls.course.name} ({formatClassStatusLabel(cls.status)} · GV: {cls.teacher.fullName})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="transfer-date" className={LABEL_CLS}>
              Ngày chuyển lớp ({formatDateDdMmYyyy(transferDate)}) <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="transfer-date"
              type="date"
              min={enrolledDate || undefined}
              required
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className={`${INPUT_CLS} num`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="transfer-reason" className={LABEL_CLS}>Lý do chuyển lớp</label>
            <textarea
              id="transfer-reason"
              rows={2}
              maxLength={500}
              placeholder="VD: Đổi ca học phù hợp lịch cá nhân, lên lớp trình độ cao hơn..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">Hủy</button>
            <button type="submit" disabled={submitting || targetOptions.length === 0} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50">
              {submitting ? 'Đang xử lý...' : 'Xác nhận chuyển lớp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

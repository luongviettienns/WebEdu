'use client';

import React, { useState } from 'react';
import { dropStudentFromClass } from '@/features/classes/api/classes.api';
import { getTodayVnIsoDate } from '@/features/classes/utils/schedule.util';
import { notifyPendingEnrollmentUpdated } from '@/features/students/hooks/usePendingEnrollmentCount';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface DropStudentClassModalProps {
  isOpen: boolean;
  classId: string;
  classCode: string;
  studentId: string;
  studentFullName: string;
  enrolledDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';
const LABEL_CLS = 'block text-sm font-medium text-[var(--ink)]';

export function DropStudentClassModal(props: DropStudentClassModalProps) {
  if (!props.isOpen) return null;
  return (
    <DropStudentClassModalContent
      key={`${props.classId}-${props.studentId}`}
      {...props}
    />
  );
}

function DropStudentClassModalContent({
  classId,
  classCode,
  studentId,
  studentFullName,
  enrolledDate,
  onClose,
  onSuccess,
}: DropStudentClassModalProps) {
  const [leftDate, setLeftDate] = useState<string>(() => getTodayVnIsoDate());
  const [reason, setReason] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const trimmedDate = leftDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setFormError('Ngày rời lớp không hợp lệ');
      return;
    }
    if (enrolledDate && trimmedDate < enrolledDate) {
      setFormError(
        `Ngày rời lớp không được nhỏ hơn ngày vào lớp (${formatDateDdMmYyyy(enrolledDate)})`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await dropStudentFromClass(classId, studentId, {
        leftDate: trimmedDate,
        reason: reason.trim() || undefined,
      });
      notifyPendingEnrollmentUpdated();
      onSuccess();
    } catch (error) {
      setFormError(
        extractErrorMessage(error, 'Không thể rút học viên khỏi lớp học'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase">退班保留 · RÚT LỚP / BẢO LƯU</div>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--ink)]">Rút Học Viên Khỏi Lớp {classCode}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]">Đóng</button>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-xs text-[var(--ink-2)]">
          <div>Học viên: <strong className="text-[var(--ink)]">{studentFullName}</strong></div>
          <div className="mt-0.5">
            Lớp hiện tại: <strong className="text-[var(--ink)] num">{classCode}</strong> (Ngày vào lớp: <span className="num">{formatDateDdMmYyyy(enrolledDate)}</span>)
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3 text-xs font-medium text-[var(--amber)]">
          Học viên sẽ chuyển về trạng thái Chờ xếp lớp (để có thể xếp lớp lại sau khi hết bảo lưu), toàn bộ lịch sử học tập tại lớp này được bảo toàn
        </div>

        {formError ? (
          <div role="alert" className="mt-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]">{formError}</div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="drop-left-date" className={LABEL_CLS}>
              Ngày rời lớp ({formatDateDdMmYyyy(leftDate)}) <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="drop-left-date"
              type="date"
              min={enrolledDate || undefined}
              required
              value={leftDate}
              onChange={(e) => setLeftDate(e.target.value)}
              className={`${INPUT_CLS} num`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="drop-reason" className={LABEL_CLS}>Lý do rời lớp / tạm nghỉ bảo lưu</label>
            <textarea
              id="drop-reason"
              rows={2}
              maxLength={500}
              placeholder="VD: Bảo lưu kỳ thi cuối kỳ ở trường, tạm nghỉ vì công việc..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">Hủy</button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50">
              {submitting ? 'Đang xử lý...' : 'Xác nhận rút khỏi lớp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  completeClass,
  type ClassDetail,
} from '@/features/classes/api/classes.api';
import { getTodayVnIsoDate } from '@/features/classes/utils/schedule.util';
import { notifyPendingEnrollmentUpdated } from '@/features/students/hooks/usePendingEnrollmentCount';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface CompleteClassModalProps {
  isOpen: boolean;
  classId: string;
  classCode: string;
  startDate: string;
  activeStudentsCount?: number;
  onClose: () => void;
  onSuccess: (completed: ClassDetail) => void;
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';
const LABEL_CLS = 'block text-sm font-medium text-[var(--ink)]';

export function CompleteClassModal(props: CompleteClassModalProps) {
  if (!props.isOpen) return null;
  return <CompleteClassModalContent key={props.classId} {...props} />;
}

function CompleteClassModalContent({
  classId,
  classCode,
  startDate,
  activeStudentsCount = 0,
  onClose,
  onSuccess,
}: CompleteClassModalProps) {
  const [actualEndDate, setActualEndDate] = useState<string>(() => {
    const today = getTodayVnIsoDate();
    return startDate && today < startDate ? startDate : today;
  });
  const [reason, setReason] = useState<string>('Hoàn thành khóa học');
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const trimmedDate = actualEndDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setFormError('Ngày kết thúc thực tế không hợp lệ');
      return;
    }
    if (startDate && trimmedDate < startDate) {
      setFormError(
        `Ngày kết thúc thực tế không được nhỏ hơn ngày khai giảng (${formatDateDdMmYyyy(startDate)})`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const completed = await completeClass(classId, {
        actualEndDate: trimmedDate,
        reason: reason.trim() || undefined,
      });
      notifyPendingEnrollmentUpdated();
      onSuccess(completed);
    } catch (error) {
      setFormError(
        extractErrorMessage(error, 'Không thể kết thúc lớp học lúc này'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase">
              结班归档 · KẾT THÚC KHÓA HỌC
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--ink)]">
              Kết Thúc Lớp Học {classCode}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
          >
            Đóng
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-xs leading-relaxed font-medium text-[var(--amber)]">
          Sau khi kết thúc, lớp học sẽ chuyển sang chế độ Chỉ đọc (Bảo toàn 100%
          lịch sử học tập). Học viên đang học trong lớp ({activeStudentsCount}{' '}
          học viên) sẽ hoàn thành khóa học này để sẵn sàng xếp lên lớp HSK cấp
          tiếp theo. Bạn có thể mở lại lớp trong vòng 7 ngày nếu thao tác nhầm.
        </div>

        {formError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
          >
            {formError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="mt-4 space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="complete-actual-end-date" className={LABEL_CLS}>
              Ngày kết thúc thực tế ({formatDateDdMmYyyy(actualEndDate)}){' '}
              <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="complete-actual-end-date"
              type="date"
              min={startDate || undefined}
              required
              value={actualEndDate}
              onChange={(e) => setActualEndDate(e.target.value)}
              className={`${INPUT_CLS} num`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="complete-reason" className={LABEL_CLS}>
              Ghi chú / Lý do đóng lớp
            </label>
            <textarea
              id="complete-reason"
              rows={2}
              maxLength={500}
              placeholder="Hoàn thành khóa học..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={INPUT_CLS}
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
              disabled={submitting}
              className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
            >
              {submitting ? 'Đang xử lý...' : 'Xác nhận kết thúc lớp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { dropStudentFromClass } from '@/features/classes/api/classes.api';
import { getTodayVnIsoDate } from '@/features/classes/utils/schedule.util';
import {
  BaseDialog,
  DIALOG_INPUT_CLS as INPUT_CLS,
  DIALOG_LABEL_CLS as LABEL_CLS,
  DialogActions,
  DialogError,
} from '@/features/common/components/BaseDialog';
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

export function DropStudentClassModal(props: DropStudentClassModalProps) {
  if (!props.isOpen) return null;
  return <DropStudentClassModalContent key={`${props.classId}-${props.studentId}`} {...props} />;
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
  const todayIso = getTodayVnIsoDate();
  const [leftDate, setLeftDate] = useState(todayIso);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const trimmedDate = leftDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setFormError('Ngày rời lớp không hợp lệ');
      return;
    }
    if (enrolledDate && trimmedDate < enrolledDate) {
      setFormError(`Ngày rời lớp không được nhỏ hơn ngày vào lớp (${formatDateDdMmYyyy(enrolledDate)})`);
      return;
    }
    if (trimmedDate > todayIso) {
      setFormError(
        'Ngày rời lớp không được chọn ngày trong tương lai: thao tác có hiệu lực ngay khi lưu (chưa hỗ trợ lên lịch tự động)',
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
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Không thể rút học viên khỏi lớp học'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog
      eyebrow="退班办理 · RÚT HỌC VIÊN KHỎI LỚP"
      title="Rút Học Viên Khỏi Lớp / Bảo Lưu"
      onClose={onClose}
      busy={submitting}
    >
      <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-xs text-[var(--ink-2)]">
        <div>
          Học viên: <strong className="text-[var(--ink)]">{studentFullName}</strong>
        </div>
        <div className="mt-0.5">
          Lớp: <strong className="num text-[var(--ink)]">{classCode}</strong> (Ngày vào lớp:{' '}
          <span className="num">{formatDateDdMmYyyy(enrolledDate)}</span>)
        </div>
      </div>
      <DialogError message={formError} />
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="drop-left-date" className={LABEL_CLS}>
            Ngày rời lớp ({formatDateDdMmYyyy(leftDate)}) <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="drop-left-date"
            type="date"
            min={enrolledDate || undefined}
            max={todayIso}
            required
            value={leftDate}
            onChange={(e) => setLeftDate(e.target.value)}
            className={`${INPUT_CLS} num`}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="drop-reason" className={LABEL_CLS}>
            Lý do rút lớp / bảo lưu
          </label>
          <textarea
            id="drop-reason"
            rows={2}
            maxLength={500}
            placeholder="VD: Bảo lưu chờ khóa sau, bận lịch cá nhân..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <DialogActions
          onCancel={onClose}
          submitLabel="Xác nhận rút khỏi lớp"
          submittingLabel="Đang xử lý..."
          submitting={submitting}
        />
      </form>
    </BaseDialog>
  );
}

'use client';

import React, { useState } from 'react';
import { completeClass, type ClassDetail } from '@/features/classes/api/classes.api';
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

export interface CompleteClassModalProps {
  isOpen: boolean;
  classId: string;
  classCode: string;
  startDate: string;
  activeStudentsCount?: number;
  scheduledSessionsCount?: number;
  onClose: () => void;
  onSuccess: (completed: ClassDetail) => void;
}

export function CompleteClassModal(props: CompleteClassModalProps) {
  if (!props.isOpen) return null;
  return <CompleteClassModalContent key={props.classId} {...props} />;
}

function CompleteClassModalContent({
  classId,
  classCode,
  startDate,
  activeStudentsCount = 0,
  scheduledSessionsCount,
  onClose,
  onSuccess,
}: CompleteClassModalProps) {
  const todayIso = getTodayVnIsoDate();
  const [actualEndDate, setActualEndDate] = useState(() =>
    startDate && todayIso < startDate ? startDate : todayIso,
  );
  const [reason, setReason] = useState('Hoàn thành khóa học');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const classNotStartedYet = Boolean(startDate && startDate > todayIso);

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
    if (trimmedDate > todayIso) {
      setFormError(
        'Ngày kết thúc thực tế không được chọn ngày trong tương lai: thao tác có hiệu lực ngay khi lưu (chưa hỗ trợ lên lịch tự động)',
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
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Không thể kết thúc lớp học lúc này'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog
      eyebrow="结班归档 · KẾT THÚC KHÓA HỌC"
      title={`Kết Thúc Lớp Học ${classCode}`}
      onClose={onClose}
      busy={submitting}
    >
      <div className="mt-4 space-y-2 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-xs font-medium leading-relaxed text-[var(--amber)]">
        <p className="font-semibold">
          {`Kết thúc lớp ${classCode}? Các buổi Dự kiến còn lại (${scheduledSessionsCount ?? 0} buổi) sẽ tự động chuyển sang Đã hủy.`}
        </p>
        <p>
          Sau khi kết thúc, lớp học sẽ chuyển sang chế độ Chỉ đọc (Bảo toàn 100% lịch sử học tập). Học viên
          trong lớp ({activeStudentsCount} học viên) sẽ hoàn thành khóa học này để sẵn sàng xếp lên lớp HSK cấp
          tiếp theo. Bạn có thể mở lại lớp trong vòng 7 ngày nếu thao tác nhầm.
        </p>
      </div>
      {classNotStartedYet ? (
        <div role="alert" className="mt-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]">
          Lớp khai giảng ngày {formatDateDdMmYyyy(startDate)} nên chưa thể kết thúc: ngày kết thúc thực tế không
          được ở tương lai.
        </div>
      ) : null}
      <DialogError message={formError} />
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="complete-actual-end-date" className={LABEL_CLS}>
            Ngày kết thúc thực tế ({formatDateDdMmYyyy(actualEndDate)}) <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="complete-actual-end-date"
            type="date"
            min={startDate || undefined}
            max={todayIso}
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
            maxLength={255}
            placeholder="Hoàn thành khóa học..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <DialogActions
          onCancel={onClose}
          submitLabel="Xác nhận kết thúc lớp"
          submittingLabel="Đang xử lý..."
          submitting={submitting}
          submitDisabled={classNotStartedYet}
        />
      </form>
    </BaseDialog>
  );
}

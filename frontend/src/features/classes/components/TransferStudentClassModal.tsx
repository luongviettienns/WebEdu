'use client';

import React, { useCallback, useState } from 'react';
import {
  listClasses,
  transferStudentClass,
  type ClassItem,
} from '@/features/classes/api/classes.api';
import {
  formatClassStatusLabel,
  getTodayVnIsoDate,
} from '@/features/classes/utils/schedule.util';
import {
  BaseDialog,
  DIALOG_INPUT_CLS as INPUT_CLS,
  DIALOG_LABEL_CLS as LABEL_CLS,
  DialogActions,
  DialogError,
} from '@/features/common/components/BaseDialog';
import { PagedRadioPicker } from '@/features/common/components/PagedRadioPicker';
import type { PagedOptionsFetcher } from '@/features/common/hooks/usePagedOptions';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface TransferStudentClassModalProps {
  isOpen: boolean;
  sourceClassId: string;
  sourceClassCode: string;
  studentId: string;
  studentFullName: string;
  enrolledDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

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
  onClose,
  onSuccess,
}: TransferStudentClassModalProps) {
  const todayIso = getTodayVnIsoDate();
  const [target, setTarget] = useState<ClassItem | null>(null);
  const [transferDate, setTransferDate] = useState(todayIso);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPage = useCallback<PagedOptionsFetcher<ClassItem>>(
    async ({ page, limit, search }, signal) => {
      const res = await listClasses(
        { search: search || undefined, excludeClassId: sourceClassId, page, limit },
        signal,
      );
      const items = (res.items ?? []).filter(
        (cls) => cls.id !== sourceClassId && (cls.status === 'UPCOMING' || cls.status === 'ACTIVE'),
      );
      return { items, total: res.total };
    },
    [sourceClassId],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!target) {
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
    if (trimmedDate > todayIso) {
      setFormError(
        'Ngày chuyển lớp không được chọn ngày trong tương lai: thao tác có hiệu lực ngay khi lưu (chưa hỗ trợ lên lịch tự động)',
      );
      return;
    }
    setSubmitting(true);
    try {
      await transferStudentClass(sourceClassId, studentId, {
        targetClassId: target.id,
        transferDate: trimmedDate,
        reason: reason.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Không thể chuyển lớp cho học viên'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog
      eyebrow="转班办理 · CHUYỂN LỚP HỌC VIÊN"
      title="Chuyển Lớp Cho Học Viên"
      onClose={onClose}
      busy={submitting}
    >
      <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-xs text-[var(--ink-2)]">
        <div>
          Học viên: <strong className="text-[var(--ink)]">{studentFullName}</strong>
        </div>
        <div className="mt-0.5">
          Lớp hiện tại: <strong className="num text-[var(--ink)]">{sourceClassCode}</strong> (Ngày vào lớp:{' '}
          <span className="num">{formatDateDdMmYyyy(enrolledDate)}</span>)
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3 text-xs font-medium text-[var(--jade)]">
        Lịch sử học tập, điểm danh và điểm số tại lớp cũ được giữ nguyên 100%
      </div>
      <DialogError message={formError} />

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
        <PagedRadioPicker<ClassItem>
          testId="transfer-target-picker"
          legend="Lớp chuyển đến"
          required
          searchPlaceholder="Tìm lớp theo mã lớp, tên khóa, giáo viên..."
          fetchPage={fetchPage}
          getId={(cls) => cls.id}
          selectedId={target?.id ?? ''}
          onSelect={setTarget}
          selectedSummary={target ? `${target.code} — ${target.course.name}` : undefined}
          emptyMessage="Không có lớp Sắp mở hoặc Đang học nào phù hợp để chuyển đến."
          errorFallback="Không thể tải danh sách lớp chuyển đến"
          renderOption={(cls) => (
            <>
              <span className="num font-semibold text-[var(--ink)]">{cls.code}</span> — {cls.course.name}{' '}
              <span className="text-xs text-[var(--ink-2)]">
                ({formatClassStatusLabel(cls.status)} · GV: {cls.teacher.fullName})
              </span>
            </>
          )}
        />

        <div className="space-y-1.5">
          <label htmlFor="transfer-date" className={LABEL_CLS}>
            Ngày chuyển lớp ({formatDateDdMmYyyy(transferDate)}) <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="transfer-date"
            type="date"
            min={enrolledDate || undefined}
            max={todayIso}
            required
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            className={`${INPUT_CLS} num`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="transfer-reason" className={LABEL_CLS}>
            Lý do chuyển lớp
          </label>
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

        <DialogActions
          onCancel={onClose}
          submitLabel="Xác nhận chuyển lớp"
          submittingLabel="Đang xử lý..."
          submitting={submitting}
        />
      </form>
    </BaseDialog>
  );
}

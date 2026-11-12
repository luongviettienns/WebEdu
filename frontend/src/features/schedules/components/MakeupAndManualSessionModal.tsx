'use client';

import React, { useState } from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';
import {
  addManualSession,
  createMakeupSession,
  type LessonSessionItem,
  type SessionMutationResult,
} from '@/features/schedules/api/schedules.api';
import { extractErrorMessage } from '@/lib/api-client';

export interface MakeupAndManualSessionModalProps {
  mode: 'manual' | 'makeup';
  classId: string;
  classCode: string;
  defaultDate: string;
  defaultStartTime: string;
  defaultEndTime: string;
  cancelledSession?: LessonSessionItem | null;
  onClose: () => void;
  onSuccess: (result: SessionMutationResult) => void;
}

export function MakeupAndManualSessionModal({
  mode,
  classId,
  classCode,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  cancelledSession,
  onClose,
  onSuccess,
}: MakeupAndManualSessionModalProps) {
  const [sessionDate, setSessionDate] = useState(cancelledSession?.sessionDate ?? defaultDate);
  const [startTime, setStartTime] = useState(cancelledSession?.startTime ?? defaultStartTime);
  const [endTime, setEndTime] = useState(cancelledSession?.endTime ?? defaultEndTime);
  const [topic, setTopic] = useState(cancelledSession?.topic ?? '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isMakeup = mode === 'makeup';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionDate || !startTime || !endTime || endTime <= startTime) {
      setError('Vui lòng chọn ngày và khung giờ hợp lệ (giờ kết thúc phải sau giờ bắt đầu).');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        sessionDate,
        startTime,
        endTime,
        topic: topic.trim() || undefined,
        reason: reason.trim() || undefined,
      };
      const result = isMakeup && cancelledSession
        ? await createMakeupSession(cancelledSession.id, payload)
        : await addManualSession(classId, payload);
      onSuccess(result);
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          isMakeup ? 'Không thể tạo buổi học bù. Vui lòng thử lại.' : 'Không thể thêm buổi học mới.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BaseDialog
      eyebrow={`${isMakeup ? 'TẠO BUỔI HỌC BÙ' : 'THÊM BUỔI HỌC THỦ CÔNG'} · ${classCode}`}
      title={isMakeup ? 'Xếp lịch buổi học bù' : `Thêm buổi học cho lớp ${classCode}`}
      onClose={onClose}
      busy={submitting}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {isMakeup && cancelledSession ? (
          <div className="rounded-lg border border-[var(--blue)]/30 bg-[var(--blue-soft)] px-3.5 py-2.5 text-xs text-[var(--blue)]">
            Bù cho buổi đã hủy ngày <strong className="num">{cancelledSession.sessionDate}</strong> (
            {cancelledSession.cancelReason || 'Không có ghi chú'})
          </div>
        ) : null}

        <div>
          <label htmlFor="session-slot-date" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            Ngày học <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="session-slot-date"
            type="date"
            required
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="session-slot-start" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
              Giờ bắt đầu <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="session-slot-start"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            />
          </div>
          <div>
            <label htmlFor="session-slot-end" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
              Giờ kết thúc <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="session-slot-end"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="session-slot-topic" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            Chủ đề buổi học (tùy chọn)
          </label>
          <input
            id="session-slot-topic"
            type="text"
            maxLength={200}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ví dụ: Luyện nghe HSK 2"
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          />
        </div>

        <div>
          <label htmlFor="session-slot-reason" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            Ghi chú / Lý do (tùy chọn)
          </label>
          <input
            id="session-slot-reason"
            type="text"
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isMakeup ? 'Xếp bù buổi nghỉ lễ' : 'Bổ sung buổi luyện thi cuối khóa'}
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          />
        </div>

        {error ? (
          <div role="alert" className="rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs text-[var(--red-ink)]">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-60"
          >
            {submitting ? 'Đang tạo...' : isMakeup ? 'Tạo buổi học bù' : 'Thêm buổi học'}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
}

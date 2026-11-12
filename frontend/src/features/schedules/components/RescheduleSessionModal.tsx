'use client';

import React, { useState } from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';
import {
  rescheduleSession,
  type LessonSessionItem,
  type SessionMutationResult,
} from '@/features/schedules/api/schedules.api';
import { extractErrorMessage } from '@/lib/api-client';

export interface RescheduleSessionModalProps {
  session: LessonSessionItem;
  onClose: () => void;
  onSuccess: (result: SessionMutationResult) => void;
}

export function RescheduleSessionModal({ session, onClose, onSuccess }: RescheduleSessionModalProps) {
  const [sessionDate, setSessionDate] = useState(session.sessionDate);
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);
  const [topic, setTopic] = useState(session.topic ?? '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionDate) {
      setError('Vui lòng chọn ngày học mới.');
      return;
    }
    if (!startTime || !endTime || endTime <= startTime) {
      setError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do đổi lịch để lưu nhật ký kiểm toán.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await rescheduleSession(session.id, {
        sessionDate,
        startTime,
        endTime,
        topic: topic.trim() || undefined,
        reason: reason.trim(),
      });
      onSuccess(result);
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể đổi lịch buổi học. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BaseDialog
      eyebrow={`ĐỔI LỊCH BUỔI HỌC · ${session.classCode}`}
      title={session.sessionNumber ? `Đổi lịch Buổi ${session.sessionNumber}` : 'Đổi lịch buổi học'}
      onClose={onClose}
      busy={submitting}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-xs text-[var(--ink-2)]">
          Lịch hiện tại:{' '}
          <strong className="num text-[var(--ink)]">
            {session.weekdayLabel}, {session.sessionDate} · {session.startTime}–{session.endTime}
          </strong>
        </div>

        <div>
          <label htmlFor="reschedule-date" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            Ngày học mới <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="reschedule-date"
            type="date"
            required
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reschedule-start" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
              Giờ bắt đầu <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="reschedule-start"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            />
          </div>
          <div>
            <label htmlFor="reschedule-end" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
              Giờ kết thúc <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="reschedule-end"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reschedule-topic" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            Chủ đề buổi học (tùy chọn)
          </label>
          <input
            id="reschedule-topic"
            type="text"
            maxLength={200}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ví dụ: Ôn tập Bài 5 — Ngữ pháp"
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          />
        </div>

        <div>
          <label htmlFor="reschedule-reason" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            Lý do đổi lịch <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="reschedule-reason"
            type="text"
            required
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: Giáo viên bận công tác đột xuất"
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
            {submitting ? 'Đang lưu...' : 'Xác nhận đổi lịch'}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
}

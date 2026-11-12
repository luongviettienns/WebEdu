'use client';

import React, { useState } from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';
import {
  cancelSession,
  type LessonSessionItem,
  type SessionMutationResult,
} from '@/features/schedules/api/schedules.api';
import { extractErrorMessage } from '@/lib/api-client';

export interface CancelSessionModalProps {
  session: LessonSessionItem;
  onClose: () => void;
  onSuccess: (result: SessionMutationResult) => void;
}

const PRESET_REASONS = ['Nghỉ lễ', 'Giáo viên bận', 'Trung tâm sắp xếp lại lịch', 'Khác'] as const;

export function CancelSessionModal({ session, onClose, onSuccess }: CancelSessionModalProps) {
  const [preset, setPreset] = useState<string>('Nghỉ lễ');
  const [customReason, setCustomReason] = useState('');
  const [withMakeup, setWithMakeup] = useState(false);
  const [makeupDate, setMakeupDate] = useState(session.sessionDate);
  const [makeupStart, setMakeupStart] = useState(session.startTime);
  const [makeupEnd, setMakeupEnd] = useState(session.endTime);
  const [makeupTopic, setMakeupTopic] = useState(session.topic ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const resolvedReason = preset === 'Khác' ? customReason.trim() : customReason.trim() ? `${preset}: ${customReason.trim()}` : preset;
    if (!resolvedReason) {
      setError('Vui lòng nhập lý do hủy buổi học.');
      return;
    }
    if (withMakeup && (!makeupDate || !makeupStart || !makeupEnd || makeupEnd <= makeupStart)) {
      setError('Thông tin buổi học bù chưa hợp lệ (giờ kết thúc phải sau giờ bắt đầu).');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await cancelSession(session.id, {
        reason: resolvedReason,
        makeup: withMakeup
          ? {
              sessionDate: makeupDate,
              startTime: makeupStart,
              endTime: makeupEnd,
              topic: makeupTopic.trim() || undefined,
            }
          : undefined,
      });
      onSuccess(result);
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể hủy buổi học. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BaseDialog
      eyebrow={`HỦY BUỔI HỌC · ${session.classCode}`}
      title={session.sessionNumber ? `Hủy Buổi ${session.sessionNumber} (${session.sessionDate})` : 'Hủy buổi học'}
      onClose={onClose}
      busy={submitting}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="rounded-lg border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3.5 py-2.5 text-xs text-[var(--amber)]">
          Các buổi còn lại của lớp sẽ tự động đánh lại số thứ tự liên tục 1..N (tổng số buổi của khóa giữ nguyên).
        </div>

        <div>
          <label htmlFor="cancel-preset" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            Nhóm lý do hủy <span className="text-[var(--red)]">*</span>
          </label>
          <select
            id="cancel-preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          >
            {PRESET_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cancel-detail" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
            {preset === 'Khác' ? 'Nhập lý do cụ thể *' : 'Ghi chú chi tiết (tùy chọn)'}
          </label>
          <input
            id="cancel-detail"
            type="text"
            required={preset === 'Khác'}
            maxLength={400}
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Ví dụ: Nghỉ Tết Dương lịch hoặc GV báo ốm"
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
          />
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-xs font-semibold text-[var(--ink)]">
          <input
            type="checkbox"
            checked={withMakeup}
            onChange={(e) => setWithMakeup(e.target.checked)}
            className="h-4 w-4 accent-[var(--red)]"
          />
          Tạo buổi học bù ngay sau khi hủy
        </label>

        {withMakeup ? (
          <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <div>
              <label htmlFor="cancel-mk-date" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
                Ngày học bù
              </label>
              <input
                id="cancel-mk-date"
                type="date"
                required
                value={makeupDate}
                onChange={(e) => setMakeupDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cancel-mk-start" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
                  Bắt đầu
                </label>
                <input
                  id="cancel-mk-start"
                  type="time"
                  required
                  value={makeupStart}
                  onChange={(e) => setMakeupStart(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="cancel-mk-end" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
                  Kết thúc
                </label>
                <input
                  id="cancel-mk-end"
                  type="time"
                  required
                  value={makeupEnd}
                  onChange={(e) => setMakeupEnd(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="cancel-mk-topic" className="mb-1 block text-xs font-semibold text-[var(--ink)]">
                Chủ đề buổi bù (tùy chọn)
              </label>
              <input
                id="cancel-mk-topic"
                type="text"
                maxLength={200}
                value={makeupTopic}
                onChange={(e) => setMakeupTopic(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        ) : null}

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
            Đóng
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-60"
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận hủy buổi'}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
}

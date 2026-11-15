'use client';

import React, { useState } from 'react';
import {
  adjustSubmissionGrade,
  type TeacherSubmissionGradingDetailDto,
} from '@/features/grading/api/grading.api';
import { extractErrorMessage } from '@/lib/api-client';

interface AdjustGradeDialogProps {
  open: boolean;
  detail: TeacherSubmissionGradingDetailDto;
  onClose: () => void;
  onAdjusted: () => void;
}

export function AdjustGradeDialog({
  open,
  detail,
  onClose,
  onAdjusted,
}: AdjustGradeDialogProps) {
  const [reason, setReason] = useState('');
  const [teacherFeedback, setTeacherFeedback] = useState(
    detail.submission.teacherFeedback ?? '',
  );
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const q of detail.questions) {
      map[q.questionId] =
        q.studentAnswer.earnedPoints !== null ? String(q.studentAnswer.earnedPoints) : '0';
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Bắt buộc nhập lý do chỉnh sửa điểm.');
      return;
    }

    const answers = detail.questions.map((q) => ({
      questionId: q.questionId,
      earnedPoints: Number(scores[q.questionId] ?? '0'),
    }));

    setSaving(true);
    try {
      await adjustSubmissionGrade(detail.submission.id, {
        reason: trimmedReason,
        teacherFeedback: teacherFeedback.trim() || null,
        answers,
      });
      onAdjusted();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể chỉnh sửa điểm'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-grade-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl">
        <h3 id="adjust-grade-title" className="text-lg font-bold text-[var(--ink)]">
          Chỉnh sửa điểm &amp; Ghi nhật ký kiểm toán (FUNC-061, 064)
        </h3>
        <p className="mt-1 text-xs text-[var(--ink-2)]">
          Học viên: <strong>{detail.student.fullName}</strong> · Thay đổi điểm sau khi đã xác nhận
          hoặc công bố bắt buộc phải ghi lý do vào lịch sử kiểm toán.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
            {detail.questions.map((q) => (
              <div
                key={q.questionId}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--ink)]">
                    Câu {q.position} (tối đa {q.points} đ)
                  </div>
                  <div className="truncate text-xs text-[var(--ink-3)]">{q.prompt}</div>
                </div>
                <input
                  id={`adjust-score-${q.position}`}
                  aria-label={`Điểm mới câu ${q.position}`}
                  type="number"
                  min={0}
                  max={q.points}
                  step={0.25}
                  value={scores[q.questionId] ?? '0'}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [q.questionId]: e.target.value }))
                  }
                  className="num w-24 rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-sm font-semibold"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label htmlFor="adjust-reason" className="block text-xs font-semibold text-[var(--ink)]">
              Lý do chỉnh sửa điểm <span className="text-[var(--red)]">*</span>
            </label>
            <textarea
              id="adjust-reason"
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Cộng lại 1 điểm sau khi phúc khảo bài tự luận..."
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="adjust-feedback"
              className="block text-xs font-semibold text-[var(--ink)]"
            >
              Nhận xét tổng quan mới (tùy chọn)
            </label>
            <input
              id="adjust-feedback"
              type="text"
              value={teacherFeedback}
              onChange={(e) => setTeacherFeedback(e.target.value)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-[var(--line-2)] px-4 py-2 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)]"
            >
              Hủy
            </button>
            <button
              id="btn-submit-adjust-grade"
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu chỉnh sửa điểm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

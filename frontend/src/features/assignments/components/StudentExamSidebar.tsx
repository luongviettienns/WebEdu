'use client';

import React from 'react';
import type {
  SanitizedQuestionDto,
  StudentAnswerPayload,
} from '@/features/assignments/api/assignments.api';
import type { ExamSaveState } from '@/features/assignments/hooks/useStudentExamSession';
import {
  formatCountdown,
  isQuestionAnswered,
} from '@/features/assignments/utils/exam-draft';

export interface StudentExamSidebarProps {
  questions: readonly SanitizedQuestionDto[];
  answers: Record<string, StudentAnswerPayload>;
  flaggedIds: Record<string, boolean>;
  currentIndex: number;
  remainingSeconds: number | null;
  saveState: ExamSaveState;
  lastSavedText: string;
  isOffline: boolean;
  submitting: boolean;
  onSelectQuestion: (index: number) => void;
  onSaveDraft: () => void;
  onRequestSubmit: () => void;
}

export function StudentExamSidebar({
  questions,
  answers,
  flaggedIds,
  currentIndex,
  remainingSeconds,
  saveState,
  lastSavedText,
  isOffline,
  submitting,
  onSelectQuestion,
  onSaveDraft,
  onRequestSubmit,
}: StudentExamSidebarProps) {
  const answeredCount = questions.filter((q) => isQuestionAnswered(q, answers[q.id])).length;
  const isLowTime = remainingSeconds !== null && remainingSeconds < 300;

  let saveLabel = 'Sẵn sàng lưu tự động';
  let saveToneCls = 'text-[var(--ink-2)] bg-[var(--surface-2)]';
  if (isOffline || saveState === 'offline') {
    saveLabel = 'Ngoại tuyến - đã lưu cục bộ';
    saveToneCls = 'text-[var(--amber)] bg-[var(--amber-soft)]';
  } else if (saveState === 'saving') {
    saveLabel = 'Đang lưu...';
    saveToneCls = 'text-[var(--blue)] bg-[var(--blue-soft)]';
  } else if (saveState === 'dirty') {
    saveLabel = 'Chưa lưu lên máy chủ';
    saveToneCls = 'text-[var(--amber)] bg-[var(--amber-soft)]';
  } else if (saveState === 'saved' && lastSavedText) {
    saveLabel = `Đã lưu lúc ${lastSavedText}`;
    saveToneCls = 'text-[var(--jade)] bg-[var(--jade-soft)]';
  }

  return (
    <aside className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs">
      {remainingSeconds !== null ? (
        <div
          className={`rounded-xl border px-4 py-3 text-center ${
            isLowTime
              ? 'border-[var(--red)]/40 bg-[var(--red-soft)] text-[var(--red-ink)]'
              : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)]'
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
            Thời gian còn lại
          </div>
          <div className="num mt-1 text-2xl font-bold">{formatCountdown(remainingSeconds)}</div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-center text-xs font-medium text-[var(--ink-2)]">
          Bài không giới hạn thời gian làm bài
        </div>
      )}

      <div
        role="status"
        className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${saveToneCls}`}
      >
        {saveLabel}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-2)]">
          <span>Bảng câu hỏi</span>
          <span className="num">
            {answeredCount}/{questions.length} đã làm
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const isAnswered = isQuestionAnswered(q, answers[q.id]);
            const isFlagged = Boolean(flaggedIds[q.id]);

            let stateText = 'Chưa làm';
            let pillCls = 'border-[var(--line-2)] bg-white text-[var(--ink-2)] hover:bg-[var(--hover)]';
            if (isCurrent) {
              stateText = 'Đang xem';
              pillCls = 'border-[var(--red)] bg-[var(--red)] text-white';
            } else if (isFlagged) {
              stateText = 'Đánh dấu xem lại';
              pillCls = 'border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]';
            } else if (isAnswered) {
              stateText = 'Đã trả lời';
              pillCls = 'border-[var(--jade)] bg-[var(--jade-soft)] text-[var(--jade)]';
            }

            return (
              <button
                key={q.id}
                type="button"
                aria-label={`Câu ${idx + 1} (${stateText})`}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onSelectQuestion(idx)}
                className={`num flex h-9 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${pillCls}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-[var(--ink-2)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[var(--red)]" aria-hidden="true" />
            Đang xem
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[var(--jade-soft)] border border-[var(--jade)]" aria-hidden="true" />
            Đã trả lời
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[var(--amber-soft)] border border-[var(--amber)]" aria-hidden="true" />
            Xem lại
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-white border border-[var(--line-2)]" aria-hidden="true" />
            Chưa làm
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-4">
        <button
          type="button"
          disabled={submitting || saveState === 'saving'}
          onClick={onSaveDraft}
          className="w-full rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-50"
        >
          Lưu nháp
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onRequestSubmit}
          className="w-full rounded-lg bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
        >
          {submitting ? 'Đang nộp bài...' : 'Nộp bài'}
        </button>
      </div>
    </aside>
  );
}

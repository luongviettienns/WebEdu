'use client';

import React from 'react';
import {
  ASSESSMENT_TYPE_LABELS,
  type TeacherAssessmentDto,
} from '@/features/assessments/api/assessments.api';
import type { ClassItem } from '@/features/classes/api/classes.api';
import {
  DIALOG_INPUT_CLS,
  DIALOG_LABEL_CLS,
} from '@/features/common/components/BaseDialog';
import type { LessonSessionItem } from '@/features/schedules/api/schedules.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export function AssignAssessmentFields({
  hasFixedAssessment,
  assessments,
  assessmentsLoading,
  selectedAssessmentId,
  onSelectAssessment,
  classes,
  classesLoading,
  selectedClassIds,
  onToggleClass,
  sessions,
  sessionId,
  onSelectSession,
  dueAt,
  onDueAtChange,
  instructions,
  onInstructionsChange,
  submitting,
}: {
  hasFixedAssessment: boolean;
  assessments: TeacherAssessmentDto[];
  assessmentsLoading: boolean;
  selectedAssessmentId: string;
  onSelectAssessment: (id: string) => void;
  classes: ClassItem[];
  classesLoading: boolean;
  selectedClassIds: string[];
  onToggleClass: (id: string) => void;
  sessions: LessonSessionItem[];
  sessionId: string;
  onSelectSession: (id: string) => void;
  dueAt: string;
  onDueAtChange: (value: string) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  submitting: boolean;
}) {
  return (
    <>
      {!hasFixedAssessment ? (
        <div>
          <label htmlFor="assign-assessment-select" className={DIALOG_LABEL_CLS}>
            Chọn đề đã phát hành <span className="text-[var(--red)]">*</span>
          </label>
          {assessmentsLoading ? (
            <p className="mt-1.5 text-xs text-[var(--ink-3)]">Đang tải danh sách đề...</p>
          ) : (
            <select
              id="assign-assessment-select"
              className={`${DIALOG_INPUT_CLS} mt-1.5`}
              value={selectedAssessmentId}
              disabled={submitting}
              onChange={(e) => onSelectAssessment(e.target.value)}
            >
              <option value="">-- Chọn đề kiểm tra / BTVN --</option>
              {assessments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({ASSESSMENT_TYPE_LABELS[item.type]} · {item.questionCount} câu)
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {hasFixedAssessment ? (
        <div>
          <p className={DIALOG_LABEL_CLS}>
            Chọn lớp học áp dụng <span className="text-[var(--red)]">*</span>
          </p>
          {classesLoading ? (
            <p className="mt-1.5 text-xs text-[var(--ink-3)]">Đang tải lớp học thuộc khóa...</p>
          ) : classes.length === 0 ? (
            <p className="mt-1.5 rounded-lg bg-[var(--surface-2)] p-3 text-xs text-[var(--ink-2)]">
              Không có lớp học đang mở hoặc sắp khai giảng thuộc khóa của đề này.
            </p>
          ) : (
            <div className="mt-1.5 max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5">
              {classes.map((cls) => (
                <label
                  key={cls.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--hover)]"
                >
                  <span className="flex items-center gap-2 font-medium text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(cls.id)}
                      disabled={submitting}
                      onChange={() => onToggleClass(cls.id)}
                    />
                    <span>
                      {cls.code} · {cls.course.name}
                    </span>
                  </span>
                  <span className="num text-xs text-[var(--ink-3)]">
                    {cls.activeStudentsCount} HV
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div>
        <label htmlFor="assign-due-at" className={DIALOG_LABEL_CLS}>
          Hạn nộp bài <span className="text-[var(--red)]">*</span>
        </label>
        <input
          id="assign-due-at"
          type="datetime-local"
          required
          className={`${DIALOG_INPUT_CLS} mt-1.5`}
          value={dueAt}
          disabled={submitting}
          onChange={(e) => onDueAtChange(e.target.value)}
        />
      </div>

      {selectedClassIds.length === 1 && sessions.length > 0 ? (
        <div>
          <label htmlFor="assign-session-id" className={DIALOG_LABEL_CLS}>
            Gắn buổi học (tuỳ chọn)
          </label>
          <select
            id="assign-session-id"
            className={`${DIALOG_INPUT_CLS} mt-1.5`}
            value={sessionId}
            disabled={submitting}
            onChange={(e) => onSelectSession(e.target.value)}
          >
            <option value="">Không gắn buổi học cụ thể</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sessionNumber !== null ? `Buổi ${s.sessionNumber}` : 'Buổi học'} ·{' '}
                {formatDateDdMmYyyy(s.sessionDate)} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="assign-instructions" className={DIALOG_LABEL_CLS}>
          Hướng dẫn làm bài (tuỳ chọn)
        </label>
        <textarea
          id="assign-instructions"
          rows={3}
          maxLength={2000}
          className={`${DIALOG_INPUT_CLS} mt-1.5`}
          value={instructions}
          disabled={submitting}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Ví dụ: Làm đủ tất cả câu, chú ý đọc kỹ đề nghe..."
        />
      </div>
    </>
  );
}

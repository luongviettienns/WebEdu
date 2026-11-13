'use client';

import React, { useMemo } from 'react';
import type { CourseItemDto } from '@/features/courses/api/courses.api';
import {
  ASSESSMENT_TYPE_LABELS,
  type AssessmentType,
} from '@/features/assessments/api/assessments.api';
import { AssessmentQuestionCard } from '@/features/assessments/components/AssessmentQuestionCard';
import { NewQuestionComposer } from '@/features/assessments/components/NewQuestionComposer';
import { useAssessmentWorkspace } from '@/features/assessments/hooks/useAssessments';
import { draftFromQuestion } from '@/features/assessments/utils/question-payload';

const FIELD =
  'rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)]';

export function AssessmentEditor({
  assessmentId,
  courses,
  onBack,
}: {
  assessmentId: string | null;
  courses: CourseItemDto[];
  onBack: () => void;
}) {
  const ws = useAssessmentWorkspace(assessmentId, 'edit');
  const detailCourseId = ws.detail?.courseId;

  const courseOptions = useMemo(() => {
    const active = courses.filter((c) => c.isActive);
    if (detailCourseId && !active.some((c) => c.id === detailCourseId)) {
      const existing = courses.find((c) => c.id === detailCourseId);
      return existing ? [existing, ...active] : active;
    }
    return active;
  }, [courses, detailCourseId]);

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={onBack}>
        ← Danh sách đề
      </button>
      {ws.error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-ink)]">
          {ws.error}
        </div>
      ) : null}
      {ws.saved ? (
        <p role="status" className="text-sm font-medium text-[var(--jade)]">
          {ws.saved}
        </p>
      ) : null}
      {ws.isLocked ? (
        <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-4 py-2.5 text-sm text-[var(--amber)]">
          Đề đã phát hành hoặc đã khóa, chỉ có thể xem hoặc nhân bản từ danh sách.
        </div>
      ) : null}
      <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 md:grid-cols-2">
        <input
          className={FIELD}
          value={ws.title}
          disabled={ws.isLocked || ws.saving}
          onChange={(e) => ws.setTitle(e.target.value)}
          placeholder="Tên đề"
          aria-label="Tên đề"
        />
        <select
          className={FIELD}
          value={ws.type}
          onChange={(e) => ws.setType(e.target.value as AssessmentType)}
          aria-label="Loại đề"
          disabled={Boolean(ws.detail) || ws.saving}
        >
          {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className={FIELD}
          value={ws.courseId}
          onChange={(e) => ws.setCourseId(e.target.value)}
          aria-label="Khóa HSK"
          disabled={Boolean(ws.detail) || ws.saving}
        >
          <option value="">Chọn khóa HSK</option>
          {courseOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className={FIELD}
          value={ws.durationMinutes}
          disabled={ws.isLocked || ws.saving}
          onChange={(e) => ws.setDurationMinutes(e.target.value)}
          placeholder="Thời gian (phút)"
          aria-label="Thời gian làm bài"
        />
        <textarea
          className={`${FIELD} md:col-span-2`}
          rows={2}
          value={ws.description}
          disabled={ws.isLocked || ws.saving}
          onChange={(e) => ws.setDescription(e.target.value)}
          placeholder="Mô tả đề (tuỳ chọn)"
          aria-label="Mô tả đề"
        />
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button
            type="button"
            disabled={Boolean(assessmentId && !ws.detail) || ws.isLocked || ws.saving}
            onClick={() => void ws.saveDraft()}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lưu nháp
          </button>
          <button
            type="button"
            disabled={!ws.detail || ws.isLocked || ws.questions.length === 0 || ws.hasNeedsReview || ws.saving}
            onClick={() => void ws.publish()}
            className="rounded-lg border border-[var(--blue)] bg-white px-4 py-2 text-sm font-semibold text-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Phát hành
          </button>
        </div>
      </div>

      {ws.detail ? (
        <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Câu hỏi ({ws.questions.length})</h2>
            <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => ws.setPreview((v) => !v)}>
              {ws.preview ? 'Đang xem trước như HV' : 'Xem trước như HV'}
            </button>
          </div>
          {ws.questions.map((q, index) => (
            <AssessmentQuestionCard
              key={q.id}
              question={q}
              draft={ws.drafts[q.id] ?? draftFromQuestion(q)}
              index={index}
              total={ws.questions.length}
              preview={ws.preview}
              disabled={ws.isLocked || ws.preview}
              saving={ws.saving}
              assessmentId={ws.detail!.id}
              mediaLibrary={ws.library}
              onUploadMedia={ws.handleUpload}
              onDraftChange={ws.setQuestionDraft}
              onSave={(row, patch) => void ws.handlePatchQuestion(row, patch, 'Đã lưu câu hỏi')}
              onConfirm={(row, patch) => void ws.handlePatchQuestion(row, patch)}
              onMove={(idx, delta) => void ws.handleMove(idx, delta)}
              onDelete={(row) => void ws.handleDelete(row)}
              onValidationError={ws.setError}
            />
          ))}
          {!ws.preview ? (
            <NewQuestionComposer
              assessmentId={ws.detail.id}
              mediaLibrary={ws.library}
              onUploadMedia={ws.handleUpload}
              onAdd={ws.handleAddQuestion}
              disabled={ws.isLocked}
              saving={ws.saving}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

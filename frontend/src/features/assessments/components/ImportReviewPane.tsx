'use client';

import React, { useEffect, useState } from 'react';
import { downloadOriginal } from '@/features/assessments/api/assessments.api';
import { AssessmentQuestionCard } from '@/features/assessments/components/AssessmentQuestionCard';
import { NewQuestionComposer } from '@/features/assessments/components/NewQuestionComposer';
import { useAssessmentWorkspace } from '@/features/assessments/hooks/useAssessments';
import { draftFromQuestion } from '@/features/assessments/utils/question-payload';

const FIELD =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)]';

export function ImportReviewPane({
  assessmentId,
  onBack,
  onPublished,
}: {
  assessmentId: string;
  onBack: () => void;
  onPublished: () => void;
}) {
  const ws = useAssessmentWorkspace(assessmentId, 'review');
  const [onlyReview, setOnlyReview] = useState(false);
  const [original, setOriginal] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);
  const originalFileName = ws.detail?.originalFileName;

  useEffect(() => {
    if (!originalFileName) return;
    let objectUrl = '';
    const controller = new AbortController();
    void downloadOriginal(assessmentId, controller.signal)
      .then((res) => {
        objectUrl = URL.createObjectURL(res.blob);
        setOriginal({
          url: objectUrl,
          name: res.filename,
          isPdf: res.blob.type.includes('pdf') || res.filename.toLowerCase().endsWith('.pdf'),
        });
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assessmentId, originalFileName]);

  const visibleQuestions = ws.questions.filter((q) => !onlyReview || q.needsReview);

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={onBack}>
        ← Danh sách đề
      </button>
      {ws.detail?.summary ? <p className="text-sm text-[var(--ink-2)]">{ws.detail.summary}</p> : null}
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
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
          Chỉ hiện câu cần kiểm tra
        </label>
        <button
          type="button"
          disabled={!ws.detail || ws.isLocked || ws.saving}
          className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void ws.saveDraft()}
        >
          Lưu nháp
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm font-semibold"
          onClick={() => ws.setPreview((v) => !v)}
        >
          {ws.preview ? 'Đóng xem trước' : 'Xem trước như HV'}
        </button>
        <button
          type="button"
          disabled={!ws.detail || ws.isLocked || ws.questions.length === 0 || ws.hasNeedsReview || ws.saving}
          onClick={() => void ws.publish(onPublished)}
          className="rounded-lg bg-[var(--red)] px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Phát hành
        </button>
      </div>
      {ws.detail ? (
        <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 md:grid-cols-2">
          <input
            className={FIELD}
            value={ws.title}
            disabled={ws.isLocked || ws.saving}
            onChange={(e) => ws.setTitle(e.target.value)}
            placeholder="Tên đề"
            aria-label="Tên đề"
          />
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
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--ink-2)]">
          {original ? (
            <div className="space-y-2">
              <a href={original.url} download={original.name} className="font-semibold text-[var(--blue)]">
                Tải file gốc ({original.name})
              </a>
              {original.isPdf ? (
                <iframe title="Xem file gốc" src={original.url} className="h-[480px] w-full rounded-lg bg-white" />
              ) : (
                <p>File Word được giữ để đối chiếu. Tải xuống để mở trên máy.</p>
              )}
            </div>
          ) : (
            <p>File gốc được giữ để đối chiếu khi tải lên. Kiểm tra từng câu bên phải trước khi phát hành.</p>
          )}
        </div>
        <div className="space-y-3">
          {visibleQuestions.map((q) => {
            const index = ws.questions.findIndex((item) => item.id === q.id);
            return (
              <AssessmentQuestionCard
                key={q.id}
                question={q}
                draft={ws.drafts[q.id] ?? draftFromQuestion(q)}
                index={index}
                total={ws.questions.length}
                preview={ws.preview}
                disabled={ws.isLocked || ws.preview}
                saving={ws.saving}
                assessmentId={assessmentId}
                mediaLibrary={ws.library}
                onUploadMedia={ws.handleUpload}
                onDraftChange={ws.setQuestionDraft}
                onSave={(row, patch) => void ws.handlePatchQuestion(row, patch, 'Đã lưu câu hỏi')}
                onConfirm={(row, patch) => void ws.handlePatchQuestion(row, patch)}
                onMove={(idx, delta) => void ws.handleMove(idx, delta)}
                onDelete={(row) => void ws.handleDelete(row)}
                onValidationError={ws.setError}
              />
            );
          })}
          {!ws.preview && ws.detail ? (
            <NewQuestionComposer
              assessmentId={assessmentId}
              mediaLibrary={ws.library}
              onUploadMedia={ws.handleUpload}
              onAdd={ws.handleAddQuestion}
              disabled={ws.isLocked}
              saving={ws.saving}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

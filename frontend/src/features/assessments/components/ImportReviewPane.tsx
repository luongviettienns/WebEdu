'use client';

import React, { useEffect, useState } from 'react';
import { downloadOriginal } from '@/features/assessments/api/assessments.api';
import { AssessmentQuestionCard } from '@/features/assessments/components/AssessmentQuestionCard';
import { NewQuestionComposer } from '@/features/assessments/components/NewQuestionComposer';
import { OriginalPaperPreview } from '@/features/assessments/components/OriginalPaperPreview';
import { useAssessmentWorkspace } from '@/features/assessments/hooks/useAssessments';
import {
  canAutoMatchMediaSlots,
  computeAutoMatchedMediaUpdates,
  draftFromQuestion,
} from '@/features/assessments/utils/question-payload';

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
  const [reviewCursor, setReviewCursor] = useState(0);
  const [autoMatchNotice, setAutoMatchNotice] = useState('');
  const [original, setOriginal] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);
  const originalFileName = ws.detail?.originalFileName;

  const needsReviewQuestions = ws.questions.filter((q) => q.needsReview);
  const needsReviewCount = needsReviewQuestions.length;
  const hasUnsavedChanges = Boolean(
    ws.detail &&
      (ws.title !== ws.detail.title ||
        ws.description !== (ws.detail.description ?? '') ||
        ws.durationMinutes !== (ws.detail.durationMinutes ? String(ws.detail.durationMinutes) : '') ||
        Object.keys(ws.drafts).length > 0),
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  const canAutoMatchMedia =
    !ws.isLocked &&
    !ws.preview &&
    canAutoMatchMediaSlots(ws.questions, ws.drafts, ws.library);

  const scrollToNextNeedsReview = () => {
    if (needsReviewQuestions.length === 0) return;
    const target = needsReviewQuestions[reviewCursor % needsReviewQuestions.length]!;
    setReviewCursor((prev) => prev + 1);
    document.getElementById(`question-card-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const autoMatchExtraMedia = () => {
    const updates = computeAutoMatchedMediaUpdates(ws.questions, ws.drafts, ws.library);
    for (const item of updates) {
      ws.setQuestionDraft(item.id, item.draft);
    }
    setAutoMatchNotice(
      updates.length > 0
        ? `Đã gợi ý ghép ${updates.length} file vào câu hỏi. Vui lòng nghe/xem lại rồi bấm "Lưu nháp" hoặc "Lưu & xác nhận".`
        : 'Các câu Nghe/Hình đều đã được gắn media hoặc hết file mới chưa dùng.',
    );
  };

  const visibleQuestions = ws.questions.filter((q) => !onlyReview || q.needsReview);
  const saveStateLabel = ws.saving
    ? 'Đang lưu...'
    : hasUnsavedChanges
      ? '● Có thay đổi chưa lưu nháp'
      : ws.saved
        ? '✓ Đã lưu'
        : '';

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
      {autoMatchNotice ? (
        <div className="rounded-xl border border-[var(--blue)]/30 bg-[var(--blue-soft)] px-4 py-2.5 text-xs font-medium text-[var(--blue)]">
          {autoMatchNotice}
        </div>
      ) : null}
      {ws.detail && ws.questions.length > 0 ? (
        <div className="sticky top-[62px] z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)]/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {needsReviewCount > 0 ? (
              <>
                <span className="text-[var(--amber)]">
                  Còn {needsReviewCount}/{ws.questions.length} câu màu vàng cần kiểm tra trước khi Phát hành
                </span>
                <button
                  type="button"
                  onClick={scrollToNextNeedsReview}
                  className="rounded-lg border border-[var(--amber)]/50 bg-[var(--amber-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--amber)] hover:bg-white"
                >
                  Tới câu cần kiểm tra tiếp theo ↓
                </button>
              </>
            ) : (
              <span className="text-[var(--jade)]">
                ✓ Tất cả {ws.questions.length} câu hỏi đã khớp — bạn có thể bấm Phát hành đề.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAutoMatchMedia ? (
              <button
                type="button"
                onClick={autoMatchExtraMedia}
                className="rounded-lg border border-[var(--blue)]/40 bg-[var(--blue-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-white"
              >
                Tự gợi ý ghép file Nghe/Ảnh theo thứ tự
              </button>
            ) : null}
            {saveStateLabel ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  hasUnsavedChanges
                    ? 'bg-[var(--amber-soft)] text-[var(--amber)]'
                    : 'bg-[var(--jade-soft)] text-[var(--jade)]'
                }`}
              >
                {saveStateLabel}
              </span>
            ) : null}
          </div>
        </div>
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
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <OriginalPaperPreview
            title={ws.title || ws.detail?.title || ''}
            originalFileName={ws.detail?.originalFileName}
            original={original}
            questions={ws.questions}
          />
        </div>
        <div className="space-y-3 lg:col-span-7">
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

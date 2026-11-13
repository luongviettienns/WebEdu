'use client';

import React, { useEffect, useState } from 'react';
import {
  QUESTION_TYPE_LABELS,
  addQuestion,
  deleteQuestion,
  downloadOriginal,
  emptyPayload,
  getAssessmentReview,
  listMedia,
  publishAssessment,
  reorderQuestions,
  updateQuestion,
  uploadMedia,
  type QuestionType,
  type TeacherAssessmentDto,
  type TeacherQuestionDto,
} from '@/features/assessments/api/assessments.api';
import type { MediaItem } from '@/features/assessments/components/MediaAttach';
import { QuestionTypeFields } from '@/features/assessments/components/QuestionTypeFields';
import { extractErrorMessage } from '@/lib/api-client';

const FIELD =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function ImportReviewPane({
  assessmentId,
  onBack,
  onPublished,
}: {
  assessmentId: string;
  onBack: () => void;
  onPublished: () => void;
}) {
  const [detail, setDetail] = useState<TeacherAssessmentDto | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [original, setOriginal] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);
  const [qType, setQType] = useState<QuestionType>('SINGLE_CHOICE');
  const [prompt, setPrompt] = useState('');
  const [payload, setPayload] = useState<Record<string, unknown>>(emptyPayload('SINGLE_CHOICE'));

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const row = await getAssessmentReview(assessmentId, { signal: controller.signal });
        if (!controller.signal.aborted) setDetail(row);
      } catch (err) {
        if (!controller.signal.aborted) setError(extractErrorMessage(err, 'Không thể tải bản duyệt'));
      }
    })();
    return () => controller.abort();
  }, [assessmentId]);

  useEffect(() => {
    const controller = new AbortController();
    void listMedia(assessmentId, controller.signal).then(setLibrary).catch(() => undefined);
    return () => controller.abort();
  }, [assessmentId]);

  useEffect(() => {
    if (!detail?.originalFileName) return;
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
  }, [assessmentId, detail?.originalFileName]);

  const questions = (detail?.questions ?? []).filter((q) => !onlyReview || q.needsReview);
  const blocked = (detail?.questions ?? []).some((q) => q.needsReview);

  const persistQuestion = async (q: TeacherQuestionDto, patch: { prompt?: string; payload?: Record<string, unknown> }) => {
    if (!detail) return;
    setError('');
    try {
      const updated = await updateQuestion(detail.id, q.id, patch);
      setDetail({
        ...detail,
        questions: (detail.questions ?? []).map((item) => (item.id === q.id ? updated : item)),
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể sửa câu hỏi'));
    }
  };

  const handleUpload = async (file: File) => {
    const row = await uploadMedia(assessmentId, file);
    setLibrary((curr) => [...curr, row]);
    return row.id;
  };

  const fields = {
    assessmentId,
    mediaLibrary: library,
    onUploadMedia: handleUpload,
  };

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={onBack}>
        ← Danh sách đề
      </button>
      {detail?.summary ? <p className="text-sm text-[var(--ink-2)]">{detail.summary}</p> : null}
      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-ink)]">
          {error}
        </div>
      ) : null}
      {saved ? <p className="text-sm text-[var(--jade)]">{saved}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
          Chỉ hiện câu cần kiểm tra
        </label>
        <button type="button" className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm font-semibold" onClick={() => { setSaved('Đã lưu nháp'); }}>
          Lưu nháp
        </button>
        <button type="button" className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm font-semibold" onClick={() => setPreview((v) => !v)}>
          {preview ? 'Đóng xem trước' : 'Xem trước như HV'}
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => {
            void publishAssessment(assessmentId).then(onPublished).catch((err) => {
              setError(extractErrorMessage(err, 'Không thể phát hành'));
            });
          }}
          className="rounded-lg bg-[var(--red)] px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Phát hành
        </button>
      </div>
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
          {questions.map((q) => {
            const index = (detail?.questions ?? []).findIndex((item) => item.id === q.id);
            return (
              <div
                key={q.id}
                className={`rounded-xl border p-3 ${q.needsReview ? 'border-[var(--amber)] bg-[var(--amber-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}
              >
                {q.needsReview ? <div className="mb-1 text-xs font-semibold text-[var(--amber)]">Cần kiểm tra</div> : null}
                <input
                  className="mb-2 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm"
                  value={q.prompt}
                  aria-label={`Nội dung câu ${q.position}`}
                  readOnly={preview}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDetail((curr) =>
                      curr
                        ? { ...curr, questions: (curr.questions ?? []).map((item) => (item.id === q.id ? { ...item, prompt: next } : item)) }
                        : curr,
                    );
                  }}
                  onBlur={(e) => { if (!preview) void persistQuestion(q, { prompt: e.target.value }); }}
                />
                <QuestionTypeFields
                  type={q.type}
                  payload={q.payload}
                  groupId={q.id}
                  hideAnswer={preview}
                  onChange={(next) => void persistQuestion(q, { payload: next })}
                  {...fields}
                />
                {preview ? null : (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    {q.needsReview ? (
                      <button type="button" className="text-[var(--blue)]" onClick={() => void persistQuestion(q, { prompt: q.prompt, payload: q.payload })}>
                        Lưu &amp; xác nhận
                      </button>
                    ) : null}
                    <button type="button" className="text-[var(--blue)]" onClick={() => {
                      if (!detail?.questions) return;
                      const next = [...detail.questions];
                      const j = index - 1;
                      if (j < 0) return;
                      const swap = next[index]!;
                      next[index] = next[j]!;
                      next[j] = swap;
                      void reorderQuestions(detail.id, next.map((item) => item.id))
                        .then((rows) => setDetail({ ...detail, questions: rows }))
                        .catch((err) => setError(extractErrorMessage(err, 'Không thể đổi thứ tự')));
                    }}>Lên</button>
                    <button type="button" className="text-[var(--red)]" onClick={() => {
                      if (!detail) return;
                      void deleteQuestion(detail.id, q.id)
                        .then(() => {
                          const rest = (detail.questions ?? []).filter((item) => item.id !== q.id);
                          setDetail({ ...detail, questions: rest, questionCount: rest.length });
                        })
                        .catch((err) => setError(extractErrorMessage(err, 'Không thể xóa câu hỏi')));
                    }}>Xóa câu</button>
                  </div>
                )}
              </div>
            );
          })}
          {preview ? null : (
            <div className="space-y-2 rounded-xl border border-[var(--line)] p-3">
              <select
                className={FIELD}
                value={qType}
                aria-label="Dạng câu"
                onChange={(e) => {
                  const next = e.target.value as QuestionType;
                  setQType(next);
                  setPayload(emptyPayload(next));
                }}
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <textarea className={FIELD} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Nội dung câu hỏi" aria-label="Nội dung câu hỏi mới" />
              <QuestionTypeFields type={qType} payload={payload} onChange={setPayload} {...fields} />
              <button
                type="button"
                className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm font-semibold"
                onClick={() => {
                  if (!detail) return;
                  void addQuestion(detail.id, { type: qType, prompt: prompt.trim() || 'Câu mới', payload, points: 1 })
                    .then((q) => {
                      setDetail({ ...detail, questions: [...(detail.questions ?? []), q], questionCount: (detail.questions?.length ?? 0) + 1 });
                      setPrompt('');
                      setPayload(emptyPayload(qType));
                    })
                    .catch((err) => setError(extractErrorMessage(err, 'Không thể thêm câu hỏi')));
                }}
              >
                Thêm câu
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

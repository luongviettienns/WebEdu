'use client';

import React, { useEffect, useState } from 'react';
import type { CourseItemDto } from '@/features/courses/api/courses.api';
import {
  ASSESSMENT_TYPE_LABELS,
  QUESTION_TYPE_LABELS,
  addQuestion,
  createAssessment,
  emptyPayload,
  getAssessment,
  updateQuestion,
  type AssessmentType,
  type QuestionType,
  type TeacherAssessmentDto,
  type TeacherQuestionDto,
} from '@/features/assessments/api/assessments.api';
import { QuestionTypeFields } from '@/features/assessments/components/QuestionTypeFields';
import { extractErrorMessage } from '@/lib/api-client';

const FIELD =
  'rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function AssessmentEditor({
  assessmentId,
  courses,
  onBack,
}: {
  assessmentId: string | null;
  courses: CourseItemDto[];
  onBack: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssessmentType>('HOMEWORK');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [detail, setDetail] = useState<TeacherAssessmentDto | null>(null);
  const [error, setError] = useState('');
  const [qType, setQType] = useState<QuestionType>('SINGLE_CHOICE');
  const [prompt, setPrompt] = useState('');
  const [points, setPoints] = useState('1');
  const [payload, setPayload] = useState<Record<string, unknown>>(emptyPayload('SINGLE_CHOICE'));
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const row = await getAssessment(assessmentId, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setDetail(row);
        setTitle(row.title);
        setType(row.type);
        setCourseId(row.courseId);
        setDurationMinutes(row.durationMinutes ? String(row.durationMinutes) : '');
      } catch (err) {
        if (!controller.signal.aborted) setError(extractErrorMessage(err, 'Không thể tải đề'));
      }
    })();
    return () => controller.abort();
  }, [assessmentId]);

  const saveMeta = async () => {
    setError('');
    if (!title.trim() || !courseId) {
      setError('Tên đề và khóa HSK là bắt buộc');
      return;
    }
    try {
      if (!assessmentId) {
        const created = await createAssessment({
          title: title.trim(),
          type,
          courseId,
          durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        });
        setDetail(created);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể lưu đề'));
    }
  };

  const saveQuestion = async () => {
    if (!detail) return;
    setError('');
    try {
      const q = await addQuestion(detail.id, {
        type: qType,
        prompt: prompt.trim(),
        payload,
        points: Number(points) || 1,
      });
      setDetail({
        ...detail,
        questions: [...(detail.questions ?? []), q],
        questionCount: (detail.questions?.length ?? 0) + 1,
      });
      setPrompt('');
      setPayload(emptyPayload(qType));
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể thêm câu hỏi'));
    }
  };

  const persistQuestion = async (q: TeacherQuestionDto, next: Record<string, unknown>) => {
    if (!detail) return;
    try {
      const updated = await updateQuestion(detail.id, q.id, { payload: next });
      setDetail({
        ...detail,
        questions: (detail.questions ?? []).map((item) => (item.id === q.id ? updated : item)),
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể sửa câu hỏi'));
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={onBack}>
        ← Danh sách đề
      </button>
      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-ink)]">
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 md:grid-cols-2">
        <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên đề" aria-label="Tên đề" />
        <select className={FIELD} value={type} onChange={(e) => setType(e.target.value as AssessmentType)} aria-label="Loại đề">
          {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className={FIELD} value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Khóa HSK">
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input className={FIELD} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="Thời gian (phút)" aria-label="Thời gian làm bài" />
        {!detail ? (
          <button type="button" onClick={() => void saveMeta()} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white">
            Lưu nháp
          </button>
        ) : null}
      </div>

      {detail ? (
        <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Câu hỏi</h2>
            <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => setPreview((v) => !v)}>
              {preview ? 'Đang xem trước như HV' : 'Xem trước như HV'}
            </button>
          </div>
          {(detail.questions ?? []).map((q) => (
            <div key={q.id} className="rounded-lg border border-[var(--line)] p-3">
              <div className="mb-2 text-sm font-medium">{q.position}. {q.prompt}</div>
              <QuestionTypeFields
                type={q.type}
                payload={q.payload}
                hideAnswer={preview}
                onChange={(next) => void persistQuestion(q, next)}
              />
            </div>
          ))}
          {!preview ? (
            <div className="space-y-2 border-t border-[var(--line)] pt-3">
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
              <textarea className={`${FIELD} w-full`} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Nội dung câu hỏi" aria-label="Nội dung câu hỏi" />
              <input className={FIELD} value={points} onChange={(e) => setPoints(e.target.value)} aria-label="Điểm" />
              <QuestionTypeFields type={qType} payload={payload} onChange={setPayload} />
              <button type="button" onClick={() => void saveQuestion()} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white">
                Thêm câu
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

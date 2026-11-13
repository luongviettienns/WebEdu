'use client';

import React, { useRef, useState } from 'react';
import type { CourseItemDto } from '@/features/courses/api/courses.api';
import {
  ASSESSMENT_TYPE_LABELS,
  importAssessment,
  updateAssessment,
  uploadMedia,
  type AssessmentType,
} from '@/features/assessments/api/assessments.api';
import { extractErrorMessage } from '@/lib/api-client';

const FIELD =
  'rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

const STEPS = ['1 · Tải lên', '2 · Phân tích', '3 · Hoàn tất'] as const;
type Step = 'idle' | 'up' | 'parse' | 'done' | 'err';
const MAX_DOC_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg']);

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function validateExtraFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (IMAGE_EXTS.has(ext)) {
    return file.size > 0 && file.size <= MAX_IMAGE_BYTES
      ? null
      : `Ảnh "${file.name}" phải khác rỗng và không vượt quá 5MB`;
  }
  if (AUDIO_EXTS.has(ext)) {
    return file.size > 0 && file.size <= MAX_AUDIO_BYTES
      ? null
      : `Audio "${file.name}" phải khác rỗng và không vượt quá 20MB`;
  }
  return `File đính kèm "${file.name}" chỉ hỗ trợ ảnh (.png, .jpg, .jpeg) hoặc audio (.mp3, .wav, .m4a)`;
}

function parseOptionalDuration(raw: string): { valid: boolean; value?: number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true };
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 1 || num > 1440) {
    return { valid: false, error: 'Thời gian làm bài phải là số nguyên từ 1 đến 1440 phút' };
  }
  return { valid: true, value: num };
}

export function ImportUploadPane({
  courses,
  onBack,
  onImported,
}: {
  courses: CourseItemDto[];
  onBack: () => void;
  onImported: (id: string) => void;
}) {
  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssessmentType>('HOMEWORK');
  const [courseId, setCourseId] = useState('');
  const [duration, setDuration] = useState('');
  const [extras, setExtras] = useState<File[]>([]);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [fileName, setFileName] = useState('');

  const selectedCourseId = courseId || courses[0]?.id || '';
  const stepIdx = step === 'up' ? 0 : step === 'parse' ? 1 : step === 'done' ? 2 : -1;

  const appendExtras = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const accepted: File[] = [];
    const errors: string[] = [];
    for (const item of list) {
      const err = validateExtraFile(item);
      if (err) errors.push(err);
      else accepted.push(item);
    }
    if (errors.length > 0) setError(errors[0]!);
    else setError('');
    if (accepted.length > 0) setExtras((curr) => [...curr, ...accepted]);
  };

  const runImport = async (file: File) => {
    setError('');
    setAssessmentId('');
    setSummary('');
    const ext = getFileExtension(file.name);
    if ((ext !== 'docx' && ext !== 'pdf') || file.size === 0 || file.size > MAX_DOC_BYTES) {
      setError('Chỉ hỗ trợ file .docx, .pdf tối đa 20MB');
      setStep('err');
      setFileName(file.name);
      return;
    }
    if (!selectedCourseId) {
      setError('Khóa HSK là bắt buộc');
      return;
    }
    const parsedDuration = parseOptionalDuration(duration);
    if (!parsedDuration.valid) {
      setError(parsedDuration.error!);
      setStep('err');
      setFileName(file.name);
      return;
    }
    for (const extra of extras) {
      const extraError = validateExtraFile(extra);
      if (extraError) {
        setError(extraError);
        setStep('err');
        setFileName(file.name);
        return;
      }
    }
    setFileName(file.name);
    setStep('up');
    try {
      setStep('parse');
      const result = await importAssessment(file, {
        courseId: selectedCourseId,
        type,
        title: title.trim() || undefined,
      });
      setAssessmentId(result.assessmentId);
      setSummary(result.summary);
      if (parsedDuration.value !== undefined) {
        await updateAssessment(result.assessmentId, { durationMinutes: parsedDuration.value });
      }
      for (const extra of extras) {
        await uploadMedia(result.assessmentId, extra);
      }
      setStep('done');
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể tải đề'));
      setStep('err');
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm font-semibold text-[var(--blue)]" onClick={onBack}>
        ← Danh sách đề
      </button>
      <h2 className="text-lg font-bold">Tải đề Word/PDF</h2>
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
        <select className={FIELD} value={selectedCourseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Khóa HSK">
          {courses.length === 0 ? <option value="">Chưa có khóa HSK hoạt động</option> : null}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input className={FIELD} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Thời gian làm bài (phút)" aria-label="Thời gian làm bài" />
        <label
          className="md:col-span-2 flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-[var(--line-2)] bg-[var(--surface-2)] px-4 py-8 text-center text-sm"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void runImport(file);
          }}
        >
          <input
            type="file"
            accept=".docx,.pdf"
            className="hidden"
            aria-label="Tải đề Word hoặc PDF"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void runImport(file);
            }}
          />
          <b>Kéo thả file vào đây hoặc bấm để chọn</b>
          <span className="text-xs text-[var(--ink-3)]">.docx, .pdf · tối đa 20MB · lưu file gốc để đối chiếu</span>
        </label>
        {step !== 'idle' ? (
          <div className="md:col-span-2 space-y-2 rounded-lg border border-[var(--line)] p-3">
            <div className="text-sm font-medium">{fileName}</div>
            <div className="flex gap-3 text-xs">
              {STEPS.map((label, i) => (
                <span
                  key={label}
                  className={stepIdx > i ? 'text-[var(--jade)]' : stepIdx === i ? 'font-semibold text-[var(--blue)]' : 'text-[var(--ink-3)]'}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="h-1 rounded bg-[var(--line)]">
              <div
                className="h-1 rounded bg-[var(--blue)]"
                style={{ width: stepIdx < 0 ? '0%' : stepIdx === 0 ? '35%' : stepIdx === 1 ? '70%' : '100%' }}
              />
            </div>
            {step === 'done' ? (
              <>
                <p className="text-sm">{summary}</p>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => onImported(assessmentId)}
                >
                  Kiểm tra đề
                </button>
              </>
            ) : step === 'err' && assessmentId ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-[var(--ink-2)]">
                  Đề nháp đã được tạo từ file gốc ({summary}). Bạn có thể mở để hoàn tất cấu hình hoặc tải lại tệp đính kèm.
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--hover)]"
                  onClick={() => onImported(assessmentId)}
                >
                  Mở đề nháp vừa tạo
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="md:col-span-2 space-y-2">
          <div className="text-sm font-medium">Audio / hình ảnh đính kèm riêng</div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={audioRef} type="file" accept=".mp3,.m4a,.wav" className="hidden" aria-label="Thêm audio" multiple
              onChange={(e) => { appendExtras(e.target.files); e.target.value = ''; }} />
            <input ref={imageRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" aria-label="Thêm hình" multiple
              onChange={(e) => { appendExtras(e.target.files); e.target.value = ''; }} />
            <button type="button" className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm" onClick={() => audioRef.current?.click()}>Thêm audio</button>
            <button type="button" className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm" onClick={() => imageRef.current?.click()}>Thêm hình</button>
            <span className="text-xs text-[var(--ink-3)]">Nếu không nhúng trong file đề</span>
          </div>
          {extras.length > 0 ? <p className="text-xs text-[var(--ink-3)]">{extras.map((f) => f.name).join(', ')}</p> : null}
        </div>
      </div>
    </div>
  );
}

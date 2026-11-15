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
import {
  getFileExtension,
  MAX_DOC_BYTES,
  parseOptionalDuration,
  validateExtraFile,
  WordTemplateGuideModal,
} from '@/features/assessments/components/WordTemplateGuideModal';
import { extractErrorMessage } from '@/lib/api-client';

const FIELD =
  'rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

const STEPS = ['1 · Tải lên', '2 · Phân tích', '3 · Hoàn tất'] as const;
type Step = 'idle' | 'up' | 'parse' | 'done' | 'err';

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
  const [docFile, setDocFile] = useState<File | null>(null);
  const [extras, setExtras] = useState<File[]>([]);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [fileName, setFileName] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const selectedCourseId = courseId || courses[0]?.id || '';
  const stepIdx = step === 'up' ? 0 : step === 'parse' ? 1 : step === 'done' ? 2 : -1;
  const busy = step === 'up' || step === 'parse';

  const pickDoc = (file: File | undefined) => {
    if (!file) return;
    const ext = getFileExtension(file.name);
    if ((ext !== 'docx' && ext !== 'pdf') || file.size === 0 || file.size > MAX_DOC_BYTES) {
      setError('Chỉ hỗ trợ file .docx, .pdf tối đa 20MB');
      setStep('err');
      setDocFile(null);
      setFileName(file.name);
      return;
    }
    setError('');
    setStep('idle');
    setDocFile(file);
    setFileName(file.name);
    setSummary('');
    setAssessmentId('');
  };

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

  const runImport = async () => {
    if (!docFile) {
      setError('Chọn file đề Word hoặc PDF trước');
      return;
    }
    setError('');
    setAssessmentId('');
    setSummary('');
    if (!selectedCourseId) {
      setError('Khóa HSK là bắt buộc');
      return;
    }
    const parsedDuration = parseOptionalDuration(duration);
    if (!parsedDuration.valid) {
      setError(parsedDuration.error!);
      setStep('err');
      return;
    }
    for (const extra of extras) {
      const extraError = validateExtraFile(extra);
      if (extraError) {
        setError(extraError);
        setStep('err');
        return;
      }
    }
    setStep('up');
    try {
      setStep('parse');
      const result = await importAssessment(docFile, {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Tải đề Word/PDF</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)]"
          >
            Xem quy tắc gõ file Word (30 giây)
          </button>
          <a href="/templates/mau-de-import.docx" download className="text-sm font-semibold text-[var(--blue)]">
            Tải file mẫu Word
          </a>
        </div>
      </div>
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
          className="md:col-span-2 flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--line-2)] bg-[var(--surface-2)] px-4 py-8 text-center text-sm hover:border-[var(--blue)] transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickDoc(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept=".docx,.pdf"
            className="hidden"
            aria-label="Tải đề Word hoặc PDF"
            onChange={(e) => {
              pickDoc(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <span className="rounded-full bg-[var(--red-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--red-ink)]">
            Bước 1 · Chọn file đề gốc (.docx hoặc .pdf)
          </span>
          <b>{docFile ? docFile.name : 'Kéo thả file vào đây hoặc bấm để chọn'}</b>
          <span className="text-xs text-[var(--ink-2)]">Dùng file mẫu Word · tối đa 20MB</span>
          <span className="max-w-xl text-xs text-[var(--ink-2)]">
            Hỗ trợ 5 dạng câu chữ trong mẫu (không dùng PDF ảnh scan). Khẩu ngữ không import.
          </span>
        </label>
        <div className="md:col-span-2 space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
          <div className="text-sm font-semibold text-[var(--ink)]">Bước 2 · Đính kèm file Nghe / Hình ảnh (tuỳ chọn)</div>
          <p className="text-xs text-[var(--ink-2)]">
            Nếu đề có câu Nghe (.mp3, .wav, .m4a) hoặc Hình (.png, .jpg), bấm chọn thêm tại đây để ghép nhanh ở bước kiểm tra.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={audioRef} type="file" accept=".mp3,.m4a,.wav" className="hidden" aria-label="Thêm audio" multiple
              onChange={(e) => { appendExtras(e.target.files); e.target.value = ''; }} />
            <input ref={imageRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" aria-label="Thêm hình" multiple
              onChange={(e) => { appendExtras(e.target.files); e.target.value = ''; }} />
            <button type="button" className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm hover:bg-[var(--hover)]" onClick={() => audioRef.current?.click()}>Thêm audio</button>
            <button type="button" className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-sm hover:bg-[var(--hover)]" onClick={() => imageRef.current?.click()}>Thêm hình</button>
          </div>
          {extras.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs text-[var(--ink-2)]">
              {extras.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <button type="button" className="rounded-full border border-[var(--line-2)] bg-white px-2.5 py-1"
                    onClick={() => setExtras((curr) => curr.filter((_, j) => j !== i))} aria-label={`Gỡ ${f.name}`}>
                    {f.name} ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="button" disabled={!docFile || !selectedCourseId || busy}
          className="md:col-span-2 w-fit rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void runImport()}>
          Tải đề lên
        </button>
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
      </div>
      <WordTemplateGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

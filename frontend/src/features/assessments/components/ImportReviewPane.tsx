'use client';

import React, { useEffect, useState } from 'react';
import {
  getAssessmentReview,
  publishAssessment,
  type TeacherAssessmentDto,
} from '@/features/assessments/api/assessments.api';
import { QuestionTypeFields } from '@/features/assessments/components/QuestionTypeFields';
import { extractErrorMessage } from '@/lib/api-client';

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
  const [error, setError] = useState('');

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

  const questions = (detail?.questions ?? []).filter((q) => !onlyReview || q.needsReview);

  const publish = async () => {
    setError('');
    try {
      await publishAssessment(assessmentId);
      onPublished();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể phát hành'));
    }
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
        Chỉ hiện câu cần kiểm tra
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--ink-2)]">
          File gốc được giữ để đối chiếu khi tải lên. Kiểm tra từng câu bên phải trước khi phát hành.
        </div>
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`rounded-xl border p-3 ${q.needsReview ? 'border-[var(--amber)] bg-[var(--amber-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}
            >
              {q.needsReview ? <div className="mb-1 text-xs font-semibold text-[var(--amber)]">Cần kiểm tra</div> : null}
              <div className="mb-2 text-sm font-medium">{q.position}. {q.prompt}</div>
              <QuestionTypeFields type={q.type} payload={q.payload} onChange={() => undefined} />
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => void publish()} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white">
        Phát hành
      </button>
    </div>
  );
}

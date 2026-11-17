'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BaseDialog, DialogActions, DialogError } from '@/features/common/components/BaseDialog';
import {
  getAssignmentGradingTracker,
  getSubmissionGradingDetail,
  requestBatchAiEssaySuggestions,
  type TeacherGradingQuestionDetailDto,
  type TeacherSubmissionGradingDetailDto,
} from '@/features/grading/api/grading.api';
import { extractErrorMessage } from '@/lib/api-client';

interface BatchAiGradeModalProps {
  assignmentId: string;
  open: boolean;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

type EssayDraftEntry = {
  submissionId: string;
  displayLabel: string;
  selected: boolean;
  studentAnswer: string;
  hasExistingDraft: boolean;
};

const cleanText = (val: unknown): string =>
  typeof val === 'string' ? val.trim().normalize('NFKC') : '';

export function BatchAiGradeModal({
  assignmentId,
  open,
  onClose,
  onCompleted,
}: BatchAiGradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<TeacherSubmissionGradingDetailDto[]>([]);
  const [essayQuestions, setEssayQuestions] = useState<TeacherGradingQuestionDetailDto[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [promptText, setPromptText] = useState('');
  const [sampleText, setSampleText] = useState('');
  const [rubricText, setRubricText] = useState('');
  const [entries, setEntries] = useState<EssayDraftEntry[]>([]);
  const [confirmedPii, setConfirmedPii] = useState(false);

  const selectQuestion = useCallback(
    (
      qId: string,
      loadedDetails: TeacherSubmissionGradingDetailDto[],
      loadedQuestions: TeacherGradingQuestionDetailDto[],
    ) => {
      setSelectedQuestionId(qId);
      const qMeta = loadedQuestions.find((q) => q.questionId === qId);
      if (qMeta) {
        setPromptText(cleanText(qMeta.prompt));
        setSampleText(cleanText(qMeta.questionPayload.sampleAnswer));
        setRubricText(cleanText(qMeta.questionPayload.rubric));
      }
      setConfirmedPii(false);
      setEntries(
        loadedDetails.map((d, idx) => {
          const q = d.questions.find((item) => item.questionId === qId);
          const rawAnswer = cleanText(q?.studentAnswer.answerPayload.text);
          const hasDraft =
            q?.studentAnswer.aiSuggestedPoints !== null &&
            q?.studentAnswer.aiSuggestedPoints !== undefined;
          return {
            submissionId: d.submission.id,
            displayLabel: `Bài nộp #${idx + 1} (${d.student.fullName})`,
            selected: Boolean(rawAnswer) && !hasDraft,
            studentAnswer: rawAnswer,
            hasExistingDraft: hasDraft,
          };
        }),
      );
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      setConfirmedPii(false);
      try {
        const tracker = await getAssignmentGradingTracker(
          assignmentId,
          { status: 'NEEDS_GRADING', page: 1 },
          { signal: controller.signal },
        );
        const candidates = tracker.students.filter((s) => Boolean(s.submissionId)).slice(0, 20);
        const loaded = await Promise.all(
          candidates.map((s) => getSubmissionGradingDetail(s.submissionId!, { signal: controller.signal })),
        );
        if (controller.signal.aborted) return;
        setDetails(loaded);
        const firstEssays = loaded[0]?.questions.filter((q) => q.type === 'ESSAY') ?? [];
        setEssayQuestions(firstEssays);
        if (firstEssays[0]) {
          selectQuestion(firstEssays[0].questionId, loaded, firstEssays);
        } else {
          setSelectedQuestionId('');
          setEntries([]);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải danh sách bài tự luận để duyệt'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [assignmentId, open, selectQuestion]);

  if (!open) return null;

  const selectedEntries = entries.filter((e) => e.selected && e.studentAnswer.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedPii || selectedEntries.length === 0 || !selectedQuestionId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await requestBatchAiEssaySuggestions(assignmentId, {
        questionId: selectedQuestionId,
        reviews: selectedEntries.map((item) => ({
          submissionId: item.submissionId,
          questionId: selectedQuestionId,
          reviewedInput: {
            prompt: promptText.trim(),
            sampleAnswer: sampleText.trim(),
            rubric: rubricText.trim(),
            studentAnswer: item.studentAnswer.trim(),
          },
        })),
      });
      if (res.failedCount > 0 && res.succeededCount === 0) {
        const firstErr = res.results.find((r) => !r.ok)?.error;
        setError(firstErr || 'AI không thể xử lý các bài nộp đã chọn.');
        return;
      }
      const msg =
        res.failedCount > 0
          ? `AI đã gợi ý ${res.succeededCount}/${res.requestedCount} bài (${res.failedCount} bài không đạt bộ lọc PII hoặc lỗi).`
          : `AI đã tạo gợi ý chấm cho ${res.succeededCount} bài nộp (Nháp nội bộ).`;
      onCompleted(msg);
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể gọi AI gợi ý chấm hàng loạt'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog
      eyebrow="AI批改审阅 · DUYỆT ZERO-PII HÀNG LOẠT"
      title="Duyệt nội dung trước khi gửi AI gợi ý chấm"
      onClose={onClose}
      busy={submitting}
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
        <DialogError message={error} />
        <p className="rounded-xl border border-[var(--blue)]/25 bg-[var(--blue-soft)]/50 p-3 text-xs text-[var(--ink-2)]">
          Chỉ gửi nội dung văn bản đã loại bỏ tên, email, SĐT và thông tin nhận dạng (tối đa 20 bài/lượt).
        </p>

        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-[var(--ink-2)]">
            Đang tải các bài nộp cần chấm...
          </p>
        ) : essayQuestions.length === 0 || details.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--ink-2)]">
            Không có bài nộp cần chấm kèm câu tự luận ở trang hiện tại.
          </p>
        ) : (
          <>
            {essayQuestions.length > 1 ? (
              <label className="block text-xs font-semibold text-[var(--ink-2)]">
                Chọn câu tự luận
                <select
                  value={selectedQuestionId}
                  onChange={(ev) => selectQuestion(ev.target.value, details, essayQuestions)}
                  className="mt-1 w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
                >
                  {essayQuestions.map((q) => (
                    <option key={q.questionId} value={q.questionId}>
                      Câu {q.position} ({q.points} đ): {q.prompt.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[var(--ink-2)] sm:col-span-2">
                Câu hỏi gửi AI
                <textarea rows={2} value={promptText} onChange={(e) => setPromptText(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line-2)] p-2 text-xs text-[var(--ink)]" />
              </label>
              <label className="block text-xs font-semibold text-[var(--ink-2)]">
                Đáp án mẫu gửi AI
                <textarea rows={2} value={sampleText} onChange={(e) => setSampleText(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line-2)] p-2 text-xs text-[var(--ink)]" />
              </label>
              <label className="block text-xs font-semibold text-[var(--ink-2)]">
                Rubric gửi AI
                <textarea rows={2} value={rubricText} onChange={(e) => setRubricText(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line-2)] p-2 text-xs text-[var(--ink)]" />
              </label>
            </div>

            <div className="max-h-64 space-y-2.5 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              {entries.map((entry, idx) => (
                <div key={entry.submissionId} className="space-y-1.5 rounded-lg border border-[var(--line)] bg-white p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={entry.selected}
                        onChange={(ev) =>
                          setEntries((prev) =>
                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, selected: ev.target.checked } : row)),
                          )
                        }
                      />
                      <span>{entry.displayLabel}</span>
                    </label>
                    {entry.hasExistingDraft ? (
                      <span className="rounded bg-[var(--jade-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--jade)]">
                        Đã có gợi ý AI
                      </span>
                    ) : null}
                  </div>
                  <textarea
                    rows={2}
                    value={entry.studentAnswer}
                    placeholder="Học viên bỏ trống câu này"
                    onChange={(ev) => {
                      setConfirmedPii(false);
                      setEntries((prev) =>
                        prev.map((row, rIdx) => (rIdx === idx ? { ...row, studentAnswer: ev.target.value } : row)),
                      );
                    }}
                    className="w-full rounded-md border border-[var(--line-2)] p-2 text-xs text-[var(--ink)]"
                  />
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2 text-xs font-medium text-[var(--ink)]">
              <input
                id="batch-ai-pii-confirm"
                type="checkbox"
                checked={confirmedPii}
                onChange={(ev) => setConfirmedPii(ev.target.checked)}
                className="mt-0.5"
              />
              <span>
                Tôi đã duyệt nội dung từng bài làm được chọn và loại bỏ thông tin định danh cá nhân (PII) trước khi gửi AI.
              </span>
            </label>
          </>
        )}

        <DialogActions
          onCancel={onClose}
          submitLabel={`Gửi AI (${selectedEntries.length} bài)`}
          submittingLabel="Đang gửi AI..."
          submitting={submitting}
          submitDisabled={loading || !confirmedPii || selectedEntries.length === 0 || !promptText.trim()}
        />
      </form>
    </BaseDialog>
  );
}

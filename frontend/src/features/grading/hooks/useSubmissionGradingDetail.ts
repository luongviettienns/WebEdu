'use client';

import { useEffect, useState } from 'react';
import {
  confirmSubmissionGrade,
  getSubmissionGradingDetail,
  requestAiEssaySuggestion,
  saveManualGrade,
  type TeacherSubmissionGradingDetailDto,
} from '@/features/grading/api/grading.api';
import { extractErrorMessage } from '@/lib/api-client';

function buildInitialDraft(data: TeacherSubmissionGradingDetailDto) {
  const nextScores: Record<string, string> = {};
  const nextComments: Record<string, string> = {};
  for (const q of data.questions) {
    nextScores[q.questionId] =
      q.studentAnswer.earnedPoints !== null ? String(q.studentAnswer.earnedPoints) : '';
    nextComments[q.questionId] = q.studentAnswer.teacherComment ?? '';
  }
  return { nextScores, nextComments, feedback: data.submission.teacherFeedback ?? '' };
}

export function useSubmissionGradingDetail(
  submissionId: string | null,
  onChanged: () => void,
) {
  const [detail, setDetail] = useState<TeacherSubmissionGradingDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [teacherFeedback, setTeacherFeedback] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const applyDetail = (data: TeacherSubmissionGradingDetailDto) => {
    const draft = buildInitialDraft(data);
    setDetail(data);
    setScores(draft.nextScores);
    setComments(draft.nextComments);
    setTeacherFeedback(draft.feedback);
  };

  useEffect(() => {
    if (!submissionId) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getSubmissionGradingDetail(submissionId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        applyDetail(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(extractErrorMessage(err, 'Không thể tải chi tiết bài nộp'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [submissionId, reloadTick]);

  const reloadDetail = () => setReloadTick((t) => t + 1);

  const handleSaveDraft = async () => {
    if (!detail) return;
    setError('');
    setNotice('');
    setBusy('save');
    try {
      const answersPayload = detail.questions
        .map((q) => {
          const rawScore = (scores[q.questionId] ?? '').trim();
          const trimmedComment = (comments[q.questionId] ?? '').trim();
          const hasScore = rawScore !== '';
          const commentChanged = trimmedComment !== (q.studentAnswer.teacherComment ?? '');
          if (!hasScore && !commentChanged) return null;
          return {
            questionId: q.questionId,
            ...(hasScore ? { earnedPoints: Number(rawScore) } : {}),
            ...(commentChanged ? { teacherComment: trimmedComment || null } : {}),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      await saveManualGrade(detail.submission.id, {
        teacherFeedback: teacherFeedback.trim() || null,
        answers: answersPayload,
      });
      reloadDetail();
      setNotice('Đã lưu điểm và nhận xét bài làm.');
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể lưu điểm'));
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmGrade = async () => {
    if (!detail) return;
    setError('');
    setNotice('');
    setBusy('confirm');
    try {
      await confirmSubmissionGrade(detail.submission.id);
      reloadDetail();
      setNotice('Đã xác nhận điểm bài nộp (GRADED — Chờ công bố).');
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể xác nhận điểm'));
    } finally {
      setBusy(null);
    }
  };

  const handleRequestAi = async (questionId?: string) => {
    if (!detail) return;
    setError('');
    setNotice('');
    setBusy(questionId ? `ai-${questionId}` : 'ai-all');
    try {
      await requestAiEssaySuggestion(detail.submission.id, questionId);
      reloadDetail();
      setNotice('Đã tạo gợi ý AI chấm tự luận (Nháp nội bộ).');
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể gọi AI gợi ý chấm'));
    } finally {
      setBusy(null);
    }
  };

  return {
    detail: submissionId ? detail : null,
    loading,
    error,
    notice,
    setNotice,
    busy,
    scores,
    setScores,
    comments,
    setComments,
    teacherFeedback,
    setTeacherFeedback,
    reloadDetail,
    handleSaveDraft,
    handleConfirmGrade,
    handleRequestAi,
  };
}

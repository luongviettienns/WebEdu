'use client';

import { useEffect, useRef, useState } from 'react';
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
  const loadedSubmissionIdRef = useRef<string | null>(null);

  const applyDetail = (data: TeacherSubmissionGradingDetailDto) => {
    const draft = buildInitialDraft(data);
    setDetail(data);
    setScores(draft.nextScores);
    setComments(draft.nextComments);
    setTeacherFeedback(draft.feedback);
  };

  useEffect(() => {
    if (!submissionId) {
      loadedSubmissionIdRef.current = null;
      return;
    }
    const isNewSubmission = loadedSubmissionIdRef.current !== submissionId;
    loadedSubmissionIdRef.current = submissionId;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      if (isNewSubmission) {
        setError('');
        setNotice('');
      }
      setDetail((prev) => (prev?.submission.id === submissionId ? prev : null));
      try {
        const data = await getSubmissionGradingDetail(submissionId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        applyDetail(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setDetail(null);
          setError(extractErrorMessage(err, 'Không thể tải chi tiết bài nộp'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [submissionId, reloadTick]);

  const activeDetail = detail && detail.submission.id === submissionId ? detail : null;
  const reloadDetail = () => setReloadTick((t) => t + 1);

  const hasUnsavedChanges = Boolean(
    activeDetail &&
      (teacherFeedback.trim() !== (activeDetail.submission.teacherFeedback ?? '').trim() ||
        activeDetail.questions.some((q) => {
          const initialScore =
            q.studentAnswer.earnedPoints !== null ? String(q.studentAnswer.earnedPoints) : '';
          const currentScore = (scores[q.questionId] ?? '').trim();
          const initialComment = (q.studentAnswer.teacherComment ?? '').trim();
          const currentComment = (comments[q.questionId] ?? '').trim();
          return currentScore !== initialScore || currentComment !== initialComment;
        })),
  );

  const handleSaveDraft = async () => {
    if (!activeDetail) return;
    setError('');
    setNotice('');

    const answersPayload: Array<{
      questionId: string;
      earnedPoints?: number;
      previousEarnedPoints?: number | null;
      teacherComment?: string | null;
      previousTeacherComment?: string | null;
    }> = [];

    for (const q of activeDetail.questions) {
      const initialScore =
        q.studentAnswer.earnedPoints !== null ? String(q.studentAnswer.earnedPoints) : '';
      const rawScore = (scores[q.questionId] ?? '').trim();
      const scoreChanged = rawScore !== initialScore;
      if (scoreChanged && !rawScore) {
        setError(`Điểm câu ${q.position} không được để trống sau khi đã chấm.`);
        return;
      }

      const initialComment = (q.studentAnswer.teacherComment ?? '').trim();
      const trimmedComment = (comments[q.questionId] ?? '').trim();
      const commentChanged = trimmedComment !== initialComment;
      if (!scoreChanged && !commentChanged) continue;

      answersPayload.push({
        questionId: q.questionId,
        ...(scoreChanged
          ? {
              earnedPoints: Number(rawScore),
              previousEarnedPoints: q.studentAnswer.earnedPoints,
            }
          : {}),
        ...(commentChanged
          ? {
              teacherComment: trimmedComment || null,
              previousTeacherComment: q.studentAnswer.teacherComment ?? null,
            }
          : {}),
      });
    }

    const initialFeedback = (activeDetail.submission.teacherFeedback ?? '').trim();
    const nextFeedback = teacherFeedback.trim();
    const feedbackChanged = nextFeedback !== initialFeedback;
    if (answersPayload.length === 0 && !feedbackChanged) {
      setNotice('Không có thay đổi mới cần lưu.');
      return;
    }

    setError('');
    setNotice('');
    setBusy('save');
    try {
      await saveManualGrade(activeDetail.submission.id, {
        ...(feedbackChanged
          ? {
              teacherFeedback: nextFeedback || null,
              previousTeacherFeedback: activeDetail.submission.teacherFeedback ?? null,
            }
          : {}),
        ...(answersPayload.length > 0 ? { answers: answersPayload } : {}),
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
    if (!activeDetail) return;
    if (hasUnsavedChanges) {
      setError(
        'Còn thay đổi điểm hoặc nhận xét chưa lưu. Vui lòng nhấn "Lưu điểm & Nhận xét" trước khi xác nhận.',
      );
      return;
    }
    setError('');
    setNotice('');
    setBusy('confirm');
    try {
      await confirmSubmissionGrade(activeDetail.submission.id);
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
    if (!activeDetail) return;
    setError('');
    setNotice('');
    setBusy(questionId ? `ai-${questionId}` : 'ai-all');
    try {
      const res = await requestAiEssaySuggestion(activeDetail.submission.id, questionId);
      const suggestionByQuestion = new Map(res.suggestions.map((s) => [s.questionId, s]));
      setDetail((prev) => {
        if (!prev || prev.submission.id !== res.submissionId) return prev;
        return {
          ...prev,
          submission: {
            ...prev.submission,
            gradingStatus: res.gradingStatus,
          },
          questions: prev.questions.map((q) => {
            const suggestion = suggestionByQuestion.get(q.questionId);
            if (!suggestion) return q;
            return {
              ...q,
              studentAnswer: {
                ...q.studentAnswer,
                aiSuggestedPoints: suggestion.aiSuggestedPoints,
                aiFeedback: suggestion.aiFeedback,
              },
            };
          }),
        };
      });
      setNotice('Đã tạo gợi ý AI chấm tự luận (Nháp nội bộ).');
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể gọi AI gợi ý chấm'));
    } finally {
      setBusy(null);
    }
  };

  return {
    detail: activeDetail,
    hasUnsavedChanges,
    loading,
    error: submissionId ? error : '',
    notice: submissionId ? notice : '',
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

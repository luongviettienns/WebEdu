'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import {
  autosaveAssignment,
  submitAssignment,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import {
  useAutosaveScheduler,
  useExamBrowserSync,
  useExamCountdown,
} from '@/features/assignments/hooks/useExamBrowserSync';
import { clearLocalDraft, findFirstPartialOrderingIndex, formatSavedTimeHmS } from '@/features/assignments/utils/exam-draft';
import {
  buildResolvedSessionSnapshot,
  buildSubmitRequestBody,
  buildSyncPayload,
  fetchExamEntrySession,
  INITIAL_SESSION_SNAPSHOT,
  persistDraftFromSnapshot,
  reconcileAutosaveSnapshot,
  resolveResumeSyncAction,
  tickCountdownSnapshot,
  type ExamSaveState,
  type ExamSnapshotLike,
  type ExamViewMode,
} from '@/features/assignments/utils/exam-session-transport';
import { ApiClientError, extractErrorMessage } from '@/lib/api-client';

export type { ExamSaveState, ExamViewMode } from '@/features/assignments/utils/exam-session-transport';

export function useStudentExamSession(assignmentId: string, mode?: string | null) {
  const [viewMode, setViewMode] = useState<ExamViewMode>('loading');
  const [session, setSession] = useState<StudentExamSessionDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerPayload>>({});
  const [audioPlayCounts, setAudioPlayCounts] = useState<Record<string, number>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<ExamSaveState>('idle');
  const [lastSavedText, setLastSavedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const submitting = session?.submission.id === submittingId;

  const snapshotRef = useRef<ExamSnapshotLike>(INITIAL_SESSION_SNAPSHOT);
  const submittingRef = useRef<{ submissionId: string } | null>(null);
  const lastDraftUpdatedAtRef = useRef(0);
  const { clearTimers: clearPendingTimers, resetDirty, markDirty, beginFlush, completeFlush, scheduleForType, hasPendingChanges } =
    useAutosaveScheduler();

  const syncSnapshotState = useCallback((next: ExamSnapshotLike) => {
    snapshotRef.current = next;
    setSession(next.session);
    setAnswers(next.answers);
    setAudioPlayCounts(next.audioPlayCounts);
    setRemainingSeconds(next.remainingSeconds);
  }, []);

  const applySession = useCallback(
    (dto: StudentExamSessionDto, nextMode: 'taking' | 'review') => {
      const resolved = buildResolvedSessionSnapshot(dto, nextMode);
      if (resolved.draftUpdatedAtMs > 0) lastDraftUpdatedAtRef.current = resolved.draftUpdatedAtMs;
      syncSnapshotState(resolved.snapshot);
      setLastSavedText(formatSavedTimeHmS(dto.submission.lastSavedAt));
      setSaveState('saved');
      setViewMode(nextMode);
      return resolved.mergedFromLocal;
    },
    [syncSnapshotState],
  );

  const isCurrentAttempt = useCallback((submissionId: string) => {
    const current = snapshotRef.current;
    return current.viewMode === 'taking' && current.session?.submission.id === submissionId;
  }, []);

  const reloadAfterConflict = useCallback(async (expectedId: string) => {
    if (!isCurrentAttempt(expectedId)) return;
    try {
      const { dto, nextMode } = await fetchExamEntrySession(assignmentId, mode);
      if (!isCurrentAttempt(expectedId)) return;
      resetDirty();
      setCurrentIndex(0);
      setFlaggedIds({});
      applySession(dto, nextMode);
    } catch (error) {
      if (!isCurrentAttempt(expectedId)) return;
      setActionError(extractErrorMessage(error, 'Vui lòng tải lại bài tập'));
      setSaveState('dirty');
    }
  }, [assignmentId, mode, applySession, isCurrentAttempt, resetDirty]);

  const submitNow = useCallback(
    async (autoSubmitted = false) => {
      const snap = snapshotRef.current;
      if (!snap.session || snap.viewMode !== 'taking') return;
      const submissionId = snap.session.submission.id;
      if (submittingRef.current?.submissionId === submissionId) return;
      if (!autoSubmitted) {
        const partialIdx = findFirstPartialOrderingIndex(snap.session.questions, snap.answers);
        if (partialIdx >= 0) {
          setActionError('Còn câu sắp xếp chưa chọn đủ các mảnh từ. Vui lòng hoàn thành hoặc xóa hết trước khi nộp.');
          setCurrentIndex(partialIdx);
          return;
        }
      }
      const request = { submissionId };
      submittingRef.current = request;
      setSubmittingId(submissionId);
      setActionError('');
      clearPendingTimers();
      try {
        const result = await submitAssignment(assignmentId, buildSubmitRequestBody(snap, autoSubmitted));
        if (!isCurrentAttempt(submissionId)) return;
        resetDirty();
        clearLocalDraft(result.submission.id, result.submission.studentId);
        applySession(result, 'review');
      } catch (err) {
        if (!isCurrentAttempt(submissionId)) return;
        if (err instanceof ApiClientError && err.status === 409) {
          await reloadAfterConflict(submissionId);
          return;
        }
        setActionError(extractErrorMessage(err, 'Không thể nộp bài lúc này. Vui lòng thử lại.'));
      } finally {
        if (submittingRef.current === request) {
          submittingRef.current = null;
          setSubmittingId(null);
        }
      }
    },
    [assignmentId, applySession, clearPendingTimers, isCurrentAttempt, reloadAfterConflict, resetDirty],
  );

  const flushAutosave = useCallback(async () => {
    clearPendingTimers();
    const snap = snapshotRef.current;
    if (!snap.session || snap.viewMode !== 'taking') return;
    const submissionId = snap.session.submission.id;
    if (submittingRef.current?.submissionId === submissionId) return;
    const seqAtStart = beginFlush();
    setSaveState('saving');
    setActionError('');
    try {
      const updated = await autosaveAssignment(assignmentId, buildSyncPayload(snap));
      if (!isCurrentAttempt(submissionId)) return;
      if (updated.submission.status !== 'IN_PROGRESS') {
        resetDirty();
        applySession(updated, 'review');
        return;
      }
      syncSnapshotState(reconcileAutosaveSnapshot(snapshotRef.current, updated));
      if (completeFlush(seqAtStart)) {
        setLastSavedText(formatSavedTimeHmS(updated.submission.lastSavedAt));
        setSaveState('saved');
      } else {
        setSaveState('dirty');
      }
      if (updated.submission.remainingSeconds === 0) void submitNow(true);
    } catch (err) {
      if (!isCurrentAttempt(submissionId)) return;
      if (err instanceof ApiClientError && err.status === 409) {
        await reloadAfterConflict(submissionId);
        return;
      }
      if (err instanceof ApiClientError) {
        setActionError(extractErrorMessage(err, 'Không thể lưu bản nháp lúc này.'));
        setSaveState('dirty');
        return;
      }
      setSaveState('offline');
    }
  }, [assignmentId, applySession, beginFlush, clearPendingTimers, completeFlush, isCurrentAttempt, reloadAfterConflict, resetDirty, submitNow, syncSnapshotState]);

  useEffect(() => {
    if (!assignmentId) return;
    const controller = new AbortController();
    resetDirty();
    void (async () => {
      setSubmittingId(null);
      setViewMode('loading');
      setErrorMessage('');
      try {
        const { dto, nextMode } = await fetchExamEntrySession(assignmentId, mode, controller.signal);
        if (controller.signal.aborted) return;
        if (applySession(dto, nextMode) && nextMode === 'taking') void flushAutosave();
      } catch (err) {
        if (controller.signal.aborted) return;
        setErrorMessage(extractErrorMessage(err, 'Không thể mở bài tập này'));
        setViewMode('error');
      }
    })();
    return () => {
      controller.abort();
      clearPendingTimers();
      submittingRef.current = null;
      snapshotRef.current = INITIAL_SESSION_SNAPSHOT;
    };
  }, [assignmentId, mode, applySession, clearPendingTimers, flushAutosave, resetDirty]);

  const handleCountdownTick = useCallback(() => {
    const ticked = tickCountdownSnapshot(snapshotRef.current);
    if (!ticked) return null;
    snapshotRef.current = ticked.nextSnap;
    setRemainingSeconds(ticked.nextRemaining);
    return ticked.nextRemaining;
  }, []);

  const syncCountdownAndFlush = useCallback(() => {
    const plan = resolveResumeSyncAction(snapshotRef.current);
    if (plan.action === 'ignore') return;
    if (plan.nextSnap) syncSnapshotState(plan.nextSnap);
    if (plan.action === 'submit') { void submitNow(true); return; }
    void flushAutosave();
  }, [flushAutosave, submitNow, syncSnapshotState]);

  const handleOffline = useCallback(() => setSaveState('offline'), []);
  const isOffline = useExamBrowserSync({
    submissionId: session?.submission.id,
    studentId: session?.submission.studentId,
    lastDraftUpdatedAtRef,
    snapshotRef,
    onResume: syncCountdownAndFlush,
    onOffline: handleOffline,
    onRemoteSubmit: reloadAfterConflict,
    onAdoptDraft: syncSnapshotState,
  });

  const handleCountdownExpire = useCallback(() => void submitNow(true), [submitNow]);

  useExamCountdown({
    active: viewMode === 'taking' && !isOffline && remainingSeconds !== null && !submitting,
    submissionId: session?.submission.id,
    onTick: handleCountdownTick,
    onExpire: handleCountdownExpire,
  });

  const persistDraftLocally = useCallback(
    (nextAnswers: Record<string, StudentAnswerPayload>, nextAudio: Record<string, number>) => {
      const updated = { ...snapshotRef.current, answers: nextAnswers, audioPlayCounts: nextAudio };
      snapshotRef.current = updated;
      const savedAtMs = persistDraftFromSnapshot(updated);
      if (savedAtMs !== null) lastDraftUpdatedAtRef.current = savedAtMs;
    },
    [],
  );

  const updateAnswer = useCallback(
    (questionId: string, questionType: QuestionType, payload: StudentAnswerPayload) => {
      const snap = snapshotRef.current;
      if (snap.viewMode !== 'taking') return;
      const nextAnswers = { ...snap.answers, [questionId]: payload };
      setAnswers(nextAnswers);
      setActionError('');
      setSaveState((curr) => (curr === 'offline' ? curr : 'dirty'));
      persistDraftLocally(nextAnswers, snap.audioPlayCounts);
      scheduleForType(questionType, () => void flushAutosave());
    },
    [flushAutosave, persistDraftLocally, scheduleForType],
  );

  const recordAudioPlay = useCallback(
    (questionId: string) => {
      const snap = snapshotRef.current;
      if (snap.viewMode !== 'taking') return;
      const nextAudio = { ...snap.audioPlayCounts, [questionId]: (snap.audioPlayCounts[questionId] ?? 0) + 1 };
      markDirty();
      setAudioPlayCounts(nextAudio);
      persistDraftLocally(snap.answers, nextAudio);
      void flushAutosave();
    },
    [flushAutosave, markDirty, persistDraftLocally],
  );

  const selectQuestion = useCallback(
    (nextIndex: number) => {
      if (hasPendingChanges()) void flushAutosave();
      setCurrentIndex(nextIndex);
    },
    [flushAutosave, hasPendingChanges],
  );

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedIds((curr) => ({ ...curr, [questionId]: !curr[questionId] }));
  }, []);

  return {
    viewMode, session, answers, audioPlayCounts, flaggedIds, currentIndex,
    remainingSeconds, saveState, lastSavedText, errorMessage, actionError,
    submitting, isOffline, selectQuestion, toggleFlag, updateAnswer, recordAudioPlay,
    saveDraftNow: flushAutosave, submitNow,
  };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import {
  autosaveAssignment,
  getMySubmittedAssignment,
  submitAssignment,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import {
  useAutosaveScheduler,
  useExamBrowserSync,
  useExamCountdown,
} from '@/features/assignments/hooks/useExamBrowserSync';
import {
  clearLocalDraft,
  findFirstPartialOrderingIndex,
  formatSavedTimeHmS,
  type ExamLocalDraft,
} from '@/features/assignments/utils/exam-draft';
import {
  buildResolvedSessionSnapshot,
  buildSubmitRequestBody,
  buildSyncPayload,
  fetchExamEntrySession,
  INITIAL_SESSION_SNAPSHOT,
  persistDraftFromSnapshot,
  reconcileAutosaveSnapshot,
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<ExamSaveState>('idle');
  const [lastSavedText, setLastSavedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [isTabHidden, setIsTabHidden] = useState(() => typeof document !== 'undefined' && document.hidden);

  const snapshotRef = useRef<ExamSnapshotLike>(INITIAL_SESSION_SNAPSHOT);
  const submittingRef = useRef(false);
  const lastDraftUpdatedAtRef = useRef(0);
  const { clearTimers: clearPendingTimers, resetDirty, markDirty, beginFlush, completeFlush, scheduleForType, hasPendingChanges } =
    useAutosaveScheduler();

  const syncSnapshotState = useCallback((next: ExamSnapshotLike) => {
    snapshotRef.current = next;
    setSession(next.session);
    setAnswers(next.answers);
    setAudioPlayCounts(next.audioPlayCounts);
    setElapsedSeconds(next.elapsedSeconds);
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

  const loadSubmittedFallback = useCallback(
    async (signal?: AbortSignal) => {
      const submitted = await getMySubmittedAssignment(assignmentId, { signal });
      if (!signal?.aborted) applySession(submitted, 'review');
    },
    [assignmentId, applySession],
  );

  const submitNow = useCallback(
    async (autoSubmitted = false) => {
      const snap = snapshotRef.current;
      if (submittingRef.current || !snap.session || snap.viewMode !== 'taking') return;
      if (!autoSubmitted) {
        const partialIdx = findFirstPartialOrderingIndex(snap.session.questions, snap.answers);
        if (partialIdx >= 0) {
          setActionError('Còn câu sắp xếp chưa chọn đủ các mảnh từ. Vui lòng hoàn thành hoặc xóa hết trước khi nộp.');
          setCurrentIndex(partialIdx);
          return;
        }
      }
      submittingRef.current = true;
      setSubmitting(true);
      setActionError('');
      clearPendingTimers();
      try {
        const result = await submitAssignment(assignmentId, buildSubmitRequestBody(snap, autoSubmitted));
        resetDirty();
        clearLocalDraft(result.submission.id, result.submission.studentId);
        applySession(result, 'review');
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 409) {
          await loadSubmittedFallback().catch(() => undefined);
          return;
        }
        setActionError(extractErrorMessage(err, 'Không thể nộp bài lúc này. Vui lòng thử lại.'));
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [assignmentId, applySession, clearPendingTimers, loadSubmittedFallback, resetDirty],
  );

  const flushAutosave = useCallback(async () => {
    clearPendingTimers();
    const snap = snapshotRef.current;
    if (!snap.session || snap.viewMode !== 'taking' || submittingRef.current) return;
    const seqAtStart = beginFlush();
    setSaveState('saving');
    setActionError('');
    try {
      const updated = await autosaveAssignment(assignmentId, buildSyncPayload(snap));
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
      if (err instanceof ApiClientError && err.status === 409) {
        await loadSubmittedFallback().catch(() => undefined);
        return;
      }
      if (err instanceof ApiClientError) {
        setActionError(extractErrorMessage(err, 'Không thể lưu bản nháp lúc này.'));
        setSaveState('dirty');
        return;
      }
      setSaveState('offline');
    }
  }, [assignmentId, applySession, beginFlush, clearPendingTimers, completeFlush, loadSubmittedFallback, resetDirty, submitNow, syncSnapshotState]);

  useEffect(() => {
    if (!assignmentId) return;
    const controller = new AbortController();
    submittingRef.current = false;
    resetDirty();
    void (async () => {
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
    };
  }, [assignmentId, mode, applySession, clearPendingTimers, flushAutosave, resetDirty]);

  const handleOnline = useCallback(() => {
    setIsOffline(false);
    if (snapshotRef.current.viewMode === 'taking') void flushAutosave();
  }, [flushAutosave]);
  const handleOffline = useCallback(() => { setIsOffline(true); setSaveState('offline'); }, []);
  const handleVisibilityChange = useCallback(
    (hidden: boolean) => {
      setIsTabHidden(hidden);
      if (!hidden && snapshotRef.current.viewMode === 'taking') void flushAutosave();
    },
    [flushAutosave],
  );
  const handleRemoteSubmit = useCallback(() => {
    if (snapshotRef.current.viewMode === 'taking') void loadSubmittedFallback().catch(() => undefined);
  }, [loadSubmittedFallback]);
  const handleAdoptDraft = useCallback(
    (incoming: ExamLocalDraft) => syncSnapshotState({ ...snapshotRef.current, ...incoming }),
    [syncSnapshotState],
  );

  useExamBrowserSync({
    submissionId: session?.submission.id,
    studentId: session?.submission.studentId,
    lastDraftUpdatedAtRef,
    onOnline: handleOnline,
    onOffline: handleOffline,
    onVisibilityChange: handleVisibilityChange,
    onRemoteSubmit: handleRemoteSubmit,
    onAdoptDraft: handleAdoptDraft,
  });

  const handleCountdownTick = useCallback(() => {
    const ticked = tickCountdownSnapshot(snapshotRef.current);
    if (!ticked) return null;
    snapshotRef.current = ticked.nextSnap;
    setElapsedSeconds(ticked.nextSnap.elapsedSeconds);
    setRemainingSeconds(ticked.nextRemaining);
    return ticked.nextRemaining;
  }, []);

  const handleCountdownExpire = useCallback(() => void submitNow(true), [submitNow]);

  useExamCountdown({
    active: viewMode === 'taking' && !isOffline && !isTabHidden && remainingSeconds !== null && !submitting,
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
    elapsedSeconds, remainingSeconds, saveState, lastSavedText, errorMessage, actionError,
    submitting, isOffline, selectQuestion, toggleFlag, updateAnswer, recordAudioPlay,
    saveDraftNow: flushAutosave, submitNow,
  };
}

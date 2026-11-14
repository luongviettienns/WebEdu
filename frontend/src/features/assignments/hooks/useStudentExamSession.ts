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
  formatSavedTimeHmS,
  persistExamDraftSnapshot,
  resolveInitialSessionDraft,
  type ExamLocalDraft,
} from '@/features/assignments/utils/exam-draft';
import {
  buildSyncPayload,
  fetchExamEntrySession,
} from '@/features/assignments/utils/exam-session-transport';
import { ApiClientError, extractErrorMessage } from '@/lib/api-client';

export type ExamViewMode = 'loading' | 'taking' | 'review' | 'error';
export type ExamSaveState = 'idle' | 'saving' | 'saved' | 'offline';

interface SessionSnapshot {
  session: StudentExamSessionDto | null;
  viewMode: ExamViewMode;
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
}

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

  const snapshotRef = useRef<SessionSnapshot>({
    session: null,
    viewMode: 'loading',
    answers: {},
    audioPlayCounts: {},
    elapsedSeconds: 0,
    remainingSeconds: null,
  });
  const submittingRef = useRef(false);
  const lastDraftUpdatedAtRef = useRef(0);
  const {
    clearTimers: clearPendingTimers,
    markClean,
    scheduleForType,
    hasPendingChanges,
  } = useAutosaveScheduler();

  const applySession = useCallback((dto: StudentExamSessionDto, nextMode: 'taking' | 'review') => {
    const resolved = resolveInitialSessionDraft(dto, nextMode);
    if (resolved.draftUpdatedAtMs > 0) lastDraftUpdatedAtRef.current = resolved.draftUpdatedAtMs;
    snapshotRef.current = {
      session: dto,
      viewMode: nextMode,
      answers: resolved.answers,
      audioPlayCounts: resolved.audioPlayCounts,
      elapsedSeconds: resolved.elapsedSeconds,
      remainingSeconds: resolved.remainingSeconds,
    };
    setSession(dto);
    setAnswers(resolved.answers);
    setAudioPlayCounts(resolved.audioPlayCounts);
    setElapsedSeconds(resolved.elapsedSeconds);
    setRemainingSeconds(resolved.remainingSeconds);
    setLastSavedText(formatSavedTimeHmS(dto.submission.lastSavedAt));
    setSaveState('saved');
    setViewMode(nextMode);
    return resolved.mergedFromLocal;
  }, []);

  const loadSubmittedFallback = useCallback(
    async (signal?: AbortSignal) => {
      const submitted = await getMySubmittedAssignment(assignmentId, { signal });
      if (!signal?.aborted) applySession(submitted, 'review');
    },
    [assignmentId, applySession],
  );

  const flushAutosave = useCallback(async () => {
    clearPendingTimers();
    const snap = snapshotRef.current;
    if (!snap.session || snap.viewMode !== 'taking' || submittingRef.current) return;
    setSaveState('saving');
    setActionError('');
    try {
      const updated = await autosaveAssignment(assignmentId, buildSyncPayload(snap));
      markClean();
      if (updated.submission.status !== 'IN_PROGRESS') {
        applySession(updated, 'review');
        return;
      }
      snapshotRef.current = { ...snapshotRef.current, session: updated };
      setSession(updated);
      setLastSavedText(formatSavedTimeHmS(updated.submission.lastSavedAt));
      setSaveState('saved');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        await loadSubmittedFallback().catch(() => undefined);
        return;
      }
      setSaveState('offline');
    }
  }, [assignmentId, applySession, clearPendingTimers, loadSubmittedFallback, markClean]);

  const submitNow = useCallback(
    async (autoSubmitted = false) => {
      const snap = snapshotRef.current;
      if (submittingRef.current || !snap.session || snap.viewMode !== 'taking') return;
      submittingRef.current = true;
      setSubmitting(true);
      setActionError('');
      clearPendingTimers();
      try {
        const payload = buildSyncPayload(snap);
        const result = await submitAssignment(assignmentId, {
          ...payload,
          remainingSeconds: autoSubmitted ? 0 : payload.remainingSeconds,
          autoSubmitted,
        });
        markClean();
        clearLocalDraft(result.submission.id);
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
    [assignmentId, applySession, clearPendingTimers, loadSubmittedFallback, markClean],
  );

  useEffect(() => {
    if (!assignmentId) return;
    const controller = new AbortController();
    submittingRef.current = false;
    markClean();
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
  }, [assignmentId, mode, applySession, clearPendingTimers, flushAutosave, markClean]);

  const handleOnline = useCallback(() => {
    setIsOffline(false);
    if (snapshotRef.current.viewMode === 'taking') void flushAutosave();
  }, [flushAutosave]);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
    setSaveState('offline');
  }, []);

  const handleRemoteSubmit = useCallback(() => {
    if (snapshotRef.current.viewMode === 'taking') void loadSubmittedFallback().catch(() => undefined);
  }, [loadSubmittedFallback]);

  const handleAdoptDraft = useCallback((incoming: ExamLocalDraft) => {
    snapshotRef.current = { ...snapshotRef.current, ...incoming };
    setAnswers(incoming.answers);
    setAudioPlayCounts(incoming.audioPlayCounts);
    setElapsedSeconds(incoming.elapsedSeconds);
    setRemainingSeconds(incoming.remainingSeconds);
  }, []);

  useExamBrowserSync({
    submissionId: session?.submission.id,
    lastDraftUpdatedAtRef,
    onOnline: handleOnline,
    onOffline: handleOffline,
    onVisibilityChange: setIsTabHidden,
    onRemoteSubmit: handleRemoteSubmit,
    onAdoptDraft: handleAdoptDraft,
  });

  const handleCountdownTick = useCallback(() => {
    const snap = snapshotRef.current;
    if (snap.remainingSeconds === null) return null;
    const nextElapsed = snap.elapsedSeconds + 1;
    const nextRemaining = Math.max(0, snap.remainingSeconds - 1);
    snapshotRef.current = { ...snap, elapsedSeconds: nextElapsed, remainingSeconds: nextRemaining };
    setElapsedSeconds(nextElapsed);
    setRemainingSeconds(nextRemaining);
    return nextRemaining;
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
      const snap = snapshotRef.current;
      snapshotRef.current = { ...snap, answers: nextAnswers, audioPlayCounts: nextAudio };
      if (!snap.session) return;
      lastDraftUpdatedAtRef.current = persistExamDraftSnapshot(snap.session.submission.id, {
        answers: nextAnswers,
        elapsedSeconds: snap.elapsedSeconds,
        remainingSeconds: snap.remainingSeconds,
        audioPlayCounts: nextAudio,
      });
    },
    [],
  );

  const updateAnswer = useCallback(
    (questionId: string, questionType: QuestionType, payload: StudentAnswerPayload) => {
      const snap = snapshotRef.current;
      if (snap.viewMode !== 'taking') return;
      const nextAnswers = { ...snap.answers, [questionId]: payload };
      setAnswers(nextAnswers);
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
      setAudioPlayCounts(nextAudio);
      persistDraftLocally(snap.answers, nextAudio);
      void flushAutosave();
    },
    [flushAutosave, persistDraftLocally],
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

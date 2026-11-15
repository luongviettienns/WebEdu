'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import {
  getDraftStorageKey,
  MAX_CLOCK_SKEW_MS,
  parseIncomingDraftUpdate,
  sanitizeAdoptedLocalDraft,
} from '@/features/assignments/utils/exam-draft';
import type { ExamSnapshotLike } from '@/features/assignments/utils/exam-session-transport';

export interface UseExamBrowserSyncOptions {
  submissionId: string | undefined;
  studentId: string | undefined;
  lastDraftUpdatedAtRef: React.MutableRefObject<number>;
  snapshotRef: React.RefObject<ExamSnapshotLike>;
  onResume: () => void;
  onOffline: () => void;
  onRemoteSubmit: (submissionId: string) => void;
  onAdoptDraft: (snapshot: ExamSnapshotLike) => void;
}

export function useExamBrowserSync({
  submissionId,
  studentId,
  lastDraftUpdatedAtRef,
  snapshotRef,
  onResume,
  onOffline,
  onRemoteSubmit,
  onAdoptDraft,
}: UseExamBrowserSyncOptions) {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); onResume(); };
    const handleOffline = () => { setIsOffline(true); onOffline(); };
    const handleVisibility = () => { if (!document.hidden) onResume(); };
    const handleStorage = (event: StorageEvent) => {
      if (!submissionId || !studentId || event.key !== getDraftStorageKey(submissionId, studentId)) return;
      if (event.newValue === null) {
        onRemoteSubmit(submissionId);
        return;
      }
      const parsed = parseIncomingDraftUpdate(event.newValue, lastDraftUpdatedAtRef.current);
      if (parsed) {
        lastDraftUpdatedAtRef.current = Math.min(parsed.updatedAtMs, Date.now() + MAX_CLOCK_SKEW_MS);
        const adopted = sanitizeAdoptedLocalDraft(parsed, snapshotRef.current);
        if (!adopted) return;
        lastDraftUpdatedAtRef.current = Math.max(lastDraftUpdatedAtRef.current, adopted.updatedAtMs);
        onAdoptDraft(adopted.snapshot);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [
    submissionId,
    studentId,
    lastDraftUpdatedAtRef,
    snapshotRef,
    onResume,
    onOffline,
    onRemoteSubmit,
    onAdoptDraft,
  ]);
  return isOffline;
}

/** Ticks countdown every second while active and online (wall-clock anchored); auto-submits once at zero. */
export function useExamCountdown(options: {
  active: boolean;
  submissionId: string | undefined;
  onTick: () => number | null;
  onExpire: () => void;
}) {
  const { active, submissionId, onTick, onExpire } = options;
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
  }, [submissionId]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const nextRemaining = onTick();
      if (nextRemaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [active, onTick, onExpire]);
}

const DISCRETE_DEBOUNCE_MS = 500;
const ESSAY_AUTOSAVE_MS = 30_000;

/** Schedules debounced autosave (500ms discrete, 30s essay) and tracks in-flight edit sequence. */
export function useAutosaveScheduler() {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const essayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyEssayRef = useRef(false);
  const editSeqRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (essayTimerRef.current) clearTimeout(essayTimerRef.current);
    debounceTimerRef.current = null;
    essayTimerRef.current = null;
  }, []);

  const resetDirty = useCallback(() => {
    dirtyEssayRef.current = false;
    editSeqRef.current += 1;
  }, []);

  const markDirty = useCallback(() => {
    editSeqRef.current += 1;
  }, []);

  const beginFlush = useCallback(() => editSeqRef.current, []);

  const completeFlush = useCallback((seqAtStart: number): boolean => {
    if (editSeqRef.current !== seqAtStart) return false;
    dirtyEssayRef.current = false;
    return true;
  }, []);

  const scheduleForType = useCallback((questionType: QuestionType, onFlush: () => void) => {
    editSeqRef.current += 1;
    if (questionType === 'ESSAY') {
      dirtyEssayRef.current = true;
      if (!essayTimerRef.current) {
        essayTimerRef.current = setTimeout(() => {
          essayTimerRef.current = null;
          onFlush();
        }, ESSAY_AUTOSAVE_MS);
      }
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      onFlush();
    }, DISCRETE_DEBOUNCE_MS);
  }, []);

  const hasPendingChanges = useCallback(
    () => dirtyEssayRef.current || debounceTimerRef.current !== null,
    [],
  );

  return {
    clearTimers,
    resetDirty,
    markDirty,
    beginFlush,
    completeFlush,
    scheduleForType,
    hasPendingChanges,
  };
}

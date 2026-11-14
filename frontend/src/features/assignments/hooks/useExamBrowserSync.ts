'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import {
  getDraftStorageKey,
  parseIncomingDraftUpdate,
  type ExamLocalDraft,
} from '@/features/assignments/utils/exam-draft';

export interface UseExamBrowserSyncOptions {
  submissionId: string | undefined;
  lastDraftUpdatedAtRef: React.MutableRefObject<number>;
  onOnline: () => void;
  onOffline: () => void;
  onVisibilityChange: (hidden: boolean) => void;
  onRemoteSubmit: () => void;
  onAdoptDraft: (draft: ExamLocalDraft) => void;
}

export function useExamBrowserSync({
  submissionId,
  lastDraftUpdatedAtRef,
  onOnline,
  onOffline,
  onVisibilityChange,
  onRemoteSubmit,
  onAdoptDraft,
}: UseExamBrowserSyncOptions) {
  useEffect(() => {
    const handleVisibility = () => onVisibilityChange(document.hidden);
    const handleStorage = (event: StorageEvent) => {
      if (!submissionId || event.key !== getDraftStorageKey(submissionId)) return;
      if (event.newValue === null) {
        onRemoteSubmit();
        return;
      }
      const parsed = parseIncomingDraftUpdate(event.newValue, lastDraftUpdatedAtRef.current);
      if (parsed) {
        lastDraftUpdatedAtRef.current = parsed.updatedAtMs;
        onAdoptDraft(parsed);
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [
    submissionId,
    lastDraftUpdatedAtRef,
    onOnline,
    onOffline,
    onVisibilityChange,
    onRemoteSubmit,
    onAdoptDraft,
  ]);
}

/** Ticks countdown every second while active, online, and tab is visible; auto-submits once at zero. */
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

/** Schedules debounced autosave (500ms discrete, 30s essay) and tracks dirty essay flag. */
export function useAutosaveScheduler() {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const essayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyEssayRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (essayTimerRef.current) clearTimeout(essayTimerRef.current);
    debounceTimerRef.current = null;
    essayTimerRef.current = null;
  }, []);

  const markClean = useCallback(() => {
    dirtyEssayRef.current = false;
  }, []);

  const scheduleForType = useCallback((questionType: QuestionType, onFlush: () => void) => {
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

  return { clearTimers, markClean, scheduleForType, hasPendingChanges };
}

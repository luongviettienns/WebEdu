'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionType } from '@/features/assessments/api/assessments.api';
import { getDraftStorageKey } from '@/features/assignments/utils/exam-draft';

export interface UseExamBrowserSyncOptions {
  submissionId: string | undefined;
  studentId: string | undefined;
  onResume: () => void;
  onPause: () => void;
  onRemoteChange: () => void;
}

export function useExamBrowserSync({
  submissionId,
  studentId,
  onResume,
  onPause,
  onRemoteChange,
}: UseExamBrowserSyncOptions) {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); onResume(); };
    const handleOffline = () => { setIsOffline(true); onPause(); };
    const handleVisibility = () => { if (document.hidden) onPause(); else onResume(); };
    const handleStorage = (event: StorageEvent) => {
      if (submissionId && studentId && event.newValue &&
          event.key === `${getDraftStorageKey(submissionId, studentId)}:sync`) onRemoteChange();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pagehide', onPause);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pagehide', onPause);
    };
  }, [
    submissionId,
    studentId,
    onResume,
    onPause,
    onRemoteChange,
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

/** Schedules debounced autosave (500ms discrete, 30s essay). */
export function useAutosaveScheduler() {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const essayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (essayTimerRef.current) clearTimeout(essayTimerRef.current);
    debounceTimerRef.current = null;
    essayTimerRef.current = null;
  }, []);

  const scheduleForType = useCallback((questionType: QuestionType, onFlush: () => void) => {
    if (questionType === 'ESSAY') {
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

  return { clearTimers, scheduleForType };
}

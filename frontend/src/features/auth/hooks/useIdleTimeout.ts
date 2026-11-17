'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activityStorageKey,
  readSessionActivity,
  recordSessionActivity,
} from '@/features/auth/utils/session-activity';

export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const IDLE_WARNING_MS = 55 * 60 * 1000;
const ACTIVITY_SYNC_INTERVAL_MS = 1_000;
const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'wheel', 'touchstart'] as const;

export function useIdleTimeout(
  userId: string | undefined,
  onExpire: () => void,
  onKeepAlive: () => Promise<void>,
) {
  const [idleState, setIdleState] = useState<{ userId: string; remainingSeconds: number | null }>();
  const [continuing, setContinuing] = useState(false);
  const [continueFailed, setContinueFailed] = useState(false);
  const lastActivity = useRef(0);
  const lastShared = useRef(0);
  const lastKeepAlive = useRef(0);
  const pendingActivity = useRef(0);
  const expired = useRef(false);
  const extending = useRef(false);
  const updateCountdown = useCallback((remainingSeconds: number | null) => {
    if (!userId) return;
    setIdleState((previous) => previous?.userId === userId && previous.remainingSeconds === remainingSeconds
      ? previous
      : { userId, remainingSeconds });
  }, [userId]);

  const recordActivity = useCallback((user: string, now: number, force = false) => {
    lastActivity.current = now;
    if (force || now - lastShared.current >= ACTIVITY_SYNC_INTERVAL_MS) {
      recordSessionActivity(user, now);
      lastShared.current = now;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const now = Date.now();
    const shared = readSessionActivity(userId, now);
    lastActivity.current = shared || now;
    lastShared.current = lastActivity.current;
    lastKeepAlive.current = now;
    pendingActivity.current = 0;
    expired.current = false;
    if (!shared) recordSessionActivity(userId, now);
    const key = activityStorageKey(userId);

    const syncSharedActivity = () => {
      const shared = readSessionActivity(userId, Date.now());
      if (shared > lastActivity.current) {
        lastActivity.current = shared;
        lastShared.current = shared;
        setContinueFailed(false);
      } else if (shared > 0 && shared < lastShared.current) {
        lastActivity.current = shared;
        lastShared.current = shared;
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) syncSharedActivity();
    };
    const onInteraction = (event: Event) => {
      const now = Date.now();
      if (event.isTrusted && document.visibilityState === 'visible' &&
          now - lastActivity.current < IDLE_WARNING_MS) {
        recordActivity(userId, now);
        pendingActivity.current = now;
      }
    };
    window.addEventListener('storage', onStorage);
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, onInteraction, { passive: true, capture: true });
    });

    const checkIdle = () => {
      syncSharedActivity();
      const now = Date.now();
      const elapsed = now - lastActivity.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        if (expired.current || extending.current) return;
        expired.current = true;
        updateCountdown(0);
        onExpire();
      } else if (elapsed >= IDLE_WARNING_MS) {
        updateCountdown(Math.ceil((IDLE_TIMEOUT_MS - elapsed) / 1000));
      } else {
        expired.current = false;
        updateCountdown(null);
        if (!extending.current && pendingActivity.current > lastKeepAlive.current &&
            now - lastKeepAlive.current >= KEEPALIVE_INTERVAL_MS &&
            now - pendingActivity.current <= KEEPALIVE_INTERVAL_MS) {
          lastKeepAlive.current = now;
          void onKeepAlive().catch(() => undefined);
        }
      }
    };
    const initial = window.setTimeout(checkIdle, 0);
    const timer = window.setInterval(checkIdle, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onInteraction, true));
      window.removeEventListener('storage', onStorage);
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [userId, recordActivity, onExpire, onKeepAlive, updateCountdown]);

  const markActive = useCallback(async () => {
    if (!userId || expired.current || extending.current) return;
    extending.current = true;
    setContinuing(true);
    setContinueFailed(false);
    try {
      await onKeepAlive();
      const now = Date.now();
      lastKeepAlive.current = now;
      recordActivity(userId, now, true);
      updateCountdown(null);
    } catch {
      setContinueFailed(true);
    } finally {
      extending.current = false;
      setContinuing(false);
    }
  }, [userId, onKeepAlive, recordActivity, updateCountdown]);

  return {
    checkingIdle: Boolean(userId && idleState?.userId !== userId),
    remainingSeconds: idleState?.userId === userId ? idleState?.remainingSeconds ?? null : null,
    markActive,
    continuing,
    continueFailed,
  };
}

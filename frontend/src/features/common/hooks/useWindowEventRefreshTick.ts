'use client';

import { useEffect, useState } from 'react';

/**
 * Increments a monotonic tick whenever any listed window custom event fires,
 * letting open data pages refresh automatically without a manual page reload.
 */
export function useWindowEventRefreshTick(eventNames: readonly string[]): number {
  const [tick, setTick] = useState(0);
  const key = eventNames.join('\0');

  useEffect(() => {
    const names = key ? key.split('\0') : [];
    if (names.length === 0) return;
    const onEvent = () => setTick((t) => t + 1);
    for (const name of names) {
      window.addEventListener(name, onEvent);
    }
    return () => {
      for (const name of names) {
        window.removeEventListener(name, onEvent);
      }
    };
  }, [key]);

  return tick;
}

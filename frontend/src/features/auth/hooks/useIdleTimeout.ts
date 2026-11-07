'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 phút
export const IDLE_WARNING_MS = 55 * 60 * 1000; // Cảnh báo ở phút 55 (trước 5 phút)

interface IdleTimeoutState {
  /** Số giây còn lại trước khi tự động đăng xuất; null khi chưa vào ngưỡng cảnh báo */
  remainingSeconds: number | null;
  /** Ghi nhận hoạt động thủ công (ví dụ khi người dùng bấm "Tiếp tục phiên làm việc") */
  markActive: () => void;
}

/**
 * Theo dõi hoạt động người dùng cho Idle Timeout 60 phút (cảnh báo trước 5 phút).
 * Gọi onExpire khi hết thời gian không hoạt động.
 */
export function useIdleTimeout(
  active: boolean,
  onExpire: () => void,
): IdleTimeoutState {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(0);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!active) return;
    lastActivityRef.current = Date.now();

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < IDLE_WARNING_MS) {
        lastActivityRef.current = now;
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ];
    events.forEach((evt) =>
      window.addEventListener(evt, recordActivity, { passive: true }),
    );

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setRemainingSeconds(0);
        onExpireRef.current();
      } else if (elapsed >= IDLE_WARNING_MS) {
        const left = Math.max(
          1,
          Math.ceil((IDLE_TIMEOUT_MS - elapsed) / 1000),
        );
        setRemainingSeconds(left);
      } else {
        setRemainingSeconds(null);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      window.clearInterval(intervalId);
    };
  }, [active]);

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    setRemainingSeconds(null);
  }, []);

  return { remainingSeconds, markActive };
}

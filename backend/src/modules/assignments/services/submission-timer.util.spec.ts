import { describe, expect, it } from 'vitest';
import { tickSubmissionTimer } from './submission-timer.util.js';

describe('submission timer lease', () => {
  it('accounts for sub-second active periods before pausing and freezes the offline gap', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const initial = {
      elapsedSeconds: 0, remainingSeconds: 60,
      timerAccountedAt: null, timerLeaseUntil: null, timerClientId: null,
    };
    const started = tickSubmissionTimer(initial, 1, now, 'current-tab');
    const paused = tickSubmissionTimer(started, 1, new Date(now.getTime() + 500), 'current-tab', true);
    expect(paused).toMatchObject({ elapsedSeconds: 1, remainingSeconds: 59, timerLeaseUntil: null });

    const resumed = tickSubmissionTimer(paused, 1, new Date(now.getTime() + 180_000), 'current-tab');
    expect(resumed).toMatchObject({ elapsedSeconds: 1, remainingSeconds: 59 });
  });
});

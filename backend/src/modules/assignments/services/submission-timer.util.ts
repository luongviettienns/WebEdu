const LEASE_MS = 15_000;

interface TimerState {
  elapsedSeconds: number;
  remainingSeconds: number | null;
  timerAccountedAt: Date | null;
  timerLeaseUntil: Date | null;
  timerClientId: string | null;
}

export function tickSubmissionTimer(
  state: TimerState,
  durationMinutes: number | null,
  now: Date,
  clientId?: string,
  pause = false,
): TimerState {
  if (durationMinutes === null) {
    return {
      elapsedSeconds: state.elapsedSeconds, remainingSeconds: null,
      timerAccountedAt: null, timerLeaseUntil: null, timerClientId: null,
    };
  }

  const maxSeconds = durationMinutes * 60;
  const accountedAt = state.timerAccountedAt?.getTime() ?? now.getTime();
  const leaseUntil = state.timerLeaseUntil?.getTime() ?? accountedAt;
  const pausingOwnLease = pause && !!clientId && clientId === state.timerClientId;
  const activeSeconds = Math.max(0, Math.min(now.getTime(), leaseUntil) - accountedAt) / 1000;
  // Finalizing a lease must account for its last partial second.
  const seconds = pausingOwnLease ? Math.ceil(activeSeconds) : Math.floor(activeSeconds);
  const remainingSeconds = Math.max(0, (state.remainingSeconds ?? maxSeconds) - seconds);
  const elapsedSeconds = Math.min(maxSeconds, state.elapsedSeconds + seconds);
  const accounted = new Date(accountedAt + seconds * 1000);

  if (remainingSeconds === 0 || pausingOwnLease) {
    return { elapsedSeconds, remainingSeconds, timerAccountedAt: null, timerLeaseUntil: null, timerClientId: null };
  }
  if (clientId && !pause) {
    return {
      elapsedSeconds, remainingSeconds,
      timerAccountedAt: leaseUntil > now.getTime() ? accounted : now,
      timerLeaseUntil: new Date(now.getTime() + LEASE_MS),
      timerClientId: clientId,
    };
  }
  return {
    elapsedSeconds, remainingSeconds,
    timerAccountedAt: state.timerAccountedAt ? accounted : null,
    timerLeaseUntil: state.timerLeaseUntil,
    timerClientId: state.timerClientId,
  };
}

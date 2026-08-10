import type { GameState, TimerPurpose, TimerState } from '@cribbit/contracts';

export function startTimer<TState extends GameState>(
  state: TState,
  purpose: TimerPurpose,
  ownerPlayerId: string,
  now: number | undefined,
  startedAtRevision: number = state.revision + 1,
): TimerState | null {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    return null;
  }

  const startedAt = now;
  const durationMs = purpose === 'TURN' ? state.config.turnTimeoutMs : state.config.socialTimeoutMs;
  const timer: TimerState = {
    purpose,
    ownerPlayerId,
    startedAt,
    deadlineAt: startedAt + durationMs,
    startedAtRevision
  };
  state.timer = timer;
  return timer;
}

export function clearTimer<TState extends GameState>(state: TState): void {
  state.timer = null;
}

export function isTimerDue(timer: TimerState, now: number | undefined): boolean {
  return typeof now === 'number' && Number.isFinite(now) && now >= timer.deadlineAt;
}

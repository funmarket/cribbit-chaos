import type { GameCommand, GamePhase } from '../../contracts/src/index.ts';

export interface EngineState {
  revision: number;
  phase: GamePhase;
  winnerId: string | null;
}

export interface EngineResult<TState extends EngineState = EngineState> {
  state: TState;
  events: Array<{ type: string; payload?: unknown }>;
  idempotentReplay?: boolean;
}

/**
 * Production target for the server-authoritative reducer.
 * Phase 1 keeps the approved V4 runtime intact; commands are migrated here one-by-one.
 */
export function applyCommand<TState extends EngineState>(state: TState, _command: GameCommand): EngineResult<TState> {
  return { state, events: [] };
}

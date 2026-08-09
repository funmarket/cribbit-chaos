import type { GameCommand, GamePhase } from '../../contracts/src/index.ts';

export interface EngineState {
  revision: number;
  phase: GamePhase;
  winnerId: string | null;
}

export interface EngineResult<TState extends EngineState = EngineState> {
  state: TState;
  events: Array<{ type:string; payload?:unknown }>;
  idempotentReplay?: boolean;
}

export class EngineNotMigratedError extends Error {
  readonly code = 'ENGINE_NOT_MIGRATED';
  constructor(commandType:string) {
    super(`Authoritative handler for ${commandType} is not enabled until the V4 rules are extracted and transition tests pass.`);
  }
}

/**
 * This package is the production authority target. It deliberately fails closed
 * until Phase 3 migrates the V4 rules away from DOM/local demo state.
 */
export function applyCommand<TState extends EngineState>(_state:TState, command:GameCommand): EngineResult<TState> {
  throw new EngineNotMigratedError(command.type);
}

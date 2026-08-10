import type { GameState } from '@cribbit/contracts';

export function getPlayerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex(player => player.id === playerId);
}

export function getCurrentPlayer(state: GameState) {
  return state.players.find(player => player.id === state.currentPlayerId) || null;
}

export function getNextPlayerIndex(state: GameState, fromIndex = state.players.findIndex(player => player.id === state.currentPlayerId), steps = 1): number {
  const length = state.players.length;
  if (length === 0) return -1;
  const normalized = ((fromIndex % length) + length) % length;
  const offset = steps * state.direction;
  return ((normalized + offset) % length + length) % length;
}

export function advanceTurn(state: GameState, steps = 1): { previousPlayerId: string; nextPlayerId: string } {
  const previousPlayerId = state.currentPlayerId;
  const currentIndex = getPlayerIndex(state, previousPlayerId);
  const nextIndex = getNextPlayerIndex(state, currentIndex, steps);
  const nextPlayer = state.players[nextIndex];
  state.currentPlayerId = nextPlayer.id;
  state.phase = 'PLAY_DRAW';
  return { previousPlayerId, nextPlayerId: nextPlayer.id };
}


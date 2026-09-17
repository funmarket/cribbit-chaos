import type { Card, CardColor, GameState, Player } from '@cribbit/contracts';
import { createEngineError } from './errors.ts';
import { getPlayerIndex } from './turn.ts';

export interface ValidationResult {
  ok: boolean;
  error?: ReturnType<typeof createEngineError>;
  player?: Player;
  card?: Card;
}

function activeCardMatches(state: GameState, card: Card): boolean {
  // Cribbit rule: normal turn-playable specials may be played on your own turn
  // without matching the current color or symbol. Nope remains reaction-only.
  switch (card.kind) {
    case 'skip':
    case 'reverse':
    case 'draw':
    case 'wild':
    case 'truth':
    case 'dare':
    case 'paranoia':
    case 'chaos':
    case 'duel':
      return true;
    case 'number':
      return Boolean(card.color && card.color === state.activeColor) || String(card.value) === state.activeSymbol;
    case 'nope':
      return false;
    case 'tag':
    case 'truth_or_chaos':
    case 'hijack':
    case 'taboo':
    case 'machiavelli':
    case 'ghost':
    case 'reverse_confession':
    case 'dig_me':
      // These families are present in the physical deck but their reducer handlers
      // are not migrated yet. Do not remove a card from hand only to fail later.
      return false;
  }
}

export function isLegalPlay(state: GameState, playerId: string, cardId: string): boolean {
  return validatePlay(state, playerId, cardId).ok;
}

export function validatePlay(state: GameState, playerId: string, cardId: string): ValidationResult {
  if (state.status === 'FINISHED') {
    return { ok: false, error: createEngineError('GAME_ALREADY_FINISHED', 'The game has already finished.') };
  }
  if (state.social && !state.social.resolutionComplete) {
    return { ok: false, error: createEngineError('PENDING_SOCIAL_EFFECT', 'Resolve the active social effect before continuing.') };
  }
  if (state.pendingEffect?.type === 'WILD_COLOR') {
    return { ok: false, error: createEngineError('PENDING_WILD_COLOR', 'Choose the active color before any other gameplay command can continue.') };
  }
  if (state.currentPlayerId !== playerId) {
    return { ok: false, error: createEngineError('NOT_YOUR_TURN', 'Only the current player may play a card.') };
  }
  const playerIndex = getPlayerIndex(state, playerId);
  const player = playerIndex >= 0 ? state.players[playerIndex] : null;
  if (!player) {
    return { ok: false, error: createEngineError('INVALID_COMMAND', 'The player does not exist in the current session.') };
  }
  const card = player.hand.find(item => item.id === cardId) || null;
  if (!card) {
    return { ok: false, error: createEngineError('CARD_NOT_IN_HAND', 'That card is not in the current player hand.') };
  }
  if (!activeCardMatches(state, card)) {
    return { ok: false, error: createEngineError('ILLEGAL_PLAY', 'That card is not currently playable.', { activeColor: state.activeColor, activeSymbol: state.activeSymbol, cardKind: card.kind }) };
  }
  return { ok: true, player, card };
}

export function validateDraw(state: GameState, playerId: string): ValidationResult {
  if (state.status === 'FINISHED') {
    return { ok: false, error: createEngineError('GAME_ALREADY_FINISHED', 'The game has already finished.') };
  }
  if (state.social && !state.social.resolutionComplete) {
    return { ok: false, error: createEngineError('PENDING_SOCIAL_EFFECT', 'Resolve the active social effect before continuing.') };
  }
  if (state.pendingEffect?.type === 'WILD_COLOR') {
    return { ok: false, error: createEngineError('PENDING_WILD_COLOR', 'Choose the active color before any other gameplay command can continue.') };
  }
  if (state.currentPlayerId !== playerId) {
    return { ok: false, error: createEngineError('NOT_YOUR_TURN', 'Only the current player may draw a card.') };
  }
  const playerIndex = getPlayerIndex(state, playerId);
  const player = playerIndex >= 0 ? state.players[playerIndex] : null;
  if (!player) {
    return { ok: false, error: createEngineError('INVALID_COMMAND', 'The player does not exist in the current session.') };
  }
  return { ok: true, player };
}

export function validateWildColor(state: GameState, playerId: string, color: CardColor): ValidationResult {
  if (state.status === 'FINISHED') {
    return { ok: false, error: createEngineError('GAME_ALREADY_FINISHED', 'The game has already finished.') };
  }
  if (state.social && !state.social.resolutionComplete) {
    return { ok: false, error: createEngineError('PENDING_SOCIAL_EFFECT', 'Resolve the active social effect before continuing.') };
  }
  if (state.pendingEffect?.type !== 'WILD_COLOR') {
    return { ok: false, error: createEngineError('NO_PENDING_WILD', 'No Wild color selection is currently pending.') };
  }
  if (state.pendingEffect.playerId !== playerId || state.currentPlayerId !== playerId) {
    return { ok: false, error: createEngineError('NOT_YOUR_TURN', 'Only the player who played Wild may choose the color.') };
  }
  if (!['lime', 'orange', 'cyan', 'purple'].includes(color)) {
    return { ok: false, error: createEngineError('INVALID_WILD_COLOR', 'Choose one of the four engine colors.') };
  }
  const playerIndex = getPlayerIndex(state, playerId);
  const player = playerIndex >= 0 ? state.players[playerIndex] : null;
  if (!player) {
    return { ok: false, error: createEngineError('INVALID_COMMAND', 'The player does not exist in the current session.') };
  }
  return { ok: true, player };
}

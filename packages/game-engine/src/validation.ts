import type { Card, CardColor, GameState, Player } from '@cribbit/contracts';
import { createEngineError } from './errors.ts';
import { getPlayerIndex } from './turn.ts';

export interface ValidationResult {
  ok: boolean;
  error?: ReturnType<typeof createEngineError>;
  player?: Player;
  card?: Card;
}

// RULE-SPECIAL-PLAY-001: Special = every non-Number card family.
function isSpecialCard(card: Card): boolean {
  return card.kind !== 'number';
}

// RULE-SPECIAL-PLAY-008: the Number-or-Special test uses the actual top Play Pile card.
function topPlayPileCard(state: GameState): Card | null {
  return state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;
}

function activeCardMatches(state: GameState, card: Card): boolean {
  // RULE-SPECIAL-PLAY-007: Special classification never overrides card-specific timing.
  // Nope stays reaction-only under RULE-NOPE-001..012 and is never a normal-turn hand play.
  if (card.kind === 'nope') {
    return false;
  }
  if (card.kind === 'number') {
    // RULE-NUMBER-002: a Number matches the active play condition by color or number/value
    // (the Wild-chosen color is authoritative per RULE-WILD-002).
    return Boolean(card.color && card.color === state.activeColor) || String(card.value) === state.activeSymbol;
  }
  // Every other family is a Special. RULE-SPECIAL-PLAY-002: playable from hand while the top
  // Play Pile card is not Special, regardless of color, number, value or symbol.
  // RULE-SPECIAL-PLAY-003: never stacked from hand onto a Special top.
  const top = topPlayPileCard(state);
  return top === null ? true : !isSpecialCard(top);
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

import type { Card, GameCommand, GameEvent, GameState, GameTransition, Player } from '@cribbit/contracts';
import { createEngineError } from './errors.ts';
import { drawCards } from './deck.ts';
import { makeEvent } from './events.ts';
import { advanceTurn } from './turn.ts';
import { isLegalPlay, validateDraw, validatePlay, validateWildColor } from './validation.ts';

function cloneState<TState extends GameState>(state: TState): TState {
  return structuredClone(state);
}

function finalise<TState extends GameState>(
  state: TState,
  ok: boolean,
  events: GameEvent[],
  error?: ReturnType<typeof createEngineError>,
  idempotentReplay = false
): GameTransition<TState> {
  return { ok, state, events, error, idempotentReplay: idempotentReplay || undefined };
}

function cacheSuccess<TState extends GameState>(state: TState, command: GameCommand, events: GameEvent[], revision = state.revision): TState {
  const nextState = cloneState(state);
  nextState.processedCommands = {
    ...state.processedCommands,
    [command.commandId]: {
      commandId: command.commandId,
      type: command.type,
      revision,
      ok: true,
      events
    }
  };
  return nextState;
}

function resolveNormalTurn<TState extends GameState>(state: TState, player: Player, events: GameEvent[], steps = 1): GameTransition<TState> {
  if (player.hand.length === 0) {
    state.status = 'FINISHED';
    state.phase = 'FINISHED';
    state.winnerId = player.id;
    events.push(makeEvent(state, 'GAME_WON', { winnerId: player.id }));
    return finalise(state, true, events);
  }
  const previousPlayerId = player.id;
  const { nextPlayerId } = advanceTurn(state, steps);
  events.push(makeEvent(state, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps, direction: state.direction }));
  return finalise(state, true, events);
}

function resolvePlayedCard<TState extends GameState>(state: TState, player: Player, card: Card): GameTransition<TState> {
  const events: GameEvent[] = [];
  events.push(makeEvent(state, 'CARD_PLAYED', { playerId: player.id, card }));
  const previousPlayerId = player.id;

  if (card.kind === 'number') {
    state.activeColor = card.color ?? state.activeColor;
    state.activeSymbol = String(card.value ?? card.symbol ?? '');
    state.phase = 'WIN_CHECK';
    const result = resolveNormalTurn(state, player, events, 1);
    return result;
  }

  if (card.kind === 'skip') {
    const skippedPlayer = state.players[(state.players.findIndex(item => item.id === state.currentPlayerId) + state.direction + state.players.length) % state.players.length];
    events.push(makeEvent(state, 'PLAYER_SKIPPED', { skippedPlayerId: skippedPlayer.id }));
    state.activeColor = card.color ?? state.activeColor;
    state.activeSymbol = card.symbol ?? card.kind;
    state.phase = 'WIN_CHECK';
    const result = resolveNormalTurn(state, player, events, 2);
    return result;
  }

  if (card.kind === 'reverse') {
    state.direction *= -1;
    events.push(makeEvent(state, 'DIRECTION_CHANGED', { direction: state.direction }));
    state.activeColor = card.color ?? state.activeColor;
    state.activeSymbol = card.symbol ?? card.kind;
    state.phase = 'WIN_CHECK';
    const steps = state.players.length === 2 ? 2 : 1;
    const result = resolveNormalTurn(state, player, events, steps);
    return result;
  }

  if (card.kind === 'draw') {
    const targetIndex = (state.players.findIndex(item => item.id === state.currentPlayerId) + state.direction + state.players.length) % state.players.length;
    const target = state.players[targetIndex];
    const drawn = drawCards(state, state.config.drawPenalty, events);
    target.hand.push(...drawn);
    state.activeColor = card.color ?? state.activeColor;
    state.activeSymbol = card.symbol ?? card.kind;
    events.push(makeEvent(state, 'DRAW_EFFECT_APPLIED', {
      sourcePlayerId: player.id,
      targetPlayerId: target.id,
      amount: drawn.length,
      cardId: card.id,
      drawnCardIds: drawn.map(item => item.id)
    }));
    state.phase = 'WIN_CHECK';
    const result = resolveNormalTurn(state, player, events, 1);
    return result;
  }

  if (card.kind === 'wild') {
    state.activeSymbol = 'wild';
    state.pendingEffect = { type: 'WILD_COLOR', playerId: player.id, cardId: card.id };
    state.phase = 'PENDING_WILD_COLOR';
    events.push(makeEvent(state, 'WILD_COLOR_REQUIRED', { playerId: player.id, cardId: card.id }));
    return finalise(state, true, events);
  }

  return finalise(state, false, events, createEngineError('COMMAND_NOT_IMPLEMENTED', `Card kind ${card.kind} is not yet enabled in the core reducer.`));
}

function handlePlayCard<TState extends GameState>(state: TState, command: GameCommand & { type: 'PLAY_CARD' }): GameTransition<TState> {
  const validation = validatePlay(state, state.currentPlayerId, command.cardId);
  if (!validation.ok || !validation.player || !validation.card) {
    return finalise(state, false, [], validation.error);
  }

  const nextState = cloneState(state);
  const player = nextState.players.find(item => item.id === state.currentPlayerId)!;
  const cardIndex = player.hand.findIndex(item => item.id === command.cardId);
  const card = player.hand.splice(cardIndex, 1)[0];
  nextState.discardPile.push(card);
  if (card.kind !== 'wild') {
    nextState.activeColor = card.color ?? nextState.activeColor;
  }
  nextState.activeSymbol = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : card.kind === 'wild' ? 'wild' : card.symbol ?? card.kind;
  nextState.phase = card.kind === 'wild' ? 'PENDING_WILD_COLOR' : 'WIN_CHECK';

  const result = resolvePlayedCard(nextState, player, card);
  if (!result.ok) return result;
  const events = result.events;
  const committedState = cacheSuccess(result.state, command, events, state.revision + 1);
  committedState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = committedState.revision;
  });
  return finalise(committedState, true, events);
}

function handleDrawCard<TState extends GameState>(state: TState, command: GameCommand & { type: 'DRAW_CARD' }): GameTransition<TState> {
  const validation = validateDraw(state, state.currentPlayerId);
  if (!validation.ok || !validation.player) {
    return finalise(state, false, [], validation.error);
  }
  if (!state.config.allowVoluntaryDraw) {
    const legalCards = validation.player.hand.filter(card => isLegalPlay(state, validation.player!.id, card.id));
    if (legalCards.length > 0) {
      return finalise(state, false, [], createEngineError('ILLEGAL_PLAY', 'A legal play is available, so drawing is not allowed under the current configuration.'));
    }
  }

  const nextState = cloneState(state);
  const player = nextState.players.find(item => item.id === state.currentPlayerId)!;
  const events: GameEvent[] = [];
  const [card] = drawCards(nextState, 1, events);
  player.hand.push(card);
  nextState.phase = 'WIN_CHECK';
  events.push(makeEvent(nextState, 'CARD_DRAWN', { playerId: player.id, card }));
  const previousPlayerId = player.id;
  const { nextPlayerId } = advanceTurn(nextState, 1);
  events.push(makeEvent(nextState, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps: 1, direction: nextState.direction }));
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheSuccess(nextState, command, events, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSelectWildColor<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SELECT_WILD_COLOR' }
): GameTransition<TState> {
  const validation = validateWildColor(state, state.currentPlayerId, command.color);
  if (!validation.ok || !validation.player) {
    return finalise(state, false, [], validation.error);
  }

  const nextState = cloneState(state);
  const player = nextState.players.find(item => item.id === state.currentPlayerId)!;
  const pending = nextState.pendingEffect;
  nextState.pendingEffect = null;
  nextState.activeColor = command.color;
  nextState.activeSymbol = 'wild';
  nextState.phase = 'WIN_CHECK';

  const events: GameEvent[] = [
    makeEvent(nextState, 'WILD_COLOR_SELECTED', { playerId: player.id, color: command.color, cardId: pending?.cardId ?? null })
  ];

  if (player.hand.length === 0) {
    nextState.status = 'FINISHED';
    nextState.phase = 'FINISHED';
    nextState.winnerId = player.id;
    events.push(makeEvent(nextState, 'GAME_WON', { winnerId: player.id }));
  } else {
    const previousPlayerId = player.id;
    const { nextPlayerId } = advanceTurn(nextState, 1);
    events.push(makeEvent(nextState, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps: 1, direction: nextState.direction }));
  }

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheSuccess(nextState, command, events, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

export function applyCommand<TState extends GameState>(state: TState, command: GameCommand): GameTransition<TState> {
  const cached = state.processedCommands[command.commandId];
  if (cached) {
    return {
      ok: cached.ok,
      state,
      events: cached.events as GameEvent[],
      error: cached.error,
      idempotentReplay: true
    };
  }

  if (command.expectedRevision !== state.revision) {
    return finalise(state, false, [], createEngineError('STALE_REVISION', 'Expected revision does not match the authoritative game state.', {
      expectedRevision: command.expectedRevision,
      actualRevision: state.revision
    }));
  }

  if (state.status === 'FINISHED' && command.type !== 'START_GAME') {
    return finalise(state, false, [], createEngineError('GAME_ALREADY_FINISHED', 'The game has already finished.'));
  }

  if (command.type === 'PLAY_CARD') return handlePlayCard(state, command);
  if (command.type === 'DRAW_CARD') return handleDrawCard(state, command);
  if (command.type === 'SELECT_WILD_COLOR') return handleSelectWildColor(state, command);

  return finalise(state, false, [], createEngineError('COMMAND_NOT_IMPLEMENTED', `The core reducer does not implement ${command.type}.`));
}

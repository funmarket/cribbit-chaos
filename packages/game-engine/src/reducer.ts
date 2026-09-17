import type { Card, GameCommand, GameEvent, GameState, GameTransition, Player, SocialAnswerRecord, SocialCardKind, SocialDuelResponseRecord } from '@cribbit/contracts';
import { getEligiblePrompts } from '@cribbit/prompts';
import { createEngineError } from './errors.ts';
import { drawCards } from './deck.ts';
import { makeEvent } from './events.ts';
import { advanceTurn } from './turn.ts';
import { isLegalPlay, validateDraw, validatePlay, validateWildColor } from './validation.ts';
import {
  createAnswerRecord,
  createAuthorshipState,
  createRoulettePresentation,
  createParanoiaVoteState,
  createDuelRecord,
  createSocialState,
  createTurnResolution,
  projectRoulettePresentation,
  selectPromptForSocialEffect,
  type GameCommandContext
} from './social.ts';
import { clearTimer, isTimerDue, startTimer } from './timer.ts';

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

function rememberCommand<TState extends GameState>(
  state: TState,
  command: GameCommand,
  outcome: { ok: boolean; error?: ReturnType<typeof createEngineError>; events: GameEvent[] },
  revision = state.revision
): TState {
  const nextState = cloneState(state);
  nextState.processedCommands = {
    ...state.processedCommands,
    [command.commandId]: {
      commandId: command.commandId,
      type: command.type,
      playerId: command.playerId,
      fingerprint: fingerprintCommand(command),
      revision,
      ok: outcome.ok,
      events: outcome.events,
      error: outcome.error
    }
  };
  return nextState;
}

function fingerprintCommand(command: GameCommand): string {
  switch (command.type) {
    case 'PLAY_CARD':
      return [command.sessionId, command.type, command.playerId, command.cardId].join('|');
    case 'DRAW_CARD':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'SELECT_WILD_COLOR':
      return [command.sessionId, command.type, command.playerId, command.color].join('|');
    case 'PASS_PROMPT':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'REWIND_PROMPT':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'FLAG_PROMPT':
      return [command.sessionId, command.type, command.playerId, command.promptId, command.reasonCode ?? ''].join('|');
    case 'SELECT_ANSWER_MODE':
      return [command.sessionId, command.type, command.playerId, command.mode].join('|');
    case 'SELECT_PARANOIA_PHASE':
      return [command.sessionId, command.type, command.playerId, command.phase].join('|');
    case 'SELECT_PARANOIA_CLASSIC_ANSWER':
      return [command.sessionId, command.type, command.playerId, command.targetId].join('|');
    case 'SUBMIT_PARANOIA_CLASSIC_DECISION':
      return [command.sessionId, command.type, command.playerId, command.decision].join('|');
    case 'REVIEW_ANSWER':
      return [command.sessionId, command.type, command.playerId, command.value ?? '', command.choice ?? '', String(command.completionOnly ?? false)].join('|');
    case 'SUBMIT_CHOICE':
      return [command.sessionId, command.type, command.playerId, command.choice].join('|');
    case 'MARK_ANSWERED_LIVE':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'SELECT_PARANOIA_TARGET':
    case 'SELECT_DUEL_TARGET':
    case 'PARANOIA_CHOICE':
    case 'DUEL_TARGET':
    case 'CHAOS_TARGET':
      return [command.sessionId, command.type, command.playerId, command.targetId].join('|');
    case 'SUBMIT_PARANOIA_VOTE':
      return [command.sessionId, command.type, command.playerId, command.vote].join('|');
    case 'DUEL_VOTE':
      return [command.sessionId, command.type, command.playerId, command.winnerId].join('|');
    case 'SUBMIT_DUEL_RESPONSE':
      return [command.sessionId, command.type, command.playerId, command.side, command.value ?? '', command.choice ?? '', String(command.completionOnly ?? false)].join('|');
    case 'PLAY_NOPE':
      return [command.sessionId, command.type, command.playerId, command.cardId].join('|');
    case 'TIMEOUT_TURN':
    case 'TIMEOUT_SOCIAL':
      return [command.sessionId, command.type, command.playerId, command.timerStartedAtRevision].join('|');
    case 'SUBMIT_ANSWER':
      return [command.sessionId, command.type, command.playerId].join('|');
    default:
      return [command.sessionId, command.type, command.playerId].join('|');
  }
}

function cacheOutcome<TState extends GameState>(
  state: TState,
  command: GameCommand,
  outcome: { ok: boolean; error?: ReturnType<typeof createEngineError>; events: GameEvent[] },
  revision = state.revision
): TState {
  return rememberCommand(state, command, outcome, revision);
}

function failCommand<TState extends GameState>(
  state: TState,
  command: GameCommand,
  error: ReturnType<typeof createEngineError>,
  events: GameEvent[] = [],
  revision = state.revision
): GameTransition<TState> {
  const nextState = cacheOutcome(state, command, { ok: false, error, events }, revision);
  return finalise(nextState, false, events, error);
}

function resolveNormalTurn<TState extends GameState>(state: TState, player: Player, events: GameEvent[], steps = 1, now?: number): GameTransition<TState> {
  if (player.hand.length === 0) {
    state.status = 'FINISHED';
    state.phase = 'FINISHED';
    state.winnerId = player.id;
    clearTimer(state);
    events.push(makeEvent(state, 'GAME_WON', { winnerId: player.id }));
    return finalise(state, true, events);
  }
  const previousPlayerId = player.id;
  const { nextPlayerId } = advanceTurn(state, steps);
  clearTimer(state);
  startTimer(state, 'TURN', nextPlayerId, now);
  events.push(makeEvent(state, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps, direction: state.direction }));
  return finalise(state, true, events);
}

function isSocialCardKind(kind: Card['kind']): kind is SocialCardKind {
  return kind === 'truth' || kind === 'dare' || kind === 'paranoia' || kind === 'chaos' || kind === 'duel';
}

function socialTargetingForKind(kind: SocialCardKind): 'current' | 'specific' | 'all' {
  if (kind === 'paranoia' || kind === 'duel') return 'specific';
  if (kind === 'chaos') return 'all';
  return 'current';
}

function startSocialCardPlay<TState extends GameState>(
  state: TState,
  player: Player,
  card: Card,
  context: GameCommandContext,
  events: GameEvent[]
): ReturnType<typeof createEngineError> | null {
  const kind = card.kind as SocialCardKind;
  events.push(makeEvent(state, 'SOCIAL_CARD_TRIGGERED', { playerId: player.id, cardId: card.id, cardKind: kind }, 0, 'PUBLIC'));

  if (kind === 'truth' || kind === 'dare' || kind === 'chaos') {
    const targeting = kind === 'chaos' ? 'all' : 'current';
    const selected = selectPromptForSocialEffect(state, kind, targeting, context);
    if ('code' in selected) return selected;
    const social = createSocialState(state, card.id, kind, player.id, selected.prompt, selected.selection, {
      type: kind === 'chaos' ? 'CHAOS' : 'PROMPT',
      candidateResultIds: selected.candidateResultIds
    }, context);
    social.pendingTargetId = player.id;
    social.pendingTargetIds = targeting === 'all' ? state.players.map(item => item.id) : [player.id];
    social.answerState = createAnswerRecord();
    state.social = social;
    startTimer(state, 'SOCIAL', player.id, context.now);
    state.phase = 'ANSWER_RESOLVE';
    events.push(makeEvent(state, 'PROMPT_SELECTED', { actorId: player.id, cardId: card.id, promptId: selected.prompt.id, prompt: selected.prompt }, 0, 'PLAYER_PRIVATE', [player.id]));
    events.push(makeEvent(state, 'ROULETTE_PRESENTATION_STARTED', projectRoulettePresentation(social.roulettePresentation!), 1, 'PLAYER_PRIVATE', [player.id]));
    events.push(makeEvent(state, 'ANSWER_REQUIRED', { actorId: player.id, cardId: card.id, cardKind: kind }, 0, 'PUBLIC'));
    return null;
  }

  if (kind === 'paranoia') {
    const selected = selectPromptForSocialEffect(state, kind, 'specific', context);
    if ('code' in selected) return selected;
    const social = createSocialState(state, card.id, kind, player.id, selected.prompt, selected.selection, {
      type: 'PROMPT',
      candidateResultIds: selected.candidateResultIds
    }, context);
    social.pendingTargetIds = state.players.filter(item => item.id !== player.id).map(item => item.id);
    social.pendingTargetId = null;
    state.social = social;
    startTimer(state, 'SOCIAL', player.id, context.now);
    state.phase = 'ANSWER_RESOLVE';
    events.push(makeEvent(state, 'PROMPT_SELECTED', { actorId: player.id, cardId: card.id, promptId: selected.prompt.id, prompt: selected.prompt }, 0, 'PLAYER_PRIVATE', [player.id]));
    events.push(makeEvent(state, 'ROULETTE_PRESENTATION_STARTED', projectRoulettePresentation(social.roulettePresentation!), 1, 'PLAYER_PRIVATE', [player.id]));
    events.push(makeEvent(state, 'TARGET_REQUIRED', { actorId: player.id, cardId: card.id, cardKind: kind, targetCount: social.pendingTargetIds.length }, 0, 'PUBLIC'));
    return null;
  }

  if (kind === 'duel') {
    const social = createSocialState(state, card.id, kind, player.id, null, null, undefined, context);
    social.pendingTargetIds = state.players.filter(item => item.id !== player.id).map(item => item.id);
    state.social = social;
    startTimer(state, 'SOCIAL', player.id, context.now);
    state.phase = 'ANSWER_RESOLVE';
    events.push(makeEvent(state, 'TARGET_REQUIRED', { actorId: player.id, cardId: card.id, cardKind: kind, targetCount: social.pendingTargetIds.length }, 0, 'PUBLIC'));
    return null;
  }

  return createEngineError('COMMAND_NOT_IMPLEMENTED', `Card kind ${card.kind} is not yet enabled in the social reducer.`);
}

function resolvePlayedCard<TState extends GameState>(state: TState, player: Player, card: Card, context: GameCommandContext): GameTransition<TState> {
  const events: GameEvent[] = [];
  events.push(makeEvent(state, 'CARD_PLAYED', { playerId: player.id, card }));

  if (card.kind === 'number') {
    state.activeColor = card.color ?? state.activeColor;
    state.activeSymbol = String(card.value ?? card.symbol ?? '');
    state.phase = 'WIN_CHECK';
    const result = resolveNormalTurn(state, player, events, 1, context.now);
    return result;
  }

  if (card.kind === 'skip') {
    const skippedPlayer = state.players[(state.players.findIndex(item => item.id === state.currentPlayerId) + state.direction + state.players.length) % state.players.length];
    events.push(makeEvent(state, 'PLAYER_SKIPPED', { skippedPlayerId: skippedPlayer.id }));
    state.activeColor = card.color ?? state.activeColor;
    state.activeSymbol = card.symbol ?? card.kind;
    state.phase = 'WIN_CHECK';
    const result = resolveNormalTurn(state, player, events, 2, context.now);
    return result;
  }

  if (card.kind === 'reverse') {
    state.direction *= -1;
    events.push(makeEvent(state, 'DIRECTION_CHANGED', { direction: state.direction }));
    state.activeColor = card.color ?? state.activeColor;
    state.activeSymbol = card.symbol ?? card.kind;
    state.phase = 'WIN_CHECK';
    const steps = state.players.length === 2 ? 2 : 1;
    const result = resolveNormalTurn(state, player, events, steps, context.now);
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
    }, 0, 'PLAYER_PRIVATE', [target.id]));
    state.phase = 'WIN_CHECK';
    const steps = state.config.drawPenaltySkipsTurn ? 2 : 1;
    const result = resolveNormalTurn(state, player, events, steps, context.now);
    return result;
  }

  if (card.kind === 'wild') {
    state.activeSymbol = 'wild';
    state.pendingEffect = { type: 'WILD_COLOR', playerId: player.id, cardId: card.id };
    state.phase = 'PENDING_WILD_COLOR';
    events.push(makeEvent(state, 'WILD_COLOR_REQUIRED', { playerId: player.id, cardId: card.id }));
    return finalise(state, true, events);
  }

  if (card.kind === 'nope') {
    return finalise(state, false, events, createEngineError('COMMAND_NOT_IMPLEMENTED', 'Nope must be played through the dedicated reaction command.'));
  }

  if (isSocialCardKind(card.kind)) {
    const socialError = startSocialCardPlay(state, player, card, context, events);
    if (socialError) return finalise(state, false, events, socialError);
    return finalise(state, true, events);
  }

  return finalise(state, false, events, createEngineError('COMMAND_NOT_IMPLEMENTED', `Card kind ${card.kind} is not yet enabled in the core reducer.`));
}

function handlePlayCard<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'PLAY_CARD' },
  context: GameCommandContext
): GameTransition<TState> {
  const validation = validatePlay(state, command.playerId, command.cardId);
  if (!validation.ok || !validation.player || !validation.card) {
    const nextState = cacheOutcome(state, command, { ok: false, error: validation.error, events: [] }, state.revision);
    return finalise(nextState, false, [], validation.error);
  }

  if (validation.card.kind === 'truth' || validation.card.kind === 'dare' || validation.card.kind === 'paranoia' || validation.card.kind === 'chaos') {
    const preview = selectPromptForSocialEffect(state, validation.card.kind, socialTargetingForKind(validation.card.kind), context);
    if ('code' in preview) {
      const nextState = cacheOutcome(state, command, { ok: false, error: preview, events: [] }, state.revision);
      return finalise(nextState, false, [], preview);
    }
  }

  const nextState = cloneState(state);
  const player = nextState.players.find(item => item.id === command.playerId)!;
  const cardIndex = player.hand.findIndex(item => item.id === command.cardId);
  const card = player.hand.splice(cardIndex, 1)[0];
  nextState.discardPile.push(card);
  if (card.kind !== 'wild') {
    nextState.activeColor = card.color ?? nextState.activeColor;
  }
  nextState.activeSymbol = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : card.kind === 'wild' ? 'wild' : card.symbol ?? card.kind;
  nextState.phase = card.kind === 'wild' ? 'PENDING_WILD_COLOR' : 'WIN_CHECK';

  const result = resolvePlayedCard(nextState, player, card, context);
  if (!result.ok) {
    const recorded = cacheOutcome(result.state, command, { ok: false, error: result.error, events: result.events }, state.revision);
    return finalise(recorded, false, result.events, result.error);
  }
  const events = result.events;
  const committedState = cacheOutcome(result.state, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = committedState.revision;
  });
  return finalise(committedState, true, events);
}

function handleDrawCard<TState extends GameState>(state: TState, command: GameCommand & { type: 'DRAW_CARD' }, context: GameCommandContext): GameTransition<TState> {
  const validation = validateDraw(state, command.playerId);
  if (!validation.ok || !validation.player) {
    const nextState = cacheOutcome(state, command, { ok: false, error: validation.error, events: [] }, state.revision);
    return finalise(nextState, false, [], validation.error);
  }
  if (!state.config.allowVoluntaryDraw) {
    const legalCards = validation.player.hand.filter(card => isLegalPlay(state, validation.player!.id, card.id));
    if (legalCards.length > 0) {
      const error = createEngineError('ILLEGAL_PLAY', 'A legal play is available, so drawing is not allowed under the current configuration.');
      const nextState = cacheOutcome(state, command, { ok: false, error, events: [] }, state.revision);
      return finalise(nextState, false, [], error);
    }
  }

  const nextState = cloneState(state);
  const player = nextState.players.find(item => item.id === command.playerId)!;
  const events: GameEvent[] = [];
  const [card] = drawCards(nextState, 1, events);
  player.hand.push(card);
  nextState.phase = 'WIN_CHECK';
  events.push(makeEvent(nextState, 'CARD_DRAWN', { playerId: player.id, card }, 0, 'PLAYER_PRIVATE', [player.id]));
  const previousPlayerId = player.id;
  clearTimer(nextState);
  const { nextPlayerId } = advanceTurn(nextState, 1);
  startTimer(nextState, 'TURN', nextPlayerId, context.now);
  events.push(makeEvent(nextState, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps: 1, direction: nextState.direction }));
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSelectWildColor<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SELECT_WILD_COLOR' },
  context: GameCommandContext
): GameTransition<TState> {
  const validation = validateWildColor(state, command.playerId, command.color);
  if (!validation.ok || !validation.player) {
    const nextState = cacheOutcome(state, command, { ok: false, error: validation.error, events: [] }, state.revision);
    return finalise(nextState, false, [], validation.error);
  }

  const nextState = cloneState(state);
  const player = nextState.players.find(item => item.id === command.playerId)!;
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
    clearTimer(nextState);
    events.push(makeEvent(nextState, 'GAME_WON', { winnerId: player.id }));
  } else {
    const previousPlayerId = player.id;
    clearTimer(nextState);
    const { nextPlayerId } = advanceTurn(nextState, 1);
    startTimer(nextState, 'TURN', nextPlayerId, context.now);
    events.push(makeEvent(nextState, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps: 1, direction: nextState.direction }));
  }

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function requireSocial<TState extends GameState>(state: TState, expectedKind?: SocialCardKind): { social: NonNullable<TState['social']>; error?: ReturnType<typeof createEngineError> } {
  const social = state.social;
  if (!social) {
    return { social: null as never, error: createEngineError('NO_PENDING_SOCIAL', 'No social effect is currently pending.') };
  }
  if (expectedKind && social.cardKind !== expectedKind) {
    return {
      social,
      error: createEngineError('INVALID_COMMAND', `The current social effect is ${social.cardKind}, not ${expectedKind}.`, { expectedKind, actualKind: social.cardKind })
    };
  }
  return { social };
}

function completeSocialResolution<TState extends GameState>(
  state: TState,
  actor: Player,
  socialKind: SocialCardKind,
  events: GameEvent[],
  steps = 1,
  outcome: 'resolved' | 'blocked' = 'resolved',
  now?: number
): void {
  createTurnResolution(state, actor, events, socialKind, steps, outcome, now);
}

function isAllPlayerCompletionSocial(social: NonNullable<GameState['social']>): boolean {
  return social.cardKind === 'chaos' && social.promptSelection?.selection.targeting === 'all';
}

function isTruthOrDareSocial(social: NonNullable<GameState['social']>): boolean {
  return social.cardKind === 'truth' || social.cardKind === 'dare';
}

const TRUTH_DARE_PASS_PENALTY_CARDS = 2;

function getSocialParticipantIds(social: NonNullable<GameState['social']>): readonly string[] {
  if (isAllPlayerCompletionSocial(social)) return social.pendingCompletionPlayerIds;
  if (social.cardKind === 'duel') {
    return [social.pendingDuel?.initiatorId ?? social.actorId, ...(social.pendingDuel?.opponentId ? [social.pendingDuel.opponentId] : [])];
  }
  if (social.cardKind === 'paranoia') {
    return [...new Set([
      social.actorId,
      ...(social.pendingTargetId ? [social.pendingTargetId] : []),
      ...(social.classicAnswerPlayerId ? [social.classicAnswerPlayerId] : []),
      ...(social.paranoiaVote?.eligibleVoterIds ?? [])
    ])];
  }
  return [social.actorId];
}

function hasUsedRewind(state: GameState, playerId: string): boolean {
  return state.rewindUsedByPlayerIds.includes(playerId);
}

function markRewindUsed(state: GameState, playerId: string): void {
  if (!state.rewindUsedByPlayerIds.includes(playerId)) {
    state.rewindUsedByPlayerIds = [...state.rewindUsedByPlayerIds, playerId];
  }
}

function getCompletionRecord(social: NonNullable<GameState['social']>, playerId: string): SocialAnswerRecord {
  return social.completionRecords[playerId] ?? createAnswerRecord();
}

function setCompletionRecord(nextSocial: NonNullable<GameState['social']>, playerId: string, record: SocialAnswerRecord): void {
  nextSocial.completionRecords = {
    ...nextSocial.completionRecords,
    [playerId]: record
  };
  nextSocial.answerState = record;
}

function isRequiredCompletionPlayer(social: NonNullable<GameState['social']>, playerId: string): boolean {
  return social.pendingCompletionPlayerIds.includes(playerId);
}

function markCompletionResolvedIfAll(social: NonNullable<GameState['social']>): boolean {
  return social.completedCompletionPlayerIds.length >= social.pendingCompletionPlayerIds.length;
}

function resolveAllPlayerCompletion<TState extends GameState>(
  state: TState,
  command: GameCommand,
  eventType: 'ANSWER_SUBMITTED' | 'ANSWER_CHOICE_SUBMITTED' | 'ANSWERED_LIVE_MARKED',
  payload: Record<string, unknown>,
  updateRecord: (record: SocialAnswerRecord) => SocialAnswerRecord,
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (!isAllPlayerCompletionSocial(social)) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'This completion path is only available for targeting=all Chaos prompts.'));
  }
  if (!isRequiredCompletionPlayer(social, command.playerId)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only a required Chaos participant may submit this completion.'));
  }
  if (social.completedCompletionPlayerIds.includes(command.playerId)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already completed the Chaos prompt.'));
  }

  const currentRecord = getCompletionRecord(social, command.playerId);
  const nextRecord = updateRecord(currentRecord);
  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  setCompletionRecord(nextSocial, command.playerId, nextRecord);
  if (nextRecord.status === 'SUBMITTED') {
    nextSocial.completedCompletionPlayerIds = [...new Set([...nextSocial.completedCompletionPlayerIds, command.playerId])];
  }

  const events: GameEvent[] = [
    makeEvent(nextState, eventType, payload, 0, 'PLAYER_PRIVATE', [command.playerId])
  ];

  if (markCompletionResolvedIfAll(nextSocial)) {
    const actor = nextState.players.find(item => item.id === nextSocial.actorId)!;
    completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
  }

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSelectAnswerMode<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SELECT_ANSWER_MODE' }
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (!social.prompt) {
    return failCommand(state, command, createEngineError('NO_PENDING_PROMPT', 'No social prompt is currently selected.'));
  }
  if (command.mode === 'CHOOSE' && !social.prompt.options?.length) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'This prompt does not provide selectable answer options.'));
  }

  if (isAllPlayerCompletionSocial(social)) {
    if (!isRequiredCompletionPlayer(social, command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only a required Chaos participant may select an answer mode.'));
    }
    if (social.completedCompletionPlayerIds.includes(command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already completed the Chaos prompt.'));
    }

    const nextState = cloneState(state);
    const nextSocial = nextState.social!;
    const nextRecord = {
      ...getCompletionRecord(social, command.playerId),
      status: 'MODE_SELECTED',
      mode: command.mode
    } satisfies SocialAnswerRecord;
    if (command.mode === 'ANSWERED_LIVE') {
      nextRecord.completionOnly = true;
    }
    setCompletionRecord(nextSocial, command.playerId, nextRecord);
    const events: GameEvent[] = [
      makeEvent(nextState, 'ANSWER_MODE_SELECTED', { playerId: command.playerId, mode: command.mode, cardKind: nextSocial.cardKind }, 0, 'PLAYER_PRIVATE', [command.playerId])
    ];
    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may choose an answer mode.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  nextSocial.answerState = {
    ...nextSocial.answerState,
    status: 'MODE_SELECTED',
    mode: command.mode
  };
  if (command.mode === 'ANSWERED_LIVE') {
    nextSocial.answerState.completionOnly = true;
  }
  const events: GameEvent[] = [
    makeEvent(nextState, 'ANSWER_MODE_SELECTED', { playerId: command.playerId, mode: command.mode, cardKind: nextSocial.cardKind }, 0, 'PLAYER_PRIVATE', [command.playerId])
  ];
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleReviewAnswer<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'REVIEW_ANSWER' }
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (!social.prompt) {
    return failCommand(state, command, createEngineError('NO_PENDING_PROMPT', 'No social prompt is currently selected.'));
  }
  const promptOptions = social.prompt.options;

  if (isAllPlayerCompletionSocial(social)) {
    if (!isRequiredCompletionPlayer(social, command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only a required Chaos participant may review the answer.'));
    }
    if (social.completedCompletionPlayerIds.includes(command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already completed the Chaos prompt.'));
    }
    const currentRecord = getCompletionRecord(social, command.playerId);
    if (!currentRecord.mode) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Select an answer mode before review.'));
    }
    const nextValue = command.value ?? currentRecord.value;
    const nextChoice = command.choice ?? currentRecord.choice;
    const nextCompletionOnly = command.completionOnly ?? currentRecord.completionOnly;
    if (nextChoice && promptOptions?.length && !promptOptions.includes(nextChoice)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an option supplied by the prompt.'));
    }
    if (currentRecord.mode === 'CHOOSE' && !nextChoice) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an explicit answer before review.'));
    }
    if (currentRecord.mode === 'TYPE' && !nextValue?.trim()) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before review.'));
    }
    if (currentRecord.mode === 'SPEAK' && !nextValue?.trim() && !nextCompletionOnly) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before review.'));
    }
    if (currentRecord.mode === 'ANSWERED_LIVE' && !nextCompletionOnly) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Answered Live must be marked as completion-only.'));
    }

    const nextState = cloneState(state);
    const nextSocial = nextState.social!;
    const nextRecord = {
      ...currentRecord,
      status: 'REVIEW',
      value: command.value ?? currentRecord.value,
      choice: command.choice ?? currentRecord.choice,
      completionOnly: command.completionOnly ?? currentRecord.completionOnly
    } satisfies SocialAnswerRecord;
    setCompletionRecord(nextSocial, command.playerId, nextRecord);
    const events: GameEvent[] = [
      makeEvent(nextState, 'ANSWER_REQUIRED', {
        playerId: command.playerId,
        cardKind: nextSocial.cardKind,
        mode: nextRecord.mode,
        status: nextRecord.status
      }, 0, 'PLAYER_PRIVATE', [command.playerId])
    ];
    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may review the answer.'));
  }
  if (!social.answerState.mode) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Select an answer mode before review.'));
  }
  const nextValue = command.value ?? social.answerState.value;
  const nextChoice = command.choice ?? social.answerState.choice;
  const nextCompletionOnly = command.completionOnly ?? social.answerState.completionOnly;
  if (nextChoice && promptOptions?.length && !promptOptions.includes(nextChoice)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an option supplied by the prompt.'));
  }
  if (social.answerState.mode === 'CHOOSE' && !nextChoice) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an explicit answer before review.'));
  }
  if (social.answerState.mode === 'TYPE' && !nextValue?.trim()) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before review.'));
  }
  if (social.answerState.mode === 'SPEAK' && !nextValue?.trim() && !nextCompletionOnly) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before review.'));
  }
  if (social.answerState.mode === 'ANSWERED_LIVE' && !nextCompletionOnly) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Answered Live must be marked as completion-only.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  nextSocial.answerState = {
    ...nextSocial.answerState,
    status: 'REVIEW',
    value: command.value ?? nextSocial.answerState.value,
    choice: command.choice ?? nextSocial.answerState.choice,
    completionOnly: command.completionOnly ?? nextSocial.answerState.completionOnly
  };
  const events: GameEvent[] = [
    makeEvent(nextState, 'ANSWER_REQUIRED', {
      playerId: command.playerId,
      cardKind: nextSocial.cardKind,
      mode: nextSocial.answerState.mode,
      status: nextSocial.answerState.status
    }, 0, 'PLAYER_PRIVATE', [command.playerId])
  ];
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function finaliseAnswerSocial<TState extends GameState>(
  state: TState,
  command: GameCommand,
  eventType: string,
  payload: Record<string, unknown>,
  recipients: readonly string[],
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may resolve the active social effect.'));
  }
  if (!social.prompt) {
    return failCommand(state, command, createEngineError('NO_PENDING_PROMPT', 'No social prompt is currently selected.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  nextSocial.answerState = {
    ...nextSocial.answerState,
    status: 'SUBMITTED',
    submittedByPlayerId: command.playerId,
    submittedAtRevision: state.revision + 1
  };
  const actor = nextState.players.find(item => item.id === command.playerId)!;
  const events: GameEvent[] = [
    makeEvent(nextState, eventType, payload, 0, 'PLAYER_PRIVATE', recipients)
  ];
  completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSubmitAnswer<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SUBMIT_ANSWER' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (isAllPlayerCompletionSocial(social)) {
    const currentRecord = getCompletionRecord(social, command.playerId);
    const promptOptions = social.prompt?.options;
    const hasValue = Boolean(currentRecord.value?.trim());
    const hasCompletionOnly = currentRecord.completionOnly === true;
    if (!isRequiredCompletionPlayer(social, command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only a required Chaos participant may submit an answer.'));
    }
    if (social.completedCompletionPlayerIds.includes(command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already completed the Chaos prompt.'));
    }
    if (currentRecord.choice && promptOptions?.length && !promptOptions.includes(currentRecord.choice)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an option supplied by the prompt.'));
    }
    if (!currentRecord.mode) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Select an answer mode before submitting.'));
    }
    if (currentRecord.mode === 'CHOOSE' && !currentRecord.choice) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an explicit answer before submitting.'));
    }
    if (currentRecord.mode === 'TYPE' && !hasValue) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before submitting.'));
    }
    if (currentRecord.mode === 'SPEAK' && !hasValue && !hasCompletionOnly) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before submitting.'));
    }
    if (currentRecord.mode === 'ANSWERED_LIVE' && !hasCompletionOnly) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Answered Live must be marked as completion-only.'));
    }
    return resolveAllPlayerCompletion(
      state,
      command,
      'ANSWER_SUBMITTED',
      {
        playerId: command.playerId,
        cardKind: social.cardKind,
        mode: currentRecord.mode,
        value: currentRecord.value ?? null,
        choice: currentRecord.choice ?? null,
        completionOnly: currentRecord.completionOnly
      },
      record => ({
        ...record,
        status: 'SUBMITTED',
        submittedByPlayerId: command.playerId,
        submittedAtRevision: state.revision + 1
      }),
      context
    );
  }
  if (social.cardKind === 'duel') {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Use SUBMIT_DUEL_RESPONSE for Duel resolution.'));
  }
  const promptOptions = social.prompt?.options;
  const hasValue = Boolean(social.answerState.value?.trim());
  const hasCompletionOnly = social.answerState.completionOnly === true;
  if (social.answerState.choice && promptOptions?.length && !promptOptions.includes(social.answerState.choice)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an option supplied by the prompt.'));
  }
  if (!social.answerState.mode) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Select an answer mode before submitting.'));
  }
  if (social.answerState.mode === 'CHOOSE' && !social.answerState.choice) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an explicit answer before submitting.'));
  }
  if (social.answerState.mode === 'TYPE' && !hasValue) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before submitting.'));
  }
  if (social.answerState.mode === 'SPEAK' && !hasValue && !hasCompletionOnly) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide answer content before submitting.'));
  }
  if (social.answerState.mode === 'ANSWERED_LIVE' && !hasCompletionOnly) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Answered Live must be marked as completion-only.'));
  }
  return finaliseAnswerSocial(
    state,
    command,
    'ANSWER_SUBMITTED',
    {
      playerId: command.playerId,
      cardKind: social.cardKind,
      mode: social.answerState.mode,
      value: social.answerState.value ?? null,
      choice: social.answerState.choice ?? null,
      completionOnly: social.answerState.completionOnly
    },
    [command.playerId],
    context
  );
}

function handleSubmitChoice<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SUBMIT_CHOICE' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (isAllPlayerCompletionSocial(social)) {
    const currentRecord = getCompletionRecord(social, command.playerId);
    if (!isRequiredCompletionPlayer(social, command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only a required Chaos participant may submit a choice.'));
    }
    if (social.completedCompletionPlayerIds.includes(command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already completed the Chaos prompt.'));
    }
    if (!currentRecord.mode || currentRecord.mode !== 'CHOOSE') {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose mode must be selected before submitting a choice.'));
    }
    if (!social.prompt?.options?.includes(command.choice)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an option supplied by the prompt.'));
    }
    return resolveAllPlayerCompletion(
      state,
      command,
      'ANSWER_CHOICE_SUBMITTED',
      {
        playerId: command.playerId,
        cardKind: social.cardKind,
        mode: currentRecord.mode,
        choice: command.choice
      },
      record => ({
        ...record,
        choice: command.choice,
        status: 'SUBMITTED',
        submittedByPlayerId: command.playerId,
        submittedAtRevision: state.revision + 1
      }),
      context
    );
  }
  if (social.cardKind === 'duel') {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Use SUBMIT_DUEL_RESPONSE for Duel resolution.'));
  }
  if (!social.answerState.mode || social.answerState.mode !== 'CHOOSE') {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose mode must be selected before submitting a choice.'));
  }
  if (!social.prompt?.options?.includes(command.choice)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an option supplied by the prompt.'));
  }
  return finaliseAnswerSocial(
    state,
    command,
    'ANSWER_CHOICE_SUBMITTED',
    {
      playerId: command.playerId,
      cardKind: social.cardKind,
      mode: social.answerState.mode,
      choice: command.choice
    },
    [command.playerId],
    context
  );
}

function handleMarkAnsweredLive<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'MARK_ANSWERED_LIVE' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (isAllPlayerCompletionSocial(social)) {
    const currentRecord = getCompletionRecord(social, command.playerId);
    if (!isRequiredCompletionPlayer(social, command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only a required Chaos participant may mark completion.'));
    }
    if (social.completedCompletionPlayerIds.includes(command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already completed the Chaos prompt.'));
    }
    if (!currentRecord.mode || currentRecord.mode !== 'ANSWERED_LIVE') {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Answered Live must be selected before marking completion.'));
    }
    return resolveAllPlayerCompletion(
      state,
      command,
      'ANSWERED_LIVE_MARKED',
      {
        playerId: command.playerId,
        cardKind: social.cardKind,
        completionOnly: true
      },
      record => ({
        ...record,
        completionOnly: true,
        status: 'SUBMITTED',
        submittedByPlayerId: command.playerId,
        submittedAtRevision: state.revision + 1
      }),
      context
    );
  }
  if (social.cardKind === 'duel') {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Use SUBMIT_DUEL_RESPONSE for Duel resolution.'));
  }
  if (!social.answerState.mode || social.answerState.mode !== 'ANSWERED_LIVE') {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Answered Live must be selected before marking completion.'));
  }
  return finaliseAnswerSocial(
    state,
    command,
    'ANSWERED_LIVE_MARKED',
    {
      playerId: command.playerId,
      cardKind: social.cardKind,
      completionOnly: true
    },
    [command.playerId],
    context
  );
}

function handleSelectParanoiaTarget<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SELECT_PARANOIA_TARGET' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'paranoia');
  if (error) return failCommand(state, command, error);
  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may choose the Paranoia target.'));
  }
  if (!social.pendingTargetIds.length) {
    return failCommand(state, command, createEngineError('NO_PENDING_TARGET', 'No Paranoia target is currently pending.'));
  }
  if (!social.pendingTargetIds.includes(command.targetId) || command.targetId === command.playerId) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Choose another eligible player for Paranoia.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  nextSocial.pendingTargetId = command.targetId;
  nextSocial.paranoiaPhase = null;
  nextSocial.paranoiaVote = null;
  nextSocial.classicAnswerPlayerId = null;
  nextSocial.classicRevealDecision = null;
  nextSocial.resolutionComplete = false;
  nextSocial.mayAdvanceTurn = false;
  const events: GameEvent[] = [
    makeEvent(nextState, 'PARANOIA_TARGET_SELECTED', {
      actorId: command.playerId,
      cardId: nextSocial.cardId,
      targetPlayerId: command.targetId
    }, 0, 'PLAYER_PRIVATE', [command.playerId]),
    makeEvent(nextState, 'TARGET_REQUIRED', {
      actorId: command.playerId,
      cardId: nextSocial.cardId,
      cardKind: 'paranoia',
      targetCount: nextSocial.pendingTargetIds.length
    }, 1, 'PLAYER_PRIVATE', [command.playerId])
  ];
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSelectParanoiaPhase<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SELECT_PARANOIA_PHASE' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'paranoia');
  if (error) return failCommand(state, command, error);
  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may choose the Paranoia phase.'));
  }
  if (!social.pendingTargetId) {
    return failCommand(state, command, createEngineError('NO_PENDING_TARGET', 'Choose a Paranoia target before selecting a phase.'));
  }
  if (!['CLASSIC', 'STRANGER'].includes(command.phase)) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Choose Classic or Stranger for Paranoia.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  const target = nextState.players.find(item => item.id === nextSocial.pendingTargetId);
  if (!target) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'The selected Paranoia target could not be resolved.'));
  }
  nextSocial.paranoiaPhase = command.phase;
  nextSocial.paranoiaVote = null;
  nextSocial.classicAnswerPlayerId = null;
  nextSocial.classicRevealDecision = null;

  const events: GameEvent[] = [
    makeEvent(nextState, 'PARANOIA_PHASE_SELECTED', {
      actorId: command.playerId,
      cardId: nextSocial.cardId,
      targetPlayerId: target.id,
      phase: command.phase
    }, 0, 'PLAYER_PRIVATE', [command.playerId])
  ];

  if (command.phase === 'CLASSIC') {
    nextSocial.resolutionComplete = false;
    nextSocial.mayAdvanceTurn = false;
    events.push(
      makeEvent(nextState, 'PARANOIA_CLASSIC_ANSWER_REQUIRED', {
        actorId: command.playerId,
        cardId: nextSocial.cardId,
        targetPlayerId: target.id
      }, 1, 'PLAYER_PRIVATE', [target.id])
    );
  } else {
    const eligibleVoterIds = nextState.players
      .filter(player => player.id !== target.id)
      .map(player => player.id);
    nextSocial.paranoiaVote = createParanoiaVoteState('STRANGER', eligibleVoterIds);
    nextSocial.resolutionComplete = eligibleVoterIds.length === 0;
    nextSocial.mayAdvanceTurn = eligibleVoterIds.length === 0;
    if (eligibleVoterIds.length === 0) {
      nextSocial.answerState = {
        ...nextSocial.answerState,
        status: 'SUBMITTED',
        submittedByPlayerId: command.playerId,
        submittedAtRevision: state.revision + 1
      };
      events.push(
        makeEvent(nextState, 'PARANOIA_VOTE_RESOLVED', {
          actorId: command.playerId,
          cardId: nextSocial.cardId,
          targetPlayerId: target.id,
          penaltyApplied: false,
          believeCount: 0,
          lyingOrHoldingBackCount: 0
        }, 1, 'PUBLIC')
      );
    } else {
      events.push(
        makeEvent(nextState, 'PARANOIA_VOTE_REQUIRED', {
          actorId: command.playerId,
          cardId: nextSocial.cardId,
          targetPlayerId: target.id,
          eligibleVoterIds
        }, 1, 'PUBLIC')
      );
    }
  }

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSelectParanoiaClassicAnswer<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SELECT_PARANOIA_CLASSIC_ANSWER' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'paranoia');
  if (error) return failCommand(state, command, error);
  if (social.paranoiaPhase !== 'CLASSIC') {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'No Classic Paranoia answer player is currently pending.'));
  }
  if (!social.pendingTargetId) {
    return failCommand(state, command, createEngineError('NO_PENDING_TARGET', 'Choose a Paranoia target before selecting a Classic answer player.'));
  }
  if (social.pendingTargetId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the selected Paranoia target may choose the Classic answer player.'));
  }
  if (social.resolutionComplete) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Classic Paranoia is already resolved.'));
  }
  const answerPlayer = state.players.find(item => item.id === command.targetId);
  if (!answerPlayer || answerPlayer.id === social.pendingTargetId) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Choose another eligible player as the Classic answer.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  nextSocial.classicAnswerPlayerId = answerPlayer.id;
  nextSocial.classicRevealDecision = null;
  nextSocial.resolutionComplete = false;
  nextSocial.mayAdvanceTurn = false;
  const events: GameEvent[] = [
    makeEvent(nextState, 'PARANOIA_CLASSIC_ANSWER_SELECTED', {
      targetPlayerId: command.playerId,
      answerPlayerId: answerPlayer.id,
      cardId: nextSocial.cardId
    }, 0, 'PLAYER_PRIVATE', [command.playerId, answerPlayer.id])
  ];
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSubmitParanoiaClassicDecision<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SUBMIT_PARANOIA_CLASSIC_DECISION' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'paranoia');
  if (error) return failCommand(state, command, error);
  if (social.paranoiaPhase !== 'CLASSIC' || !social.classicAnswerPlayerId) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'No Classic Paranoia reveal decision is currently pending.'));
  }
  if (social.classicAnswerPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the named Classic answer player may choose Reveal or Keep Secret.'));
  }
  if (!['REVEAL', 'KEEP_SECRET'].includes(command.decision)) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Choose Reveal or Keep Secret.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  const prompt = nextSocial.prompt;
  nextSocial.classicRevealDecision = command.decision;
  nextSocial.resolutionComplete = true;
  nextSocial.mayAdvanceTurn = true;
  nextSocial.answerState = {
    ...nextSocial.answerState,
    status: 'SUBMITTED',
    submittedByPlayerId: command.playerId,
    submittedAtRevision: state.revision + 1
  };
  const payload: Record<string, unknown> = {
    answerPlayerId: command.playerId,
    targetPlayerId: nextSocial.pendingTargetId,
    cardId: nextSocial.cardId,
    decision: command.decision
  };
  if (command.decision === 'REVEAL') {
    payload.promptId = prompt?.id ?? null;
    payload.promptText = prompt?.text ?? null;
  }
  const events: GameEvent[] = [
    makeEvent(
      nextState,
      'PARANOIA_CLASSIC_REVEAL_DECIDED',
      payload,
      0,
      command.decision === 'REVEAL' ? 'PUBLIC' : 'PLAYER_PRIVATE',
      command.decision === 'REVEAL' ? [] : [command.playerId]
    )
  ];
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function applyParanoiaStrangerVoteResolution<TState extends GameState>(
  state: TState,
  nextSocial: NonNullable<TState['social']>,
  actor: Player,
  target: Player,
  events: GameEvent[]
): void {
  const votes = nextSocial.paranoiaVote?.votes ?? {};
  const voteValues = Object.values(votes);
  const believeCount = voteValues.filter(vote => vote === 'BELIEVE').length;
  const lyingOrHoldingBackCount = voteValues.filter(vote => vote === 'LYING' || vote === 'HOLDING_BACK').length;
  const penaltyApplied = lyingOrHoldingBackCount > believeCount;
  if (penaltyApplied) {
    const drawn = drawCards(state, 2, events);
    target.hand.push(...drawn);
    events.push(makeEvent(state, 'DRAW_EFFECT_APPLIED', {
      sourcePlayerId: actor.id,
      targetPlayerId: target.id,
      amount: drawn.length,
      cardId: nextSocial.cardId,
      drawnCardIds: drawn.map(item => item.id)
    }, 0, 'PLAYER_PRIVATE', [target.id]));
  }

  nextSocial.paranoiaVote = nextSocial.paranoiaVote
    ? {
        ...nextSocial.paranoiaVote,
        resolutionApplied: true
      }
    : null;
  nextSocial.resolutionComplete = true;
  nextSocial.mayAdvanceTurn = true;
  nextSocial.answerState = {
    ...nextSocial.answerState,
    status: 'SUBMITTED',
    submittedByPlayerId: actor.id,
    submittedAtRevision: state.revision + 1
  };
  events.push(makeEvent(state, 'PARANOIA_VOTE_RESOLVED', {
    actorId: actor.id,
    cardId: nextSocial.cardId,
    targetPlayerId: target.id,
    penaltyApplied,
    believeCount,
    lyingOrHoldingBackCount
  }, events.length, 'PUBLIC'));
}

function handleSubmitParanoiaVote<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SUBMIT_PARANOIA_VOTE' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'paranoia');
  if (error) return failCommand(state, command, error);
  if (social.paranoiaPhase !== 'STRANGER' || !social.paranoiaVote) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'No Stranger vote is currently pending.'));
  }
  if (!social.paranoiaVote.eligibleVoterIds.includes(command.playerId)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only an eligible Stranger voter may submit a vote.'));
  }
  if (social.paranoiaVote.votes[command.playerId]) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already submitted a Stranger vote.'));
  }
  if (!['BELIEVE', 'LYING', 'HOLDING_BACK'].includes(command.vote)) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Choose Believe, Lying, or Holding Back.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  const target = nextState.players.find(item => item.id === nextSocial.pendingTargetId);
  const actor = nextState.players.find(item => item.id === nextSocial.actorId)!;
  if (!target) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'The selected Paranoia target could not be resolved.'));
  }
  const currentVote = nextSocial.paranoiaVote;
  if (!currentVote) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'No Stranger vote is currently pending.'));
  }
  nextSocial.paranoiaVote = {
    phase: currentVote.phase,
    eligibleVoterIds: [...currentVote.eligibleVoterIds],
    resolutionApplied: currentVote.resolutionApplied,
    votes: {
      ...currentVote.votes,
      [command.playerId]: command.vote
    }
  };

  const events: GameEvent[] = [
    makeEvent(nextState, 'PARANOIA_VOTE_SUBMITTED', {
      voterPlayerId: command.playerId,
      cardId: nextSocial.cardId,
      targetPlayerId: target.id,
      vote: command.vote
    }, 0, 'PLAYER_PRIVATE', [command.playerId])
  ];

  const allVotesSubmitted = currentVote.eligibleVoterIds.every(playerId => Boolean(nextSocial.paranoiaVote?.votes[playerId]));
  if (allVotesSubmitted) {
    applyParanoiaStrangerVoteResolution(nextState, nextSocial, actor, target, events);
  }

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleCompleteFlow<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'COMPLETE_FLOW' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may continue the current flow.'));
  }
  if (!social.resolutionComplete) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Finish this action before continuing.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  const actor = nextState.players.find(item => item.id === command.playerId)!;
  const events: GameEvent[] = [];
  completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function getDuelEligibleVoterIds(state: GameState, initiatorId: string, opponentId: string): string[] {
  return state.players
    .filter(player => player.id !== initiatorId && player.id !== opponentId)
    .map(player => player.id);
}

function applyDuelVoteResolution<TState extends GameState>(
  state: TState,
  nextSocial: NonNullable<TState['social']>,
  actor: Player,
  events: GameEvent[]
): void {
  const duel = nextSocial.pendingDuel;
  if (!duel?.opponentId || !duel.vote || duel.vote.resolutionApplied) return;
  const candidates = [duel.initiatorId, duel.opponentId];
  const counts = Object.fromEntries(candidates.map(candidateId => [candidateId, 0])) as Record<string, number>;
  Object.values(duel.vote.votes).forEach(candidateId => {
    if (candidateId in counts) counts[candidateId] += 1;
  });
  const [initiatorVotes, opponentVotes] = candidates.map(candidateId => counts[candidateId] ?? 0);
  const winnerId =
    initiatorVotes > opponentVotes ? duel.initiatorId :
    opponentVotes > initiatorVotes ? duel.opponentId :
    null;

  nextSocial.pendingDuel = {
    ...duel,
    winnerId,
    vote: {
      ...duel.vote,
      resolutionApplied: true
    }
  };
  nextSocial.resolutionComplete = true;
  nextSocial.mayAdvanceTurn = true;
  nextSocial.answerState = {
    ...nextSocial.answerState,
    status: 'SUBMITTED',
    submittedByPlayerId: actor.id,
    submittedAtRevision: state.revision + 1
  };
  events.push(makeEvent(state, 'DUEL_VOTE_RESOLVED', {
    actorId: actor.id,
    cardId: nextSocial.cardId,
    winnerId,
    votes: counts
  }, events.length, 'PUBLIC'));
}

function beginDuelGroupVote<TState extends GameState>(
  state: TState,
  nextSocial: NonNullable<TState['social']>,
  actor: Player,
  events: GameEvent[]
): void {
  const duel = nextSocial.pendingDuel;
  if (!duel?.opponentId) return;
  const eligibleVoterIds = getDuelEligibleVoterIds(state, duel.initiatorId, duel.opponentId);
  nextSocial.pendingDuel = {
    ...duel,
    resolutionReady: true,
    vote: {
      eligibleVoterIds,
      votes: {},
      resolutionApplied: false
    }
  };
  events.push(makeEvent(state, 'DUEL_GROUP_VOTE_REQUIRED', {
    actorId: actor.id,
    cardId: nextSocial.cardId,
    candidates: [duel.initiatorId, duel.opponentId],
    eligibleVoterIds
  }, events.length, 'PUBLIC'));
  if (!eligibleVoterIds.length) {
    applyDuelVoteResolution(state, nextSocial, actor, events);
  }
}

function handleDuelVote<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'DUEL_VOTE' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'duel');
  if (error) return failCommand(state, command, error);
  const duel = social.pendingDuel;
  if (!duel?.opponentId || !duel.vote) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'No Duel group vote is currently pending.'));
  }
  if (!duel.vote.eligibleVoterIds.includes(command.playerId)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only eligible non-participants may vote on the Duel winner.'));
  }
  if (duel.vote.votes[command.playerId]) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already submitted a Duel vote.'));
  }
  if (![duel.initiatorId, duel.opponentId].includes(command.winnerId)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Choose one of the two Duel participants.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  const nextDuel = nextSocial.pendingDuel!;
  const actor = nextState.players.find(item => item.id === nextSocial.actorId)!;
  nextSocial.pendingDuel = {
    ...nextDuel,
    vote: {
      ...nextDuel.vote!,
      votes: {
        ...nextDuel.vote!.votes,
        [command.playerId]: command.winnerId
      }
    }
  };
  const events: GameEvent[] = [
    makeEvent(nextState, 'DUEL_VOTE_SUBMITTED', {
      voterPlayerId: command.playerId,
      cardId: nextSocial.cardId,
      winnerId: command.winnerId
    }, 0, 'PLAYER_PRIVATE', [command.playerId])
  ];
  const allVotesSubmitted = nextDuel.vote!.eligibleVoterIds.every(playerId => Boolean(nextSocial.pendingDuel?.vote?.votes[playerId]));
  if (allVotesSubmitted) {
    applyDuelVoteResolution(nextState, nextSocial, actor, events);
  }

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSelectDuelTarget<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SELECT_DUEL_TARGET' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'duel');
  if (error) return failCommand(state, command, error);
  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may choose the Duel opponent.'));
  }
  if (!social.pendingTargetIds.length) {
    return failCommand(state, command, createEngineError('NO_PENDING_TARGET', 'No Duel target is currently pending.'));
  }
  if (!social.pendingTargetIds.includes(command.targetId) || command.targetId === command.playerId) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Choose another eligible player for the Duel.'));
  }

  const preview = selectPromptForSocialEffect(state, 'duel', 'specific', context);
  if ('code' in preview) {
    const nextState = cacheOutcome(state, command, { ok: false, error: preview, events: [] }, state.revision);
    return finalise(nextState, false, [], preview);
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  nextSocial.pendingTargetId = command.targetId;
  nextSocial.prompt = preview.prompt;
  nextSocial.roulettePresentation = createRoulettePresentation(nextState, 'PLAYER', command.targetId, social.pendingTargetIds);
  nextSocial.authorship = createAuthorshipState(preview.prompt, context);
  nextSocial.promptSelection = {
    promptId: preview.prompt.id,
    prompt: preview.prompt,
    selection: preview.selection,
    selectedByPlayerId: command.playerId,
    selectedAtRevision: state.revision + 1
  };
  nextSocial.pendingDuel = {
    ...createDuelRecord(command.playerId),
    opponentId: command.targetId,
    prompt: preview.prompt
  };
  const recipients = [command.playerId, command.targetId];
  const events: GameEvent[] = [
    makeEvent(nextState, 'DUEL_TARGET_SELECTED', { actorId: command.playerId, cardId: nextSocial.cardId, targetPlayerId: command.targetId, promptId: preview.prompt.id }, 0, 'PLAYER_PRIVATE', recipients),
    makeEvent(nextState, 'ROULETTE_PRESENTATION_STARTED', projectRoulettePresentation(nextSocial.roulettePresentation), 1, 'PLAYER_PRIVATE', recipients),
    makeEvent(nextState, 'PROMPT_SELECTED', { actorId: command.playerId, cardId: nextSocial.cardId, promptId: preview.prompt.id, prompt: preview.prompt }, 2, 'PLAYER_PRIVATE', recipients)
  ];
  nextState.phase = 'ANSWER_RESOLVE';
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleSubmitDuelResponse<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'SUBMIT_DUEL_RESPONSE' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state, 'duel');
  if (error) return failCommand(state, command, error);
  if (!social.pendingDuel?.opponentId) {
    return failCommand(state, command, createEngineError('NO_PENDING_DUEL', 'No Duel opponent has been selected.'));
  }
  const expectedPlayerId = command.side === 'initiator' ? social.pendingDuel.initiatorId : social.pendingDuel.opponentId;
  if (command.playerId !== expectedPlayerId) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only the active Duel participant may submit this response.'));
  }
  const promptOptions = social.pendingDuel.prompt?.options;
  const hasValue = Boolean(command.value?.trim());
  const hasCompletionOnly = command.completionOnly === true;
  const hasValidChoice = Boolean(command.choice) && Boolean(promptOptions?.length) && promptOptions!.includes(command.choice!);
  if (command.choice && promptOptions?.length && !promptOptions.includes(command.choice)) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Choose an option supplied by the prompt.'));
  }
  if (!hasValue && !hasValidChoice && !hasCompletionOnly) {
    return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'Provide a non-empty value, a valid choice, or completionOnly=true.'));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  const pendingDuel = nextSocial.pendingDuel!;
  const response = {
    playerId: command.playerId,
    submitted: true,
    mode: command.completionOnly ? 'ANSWERED_LIVE' : null,
    value: command.value,
    choice: command.choice,
    completionOnly: command.completionOnly ?? false,
    submittedAtRevision: state.revision + 1
  } satisfies SocialDuelResponseRecord;
  if (command.side === 'initiator') {
    nextSocial.pendingDuel = {
      initiatorId: pendingDuel.initiatorId,
      opponentId: pendingDuel.opponentId,
      prompt: pendingDuel.prompt,
      initiatorResponse: response,
      opponentResponse: pendingDuel.opponentResponse,
      resolutionReady: pendingDuel.resolutionReady,
      winnerId: pendingDuel.winnerId,
      vote: pendingDuel.vote
    };
  } else {
    nextSocial.pendingDuel = {
      initiatorId: pendingDuel.initiatorId,
      opponentId: pendingDuel.opponentId,
      prompt: pendingDuel.prompt,
      initiatorResponse: pendingDuel.initiatorResponse,
      opponentResponse: response,
      resolutionReady: pendingDuel.resolutionReady,
      winnerId: pendingDuel.winnerId,
      vote: pendingDuel.vote
    };
  }
  const updatedDuel = nextSocial.pendingDuel!;
  const bothSubmitted = Boolean(updatedDuel.initiatorResponse?.submitted && updatedDuel.opponentResponse?.submitted);
  nextSocial.pendingDuel = {
    ...updatedDuel,
    resolutionReady: bothSubmitted
  };
  const actor = nextState.players.find(item => item.id === social.actorId)!;
  const events: GameEvent[] = [
    makeEvent(nextState, 'DUEL_RESPONSE_SUBMITTED', {
      actorId: command.playerId,
      side: command.side,
      value: command.value ?? null,
      choice: command.choice ?? null,
      completionOnly: command.completionOnly ?? false
    }, 0, 'PLAYER_PRIVATE', [social.actorId, updatedDuel.opponentId!])
  ];
  if (bothSubmitted) {
    beginDuelGroupVote(nextState, nextSocial, actor, events);
  }
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handlePlayNope<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'PLAY_NOPE' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  return failCommand(state, command, createEngineError('INELIGIBLE_NOPE', 'Duel cannot be blocked with Nope.'));
}

function handlePassPrompt<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'PASS_PROMPT' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);

  if (social.cardKind === 'duel' && !social.prompt) {
    if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
      return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may Pass this prompt.'));
    }

    const nextState = cloneState(state);
    const nextSocial = nextState.social!;
    const actor = nextState.players.find(item => item.id === command.playerId)!;
    const events: GameEvent[] = [
      makeEvent(nextState, 'SOCIAL_PASSED', {
        playerId: command.playerId,
        cardKind: nextSocial.cardKind,
        completionOnly: true
      }, 0, 'PLAYER_PRIVATE', [command.playerId])
    ];
    completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  if (!social.prompt) {
    return failCommand(state, command, createEngineError('NO_PENDING_PROMPT', 'No social prompt is currently selected.'));
  }

  if (isTruthOrDareSocial(social)) {
    if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
      return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may Pass this prompt.'));
    }

    const nextState = cloneState(state);
    const nextSocial = nextState.social!;
    const events: GameEvent[] = [];
    const actor = nextState.players.find(item => item.id === command.playerId)!;
    const drawn = drawCards(nextState, TRUTH_DARE_PASS_PENALTY_CARDS, events);
    actor.hand.push(...drawn);
    nextSocial.answerState = {
      ...nextSocial.answerState,
      status: 'SUBMITTED',
      completionOnly: true,
      submittedByPlayerId: command.playerId,
      submittedAtRevision: state.revision + 1
    };
    events.push(
      makeEvent(nextState, 'DRAW_EFFECT_APPLIED', {
        sourcePlayerId: command.playerId,
        targetPlayerId: command.playerId,
        amount: drawn.length,
        cardId: nextSocial.cardId,
        drawnCardIds: drawn.map(item => item.id)
      }, events.length, 'PLAYER_PRIVATE', [command.playerId]),
      makeEvent(nextState, 'SOCIAL_PASSED', {
        playerId: command.playerId,
        cardKind: nextSocial.cardKind,
        promptId: social.prompt.id,
        completionOnly: true
      }, events.length + 1, 'PLAYER_PRIVATE', [command.playerId])
    );
    completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  if (social.cardKind === 'paranoia') {
    if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
      return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may Pass this prompt.'));
    }

    const nextState = cloneState(state);
    const nextSocial = nextState.social!;
    nextSocial.answerState = {
      ...nextSocial.answerState,
      status: 'SUBMITTED',
      completionOnly: true,
      submittedByPlayerId: command.playerId,
      submittedAtRevision: state.revision + 1
    };
    const actor = nextState.players.find(item => item.id === command.playerId)!;
    const events: GameEvent[] = [
      makeEvent(nextState, 'SOCIAL_PASSED', {
        playerId: command.playerId,
        cardKind: nextSocial.cardKind,
        promptId: social.prompt.id,
        completionOnly: true
      }, 0, 'PLAYER_PRIVATE', [command.playerId])
    ];
    completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  if (social.cardKind === 'duel') {
    if (!getSocialParticipantIds(social).includes(command.playerId)) {
      return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only an active Duel participant may Pass this prompt.'));
    }

    const nextState = cloneState(state);
    const nextSocial = nextState.social!;
    const actor = nextState.players.find(item => item.id === nextSocial.actorId)!;
    const events: GameEvent[] = [
      makeEvent(nextState, 'SOCIAL_PASSED', {
        playerId: command.playerId,
        cardKind: nextSocial.cardKind,
        promptId: social.prompt.id,
        completionOnly: true
      }, 0, 'PLAYER_PRIVATE', [command.playerId])
    ];
    completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  if (isAllPlayerCompletionSocial(social)) {
    if (!isRequiredCompletionPlayer(social, command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_TARGET', 'Only a required Chaos participant may Pass.'));
    }
    if (social.completedCompletionPlayerIds.includes(command.playerId)) {
      return failCommand(state, command, createEngineError('INVALID_SOCIAL_RESPONSE', 'That player has already completed the Chaos prompt.'));
    }

    const currentRecord = getCompletionRecord(social, command.playerId);
    const nextState = cloneState(state);
    const nextSocial = nextState.social!;
    const nextRecord = {
      ...currentRecord,
      status: 'SUBMITTED' as const,
      completionOnly: true,
      submittedByPlayerId: command.playerId,
      submittedAtRevision: state.revision + 1
    };
    setCompletionRecord(nextSocial, command.playerId, nextRecord);
    nextSocial.completedCompletionPlayerIds = [...new Set([...nextSocial.completedCompletionPlayerIds, command.playerId])];

    const events: GameEvent[] = [
      makeEvent(nextState, 'SOCIAL_PASSED', {
        playerId: command.playerId,
        cardKind: nextSocial.cardKind,
        completionOnly: true
      }, 0, 'PLAYER_PRIVATE', [command.playerId])
    ];

    if (markCompletionResolvedIfAll(nextSocial)) {
      const actor = nextState.players.find(item => item.id === nextSocial.actorId)!;
      completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);
    }

    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  return failCommand(state, command, createEngineError('PASS_NOT_ALLOWED', 'Pass is only available for eligible Truth, Dare, Paranoia, Duel, or Chaos prompts.'));
}

function handleRewindPrompt<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'REWIND_PROMPT' },
  context: GameCommandContext
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (!isTruthOrDareSocial(social)) {
    return failCommand(state, command, createEngineError('REWIND_NOT_ALLOWED', 'Rewind is only defined for Truth or Dare prompts.'));
  }
  if (social.actorId !== command.playerId || state.currentPlayerId !== command.playerId) {
    return failCommand(state, command, createEngineError('NOT_YOUR_TURN', 'Only the triggering player may rewind this prompt.'));
  }
  if (!social.prompt || !social.promptSelection) {
    return failCommand(state, command, createEngineError('REWIND_NOT_ALLOWED', 'No private Truth or Dare prompt is currently selected.'));
  }
  if (social.answerState.status !== 'WAITING') {
    return failCommand(state, command, createEngineError('REWIND_NOT_ALLOWED', 'Rewind is only available before the prompt is publicly committed.'));
  }
  if (hasUsedRewind(state, command.playerId)) {
    return failCommand(state, command, createEngineError('REWIND_ALREADY_USED', 'This player has already used the once-per-session Rewind.'));
  }
  if (!context.promptPool?.length) {
    return failCommand(state, command, createEngineError('NO_ALTERNATE_PROMPT', 'A deterministic prompt pool is required to rewind this prompt.'));
  }

  const rewindSelection = {
    ...social.promptSelection.selection,
    excludePromptIds: [...(social.promptSelection.selection.excludePromptIds ?? []), social.prompt.id]
  };
  const eligiblePrompts = getEligiblePrompts(context.promptPool, rewindSelection);
  const replacement = eligiblePrompts[0];
  if (!replacement) {
    return failCommand(state, command, createEngineError('NO_ALTERNATE_PROMPT', 'No alternate eligible prompt is available for Rewind.'));
  }

  const nextState = cloneState(state);
  markRewindUsed(nextState, command.playerId);
  const nextSocial = nextState.social!;
  const rewindedSocial = createSocialState(
    nextState,
    nextSocial.cardId,
    nextSocial.cardKind,
    nextSocial.actorId,
    replacement,
    rewindSelection,
    {
      type: nextSocial.roulettePresentation?.type ?? 'PROMPT',
      candidateResultIds: eligiblePrompts.map(item => item.id)
    },
    context
  );
  rewindedSocial.promptSelection = {
    ...rewindedSocial.promptSelection!,
    selectedAtRevision: state.revision + 1
  };
  rewindedSocial.roulettePresentation = createRoulettePresentation(
    nextState,
    nextSocial.roulettePresentation?.type ?? 'PROMPT',
    replacement.id,
    eligiblePrompts.map(item => item.id),
    'SEALED'
  );
  nextState.social = rewindedSocial;
  startTimer(nextState, 'SOCIAL', command.playerId, context.now);

  const events: GameEvent[] = [
    makeEvent(nextState, 'PROMPT_REWOUND', {
      playerId: command.playerId,
      cardId: nextSocial.cardId,
      cardKind: nextSocial.cardKind,
      promptId: replacement.id,
      prompt: replacement
    }, 0, 'PLAYER_PRIVATE', [command.playerId]),
    makeEvent(nextState, 'ROULETTE_PRESENTATION_STARTED', projectRoulettePresentation(rewindedSocial.roulettePresentation!), 1, 'PLAYER_PRIVATE', [command.playerId])
  ];

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleFlagPrompt<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'FLAG_PROMPT' }
): GameTransition<TState> {
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (!social.prompt) {
    return failCommand(state, command, createEngineError('INVALID_FLAG_TARGET', 'No current prompt is available to flag.'));
  }

  const promptId = command.promptId;
  if (!promptId || promptId !== social.prompt.id) {
    return failCommand(state, command, createEngineError('INVALID_FLAG_TARGET', 'The flagged prompt does not match the current authoritative prompt.'));
  }

  if (!getSocialParticipantIds(social).includes(command.playerId)) {
    return failCommand(state, command, createEngineError('INVALID_FLAG_TARGET', 'Only a participant in the active social effect may flag it.'));
  }

  const nextState = cloneState(state);
  const events: GameEvent[] = [
    makeEvent(nextState, 'CONTENT_FLAGGED', {
      reporterPlayerId: command.playerId,
      cardId: social.cardId,
      cardKind: social.cardKind,
      promptId,
      reasonCode: command.reasonCode ?? null
    }, 0, 'PLAYER_PRIVATE', [command.playerId])
  ];
  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleTimeoutTurn<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'TIMEOUT_TURN'; timerStartedAtRevision: number },
  context: GameCommandContext
): GameTransition<TState> {
  if (!Number.isFinite(context.now)) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Timeout commands require an authoritative now value.'));
  }

  const timer = state.timer;
  if (!timer) {
    return failCommand(state, command, createEngineError('NO_PENDING_TIMER', 'No active timer is currently pending.'));
  }
  if (timer.purpose !== 'TURN' || timer.ownerPlayerId !== state.currentPlayerId || command.timerStartedAtRevision !== timer.startedAtRevision) {
    return failCommand(state, command, createEngineError('STALE_TIMEOUT', 'The turn timer no longer matches the authoritative turn state.'));
  }
  if (!isTimerDue(timer, context.now)) {
    return failCommand(state, command, createEngineError('TIMEOUT_NOT_REACHED', 'The authoritative time has not yet reached the turn deadline.', {
      now: context.now,
      deadlineAt: timer.deadlineAt
    }));
  }

  const nextState = cloneState(state);
  const activePlayer = nextState.players.find(item => item.id === nextState.currentPlayerId);
  if (!activePlayer) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'The active player could not be resolved for the turn timeout.'));
  }

  clearTimer(nextState);
  const events: GameEvent[] = [
    makeEvent(nextState, 'TURN_TIMED_OUT', {
      playerId: activePlayer.id,
      startedAt: timer.startedAt,
      deadlineAt: timer.deadlineAt,
      purpose: timer.purpose
    }, 0, 'PUBLIC')
  ];

  const previousPlayerId = activePlayer.id;
  const { nextPlayerId } = advanceTurn(nextState, 1);
  startTimer(nextState, 'TURN', nextPlayerId, context.now);
  events.push(makeEvent(nextState, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps: 1, direction: nextState.direction }));

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

function handleTimeoutSocial<TState extends GameState>(
  state: TState,
  command: GameCommand & { type: 'TIMEOUT_SOCIAL'; timerStartedAtRevision: number },
  context: GameCommandContext
): GameTransition<TState> {
  if (!Number.isFinite(context.now)) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'Timeout commands require an authoritative now value.'));
  }

  const timer = state.timer;
  if (!timer) {
    return failCommand(state, command, createEngineError('NO_PENDING_TIMER', 'No active timer is currently pending.'));
  }
  if (timer.purpose !== 'SOCIAL') {
    return failCommand(state, command, createEngineError('STALE_TIMEOUT', 'The social timer no longer matches the authoritative social state.'));
  }
  const { social, error } = requireSocial(state);
  if (error) return failCommand(state, command, error);
  if (timer.ownerPlayerId !== social.actorId || command.timerStartedAtRevision !== timer.startedAtRevision) {
    return failCommand(state, command, createEngineError('STALE_TIMEOUT', 'The social timer no longer matches the authoritative social state.'));
  }
  if (!isTimerDue(timer, context.now)) {
    return failCommand(state, command, createEngineError('TIMEOUT_NOT_REACHED', 'The authoritative time has not yet reached the social deadline.', {
      now: context.now,
      deadlineAt: timer.deadlineAt
    }));
  }

  const nextState = cloneState(state);
  const nextSocial = nextState.social!;
  clearTimer(nextState);

  if (nextSocial.cardKind === 'paranoia') {
    const actor = nextState.players.find(item => item.id === nextSocial.actorId);
    const target = nextState.players.find(item => item.id === nextSocial.pendingTargetId);
    if (!actor) {
      return failCommand(state, command, createEngineError('INVALID_COMMAND', 'The active Paranoia actor could not be resolved for the timeout.'));
    }
    const events: GameEvent[] = [
      makeEvent(nextState, 'SOCIAL_TIMED_OUT', {
        actorId: nextSocial.actorId,
        cardId: nextSocial.cardId,
        cardKind: nextSocial.cardKind,
        deadlineAt: timer.deadlineAt
      }, 0, 'PUBLIC')
    ];
    if (nextSocial.paranoiaPhase === 'STRANGER' && nextSocial.paranoiaVote && target && !nextSocial.paranoiaVote.resolutionApplied) {
      applyParanoiaStrangerVoteResolution(nextState, nextSocial, actor, target, events);
    } else if (nextSocial.paranoiaPhase === 'CLASSIC') {
      nextSocial.classicRevealDecision = 'KEEP_SECRET';
      nextSocial.resolutionComplete = true;
      nextSocial.mayAdvanceTurn = true;
      nextSocial.answerState = {
        ...nextSocial.answerState,
        status: 'SUBMITTED',
        completionOnly: true,
        submittedByPlayerId: null,
        submittedAtRevision: null
      };
    } else {
      nextSocial.resolutionComplete = true;
      nextSocial.mayAdvanceTurn = true;
      nextSocial.answerState = {
        ...nextSocial.answerState,
        status: 'SUBMITTED',
        completionOnly: true,
        submittedByPlayerId: null,
        submittedAtRevision: null
      };
    }
    completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);

    nextState.revision = state.revision + 1;
    events.forEach(event => {
      event.revision = nextState.revision;
    });
    const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
    committedState.revision = state.revision + 1;
    return finalise(committedState, true, events);
  }

  if (isAllPlayerCompletionSocial(nextSocial)) {
    for (const playerId of nextSocial.pendingCompletionPlayerIds) {
      if (nextSocial.completedCompletionPlayerIds.includes(playerId)) continue;
      const currentRecord = getCompletionRecord(nextSocial, playerId);
      setCompletionRecord(nextSocial, playerId, {
        ...currentRecord,
        status: 'SUBMITTED',
        completionOnly: true,
        submittedByPlayerId: null,
        submittedAtRevision: null
      });
      nextSocial.completedCompletionPlayerIds = [...new Set([...nextSocial.completedCompletionPlayerIds, playerId])];
    }
  } else {
    if (nextSocial.cardKind === 'duel') {
      nextSocial.pendingReaction = null;
      nextSocial.pendingDuel = nextSocial.pendingDuel
        ? {
            ...nextSocial.pendingDuel,
            resolutionReady: true,
            winnerId: null
          }
        : null;
    }
    nextSocial.answerState = {
      ...nextSocial.answerState,
      status: 'SUBMITTED',
      completionOnly: true,
      submittedByPlayerId: null,
      submittedAtRevision: null
    };
  }

  const actor = nextState.players.find(item => item.id === nextSocial.actorId);
  if (!actor) {
    return failCommand(state, command, createEngineError('INVALID_COMMAND', 'The active social actor could not be resolved for the timeout.'));
  }

  const events: GameEvent[] = [
    makeEvent(nextState, 'SOCIAL_TIMED_OUT', {
      actorId: nextSocial.actorId,
      cardId: nextSocial.cardId,
      cardKind: nextSocial.cardKind,
      deadlineAt: timer.deadlineAt
    }, 0, 'PUBLIC')
  ];
  completeSocialResolution(nextState, actor, nextSocial.cardKind, events, 1, 'resolved', context.now);

  nextState.revision = state.revision + 1;
  events.forEach(event => {
    event.revision = nextState.revision;
  });
  const committedState = cacheOutcome(nextState, command, { ok: true, events }, state.revision + 1);
  committedState.revision = state.revision + 1;
  return finalise(committedState, true, events);
}

export function applyCommand<TState extends GameState>(state: TState, command: GameCommand, context: GameCommandContext = {}): GameTransition<TState> {
  if (command.sessionId !== state.id) {
    return finalise(state, false, [], createEngineError('SESSION_MISMATCH', 'The command was addressed to a different game session.', { expectedSessionId: state.id, actualSessionId: command.sessionId }));
  }

  const cached = state.processedCommands[command.commandId];
  if (cached) {
    const fingerprint = fingerprintCommand(command);
    if (cached.type !== command.type || cached.playerId !== command.playerId || cached.fingerprint !== fingerprint) {
      return finalise(state, false, [], createEngineError('COMMAND_ID_COLLISION', 'That commandId was already used for a different command.', {
        commandId: command.commandId,
        existingType: cached.type,
        incomingType: command.type,
        existingPlayerId: cached.playerId,
        incomingPlayerId: command.playerId
      }));
    }
    return {
      ok: cached.ok,
      state,
      events: [],
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
    const error = createEngineError('GAME_ALREADY_FINISHED', 'The game has already finished.');
    return finalise(cacheOutcome(state, command, { ok: false, error, events: [] }, state.revision), false, [], error);
  }

  if (command.type === 'PLAY_CARD') return handlePlayCard(state, command, context);
  if (command.type === 'DRAW_CARD') return handleDrawCard(state, command, context);
  if (command.type === 'SELECT_WILD_COLOR') return handleSelectWildColor(state, command, context);
  if (command.type === 'SELECT_ANSWER_MODE') return handleSelectAnswerMode(state, command);
  if (command.type === 'REVIEW_ANSWER') return handleReviewAnswer(state, command);
  if (command.type === 'SUBMIT_ANSWER') return handleSubmitAnswer(state, command, context);
  if (command.type === 'SUBMIT_CHOICE') return handleSubmitChoice(state, command, context);
  if (command.type === 'MARK_ANSWERED_LIVE') return handleMarkAnsweredLive(state, command, context);
  if (command.type === 'PASS_PROMPT') return handlePassPrompt(state, command, context);
  if (command.type === 'REWIND_PROMPT') return handleRewindPrompt(state, command, context);
  if (command.type === 'FLAG_PROMPT') return handleFlagPrompt(state, command);
  if (command.type === 'SELECT_PARANOIA_TARGET' || command.type === 'PARANOIA_CHOICE') return handleSelectParanoiaTarget(state, command as GameCommand & { type: 'SELECT_PARANOIA_TARGET' }, context);
  if (command.type === 'SELECT_PARANOIA_PHASE') return handleSelectParanoiaPhase(state, command as GameCommand & { type: 'SELECT_PARANOIA_PHASE' }, context);
  if (command.type === 'SELECT_PARANOIA_CLASSIC_ANSWER') return handleSelectParanoiaClassicAnswer(state, command as GameCommand & { type: 'SELECT_PARANOIA_CLASSIC_ANSWER' }, context);
  if (command.type === 'SUBMIT_PARANOIA_CLASSIC_DECISION') return handleSubmitParanoiaClassicDecision(state, command as GameCommand & { type: 'SUBMIT_PARANOIA_CLASSIC_DECISION' }, context);
  if (command.type === 'SUBMIT_PARANOIA_VOTE') return handleSubmitParanoiaVote(state, command as GameCommand & { type: 'SUBMIT_PARANOIA_VOTE' }, context);
  if (command.type === 'SELECT_DUEL_TARGET' || command.type === 'DUEL_TARGET') return handleSelectDuelTarget(state, command as GameCommand & { type: 'SELECT_DUEL_TARGET' }, context);
  if (command.type === 'SUBMIT_DUEL_RESPONSE') return handleSubmitDuelResponse(state, command, context);
  if (command.type === 'DUEL_VOTE') return handleDuelVote(state, command, context);
  if (command.type === 'PLAY_NOPE') return handlePlayNope(state, command, context);
  if (command.type === 'TIMEOUT_TURN') return handleTimeoutTurn(state, command, context);
  if (command.type === 'TIMEOUT_SOCIAL') return handleTimeoutSocial(state, command, context);
  if (command.type === 'COMPLETE_FLOW') return handleCompleteFlow(state, command, context);

  return finalise(state, false, [], createEngineError('COMMAND_NOT_IMPLEMENTED', `The core reducer does not implement ${command.type}.`));
}

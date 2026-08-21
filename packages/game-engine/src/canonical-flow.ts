import type {
  Card,
  GameCommand,
  GameEvent,
  GameState,
  GameTransition,
  MachiavelliEffectId,
  Player,
  ProcessedCommandRecord,
  SocialAnswerRecord,
  SocialDuelResponseRecord,
  SocialPrompt,
  SocialState,
} from '@cribbit/contracts';
import { drawCards } from './deck.ts';
import { makeEvent } from './events.ts';
import { createEngineError } from './errors.ts';
import { isImmediateInteractionKind } from './adaptive-distribution.ts';
import { createSeededRandom, shuffle } from './rng.ts';
import {
  createAnswerRecord,
  createAuthorshipState,
  createDuelRecord,
  createParanoiaVoteState,
  createRoulettePresentation,
  createSocialState,
  projectRoulettePresentation,
  selectPromptForSocialEffect,
  type GameCommandContext,
} from './social.ts';
import { advanceTurn } from './turn.ts';
import { clearTimer, startTimer } from './timer.ts';
import { validateDraw, validatePlay } from './validation.ts';

type CanonicalState = GameState & {
  forcedResume?: { kind:'ADVANCE'|'SET_CURRENT'; playerId:string; steps?:number } | null;
  pendingWinPlayerId?: string | null;
};

type CanonicalCommand = Extract<GameCommand, {
  type:
    | 'SELECT_PROMPT_SOURCE'
    | 'SUBMIT_MANUAL_PROMPT'
    | 'SELECT_DARE_TARGET'
    | 'SELECT_DUEL_TIMER'
    | 'RESOLVE_CHAOS'
    | 'SELECT_TAG_TARGET'
    | 'SELECT_HIJACK_TARGET'
    | 'SELECT_TABOO_TARGET'
    | 'SUBMIT_TABOO_QUESTION'
    | 'SUBMIT_TABOO_ANSWER'
    | 'SUBMIT_GROUP_QUESTION'
    | 'SUBMIT_GROUP_ANSWER'
    | 'SUBMIT_GROUP_DARE'
    | 'COMPLETE_GROUP_DARE'
    | 'SELECT_MACHIAVELLI_EFFECT'
    | 'SELECT_REVERSE_CONFESSION_TARGET'
    | 'SUBMIT_REVERSE_CONFESSION_QUESTION'
    | 'SUBMIT_REVERSE_CONFESSION_ANSWER'
    | 'SELECT_DIG_ME_TARGET'
    | 'SUBMIT_DIG_ME_QUESTION'
    | 'COMPLETE_DIG_ME'
    | 'ACTIVATE_GHOST'
    | 'END_GHOST_TURN'
}>;

const CANONICAL_COMMANDS = new Set<GameCommand['type']>([
  'SELECT_PROMPT_SOURCE','SUBMIT_MANUAL_PROMPT','SELECT_DARE_TARGET','SELECT_DUEL_TIMER','RESOLVE_CHAOS',
  'SELECT_TAG_TARGET','SELECT_HIJACK_TARGET','SELECT_TABOO_TARGET','SUBMIT_TABOO_QUESTION','SUBMIT_TABOO_ANSWER',
  'SUBMIT_GROUP_QUESTION','SUBMIT_GROUP_ANSWER','SUBMIT_GROUP_DARE','COMPLETE_GROUP_DARE','SELECT_MACHIAVELLI_EFFECT',
  'SELECT_REVERSE_CONFESSION_TARGET','SUBMIT_REVERSE_CONFESSION_QUESTION','SUBMIT_REVERSE_CONFESSION_ANSWER',
  'SELECT_DIG_ME_TARGET','SUBMIT_DIG_ME_QUESTION','COMPLETE_DIG_ME','ACTIVATE_GHOST','END_GHOST_TURN',
]);

const PROMPT_KINDS = new Set<Card['kind']>(['truth','dare','paranoia','duel']);
const CANONICAL_INTERACTION_KINDS = new Set<Card['kind']>([
  'truth','dare','paranoia','chaos','duel','tag','truth_or_chaos','hijack','taboo','machiavelli','reverse_confession','dig_me',
]);

function clone<T>(value:T): T { return structuredClone(value); }
function ext(state:GameState): CanonicalState { return state as CanonicalState; }
function fingerprint(command:GameCommand): string {
  const { commandId: _id, expectedRevision: _revision, ...stable } = command;
  return JSON.stringify(stable);
}
function finalise<T extends GameState>(state:T, ok:boolean, events:GameEvent[], error?:ReturnType<typeof createEngineError>, idempotentReplay=false): GameTransition<T> {
  return { ok, state, events, error, idempotentReplay:idempotentReplay || undefined };
}
function record<T extends GameState>(state:T, command:GameCommand, ok:boolean, events:GameEvent[], error?:ReturnType<typeof createEngineError>): T {
  const next = state;
  const entry: ProcessedCommandRecord = {
    commandId:command.commandId,
    type:command.type,
    playerId:command.playerId,
    fingerprint:fingerprint(command),
    revision:next.revision,
    ok,
    events:[...events],
    ...(error ? { error } : {}),
  };
  next.processedCommands = { ...next.processedCommands, [command.commandId]:entry };
  return next;
}
function fail<T extends GameState>(state:T, command:GameCommand, code:Parameters<typeof createEngineError>[0], message:string): GameTransition<T> {
  const error = createEngineError(code, message);
  const next = clone(state);
  record(next, command, false, [], error);
  return finalise(next, false, [], error);
}
function preflight<T extends GameState>(state:T, command:GameCommand): GameTransition<T> | null {
  const prior = state.processedCommands[command.commandId];
  if (prior) {
    if (prior.type !== command.type || prior.playerId !== command.playerId || prior.fingerprint !== fingerprint(command)) {
      return finalise(state, false, [], createEngineError('COMMAND_ID_COLLISION','This commandId was already used for another command.'));
    }
    return finalise(state, prior.ok, [...prior.events], prior.error, true);
  }
  if (command.sessionId !== state.id) return fail(state, command, 'SESSION_MISMATCH', 'The command belongs to a different game session.');
  if (command.expectedRevision !== state.revision) return fail(state, command, 'STALE_REVISION', 'The game state changed before this command arrived.');
  if (state.status !== 'ACTIVE') return fail(state, command, 'GAME_ALREADY_FINISHED', 'The game has already finished.');
  return null;
}
function commit<T extends GameState>(before:T, next:T, command:GameCommand, events:GameEvent[]): GameTransition<T> {
  next.revision = before.revision + 1;
  events.forEach((event,index) => { event.revision = next.revision; if (!event.id) event.id = `${next.id}:r${next.revision}:${event.type}:${index}`; });
  record(next, command, true, events);
  return finalise(next, true, events);
}
function player(state:GameState, id:string): Player | null { return state.players.find(item => item.id === id) ?? null; }
function otherPlayerIds(state:GameState, actorId:string): string[] { return state.players.filter(item => item.id !== actorId).map(item => item.id); }
function normalizeText(value:unknown, min=3, max=280): string | null {
  const text = String(value ?? '').trim();
  return text.length >= min && text.length <= max ? text : null;
}
function manualPrompt(state:GameState, social:SocialState, text:string): SocialPrompt {
  const kind = social.cardKind;
  const targeting = kind === 'paranoia' || kind === 'duel' || kind === 'dare' ? 'specific' : 'current';
  return {
    id:`manual:${state.id}:${state.revision + 1}:${social.actorId}`,
    kind,
    text,
    world:state.config.contentWorld,
    stage:Number.MAX_SAFE_INTEGER,
    groupSizeMin:2,
    groupSizeMax:state.players.length,
    intensity:Number.MAX_SAFE_INTEGER,
    language:'*',
    callSuitability:'*',
    targeting,
    authorshipMode:'SIGNED',
    destination:'room',
    ...(kind === 'duel' ? { duelJudgingMode:'GROUP_VOTE' as const } : {}),
  };
}
function setSocialTimer(state:GameState, ownerId:string, context:GameCommandContext, durationMs?:number): void {
  if (durationMs === undefined) { startTimer(state,'SOCIAL',ownerId,context.now); return; }
  const now = context.now ?? Date.now();
  state.timer = { purpose:'SOCIAL', ownerPlayerId:ownerId, startedAt:now, deadlineAt:now + durationMs, startedAtRevision:state.revision };
}
function makeBaseSocial(state:GameState, card:Card, actorId:string, forced:boolean, context:GameCommandContext): SocialState {
  const social = createSocialState(state, card.id, card.kind as SocialState['cardKind'], actorId, null, null, undefined, context);
  social.canonicalStep = 'TARGET';
  social.promptSource = null;
  social.manualPrompt = null;
  social.duelTimerSeconds = null;
  social.chaosEffectId = null;
  social.machiavelliEffectId = null;
  social.question = null;
  social.questionAskedLive = false;
  social.groupOptions = [];
  social.groupAnswers = {};
  social.groupDare = null;
  social.groupCompletions = {};
  social.outcome = null;
  social.forced = forced;
  return social;
}
function chooseChaosEffect(state:GameState): 'BLIND_SWAP'|'REVERSE_ORDER' {
  return ((state.revision + state.players.length) % 2 === 0) ? 'BLIND_SWAP' : 'REVERSE_ORDER';
}
function startInteraction(state:GameState, card:Card, actorId:string, forced:boolean, context:GameCommandContext, events:GameEvent[]): void {
  if (card.kind === 'chaos' && state.chaosReverseActive) {
    state.direction = state.direction === 1 ? -1 : 1;
    state.chaosReverseActive = false;
    events.push(makeEvent(state,'DIRECTION_CHANGED',{ direction:state.direction, reason:'CHAOS_REVERSE_EXPIRED' },events.length));
  }
  const social = makeBaseSocial(state, card, actorId, forced, context);
  if (card.kind === 'truth') {
    social.pendingTargetId = actorId;
    social.pendingTargetIds = [actorId];
    social.canonicalStep = 'PROMPT_SOURCE';
  } else if (card.kind === 'dare') {
    social.pendingTargetIds = otherPlayerIds(state, actorId);
    social.canonicalStep = 'TARGET';
  } else if (card.kind === 'paranoia') {
    social.pendingTargetIds = otherPlayerIds(state, actorId);
    social.canonicalStep = 'PROMPT_SOURCE';
  } else if (card.kind === 'duel') {
    social.pendingTargetIds = otherPlayerIds(state, actorId);
    social.pendingDuel = createDuelRecord(actorId);
    social.canonicalStep = 'TARGET';
  } else if (card.kind === 'chaos') {
    social.chaosEffectId = chooseChaosEffect(state);
    social.canonicalStep = 'CHAOS_RESOLVE';
  } else if (card.kind === 'truth_or_chaos') {
    social.pendingTargetIds = otherPlayerIds(state, actorId);
    social.canonicalStep = 'GROUP_QUESTION';
  } else if (card.kind === 'machiavelli') {
    social.canonicalStep = 'MACHIAVELLI_CHOICE';
  } else {
    social.pendingTargetIds = otherPlayerIds(state, actorId);
    social.canonicalStep = 'TARGET';
  }
  state.social = social;
  state.phase = 'ANSWER_RESOLVE';
  setSocialTimer(state, actorId, context);
  events.push(makeEvent(state,'SOCIAL_CARD_TRIGGERED',{ playerId:actorId, cardId:card.id, cardKind:card.kind, forced },events.length));
  if (social.canonicalStep === 'PROMPT_SOURCE') events.push(makeEvent(state,'PROMPT_SOURCE_REQUIRED',{ actorId, cardKind:card.kind },events.length,'PLAYER_PRIVATE',[actorId]));
  if (social.canonicalStep === 'TARGET') events.push(makeEvent(state,'TARGET_REQUIRED',{ actorId, cardKind:card.kind, targetCount:social.pendingTargetIds.length },events.length));
}
function queueDraws(state:GameState, targetId:string, count:number, events:GameEvent[]): void {
  const target = player(state,targetId);
  if (!target) throw createEngineError('INVALID_SOCIAL_TARGET','Draw target does not exist.');
  const drawn = drawCards(state,count,events);
  const forced = drawn.filter(card => isImmediateInteractionKind(card.kind));
  target.hand.push(...drawn.filter(card => !isImmediateInteractionKind(card.kind)));
  for (const card of drawn) {
    events.push(makeEvent(state,'CARD_DRAWN',{ playerId:targetId, card },events.length,'PLAYER_PRIVATE',[targetId]));
  }
  state.forcedQueue = [...(state.forcedQueue ?? []), ...forced.map(card => ({ actorId:targetId, card }))];
  forced.forEach(card => events.push(makeEvent(state,'FORCED_CARD_QUEUED',{ actorId:targetId, cardId:card.id, cardKind:card.kind },events.length)));
}
function triggerNextForced(state:CanonicalState, context:GameCommandContext, events:GameEvent[]): boolean {
  if (state.social && !state.social.resolutionComplete) return true;
  const queue = state.forcedQueue ?? [];
  const entry = queue.shift();
  state.forcedQueue = queue;
  if (!entry) return false;
  state.discardPile.push(entry.card);
  state.activeSymbol = entry.card.symbol ?? entry.card.kind;
  if (entry.card.color) state.activeColor = entry.card.color;
  events.push(makeEvent(state,'FORCED_CARD_TRIGGERED',{ actorId:entry.actorId, cardId:entry.card.id, cardKind:entry.card.kind },events.length));
  startInteraction(state,entry.card,entry.actorId,true,context,events);
  return true;
}
function setWinner(state:GameState, winnerId:string, events:GameEvent[]): void {
  state.status='FINISHED'; state.phase='FINISHED'; state.winnerId=winnerId; state.social=null; clearTimer(state);
  events.push(makeEvent(state,'GAME_WON',{ winnerId },events.length));
}
function normalAdvance(state:GameState, actorId:string, events:GameEvent[], context:GameCommandContext, steps=1): void {
  const actor = player(state,actorId);
  if (actor && actor.hand.length === 0) { setWinner(state,actorId,events); return; }
  const previousPlayerId = actorId;
  const { nextPlayerId } = advanceTurn(state,steps);
  clearTimer(state); startTimer(state,'TURN',nextPlayerId,context.now);
  events.push(makeEvent(state,'TURN_ADVANCED',{ previousPlayerId,nextPlayerId,steps,direction:state.direction },events.length));
}
function finishBonusFrame(state:CanonicalState, actorId:string, events:GameEvent[], context:GameCommandContext): boolean {
  const stack = state.bonusTurnStack ?? [];
  const frame = stack.at(-1);
  if (!frame || frame.playerId !== actorId) return false;
  stack.pop(); state.bonusTurnStack = stack;
  const pending = frame.pendingWinnerId ? player(state,frame.pendingWinnerId) : null;
  if (pending && pending.hand.length === 0) { setWinner(state,pending.id,events); return true; }
  const actor = player(state,actorId);
  if (actor && actor.hand.length === 0) { setWinner(state,actorId,events); return true; }
  if (frame.kind === 'TAG' && frame.returnPlayerId) {
    state.currentPlayerId = frame.returnPlayerId;
    clearTimer(state); startTimer(state,'TURN',frame.returnPlayerId,context.now);
    events.push(makeEvent(state,'TURN_ADVANCED',{ previousPlayerId:actorId,nextPlayerId:frame.returnPlayerId,steps:0,direction:state.direction,reason:'TAG_RETURN' },events.length));
  }
  return true;
}
function resumeAfterForced(state:CanonicalState, events:GameEvent[], context:GameCommandContext): void {
  if (triggerNextForced(state,context,events)) return;
  const resume = state.forcedResume; state.forcedResume = null;
  const pendingWin = state.pendingWinPlayerId; state.pendingWinPlayerId = null;
  if (pendingWin) {
    const candidate = player(state,pendingWin);
    if (candidate?.hand.length === 0) { setWinner(state,pendingWin,events); return; }
  }
  if (!resume) return;
  if (resume.kind === 'SET_CURRENT') {
    state.currentPlayerId = resume.playerId;
    clearTimer(state); startTimer(state,'TURN',resume.playerId,context.now);
    return;
  }
  if (finishBonusFrame(state,resume.playerId,events,context)) return;
  normalAdvance(state,resume.playerId,events,context,resume.steps ?? 1);
}
function finishInteraction(state:CanonicalState, events:GameEvent[], context:GameCommandContext, outcome='resolved'): void {
  const social = state.social;
  if (!social) return;
  const actorId = social.actorId;
  const wasForced = social.forced === true;
  state.social = null;
  clearTimer(state);
  events.push(makeEvent(state,'SOCIAL_EFFECT_RESOLVED',{ actorId, cardKind:social.cardKind, outcome },events.length));
  if (wasForced) { resumeAfterForced(state,events,context); return; }
  if (triggerNextForced(state,context,events)) {
    if (player(state,actorId)?.hand.length === 0) state.pendingWinPlayerId = actorId;
    if (!state.forcedResume) state.forcedResume = { kind:'ADVANCE', playerId:actorId, steps:1 };
    return;
  }
  if (finishBonusFrame(state,actorId,events,context)) return;
  normalAdvance(state,actorId,events,context,1);
}
function penaltyThenFinish(state:CanonicalState, targetId:string, count:number, events:GameEvent[], context:GameCommandContext, outcome:string): void {
  const social = state.social;
  if (!social) return;
  const actorId = social.actorId;
  const wasForced = social.forced === true;
  state.social = null; clearTimer(state);
  queueDraws(state,targetId,count,events);
  events.push(makeEvent(state,'DRAW_EFFECT_APPLIED',{ sourcePlayerId:actorId,targetPlayerId:targetId,amount:count,cardId:social.cardId },events.length,'PLAYER_PRIVATE',[targetId]));
  events.push(makeEvent(state,'SOCIAL_EFFECT_RESOLVED',{ actorId,cardKind:social.cardKind,outcome },events.length));
  if (player(state,actorId)?.hand.length === 0) state.pendingWinPlayerId = actorId;
  if (wasForced) {
    if (triggerNextForced(state,context,events)) return;
    resumeAfterForced(state,events,context); return;
  }
  state.forcedResume = { kind:'ADVANCE', playerId:actorId, steps:1 };
  if (triggerNextForced(state,context,events)) return;
  resumeAfterForced(state,events,context);
}
function currentSocial(state:GameState, command:GameCommand, kinds?:readonly SocialState['cardKind'][]): SocialState | GameTransition<GameState> {
  const social = state.social;
  if (!social) return fail(state,command,'NO_PENDING_SOCIAL','No interaction is currently active.');
  if (kinds && !kinds.includes(social.cardKind)) return fail(state,command,'INVALID_COMMAND','That command does not match the active interaction.');
  return social;
}
function selectRoulette(state:GameState, social:SocialState, context:GameCommandContext) {
  const targeting = social.cardKind === 'paranoia' || social.cardKind === 'duel' || social.cardKind === 'dare' ? 'specific' : 'current';
  return selectPromptForSocialEffect(state,social.cardKind,targeting,context);
}
function installPrompt(state:GameState, social:SocialState, prompt:SocialPrompt, context:GameCommandContext, candidateIds:readonly string[], selection:any|null): void {
  social.prompt = prompt;
  social.promptSelection = selection ? { promptId:prompt.id,prompt,selection,selectedByPlayerId:social.actorId,selectedAtRevision:state.revision + 1 } : null;
  social.authorship = createAuthorshipState(prompt,context);
  social.roulettePresentation = createRoulettePresentation(state,'PROMPT',prompt.id,candidateIds);
  social.canonicalStep = 'PRIVATE_PREVIEW';
}
function generatedCard(state:GameState, kind:Card['kind'], suffix:string): Card {
  return { id:`generated:${state.id}:${state.revision + 1}:${kind}:${suffix}`,kind,symbol:kind };
}

export function shouldHandleCanonical(state:GameState, command:GameCommand): boolean {
  if (CANONICAL_COMMANDS.has(command.type)) return true;
  if (command.type === 'DRAW_CARD') return true;
  if (command.type === 'PLAY_CARD') {
    const card = player(state,command.playerId)?.hand.find(item => item.id === command.cardId);
    return Boolean(card && (CANONICAL_INTERACTION_KINDS.has(card.kind) || card.kind === 'ghost' || card.kind === 'draw'));
  }
  if (state.social?.canonicalStep) {
    return ['PUBLISH_PROMPT','REVEAL_PROMPT','PASS_PROMPT','SELECT_ANSWER_MODE','REVIEW_ANSWER','SUBMIT_ANSWER','SUBMIT_CHOICE','MARK_ANSWERED_LIVE','SELECT_PARANOIA_TARGET','SELECT_PARANOIA_PHASE','SELECT_PARANOIA_CLASSIC_ANSWER','SUBMIT_PARANOIA_CLASSIC_DECISION','SUBMIT_PARANOIA_VOTE','SELECT_DUEL_TARGET','SUBMIT_DUEL_RESPONSE','DUEL_VOTE','PLAY_NOPE','COMPLETE_FLOW','TIMEOUT_SOCIAL'].includes(command.type);
  }
  return false;
}

export function applyCanonicalCommand<T extends GameState>(state:T, command:GameCommand, context:GameCommandContext={}): GameTransition<T> {
  const checked = preflight(state,command); if (checked) return checked;
  const next = clone(state) as T;
  const cstate = ext(next);
  next.forcedQueue ??= [];
  next.bonusTurnStack ??= [];
  const events:GameEvent[] = [];

  if (command.type === 'PLAY_CARD') {
    const validation = validatePlay(state,command.playerId,command.cardId);
    if (!validation.ok || !validation.card) return fail(state,command,validation.error?.code ?? 'ILLEGAL_PLAY',validation.error?.message ?? 'Illegal card.');
    const p = player(next,command.playerId)!;
    const index = p.hand.findIndex(card => card.id === command.cardId);
    const [card] = p.hand.splice(index,1);
    events.push(makeEvent(next,'CARD_PLAYED',{ playerId:p.id,card },events.length));
    if (card.kind === 'ghost') {
      p.ghostArmedCard = card;
      events.push(makeEvent(next,'GHOST_ARMED',{ playerId:p.id,cardId:card.id },events.length));
      if (finishBonusFrame(cstate,p.id,events,context)) return commit(state,next,command,events);
      normalAdvance(next,p.id,events,context,1);
      return commit(state,next,command,events);
    }
    next.discardPile.push(card);
    next.activeSymbol = card.symbol ?? card.kind;
    if (card.color) next.activeColor = card.color;
    if (card.kind === 'draw') {
      const actorIndex = next.players.findIndex(item => item.id === p.id);
      const targetIndex = (actorIndex + next.direction + next.players.length) % next.players.length;
      const target = next.players[targetIndex];
      queueDraws(next,target.id,next.config.drawPenalty,events);
      events.push(makeEvent(next,'DRAW_EFFECT_APPLIED',{ sourcePlayerId:p.id,targetPlayerId:target.id,amount:next.config.drawPenalty,cardId:card.id },events.length,'PLAYER_PRIVATE',[target.id]));
      if (p.hand.length === 0) cstate.pendingWinPlayerId = p.id;
      cstate.forcedResume = { kind:'ADVANCE',playerId:p.id,steps:next.config.drawPenaltySkipsTurn ? 2 : 1 };
      if (!triggerNextForced(cstate,context,events)) resumeAfterForced(cstate,events,context);
      return commit(state,next,command,events);
    }
    startInteraction(next,card,p.id,false,context,events);
    return commit(state,next,command,events);
  }

  if (command.type === 'DRAW_CARD') {
    const validation = validateDraw(state,command.playerId);
    if (!validation.ok) return fail(state,command,validation.error?.code ?? 'ILLEGAL_PLAY',validation.error?.message ?? 'Draw is not legal.');
    queueDraws(next,command.playerId,1,events);
    cstate.forcedResume = { kind:'ADVANCE',playerId:command.playerId,steps:1 };
    if (!triggerNextForced(cstate,context,events)) resumeAfterForced(cstate,events,context);
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_PROMPT_SOURCE') {
    const social = next.social;
    if (!social || social.canonicalStep !== 'PROMPT_SOURCE' || social.actorId !== command.playerId) return fail(state,command,'INVALID_COMMAND','Prompt source is not currently selectable by this player.');
    social.promptSource = command.source;
    events.push(makeEvent(next,'PROMPT_SOURCE_SELECTED',{ actorId:command.playerId,source:command.source },events.length,'PLAYER_PRIVATE',[command.playerId]));
    if (command.source === 'MANUAL') social.canonicalStep='MANUAL_PROMPT';
    else {
      const selected = selectRoulette(next,social,context);
      if ('code' in selected) return fail(state,command,selected.code,selected.message);
      installPrompt(next,social,selected.prompt,context,selected.candidateResultIds,selected.selection);
      events.push(makeEvent(next,'PROMPT_SELECTED',{ actorId:social.actorId,promptId:selected.prompt.id,prompt:selected.prompt },events.length,'PLAYER_PRIVATE',[social.actorId,...(social.pendingTargetId ? [social.pendingTargetId] : [])]));
      events.push(makeEvent(next,'ROULETTE_PRESENTATION_STARTED',projectRoulettePresentation(social.roulettePresentation!),events.length,'PLAYER_PRIVATE',[social.actorId]));
    }
    return commit(state,next,command,events);
  }

  if (command.type === 'SUBMIT_MANUAL_PROMPT') {
    const social = next.social;
    const text = normalizeText(command.text,10,280);
    if (!social || social.canonicalStep !== 'MANUAL_PROMPT' || social.actorId !== command.playerId || !text) return fail(state,command,'INVALID_SOCIAL_PROMPT','Write a 10–280 character prompt while manual prompt entry is active.');
    social.manualPrompt=text; social.promptSource='MANUAL';
    const prompt = manualPrompt(next,social,text);
    installPrompt(next,social,prompt,context,[prompt.id],null);
    events.push(makeEvent(next,'MANUAL_PROMPT_ACCEPTED',{ actorId:command.playerId,promptId:prompt.id },events.length,'PLAYER_PRIVATE',[command.playerId]));
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_DARE_TARGET') {
    const social = next.social;
    if (!social || social.cardKind !== 'dare' || social.canonicalStep !== 'TARGET' || social.actorId !== command.playerId || !social.pendingTargetIds.includes(command.targetId) || command.targetId === command.playerId) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose another eligible player before selecting the Dare prompt.');
    social.pendingTargetId=command.targetId; social.canonicalStep='PROMPT_SOURCE';
    events.push(makeEvent(next,'DARE_TARGET_SELECTED',{ actorId:command.playerId,targetPlayerId:command.targetId },events.length));
    events.push(makeEvent(next,'PROMPT_SOURCE_REQUIRED',{ actorId:command.playerId,cardKind:'dare' },events.length,'PLAYER_PRIVATE',[command.playerId]));
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_DUEL_TARGET') {
    const social = next.social;
    if (!social || social.cardKind !== 'duel' || social.canonicalStep !== 'TARGET' || social.actorId !== command.playerId || !social.pendingTargetIds.includes(command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose another eligible Duel opponent.');
    social.pendingTargetId=command.targetId;
    social.pendingDuel={ ...createDuelRecord(command.playerId),opponentId:command.targetId };
    social.canonicalStep='PROMPT_SOURCE';
    events.push(makeEvent(next,'DUEL_TARGET_SELECTED',{ actorId:command.playerId,targetPlayerId:command.targetId },events.length));
    events.push(makeEvent(next,'PROMPT_SOURCE_REQUIRED',{ actorId:command.playerId,cardKind:'duel' },events.length,'PLAYER_PRIVATE',[command.playerId]));
    return commit(state,next,command,events);
  }

  if (command.type === 'PUBLISH_PROMPT' || command.type === 'REVEAL_PROMPT') {
    const social = next.social;
    if (!social || social.canonicalStep !== 'PRIVATE_PREVIEW' || !social.prompt) return fail(state,command,'NO_PENDING_PROMPT','No private prompt is ready to reveal.');
    const affected = social.cardKind === 'dare' ? social.pendingTargetId : social.actorId;
    if (command.playerId !== social.actorId && command.playerId !== affected) return fail(state,command,'NOT_YOUR_TURN','Only an active participant may reveal this prompt.');
    if (social.cardKind === 'truth' || social.cardKind === 'dare') social.canonicalStep='ANSWER';
    else if (social.cardKind === 'paranoia') social.canonicalStep='TARGET';
    else if (social.cardKind === 'duel') social.canonicalStep='DUEL_TIMER';
    events.push(makeEvent(next,'ANSWER_REQUIRED',{ actorId:social.actorId,targetPlayerId:affected,cardKind:social.cardKind,promptId:social.prompt.id },events.length));
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_ANSWER_MODE') {
    const social = next.social;
    const responder = social?.cardKind === 'dare' ? social.pendingTargetId : social?.actorId;
    if (!social || social.canonicalStep !== 'ANSWER' || responder !== command.playerId) return fail(state,command,'INVALID_SOCIAL_RESPONSE','This player is not the current responder.');
    social.answerState={ ...social.answerState,status:'MODE_SELECTED',mode:command.mode };
    events.push(makeEvent(next,'ANSWER_MODE_SELECTED',{ playerId:command.playerId,mode:command.mode },events.length));
    return commit(state,next,command,events);
  }

  if (command.type === 'REVIEW_ANSWER') {
    const social = next.social;
    const responder = social?.cardKind === 'dare' ? social.pendingTargetId : social?.actorId;
    if (!social || social.canonicalStep !== 'ANSWER' || responder !== command.playerId) return fail(state,command,'INVALID_SOCIAL_RESPONSE','This player is not the current responder.');
    social.answerState={ ...social.answerState,status:'REVIEW',value:command.value,choice:command.choice,completionOnly:command.completionOnly ?? false };
    return commit(state,next,command,events);
  }

  if (command.type === 'SUBMIT_ANSWER' || command.type === 'SUBMIT_CHOICE' || command.type === 'MARK_ANSWERED_LIVE') {
    const social = next.social;
    if (!social) return fail(state,command,'NO_PENDING_SOCIAL','No interaction is active.');
    if (social.cardKind === 'truth' || social.cardKind === 'dare') {
      const responder = social.cardKind === 'dare' ? social.pendingTargetId : social.actorId;
      if (social.canonicalStep !== 'ANSWER' || responder !== command.playerId) return fail(state,command,'INVALID_SOCIAL_RESPONSE','This player is not the current responder.');
      if (command.type === 'SUBMIT_CHOICE') social.answerState={ ...social.answerState,status:'SUBMITTED',choice:command.choice,submittedByPlayerId:command.playerId,submittedAtRevision:state.revision+1 };
      else if (command.type === 'MARK_ANSWERED_LIVE') social.answerState={ ...social.answerState,status:'SUBMITTED',mode:'ANSWERED_LIVE',completionOnly:true,submittedByPlayerId:command.playerId,submittedAtRevision:state.revision+1 };
      else social.answerState={ ...social.answerState,status:'SUBMITTED',submittedByPlayerId:command.playerId,submittedAtRevision:state.revision+1 };
      events.push(makeEvent(next,command.type === 'SUBMIT_CHOICE'?'ANSWER_CHOICE_SUBMITTED':command.type === 'MARK_ANSWERED_LIVE'?'ANSWERED_LIVE_MARKED':'ANSWER_SUBMITTED',{ playerId:command.playerId },events.length));
      finishInteraction(cstate,events,context);
      return commit(state,next,command,events);
    }
    if (social.cardKind === 'paranoia' && social.canonicalStep === 'PARANOIA_TARGET_ANSWER' && social.pendingTargetId === command.playerId && command.type === 'MARK_ANSWERED_LIVE') {
      social.paranoiaVote=createParanoiaVoteState('STRANGER',next.players.filter(p=>p.id!==command.playerId).map(p=>p.id));
      social.canonicalStep='PARANOIA_VOTE';
      events.push(makeEvent(next,'PARANOIA_VOTE_REQUIRED',{ targetPlayerId:command.playerId,eligibleVoterIds:social.paranoiaVote.eligibleVoterIds },events.length));
      return commit(state,next,command,events);
    }
  }

  if (command.type === 'PASS_PROMPT') {
    const social = next.social;
    if (!social) return fail(state,command,'NO_PENDING_SOCIAL','No interaction is active.');
    if (social.cardKind === 'truth' || social.cardKind === 'dare') {
      const affected = social.cardKind === 'dare' ? social.pendingTargetId : social.actorId;
      if (affected !== command.playerId) return fail(state,command,'PASS_NOT_ALLOWED','Only the affected player may Pass / Not for Me.');
      events.push(makeEvent(next,'SOCIAL_PASSED',{ playerId:command.playerId,cardKind:social.cardKind },events.length));
      penaltyThenFinish(cstate,command.playerId,2,events,context,'passed');
      return commit(state,next,command,events);
    }
    if (social.cardKind === 'paranoia' && social.actorId === command.playerId) { finishInteraction(cstate,events,context,'passed'); return commit(state,next,command,events); }
    if (social.cardKind === 'duel' && [social.actorId,social.pendingTargetId].includes(command.playerId)) { finishInteraction(cstate,events,context,'passed'); return commit(state,next,command,events); }
    return fail(state,command,'PASS_NOT_ALLOWED','Pass is not available for this interaction.');
  }

  if (command.type === 'PLAY_NOPE') {
    const social = next.social;
    if (!social || !['truth','dare'].includes(social.cardKind)) return fail(state,command,'INELIGIBLE_NOPE','Nope is defined only for Truth or Dare.');
    const affected = social.cardKind === 'dare' ? social.pendingTargetId : social.actorId;
    if (affected !== command.playerId) return fail(state,command,'INVALID_NOPE_REACTION','Only the affected Truth or Dare player may use Nope.');
    const p = player(next,command.playerId)!;
    const index = p.hand.findIndex(card => card.id===command.cardId && card.kind==='nope');
    if (index<0) return fail(state,command,'NO_NOPE_CARD','That player does not hold the selected Nope.');
    const [nope] = p.hand.splice(index,1); next.discardPile.push(nope);
    events.push(makeEvent(next,'NOPE_PLAYED',{ playerId:p.id,cardId:nope.id,blockedCardId:social.cardId,blockedCardKind:social.cardKind },events.length));
    finishInteraction(cstate,events,context,'blocked');
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_PARANOIA_TARGET') {
    const social=next.social;
    if (!social || social.cardKind!=='paranoia' || social.canonicalStep!=='TARGET' || social.actorId!==command.playerId || !social.pendingTargetIds.includes(command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose an eligible Paranoia target.');
    social.pendingTargetId=command.targetId; social.canonicalStep='PARANOIA_PHASE';
    events.push(makeEvent(next,'PARANOIA_TARGET_SELECTED',{ actorId:command.playerId,targetPlayerId:command.targetId },events.length,'PLAYER_PRIVATE',[command.playerId]));
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_PARANOIA_PHASE') {
    const social=next.social;
    if (!social || social.cardKind!=='paranoia' || social.canonicalStep!=='PARANOIA_PHASE' || social.actorId!==command.playerId) return fail(state,command,'INVALID_COMMAND','Paranoia phase is not selectable now.');
    social.paranoiaPhase=command.phase;
    social.canonicalStep=command.phase==='CLASSIC'?'PARANOIA_CLASSIC_ANSWER':'PARANOIA_TARGET_ANSWER';
    events.push(makeEvent(next,'PARANOIA_PHASE_SELECTED',{ actorId:command.playerId,phase:command.phase },events.length));
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_PARANOIA_CLASSIC_ANSWER') {
    const social=next.social;
    if (!social || social.cardKind!=='paranoia' || social.canonicalStep!=='PARANOIA_CLASSIC_ANSWER' || social.pendingTargetId!==command.playerId || command.targetId===command.playerId || !player(next,command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','The selected Paranoia answer player is not eligible.');
    social.classicAnswerPlayerId=command.targetId; social.canonicalStep='PARANOIA_CLASSIC_DECISION';
    events.push(makeEvent(next,'PARANOIA_CLASSIC_ANSWER_SELECTED',{ targetPlayerId:social.pendingTargetId,answerPlayerId:command.targetId },events.length,'PLAYER_PRIVATE',[social.pendingTargetId,command.targetId]));
    return commit(state,next,command,events);
  }

  if (command.type === 'SUBMIT_PARANOIA_CLASSIC_DECISION') {
    const social=next.social;
    if (!social || social.cardKind!=='paranoia' || social.canonicalStep!=='PARANOIA_CLASSIC_DECISION' || social.classicAnswerPlayerId!==command.playerId) return fail(state,command,'INVALID_SOCIAL_RESPONSE','Only the selected answer player may choose Reveal or Keep Secret.');
    social.classicRevealDecision=command.decision;
    events.push(makeEvent(next,'PARANOIA_CLASSIC_REVEAL_DECIDED',{ playerId:command.playerId,decision:command.decision },events.length));
    if (command.decision==='KEEP_SECRET') { penaltyThenFinish(cstate,command.playerId,1,events,context,'kept-secret'); }
    else finishInteraction(cstate,events,context,'revealed');
    return commit(state,next,command,events);
  }

  if (command.type === 'SUBMIT_PARANOIA_VOTE') {
    const social=next.social;
    if (!social || social.cardKind!=='paranoia' || social.canonicalStep!=='PARANOIA_VOTE' || !social.paranoiaVote?.eligibleVoterIds.includes(command.playerId) || social.paranoiaVote.votes[command.playerId]) return fail(state,command,'INVALID_SOCIAL_RESPONSE','This player is not an eligible Paranoia voter.');
    social.paranoiaVote.votes[command.playerId]=command.vote;
    events.push(makeEvent(next,'PARANOIA_VOTE_SUBMITTED',{ playerId:command.playerId,vote:command.vote },events.length));
    if (social.paranoiaVote.eligibleVoterIds.every(id=>Boolean(social.paranoiaVote?.votes[id]))) {
      social.paranoiaVote.resolutionApplied=true;
      events.push(makeEvent(next,'PARANOIA_VOTE_RESOLVED',{ votes:social.paranoiaVote.votes },events.length));
      finishInteraction(cstate,events,context);
    }
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_DUEL_TIMER') {
    const social=next.social;
    if (!social || social.cardKind!=='duel' || social.canonicalStep!=='DUEL_TIMER' || social.actorId!==command.playerId || ![15,30,45].includes(command.seconds)) return fail(state,command,'INVALID_COMMAND','The Duel challenger must choose 15, 30, or 45 seconds.');
    social.duelTimerSeconds=command.seconds; social.canonicalStep='DUEL_INITIATOR';
    setSocialTimer(next,command.playerId,context,command.seconds*1000);
    events.push(makeEvent(next,'DUEL_TIMER_SELECTED',{ actorId:command.playerId,seconds:command.seconds },events.length));
    return commit(state,next,command,events);
  }

  if (command.type === 'SUBMIT_DUEL_RESPONSE') {
    const social=next.social; const duel=social?.pendingDuel;
    if (!social || social.cardKind!=='duel' || !duel?.opponentId) return fail(state,command,'NO_PENDING_DUEL','No Duel is ready for a response.');
    const expected = command.side==='initiator'?duel.initiatorId:duel.opponentId;
    const step = command.side==='initiator'?'DUEL_INITIATOR':'DUEL_OPPONENT';
    if (social.canonicalStep!==step || command.playerId!==expected) return fail(state,command,'INVALID_SOCIAL_RESPONSE','It is not this Duel participant’s response window.');
    const response:SocialDuelResponseRecord={ playerId:command.playerId,submitted:true,mode:command.completionOnly?'ANSWERED_LIVE':null,value:command.value,choice:command.choice,completionOnly:command.completionOnly??false,submittedAtRevision:state.revision+1 };
    if (command.side==='initiator') { duel.initiatorResponse=response; social.canonicalStep='DUEL_OPPONENT'; }
    else {
      duel.opponentResponse=response; duel.resolutionReady=true;
      const eligible=next.players.filter(p=>![duel.initiatorId,duel.opponentId].includes(p.id)).map(p=>p.id);
      if (!eligible.length) { duel.winnerId=null; finishInteraction(cstate,events,context,'duel-no-voters'); }
      else { duel.vote={ eligibleVoterIds:eligible,votes:{},resolutionApplied:false }; social.canonicalStep='DUEL_VOTE'; events.push(makeEvent(next,'DUEL_GROUP_VOTE_REQUIRED',{ eligibleVoterIds:eligible },events.length)); }
    }
    events.push(makeEvent(next,'DUEL_RESPONSE_SUBMITTED',{ playerId:command.playerId,side:command.side },events.length));
    return commit(state,next,command,events);
  }

  if (command.type === 'DUEL_VOTE') {
    const social=next.social; const duel=social?.pendingDuel;
    if (!social || social.cardKind!=='duel' || social.canonicalStep!=='DUEL_VOTE' || !duel?.opponentId || !duel.vote?.eligibleVoterIds.includes(command.playerId) || duel.vote.votes[command.playerId] || ![duel.initiatorId,duel.opponentId].includes(command.winnerId)) return fail(state,command,'INVALID_SOCIAL_RESPONSE','This Duel vote is not eligible.');
    duel.vote.votes[command.playerId]=command.winnerId;
    events.push(makeEvent(next,'DUEL_VOTE_SUBMITTED',{ playerId:command.playerId,winnerId:command.winnerId },events.length));
    if (duel.vote.eligibleVoterIds.every(id=>Boolean(duel.vote?.votes[id]))) {
      const a=duel.vote.eligibleVoterIds.filter(id=>duel.vote?.votes[id]===duel.initiatorId).length;
      const b=duel.vote.eligibleVoterIds.length-a;
      duel.winnerId=a===b?null:(a>b?duel.initiatorId:duel.opponentId); duel.vote.resolutionApplied=true;
      events.push(makeEvent(next,'DUEL_VOTE_RESOLVED',{ winnerId:duel.winnerId,votes:duel.vote.votes },events.length));
      finishInteraction(cstate,events,context,duel.winnerId?'duel-winner':'duel-tie');
    }
    return commit(state,next,command,events);
  }

  if (command.type === 'RESOLVE_CHAOS') {
    const social=next.social;
    if (!social || social.cardKind!=='chaos' || social.canonicalStep!=='CHAOS_RESOLVE' || social.actorId!==command.playerId || !social.chaosEffectId) return fail(state,command,'INVALID_COMMAND','Chaos is not ready to resolve.');
    if (social.chaosEffectId==='REVERSE_ORDER') { next.direction=next.direction===1?-1:1; next.chaosReverseActive=true; events.push(makeEvent(next,'DIRECTION_CHANGED',{ direction:next.direction,reason:'CHAOS_REVERSE_ORDER' },events.length)); }
    else {
      const outgoing=new Map<string,Card[]>();
      next.players.forEach(p=>outgoing.set(p.id,shuffle(p.hand,createSeededRandom(`${next.id}:blind:${state.revision}:${p.id}`)).slice(0,Math.min(3,p.hand.length))));
      next.players.forEach(p=>{const ids=new Set((outgoing.get(p.id)??[]).map(c=>c.id));p.hand=p.hand.filter(c=>!ids.has(c.id));});
      next.players.forEach((p,index)=>next.players[(index+1)%next.players.length].hand.push(...(outgoing.get(p.id)??[])));
    }
    events.push(makeEvent(next,'CHAOS_EFFECT_RESOLVED',{ effectId:social.chaosEffectId },events.length)); finishInteraction(cstate,events,context);
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_TAG_TARGET') {
    const social=next.social;
    if (!social || social.cardKind!=='tag' || social.canonicalStep!=='TARGET' || social.actorId!==command.playerId || !social.pendingTargetIds.includes(command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose another player for TAG.');
    const actorIndex=next.players.findIndex(p=>p.id===social.actorId); const returnIndex=(actorIndex+next.direction+next.players.length)%next.players.length;
    const returnPlayerId=next.players[returnIndex].id; const source=player(next,social.actorId)!;
    next.bonusTurnStack=[...(next.bonusTurnStack??[]),{ kind:'TAG',playerId:command.targetId,returnPlayerId,pendingWinnerId:source.hand.length===0?source.id:null }];
    next.social=null; next.currentPlayerId=command.targetId; clearTimer(next); startTimer(next,'TURN',command.targetId,context.now);
    events.push(makeEvent(next,'TAG_TARGET_SELECTED',{ actorId:command.playerId,targetPlayerId:command.targetId,returnPlayerId },events.length));
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_HIJACK_TARGET') {
    const social=next.social;
    if (!social || social.cardKind!=='hijack' || social.canonicalStep!=='TARGET' || social.actorId!==command.playerId || !social.pendingTargetIds.includes(command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose another player for Hijack.');
    const ai=next.players.findIndex(p=>p.id===social.actorId),ti=next.players.findIndex(p=>p.id===command.targetId); const source=next.players[ai]; const target=next.players[ti];
    [next.players[ai],next.players[ti]]=[target,source]; next.players.forEach((p,i)=>p.seat=i);
    next.social=null;
    next.bonusTurnStack=[...(next.bonusTurnStack??[]),{ kind:'HIJACK',playerId:target.id,returnPlayerId:null,pendingWinnerId:source.hand.length===0?source.id:null }];
    queueDraws(next,target.id,1,events); cstate.forcedResume={kind:'SET_CURRENT',playerId:target.id};
    events.push(makeEvent(next,'HIJACK_TARGET_SELECTED',{ actorId:source.id,targetPlayerId:target.id },events.length));
    if (!triggerNextForced(cstate,context,events)) resumeAfterForced(cstate,events,context);
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_TABOO_TARGET') {
    const social=next.social;
    if (!social || social.cardKind!=='taboo' || social.canonicalStep!=='TARGET' || social.actorId!==command.playerId || !social.pendingTargetIds.includes(command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose another player for Taboo.');
    social.pendingTargetId=command.targetId; social.canonicalStep='TABOO_QUESTION';
    return commit(state,next,command,events);
  }
  if (command.type === 'SUBMIT_TABOO_QUESTION') {
    const social=next.social; const text=normalizeText(command.text);
    if (!social || social.cardKind!=='taboo' || social.canonicalStep!=='TABOO_QUESTION' || social.actorId!==command.playerId || !text) return fail(state,command,'INVALID_SOCIAL_PROMPT','The Taboo holder must submit a question.');
    social.question=text; social.canonicalStep='TABOO_ANSWER'; return commit(state,next,command,events);
  }
  if (command.type === 'SUBMIT_TABOO_ANSWER') {
    const social=next.social;
    if (!social || social.cardKind!=='taboo' || social.canonicalStep!=='TABOO_ANSWER' || social.pendingTargetId!==command.playerId) return fail(state,command,'INVALID_SOCIAL_RESPONSE','Only the Taboo target may answer.');
    if (command.answer==='YES') finishInteraction(cstate,events,context,'taboo-yes'); else penaltyThenFinish(cstate,command.playerId,2,events,context,'taboo-penalty');
    events.push(makeEvent(next,'TABOO_RESOLVED',{ targetPlayerId:command.playerId,answer:command.answer },events.length)); return commit(state,next,command,events);
  }

  if (command.type === 'SUBMIT_GROUP_QUESTION') {
    const social=next.social; const text=normalizeText(command.text,5,280); const options=[...new Set(command.options.map(v=>String(v).trim()).filter(Boolean))];
    if (!social || social.cardKind!=='truth_or_chaos' || social.canonicalStep!=='GROUP_QUESTION' || social.actorId!==command.playerId || !text || options.length<2 || options.length>4) return fail(state,command,'INVALID_SOCIAL_PROMPT','Provide one group question and 2–4 answer choices.');
    social.question=text; social.groupOptions=options; social.groupAnswers={}; social.canonicalStep='GROUP_ANSWER'; return commit(state,next,command,events);
  }
  if (command.type === 'SUBMIT_GROUP_ANSWER') {
    const social=next.social;
    if (!social || social.cardKind!=='truth_or_chaos' || social.canonicalStep!=='GROUP_ANSWER' || !social.pendingTargetIds.includes(command.playerId) || social.groupAnswers?.[command.playerId] || !social.groupOptions?.includes(command.choice)) return fail(state,command,'INVALID_SOCIAL_RESPONSE','This group answer is not valid.');
    social.groupAnswers={...(social.groupAnswers??{}),[command.playerId]:command.choice};
    if (social.pendingTargetIds.every(id=>Boolean(social.groupAnswers?.[id]))) {
      const values=social.pendingTargetIds.map(id=>social.groupAnswers![id]);
      if (values.every(value=>value===values[0])) { events.push(makeEvent(next,'TRUTH_OR_CHAOS_RESOLVED',{ consensus:true,choice:values[0] },events.length)); finishInteraction(cstate,events,context,'consensus'); }
      else social.canonicalStep='GROUP_DARE';
    }
    return commit(state,next,command,events);
  }
  if (command.type === 'SUBMIT_GROUP_DARE') {
    const social=next.social; const text=normalizeText(command.text,5,280);
    if (!social || social.cardKind!=='truth_or_chaos' || social.canonicalStep!=='GROUP_DARE' || social.actorId!==command.playerId || !text) return fail(state,command,'INVALID_SOCIAL_PROMPT','The card holder must set the whole-group Dare.');
    social.groupDare=text; social.groupCompletions={}; social.canonicalStep='GROUP_COMPLETE'; return commit(state,next,command,events);
  }
  if (command.type === 'COMPLETE_GROUP_DARE') {
    const social=next.social;
    if (!social || social.cardKind!=='truth_or_chaos' || social.canonicalStep!=='GROUP_COMPLETE' || !social.pendingTargetIds.includes(command.playerId)) return fail(state,command,'INVALID_SOCIAL_RESPONSE','This player is not part of the whole-group Dare.');
    social.groupCompletions={...(social.groupCompletions??{}),[command.playerId]:command.completion};
    if (social.pendingTargetIds.every(id=>Boolean(social.groupCompletions?.[id]))) { events.push(makeEvent(next,'TRUTH_OR_CHAOS_RESOLVED',{ consensus:false,completions:social.groupCompletions },events.length)); finishInteraction(cstate,events,context,'group-dare'); }
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_MACHIAVELLI_EFFECT') {
    const social=next.social;
    if (!social || social.cardKind!=='machiavelli' || social.canonicalStep!=='MACHIAVELLI_CHOICE' || social.actorId!==command.playerId) return fail(state,command,'INVALID_COMMAND','Machiavelli choice is not active.');
    const zones=()=>[...next.players.flatMap(p=>p.hand),...next.drawPile,...next.discardPile]; const effect:MachiavelliEffectId=command.effect;
    if (effect==='CONVERT_WEAK') zones().forEach(card=>{if(card.kind==='skip'){card.kind='draw';card.symbol='draw';}});
    else if (effect==='TABOO_ALL') next.players.forEach((p,i)=>p.hand.push(generatedCard(next,'taboo',`${i}`)));
    else if (effect==='NO_MERCY') {next.players.forEach(p=>p.hand=p.hand.filter(c=>c.kind!=='nope'));next.drawPile=next.drawPile.filter(c=>c.kind!=='nope');next.discardPile=next.discardPile.filter(c=>c.kind!=='nope');}
    else if (effect==='PARANOIA_SPREADS') next.players.forEach((p,i)=>p.hand.push(generatedCard(next,(i%2===0?'dig_me':'paranoia'),`${i}`)));
    else if (effect==='DOUBLE_PRESSURE') {const originals=next.drawPile.filter(c=>c.kind==='truth'||c.kind==='dare');next.drawPile.push(...originals.map((c,i)=>generatedCard(next,c.kind,`pressure:${i}`)));next.drawPile=shuffle(next.drawPile,createSeededRandom(`${next.id}:pressure:${state.revision}`));}
    else if (effect==='REVERSE_CONFESSION_ALL') next.players.forEach((p,i)=>p.hand.push(generatedCard(next,'reverse_confession',`${i}`)));
    social.machiavelliEffectId=effect; events.push(makeEvent(next,'MACHIAVELLI_APPLIED',{ effect },events.length)); finishInteraction(cstate,events,context,effect);
    return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_REVERSE_CONFESSION_TARGET') {
    const social=next.social;
    if (!social || social.cardKind!=='reverse_confession' || social.canonicalStep!=='TARGET' || social.actorId!==command.playerId || !social.pendingTargetIds.includes(command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose another player to answer Reverse Confession.');
    social.pendingTargetId=command.targetId; social.canonicalStep='REVERSE_QUESTION'; return commit(state,next,command,events);
  }
  if (command.type === 'SUBMIT_REVERSE_CONFESSION_QUESTION') {
    const social=next.social; const text=normalizeText(command.text);
    if (!social || social.cardKind!=='reverse_confession' || social.canonicalStep!=='REVERSE_QUESTION' || social.actorId!==command.playerId || !text) return fail(state,command,'INVALID_SOCIAL_PROMPT','The card holder must ask the selected player a question.');
    social.question=text; social.canonicalStep='REVERSE_ANSWER'; return commit(state,next,command,events);
  }
  if (command.type === 'SUBMIT_REVERSE_CONFESSION_ANSWER') {
    const social=next.social; const value=String(command.value??'').trim();
    if (!social || social.cardKind!=='reverse_confession' || social.canonicalStep!=='REVERSE_ANSWER' || social.pendingTargetId!==command.playerId || (!command.answeredLive && !value)) return fail(state,command,'INVALID_SOCIAL_RESPONSE','The chosen player must answer or confirm Answered Live.');
    events.push(makeEvent(next,'REVERSE_CONFESSION_RESOLVED',{ actorId:social.actorId,targetPlayerId:command.playerId,answeredLive:command.answeredLive??false },events.length)); finishInteraction(cstate,events,context); return commit(state,next,command,events);
  }

  if (command.type === 'SELECT_DIG_ME_TARGET') {
    const social=next.social;
    if (!social || social.cardKind!=='dig_me' || social.canonicalStep!=='TARGET' || social.actorId!==command.playerId || !social.pendingTargetIds.includes(command.targetId)) return fail(state,command,'INVALID_SOCIAL_TARGET','Choose another player for DIG ME.');
    social.pendingTargetId=command.targetId; social.canonicalStep='DIG_QUESTION'; return commit(state,next,command,events);
  }
  if (command.type === 'SUBMIT_DIG_ME_QUESTION') {
    const social=next.social; const text=String(command.text??'').trim();
    if (!social || social.cardKind!=='dig_me' || social.canonicalStep!=='DIG_QUESTION' || social.actorId!==command.playerId || (!command.askedLive && text.length<3)) return fail(state,command,'INVALID_SOCIAL_PROMPT','The DIG ME holder must personally ask the selected player a question about themselves.');
    social.question=command.askedLive?null:text; social.questionAskedLive=command.askedLive??false; social.canonicalStep='DIG_ANSWER'; return commit(state,next,command,events);
  }
  if (command.type === 'COMPLETE_DIG_ME') {
    const social=next.social;
    if (!social || social.cardKind!=='dig_me' || social.canonicalStep!=='DIG_ANSWER' || social.pendingTargetId!==command.playerId) return fail(state,command,'INVALID_SOCIAL_RESPONSE','Only the selected DIG ME target may complete the answer.');
    events.push(makeEvent(next,'DIG_ME_RESOLVED',{ actorId:social.actorId,targetPlayerId:command.playerId },events.length)); finishInteraction(cstate,events,context); return commit(state,next,command,events);
  }

  if (command.type === 'ACTIVATE_GHOST') {
    if (next.currentPlayerId!==command.playerId || next.social) return fail(state,command,'NOT_YOUR_TURN','Ghost may only be activated on its owner’s normal turn.');
    const p=player(next,command.playerId)!;
    if (!p.ghostArmedCard || (p.ghostTurnsRemaining??0)>0) return fail(state,command,'INVALID_COMMAND','No armed Ghost is available to activate.');
    next.discardPile.push(p.ghostArmedCard); const cardId=p.ghostArmedCard.id; p.ghostArmedCard=null; p.ghostTurnsRemaining=2;
    events.push(makeEvent(next,'GHOST_ACTIVATED',{ playerId:p.id,cardId,turns:2 },events.length)); return commit(state,next,command,events);
  }
  if (command.type === 'END_GHOST_TURN') {
    if (next.currentPlayerId!==command.playerId || next.social) return fail(state,command,'NOT_YOUR_TURN','Only the active Ghost player may end this turn.');
    const p=player(next,command.playerId)!;
    if ((p.ghostTurnsRemaining??0)<=0) return fail(state,command,'INVALID_COMMAND','This player is not currently a Ghost.');
    if (p.hand.some(card=>validatePlay(next,p.id,card.id).ok)) return fail(state,command,'ILLEGAL_PLAY','A legal card is available; the Ghost turn cannot end yet.');
    p.ghostTurnsRemaining=Math.max(0,(p.ghostTurnsRemaining??0)-1);
    events.push(makeEvent(next,'GHOST_TURN_ENDED',{ playerId:p.id,turnsRemaining:p.ghostTurnsRemaining },events.length));
    if (finishBonusFrame(cstate,p.id,events,context)) return commit(state,next,command,events);
    normalAdvance(next,p.id,events,context,1); return commit(state,next,command,events);
  }

  if (command.type === 'COMPLETE_FLOW') {
    const social=next.social;
    if (!social?.resolutionComplete && social?.canonicalStep!=='RESOLVED') return fail(state,command,'INVALID_COMMAND','The active interaction is not ready to continue.');
    finishInteraction(cstate,events,context); return commit(state,next,command,events);
  }

  if (command.type === 'TIMEOUT_SOCIAL') {
    const social=next.social;
    if (!social?.canonicalStep) return fail(state,command,'NO_PENDING_SOCIAL','No canonical interaction is active.');
    if (!next.timer || next.timer.startedAtRevision!==command.timerStartedAtRevision) return fail(state,command,'STALE_TIMEOUT','The social timer has changed.');
    const now=context.now??Date.now(); if (now<next.timer.deadlineAt) return fail(state,command,'TIMEOUT_NOT_REACHED','The social timer has not expired.');
    events.push(makeEvent(next,'SOCIAL_TIMED_OUT',{ actorId:social.actorId,cardKind:social.cardKind },events.length)); finishInteraction(cstate,events,context,'timeout'); return commit(state,next,command,events);
  }

  return fail(state,command,'COMMAND_NOT_IMPLEMENTED',`Canonical command ${command.type} is not implemented.`);
}

/** Apply the TAG/HIJACK continuation boundary after the stable reducer finishes a basic action. */
export function reconcileBonusTurnAfterBase<T extends GameState>(before:T, command:GameCommand, result:GameTransition<T>, context:GameCommandContext={}): GameTransition<T> {
  if (!result.ok || !['PLAY_CARD','DRAW_CARD','SELECT_WILD_COLOR'].includes(command.type)) return result;
  const next=ext(result.state); const frame=next.bonusTurnStack?.at(-1);
  if (!frame || frame.playerId!==command.playerId) return result;
  // If a base command opened a Wild selection or another unresolved boundary,
  // the bonus frame remains until that action is genuinely complete.
  if (next.pendingEffect || (next.social && !next.social.resolutionComplete)) return result;
  const events=[...result.events];
  finishBonusFrame(next,command.playerId,events,context);
  events.forEach(event=>{event.revision=next.revision;});
  return { ...result,state:next as T,events };
}

import type {
  AnswerMode,
  GameEvent,
  GameState,
  Player,
  PromptEligibilityRequest,
  ParanoiaPhase,
  ParanoiaVoteChoice,
  RevealState,
  RoulettePresentation,
  RoulettePresentationType,
  RoulettePresentationView,
  SocialAnswerRecord,
  SocialAuthorshipState,
  SocialAuthorshipView,
  SocialCardKind,
  SocialDuelRecord,
  SocialDuelResponseRecord,
  SocialPrompt,
  SocialReactionRecord,
  SocialState,
  SocialTargeting
} from '@cribbit/contracts';
import { getEligiblePrompts, isPromptEligible } from '@cribbit/prompts';
import { createEngineError } from './errors.ts';
import { makeEvent } from './events.ts';
import { advanceTurn, getPlayerIndex } from './turn.ts';
import { clearTimer, startTimer } from './timer.ts';

export interface GameCommandContext {
  now?: number;
  promptPool?: readonly SocialPrompt[];
  selectedPrompt?: SocialPrompt;
  authorshipByPromptId?: Readonly<Record<string, string>>;
  promptProfile?: Partial<Pick<PromptEligibilityRequest, 'stage' | 'intensity' | 'language' | 'callSuitability' | 'excludePromptIds' | 'excludeRepeatGroups' | 'excludeAntiRepeatKeys'>>;
}

export interface SocialParanoiaVoteState {
  phase: ParanoiaPhase;
  eligibleVoterIds: readonly string[];
  votes: Record<string, ParanoiaVoteChoice>;
  resolutionApplied: boolean;
}

export interface SocialPromptSelection {
  prompt: SocialPrompt;
  selection: PromptEligibilityRequest;
  candidateResultIds: readonly string[];
}

function normalizeSelectedPrompt(prompt: SocialPrompt): SocialPrompt {
  if (prompt.kind !== 'duel' || prompt.duelJudgingMode) return prompt;
  return {
    ...prompt,
    duelJudgingMode: 'GROUP_VOTE'
  };
}

function wildcardString(value?: string): string {
  return value ?? '*';
}

function createSelectionRequest(
  state: GameState,
  kind: SocialCardKind,
  targeting: SocialTargeting,
  context: GameCommandContext
): PromptEligibilityRequest {
  const profile = context.promptProfile ?? {};
  return {
    kind,
    world: state.config.contentWorld,
    stage: profile.stage ?? Number.MAX_SAFE_INTEGER,
    groupSize: state.players.length,
    intensity: profile.intensity ?? Number.MAX_SAFE_INTEGER,
    language: wildcardString(profile.language),
    callSuitability: wildcardString(profile.callSuitability),
    targeting,
    excludePromptIds: profile.excludePromptIds ?? [],
    excludeRepeatGroups: profile.excludeRepeatGroups ?? [],
    excludeAntiRepeatKeys: profile.excludeAntiRepeatKeys ?? []
  };
}

export function selectPromptForSocialEffect(
  state: GameState,
  kind: SocialCardKind,
  targeting: SocialTargeting,
  context: GameCommandContext
): SocialPromptSelection | ReturnType<typeof createEngineError> {
  const selection = createSelectionRequest(state, kind, targeting, context);

  if (context.selectedPrompt) {
    const prompt = context.selectedPrompt;
    if (!isPromptEligible(prompt, selection)) {
      return createEngineError('PROMPT_NOT_ELIGIBLE', 'The supplied prompt does not satisfy the current social eligibility boundary.', {
        promptId: prompt.id,
        kind,
        targeting,
        contentWorld: state.config.contentWorld
      });
    }
    if (!context.promptPool?.length) {
      return { prompt: normalizeSelectedPrompt(prompt), selection, candidateResultIds: [prompt.id] };
    }
    const eligiblePrompts = getEligiblePrompts(context.promptPool, selection);
    if (!eligiblePrompts.some(candidate => candidate.id === prompt.id)) {
      return createEngineError('PROMPT_NOT_ELIGIBLE', 'The selected prompt must belong to the supplied eligible prompt pool.', {
        promptId: prompt.id,
        kind,
        targeting,
        contentWorld: state.config.contentWorld
      });
    }
    return { prompt: normalizeSelectedPrompt(prompt), selection, candidateResultIds: eligiblePrompts.map(item => item.id) };
  }

  if (!context.promptPool?.length) {
    return createEngineError('NO_ELIGIBLE_PROMPT', 'A deterministic prompt pool was not supplied for this social effect.', {
      kind,
      targeting,
      contentWorld: state.config.contentWorld
    });
  }

  const eligiblePrompts = getEligiblePrompts(context.promptPool, selection);
  const prompt = eligiblePrompts[0];
  if (!prompt) {
    return createEngineError('NO_ELIGIBLE_PROMPT', 'No supplied prompt is eligible for the current social effect.', {
      kind,
      targeting,
      contentWorld: state.config.contentWorld,
      poolSize: context.promptPool.length
    });
  }
  return { prompt: normalizeSelectedPrompt(prompt), selection, candidateResultIds: eligiblePrompts.map(item => item.id) };
}

export function createRoulettePresentation(
  state: GameState,
  type: RoulettePresentationType,
  selectedResultId: string,
  candidateResultIds: readonly string[],
  revealState: RevealState = 'REVEALED'
): RoulettePresentation {
  const candidates = [...candidateResultIds];
  return {
    id: `${state.id}:roulette:${state.revision}:${type}`,
    type,
    selectedResultId,
    candidateResultIds: candidates,
    revealState,
    presentationSeed: `${state.id}|${state.revision}|${type}`
  };
}

export function projectRoulettePresentation(presentation: RoulettePresentation): RoulettePresentationView {
  if (presentation.revealState === 'REVEALED') return { ...presentation };
  const { selectedResultId: _selectedResultId, candidateResultIds: _candidateResultIds, ...sealed } = presentation;
  return sealed;
}

export function projectAuthorship(authorship: SocialAuthorshipState): SocialAuthorshipView {
  if (authorship.revealState === 'REVEALED' && authorship.revealedAuthorPlayerId) {
    return {
      mode: authorship.mode,
      revealState: authorship.revealState,
      authorPlayerId: authorship.revealedAuthorPlayerId
    };
  }
  return { mode: authorship.mode, revealState: authorship.revealState };
}

export function createAuthorshipState(prompt: SocialPrompt | null, context: GameCommandContext): SocialAuthorshipState | null {
  if (!prompt) return null;
  const authorPlayerId = context.authorshipByPromptId?.[prompt.id] ?? null;
  const revealState: RevealState = prompt.authorshipMode === 'SIGNED' ? 'REVEALED' : 'SEALED';
  return {
    mode: prompt.authorshipMode,
    authorPlayerId,
    revealState,
    revealedAuthorPlayerId: revealState === 'REVEALED' ? authorPlayerId : null
  };
}

export function createAnswerRecord(): SocialAnswerRecord {
  return {
    status: 'WAITING',
    mode: null,
    completionOnly: false,
    submittedByPlayerId: null,
    submittedAtRevision: null
  };
}

export function createParanoiaVoteState(phase: ParanoiaPhase, eligibleVoterIds: readonly string[]): SocialParanoiaVoteState {
  return {
    phase,
    eligibleVoterIds: [...eligibleVoterIds],
    votes: {},
    resolutionApplied: false
  };
}

export function createDuelRecord(initiatorId: string): SocialDuelRecord {
  return {
    initiatorId,
    opponentId: null,
    prompt: null,
    initiatorResponse: null,
    opponentResponse: null,
    resolutionReady: false,
    winnerId: null,
    vote: null
  };
}

export function createReactionRecord(effectKind: SocialCardKind, effectCardId: string, actorId: string, targetPlayerId: string): SocialReactionRecord {
  return {
    effectKind,
    effectCardId,
    actorId,
    targetPlayerId,
    eligiblePlayerIds: [targetPlayerId],
    eligible: true,
    blocked: false,
    blockedByPlayerId: null,
    blockedByCardId: null
  };
}

export function createSocialState(
  state: GameState,
  cardId: string,
  cardKind: SocialCardKind,
  actorId: string,
  prompt: SocialPrompt | null,
  selection: PromptEligibilityRequest | null,
  presentation?: Pick<RoulettePresentation, 'type' | 'candidateResultIds'>,
  context: GameCommandContext = {}
): SocialState {
  const pendingCompletionPlayerIds = selection?.targeting === 'all'
    ? state.players.map(player => player.id)
    : [actorId];
  return {
    cardId,
    cardKind,
    actorId,
    prompt,
    promptSelection: prompt && selection
      ? {
          promptId: prompt.id,
          prompt,
          selection,
          selectedByPlayerId: actorId,
          selectedAtRevision: state.revision
        }
      : null,
    roulettePresentation: prompt && presentation
      ? createRoulettePresentation(state, presentation.type, prompt.id, presentation.candidateResultIds)
      : null,
    authorship: createAuthorshipState(prompt, context),
    pendingTargetId: null,
    pendingTargetIds: [],
    pendingCompletionPlayerIds,
    completedCompletionPlayerIds: [],
    completionRecords: {},
    pendingReaction: null,
  pendingDuel: null,
  paranoiaPhase: null,
  paranoiaVote: null,
  classicAnswerPlayerId: null,
  classicRevealDecision: null,
  answerState: createAnswerRecord(),
    resolutionComplete: false,
    mayAdvanceTurn: false,
    blockedByNope: false
  };
}

export function getPlayerOrError(state: GameState, playerId: string): Player | ReturnType<typeof createEngineError> {
  const playerIndex = getPlayerIndex(state, playerId);
  const player = playerIndex >= 0 ? state.players[playerIndex] : null;
  if (!player) {
    return createEngineError('INVALID_COMMAND', 'The player does not exist in the current session.');
  }
  return player;
}

export function createTurnResolution(
  state: GameState,
  actor: Player,
  events: GameEvent[],
  socialKind: SocialCardKind,
  steps = 1,
  outcome: 'resolved' | 'blocked' = 'resolved',
  now?: number
): void {
  const hadEmptyHand = actor.hand.length === 0;
  const previousPlayerId = actor.id;
  state.social = null;
  clearTimer(state);
  if (hadEmptyHand) {
    state.status = 'FINISHED';
    state.phase = 'FINISHED';
    state.winnerId = actor.id;
    events.push(makeEvent(state, 'SOCIAL_EFFECT_RESOLVED', { actorId: actor.id, cardKind: socialKind, outcome: outcome === 'blocked' ? 'blocked-winner' : 'winner' }, 0, 'PUBLIC'));
    events.push(makeEvent(state, 'GAME_WON', { winnerId: actor.id }));
    return;
  }
  const { nextPlayerId } = advanceTurn(state, steps);
  startTimer(state, 'TURN', nextPlayerId, now);
  events.push(makeEvent(state, 'SOCIAL_EFFECT_RESOLVED', { actorId: actor.id, cardKind: socialKind, outcome }, 0, 'PUBLIC'));
  events.push(makeEvent(state, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps, direction: state.direction }));
}

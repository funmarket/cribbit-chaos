import type {
  AnswerMode,
  GameEvent,
  GameState,
  Player,
  PromptEligibilityRequest,
  SocialAnswerRecord,
  SocialCardKind,
  SocialDuelRecord,
  SocialDuelResponseRecord,
  SocialPrompt,
  SocialReactionRecord,
  SocialState,
  SocialTargeting
} from '@cribbit/contracts';
import { isPromptEligible, selectEligiblePrompt } from '@cribbit/prompts';
import { createEngineError } from './errors.ts';
import { makeEvent } from './events.ts';
import { advanceTurn, getPlayerIndex } from './turn.ts';

export interface GameCommandContext {
  promptPool?: readonly SocialPrompt[];
  selectedPrompt?: SocialPrompt;
  promptProfile?: Partial<Pick<PromptEligibilityRequest, 'stage' | 'intensity' | 'language' | 'callSuitability' | 'excludePromptIds' | 'excludeRepeatGroups' | 'excludeAntiRepeatKeys'>>;
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
): { prompt: SocialPrompt; selection: PromptEligibilityRequest } | ReturnType<typeof createEngineError> {
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
    return { prompt, selection };
  }

  if (!context.promptPool?.length) {
    return createEngineError('NO_ELIGIBLE_PROMPT', 'A deterministic prompt pool was not supplied for this social effect.', {
      kind,
      targeting,
      contentWorld: state.config.contentWorld
    });
  }

  const prompt = selectEligiblePrompt(context.promptPool, selection);
  if (!prompt) {
    return createEngineError('NO_ELIGIBLE_PROMPT', 'No supplied prompt is eligible for the current social effect.', {
      kind,
      targeting,
      contentWorld: state.config.contentWorld,
      poolSize: context.promptPool.length
    });
  }
  return { prompt, selection };
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

export function createDuelRecord(initiatorId: string): SocialDuelRecord {
  return {
    initiatorId,
    opponentId: null,
    prompt: null,
    initiatorResponse: null,
    opponentResponse: null,
    resolutionReady: false,
    winnerId: null
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
  selection: PromptEligibilityRequest | null
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
    pendingTargetId: null,
    pendingTargetIds: [],
    pendingCompletionPlayerIds,
    completedCompletionPlayerIds: [],
    completionRecords: {},
    pendingReaction: null,
    pendingDuel: null,
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
  outcome: 'resolved' | 'blocked' = 'resolved'
): void {
  const hadEmptyHand = actor.hand.length === 0;
  const previousPlayerId = actor.id;
  state.social = null;
  if (hadEmptyHand) {
    state.status = 'FINISHED';
    state.phase = 'FINISHED';
    state.winnerId = actor.id;
    events.push(makeEvent(state, 'SOCIAL_EFFECT_RESOLVED', { actorId: actor.id, cardKind: socialKind, outcome: outcome === 'blocked' ? 'blocked-winner' : 'winner' }, 0, 'PUBLIC'));
    events.push(makeEvent(state, 'GAME_WON', { winnerId: actor.id }));
    return;
  }
  const { nextPlayerId } = advanceTurn(state, steps);
  events.push(makeEvent(state, 'SOCIAL_EFFECT_RESOLVED', { actorId: actor.id, cardKind: socialKind, outcome }, 0, 'PUBLIC'));
  events.push(makeEvent(state, 'TURN_ADVANCED', { previousPlayerId, nextPlayerId, steps, direction: state.direction }));
}

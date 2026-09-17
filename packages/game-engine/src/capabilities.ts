import type { CardColor, GameCommand, GameState, LegalCommandOption, PlayerDecisionCapabilities, RequiredActionKind } from '@cribbit/contracts';
import { isLegalPlay, validateDraw } from './validation.ts';

const COLORS: readonly CardColor[] = ['lime', 'orange', 'cyan', 'purple'];

function commandBase(state: GameState, playerId: string, suffix: string): Pick<GameCommand, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'> {
  return {
    commandId: `bot:${state.id}:${state.revision}:${playerId}:${suffix}`,
    playerId,
    expectedRevision: state.revision,
    sessionId: state.id
  };
}

function option(option: LegalCommandOption): LegalCommandOption {
  return option;
}

function targetOptions(state: GameState, playerId: string, type: 'SELECT_DUEL_TARGET' | 'SELECT_PARANOIA_TARGET', targetIds: readonly string[]): LegalCommandOption[] {
  return targetIds
    .filter(targetId => targetId !== playerId)
    .map(targetId => option({
      optionId: `target:${targetId}`,
      command: {
        ...commandBase(state, playerId, `${type}:${targetId}`),
        type,
        targetId
      } as GameCommand,
      presentation: {
        category: 'TARGET',
        targetPlayerId: targetId
      }
    }));
}

function answeredLiveModeOption(state: GameState, playerId: string): LegalCommandOption {
  return option({
    optionId: 'answer-mode:ANSWERED_LIVE',
    command: {
      ...commandBase(state, playerId, 'SELECT_ANSWER_MODE:ANSWERED_LIVE'),
      type: 'SELECT_ANSWER_MODE',
      mode: 'ANSWERED_LIVE'
    },
    presentation: {
      category: 'ANSWER_MODE',
      answerMode: 'ANSWERED_LIVE'
    }
  });
}

function markAnsweredLiveOption(state: GameState, playerId: string): LegalCommandOption {
  return option({
    optionId: 'completion:ANSWERED_LIVE',
    command: {
      ...commandBase(state, playerId, 'MARK_ANSWERED_LIVE'),
      type: 'MARK_ANSWERED_LIVE'
    },
    presentation: {
      category: 'COMPLETION',
      answerMode: 'ANSWERED_LIVE'
    }
  });
}

function duelCompletionOption(state: GameState, playerId: string, side: 'initiator' | 'opponent'): LegalCommandOption {
  return option({
    optionId: `duel-response:${side}`,
    command: {
      ...commandBase(state, playerId, `SUBMIT_DUEL_RESPONSE:${side}`),
      type: 'SUBMIT_DUEL_RESPONSE',
      side,
      completionOnly: true
    },
    presentation: {
      category: 'COMPLETION'
    }
  });
}

function voteOptions(state: GameState, playerId: string, candidates: readonly string[]): LegalCommandOption[] {
  return candidates
    .filter(candidate => candidate !== playerId)
    .map(candidate => option({
      optionId: `vote:${candidate}`,
      command: {
        ...commandBase(state, playerId, `DUEL_VOTE:${candidate}`),
        type: 'DUEL_VOTE',
        winnerId: candidate
      } as GameCommand,
      presentation: {
        category: 'VOTE',
        voteForPlayerId: candidate
      }
    }));
}

function socialCapabilities(state: GameState, playerId: string): PlayerDecisionCapabilities {
  const social = state.social;
  if (!social || social.resolutionComplete) return { requiredAction: null, options: [] };

  if (social.cardKind === 'duel') {
    const duel = social.pendingDuel;
    if (!duel?.opponentId && social.actorId === playerId && social.pendingTargetIds.length) {
      return { requiredAction: 'SELECT_TARGET', options: targetOptions(state, playerId, 'SELECT_DUEL_TARGET', social.pendingTargetIds) };
    }
    if (duel?.initiatorId === playerId && !duel.initiatorResponse?.submitted) {
      return { requiredAction: 'SUBMIT_COMPLETION', options: [duelCompletionOption(state, playerId, 'initiator')] };
    }
    if (duel?.opponentId === playerId && !duel.opponentResponse?.submitted) {
      return { requiredAction: 'SUBMIT_COMPLETION', options: [duelCompletionOption(state, playerId, 'opponent')] };
    }
    if (duel?.vote && duel.vote.eligibleVoterIds.includes(playerId) && !duel.vote.votes[playerId]) {
      return { requiredAction: 'CAST_VOTE', options: voteOptions(state, playerId, [duel.initiatorId, duel.opponentId].filter(Boolean) as string[]) };
    }
    return { requiredAction: null, options: [] };
  }

  if (social.cardKind === 'paranoia') {
    if (!social.pendingTargetId && social.actorId === playerId && social.pendingTargetIds.length) {
      return { requiredAction: 'SELECT_TARGET', options: targetOptions(state, playerId, 'SELECT_PARANOIA_TARGET', social.pendingTargetIds) };
    }
    if (social.paranoiaVote && social.paranoiaVote.eligibleVoterIds.includes(playerId) && !social.paranoiaVote.votes[playerId]) {
      return {
        requiredAction: 'CAST_VOTE',
        options: ['BELIEVE', 'LYING', 'HOLDING_BACK'].map(vote => option({
          optionId: `paranoia-vote:${vote}`,
          command: {
            ...commandBase(state, playerId, `SUBMIT_PARANOIA_VOTE:${vote}`),
            type: 'SUBMIT_PARANOIA_VOTE',
            vote
          } as GameCommand,
          presentation: { category: 'VOTE' }
        }))
      };
    }
  }

  const isAllPlayerCompletion = social.pendingCompletionPlayerIds.length > 0;
  if (isAllPlayerCompletion) {
    if (!social.pendingCompletionPlayerIds.includes(playerId) || social.completedCompletionPlayerIds.includes(playerId)) {
      return { requiredAction: null, options: [] };
    }
    const record = social.completionRecords[playerId] ?? social.answerState;
    if (!record?.mode) return { requiredAction: 'SELECT_ANSWER_MODE', options: [answeredLiveModeOption(state, playerId)] };
    if (record.mode === 'ANSWERED_LIVE' && record.status !== 'SUBMITTED') return { requiredAction: 'SUBMIT_COMPLETION', options: [markAnsweredLiveOption(state, playerId)] };
    return { requiredAction: null, options: [] };
  }

  if (social.actorId !== playerId) return { requiredAction: null, options: [] };
  if (!social.answerState.mode) return { requiredAction: 'SELECT_ANSWER_MODE', options: [answeredLiveModeOption(state, playerId)] };
  if (social.answerState.mode === 'ANSWERED_LIVE' && social.answerState.status !== 'SUBMITTED') {
    return { requiredAction: 'SUBMIT_COMPLETION', options: [markAnsweredLiveOption(state, playerId)] };
  }

  return { requiredAction: null, options: [] };
}

export function projectDecisionCapabilities(state: GameState, playerId: string): PlayerDecisionCapabilities {
  if (state.status === 'FINISHED') return { requiredAction: null, options: [] };

  if (state.pendingEffect?.type === 'WILD_COLOR') {
    if (state.pendingEffect.playerId !== playerId || state.currentPlayerId !== playerId) return { requiredAction: null, options: [] };
    return {
      requiredAction: 'CHOOSE_COLOR',
      options: COLORS.map(color => option({
        optionId: `color:${color}`,
        command: {
          ...commandBase(state, playerId, `SELECT_WILD_COLOR:${color}`),
          type: 'SELECT_WILD_COLOR',
          color
        },
        presentation: {
          category: 'COLOR',
          color
        }
      }))
    };
  }

  if (state.social && !state.social.resolutionComplete) return socialCapabilities(state, playerId);

  if (state.currentPlayerId !== playerId) return { requiredAction: null, options: [] };

  const playOptions = state.players
    .find(player => player.id === playerId)?.hand
    .filter(card => isLegalPlay(state, playerId, card.id))
    .map(card => option({
      optionId: `play:${card.id}`,
      command: {
        ...commandBase(state, playerId, `PLAY_CARD:${card.id}`),
        type: 'PLAY_CARD',
        cardId: card.id
      },
      presentation: {
        category: 'PLAY_CARD',
        cardInstanceId: card.id,
        cardKind: card.kind
      }
    })) ?? [];

  const drawOptions = validateDraw(state, playerId).ok
    ? [option({
        optionId: `draw:${playerId}`,
        command: {
          ...commandBase(state, playerId, 'DRAW_CARD'),
          type: 'DRAW_CARD'
        },
        presentation: {
          category: 'DRAW_CARD'
        }
      })]
    : [];

  const options = [...playOptions, ...drawOptions];
  return { requiredAction: options.length ? 'PLAY_OR_DRAW' : null, options };
}

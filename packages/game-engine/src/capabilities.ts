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

function targetOptions(state: GameState, playerId: string, type: 'SELECT_DUEL_TARGET' | 'SELECT_PARANOIA_TARGET' | 'SELECT_PARANOIA_CLASSIC_ANSWER' | 'SELECT_SOCIAL_TARGET', targetIds: readonly string[]): LegalCommandOption[] {
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

function nopeReactionOption(state: GameState, playerId: string): LegalCommandOption | null {
  const social = state.social;
  if (!social || social.resolutionComplete || (social.cardKind !== 'truth' && social.cardKind !== 'dare')) return null;
  const affectedPlayerId = social.pendingTargetId ?? social.actorId;
  if (affectedPlayerId !== playerId) return null;
  const nope = state.players.find(player => player.id === playerId)?.hand.find(card => card.kind === 'nope');
  if (!nope) return null;
  return option({
    optionId: `nope:${nope.id}`,
    command: {
      ...commandBase(state, playerId, `PLAY_NOPE:${nope.id}`),
      type: 'PLAY_NOPE',
      cardId: nope.id
    },
    presentation: {
      category: 'CHOICE',
      choiceKey: 'PLAY_NOPE'
    }
  });
}

function ghostActivationOption(state: GameState, playerId: string): LegalCommandOption | null {
  const ghost = state.ghostEffects.find(effect => effect.playerId === playerId && effect.status === 'ARMED');
  if (!ghost) return null;
  return option({
    optionId: `ghost:${ghost.cardId}:activate`,
    command: {
      ...commandBase(state, playerId, `ACTIVATE_GHOST:${ghost.cardId}`),
      type: 'ACTIVATE_GHOST',
      cardId: ghost.cardId
    },
    presentation: {
      category: 'CHOICE',
      choiceKey: 'ACTIVATE_GHOST'
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

function continueOption(state: GameState, playerId: string): LegalCommandOption {
  return option({
    optionId: 'continue:complete-flow',
    command: {
      ...commandBase(state, playerId, 'COMPLETE_FLOW'),
      type: 'COMPLETE_FLOW'
    },
    presentation: {
      category: 'CONTINUE'
    }
  });
}

const MACHIAVELLI_EFFECTS = ['CONVERT_THE_WEAK', 'TABOO_FOR_ALL', 'NO_MERCY', 'PARANOIA_SPREADS', 'DOUBLE_THE_PRESSURE', 'REVERSE_CONFESSION'] as const;

function machiavelliOptions(state: GameState, playerId: string): LegalCommandOption[] {
  return MACHIAVELLI_EFFECTS.map(effect => option({
    optionId: `machiavelli:${effect}`,
    command: {
      ...commandBase(state, playerId, `SELECT_MACHIAVELLI_EFFECT:${effect}`),
      type: 'SELECT_MACHIAVELLI_EFFECT',
      effect
    } as GameCommand,
    presentation: { category: 'CHOICE', choiceKey: effect }
  }));
}

function isAllPlayerCompletionSocial(social: NonNullable<GameState['social']>): boolean {
  return (social.cardKind === 'chaos' || social.cardKind === 'truth_or_chaos') && social.promptSelection?.selection.targeting === 'all';
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
    if (social.pendingTargetId && !social.paranoiaPhase && social.actorId === playerId) {
      return {
        requiredAction: 'SELECT_OPTION',
        options: ['CLASSIC', 'STRANGER'].map(phase => option({
          optionId: `paranoia-phase:${phase}`,
          command: {
            ...commandBase(state, playerId, `SELECT_PARANOIA_PHASE:${phase}`),
            type: 'SELECT_PARANOIA_PHASE',
            phase
          } as GameCommand,
          presentation: { category: 'CHOICE', choiceKey: phase }
        }))
      };
    }
    if (social.paranoiaPhase === 'CLASSIC' && social.pendingTargetId === playerId && !social.classicAnswerPlayerId) {
      return { requiredAction: 'SELECT_TARGET', options: targetOptions(state, playerId, 'SELECT_PARANOIA_CLASSIC_ANSWER', state.players.map(item => item.id)) };
    }
    if (social.paranoiaPhase === 'CLASSIC' && social.classicAnswerPlayerId === playerId && !social.classicRevealDecision) {
      return {
        requiredAction: 'SELECT_OPTION',
        options: ['KEEP_SECRET', 'REVEAL'].map(decision => option({
          optionId: `paranoia-classic-decision:${decision}`,
          command: {
            ...commandBase(state, playerId, `SUBMIT_PARANOIA_CLASSIC_DECISION:${decision}`),
            type: 'SUBMIT_PARANOIA_CLASSIC_DECISION',
            decision
          } as GameCommand,
          presentation: { category: 'CHOICE', choiceKey: decision }
        }))
      };
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

  if (['truth', 'dare', 'tag', 'hijack', 'taboo', 'reverse_confession', 'dig_me'].includes(social.cardKind)) {
    if (!social.pendingTargetId && social.actorId === playerId && social.pendingTargetIds.length) {
      return { requiredAction: 'SELECT_TARGET', options: targetOptions(state, playerId, 'SELECT_SOCIAL_TARGET', social.pendingTargetIds) };
    }
    if ((social.cardKind === 'truth' || social.cardKind === 'dare' || social.cardKind === 'taboo' || social.cardKind === 'reverse_confession' || social.cardKind === 'dig_me') && social.pendingTargetId === playerId) {
      if (!social.answerState.mode) return { requiredAction: 'SELECT_ANSWER_MODE', options: [answeredLiveModeOption(state, playerId)] };
      if (social.answerState.mode === 'ANSWERED_LIVE' && social.answerState.status !== 'SUBMITTED') return { requiredAction: 'SUBMIT_COMPLETION', options: [markAnsweredLiveOption(state, playerId)] };
    }
    return { requiredAction: null, options: [] };
  }

  if (social.cardKind === 'machiavelli') {
    if (social.actorId === playerId) return { requiredAction: 'SELECT_OPTION', options: machiavelliOptions(state, playerId) };
    return { requiredAction: null, options: [] };
  }

  const isAllPlayerCompletion = isAllPlayerCompletionSocial(social);
  if (isAllPlayerCompletion) {
    if (!social.pendingCompletionPlayerIds.includes(playerId) || social.completedCompletionPlayerIds.includes(playerId)) {
      return { requiredAction: null, options: [] };
    }
    const record = social.completionRecords[playerId];
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

  const ghostActivation = ghostActivationOption(state, playerId);

  if (state.social?.resolutionComplete) {
    if (state.social.actorId !== playerId || state.currentPlayerId !== playerId) return { requiredAction: null, options: [] };
    return { requiredAction: 'CONTINUE', options: [continueOption(state, playerId)] };
  }

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

  if (state.social && !state.social.resolutionComplete) {
    const social = socialCapabilities(state, playerId);
    const nope = nopeReactionOption(state, playerId);
    const options = [...social.options, ...(nope ? [nope] : []), ...(ghostActivation ? [ghostActivation] : [])];
    return { requiredAction: options.length ? social.requiredAction ?? 'SELECT_OPTION' : null, options };
  }

  if (ghostActivation) return { requiredAction: 'SELECT_OPTION', options: [ghostActivation] };

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

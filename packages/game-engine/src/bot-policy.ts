import type { GameState, LegalCommandOption, PlayerDecisionCapabilities } from '@cribbit/contracts';
import { projectDecisionCapabilities } from './capabilities.ts';

export type BotDecision =
  | { kind: 'command'; option: LegalCommandOption }
  | { kind: 'wait'; reason: 'not-bot-turn' | 'human-required' | 'no-legal-option' | 'game-finished' };

export interface BotPolicyOptions {
  isBotPlayerId?: (playerId: string) => boolean;
}

function defaultIsBotPlayerId(playerId: string): boolean {
  return playerId.startsWith('bot:');
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function optionScore(state: GameState, playerId: string, option: LegalCommandOption, isBotPlayerId: (playerId: string) => boolean): number {
  let score = stableHash(`${state.id}|${state.revision}|${playerId}|${option.optionId}`) / 0xffffffff;

  if (option.presentation.category === 'TARGET' && option.presentation.targetPlayerId) {
    score += isBotPlayerId(option.presentation.targetPlayerId) ? 0 : 100;
  }

  if (option.presentation.category === 'PLAY_CARD') {
    score += option.presentation.cardKind === 'number' ? 20 : 35;
    const player = state.players.find(item => item.id === playerId);
    if (player?.hand.length === 1) score += 50;
  }

  if (option.presentation.category === 'DRAW_CARD') score -= 10;
  if (option.presentation.category === 'COLOR') score += option.presentation.color === 'lime' ? 4 : option.presentation.color === 'orange' ? 3 : option.presentation.color === 'cyan' ? 2 : 1;
  if (option.presentation.category === 'ANSWER_MODE') score += 10;
  if (option.presentation.category === 'COMPLETION') score += 10;
  if (option.presentation.category === 'CONTINUE') score += 1000;
  if (option.presentation.category === 'VOTE') score += option.presentation.voteForPlayerId && !isBotPlayerId(option.presentation.voteForPlayerId) ? 20 : 5;
  if (option.presentation.category === 'CHOICE') {
    if (state.social?.cardKind === 'truth_or_chaos' && option.presentation.choiceKey === 'YES') score += 100;
    if (option.presentation.choiceKey === 'CLASSIC') score += 20;
    if (option.presentation.choiceKey === 'KEEP_SECRET') score += 20;
    if (option.presentation.choiceKey === 'REVEAL') score += 5;
  }

  return score;
}

export function chooseBotOption(
  state: GameState,
  playerId: string,
  capabilities: PlayerDecisionCapabilities = projectDecisionCapabilities(state, playerId),
  options: BotPolicyOptions = {}
): BotDecision {
  if (state.status === 'FINISHED') return { kind: 'wait', reason: 'game-finished' };
  if (!capabilities.options.length) return { kind: 'wait', reason: capabilities.requiredAction ? 'no-legal-option' : 'not-bot-turn' };

  const isBotPlayerId = options.isBotPlayerId ?? defaultIsBotPlayerId;
  const ranked = [...capabilities.options].sort((left, right) => {
    const rightScore = optionScore(state, playerId, right, isBotPlayerId);
    const leftScore = optionScore(state, playerId, left, isBotPlayerId);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.optionId.localeCompare(right.optionId);
  });

  return { kind: 'command', option: ranked[0] };
}

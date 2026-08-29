import type { AdaptiveProbabilityState, Card, CardKind, GameState } from '@cribbit/contracts';
import type { RandomSource } from './rng.ts';
import { createSeededRandom, shuffle, toSeedString } from './rng.ts';

export const IMMEDIATE_INTERACTION_KINDS = new Set<CardKind>([
  'truth',
  'dare',
  'paranoia',
  'chaos',
  'duel',
  'tag',
  'truth_or_chaos',
  'hijack',
  'taboo',
  'reverse_confession',
  'machiavelli',
  'dig_me'
]);

export const HIGH_IMPACT_SPECIAL_KINDS = new Set<CardKind>([
  ...IMMEDIATE_INTERACTION_KINDS,
  'wild',
  'nope',
  'ghost'
]);

const COMMON_ACTION_KINDS = new Set<CardKind>(['skip', 'reverse', 'draw']);
const RARE_KINDS = new Set<CardKind>(['machiavelli', 'ghost', 'dig_me']);

type AdaptiveStateWithObservation = AdaptiveProbabilityState & {
  lastObservedDiscardId?: string;
};

export interface AdaptiveOpeningDeal {
  hands: Card[][];
  remainingDeck: Card[];
}

export interface AdaptiveWeightSnapshot {
  adaptive: Partial<Record<CardKind, number>>;
  primaryNoisy: Partial<Record<CardKind, number>>;
  rebalanced: Partial<Record<CardKind, number>>;
  finalNoisy: Partial<Record<CardKind, number>>;
}

export function createAdaptiveProbabilityState(): AdaptiveProbabilityState {
  return {
    sequence: 0,
    drawCount: 0,
    interactionPressure: 1,
    familyLastSeenStep: {}
  };
}

export function isImmediateInteractionKind(kind: CardKind): boolean {
  return IMMEDIATE_INTERACTION_KINDS.has(kind);
}

export function isHighImpactSpecialKind(kind: CardKind): boolean {
  return HIGH_IMPACT_SPECIAL_KINDS.has(kind);
}

function familyCategory(kind: CardKind): 'number' | 'common' | 'interaction' | 'retained-special' {
  if (kind === 'number') return 'number';
  if (COMMON_ACTION_KINDS.has(kind)) return 'common';
  if (IMMEDIATE_INTERACTION_KINDS.has(kind)) return 'interaction';
  return 'retained-special';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function chooseWeightedIndex(weights: readonly number[], random: RandomSource): number {
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return -1;
  let target = random.next() * total;
  for (let index = 0; index < weights.length; index += 1) {
    target -= Math.max(0, weights[index]);
    if (target < 0) return index;
  }
  return weights.length - 1;
}

function takeRandomCard(pool: Card[], predicate: (card: Card) => boolean, random: RandomSource): Card | null {
  const eligibleIndices: number[] = [];
  for (let index = 0; index < pool.length; index += 1) {
    if (predicate(pool[index])) eligibleIndices.push(index);
  }
  if (!eligibleIndices.length) return null;
  const selectedEligibleIndex = Math.floor(random.next() * eligibleIndices.length);
  const poolIndex = eligibleIndices[Math.min(selectedEligibleIndex, eligibleIndices.length - 1)];
  const [card] = pool.splice(poolIndex, 1);
  return card ?? null;
}

/**
 * Opening hands are deliberately constrained but not templated. Each hand receives
 * one or two high-impact specials; the one-vs-two probability responds to the
 * physical pool remaining while preserving at least one special for every player
 * still waiting to be dealt.
 */
export function dealAdaptiveOpeningHands(
  deck: readonly Card[],
  playerCount: number,
  handCount: number,
  random: RandomSource
): AdaptiveOpeningDeal {
  const pool = [...deck];
  const hands = Array.from({ length: playerCount }, () => [] as Card[]);

  if (handCount <= 0) return { hands, remainingDeck: pool };

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    const playersAfter = playerCount - playerIndex - 1;
    const specialsRemaining = pool.filter(card => isHighImpactSpecialKind(card.kind)).length;
    const totalRemaining = pool.length;
    const mustReserve = playersAfter;
    const canTakeTwo = specialsRemaining - 2 >= mustReserve;
    const naturalSpecialsPerHand = totalRemaining > 0
      ? handCount * (specialsRemaining / totalRemaining)
      : 1;
    const twoSpecialChance = clamp((naturalSpecialsPerHand - 1) * 0.65, 0.2, 0.75);
    const specialTarget = canTakeTwo && random.next() < twoSpecialChance ? 2 : 1;

    for (let index = 0; index < specialTarget; index += 1) {
      const special = takeRandomCard(pool, card => isHighImpactSpecialKind(card.kind), random);
      if (!special) break;
      hands[playerIndex].push(special);
    }

    while (hands[playerIndex].length < handCount) {
      const ordinary = takeRandomCard(pool, card => !isHighImpactSpecialKind(card.kind), random);
      const fallback = ordinary ?? takeRandomCard(pool, () => true, random);
      if (!fallback) break;
      hands[playerIndex].push(fallback);
    }

    hands[playerIndex] = shuffle(hands[playerIndex], random);
  }

  return { hands, remainingDeck: pool };
}

function ensureAdaptiveState(state: GameState): AdaptiveProbabilityState {
  state.adaptiveProbability ??= createAdaptiveProbabilityState();
  return state.adaptiveProbability;
}

/**
 * A card played from hand is normally visible as the top discard before the next
 * draw. Observe each new top-discard instance exactly once so a played Skip, Truth,
 * etc. lowers its family's freshness, then naturally ages as later draws advance the
 * shared sequence instead of being refreshed forever by the same discard card.
 */
function syncRecentDiscardHistory(state: GameState, adaptive: AdaptiveProbabilityState): void {
  const topDiscard = state.discardPile.at(-1);
  if (!topDiscard) return;
  const observed = adaptive as AdaptiveStateWithObservation;
  if (observed.lastObservedDiscardId === topDiscard.id) return;
  observed.lastObservedDiscardId = topDiscard.id;
  adaptive.familyLastSeenStep[topDiscard.kind] = adaptive.sequence;
}

function freshnessMultiplier(kind: CardKind, adaptive: AdaptiveProbabilityState): number {
  const lastSeen = adaptive.familyLastSeenStep[kind];
  if (lastSeen === undefined) return 1;
  const age = Math.max(0, adaptive.sequence - lastSeen);
  if (age <= 0) return 0.55;
  if (age === 1) return 0.66;
  if (age === 2) return 0.77;
  if (age === 3) return 0.86;
  if (age === 4) return 0.94;
  return 1;
}

function tierLifecycleMultiplier(kind: CardKind): number {
  // Physical copy count is the primary rarity authority. This small rare-tier
  // damping is intentionally mild and remains a simulation tuning candidate.
  return RARE_KINDS.has(kind) ? 0.9 : 1;
}

function groupCardsByKind(cards: readonly Card[]): Map<CardKind, Card[]> {
  const groups = new Map<CardKind, Card[]>();
  for (const card of cards) {
    const group = groups.get(card.kind) ?? [];
    group.push(card);
    groups.set(card.kind, group);
  }
  return groups;
}

function categoryTotals(weights: Partial<Record<CardKind, number>>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const [kind, value] of Object.entries(weights) as Array<[CardKind, number]>) {
    const category = familyCategory(kind);
    totals.set(category, (totals.get(category) ?? 0) + value);
  }
  return totals;
}

function rebalanceToCategoryMass(
  adaptiveWeights: Partial<Record<CardKind, number>>,
  noisyWeights: Partial<Record<CardKind, number>>
): Partial<Record<CardKind, number>> {
  const desired = categoryTotals(adaptiveWeights);
  const noisy = categoryTotals(noisyWeights);
  const result: Partial<Record<CardKind, number>> = {};

  for (const [kind, noisyWeight] of Object.entries(noisyWeights) as Array<[CardKind, number]>) {
    const category = familyCategory(kind);
    const targetMass = desired.get(category) ?? 0;
    const noisyMass = noisy.get(category) ?? 0;
    result[kind] = noisyMass > 0 ? noisyWeight * (targetMass / noisyMass) : 0;
  }
  return result;
}

function seededVariance(seed: string | number, sequence: number, stage: string, kind: CardKind, min: number, max: number): number {
  const random = createSeededRandom(`${toSeedString(seed)}:chaos-pulse:${sequence}:${stage}:${kind}`);
  return min + random.next() * (max - min);
}

function applySecondaryJitterWithinCategories(
  seed: string | number,
  sequence: number,
  rebalanced: Partial<Record<CardKind, number>>
): Partial<Record<CardKind, number>> {
  const jittered: Partial<Record<CardKind, number>> = {};
  for (const [kind, weight] of Object.entries(rebalanced) as Array<[CardKind, number]>) {
    jittered[kind] = weight * seededVariance(seed, sequence, 'secondary', kind, 0.97, 1.03);
  }
  return rebalanceToCategoryMass(rebalanced, jittered);
}

export function calculateAdaptiveWeightSnapshot(state: GameState): AdaptiveWeightSnapshot {
  const adaptive = ensureAdaptiveState(state);
  syncRecentDiscardHistory(state, adaptive);
  const groups = groupCardsByKind(state.drawPile);
  const adaptiveWeights: Partial<Record<CardKind, number>> = {};
  const primaryNoisy: Partial<Record<CardKind, number>> = {};

  for (const [kind, cards] of groups) {
    const baseAvailability = cards.length * 10;
    const freshness = freshnessMultiplier(kind, adaptive);
    const interaction = isImmediateInteractionKind(kind) ? adaptive.interactionPressure : 1;
    const tier = tierLifecycleMultiplier(kind);
    const weight = baseAvailability * freshness * interaction * tier;
    adaptiveWeights[kind] = weight;
    primaryNoisy[kind] = weight * seededVariance(state.config.seed, adaptive.sequence, 'primary', kind, 0.85, 1.15);
  }

  const rebalanced = rebalanceToCategoryMass(adaptiveWeights, primaryNoisy);
  const finalNoisy = applySecondaryJitterWithinCategories(state.config.seed, adaptive.sequence, rebalanced);
  return { adaptive: adaptiveWeights, primaryNoisy, rebalanced, finalNoisy };
}

export function selectAdaptiveDrawCard(state: GameState): Card | null {
  if (!state.drawPile.length) return null;
  const adaptive = ensureAdaptiveState(state);
  const snapshot = calculateAdaptiveWeightSnapshot(state);
  const groups = groupCardsByKind(state.drawPile);
  const kinds = [...groups.keys()];
  const weights = kinds.map(kind => Math.max(0, snapshot.finalNoisy[kind] ?? 0));
  const random = createSeededRandom(`${toSeedString(state.config.seed)}:chaos-pulse:${adaptive.sequence}:select`);
  const kindIndex = chooseWeightedIndex(weights, random);
  if (kindIndex < 0) return null;
  const kind = kinds[kindIndex];
  const eligible = groups.get(kind) ?? [];
  if (!eligible.length) return null;

  const instanceRandom = createSeededRandom(`${toSeedString(state.config.seed)}:chaos-pulse:${adaptive.sequence}:instance:${kind}`);
  const selected = eligible[Math.min(Math.floor(instanceRandom.next() * eligible.length), eligible.length - 1)];
  const poolIndex = state.drawPile.findIndex(card => card.id === selected.id);
  if (poolIndex < 0) return null;
  const [card] = state.drawPile.splice(poolIndex, 1);
  if (!card) return null;

  adaptive.sequence += 1;
  adaptive.drawCount += 1;
  adaptive.familyLastSeenStep[card.kind] = adaptive.sequence;
  if (isImmediateInteractionKind(card.kind)) {
    adaptive.interactionPressure = clamp(adaptive.interactionPressure * 0.62, 0.55, 1.9);
  } else {
    adaptive.interactionPressure = clamp(adaptive.interactionPressure * 1.08 + 0.02, 0.55, 1.9);
  }
  return card;
}

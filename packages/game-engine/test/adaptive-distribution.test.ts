import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameState } from '@cribbit/contracts';
import {
  CANONICAL_DECK_SIZE,
  calculateAdaptiveWeightSnapshot,
  createAdaptiveProbabilityState,
  createGame,
  drawCards,
  isHighImpactSpecialKind,
  isImmediateInteractionKind,
  selectAdaptiveDrawCard
} from '../src/index.ts';

function unwrap(stateResult: ReturnType<typeof createGame>): GameState {
  if (!stateResult.ok) throw stateResult.error ?? new Error('Expected game creation to succeed.');
  return stateResult.state;
}

function countOpeningSpecials(state: GameState): number[] {
  return state.players.map(player => player.hand.filter(card => isHighImpactSpecialKind(card.kind)).length);
}

function allPhysicalIds(state: GameState): string[] {
  return [
    ...state.players.flatMap(player => player.hand.map(card => card.id)),
    ...state.drawPile.map(card => card.id),
    ...state.discardPile.map(card => card.id)
  ];
}

function category(kind: Card['kind']): 'number' | 'common' | 'interaction' | 'retained-special' {
  if (kind === 'number') return 'number';
  if (kind === 'skip' || kind === 'reverse' || kind === 'draw') return 'common';
  if (isImmediateInteractionKind(kind)) return 'interaction';
  return 'retained-special';
}

function categoryMass(weights: Partial<Record<Card['kind'], number>>, categoryName: ReturnType<typeof category>): number {
  return (Object.entries(weights) as Array<[Card['kind'], number]>).reduce(
    (sum, [kind, weight]) => sum + (category(kind) === categoryName ? weight : 0),
    0
  );
}

function syntheticState(cards: Card[], seed = 'adaptive-synthetic-seed'): GameState {
  const state = unwrap(createGame({ seed }, [{ id: 'alice' }, { id: 'bob' }]));
  state.drawPile = cards.map(card => ({ ...card }));
  state.discardPile = [];
  state.adaptiveProbability = createAdaptiveProbabilityState();
  return state;
}

test('opening deal gives every player seven cards with exactly one or two high-impact specials for 2 through 10 players', () => {
  for (let playerCount = 2; playerCount <= 10; playerCount += 1) {
    const players = Array.from({ length: playerCount }, (_, index) => ({ id: `p-${playerCount}-${index}` }));
    const state = unwrap(createGame({ seed: `opening-${playerCount}` }, players));

    for (const player of state.players) {
      assert.equal(player.hand.length, 7, `${playerCount}-player hand size`);
      const specialCount = player.hand.filter(card => isHighImpactSpecialKind(card.kind)).length;
      assert.ok(specialCount >= 1 && specialCount <= 2, `${playerCount}-player hand must contain 1-2 specials`);
    }

    const ids = allPhysicalIds(state);
    assert.equal(ids.length, CANONICAL_DECK_SIZE, `${playerCount}-player game must account for all physical cards`);
    assert.equal(new Set(ids).size, CANONICAL_DECK_SIZE, `${playerCount}-player game must not duplicate physical ids`);
  }
});

test('opening deal is deterministic for one seed but varied across different seeds', () => {
  const players = [{ id: 'alice' }, { id: 'bob' }, { id: 'carol' }, { id: 'dave' }, { id: 'eve' }];
  const first = unwrap(createGame({ seed: 'opening-repeatable' }, players));
  const replay = unwrap(createGame({ seed: 'opening-repeatable' }, players));
  const different = unwrap(createGame({ seed: 'opening-different' }, players));

  const firstHands = first.players.map(player => player.hand.map(card => card.id));
  const replayHands = replay.players.map(player => player.hand.map(card => card.id));
  const differentKinds = different.players.map(player => player.hand.map(card => card.kind));
  const firstKinds = first.players.map(player => player.hand.map(card => card.kind));

  assert.deepEqual(replayHands, firstHands);
  assert.notDeepEqual(differentKinds, firstKinds);
});

test('physical availability produces 60/30/10 raw family scale before freshness and tier effects', () => {
  const cards: Card[] = [
    ...Array.from({ length: 6 }, (_, index) => ({ id: `skip-${index}`, kind: 'skip' as const })),
    ...Array.from({ length: 3 }, (_, index) => ({ id: `truth-${index}`, kind: 'truth' as const })),
    { id: 'machiavelli-0', kind: 'machiavelli' }
  ];
  const state = syntheticState(cards);
  const snapshot = calculateAdaptiveWeightSnapshot(state);

  assert.equal(snapshot.adaptive.skip, 60);
  assert.equal(snapshot.adaptive.truth, 30);
  // The current test tuning applies a mild 0.9 rare-tier multiplier after base availability.
  assert.equal(snapshot.adaptive.machiavelli, 9);
});

test('a newly observed played family is freshness-suppressed without becoming impossible', () => {
  const cards: Card[] = [
    ...Array.from({ length: 4 }, (_, index) => ({ id: `skip-${index}`, kind: 'skip' as const })),
    ...Array.from({ length: 4 }, (_, index) => ({ id: `reverse-${index}`, kind: 'reverse' as const }))
  ];
  const state = syntheticState(cards);
  state.discardPile = [{ id: 'played-skip', kind: 'skip' }];
  const snapshot = calculateAdaptiveWeightSnapshot(state);

  assert.ok((snapshot.adaptive.skip ?? 0) > 0);
  assert.ok((snapshot.adaptive.skip ?? 0) < (snapshot.adaptive.reverse ?? 0));
});

test('primary CHAOS variance disturbs family weights and the rebalancer restores category mass', () => {
  const state = unwrap(createGame({ seed: 'primary-chaos-rebalance' }, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]));
  const snapshot = calculateAdaptiveWeightSnapshot(state);

  const changed = (Object.keys(snapshot.adaptive) as Card['kind'][]).some(
    kind => Math.abs((snapshot.adaptive[kind] ?? 0) - (snapshot.primaryNoisy[kind] ?? 0)) > 0.000001
  );
  assert.equal(changed, true);

  for (const categoryName of ['number', 'common', 'interaction', 'retained-special'] as const) {
    const intended = categoryMass(snapshot.adaptive, categoryName);
    const repaired = categoryMass(snapshot.rebalanced, categoryName);
    assert.ok(Math.abs(intended - repaired) < 0.000001, `${categoryName} macro mass should be restored`);
  }
});

test('secondary CHAOS jitter occurs after rebalancing while preserving category mass', () => {
  const state = unwrap(createGame({ seed: 'secondary-chaos-jitter' }, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]));
  const snapshot = calculateAdaptiveWeightSnapshot(state);

  const changed = (Object.keys(snapshot.rebalanced) as Card['kind'][]).some(
    kind => Math.abs((snapshot.rebalanced[kind] ?? 0) - (snapshot.finalNoisy[kind] ?? 0)) > 0.000001
  );
  assert.equal(changed, true);

  for (const categoryName of ['number', 'common', 'interaction', 'retained-special'] as const) {
    const repaired = categoryMass(snapshot.rebalanced, categoryName);
    const finalMass = categoryMass(snapshot.finalNoisy, categoryName);
    assert.ok(Math.abs(repaired - finalMass) < 0.000001, `${categoryName} final jitter should stay within category mass`);
  }
});

test('adaptive draw removes exactly one real card and updates shared pacing state', () => {
  const state = unwrap(createGame({ seed: 'adaptive-real-card' }, [{ id: 'alice' }, { id: 'bob' }]));
  const beforeIds = new Set(state.drawPile.map(card => card.id));
  const beforeSize = state.drawPile.length;
  const beforeSequence = state.adaptiveProbability?.sequence ?? 0;

  const card = selectAdaptiveDrawCard(state);
  assert.ok(card);
  assert.equal(beforeIds.has(card.id), true);
  assert.equal(state.drawPile.length, beforeSize - 1);
  assert.equal(state.drawPile.some(candidate => candidate.id === card.id), false);
  assert.equal(state.adaptiveProbability?.sequence, beforeSequence + 1);
  assert.equal(state.adaptiveProbability?.drawCount, 1);
});

test('interaction draws reduce pressure and quiet draws increase it', () => {
  const interactionState = syntheticState([{ id: 'truth-only', kind: 'truth' }], 'pressure-interaction');
  const interactionBefore = interactionState.adaptiveProbability!.interactionPressure;
  assert.equal(selectAdaptiveDrawCard(interactionState)?.kind, 'truth');
  assert.ok(interactionState.adaptiveProbability!.interactionPressure < interactionBefore);

  const quietState = syntheticState([{ id: 'number-only', kind: 'number', color: 'lime', value: 4 }], 'pressure-quiet');
  const quietBefore = quietState.adaptiveProbability!.interactionPressure;
  assert.equal(selectAdaptiveDrawCard(quietState)?.kind, 'number');
  assert.ok(quietState.adaptiveProbability!.interactionPressure > quietBefore);
});

test('multi-card draw recalculates sequentially and advances adaptive draw count per physical card', () => {
  const state = unwrap(createGame({ seed: 'adaptive-multi-draw' }, [{ id: 'alice' }, { id: 'bob' }]));
  const beforeSize = state.drawPile.length;
  const cards = drawCards(state, 2);

  assert.equal(cards.length, 2);
  assert.equal(state.drawPile.length, beforeSize - 2);
  assert.equal(state.adaptiveProbability?.drawCount, 2);
  assert.equal(new Set(cards.map(card => card.id)).size, 2);
});

test('same seed and same event path reproduces adaptive draws', () => {
  const players = [{ id: 'alice' }, { id: 'bob' }, { id: 'carol' }];
  const first = unwrap(createGame({ seed: 'adaptive-replay' }, players));
  const replay = unwrap(createGame({ seed: 'adaptive-replay' }, players));

  const firstDraws = drawCards(first, 8).map(card => card.id);
  const replayDraws = drawCards(replay, 8).map(card => card.id);
  assert.deepEqual(replayDraws, firstDraws);
  assert.deepEqual(replay.adaptiveProbability, first.adaptiveProbability);
});

test('zero-availability families cannot be selected', () => {
  const state = syntheticState([
    { id: 'number-a', kind: 'number', color: 'lime', value: 1 },
    { id: 'number-b', kind: 'number', color: 'cyan', value: 2 }
  ], 'zero-availability');
  const snapshot = calculateAdaptiveWeightSnapshot(state);

  assert.equal(snapshot.adaptive.truth, undefined);
  assert.equal(snapshot.finalNoisy.truth, undefined);
  assert.equal(selectAdaptiveDrawCard(state)?.kind, 'number');
});

test('opening-special distributions stay varied across seeds rather than repeating one fixed hand shape', () => {
  const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
  const patterns = new Set<string>();

  for (let seed = 0; seed < 40; seed += 1) {
    const state = unwrap(createGame({ seed: `variety-${seed}` }, players));
    patterns.add(countOpeningSpecials(state).join('-'));
  }

  assert.ok(patterns.size > 1, 'opening distribution should produce more than one legal 1/2-special pattern');
});

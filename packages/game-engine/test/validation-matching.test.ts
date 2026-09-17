import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameState } from '@cribbit/contracts';
import { validatePlay } from '../src/validation.ts';

function card(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return { id, kind, ...fields };
}

function stateFor(topSymbol: string | null, handCard: Card): GameState {
  return {
    id: 'matching-test',
    revision: 0,
    status: 'ACTIVE',
    phase: 'PLAY_DRAW',
    config: {
      seed: 'matching-test',
      startingHandCount: 7,
      drawPenalty: 2,
      drawPenaltySkipsTurn: true,
      allowVoluntaryDraw: true,
      startingDirection: 1,
      startingPlayerIndex: 0,
      initialDiscardStrategy: 'FIRST_NUMBER_CARD',
      contentWorld: 'UNDER_18_CLEAN',
      turnTimeoutMs: 30000,
      socialTimeoutMs: 45000
    },
    players: [
      { id: 'p1', seat: 0, hand: [handCard], status: 'ACTIVE' },
      { id: 'p2', seat: 1, hand: [], status: 'ACTIVE' }
    ],
    drawPile: [],
    discardPile: [],
    currentPlayerId: 'p1',
    direction: 1,
    activeColor: null,
    activeSymbol: topSymbol,
    pendingEffect: null,
    timer: null,
    social: null,
    winnerId: null,
    rewindUsedByPlayerIds: [],
    processedCommands: {}
  };
}

test('locked same-family matching remains explicit for established playable families', () => {
  for (const kind of ['skip', 'reverse', 'draw', 'truth', 'dare', 'paranoia', 'chaos', 'duel'] as const) {
    const candidate = card(kind, kind, { symbol: kind });
    assert.equal(validatePlay(stateFor(kind, candidate), 'p1', candidate.id).ok, true, kind);
  }
});

test('Nope remains reaction-only and cannot become legal through activeSymbol matching', () => {
  const candidate = card('nope', 'nope', { symbol: 'nope' });
  assert.equal(validatePlay(stateFor('nope', candidate), 'p1', candidate.id).ok, false);
});

test('unresolved special families fail closed instead of inheriting the old generic same-family fallback', () => {
  const unresolved = [
    'tag',
    'truth_or_chaos',
    'hijack',
    'taboo',
    'machiavelli',
    'ghost',
    'reverse_confession',
    'dig_me'
  ] as const;

  for (const kind of unresolved) {
    const candidate = card(kind, kind, { symbol: kind });
    const result = validatePlay(stateFor(kind, candidate), 'p1', candidate.id);
    assert.equal(result.ok, false, `${kind} must remain blocked until its matching rule is explicitly approved`);
    assert.equal(result.error?.code, 'ILLEGAL_PLAY');
  }
});

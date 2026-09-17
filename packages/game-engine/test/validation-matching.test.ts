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

test('phase-2B special families are playable while Ghost remains fail-closed for its separate armed lifecycle', () => {
  const enabled = [
    'tag',
    'truth_or_chaos',
    'hijack',
    'taboo',
    'machiavelli',
    'reverse_confession',
    'dig_me'
  ] as const;

  for (const kind of enabled) {
    const candidate = card(kind, kind, { symbol: kind });
    const result = validatePlay(stateFor(kind, candidate), 'p1', candidate.id);
    assert.equal(result.ok, true, `${kind} should be accepted by the Phase 2B reducer path`);
  }

  const ghost = card('ghost', 'ghost', { symbol: 'ghost' });
  const ghostResult = validatePlay(stateFor('ghost', ghost), 'p1', ghost.id);
  assert.equal(ghostResult.ok, false, 'ghost remains blocked until its armed/flip lifecycle is implemented');
  assert.equal(ghostResult.error?.code, 'ILLEGAL_PLAY');
});

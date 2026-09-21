import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameState } from '@cribbit/contracts';
import { validatePlay } from '../src/validation.ts';

// Play-legality matching under the owner-approved canonical rules:
//   RULE-NUMBER-002      Number matches by color or number/value
//   RULE-SPECIAL-PLAY-001 Special = every non-Number family
//   RULE-SPECIAL-PLAY-002/003 Special from hand is legal while the Play Pile top is a Number,
//                             and never stacks on a Special top
//   RULE-SPECIAL-PLAY-007/008 the top Play Pile card decides, not carried-over symbol state

function card(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return { id, kind, ...fields };
}

const NUMBER_TOP = card('top-number', 'number', { color: 'orange', value: 6, symbol: '6' });
const SPECIAL_TOP = card('top-special', 'truth', { symbol: 'truth' });

function stateFor(top: Card, handCard: Card): GameState {
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
    discardPile: [top],
    currentPlayerId: 'p1',
    direction: 1,
    chaosReverseActive: false,
    activeColor: top.color ?? null,
    activeSymbol: top.kind === 'number' ? String(top.value ?? top.symbol ?? '') : top.symbol ?? top.kind,
    pendingEffect: null,
    pendingForcedInteractions: [],
    ghostEffects: [],
    timer: null,
    social: null,
    winnerId: null,
    rewindUsedByPlayerIds: [],
    processedCommands: {}
  };
}

const ESTABLISHED = ['skip', 'reverse', 'draw', 'truth', 'dare', 'paranoia', 'chaos', 'duel'] as const;
const PHASE_2B = ['tag', 'truth_or_chaos', 'hijack', 'taboo', 'machiavelli', 'reverse_confession', 'dig_me'] as const;

test('RULE-SPECIAL-PLAY-002: established Special families are playable from hand while the Play Pile top is a Number', () => {
  for (const kind of [...ESTABLISHED, ...PHASE_2B] as const) {
    const candidate = card(kind, kind, { symbol: kind });
    const result = validatePlay(stateFor(NUMBER_TOP, candidate), 'p1', candidate.id);
    assert.equal(result.ok, true, `${kind} must be playable from hand on a Number top regardless of color or symbol`);
  }

  const ghost = card('ghost', 'ghost', { symbol: 'ghost' });
  assert.equal(
    validatePlay(stateFor(NUMBER_TOP, ghost), 'p1', ghost.id).ok,
    true,
    'ghost is a Special and arms through its own lifecycle'
  );
});

test('RULE-SPECIAL-PLAY-003: the same Special families must not stack onto a Special Play Pile top', () => {
  for (const kind of [...ESTABLISHED, ...PHASE_2B] as const) {
    const candidate = card(kind, kind, { symbol: kind });
    const result = validatePlay(stateFor(SPECIAL_TOP, candidate), 'p1', candidate.id);
    assert.equal(result.ok, false, `${kind} must not be stacked onto a Special top`);
  }

  const ghost = card('ghost', 'ghost', { symbol: 'ghost' });
  assert.equal(
    validatePlay(stateFor(SPECIAL_TOP, ghost), 'p1', ghost.id).ok,
    false,
    'ghost is a Special by classification, so it is not stackable either'
  );
});

test('RULE-SPECIAL-PLAY-004: a Number matching the active condition stays playable on a Special top', () => {
  const sameColor = card('number-same-color', 'number', { color: 'orange', value: 3, symbol: '3' });
  const otherColor = card('number-other-color', 'number', { color: 'lime', value: 3, symbol: '3' });
  const noMatch = card('number-no-match', 'number', { color: 'lime', value: 8, symbol: '8' });

  const specialTopState = stateFor(SPECIAL_TOP, sameColor);
  specialTopState.activeColor = 'orange';
  assert.equal(validatePlay(specialTopState, 'p1', sameColor.id).ok, true, 'matching color on a Special top');

  const valueMatchState = stateFor(SPECIAL_TOP, otherColor);
  valueMatchState.activeColor = 'orange';
  valueMatchState.activeSymbol = '3';
  assert.equal(validatePlay(valueMatchState, 'p1', otherColor.id).ok, true, 'matching value on a Special top');
  assert.equal(validatePlay(stateFor(SPECIAL_TOP, noMatch), 'p1', noMatch.id).ok, false, 'unmatched Number is still illegal');
});

test('RULE-SPECIAL-PLAY-007: Nope remains reaction-only and is never opened by the Play Pile top', () => {
  const candidate = card('nope', 'nope', { symbol: 'nope' });
  assert.equal(validatePlay(stateFor(NUMBER_TOP, candidate), 'p1', candidate.id).ok, false);
  assert.equal(validatePlay(stateFor(card('top-nope', 'nope', { symbol: 'nope' }), candidate), 'p1', candidate.id).ok, false);
});

test('RULE-SPECIAL-PLAY-008: the Play Pile top governs, not carried-over activeSymbol state', () => {
  const reverse = card('reverse', 'reverse', { symbol: 'reverse' });

  const staleSymbolState = stateFor(SPECIAL_TOP, reverse);
  staleSymbolState.activeSymbol = 'reverse';
  assert.equal(validatePlay(staleSymbolState, 'p1', reverse.id).ok, false, 'a Special top blocks Special play even when the carried symbol matches');

  const numberTopState = stateFor(NUMBER_TOP, reverse);
  numberTopState.activeSymbol = '6';
  assert.equal(validatePlay(numberTopState, 'p1', reverse.id).ok, true, 'a Number top allows Special play even when the carried symbol does not match');
});

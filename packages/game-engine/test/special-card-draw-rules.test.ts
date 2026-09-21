import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameCommand, GameState, GameTransition } from '@cribbit/contracts';
import { applyCommand, createGame, isLegalPlay } from '../src/index.ts';

// Focused regressions for the owner-approved canonical rules:
//   RULE-SPECIAL-PLAY-001..008  (Special-card play from hand)
//   RULE-VOLUNTARY-DRAW-001..007 (voluntary draw)
// Every assertion below cites the active canonical rule it proves.

function makeCard(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return { id, kind, ...fields } as Card;
}

function unwrap<T>(transition: GameTransition<T>): T {
  if (!transition.ok) {
    throw transition.error ?? new Error('Expected transition to succeed.');
  }
  return transition.state;
}

function baseState(playerCount = 2): GameState {
  const players = Array.from({ length: playerCount }, (_, index) => ({ id: `player-${index + 1}`, seat: index }));
  return unwrap(createGame({ seed: 'special-card-draw-rules-seed' }, players, undefined, { now: 1_000_000 }));
}

function setHands(state: GameState, hands: Record<string, Card[]>): void {
  for (const player of state.players) {
    player.hand = [...(hands[player.id] ?? [])];
  }
}

function setTopDiscard(state: GameState, card: Card): void {
  state.discardPile = [card];
  state.activeColor = card.color ?? null;
  state.activeSymbol = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : card.symbol ?? card.kind;
}

function playCommand(state: GameState, commandId: string, cardId: string): GameCommand {
  return {
    commandId,
    playerId: state.currentPlayerId,
    expectedRevision: state.revision,
    sessionId: state.id,
    type: 'PLAY_CARD',
    cardId
  };
}

function drawCommand(state: GameState, commandId: string): GameCommand {
  return {
    commandId,
    playerId: state.currentPlayerId,
    expectedRevision: state.revision,
    sessionId: state.id,
    type: 'DRAW_CARD'
  };
}

const NUMBER_TOP = () => makeCard('top-number', 'number', { color: 'orange', value: 6, symbol: '6' });
const SPECIAL_TOP = () => makeCard('top-truth', 'truth', { symbol: 'truth' });

test('RULE-SPECIAL-PLAY-002: a Non-Number top lets a Special be played from hand regardless of color or value', () => {
  const state = baseState(2);
  const plainSpecial = makeCard('hand-reverse', 'reverse', { symbol: 'reverse' });
  const mismatchedSpecial = makeCard('hand-draw', 'draw', { color: 'lime', symbol: 'draw' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, NUMBER_TOP());
  setHands(state, { 'player-1': [plainSpecial, mismatchedSpecial], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', plainSpecial.id), true);
  assert.equal(isLegalPlay(state, 'player-1', mismatchedSpecial.id), true);

  const played = applyCommand(state, playCommand(state, 'play-special-on-number', plainSpecial.id));
  assert.equal(played.ok, true);
  assert.equal(played.state.discardPile[played.state.discardPile.length - 1].id, plainSpecial.id);
});

test('RULE-SPECIAL-PLAY-002: social families are also legal from hand while the top card is a Number', () => {
  const state = baseState(2);
  const truth = makeCard('hand-truth', 'truth', { symbol: 'truth' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, NUMBER_TOP());
  setHands(state, { 'player-1': [truth], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', truth.id), true);
});

test('RULE-SPECIAL-PLAY-003: a Special on top of the Play Pile blocks another Special from hand', () => {
  const state = baseState(2);
  const reverse = makeCard('hand-reverse', 'reverse', { symbol: 'reverse' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, SPECIAL_TOP());
  setHands(state, { 'player-1': [reverse], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', reverse.id), false);

  const blocked = applyCommand(state, playCommand(state, 'stack-special-on-special', reverse.id));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error?.code, 'ILLEGAL_PLAY');
});

test('RULE-SPECIAL-PLAY-004: a legally matching Number is playable on a Special top', () => {
  const state = baseState(2);
  const matchingNumber = makeCard('hand-number', 'number', { color: 'orange', value: 2, symbol: '2' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, SPECIAL_TOP());
  state.activeColor = 'orange';
  setHands(state, { 'player-1': [matchingNumber], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', matchingNumber.id), true);
  const played = applyCommand(state, playCommand(state, 'play-number-on-special', matchingNumber.id));
  assert.equal(played.ok, true);
});

test('RULE-SPECIAL-PLAY-004 / RULE-VOLUNTARY-DRAW-002: Draw is available on a Special top', () => {
  const state = baseState(2);
  const reverse = makeCard('hand-reverse', 'reverse', { symbol: 'reverse' });

  state.currentPlayerId = 'player-1';
  state.drawPile = [makeCard('drawn', 'number', { color: 'purple', value: 4, symbol: '4' })];
  setTopDiscard(state, SPECIAL_TOP());
  setHands(state, { 'player-1': [reverse], 'player-2': [] });

  const result = applyCommand(state, drawCommand(state, 'draw-on-special-top'));
  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].hand.length, 2);
});

test('RULE-VOLUNTARY-DRAW-001: a player holding a legal Number may still draw', () => {
  const state = baseState(2);
  const legalNumber = makeCard('hand-number', 'number', { color: 'orange', value: 9, symbol: '9' });

  state.currentPlayerId = 'player-1';
  state.drawPile = [makeCard('drawn', 'number', { color: 'purple', value: 4, symbol: '4' })];
  setTopDiscard(state, makeCard('top-number', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, { 'player-1': [legalNumber], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', legalNumber.id), true);
  const result = applyCommand(state, drawCommand(state, 'draw-with-legal-number'));
  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].hand.length, 2);
});

test('RULE-VOLUNTARY-DRAW-001: a player holding a legal Special may still draw', () => {
  const state = baseState(2);
  const legalSpecial = makeCard('hand-reverse', 'reverse', { symbol: 'reverse' });

  state.currentPlayerId = 'player-1';
  state.drawPile = [makeCard('drawn', 'number', { color: 'purple', value: 4, symbol: '4' })];
  setTopDiscard(state, makeCard('top-number', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, { 'player-1': [legalSpecial], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', legalSpecial.id), true);
  const result = applyCommand(state, drawCommand(state, 'draw-with-legal-special'));
  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].hand.length, 2);
});

test('RULE-VOLUNTARY-DRAW-003/004: an ordinary voluntary draw ends the turn and the hand-play opportunity', () => {
  const state = baseState(3);
  const legalNumber = makeCard('hand-number', 'number', { color: 'orange', value: 9, symbol: '9' });

  state.currentPlayerId = 'player-1';
  state.drawPile = [makeCard('drawn', 'number', { color: 'purple', value: 4, symbol: '4' })];
  setTopDiscard(state, makeCard('top-number', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, { 'player-1': [legalNumber], 'player-2': [], 'player-3': [] });

  const draw = applyCommand(state, drawCommand(state, 'voluntary-draw-ordinary'));
  assert.equal(draw.ok, true);
  assert.equal(draw.state.players[0].hand.length, 2, 'the drawn card is added to hand');
  assert.equal(draw.state.currentPlayerId, 'player-2', 'the turn advanced');
  assert.equal(draw.state.revision, state.revision + 1);

  // The drawer tries to play from their own hand for the same turn: the opportunity is over.
  const laterPlay = applyCommand(draw.state, {
    ...playCommand(draw.state, 'play-after-voluntary-draw', legalNumber.id),
    playerId: 'player-1',
    expectedRevision: draw.state.revision
  });
  assert.equal(laterPlay.ok, false, 'no normal hand play follows a committed voluntary draw');
  assert.equal(laterPlay.error?.code, 'NOT_YOUR_TURN');
});

test('RULE-VOLUNTARY-DRAW-005: a voluntarily drawn forced-on-draw card enters its flow immediately and restores no hand play', () => {
  const state = baseState(2);
  const forced = makeCard('drawn-truth', 'truth', { symbol: 'truth' });
  const legalNumber = makeCard('hand-number', 'number', { color: 'orange', value: 9, symbol: '9' });

  state.currentPlayerId = 'player-1';
  state.drawPile = [forced];
  setTopDiscard(state, makeCard('top-number', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, { 'player-1': [legalNumber], 'player-2': [] });

  const draw = applyCommand(state, drawCommand(state, 'voluntary-draw-forced'));
  assert.equal(draw.ok, true);
  assert.equal(draw.state.players[0].hand.some(card => card.id === forced.id), false, 'the forced card is not retained in hand');
  assert.equal(draw.state.discardPile[draw.state.discardPile.length - 1].id, forced.id, 'it entered the Play Pile through its forced flow');
  assert.ok(draw.state.social, 'the forced interaction began immediately');
  assert.ok(draw.events.some(event => event.type === 'SOCIAL_CARD_TRIGGERED'), 'the forced interaction event was emitted');

  const laterPlay = applyCommand(draw.state, playCommand(draw.state, 'play-after-forced-draw', legalNumber.id));
  assert.equal(laterPlay.ok, false, 'no normal hand-play opportunity is restored');
});

test('RULE-SPECIAL-PLAY-005: initial-deal Specials stay dormant in hand and later follow Special stacking legality', () => {
  const players = [{ id: 'player-1', seat: 0 }, { id: 'player-2', seat: 1 }];
  const state = unwrap(createGame({ seed: 'initial-deal-dormancy-seed' }, players, undefined, { now: 1_000_000 }));

  assert.equal(state.social, null, 'nothing auto-triggered during setup');
  const dealtSpecial = state.players.flatMap(player => player.hand).find(card => card.kind !== 'number');
  assert.ok(dealtSpecial, 'the opening deal contains at least one Special card');
  const owner = state.players.find(player => player.hand.some(card => card.id === dealtSpecial.id))!;
  assert.equal(state.status, 'ACTIVE');

  state.currentPlayerId = owner.id;
  setTopDiscard(state, NUMBER_TOP());
  assert.equal(isLegalPlay(state, owner.id, dealtSpecial.id), !['nope'].includes(dealtSpecial.kind));
  setTopDiscard(state, SPECIAL_TOP());
  assert.equal(isLegalPlay(state, owner.id, dealtSpecial.id), false);
});

test('RULE-SPECIAL-PLAY-007: Nope remains reaction-only and is never a normal-turn hand play', () => {
  const state = baseState(2);
  const nope = makeCard('hand-nope', 'nope', { symbol: 'nope' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, NUMBER_TOP());
  setHands(state, { 'player-1': [nope], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', nope.id), false);
  const attempted = applyCommand(state, playCommand(state, 'play-nope-on-turn', nope.id));
  assert.equal(attempted.ok, false);
  assert.equal(attempted.error?.code, 'ILLEGAL_PLAY');

  setTopDiscard(state, makeCard('top-nope', 'nope', { symbol: 'nope' }));
  assert.equal(isLegalPlay(state, 'player-1', nope.id), false, 'a Nope top does not open Nope play either');
});

test('RULE-NUMBER-002: Number matching by color or value is unchanged', () => {
  const state = baseState(2);
  const sameColor = makeCard('same-color', 'number', { color: 'orange', value: 9, symbol: '9' });
  const sameValue = makeCard('same-value', 'number', { color: 'purple', value: 6, symbol: '6' });
  const noMatch = makeCard('no-match', 'number', { color: 'lime', value: 3, symbol: '3' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, NUMBER_TOP());
  setHands(state, { 'player-1': [sameColor, sameValue, noMatch], 'player-2': [] });

  assert.equal(isLegalPlay(state, 'player-1', sameColor.id), true);
  assert.equal(isLegalPlay(state, 'player-1', sameValue.id), true);
  assert.equal(isLegalPlay(state, 'player-1', noMatch.id), false);
});

test('RULE-SPECIAL-PLAY-008: the Special-on-Special test uses the actual top Play Pile card, not carried-over symbol state', () => {
  const state = baseState(2);
  const reverse = makeCard('hand-reverse', 'reverse', { symbol: 'reverse' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, SPECIAL_TOP());
  state.activeSymbol = 'reverse';
  state.activeColor = 'orange';
  setHands(state, { 'player-1': [reverse], 'player-2': [] });
  assert.equal(isLegalPlay(state, 'player-1', reverse.id), false, 'the Special top governs even when the carried symbol matches');

  const numberTopState = baseState(2);
  numberTopState.currentPlayerId = 'player-1';
  setTopDiscard(numberTopState, NUMBER_TOP());
  numberTopState.activeSymbol = '6';
  setHands(numberTopState, { 'player-1': [makeCard('hand-reverse-2', 'reverse', { symbol: 'reverse' })], 'player-2': [] });
  assert.equal(isLegalPlay(numberTopState, 'player-1', 'hand-reverse-2'), true, 'a Number top re-opens Special play');
});

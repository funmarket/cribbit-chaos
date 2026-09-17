import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameCommand, GameState, GameTransition, SocialPrompt } from '@cribbit/contracts';
import { promptDefinitions } from '@cribbit/prompts';
import { applyCommand, createGame, projectDecisionCapabilities } from '../src/index.ts';

function unwrap<T>(transition: GameTransition<T>): T {
  if (!transition.ok) throw transition.error ?? new Error('Expected transition to succeed.');
  return transition.state;
}

function makeCard(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return { id, kind, ...fields } as Card;
}

function baseState(seed = 'bot-capabilities-test'): GameState {
  return unwrap(createGame(
    { seed, startingHandCount: 0, startingPlayerIndex: 0, allowVoluntaryDraw: true, contentWorld: 'UNDER_18_CLEAN' },
    [{ id: 'p1', seat: 0 }, { id: 'p2', seat: 1 }, { id: 'p3', seat: 2 }],
    undefined,
    { now: 1000 }
  ));
}

function setTopDiscard(state: GameState, card: Card): void {
  state.discardPile = [card];
  state.activeColor = card.color ?? null;
  state.activeSymbol = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : card.symbol ?? card.kind;
}

function play(state: GameState, cardId: string): GameState {
  const transition = applyCommand(
    state,
    {
      type: 'PLAY_CARD',
      commandId: `play-${state.revision}-${cardId}`,
      playerId: state.currentPlayerId,
      expectedRevision: state.revision,
      sessionId: state.id,
      cardId
    },
    { now: 1100, promptPool: promptDefinitions, promptProfile: { stage: Number.MAX_SAFE_INTEGER, intensity: Number.MAX_SAFE_INTEGER, language: '*', callSuitability: '*' } }
  );
  return unwrap(transition);
}

function assertAdvertisedOptionsAreAccepted(state: GameState, playerId: string): void {
  const capabilities = projectDecisionCapabilities(state, playerId);
  for (const option of capabilities.options) {
    const accepted = applyCommand(
      state,
      option.command,
      { now: 1200, promptPool: promptDefinitions, promptProfile: { stage: Number.MAX_SAFE_INTEGER, intensity: Number.MAX_SAFE_INTEGER, language: '*', callSuitability: '*' } }
    );
    assert.equal(accepted.ok, true, `${option.optionId} should be accepted, got ${accepted.error?.code ?? 'unknown error'}`);
  }
}

test('active player receives server-derived playable-card and draw options only from legal commands', () => {
  const state = baseState();
  setTopDiscard(state, makeCard('discard-lime-7', 'number', { color: 'lime', value: 7, symbol: '7' }));
  state.players[0].hand = [
    makeCard('lime-2', 'number', { color: 'lime', value: 2, symbol: '2' }),
    makeCard('cyan-9', 'number', { color: 'cyan', value: 9, symbol: '9' }),
    makeCard('truth-1', 'truth', { symbol: 'truth' })
  ];

  const capabilities = projectDecisionCapabilities(state, 'p1');

  assert.equal(capabilities.requiredAction, 'PLAY_OR_DRAW');
  assert.deepEqual(capabilities.options.map(option => option.presentation.category).sort(), ['DRAW_CARD', 'PLAY_CARD', 'PLAY_CARD']);
  assert.deepEqual(capabilities.options.map(option => option.optionId).sort(), ['draw:p1', 'play:lime-2', 'play:truth-1']);
  assert.equal(capabilities.options.some(option => option.optionId === 'play:cyan-9'), false);
  assertAdvertisedOptionsAreAccepted(state, 'p1');
});

test('wild color pending state advertises only legal color commands to the owning player', () => {
  let state = baseState('bot-capabilities-wild');
  state.players[0].hand = [makeCard('wild-1', 'wild', { symbol: 'wild' })];
  state = play(state, 'wild-1');

  const ownerCapabilities = projectDecisionCapabilities(state, 'p1');
  const otherCapabilities = projectDecisionCapabilities(state, 'p2');

  assert.equal(ownerCapabilities.requiredAction, 'CHOOSE_COLOR');
  assert.deepEqual(ownerCapabilities.options.map(option => option.optionId).sort(), ['color:cyan', 'color:lime', 'color:orange', 'color:purple']);
  assert.equal(otherCapabilities.requiredAction, null);
  assert.deepEqual(otherCapabilities.options, []);
  assertAdvertisedOptionsAreAccepted(state, 'p1');
});

test('truth flow advertises completion-only answer commands instead of bot speech fabrication', () => {
  let state = baseState('bot-capabilities-truth');
  state.players[0].hand = [makeCard('truth-1', 'truth', { symbol: 'truth' })];
  state = play(state, 'truth-1');

  let capabilities = projectDecisionCapabilities(state, 'p1');
  assert.equal(capabilities.requiredAction, 'SELECT_ANSWER_MODE');
  assert.deepEqual(capabilities.options.map(option => option.optionId), ['answer-mode:ANSWERED_LIVE']);
  assertAdvertisedOptionsAreAccepted(state, 'p1');

  state = unwrap(applyCommand(state, capabilities.options[0].command, { now: 1300, promptPool: promptDefinitions }));
  capabilities = projectDecisionCapabilities(state, 'p1');
  assert.equal(capabilities.requiredAction, 'SUBMIT_COMPLETION');
  assert.deepEqual(capabilities.options.map(option => option.command.type), ['MARK_ANSWERED_LIVE']);
  assertAdvertisedOptionsAreAccepted(state, 'p1');
});

test('duel flow advertises target, participant completion, and eligible voter commands', () => {
  let state = baseState('bot-capabilities-duel');
  state.players[0].hand = [makeCard('duel-1', 'duel', { symbol: 'duel' })];
  state = play(state, 'duel-1');

  let capabilities = projectDecisionCapabilities(state, 'p1');
  assert.equal(capabilities.requiredAction, 'SELECT_TARGET');
  assert.deepEqual(capabilities.options.map(option => option.optionId).sort(), ['target:p2', 'target:p3']);
  assertAdvertisedOptionsAreAccepted(state, 'p1');

  state = unwrap(applyCommand(state, capabilities.options.find(option => option.optionId === 'target:p2')!.command, { now: 1300, promptPool: promptDefinitions }));
  capabilities = projectDecisionCapabilities(state, 'p1');
  assert.equal(capabilities.requiredAction, 'SUBMIT_COMPLETION');
  assert.deepEqual(capabilities.options.map(option => option.command.type), ['SUBMIT_DUEL_RESPONSE']);
  assertAdvertisedOptionsAreAccepted(state, 'p1');

  state = unwrap(applyCommand(state, capabilities.options[0].command, { now: 1400, promptPool: promptDefinitions }));
  capabilities = projectDecisionCapabilities(state, 'p2');
  assert.equal(capabilities.requiredAction, 'SUBMIT_COMPLETION');
  assert.deepEqual(capabilities.options.map(option => option.command.type), ['SUBMIT_DUEL_RESPONSE']);
  assertAdvertisedOptionsAreAccepted(state, 'p2');

  state = unwrap(applyCommand(state, capabilities.options[0].command, { now: 1500, promptPool: promptDefinitions }));
  capabilities = projectDecisionCapabilities(state, 'p3');
  assert.equal(capabilities.requiredAction, 'CAST_VOTE');
  assert.deepEqual(capabilities.options.map(option => option.optionId).sort(), ['vote:p1', 'vote:p2']);
  assertAdvertisedOptionsAreAccepted(state, 'p3');
});

test('phase-2B special families are advertised as playable bot options', () => {
  const state = baseState('bot-capabilities-unresolved');
  setTopDiscard(state, makeCard('discard-lime-7', 'number', { color: 'lime', value: 7, symbol: '7' }));
  state.players[0].hand = [
    makeCard('tag-1', 'tag', { symbol: 'tag' }),
    makeCard('truth-or-chaos-1', 'truth_or_chaos', { symbol: 'truth_or_chaos' }),
    makeCard('hijack-1', 'hijack', { symbol: 'hijack' }),
    makeCard('taboo-1', 'taboo', { symbol: 'taboo' }),
    makeCard('machiavelli-1', 'machiavelli', { symbol: 'machiavelli' }),
    makeCard('reverse-confession-1', 'reverse_confession', { symbol: 'reverse_confession' }),
    makeCard('dig-me-1', 'dig_me', { symbol: 'dig_me' })
  ];

  const capabilities = projectDecisionCapabilities(state, 'p1');

  assert.equal(capabilities.requiredAction, 'PLAY_OR_DRAW');
  assert.deepEqual(capabilities.options.map(option => option.optionId), ['play:tag-1', 'play:truth-or-chaos-1', 'play:hijack-1', 'play:taboo-1', 'play:machiavelli-1', 'play:reverse-confession-1', 'play:dig-me-1', 'draw:p1']);
  assertAdvertisedOptionsAreAccepted(state, 'p1');
});

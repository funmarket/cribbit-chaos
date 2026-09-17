import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameCommand, GameCommandType, GameState, GameTransition, SocialPrompt } from '@cribbit/contracts';
import { applyCommand, createGame, projectDecisionCapabilities } from '../src/index.ts';

function makeCard(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return { id, kind, ...fields } as Card;
}

function unwrap<T>(transition: GameTransition<T>): T {
  if (!transition.ok) throw transition.error ?? new Error('Expected transition to succeed.');
  return transition.state;
}

function baseState(seed: string): GameState {
  return unwrap(createGame({ seed, startingHandCount: 0, startingPlayerIndex: 0, allowVoluntaryDraw: true }, [
    { id: 'player-1', seat: 0 },
    { id: 'player-2', seat: 1 },
    { id: 'player-3', seat: 2 }
  ], undefined, { now: 1000 }));
}

function setPlayableDiscard(state: GameState): void {
  state.discardPile = [makeCard('discard-lime-1', 'number', { color: 'lime', value: 1, symbol: '1' })];
  state.activeColor = 'lime';
  state.activeSymbol = '1';
}

function command(state: GameState, playerId: string, type: GameCommandType, fields: Partial<GameCommand> = {}): GameCommand {
  return {
    commandId: `${type}:${state.revision}:${playerId}:${JSON.stringify(fields)}`,
    playerId,
    expectedRevision: state.revision,
    sessionId: state.id,
    type,
    ...fields
  } as GameCommand;
}

function prompt(kind: SocialPrompt['kind'], targeting: SocialPrompt['targeting']): SocialPrompt {
  return {
    id: `${kind}-${targeting}`,
    kind,
    text: `${kind} ${targeting} prompt`,
    world: 'UNDER_18_CLEAN',
    stage: 0,
    groupSizeMin: 2,
    groupSizeMax: 10,
    intensity: 0,
    language: '*',
    callSuitability: '*',
    targeting,
    authorshipMode: 'SIGNED',
    destination: 'room'
  };
}

const promptPool = [
  prompt('truth', 'specific'),
  prompt('dare', 'specific'),
  prompt('reverse_confession', 'specific'),
  prompt('taboo', 'specific'),
  prompt('dig_me', 'specific')
];

function playOnlyCard(kind: Card['kind']): GameState {
  let state = baseState(`corrected-${kind}`);
  setPlayableDiscard(state);
  state.players[0].hand = [makeCard(`${kind}-card`, kind, { symbol: kind })];
  return unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: `${kind}-card` }), { now: 1100, promptPool }));
}

test('Truth is target-first: actor chooses another player before selected target answers', () => {
  let state = playOnlyCard('truth');

  assert.equal(state.social?.cardKind, 'truth');
  assert.equal(state.social?.pendingTargetId, null);
  assert.deepEqual(state.social?.pendingTargetIds.sort(), ['player-2', 'player-3']);
  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, 'SELECT_TARGET');
  assert.equal(projectDecisionCapabilities(state, 'player-2').requiredAction, null);

  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_SOCIAL_TARGET', { targetId: 'player-2' }), { now: 1200, promptPool }));
  assert.equal(state.social?.pendingTargetId, 'player-2');
  assert.equal(state.social?.prompt?.kind, 'truth');
  assert.equal(state.social?.promptSelection?.selection.targeting, 'specific');
  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, null);
  assert.equal(projectDecisionCapabilities(state, 'player-2').requiredAction, 'SELECT_ANSWER_MODE');
});

test('Reverse Confession is target-first and completed by the selected target, not the actor', () => {
  let state = playOnlyCard('reverse_confession');

  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, 'SELECT_TARGET');
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_SOCIAL_TARGET', { targetId: 'player-3' }), { now: 1200, promptPool }));

  assert.equal(state.social?.pendingTargetId, 'player-3');
  assert.equal(state.social?.prompt?.kind, 'reverse_confession');
  assert.equal(state.social?.promptSelection?.selection.targeting, 'specific');
  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, null);
  assert.equal(projectDecisionCapabilities(state, 'player-3').requiredAction, 'SELECT_ANSWER_MODE');
});

test('TAG target draws exactly one real card and does not receive a bonus play action', () => {
  let state = baseState('corrected-tag');
  setPlayableDiscard(state);
  state.players[0].hand = [makeCard('tag-card', 'tag', { symbol: 'tag' })];
  state.drawPile = [makeCard('drawn-number', 'number', { color: 'cyan', value: 4, symbol: '4' })];
  const beforeTargetHand = state.players[1].hand.length;

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'tag-card' }), { now: 1100, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_SOCIAL_TARGET', { targetId: 'player-2' }), { now: 1200, promptPool }));

  assert.equal(state.players.find(player => player.id === 'player-2')?.hand.length, beforeTargetHand + 1);
  assert.equal(state.players.find(player => player.id === 'player-2')?.hand.at(-1)?.id, 'drawn-number');
  assert.notEqual(state.currentPlayerId, 'player-2');
  assert.equal(state.social, null);
});

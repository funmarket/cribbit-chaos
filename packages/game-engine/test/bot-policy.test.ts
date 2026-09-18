import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Card, CardKind, GameCommand, GameState, GameTransition } from '@cribbit/contracts';
import { applyCommand, chooseBotOption, createGame, projectDecisionCapabilities } from '../src/index.ts';
import { promptDefinitions } from '@cribbit/prompts';

function unwrap<T>(transition: GameTransition<T>): T {
  if (!transition.ok) throw transition.error ?? new Error('Expected transition to succeed.');
  return transition.state;
}

function makeCard(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return { id, kind, ...fields } as Card;
}

function baseState(seed = 'bot-policy-test', players = [{ id: 'human-1', seat: 0 }, { id: 'bot:test:1', seat: 1 }, { id: 'human-2', seat: 2 }, { id: 'bot:test:2', seat: 3 }]): GameState {
  return unwrap(createGame(
    { seed, startingHandCount: 0, startingPlayerIndex: 1, allowVoluntaryDraw: true, contentWorld: 'UNDER_18_CLEAN' },
    players,
    undefined,
    { now: 1000 }
  ));
}

function context(now = 1200) {
  return { now, promptPool: promptDefinitions, promptProfile: { stage: Number.MAX_SAFE_INTEGER, intensity: Number.MAX_SAFE_INTEGER, language: '*', callSuitability: '*' } };
}

function applyOrThrow(state: GameState, command: GameCommand, now = 1200): GameState {
  const result = applyCommand(state, command, context(now));
  assert.equal(result.ok, true, `${command.type} should be accepted, got ${result.error?.code ?? 'unknown error'}: ${result.error?.message ?? ''}`);
  return result.state;
}

function playOnlyCard(state: GameState, playerId: string): GameState {
  const capabilities = projectDecisionCapabilities(state, playerId);
  const option = capabilities.options.find(item => item.presentation.category === 'PLAY_CARD') ?? capabilities.options[0];
  assert.ok(option, `expected a legal option for ${playerId}`);
  return applyOrThrow(state, option.command);
}

function advanceBotActions(state: GameState, maxSteps = 80): GameState {
  for (let step = 0; step < maxSteps; step += 1) {
    const botWithAction = state.players
      .map(player => player.id)
      .find(playerId => playerId.startsWith('bot:') && projectDecisionCapabilities(state, playerId).options.length > 0);
    if (!botWithAction) return state;
    const decision = chooseBotOption(state, botWithAction, projectDecisionCapabilities(state, botWithAction), { isBotPlayerId: id => id.startsWith('bot:') });
    assert.equal(decision.kind, 'command', `expected bot command for ${botWithAction}`);
    if (decision.kind !== 'command') return state;
    state = applyOrThrow(state, decision.option.command, 1300 + step);
  }
  assert.fail('bot policy did not settle within maxSteps');
}

test('BotPolicy chooses only a server-projected reducer-accepted option', () => {
  const state = baseState();
  state.discardPile = [makeCard('discard-lime-1', 'number', { color: 'lime', value: 1, symbol: '1' })];
  state.activeColor = 'lime';
  state.activeSymbol = '1';
  state.players[1].hand = [
    makeCard('bot-lime-3', 'number', { color: 'lime', value: 3, symbol: '3' }),
    makeCard('bot-cyan-8', 'number', { color: 'cyan', value: 8, symbol: '8' })
  ];

  const capabilities = projectDecisionCapabilities(state, 'bot:test:1');
  const decision = chooseBotOption(state, 'bot:test:1', capabilities);

  assert.equal(decision.kind, 'command');
  assert.equal(capabilities.options.includes(decision.kind === 'command' ? decision.option : capabilities.options[0]), true);
  const applied = applyCommand(state, decision.kind === 'command' ? decision.option.command : capabilities.options[0].command, context());
  assert.equal(applied.ok, true);
});

test('BotPolicy prefers human targets when several legal targets exist', () => {
  let state = baseState('bot-policy-human-target');
  state.players[1].hand = [makeCard('duel-1', 'duel', { symbol: 'duel' })];
  state = applyOrThrow(state, {
    type: 'PLAY_CARD',
    commandId: 'play-duel',
    playerId: 'bot:test:1',
    expectedRevision: state.revision,
    sessionId: state.id,
    cardId: 'duel-1'
  });

  const capabilities = projectDecisionCapabilities(state, 'bot:test:1');
  const decision = chooseBotOption(state, 'bot:test:1', capabilities, { isBotPlayerId: id => id.startsWith('bot:') });

  assert.equal(decision.kind, 'command');
  if (decision.kind === 'command') {
    assert.equal(decision.option.presentation.category, 'TARGET');
    assert.equal(decision.option.presentation.targetPlayerId?.startsWith('human-'), true);
  }
});

test('BotPolicy prefers human targets for TAG, Hijack, Taboo, and DIG ME', () => {
  for (const kind of ['tag', 'hijack', 'taboo', 'dig_me'] as const) {
    let state = baseState(`bot-policy-human-target-${kind}`);
    state.players[1].hand = [makeCard(`${kind}-1`, kind, { symbol: kind })];
    state.currentPlayerId = 'bot:test:1';
    state = playOnlyCard(state, 'bot:test:1');
    const decision = chooseBotOption(state, 'bot:test:1', projectDecisionCapabilities(state, 'bot:test:1'), { isBotPlayerId: id => id.startsWith('bot:') });
    assert.equal(decision.kind, 'command');
    if (decision.kind === 'command') {
      assert.equal(decision.option.presentation.category, 'TARGET');
      assert.equal(decision.option.presentation.targetPlayerId?.startsWith('human-'), true, `${kind} should target a human first`);
    }
  }
});

test('bots settle every forced social/special family without inventing illegal commands', () => {
  const specialFamilies: readonly CardKind[] = ['truth', 'dare', 'chaos', 'paranoia', 'duel', 'tag', 'truth_or_chaos', 'hijack', 'taboo', 'machiavelli', 'reverse_confession', 'dig_me'];

  for (const kind of specialFamilies) {
    let state = baseState(`bot-policy-settle-${kind}`, [
      { id: 'bot:test:1', seat: 0 },
      { id: 'bot:test:2', seat: 1 },
      { id: 'bot:test:3', seat: 2 },
      { id: 'bot:test:4', seat: 3 }
    ]);
    state.currentPlayerId = 'bot:test:1';
    state.discardPile = [makeCard('discard-lime-1', 'number', { color: 'lime', value: 1, symbol: '1' })];
    state.activeColor = 'lime';
    state.activeSymbol = '1';
    state.players[0].hand = [makeCard(`${kind}-1`, kind, { symbol: kind })];
    state.currentPlayerId = 'bot:test:1';

    state = playOnlyCard(state, 'bot:test:1');
    state = advanceBotActions(state);

    if (kind === 'truth_or_chaos') {
      assert.equal(state.social?.cardKind, 'truth_or_chaos');
      assert.equal(state.social?.groupPunishmentPending, true);
    } else {
      assert.equal(state.social, null, `${kind} should not leave bots stuck in an unresolved social flow`);
    }
    assert.equal(state.pendingEffect, null, `${kind} should not leave bots stuck in a pending effect`);
    assert.ok(['ACTIVE', 'FINISHED'].includes(state.status), `${kind} should keep a valid game status after bot settlement`);
  }
});

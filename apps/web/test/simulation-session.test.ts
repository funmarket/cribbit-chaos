import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isLegalPlay } from '../../../packages/game-engine/src/index.ts';
import { createWebSimulation, type WebSimulationSession } from '../src/simulation-session.ts';

// Regression guard for the Local QA Simulation path (SIM-1). The Web must be able to
// start an ephemeral engine-backed simulation with no Live room, no API call and no
// database row, and the human must be able to play and draw through the shared engine.

const CONFIG = {
  playerCount: 5,
  profileName: 'QA Tester',
  world: 'clean' as const,
  ceiling: 3,
  sources: { original: true, community: true, house: true, live: true },
  seed: 'sim-1-focused',
};

function handOf(sim: WebSimulationSession, playerId: string) {
  const player = sim.getState().players.find(item => item.id === playerId);
  assert.ok(player, `expected player ${playerId}`);
  return player.hand;
}

function playFirstLegalCard(sim: WebSimulationSession) {
  const state = sim.getState();
  const legal = handOf(sim, sim.humanPlayerId).find(card => isLegalPlay(state, sim.humanPlayerId, card.id));
  assert.ok(legal, 'expected the human to hold at least one legal card');
  return legal;
}

test('starts an engine-dealt local simulation with bots and ephemeral state', () => {
  const sim = createWebSimulation(CONFIG);
  const state = sim.getState();

  assert.equal(sim.players.length, 5);
  assert.equal(sim.players.filter(player => player.isHuman).length, 1);
  assert.equal(sim.players[0].id, sim.humanPlayerId);
  assert.equal(sim.players[0].name, 'QA Tester');
  assert.deepEqual(sim.players.slice(1).map(player => player.name), ['Player 2', 'Player 3', 'Player 4', 'Player 5']);

  assert.equal(state.players.length, 5);
  assert.equal(state.status, 'ACTIVE');
  assert.equal(state.currentPlayerId, sim.humanPlayerId);
  for (const player of state.players) assert.equal(player.hand.length, 7);
  assert.ok(state.drawPile.length > 0, 'expected an engine-built draw pile');
  assert.ok(state.discardPile.length > 0, 'expected an engine-built discard pile');

  // Local simulation players are not Live users and never fabricate bot:<sessionId> seats.
  for (const player of state.players) assert.equal(player.id.startsWith('bot:'), false);

  for (const card of handOf(sim, sim.humanPlayerId)) assert.ok(card.id && card.kind, 'expected real engine cards');
});

test('a legal human PLAY_CARD resolves through the shared engine and updates state', () => {
  const sim = createWebSimulation(CONFIG);
  const card = playFirstLegalCard(sim);
  const before = sim.getState();
  const handBefore = before.players.find(player => player.id === sim.humanPlayerId)!.hand.length;
  const discardBefore = before.discardPile.length;

  const transition = sim.playCard(card.id);
  assert.equal(transition.ok, true, 'expected the shared engine to accept a legal play');

  const after = sim.getState();
  assert.ok(after.revision > before.revision, 'expected the revision to advance');
  assert.equal(after.players.find(player => player.id === sim.humanPlayerId)!.hand.length, handBefore - 1);
  assert.ok(after.discardPile.length > discardBefore, 'expected the played card on the discard pile');
});

test('a legal human DRAW_CARD resolves through the shared engine', () => {
  const sim = createWebSimulation(CONFIG);
  const handBefore = handOf(sim, sim.humanPlayerId).length;
  const revisionBefore = sim.getState().revision;

  const transition = sim.drawCard();
  assert.equal(transition.ok, true, 'expected the shared engine to accept a legal draw');

  const after = sim.getState();
  assert.ok(after.revision > revisionBefore);
  assert.equal(handOf(sim, sim.humanPlayerId).length, handBefore + 1);
});

test('bots complete ordinary turns through the shared bot policy', () => {
  const sim = createWebSimulation(CONFIG);
  const before = sim.getState();
  const botHandBefore = new Map(before.players
    .filter(player => player.id !== sim.humanPlayerId)
    .map(player => [player.id, player.hand.length]));
  const revisionBefore = before.revision;

  const transition = sim.playCard(playFirstLegalCard(sim).id);
  assert.equal(transition.ok, true);

  const after = sim.getState();
  assert.ok(after.revision >= revisionBefore + 2, 'expected at least one automated bot action after the human play');

  const botActed = after.players
    .filter(player => player.id !== sim.humanPlayerId)
    .some(player => player.hand.length !== botHandBefore.get(player.id));
  assert.equal(botActed, true, 'expected a bot to play or draw during the automated turns');
});

test('the simulation keeps game authority in the shared engine and owns no persistence', () => {
  const source = readFileSync(new URL('../src/simulation-session.ts', import.meta.url), 'utf8');

  for (const forbidden of [
    'api-client',
    'CribbitRealtimeClient',
    'fetch(',
    'legacy-runtime',
    'canonical-game-runtime',
    'game_sessions',
    'room_members',
    'INSERT INTO',
  ]) {
    assert.equal(source.includes(forbidden), false, `simulation must not reference ${forbidden}`);
  }

  assert.equal(source.includes("from '../../../packages/game-engine/src/index.ts'"), true);
});

import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isLegalPlay } from '../../game-engine/src/index.ts';
import {
  SIMULATION_DEFAULT_HAND_SIZE,
  SIMULATION_HUMAN_PLAYER_ID,
  SIMULATION_QA_HAND_KINDS,
  createSimulation,
  isSimulationFixtureCardId,
  type SimulationSession,
} from '../src/index.ts';

// SIMSHARE-1: one shared Simulation orchestrator for both frontends. The invariant under
// test is that orchestration is shared while mechanics stay in packages/game-engine and
// presentation stays in each client.

const CONFIG = {
  playerCount: 5,
  humanDisplayName: 'QA Tester',
  world: 'clean' as const,
  ceiling: 3,
  sources: { original: true, community: true, house: true, live: true },
  seed: 'simshare-1-focused',
};

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

function handOf(sim: SimulationSession, playerId: string) {
  const player = sim.getState().players.find(item => item.id === playerId);
  assert.ok(player, `expected player ${playerId}`);
  return player.hand;
}

function firstLegalCard(sim: SimulationSession) {
  const state = sim.getState();
  const card = handOf(sim, sim.humanPlayerId).find(item => isLegalPlay(state, sim.humanPlayerId, item.id));
  assert.ok(card, 'expected the human to hold at least one legal card');
  return card;
}

test('shared initialization: one human, generic seats, engine deal, seven-card hands', () => {
  const sim = createSimulation(CONFIG);
  const state = sim.getState();

  assert.equal(sim.humanPlayerId, SIMULATION_HUMAN_PLAYER_ID);
  assert.equal(sim.players.length, 5);
  assert.equal(sim.players.filter(player => player.isHuman).length, 1);
  assert.deepEqual(sim.players.map(player => player.id), [
    'sim-human', 'sim-player-2', 'sim-player-3', 'sim-player-4', 'sim-player-5',
  ]);
  assert.deepEqual(sim.players.map(player => player.name), ['QA Tester', 'Player 2', 'Player 3', 'Player 4', 'Player 5']);

  assert.equal(state.players.length, 5);
  assert.equal(state.status, 'ACTIVE');
  assert.equal(state.currentPlayerId, SIMULATION_HUMAN_PLAYER_ID);
  for (const player of state.players) assert.equal(player.hand.length, SIMULATION_DEFAULT_HAND_SIZE);
  assert.ok(state.drawPile.length > 0, 'expected an engine-built draw pile');
  assert.ok(state.discardPile.length > 0, 'expected an engine-built discard pile');

  // Simulation seats are ephemeral fixtures, never fabricated Live users.
  for (const player of state.players) assert.equal(player.id.startsWith('bot:'), false);
});

test('an equal normalized configuration produces equivalent deterministic initialization', () => {
  const first = createSimulation({ ...CONFIG, seed: undefined });
  const second = createSimulation({ ...CONFIG, seed: undefined });

  const shape = (sim: SimulationSession) => {
    const state = sim.getState();
    return JSON.stringify({
      players: state.players.map(player => ({ id: player.id, hand: player.hand.map(card => card.id), kind: player.hand.map(card => card.kind) })),
      drawPile: state.drawPile.length,
      discardPile: state.discardPile.map(card => card.id),
      currentPlayerId: state.currentPlayerId,
      revision: state.revision,
    });
  };

  assert.equal(shape(first), shape(second));
});

test('the canonical QA fixture hand is installed once and stays fixture-identified', () => {
  const normal = createSimulation({ ...CONFIG, qaHand: false });
  const qa = createSimulation({ ...CONFIG, qaHand: true });

  const qaHand = handOf(qa, qa.humanPlayerId);
  assert.deepEqual(qaHand.map(card => card.kind), [...SIMULATION_QA_HAND_KINDS]);
  for (const card of qaHand) assert.equal(isSimulationFixtureCardId(card.id), true, 'QA cards must stay clearly fixture-only');
  for (const card of handOf(normal, normal.humanPlayerId)) assert.equal(isSimulationFixtureCardId(card.id), false);

  // The engine-dealt opening hand goes back to the draw pile; QA cards come from outside it.
  assert.equal(qa.getState().drawPile.length, normal.getState().drawPile.length + SIMULATION_QA_HAND_KINDS.length);
  assert.equal(handOf(qa, qa.humanPlayerId).length, SIMULATION_DEFAULT_HAND_SIZE);
});

test('shared command path: human play and draw resolve through the shared engine', () => {
  const playing = createSimulation(CONFIG);
  const handBefore = handOf(playing, playing.humanPlayerId).length;
  const discardBefore = playing.getState().discardPile.length;

  const card = firstLegalCard(playing);
  const played = playing.playCard(card.id);
  assert.equal(played.ok, true, 'expected the shared engine to accept a legal play');
  assert.ok(playing.getState().discardPile.length > discardBefore, 'expected the played card on the discard pile');
  // Bots act immediately afterwards, so the human card is somewhere in the pile, not on top.
  assert.equal(playing.getState().discardPile.some(item => item.id === card.id), true, 'expected the played card in the discard pile');
  assert.equal(handOf(playing, playing.humanPlayerId).some(item => item.id === card.id), false, 'the played card must leave the human hand');
  assert.ok(handBefore >= 1);

  const drawing = createSimulation(CONFIG);
  const revisionBeforeDraw = drawing.getState().revision;
  const drawHandBefore = handOf(drawing, drawing.humanPlayerId).length;
  assert.equal(drawing.drawCard().ok, true, 'expected the shared engine to accept a draw when it is the human turn');
  assert.ok(drawing.getState().revision > revisionBeforeDraw);
  // The engine may make the human draw again when a bot resolves a draw against them, so
  // only a lower bound is a stable property of the shared path.
  assert.ok(
    handOf(drawing, drawing.humanPlayerId).length >= drawHandBefore + 1,
    'the human hand must grow by at least the drawn card',
  );

  // Legality is never the orchestrator's decision: the engine rejects a card the human does not hold.
  assert.equal(playing.playCard('not-a-real-card').ok, false, 'the engine, not the simulation, decides legality');
});

test('simulation command envelopes are built once for the human and the bots', () => {
  const sim = createSimulation(CONFIG);
  const listeners: number[] = [];
  const unsubscribe = sim.subscribe(() => listeners.push(sim.getState().revision));

  const transition = sim.playCard(firstLegalCard(sim).id);
  assert.equal(transition.ok, true);
  assert.ok(listeners.length >= 1, 'subscribers must be notified after the shared orchestrator applies a command');

  // Every applied command carries the shared envelope: session id, player id, revision.
  const source = readRepoFile('packages/simulation/src/index.ts');
  assert.match(source, /commandId: nextCommandId\(command\.type, playerId\)/);
  assert.match(source, /expectedRevision: state\.revision/);
  assert.match(source, /sessionId: state\.id/);
  unsubscribe();
});

test('bots progress through the shared bot policy, not client automation', () => {
  const sim = createSimulation(CONFIG);
  const before = sim.getState();
  const botHandsBefore = new Map(before.players.filter(player => player.id !== sim.humanPlayerId).map(player => [player.id, player.hand.length]));

  assert.equal(sim.playCard(firstLegalCard(sim).id).ok, true);

  const after = sim.getState();
  assert.ok(after.revision >= before.revision + 2, 'expected automated bot activity after the human play');
  const botActed = after.players
    .filter(player => player.id !== sim.humanPlayerId)
    .some(player => player.hand.length !== botHandsBefore.get(player.id));
  assert.equal(botActed, true, 'expected a bot to play or draw through the shared bot policy');
});

test('the shared orchestrator owns no rules, no transport and no persistence', () => {
  const source = readRepoFile('packages/simulation/src/index.ts');

  for (const forbidden of [
    'api-client',
    'CribbitRealtimeClient',
    'socket.io',
    'fetch(',
    'legacy-runtime',
    'canonical-game-runtime',
    'game_sessions',
    'room_members',
    'INSERT INTO',
  ]) {
    assert.equal(source.includes(forbidden), false, `shared simulation must not reference ${forbidden}`);
  }

  // Mechanics come from the engine, orchestration from this module only.
  assert.match(source, /from '\.\.\/\.\.\/\.\.\/packages\/game-engine\/src\/index\.ts'/);
  for (const engineCall of ['createGame(', 'applyCommand(', 'chooseBotOption(']) {
    assert.equal(source.includes(engineCall), true, `shared simulation must call the engine (${engineCall})`);
  }
  assert.doesNotMatch(source, /function\s+(legal|playCard|drawTurn|finishTurn|confirmWin|scheduleBot|autoBots)\s*\(/);
});

test('simulation performs no network access at all', () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    calls += 1;
    throw new Error('simulation must never perform network access');
  }) as typeof globalThis.fetch;

  try {
    const qa = createSimulation({ ...CONFIG, qaHand: true });
    assert.equal(qa.playCard(firstLegalCard(qa).id).ok, true, 'expected a legal QA-hand play');
    const drawing = createSimulation({ ...CONFIG, qaHand: false });
    assert.equal(drawing.drawCard().ok, true);
    assert.equal(calls, 0, 'a simulation run must never touch the network');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('both clients simulate through the one shared orchestrator and no longer duplicate it', () => {
  const webOwner = readRepoFile('apps/web/src/simulation-mode.ts');
  const telegramOwner = readRepoFile('apps/telegram/src/simulation.ts');

  for (const [label, source] of [['web', webOwner], ['telegram', telegramOwner]] as const) {
    assert.equal(source.includes("packages/simulation/src/index.ts'"), true, `${label} must use the shared Simulation orchestrator`);
    for (const duplicate of ['createGame(', 'applyCommand(', 'chooseBotOption(', 'runAutomatedTurns']) {
      assert.equal(source.includes(duplicate), false, `${label} must not re-implement simulation orchestration (${duplicate})`);
    }
  }

  // The old platform-specific simulation identities and seeds are gone everywhere.
  for (const stale of ['web-sim-human', 'telegram-sim-human', 'web-local-simulation-v1', 'telegram-simulation-v3', 'simulation-session.ts']) {
    for (const [label, source] of [['web', webOwner], ['telegram', telegramOwner]] as const) {
      assert.equal(source.includes(stale), false, `${label} must not keep the superseded simulation detail ${stale}`);
    }
  }

  const webEntry = readRepoFile('apps/web/src/live-entry.ts');
  assert.match(webEntry, /startLocalSimulationMode/);
  const telegramEntry = readRepoFile('apps/telegram/src/bootstrapTelegram.ts');
  assert.match(telegramEntry, /createTelegramSimulationGame/);

  // Live ownership is untouched by the simulation consolidation.
  assert.match(readRepoFile('apps/web/src/live-session.ts'), /packages\/api-client/);
  assert.match(readRepoFile('apps/telegram/src/backendGame.ts'), /packages\/api-client/);
  assert.match(readRepoFile('apps/web/src/main.ts'), /runtimeMode\s*:\s*'none'/);
});

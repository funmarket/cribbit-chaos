import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import type { GameState } from '../../../packages/contracts/src/index.ts';
import { promptSourceById } from '../../../packages/prompts/src/index.ts';
import { createWaitingRoom, getSessionSnapshot, joinWaitingRoom, processSessionCommand, startRoom, updateRoomConfig } from '../src/game-service.ts';
import { pool, registerWebUser } from '../src/db.ts';

// ROOM-CONFIG-1: Start freezes room configuration, and the created session consumes the final
// persisted configuration. Start and config mutation serialize on the same room authority
// (the locked rooms row), so a session can never be created from one configuration while a
// different configuration is committed as current afterwards.
//
// Real PostgreSQL integration tests: skipped without DATABASE_URL.

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const stamp = () => `${Date.now()}`.slice(-9) + Math.floor(Math.random() * 1000);

async function makeUsers(count: number) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const suffix = `${stamp()}${index}`;
    users.push(await registerWebUser({
      loginUsername: `roomrace${suffix}`,
      password: 'RoomRacePass1',
      displayUsername: `roomrace${suffix}`.slice(0, 24),
    }));
  }
  return users;
}

async function cleanup(roomId: string): Promise<void> {
  if (!pool) return;
  await pool.query('delete from game_commands where session_id in (select id from game_sessions where room_id=$1)', [roomId]);
  await pool.query('delete from game_events where session_id in (select id from game_sessions where room_id=$1)', [roomId]);
  await pool.query('delete from game_sessions where room_id=$1', [roomId]);
  await pool.query('delete from room_members where room_id=$1', [roomId]);
  await pool.query('delete from rooms where id=$1', [roomId]);
}

async function sessionWorld(sessionId: string): Promise<string | null> {
  assert.ok(pool);
  const row = await pool.query("select state->'config'->>'contentWorld' as world from game_sessions where id=$1", [sessionId]);
  return (row.rows[0]?.world ?? null) as string | null;
}

function rejectionCode(reason: unknown): string {
  return String((reason as { code?: string })?.code ?? 'UNKNOWN');
}

/** Give the actor a playable Truth card so the real engine path can select a prompt. */
async function armTruthCard(sessionId: string, actorId: string): Promise<string> {
  assert.ok(pool);
  const row = await pool.query('select state from game_sessions where id=$1', [sessionId]);
  const state = row.rows[0].state as GameState;
  const cardId = 'room-config-truth-card';
  state.players = state.players.map(player => (player.id === actorId
    ? { ...player, hand: [{ id: cardId, kind: 'truth', symbol: 'truth', color: 'orange' } as GameState['players'][number]['hand'][number]] }
    : { ...player, hand: [] }));
  state.discardPile = [{ id: 'room-config-starter', kind: 'number', color: 'orange', value: 4, symbol: '4' } as GameState['discardPile'][number]];
  state.currentPlayerId = actorId;
  state.phase = 'PLAY';
  state.status = 'ACTIVE';
  state.social = null;
  state.pendingEffect = null;
  state.winnerId = null;
  await pool.query('update game_sessions set state=$2::jsonb where id=$1', [sessionId, JSON.stringify(state)]);
  return cardId;
}

const command = (state: GameState, sessionId: string, playerId: string, body: Record<string, unknown>) => ({
  sessionId,
  commandId: randomUUID(),
  playerId,
  expectedRevision: state.revision,
  ...body,
} as never);

dbTest('a config update and Start serialize on the room row, and Start always uses the final config', async () => {
  const observations: string[] = [];
  for (let round = 0; round < 6; round += 1) {
    const [owner, second] = await makeUsers(2);
    const room = await createWaitingRoom(owner, { roomName: `Race ${round}`, playerCount: 2 });
    try {
      await joinWaitingRoom(second, room.joinCode);

      const [patched, started] = await Promise.allSettled([
        updateRoomConfig(owner, room.roomId, { world: 'adult' }),
        startRoom(owner, room.roomId),
      ]);

      const patchCode = patched.status === 'fulfilled' ? 'FULFILLED' : rejectionCode(patched.reason);
      const startCode = started.status === 'fulfilled' ? 'FULFILLED' : rejectionCode(started.reason);
      observations.push(`round ${round}: patch=${patchCode} start=${startCode}`);

      if (patched.status === 'fulfilled') {
        // The update committed first, so the session must have been created from the updated config.
        assert.equal(started.status, 'fulfilled', `patch committed but Start failed: ${startCode}`);
        const sessionId = (started as PromiseFulfilledResult<{ sessionId: string }>).value.sessionId;
        assert.equal(
          await sessionWorld(sessionId),
          '18+_ADULT',
          `round ${round}: Start created the session before the committed config was visible`,
        );
        const stored = await pool!.query('select config->>$1 as value from rooms where id=$2', ['world', room.roomId]);
        assert.equal(stored.rows[0].value, 'adult');
      } else {
        // Start won the row lock, so the update must have been refused as frozen config.
        assert.equal(patchCode, 'ROOM_ALREADY_STARTED', `round ${round}: patch must fail when Start won the lock`);
        assert.equal(started.status, 'fulfilled', `round ${round}: Start must still succeed when it won the lock`);
        const sessionId = (started as PromiseFulfilledResult<{ sessionId: string }>).value.sessionId;
        assert.equal(await sessionWorld(sessionId), 'UNDER_18_CLEAN', 'the frozen session keeps the pre-start world');
      }
    } finally {
      await cleanup(room.roomId);
    }
  }
  // At least one of the two orderings must actually have been observed; otherwise the race never
  // exercised a real interleaving and the invariant would be untested.
  assert.ok(observations.some(entry => entry.includes('patch=FULFILLED')), `no patch-first interleaving observed: ${observations.join(' | ')}`);
  assert.ok(observations.some(entry => entry.includes('patch=ROOM_ALREADY_STARTED')), `no start-first interleaving observed: ${observations.join(' | ')}`);
});

dbTest('the created session consumes the final persisted room configuration', async () => {
  const [owner, second, third] = await makeUsers(3);
  const room = await createWaitingRoom(owner, { roomName: 'Consumption', playerCount: 5 });
  try {
    await joinWaitingRoom(second, room.joinCode);
    await joinWaitingRoom(third, room.joinCode);

    await updateRoomConfig(owner, room.roomId, {
      mode: 'squad',
      playerCount: 3,
      world: 'adult',
      ceiling: 1,
      sources: { original: false, community: false, house: false, live: true },
    });

    const started = await startRoom(owner, room.roomId);
    const snapshot = await getSessionSnapshot(owner, started.sessionId);

    // world -> engine content world
    assert.equal(snapshot.state.config.contentWorld, '18+_ADULT');
    // playerCount -> exactly the real room members, no fabricated seats
    assert.equal(snapshot.state.players.length, 3);
    assert.deepEqual(
      snapshot.state.players.map(player => player.id).sort(),
      [owner.id, second.id, third.id].sort(),
    );
    assert.equal(snapshot.state.players.some(player => player.id.startsWith('bot:')), false);

    // sources + ceiling -> the server prompt pool the engine actually selects from
    const cardId = await armTruthCard(started.sessionId, owner.id);
    const played = await processSessionCommand(owner, started.sessionId, command(snapshot.state, started.sessionId, owner.id, { type: 'PLAY_CARD', cardId }));
    assert.equal(played.ok, true, `expected a legal Truth play: ${played.error?.message ?? ''}`);
    const selected = await processSessionCommand(owner, started.sessionId, command(played.state, started.sessionId, owner.id, { type: 'SELECT_SOCIAL_TARGET', targetId: second.id }));
    assert.equal(selected.ok, true, `expected the target selection to resolve a prompt: ${selected.error?.message ?? ''}`);
    const promptId = selected.state.social?.promptSelection?.promptId ?? '';
    assert.ok(promptId, 'the session must record the selected prompt id');
    assert.equal(
      promptSourceById[promptId],
      'live',
      `the final room source map must filter the server prompt pool (selected ${promptId})`,
    );
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('the final room ceiling bounds prompt eligibility, not just the world and sources', async () => {
  const [owner, second, third] = await makeUsers(3);
  const room = await createWaitingRoom(owner, { roomName: 'Ceiling', playerCount: 5 });
  try {
    await joinWaitingRoom(second, room.joinCode);
    await joinWaitingRoom(third, room.joinCode);
    // Adult live-only sources hold exactly one eligible Truth prompt, and it carries intensity 1.
    await updateRoomConfig(owner, room.roomId, {
      mode: 'squad',
      playerCount: 3,
      world: 'adult',
      ceiling: 0,
      sources: { original: false, community: false, house: false, live: true },
    });
    const started = await startRoom(owner, room.roomId);
    const snapshot = await getSessionSnapshot(owner, started.sessionId);
    const cardId = await armTruthCard(started.sessionId, owner.id);
    const played = await processSessionCommand(owner, started.sessionId, command(snapshot.state, started.sessionId, owner.id, { type: 'PLAY_CARD', cardId }));
    const promptId = played.ok
      ? (await processSessionCommand(owner, started.sessionId, command(played.state, started.sessionId, owner.id, { type: 'SELECT_SOCIAL_TARGET', targetId: second.id }))).state.social?.promptSelection?.promptId ?? ''
      : '';
    assert.notEqual(
      promptSourceById[promptId],
      'live',
      'a ceiling of 0 must keep the intensity-1 Live prompt out of eligibility',
    );
  } finally {
    await cleanup(room.roomId);
  }
});

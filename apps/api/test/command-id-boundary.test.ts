import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { AuthUser, GameCommand, GameState } from '../../../packages/contracts/src/index.ts';
import { createSimulation } from '../../../packages/simulation/src/index.ts';
import { isLegalPlay } from '../../../packages/game-engine/src/index.ts';
import { createWaitingRoom, getSessionSnapshot, joinWaitingRoom, processSessionCommand, startRoom } from '../src/game-service.ts';
import { pool, registerWebUser } from '../src/db.ts';

// COMMAND-ID-1: a Live command id is persisted as game_commands.command_id uuid, so the
// application contract must reject anything PostgreSQL cannot store -- before persistence and
// with a deterministic client error, never a raw database error.

const MALFORMED_IDS = ['command-123', 'not-a-uuid', '9b4728a8-d0e8-4014-bef8-486d93faaea7:manual:test'];

function liveCommand(userId: string, sessionId: string, body: Record<string, unknown>): GameCommand {
  return { sessionId, playerId: userId, expectedRevision: 0, ...body } as GameCommand;
}

const viewer = (id: string): AuthUser => ({ id, displayName: 'Command Id', identities: [{ provider: 'web' }] });

test('a malformed Live command id is rejected before any persistence is attempted', async () => {
  // No database is involved: the guard must run before the session is ever looked up, so the
  // failure is the canonical validation error and not SESSION_NOT_FOUND.
  for (const commandId of [...MALFORMED_IDS, '', undefined]) {
    await assert.rejects(
      () => processSessionCommand(viewer('viewer-1'), 'session-does-not-exist', liveCommand('viewer-1', 'session-does-not-exist', { type: 'DRAW_CARD', commandId })),
      (error: { code?: string; statusCode?: number; message?: string }) => {
        assert.equal(error.code, 'INVALID_COMMAND_ENVELOPE');
        assert.equal(error.statusCode, 400);
        assert.equal(/invalid input syntax|22P02|pg_|driver|column/i.test(error.message ?? ''), false, 'no database internals may leak');
        return true;
      },
      `expected ${String(commandId)} to be rejected as an invalid Live command envelope`,
    );
  }
});

test('the shared local Simulation keeps its own in-memory command identity', () => {
  const simulation = createSimulation({ playerCount: 5, humanDisplayName: 'QA', world: 'clean', ceiling: 3, seed: 'command-id-1-simulation' });
  const state = simulation.getState();
  const card = state.players.find(player => player.id === simulation.humanPlayerId)!.hand.find(item => isLegalPlay(state, simulation.humanPlayerId, item.id));
  assert.ok(card, 'expected a legal card');
  assert.equal(simulation.playCard(card.id).ok, true, 'Simulation must not be forced through the Live UUID contract');
});

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const stamp = () => String(Date.now()).slice(-9);

async function liveFixture() {
  const [owner, opponent] = await Promise.all(['a', 'b'].map(suffix => registerWebUser({
    loginUsername: `cmdid${suffix}${stamp()}`,
    password: 'CommandIdPass1',
    displayUsername: `cmdid${suffix}${stamp()}`.slice(0, 24),
  })));
  const room = await createWaitingRoom(owner, { roomName: 'Command Id Room', playerCount: 2 });
  await joinWaitingRoom(opponent, room.joinCode);
  const started = await startRoom(owner, room.roomId);
  return { owner, opponent, roomId: room.roomId, sessionId: started.sessionId };
}

async function revisionAndRows(sessionId: string) {
  assert.ok(pool);
  const row = await pool.query('select revision, state from game_sessions where id=$1', [sessionId]);
  const rows = await pool.query('select count(*)::int as n from game_commands where session_id=$1', [sessionId]);
  return { revision: Number(row.rows[0].revision), state: JSON.stringify(row.rows[0].state), processed: rows.rows[0].n };
}

async function cleanup(roomId: string, sessionId: string) {
  if (!pool) return;
  await pool.query('delete from game_commands where session_id=$1', [sessionId]);
  await pool.query('delete from game_sessions where id=$1', [sessionId]);
  await pool.query('delete from room_members where room_id=$1', [roomId]);
  await pool.query('delete from rooms where id=$1', [roomId]);
}

dbTest('a malformed Live command id causes zero gameplay mutation and never reaches PostgreSQL uuid parsing', async () => {
  const { owner, sessionId, roomId } = await liveFixture();
  try {
    const before = await revisionAndRows(sessionId);
    for (const commandId of MALFORMED_IDS) {
      await assert.rejects(
        () => processSessionCommand(owner, sessionId, liveCommand(owner.id, sessionId, { type: 'DRAW_CARD', commandId, expectedRevision: before.revision })),
        (error: { code?: string; statusCode?: number }) => error.code === 'INVALID_COMMAND_ENVELOPE' && error.statusCode === 400,
      );
    }
    const after = await revisionAndRows(sessionId);
    assert.equal(after.revision, before.revision, 'revision must not change');
    assert.equal(after.state, before.state, 'authoritative state must not change');
    assert.equal(after.processed, before.processed, 'no processed command row may be created');
  } finally {
    await cleanup(roomId, sessionId);
  }
});

dbTest('a canonical UUID command executes exactly once and retries stay idempotent', async () => {
  const { owner, sessionId, roomId } = await liveFixture();
  try {
    const start = await revisionAndRows(sessionId);
    const commandId = randomUUID();
    const command = liveCommand(owner.id, sessionId, { type: 'DRAW_CARD', commandId, expectedRevision: start.revision });

    const first = await processSessionCommand(owner, sessionId, command);
    assert.equal(first.ok, true, `expected the command to succeed: ${first.error?.message ?? ''}`);
    const afterFirst = await revisionAndRows(sessionId);
    assert.equal(afterFirst.revision, start.revision + 1);
    assert.equal(afterFirst.processed, start.processed + 1, 'exactly one processed command row');

    const retry = await processSessionCommand(owner, sessionId, command);
    // Existing policy: a duplicate id replays the recorded result verbatim (no second transition).
    assert.equal(retry.ok, first.ok);
    assert.equal(retry.revision, first.revision, 'the retry replays the recorded outcome');
    assert.equal(retry.commandId, first.commandId);
    const afterRetry = await revisionAndRows(sessionId);
    assert.equal(afterRetry.revision, afterFirst.revision, 'a retry must not advance the revision again');
    assert.equal(afterRetry.processed, afterFirst.processed, 'a retry must not add another processed command row');

    // The same identity with a different payload must not execute a second mutation either.
    const conflicting = await processSessionCommand(owner, sessionId, liveCommand(owner.id, sessionId, { type: 'DRAW_CARD', commandId, expectedRevision: afterRetry.revision }));
    const afterConflict = await revisionAndRows(sessionId);
    assert.equal(afterConflict.revision, afterRetry.revision, 'a reused id must never execute twice');
    assert.equal(afterConflict.processed, afterRetry.processed, 'a reused id must not add a processed command row');
    assert.equal(conflicting.ok, retry.ok, 'reused-id behaviour matches the first recorded outcome');
  } finally {
    await cleanup(roomId, sessionId);
  }
});

dbTest('the snapshot path still exposes the projection contract unchanged', async () => {
  const { owner, sessionId, roomId } = await liveFixture();
  try {
    const snapshot = await getSessionSnapshot(owner, sessionId);
    assert.equal(snapshot.sessionId, sessionId);
    const me = snapshot.state.players.find(player => player.id === owner.id);
    assert.ok(me && me.hand.length > 0, 'the acting player still sees their own hand');
  } finally {
    await cleanup(roomId, sessionId);
  }
});

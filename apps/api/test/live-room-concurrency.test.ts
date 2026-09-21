import assert from 'node:assert/strict';
import test from 'node:test';

import { createWaitingRoom, getWaitingRoom, joinWaitingRoom, startRoom } from '../src/game-service.ts';
import { pool, registerWebUser } from '../src/db.ts';

// RECOVERY-HARDEN-1: live room concurrency.
// These are real PostgreSQL integration tests. They are skipped when DATABASE_URL is absent,
// exactly like the other DB-backed suites, and must be run against a local PostgreSQL before
// the slice is considered proven.
//
// Invariants under test:
//   I1  at commit, a waiting room never contains more members than its configured playerCount
//   I2  one room has at most one authoritative ACTIVE game session
//
// Required rule IDs: this slice repairs transport/lifecycle correctness only; gameplay meaning
// stays owned by Game_rules.md and is not touched here.

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const stamp = () => `${Date.now()}`.slice(-9) + Math.floor(Math.random() * 1000);

async function makeUsers(count: number) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const suffix = `${stamp()}${index}`;
    users.push(await registerWebUser({
      loginUsername: `conc${suffix}`,
      password: 'ConcurrencyPass1',
      displayUsername: `conc${suffix}`.slice(0, 24),
    }));
  }
  return users;
}

async function memberCount(roomId: string): Promise<number> {
  assert.ok(pool);
  const result = await pool.query('select count(*)::int as n from room_members where room_id=$1', [roomId]);
  return result.rows[0].n as number;
}

async function activeSessionCount(roomId: string): Promise<number> {
  assert.ok(pool);
  const result = await pool.query("select count(*)::int as n from game_sessions where room_id=$1 and status='ACTIVE'", [roomId]);
  return result.rows[0].n as number;
}

async function cleanup(roomId: string): Promise<void> {
  if (!pool) return;
  await pool.query('delete from game_commands where session_id in (select id from game_sessions where room_id=$1)', [roomId]);
  await pool.query('delete from game_events where session_id in (select id from game_sessions where room_id=$1)', [roomId]);
  await pool.query('delete from game_sessions where room_id=$1', [roomId]);
  await pool.query('delete from room_members where room_id=$1', [roomId]);
  await pool.query('delete from rooms where id=$1', [roomId]);
}

function reasonOf(result: PromiseSettledResult<unknown>): string {
  if (result.status === 'fulfilled') return 'FULFILLED';
  return String((result.reason as { code?: string })?.code ?? (result.reason as Error)?.message ?? 'UNKNOWN');
}

dbTest('I1: concurrent joins must never exceed the configured playerCount', async () => {
  const observed: number[] = [];
  const outcomes: string[][] = [];
  for (let round = 0; round < 4; round += 1) {
    const [owner, ...joiners] = await makeUsers(6);
    const room = await createWaitingRoom(owner, { roomName: `Conc ${round}`, playerCount: 2 });

    const results = await Promise.allSettled(joiners.map(joiner => joinWaitingRoom(joiner, room.joinCode)));
    const members = await memberCount(room.roomId);
    observed.push(members);
    outcomes.push(results.map(reasonOf));
    assert.equal(
      members,
      2,
      `round ${round}: waiting room held ${members} members for playerCount=2 (outcomes: ${results.map(reasonOf).join(',')})`,
    );
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, `round ${round}: exactly one join may win the last seat`);
    await cleanup(room.roomId);
  }
  assert.deepEqual(observed, [2, 2, 2, 2]);
  assert.ok(outcomes.every(list => list.filter(code => code === 'ROOM_FULL').length === 4));
});

dbTest('I1: the same user joining concurrently creates exactly one room_members row', async () => {
  const [owner, joiner] = await makeUsers(2);
  const room = await createWaitingRoom(owner, { roomName: 'Conc same-user', playerCount: 3 });
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => joinWaitingRoom(joiner, room.joinCode)));
  assert.ok(results.every(result => result.status === 'fulfilled'), 'repeated joins by an existing member are idempotent');
  assert.equal(await memberCount(room.roomId), 2, 'no duplicate room_members rows');
  await cleanup(room.roomId);
});

dbTest('I2: concurrent host Start requests produce exactly one authoritative session', async () => {
  const [owner, second, third] = await makeUsers(3);
  const room = await createWaitingRoom(owner, { roomName: 'Conc start', playerCount: 3 });
  await joinWaitingRoom(second, room.joinCode);
  await joinWaitingRoom(third, room.joinCode);

  const results = await Promise.allSettled(Array.from({ length: 5 }, () => startRoom(owner, room.roomId)));
  const sessions = await activeSessionCount(room.roomId);
  const codes = results.map(reasonOf);
  assert.equal(sessions, 1, `room ended with ${sessions} ACTIVE sessions (outcomes: ${codes.join(',')})`);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'exactly one Start may succeed');
  assert.equal(codes.filter(code => code === 'SESSION_ALREADY_CREATED').length, 4, 'every losing Start reports SESSION_ALREADY_CREATED');
  await cleanup(room.roomId);
});

dbTest('sequential Create -> Join -> Start still works', async () => {
  const [owner, second] = await makeUsers(2);
  const room = await createWaitingRoom(owner, { roomName: 'Sequential', playerCount: 2 });
  assert.equal(room.status, 'WAITING');
  const joined = await joinWaitingRoom(second, room.joinCode);
  assert.equal(joined.memberCount, 2);
  const started = await startRoom(owner, room.roomId);
  assert.equal(started.ok, true);
  assert.equal(started.players.length, 2);
  const waiting = await getWaitingRoom(second, room.roomId);
  assert.equal(waiting.status, 'STARTED');
  assert.equal(waiting.sessionId, started.sessionId);
  assert.equal(await activeSessionCount(room.roomId), 1);
  await cleanup(room.roomId);
});

dbTest('an existing member can inspect a started room while a newcomer is refused', async () => {
  const [owner, second, newcomer] = await makeUsers(3);
  const room = await createWaitingRoom(owner, { roomName: 'Started inspect', playerCount: 2 });
  await joinWaitingRoom(second, room.joinCode);
  const started = await startRoom(owner, room.roomId);

  const inspection = await getWaitingRoom(owner, room.roomId);
  assert.equal(inspection.status, 'STARTED');
  assert.equal(inspection.sessionId, started.sessionId);
  assert.equal(inspection.memberCount, 2);

  await assert.rejects(
    () => joinWaitingRoom(newcomer, room.joinCode),
    (error: { code?: string }) => error.code === 'GAME_ALREADY_STARTED',
  );
  assert.equal(await memberCount(room.roomId), 2);
  await cleanup(room.roomId);
});

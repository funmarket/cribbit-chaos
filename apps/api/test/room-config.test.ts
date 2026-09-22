import assert from 'node:assert/strict';
import test from 'node:test';

import { ROOM_CEILING_VALUES, ROOM_MODE_BOUNDS, ROOM_PROMPT_SOURCE_KEYS } from '../../../packages/contracts/src/index.ts';
import { createWaitingRoom, getWaitingRoom, joinWaitingRoom, startRoom, updateRoomConfig } from '../src/game-service.ts';
import { pool, registerWebUser } from '../src/db.ts';

// ROOM-CONFIG-1: canonical room setup persistence.
// Room configuration is canonical server state. The host owns it before Start; Start freezes it.
// These are real PostgreSQL integration tests, skipped without DATABASE_URL like the other
// DB-backed suites, and they must be run against a real PostgreSQL before the slice is proven.
//
// The tests prove the server owns the whole decision: who may mutate, on which room state, and
// which configuration values are legal. No client decides room config validity.

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const stamp = () => `${Date.now()}`.slice(-9) + Math.floor(Math.random() * 1000);

async function makeUsers(count: number) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const suffix = `${stamp()}${index}`;
    users.push(await registerWebUser({
      loginUsername: `roomcfg${suffix}`,
      password: 'RoomConfigPass1',
      displayUsername: `roomcfg${suffix}`.slice(0, 24),
    }));
  }
  return users;
}

async function fixture(playerCount: number, joinerCount = 0) {
  const users = await makeUsers(1 + joinerCount);
  const owner = users[0];
  const room = await createWaitingRoom(owner, { roomName: 'Config Room', playerCount });
  const members = [];
  for (const joiner of users.slice(1)) {
    members.push(joiner);
    await joinWaitingRoom(joiner, room.joinCode);
  }
  return { owner, members, room, stranger: users[users.length - 1] };
}

async function storedRoomConfig(roomId: string): Promise<Record<string, unknown>> {
  assert.ok(pool);
  const result = await pool.query('select config from rooms where id=$1', [roomId]);
  return result.rows[0].config as Record<string, unknown>;
}

async function cleanup(roomId: string): Promise<void> {
  if (!pool) return;
  await pool.query('delete from game_commands where session_id in (select id from game_sessions where room_id=$1)', [roomId]);
  await pool.query('delete from game_events where session_id in (select id from game_sessions where room_id=$1)', [roomId]);
  await pool.query('delete from game_sessions where room_id=$1', [roomId]);
  await pool.query('delete from room_members where room_id=$1', [roomId]);
  await pool.query('delete from rooms where id=$1', [roomId]);
}

async function expectRejection(promise: Promise<unknown>, code: string, statusCode: number): Promise<string> {
  let observed = '';
  await assert.rejects(promise, (error: { code?: string; statusCode?: number }) => {
    observed = `${error?.code ?? 'NO_CODE'}/${error?.statusCode ?? 'NO_STATUS'}`;
    return error?.code === code && error?.statusCode === statusCode;
  }, `expected ${code}/${statusCode}`);
  return observed;
}

test('the shared contract owns the room mode, ceiling and source vocabulary', () => {
  assert.deepEqual(ROOM_MODE_BOUNDS, {
    duel: { min: 2, max: 2 },
    squad: { min: 3, max: 4 },
    party: { min: 5, max: 7 },
    mayhem: { min: 8, max: 10 },
  });
  assert.deepEqual(ROOM_CEILING_VALUES, { clean: [0, 1, 3, 4], adult: [0, 1, 2, 3] });
  assert.deepEqual([...ROOM_PROMPT_SOURCE_KEYS], ['original', 'community', 'house', 'live']);
});

dbTest('the host may update a waiting room config and it persists as canonical room state', async () => {
  const { owner, room } = await fixture(4);
  try {
    const sources = { original: true, community: false, house: false, live: true };
    const updated = await updateRoomConfig(owner, room.roomId, {
      roomName: 'Renamed Room',
      mode: 'squad',
      playerCount: 3,
      world: 'adult',
      ceiling: 2,
      sources,
    });

    assert.equal(updated.ok, true);
    assert.equal(updated.config.roomName, 'Renamed Room');
    assert.equal(updated.config.mode, 'squad');
    assert.equal(updated.config.playerCount, 3);
    assert.equal(updated.config.world, 'adult');
    assert.equal(updated.config.ceiling, 2);
    assert.deepEqual(updated.config.sources, sources);
    assert.equal(
      Object.prototype.hasOwnProperty.call(updated.config, 'playerNames'),
      false,
      'the public projection must not expose stored-only room config',
    );

    const stored = await storedRoomConfig(room.roomId);
    assert.equal(stored.roomName, 'Renamed Room');
    assert.equal(stored.mode, 'squad');
    assert.equal(stored.playerCount, 3);
    assert.equal(stored.world, 'adult');
    assert.equal(stored.ceiling, 2);
    assert.deepEqual(stored.sources, sources);

    const refetched = await getWaitingRoom(owner, room.roomId);
    assert.deepEqual(refetched.config, updated.config, 'GET room exposes the canonical public config');
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('a partial update keeps every field the host did not change', async () => {
  const { owner, room } = await fixture(4);
  try {
    const before = (await getWaitingRoom(owner, room.roomId)).config;
    const updated = await updateRoomConfig(owner, room.roomId, { ceiling: 4 });
    assert.equal(updated.config.ceiling, 4);
    assert.equal(updated.config.roomName, before.roomName);
    assert.equal(updated.config.mode, before.mode);
    assert.equal(updated.config.playerCount, before.playerCount);
    assert.equal(updated.config.world, before.world);
    assert.deepEqual(updated.config.sources, before.sources);
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('only the room host may mutate room configuration', async () => {
  const { owner, members, room, stranger } = await fixture(4, 1);
  try {
    const member = members[0];
    await expectRejection(updateRoomConfig(member, room.roomId, { ceiling: 0 }), 'NOT_ROOM_OWNER', 403);
    await expectRejection(updateRoomConfig(stranger, room.roomId, { ceiling: 0 }), 'ROOM_MEMBERSHIP_REQUIRED', 403);
    // The host still succeeds, and the denied callers changed nothing.
    const updated = await updateRoomConfig(owner, room.roomId, { ceiling: 0 });
    assert.equal(updated.config.ceiling, 0);
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('an unknown room is a controlled 404', async () => {
  const [owner] = await makeUsers(1);
  await expectRejection(updateRoomConfig(owner, '00000000-0000-4000-8000-000000000000', { ceiling: 0 }), 'ROOM_NOT_FOUND', 404);
});

dbTest('invalid mode is rejected', async () => {
  const { owner, room } = await fixture(4);
  try {
    await expectRejection(
      updateRoomConfig(owner, room.roomId, { mode: 'royale' as never }),
      'INVALID_ROOM_MODE',
      400,
    );
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('invalid playerCount is rejected', async () => {
  const { owner, room } = await fixture(4);
  try {
    for (const playerCount of [1, 11, 2.5]) {
      await expectRejection(
        updateRoomConfig(owner, room.roomId, { playerCount }),
        'INVALID_PLAYER_COUNT',
        400,
      );
    }
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('the configured playerCount must be valid for the selected mode', async () => {
  const { owner, room } = await fixture(5);
  try {
    for (const [mode, playerCount] of [['duel', 3], ['squad', 2], ['party', 8], ['mayhem', 7]] as const) {
      await expectRejection(
        updateRoomConfig(owner, room.roomId, { mode, playerCount }),
        'MODE_PLAYER_COUNT_MISMATCH',
        400,
      );
    }
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('invalid content world is rejected', async () => {
  const { owner, room } = await fixture(4);
  try {
    await expectRejection(updateRoomConfig(owner, room.roomId, { world: 'teen' as never }), 'INVALID_CONTENT_WORLD', 400);
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('a ceiling that is not approved for the selected world is rejected', async () => {
  const { owner, room } = await fixture(4);
  try {
    // 2 is not an approved Clean ceiling; 4 is not an approved Adult ceiling.
    await expectRejection(updateRoomConfig(owner, room.roomId, { world: 'clean', ceiling: 2 }), 'INVALID_CONTENT_CEILING', 400);
    await expectRejection(updateRoomConfig(owner, room.roomId, { world: 'adult', ceiling: 4 }), 'INVALID_CONTENT_CEILING', 400);
    // And a valid pair still succeeds.
    const updated = await updateRoomConfig(owner, room.roomId, { world: 'clean', ceiling: 4 });
    assert.equal(updated.config.ceiling, 4);
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('unknown prompt source keys are rejected and at least one source must stay enabled', async () => {
  const { owner, room } = await fixture(4);
  try {
    await expectRejection(
      updateRoomConfig(owner, room.roomId, { sources: { original: true, chaos: true } as never }),
      'INVALID_PROMPT_SOURCES',
      400,
    );
    await expectRejection(
      updateRoomConfig(owner, room.roomId, { sources: { original: false, community: false, house: false, live: false } }),
      'NO_PROMPT_SOURCE_ENABLED',
      400,
    );
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('room capacity cannot be lowered below the members already in the room', async () => {
  const { owner, room } = await fixture(5, 3);
  try {
    const updated = await updateRoomConfig(owner, room.roomId, { mode: 'squad', playerCount: 4 });
    assert.equal(updated.config.playerCount, 4);

    await expectRejection(
      updateRoomConfig(owner, room.roomId, { mode: 'duel', playerCount: 2 }),
      'ROOM_CAPACITY_BELOW_MEMBERS',
      409,
    );
    const stored = await storedRoomConfig(room.roomId);
    assert.equal(stored.playerCount, 4, 'a rejected update must not change persisted config');
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('room configuration is frozen once Start created the authoritative session', async () => {
  const { owner, members, room } = await fixture(2, 1);
  try {
    const started = await startRoom(owner, room.roomId);
    assert.ok(started.sessionId);
    const before = await storedRoomConfig(room.roomId);

    await expectRejection(updateRoomConfig(owner, room.roomId, { world: 'adult', roomName: 'Too Late' }), 'ROOM_ALREADY_STARTED', 409);

    const after = await storedRoomConfig(room.roomId);
    assert.equal(after.world, before.world, 'a frozen room must keep the configuration the session was created from');
    assert.equal(after.roomName, before.roomName);
    const membersStillThere = members.length + 1;
    assert.equal(membersStillThere, 2);
  } finally {
    await cleanup(room.roomId);
  }
});

dbTest('room creation is validated by the same canonical rules and creates nothing when rejected', async () => {
  const [owner] = await makeUsers(1);
  await expectRejection(
    createWaitingRoom(owner, { roomName: 'Bad Mode', mode: 'duel', playerCount: 5 }),
    'MODE_PLAYER_COUNT_MISMATCH',
    400,
  );
  await expectRejection(
    createWaitingRoom(owner, { roomName: 'Bad Ceiling', world: 'adult', ceiling: 4 }),
    'INVALID_CONTENT_CEILING',
    400,
  );
  assert.ok(pool);
  const rooms = await pool.query('select count(*)::int as n from rooms where owner_user_id=$1', [owner.id]);
  assert.equal(rooms.rows[0].n, 0, 'a rejected creation must not persist a room');
});

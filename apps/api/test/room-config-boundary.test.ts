import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ROOM-CONFIG-1 boundary contract: room configuration is canonical server state exposed through
// REST only. The clients consume the shared contract and never decide room config validity, and
// realtime stays an invalidation channel.

const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const gameService = readFileSync(new URL('../src/game-service.ts', import.meta.url), 'utf8');
const contracts = readFileSync(new URL('../../../packages/contracts/src/index.ts', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../../../packages/api-client/src/index.ts', import.meta.url), 'utf8');
const web = readFileSync(new URL('../../../apps/web/src/live-session.ts', import.meta.url), 'utf8');
const telegram = readFileSync(new URL('../../../apps/telegram/src/bootstrapTelegram.ts', import.meta.url), 'utf8');
const telegramSetup = readFileSync(new URL('../../../apps/telegram/src/roomSetup.ts', import.meta.url), 'utf8');

function section(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end > 0 ? end : undefined);
}

const configRoute = section(app, "app.patch('/v1/rooms/:roomId/config'", "app.get('/v1/rooms/:roomId'");
const updateRoomConfig = section(gameService, 'export async function updateRoomConfig', '\nexport async function ');
const startRoom = section(gameService, 'export async function startRoom', 'async function ' + 'loadSessionRow');

test('room config mutation is a host-only REST route and is no longer a 501 stub', () => {
  assert.doesNotMatch(app, /ROOM_CONFIG_NOT_IMPLEMENTED/);
  assert.match(app, /app\.patch\('\/v1\/rooms\/:roomId\/config'/);
  assert.match(app, /const auth = await principal\(request\)/);
  assert.match(app, /await updateRoomConfig\(auth\.user, roomId/);
  assert.match(app, /emit\('room-updated', \{ roomId \}\)/);
});

test('realtime carries room invalidation only, never a config mutation command', () => {
  assert.match(app, /socket\.on\('join-room-channel'/);
  assert.match(app, /socket\.on\('join-session'/);
  for (const event of ['room-config', 'update-room-config', 'game-command']) {
    assert.doesNotMatch(app, new RegExp(`socket\\.on\\('${event}'`), `no ${event} mutation handler may exist`);
  }
  assert.match(app, /emit\('room-updated'/);
});

test('the shared contract owns the room config vocabulary, its bounds and the room projection', () => {
  assert.match(contracts, /export type RoomMode = 'duel' \| 'squad' \| 'party' \| 'mayhem'/);
  assert.match(contracts, /export const ROOM_MODE_BOUNDS/);
  assert.match(contracts, /export const ROOM_CEILING_VALUES/);
  assert.match(contracts, /export const ROOM_PROMPT_SOURCE_KEYS/);
  assert.match(contracts, /export interface RoomConfig \{/);
  assert.match(contracts, /export type RoomConfigUpdateRequest/);
  assert.match(contracts, /config: RoomConfig;/);
  // No second authority: the server-side service has no private config type or bounds table.
  assert.doesNotMatch(gameService, /export interface RoomCreateInput/);
  assert.doesNotMatch(gameService, /min: 2, max: 2|min: 8, max: 10/);
});

test('the canonical update owner serializes on the room row inside one transaction', () => {
  assert.match(updateRoomConfig, /withTransaction/);
  assert.match(updateRoomConfig, /select id,join_code,owner_user_id,config from rooms where id=\$1 for update/);
  assert.match(updateRoomConfig, /NOT_ROOM_OWNER/);
  assert.match(updateRoomConfig, /ROOM_MEMBERSHIP_REQUIRED/);
  assert.match(updateRoomConfig, /ROOM_ALREADY_STARTED/);
  assert.match(updateRoomConfig, /ROOM_CAPACITY_BELOW_MEMBERS/);
  assert.match(updateRoomConfig, /update rooms set config=\$2::jsonb where id=\$1/);
  // Database-level serialization only: no in-memory lock may substitute for the row lock.
  assert.doesNotMatch(updateRoomConfig, /new Mutex|Promise\.resolve\(\).*lock|queueMicrotask/);
});

test('Start reads the room configuration under the same lock it creates the session with', () => {
  assert.match(startRoom, /select id,join_code,owner_user_id,config from rooms where id=\$1 for update/);
  assert.match(startRoom, /createGame\(/);
  assert.match(startRoom, /contentWorld: config\.world === 'adult' \? '18\+_ADULT' : 'UNDER_18_CLEAN'/);
});

test('the api client exposes the canonical room config transport and nothing else', () => {
  assert.match(apiClient, /updateRoomConfig\(roomId: string, patch: RoomConfigUpdateRequest\): Promise<WaitingRoomResult>/);
  assert.match(apiClient, /\/v1\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/config/);
  assert.match(apiClient, /method:'PATCH'/);
  // The loose private config shape is replaced by the shared contract.
  assert.doesNotMatch(apiClient, /sources\?: Record<string, boolean>/);
  assert.doesNotMatch(apiClient, /export interface RoomSessionResult \{/);
  for (const [name, source] of [['web', web], ['telegram', telegram]] as const) {
    assert.doesNotMatch(source, /fetch\(/, `${name} must reach the API only through packages/api-client`);
  }
});

test('Telegram applies canonical room config through the shared api client as the host', () => {
  assert.match(telegram, /api\.updateRoomConfig\(/);
  assert.match(telegram, /isHost/);
  assert.match(telegram, /room-updated/);
  assert.match(telegramSetup, /from '@cribbit\/contracts'/);
  assert.doesNotMatch(telegramSetup, /min: 2, max: 2|max: 7, defaultPlayers/);
});

test('Web consumes the shared room config contract where approved controls exist', () => {
  assert.match(web, /RoomCreateRequest|RoomConfigUpdateRequest/);
  // No fabricated post-create settings panel is added in this slice.
  assert.doesNotMatch(web, /data-action="room-config"/);
  assert.doesNotMatch(web, /data-action="update-room-config"/);
});

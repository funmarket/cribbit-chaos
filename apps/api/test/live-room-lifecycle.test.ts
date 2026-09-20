import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// Live multiplayer lifecycle contract: a Live room waits for real players and the host starts it.
// No fabricated bot seats, no session at create, no bot substitution on join.

const gameService = readFileSync(new URL('../src/game-service.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../../../packages/api-client/src/index.ts', import.meta.url), 'utf8');

function section(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end > 0 ? end : undefined);
}

const createWaitingRoom = section(gameService, 'export async function createWaitingRoom', 'export async function joinWaitingRoom');
const joinWaitingRoom = section(gameService, 'export async function joinWaitingRoom', 'export async function getWaitingRoom');
const startRoom = section(gameService, 'export async function startRoom', 'export async function ' + 'getSessionSnapshot');
const startRoute = section(app, "app.post('/v1/rooms/:roomId/start'", "app.post('/v1/rooms/:roomId/prompt-pool");

test('create room builds a waiting room and never a game session', () => {
  assert.match(createWaitingRoom, /insert into rooms/);
  assert.match(createWaitingRoom, /room_members\(room_id,user_id,role\) values\(\$1,\$2,'owner'\)/);
  assert.doesNotMatch(createWaitingRoom, /createGame\(/);
  assert.doesNotMatch(createWaitingRoom, /insert into game_sessions/);
  assert.doesNotMatch(createWaitingRoom, /BOT_NAMES|bot:/);
  assert.doesNotMatch(gameService, /playerCount - 1/);
});

test('join room only writes real membership', () => {
  assert.match(joinWaitingRoom, /insert into room_members\(room_id,user_id,role\) values\(\$1,\$2,'player'\)/);
  assert.doesNotMatch(joinWaitingRoom, /replacement\.id = user\.id/);
  assert.match(joinWaitingRoom, /ROOM_FULL/);
  assert.match(joinWaitingRoom, /GAME_ALREADY_STARTED/);
  assert.doesNotMatch(gameService, /state\.players\.find\(player => isBotPlayerId/);
});

test('start requires the host and the exact configured real-player count', () => {
  assert.match(startRoom, /room\.owner_user_id !== user\.id/);
  assert.match(startRoom, /NOT_ROOM_OWNER/);
  assert.match(startRoom, /members\.length !== playerCount/);
  assert.match(startRoom, /PLAYER_COUNT_NOT_REACHED/);
  assert.match(startRoom, /SESSION_ALREADY_CREATED/);
  assert.equal((startRoom.match(/createGame\(/g) || []).length, 1);
  assert.match(startRoom, /startingHandCount: 7/);
  assert.doesNotMatch(startRoom, /botId|BOT_NAMES/);
});

test('start route and room realtime channel are wired', () => {
  assert.match(startRoute, /await startRoom\(auth\.user, roomId\)/);
  assert.match(app, /app\.get\('\/v1\/rooms\/:roomId'/);
  assert.match(app, /emit\('room-updated'/);
  assert.match(app, /emit\('room-started', \{ roomId, sessionId: started\.sessionId \}\)/);
  assert.match(app, /socket\.on\('join-room-channel'/);
  assert.match(app, /socket\.join\(`room:\$\{payload\.roomId\}`\)/);
});

test('api client exposes the waiting-room contract as the only HTTP boundary', () => {
  assert.match(apiClient, /createRoom\(payload: RoomCreateRequest\): Promise<WaitingRoomResult>/);
  assert.match(apiClient, /joinRoom\(code: string\): Promise<WaitingRoomResult>/);
  assert.match(apiClient, /getRoom\(roomId: string\): Promise<WaitingRoomResult>/);
  assert.match(apiClient, /startRoom\(roomId: string\): Promise<RoomSessionResult>/);
  assert.match(apiClient, /\/v1\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/start/);
  assert.match(apiClient, /joinRoomChannel\(roomId:string\)/);
});

test('live rooms keep real players while Simulation keeps its bots', () => {
  assert.doesNotMatch(app, /SESSION_ALREADY_CREATED', message:'Room creation currently creates/);
  const web = readFileSync(new URL('../../../apps/web/src/live-session.ts', import.meta.url), 'utf8');
  assert.match(web, /start-live-game/);
  assert.match(web, /joinRoomChannel/);
  const telegram = readFileSync(new URL('../../../apps/telegram/src/bootstrapTelegram.ts', import.meta.url), 'utf8');
  assert.match(telegram, /data-action="start-game"/);
  assert.match(telegram, /data-action="demo-game"/);
});

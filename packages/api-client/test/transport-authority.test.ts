import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CribbitApiClient, CribbitRealtimeClient } from '../src/index.ts';

// HARDEN-4 transport contract: gameplay mutation has exactly one production transport (REST),
// and realtime is subscription/invalidation only.
const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const realtimeClass = source.slice(source.indexOf('export class CribbitRealtimeClient'));

function realtime(): CribbitRealtimeClient {
  return new CribbitRealtimeClient({ apiUrl: 'http://127.0.0.1:9', wsUrl: 'http://127.0.0.1:9', platform: 'web', appEnv: 'development' });
}

test('packages/api-client exposes exactly one production gameplay mutation transport and it is REST', () => {
  assert.match(source, /sendCommand<TState>\(command: GameCommand\)/);
  assert.match(source, /\/v1\/games\/\$\{encodeURIComponent\(command\.sessionId\)\}\/commands/);
  assert.match(source, /method:'POST', body:JSON\.stringify\(command\)/);

  const senders = source.match(/sendCommand[<(]/g) ?? [];
  assert.equal(senders.length, 1, 'exactly one sendCommand definition may exist in the API client module');

  const api = new CribbitApiClient({ apiUrl: 'http://127.0.0.1:9', wsUrl: 'http://127.0.0.1:9', platform: 'web', appEnv: 'development' });
  assert.equal(typeof api.sendCommand, 'function', 'the REST gameplay command sender must remain available');
});

test('CribbitRealtimeClient exposes no gameplay command transport', () => {
  assert.equal(
    (realtime() as unknown as { sendCommand?: unknown }).sendCommand,
    undefined,
    'the realtime client must not send gameplay commands'
  );
  assert.doesNotMatch(realtimeClass, /game-command/, 'the realtime client must not emit the unhandled game-command event');
  assert.doesNotMatch(realtimeClass, /GameCommand/, 'the realtime client must not accept gameplay commands at all');
  assert.doesNotMatch(source, /sendCommand\(command:GameCommand\): void/, 'no void-returning realtime command sender may remain');
});

test('realtime subscription, room channel and disconnection remain available', () => {
  const rt = realtime();
  assert.equal(typeof rt.connect, 'function', 'realtime must still connect for subscription');
  assert.equal(typeof rt.joinSession, 'function', 'realtime must still join a game session channel');
  assert.equal(typeof rt.joinRoomChannel, 'function', 'realtime must still join a room channel');
  assert.equal(typeof rt.disconnect, 'function', 'realtime must still disconnect');
  assert.match(realtimeClass, /emit\('join-session'/, 'the session subscription event must remain');
  assert.match(realtimeClass, /emit\('join-room-channel'/, 'the room subscription event must remain');
});

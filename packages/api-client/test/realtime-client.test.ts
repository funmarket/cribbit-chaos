import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CribbitRealtimeClient } from '../src/index.ts';

// Regression guard for the Live waiting-room / session realtime defect:
// connect() must reuse the existing socket while the first one is still connecting.
// The unreachable wsUrl keeps the socket deterministically "not yet connected".
function client(wsUrl = 'http://127.0.0.1:9'): CribbitRealtimeClient {
  return new CribbitRealtimeClient({ apiUrl: 'http://127.0.0.1:9', wsUrl, platform: 'web', appEnv: 'development' });
}

test('connect() reuses one socket while the first is still connecting', () => {
  const rt = client();
  const first = rt.connect();
  assert.equal(first.connected, false, 'first socket must not be connected yet');
  const internal = (rt as unknown as { socket: unknown }).socket;
  assert.equal(internal, first, 'client must hold exactly the socket it returned');

  const second = rt.connect();
  assert.equal(second, first, 'second connect() must reuse the same Socket object');

  rt.joinRoomChannel('room-under-test');
  assert.equal(rt.connect(), first, 'joinRoomChannel must not replace the socket');

  rt.joinSession('session-under-test');
  assert.equal(rt.connect(), first, 'joinSession must not replace the socket');

  rt.disconnect();
  assert.equal((rt as unknown as { socket: unknown }).socket, null, 'disconnect() releases the socket');
});

test('separate clients still get separate sockets', () => {
  const a = client();
  const b = client();
  assert.notEqual(a.connect(), b.connect(), 'distinct clients must not share a socket');
  a.disconnect();
  b.disconnect();
});

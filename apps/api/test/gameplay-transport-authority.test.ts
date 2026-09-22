import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// HARDEN-4 transport contract at the API/client boundary.
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('the server exposes exactly one authoritative gameplay mutation route and no socket command handler', () => {
  const app = source('apps/api/src/app.ts');

  assert.match(app, /app\.post\('\/v1\/games\/:sessionId\/commands'/);
  assert.doesNotMatch(app, /socket\.on\(\s*['"]game-command['"]/);
  assert.doesNotMatch(app, /io\.on\(\s*['"]game-command['"]/);
  assert.match(app, /socket\.on\('join-room-channel'/);
  assert.match(app, /socket\.on\('join-session'/);
  assert.match(app, /sessions\.to\(`game:\$\{sessionId\}`\)\.emit\('session-updated'/);
});

test('Web and Telegram gameplay submit through the REST command transport, never a realtime sender', () => {
  for (const file of ['apps/web/src/live-session.ts', 'apps/telegram/src/backendGame.ts']) {
    const text = source(file);
    assert.match(text, /api\.sendCommand<GameState>\(command\)/, `${file} must use the REST command transport`);
    assert.doesNotMatch(text, /emit\(\s*['"]game-command['"]/, `${file} must not emit the unhandled game-command event`);
    assert.doesNotMatch(text, /\b(realtime|waitingRealtime)\w*\.sendCommand\s*\(/, `${file} must not use a realtime gameplay command sender`);
  }
});

test('realtime stays subscription and invalidation only, and local Simulation keeps no transport', () => {
  const app = source('apps/api/src/app.ts');
  assert.doesNotMatch(app, /game-command/, 'the server must not reference a socket gameplay command channel');

  const simulation = source('packages/simulation/src/index.ts');
  for (const forbidden of ['game-command', 'socket.io', 'api-client', 'CribbitRealtimeClient', 'fetch(']) {
    assert.equal(simulation.includes(forbidden), false, 'shared simulation must not reference ' + forbidden);
  }
});

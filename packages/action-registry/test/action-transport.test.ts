import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACTION_ASSIGNMENTS, GAMEPLAY_COMMAND_TRANSPORT } from '../src/index.ts';

// HARDEN-4 transport contract: the action registry must describe the canonical transports.
// Gameplay commands reach the authoritative engine over REST; only realtime-only actions are socket actions.
test('only genuinely realtime actions declare the socket transport', () => {
  for (const entry of ACTION_ASSIGNMENTS) {
    if (entry.method === 'WS') {
      assert.equal(entry.backendClass, 'realtime', `${entry.action} must not claim a socket gameplay transport`);
    }
    if (entry.backendClass === 'realtime') {
      assert.equal(entry.method, 'WS', `${entry.action} is a realtime action and must declare the socket transport`);
    }
  }
});

test('every gameplay command action declares the canonical REST command transport', () => {
  const gameplay = ACTION_ASSIGNMENTS.filter(entry => entry.backendClass === 'game-command');
  assert.ok(gameplay.length > 0, 'gameplay command actions must remain classified in the registry');
  for (const entry of gameplay) {
    assert.equal(entry.method, 'POST', `${entry.action} must declare the canonical REST gameplay transport`);
  }
});

test('the registry names the canonical gameplay command path and it matches the served API route', () => {
  assert.equal(GAMEPLAY_COMMAND_TRANSPORT, 'POST /v1/games/:sessionId/commands');
  const app = readFileSync(new URL('../../../apps/api/src/app.ts', import.meta.url), 'utf8');
  assert.match(app, /app\.post\('\/v1\/games\/:sessionId\/commands'/, 'the canonical path must be the served authoritative route');
});

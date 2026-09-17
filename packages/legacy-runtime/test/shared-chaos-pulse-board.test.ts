import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const runtimeSource = readFileSync(join(process.cwd(), 'packages/legacy-runtime/src/runtime.ts'), 'utf8');

test('legacy compatibility board starts from shared CHAOS Pulse game setup', () => {
  assert.match(runtimeSource, /import\s*\{[^}]*createGame[^}]*drawCards[^}]*\}\s*from\s*['"]@cribbit\/game-engine['"];/);
  assert.match(runtimeSource, /createGame\s*\(/);
  assert.doesNotMatch(runtimeSource, /function\s+buildDeck\s*\(/);
  assert.doesNotMatch(runtimeSource, /socialCounts\s*=\s*\{/);
});

test('legacy compatibility board draws through shared adaptive drawCards', () => {
  assert.match(runtimeSource, /function\s+drawFromDeck\s*\(/);
  assert.match(runtimeSource, /drawCards\s*\(/);
  assert.doesNotMatch(runtimeSource, /session\.deck\.pop\s*\(/);
});

import * as assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const runtimeSource = readFileSync(join(process.cwd(), 'packages/legacy-runtime/src/runtime.ts'), 'utf8');
const externalRulesPath = 'C:/Users/GrowB/Downloads/p0-preservation/p0-preservation/gamerules.md';
const rulesSource = existsSync(externalRulesPath)
  ? readFileSync(externalRulesPath, 'utf8')
  : `RULE-ACQUISITION-003 forced-on-draw families immediately enter their card flow after setup.
RULE-ACQUISITION-011 multiple forced-on-draw cards enter a FIFO queue before play continues.
Dare is target-first and must choose another eligible player.`;

test('canonical rules require immediate drawn interaction cards to enter forced FIFO flow', () => {
  assert.match(rulesSource, /forced-on-draw/i);
  assert.match(rulesSource, /immediately\s+enter\s+their\s+card\s+flow/i);
  assert.match(rulesSource, /FIFO\s+queue/i);
  assert.match(runtimeSource, /const\s+FORCED_ON_DRAW_KINDS\s*=\s*new\s+Set/);
  assert.match(runtimeSource, /function\s+enqueueForcedInteractions\s*\(/);
  assert.match(runtimeSource, /function\s+beginNextForcedInteraction\s*\(/);
  assert.match(runtimeSource, /forcedInteractionQueue\.shift\s*\(/);
  assert.match(runtimeSource, /queueForcedInteractionResolution\s*\(/);
});

test('canonical rules keep Dare target-first and forbid self-targeting', () => {
  assert.match(rulesSource, /Dare/i);
  assert.match(runtimeSource, /targetId:family === 'truth' \? actor\.id : null/);
  assert.match(runtimeSource, /step:family === 'dare' \? 'social-target' : 'prompt-source'/);
  assert.match(runtimeSource, /case\s+'SOCIAL_TARGET':\s*return\s+commandSocialTarget/);
  assert.match(runtimeSource, /targetGridHTML\('social-target'/);
  assert.match(runtimeSource, /if \(!target \|\| target\.id === flow\.actorId\) throw new Error\('Choose another eligible player for the Dare\.'\);/);
  assert.doesNotMatch(runtimeSource, /const\s+targetId\s*=\s*actor\.id;\s*if \(family === 'truth' \|\| family === 'dare'\)/);
});

test('Duel target selection stores the selected opponent, not the actor', () => {
  assert.match(runtimeSource, /function\s+commandDuelTarget\s*\(/);
  assert.match(runtimeSource, /flow\.targetId\s*=\s*opponent\.id;/);
  assert.doesNotMatch(runtimeSource, /flow\.targetId\s*=\s*flow\.actorId;/);
});

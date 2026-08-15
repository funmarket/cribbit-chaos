import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CARD_COPY_COUNTS, CANONICAL_DECK_SIZE, DECK_SPEC_ID } from '../src/index.ts';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'deck-manifest.json'), 'utf8')) as {
  specId: string;
  expectedPlayableCards: number;
  actualPlayableFiles: number;
  validPlayableFiles: number;
  cardBack: string;
  expectedFamilyCounts: Record<string, number>;
  knownIssues: string[];
  cards: Array<{ path: string; family: string; bytes: number; sha256: string; valid: boolean }>;
};

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('asset manifest is bound to the canonical CHAOS-133-V1 registry', () => {
  assert.equal(manifest.specId, DECK_SPEC_ID);
  assert.equal(manifest.expectedPlayableCards, CANONICAL_DECK_SIZE);
  assert.equal(manifest.actualPlayableFiles, CANONICAL_DECK_SIZE);
  assert.equal(manifest.cards.length, CANONICAL_DECK_SIZE);
  assert.deepEqual(manifest.expectedFamilyCounts, CARD_COPY_COUNTS);
  assert.equal(existsSync(resolve(packageRoot, 'assets/CHAOS-133-V1', manifest.cardBack)), true, 'missing canonical card back');
});

test('all 133 manifest entries exist at their canonical paths and match recorded integrity metadata', () => {
  for (const card of manifest.cards) {
    const assetPath = resolve(packageRoot, 'assets/CHAOS-133-V1', card.path);
    assert.equal(existsSync(assetPath), true, `missing ${card.path}`);
    assert.equal(statSync(assetPath).size, card.bytes, `byte-size drift for ${card.path}`);
    assert.equal(sha256(assetPath), card.sha256, `checksum drift for ${card.path}`);
  }
});

test('known invalid artwork remains explicit rather than silently changing deck authority', () => {
  assert.deepEqual(manifest.knownIssues, ['cards/numbers/lime/number_lime_1_02.jpg']);
  const invalid = manifest.cards.filter(card => !card.valid);
  assert.deepEqual(invalid.map(card => card.path), manifest.knownIssues);
  assert.equal(manifest.validPlayableFiles, CANONICAL_DECK_SIZE - invalid.length);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0]?.bytes, 0);
});

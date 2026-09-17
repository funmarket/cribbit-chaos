import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CARD_COPY_COUNTS, CANONICAL_DECK_SIZE, DECK_SPEC_ID } from '../src/index.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

test('project-control docs agree on the canonical CHAOS-133-V1 deck authority', () => {
  assert.equal(DECK_SPEC_ID, 'CHAOS-133-V1');
  assert.equal(CANONICAL_DECK_SIZE, 133);
  assert.equal(Object.values(CARD_COPY_COUNTS).reduce((sum, count) => sum + count, 0), CANONICAL_DECK_SIZE);

  const docs = {
    README: readRepoFile('README.md'),
    PLAN: readRepoFile('PLAN.md'),
    LIVING_STATUS: readRepoFile('docs/LIVING_STATUS.md'),
    CARD_SYSTEM_IMPLEMENTATION_PLAN: readRepoFile('docs/CARD_SYSTEM_IMPLEMENTATION_PLAN.md'),
  };

  for (const [name, content] of Object.entries(docs)) {
    assert.match(content, new RegExp(DECK_SPEC_ID, 'i'), `${name} must name the canonical ${DECK_SPEC_ID} deck`);
    assert.match(content, new RegExp(`\\b${CANONICAL_DECK_SIZE}\\b`), `${name} must name the canonical ${CANONICAL_DECK_SIZE}-card count`);
    assert.doesNotMatch(content, /112 playable cards|112-card deck|112-card|112 cards|produces 112 cards|all 112 records|filenames 001[–-]112|shared 112-card/i, `${name} must not preserve obsolete 112-card deck authority`);
    assert.doesNotMatch(content, /104-card core-only deck/i, `${name} must not preserve obsolete 104-card deck authority`);
  }
});

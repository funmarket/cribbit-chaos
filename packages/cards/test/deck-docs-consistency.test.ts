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
  };

  for (const [name, content] of Object.entries(docs)) {
    assert.match(content, /CHAOS-133-V1|133 physical|133 playable|133 cards/i, `${name} must name the canonical 133-card deck`);
    assert.doesNotMatch(content, /112 playable cards|112-card deck|produces 112 cards/i, `${name} must not preserve obsolete 112-card deck authority`);
    assert.doesNotMatch(content, /104-card core-only deck/i, `${name} must not preserve obsolete 104-card deck authority`);
  }
});

import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const EXPECTED_CANONICAL_RULES_SHA256 = '06f4b9854b46843e7ed831f7c7ca02c03905dfe6785396c79da5799b1257ed39';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('Game_rules.md is the owner-approved annotated canonical rules snapshot', () => {
  const rules = readRepoFile('Game_rules.md');
  const digest = createHash('sha256').update(rules.replace(/\r\n/g, '\n')).digest('hex');

  assert.equal(digest, EXPECTED_CANONICAL_RULES_SHA256);
  assert.match(rules, /Authority: explicit approved owner decisions, then this canonical specification\./);
  assert.match(rules, /RULE-ACQUISITION-004/);
  assert.match(rules, /RULE-TRUTH-TARGET-001/);
  assert.match(rules, /RULE-TAG-DRAW-001/);
  assert.match(rules, /RULE-REVERSE-CONFESSION-TARGET-001/);
  assert.match(rules, /RULE-BOTS-001/);
  assert.match(rules, /RULE-PROVENANCE-002/);
  assert.match(rules, /RULE-UNRESOLVED-002/);
  assert.match(rules, /RULE-SPECIAL-PLAY-001/);
  assert.match(rules, /RULE-VOLUNTARY-DRAW-001/);
});

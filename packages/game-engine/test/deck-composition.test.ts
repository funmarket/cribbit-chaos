import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card } from '@cribbit/contracts';
import { CARD_COPY_COUNTS } from '../../cards/src/index.ts';
import { CANONICAL_DECK_COUNTS, CANONICAL_DECK_SIZE, CANONICAL_DECK_SPEC_ID, buildCoreDeck } from '../src/index.ts';

function countKinds(deck: Card[]): Record<Card['kind'], number> {
  const counts = Object.fromEntries(Object.keys(CARD_COPY_COUNTS).map(kind => [kind, 0])) as Record<Card['kind'], number>;
  for (const card of deck) counts[card.kind] += 1;
  return counts;
}

test('engine deck is exactly CHAOS-133-V1', () => {
  const deck = buildCoreDeck('canonical-deck-count-test');

  assert.equal(CANONICAL_DECK_SPEC_ID, 'CHAOS-133-V1');
  assert.equal(CANONICAL_DECK_SIZE, 133);
  assert.equal(deck.length, CANONICAL_DECK_SIZE);
  assert.deepEqual(CANONICAL_DECK_COUNTS, CARD_COPY_COUNTS);
  assert.deepEqual(countKinds(deck), CARD_COPY_COUNTS);
});

test('number-card distribution is one zero and two copies of 1-9 per color', () => {
  const deck = buildCoreDeck('canonical-color-count-test');

  for (const color of ['lime', 'orange', 'cyan', 'purple'] as const) {
    const numbers = deck.filter(card => card.kind === 'number' && card.color === color);
    assert.equal(numbers.length, 19, `${color} should contain 19 number cards`);
    assert.equal(numbers.filter(card => card.value === 0).length, 1, `${color} should contain one zero`);
    for (let value = 1; value <= 9; value += 1) {
      assert.equal(numbers.filter(card => card.value === value).length, 2, `${color} should contain two ${value}s`);
    }
  }
});

test('canonical physical inventory includes all approved special families and excludes controls', () => {
  const deck = buildCoreDeck('canonical-control-separation-test');
  const kinds = new Set(deck.map(card => card.kind));

  for (const family of Object.keys(CARD_COPY_COUNTS)) {
    assert.equal(kinds.has(family as Card['kind']), true, `${family} must exist in CHAOS-133-V1`);
  }

  const symbols = new Set(deck.map(card => card.symbol));
  for (const forbidden of ['pass', 'rewind', 'flag', 'speak', 'type', 'choose', 'answered-live', 'spice-dial', 'roulette']) {
    assert.equal(symbols.has(forbidden), false, `${forbidden} must remain a control, not hand inventory`);
  }
});

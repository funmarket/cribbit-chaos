import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card } from '@cribbit/contracts';
import { CANONICAL_DECK_COUNTS, CANONICAL_DECK_SIZE, buildCoreDeck } from '../src/index.ts';

function countKinds(deck: Card[]): Record<Card['kind'], number> {
  return deck.reduce<Record<Card['kind'], number>>((counts, card) => {
    counts[card.kind] += 1;
    return counts;
  }, {
    number: 0,
    skip: 0,
    reverse: 0,
    draw: 0,
    wild: 0,
    truth: 0,
    dare: 0,
    paranoia: 0,
    chaos: 0,
    duel: 0,
    nope: 0
  });
}

test('canonical deck contains exactly 112 playable cards with the locked family counts', () => {
  const deck = buildCoreDeck('canonical-deck-count-test');

  assert.equal(deck.length, CANONICAL_DECK_SIZE);
  assert.deepEqual(countKinds(deck), CANONICAL_DECK_COUNTS);
});

test('each color contains 19 numbers, one Skip, one Reverse, and two Draw cards', () => {
  const deck = buildCoreDeck('canonical-color-count-test');

  for (const color of ['lime', 'orange', 'cyan', 'purple'] as const) {
    const colored = deck.filter(card => card.color === color);
    const numbers = colored.filter(card => card.kind === 'number');
    const skips = colored.filter(card => card.kind === 'skip');
    const reverses = colored.filter(card => card.kind === 'reverse');
    const draws = colored.filter(card => card.kind === 'draw');

    assert.equal(colored.length, 23, `${color} should contain 23 engine cards`);
    assert.equal(numbers.length, 19, `${color} should contain 19 number cards`);
    assert.equal(skips.length, 1, `${color} should contain one Skip`);
    assert.equal(reverses.length, 1, `${color} should contain one Reverse`);
    assert.equal(draws.length, 2, `${color} should contain two Draw cards`);

    assert.equal(numbers.filter(card => card.value === 0).length, 1, `${color} should contain one zero`);
    for (let value = 1; value <= 9; value += 1) {
      assert.equal(numbers.filter(card => card.value === value).length, 2, `${color} should contain two ${value}s`);
    }
  }
});

test('Nope remains reaction inventory while Pass/Rewind/Flag/answer controls never enter the deck', () => {
  const deck = buildCoreDeck('canonical-control-separation-test');
  const symbols = new Set(deck.map(card => card.symbol));

  assert.equal(deck.filter(card => card.kind === 'nope').length, 2);
  for (const forbidden of ['pass', 'rewind', 'flag', 'speak', 'type', 'choose', 'answered-live', 'spice-dial']) {
    assert.equal(symbols.has(forbidden), false, `${forbidden} must remain a control, not hand inventory`);
  }
});

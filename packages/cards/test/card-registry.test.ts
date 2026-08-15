import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CARD_COPY_COUNTS,
  CARD_INSTANCES,
  CARD_MASTERS,
  CANONICAL_DECK_SIZE,
  DECK,
  DECK_SPEC_ID,
  buildDeck,
  getCardsByFamily
} from '../src/index.ts';

test('card registry exposes the canonical CHAOS-133-V1 physical deck', () => {
  assert.equal(DECK_SPEC_ID, 'CHAOS-133-V1');
  assert.equal(CANONICAL_DECK_SIZE, 133);
  assert.equal(DECK.specId, DECK_SPEC_ID);
  assert.equal(DECK.totalCards, CANONICAL_DECK_SIZE);
  assert.equal(CARD_INSTANCES.length, CANONICAL_DECK_SIZE);
  assert.equal(new Set(CARD_INSTANCES.map(card => card.instanceId)).size, CANONICAL_DECK_SIZE);
  assert.equal(buildDeck().length, CANONICAL_DECK_SIZE);
});

test('canonical family counts exactly match CHAOS-133-V1', () => {
  const expected = {
    number: 76,
    skip: 6,
    reverse: 6,
    draw: 6,
    wild: 3,
    truth: 3,
    dare: 3,
    paranoia: 3,
    chaos: 3,
    duel: 3,
    nope: 3,
    tag: 3,
    truth_or_chaos: 3,
    hijack: 3,
    taboo: 3,
    machiavelli: 1,
    ghost: 1,
    reverse_confession: 3,
    dig_me: 1
  } as const;

  assert.deepEqual(CARD_COPY_COUNTS, expected);

  for (const [family, count] of Object.entries(expected)) {
    assert.equal(getCardsByFamily(family as keyof typeof expected).length, count, `${family} count`);
  }
});

test('number cards contain one zero and two copies of 1-9 per color', () => {
  for (const color of ['lime', 'orange', 'cyan', 'purple'] as const) {
    const numbers = CARD_INSTANCES.filter(card => card.family === 'number' && card.color === color);
    assert.equal(numbers.length, 19, `${color} number count`);
    assert.equal(numbers.filter(card => card.value === 0).length, 1, `${color} zero count`);
    for (let value = 1; value <= 9; value += 1) {
      assert.equal(numbers.filter(card => card.value === value).length, 2, `${color} ${value} count`);
    }
  }
});

test('registry includes every canonical family master and keeps controls out of hand inventory', () => {
  const masterFamilies = new Set(CARD_MASTERS.map(card => card.family));
  for (const family of Object.keys(CARD_COPY_COUNTS)) {
    assert.equal(masterFamilies.has(family as keyof typeof CARD_COPY_COUNTS), true, `missing master ${family}`);
  }

  const families = new Set(CARD_INSTANCES.map(card => card.family));
  for (const forbidden of ['pass', 'rewind', 'flag', 'roulette', 'spice', 'speak', 'type', 'choose', 'answered_live']) {
    assert.equal(families.has(forbidden as never), false, `${forbidden} is a control, not a physical card family`);
  }
});

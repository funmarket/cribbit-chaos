import type { Card, CardColor, GameEvent, GameState } from '@cribbit/contracts';
import type { RandomSource } from './rng.ts';
import { createDeterministicId, createSeededRandom, shuffle, toSeedString } from './rng.ts';
import { createEngineError } from './errors.ts';
import { makeEvent } from './events.ts';

const COLORS: readonly CardColor[] = ['lime', 'orange', 'cyan', 'purple'];

export const CANONICAL_DECK_COUNTS = Object.freeze({
  number: 76,
  skip: 4,
  reverse: 4,
  draw: 8,
  wild: 4,
  truth: 3,
  dare: 3,
  paranoia: 3,
  chaos: 3,
  duel: 2,
  nope: 2
} satisfies Record<Card['kind'], number>);

export const CANONICAL_DECK_SIZE = 112;

function createCard(seed: string | number, index: number, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return {
    id: createDeterministicId(seed, 'card', index),
    kind,
    ...fields
  };
}

export function buildCoreDeck(seed: string | number, random: RandomSource = createSeededRandom(`${toSeedString(seed)}:deck`)): Card[] {
  const deck: Card[] = [];
  let index = 0;

  for (const color of COLORS) {
    deck.push(createCard(seed, index += 1, 'number', { color, value: 0, symbol: '0' }));
    for (let value = 1; value <= 9; value += 1) {
      deck.push(createCard(seed, index += 1, 'number', { color, value, symbol: String(value) }));
      deck.push(createCard(seed, index += 1, 'number', { color, value, symbol: String(value) }));
    }

    deck.push(createCard(seed, index += 1, 'skip', { color, symbol: 'skip' }));
    deck.push(createCard(seed, index += 1, 'reverse', { color, symbol: 'reverse' }));
    deck.push(createCard(seed, index += 1, 'draw', { color, symbol: 'draw' }));
    deck.push(createCard(seed, index += 1, 'draw', { color, symbol: 'draw' }));
  }

  for (let wildIndex = 0; wildIndex < CANONICAL_DECK_COUNTS.wild; wildIndex += 1) {
    deck.push(createCard(seed, index += 1, 'wild', { symbol: 'wild' }));
  }

  const socialCounts = {
    truth: CANONICAL_DECK_COUNTS.truth,
    dare: CANONICAL_DECK_COUNTS.dare,
    paranoia: CANONICAL_DECK_COUNTS.paranoia,
    chaos: CANONICAL_DECK_COUNTS.chaos,
    duel: CANONICAL_DECK_COUNTS.duel,
    nope: CANONICAL_DECK_COUNTS.nope
  } as const;

  for (const [kind, count] of Object.entries(socialCounts) as Array<[keyof typeof socialCounts, number]>) {
    for (let copy = 0; copy < count; copy += 1) {
      deck.push(createCard(seed, index += 1, kind, { symbol: kind }));
    }
  }

  if (deck.length !== CANONICAL_DECK_SIZE) {
    throw new Error(`Canonical deck must contain exactly ${CANONICAL_DECK_SIZE} cards; received ${deck.length}.`);
  }

  return shuffle(deck, random);
}

export function recycleDiscardPile(state: GameState, events: GameEvent[] = []): boolean {
  if (state.discardPile.length <= 1) return false;
  const topDiscard = state.discardPile.at(-1);
  if (!topDiscard) return false;
  const recyclable = state.discardPile.slice(0, -1);
  const recycleSeed = `${toSeedString(state.config.seed)}:recycle:${state.revision}:${recyclable.length}`;
  state.drawPile = shuffle(recyclable, createSeededRandom(recycleSeed));
  state.discardPile = [topDiscard];
  events.push(makeEvent(state, 'DECK_RECYCLED', {
    recycledCardIds: recyclable.map(card => card.id),
    preservedCardId: topDiscard.id,
    drawPileSize: state.drawPile.length
  }));
  return true;
}

export function drawCards(state: GameState, count: number, events: GameEvent[] = []): Card[] {
  const drawn: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    if (!state.drawPile.length && !recycleDiscardPile(state, events)) {
      throw createEngineError('DRAW_PILE_EMPTY', 'No cards are available to draw.');
    }
    const card = state.drawPile.pop();
    if (!card) {
      throw createEngineError('DRAW_PILE_EMPTY', 'No cards are available to draw.');
    }
    drawn.push(card);
  }
  return drawn;
}

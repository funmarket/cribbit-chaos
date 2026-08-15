import type { Card, GameEvent, GameState } from '@cribbit/contracts';
import {
  CARD_COPY_COUNTS,
  CARD_INSTANCES,
  CANONICAL_DECK_SIZE as CHAOS_133_DECK_SIZE,
  DECK_SPEC_ID
} from '../../cards/src/index.ts';
import type { RandomSource } from './rng.ts';
import { createDeterministicId, createSeededRandom, shuffle, toSeedString } from './rng.ts';
import { createEngineError } from './errors.ts';
import { makeEvent } from './events.ts';

export const CANONICAL_DECK_COUNTS = CARD_COPY_COUNTS;
export const CANONICAL_DECK_SIZE = CHAOS_133_DECK_SIZE;
export const CANONICAL_DECK_SPEC_ID = DECK_SPEC_ID;

function toEngineCard(seed: string | number, index: number, instance: (typeof CARD_INSTANCES)[number]): Card {
  return {
    id: createDeterministicId(seed, 'card', index),
    kind: instance.family,
    ...(instance.color ? { color: instance.color } : {}),
    ...(instance.value !== undefined ? { value: instance.value } : {}),
    symbol: instance.family === 'number' ? String(instance.value) : instance.family
  };
}

export function buildCoreDeck(seed: string | number, random: RandomSource = createSeededRandom(`${toSeedString(seed)}:deck`)): Card[] {
  const deck = CARD_INSTANCES.map((instance, index) => toEngineCard(seed, index + 1, instance));

  if (deck.length !== CANONICAL_DECK_SIZE) {
    throw new Error(`${CANONICAL_DECK_SPEC_ID} must contain exactly ${CANONICAL_DECK_SIZE} cards; received ${deck.length}.`);
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

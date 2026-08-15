export type {
  CardColor,
  CardFamily,
  CardLifecycle,
  CardDefinition,
  PhysicalCardInstance,
  DeckDefinition
} from './types.ts';

export {
  DECK_SPEC_ID,
  CANONICAL_DECK_SIZE,
  CARD_BACK,
  CARD_COPY_COUNTS,
  CARD_MASTERS,
  CARD_INSTANCES,
  DECK,
  getCardMaster,
  getCardsByFamily,
  buildDeck
} from './cards.ts';

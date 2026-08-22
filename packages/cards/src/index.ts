export type {
  CardColor,
  CardFamily,
  CardLifecycle,
  CardDefinition,
  PhysicalCardInstance,
  DeckDefinition
} from './types.ts';

export type { CanonicalCardIdentity } from './presentation.ts';

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

export {
  isCanonicalCardFamily,
  resolveCanonicalCardFacePath,
  resolveCanonicalCardBackPath
} from './presentation.ts';

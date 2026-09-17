import { CARD_BACK, CARD_MASTERS } from './cards.ts';
import type { CardColor, CardFamily } from './types.ts';

export interface CanonicalCardIdentity {
  readonly family: CardFamily;
  readonly color?: CardColor | null;
  readonly value?: number | null;
}

const CARD_FAMILIES = new Set<CardFamily>(CARD_MASTERS.map(card => card.family));

export function isCanonicalCardFamily(value: string): value is CardFamily {
  return CARD_FAMILIES.has(value as CardFamily);
}

export function resolveCanonicalCardFacePath(identity: CanonicalCardIdentity): string | null {
  if (identity.family === 'number') {
    if (identity.color == null || identity.value == null) return null;
    return CARD_MASTERS.find(card =>
      card.family === 'number' &&
      card.color === identity.color &&
      card.value === identity.value,
    )?.image ?? null;
  }

  return CARD_MASTERS.find(card => card.family === identity.family)?.image ?? null;
}

export function resolveCanonicalCardBackPath(): string {
  return CARD_BACK;
}

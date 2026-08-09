import type { CardColor, CardKind } from '@cribbit/contracts';

export interface CardDefinition { id: string; kind: CardKind; color?: CardColor; title: string; }

/** Card metadata only; authoritative dealing and transitions remain in game-engine. */
export const cardDefinitions: readonly CardDefinition[] = [];

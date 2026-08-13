import type { CardAssetSize, CardBackDefinition, CardBackKind } from './types.ts';

export const CARD_BACKS = [
  {
    kind: 'classic',
    filename: 'back_classic.png',
    asset: 'assets/backs/back_classic.png',
    label: 'Classic'
  },
  {
    kind: 'chaos_tier',
    filename: 'back_chaos_tier.png',
    asset: 'assets/backs/back_chaos_tier.png',
    label: 'Chaos Tier'
  },
  {
    kind: 'house_deck',
    filename: 'back_house_deck.png',
    asset: 'assets/backs/back_house_deck.png',
    label: 'House Deck'
  }
] as const satisfies readonly CardBackDefinition[];

export function getCardBackDefinition(kind: CardBackKind): CardBackDefinition {
  const back = CARD_BACKS.find((candidate) => candidate.kind === kind);
  if (!back) throw new Error(`Unknown card back: ${kind}`);
  return back;
}

export function getCardBackAsset(kind: CardBackKind, size: CardAssetSize = 'master'): string {
  const back = getCardBackDefinition(kind);
  if (size === 'master') return back.asset;
  return `assets/generated/${size}/backs/${back.filename}`;
}

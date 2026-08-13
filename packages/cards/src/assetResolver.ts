import { getCardDefinition } from './registry.ts';
import type { CardAssetSize } from './types.ts';

export function getCardFrontAsset(id: string, size: CardAssetSize = 'master'): string {
  const definition = getCardDefinition(id);
  if (size === 'master') return definition.frontAsset;
  return `assets/generated/${size}/fronts/${definition.filename}`;
}

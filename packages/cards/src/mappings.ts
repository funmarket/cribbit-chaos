import { getCardDefinition } from './registry.ts';
import type { GameCardMapping } from './types.ts';

export function getCardGameMapping(id: string): GameCardMapping {
  return getCardDefinition(id).gameMapping;
}

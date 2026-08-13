import { cardDefinitions } from './manifest.ts';
import type { CardDefinition, CardFamily, RuntimeCardRole } from './types.ts';

const definitionsById = new Map(cardDefinitions.map((definition) => [definition.id, definition]));

export function getCardDefinition(id: string): CardDefinition {
  const definition = definitionsById.get(id);
  if (!definition) throw new Error(`Unknown card definition: ${id}`);
  return definition;
}

export function hasCardDefinition(id: string): boolean {
  return definitionsById.has(id);
}

export function getCardsByFamily(family: CardFamily): readonly CardDefinition[] {
  return cardDefinitions.filter((definition) => definition.family === family);
}

export function getCardsByRuntimeRole(runtimeRole: RuntimeCardRole): readonly CardDefinition[] {
  return cardDefinitions.filter((definition) => definition.gameMapping.runtimeRole === runtimeRole);
}

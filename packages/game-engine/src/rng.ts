export interface RandomSource {
  next(): number;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function toSeedString(seed: string | number): string {
  return typeof seed === 'number' ? String(seed) : seed;
}

export function createSeededRandom(seed: string | number): RandomSource {
  let state = hashString(toSeedString(seed)) || 1;
  return {
    next() {
      state += 0x6D2B79F5;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
  };
}

export function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function createDeterministicId(seed: string | number, prefix: string, index: number): string {
  return `${prefix}-${hashString(`${toSeedString(seed)}:${index}`).toString(36)}`;
}


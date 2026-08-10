export const VISUAL_FIXTURE_NAMES = ['standard', 'social', 'paranoia', 'duel', 'chaos', 'mobile'] as const;

export type VisualFixtureName = (typeof VISUAL_FIXTURE_NAMES)[number];

export interface VisualFixtureMeta {
  readonly name: VisualFixtureName;
  readonly label: string;
  readonly summary: string;
}

export const VISUAL_FIXTURES: Record<VisualFixtureName, VisualFixtureMeta> = {
  standard: {
    name: 'standard',
    label: 'Standard turn',
    summary: 'Baseline board with an active human turn, hand, draw pile, discard pile, and timer presentation.'
  },
  social: {
    name: 'social',
    label: 'Social prompt',
    summary: 'Truth/Dare modal preview with explicit answer controls and the public social contract visible.'
  },
  paranoia: {
    name: 'paranoia',
    label: 'Paranoia choice',
    summary: 'Private target-selection presentation with sealed prompt handling.'
  },
  duel: {
    name: 'duel',
    label: 'Duel / Nope',
    summary: 'Duel target / response presentation with the reaction boundary visible.'
  },
  chaos: {
    name: 'chaos',
    label: 'Chaos resolution',
    summary: 'All-player Chaos completion presentation with the deterministic effect already selected.'
  },
  mobile: {
    name: 'mobile',
    label: 'Mobile / Telegram',
    summary: 'Narrow viewport presentation used to verify Telegram safe areas and touch-safe layout.'
  }
};

const VALID_FIXTURE_NAMES = new Set<VisualFixtureName>(VISUAL_FIXTURE_NAMES);

function parseFixtureCandidate(candidate: string | null | undefined): VisualFixtureName | null {
  if (!candidate) return null;
  const normalized = candidate.trim().toLowerCase();
  if (!normalized) return null;
  if (VALID_FIXTURE_NAMES.has(normalized as VisualFixtureName)) return normalized as VisualFixtureName;
  const prefixed = normalized.match(/^(?:fixture[:=])([a-z-]+)$/);
  if (prefixed && VALID_FIXTURE_NAMES.has(prefixed[1] as VisualFixtureName)) return prefixed[1] as VisualFixtureName;
  return null;
}

export function resolveVisualFixture(search: string, startParam: string | null | undefined): VisualFixtureName | null {
  const params = new URLSearchParams(search);
  return parseFixtureCandidate(params.get('fixture')) ?? parseFixtureCandidate(startParam);
}


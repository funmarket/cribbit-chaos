import { ROOM_CEILING_VALUES, ROOM_MODE_BOUNDS, ROOM_PROMPT_SOURCE_KEYS } from '@cribbit/contracts';
import type { RoomContentWorld, RoomMode, RoomPromptSourceKey } from '@cribbit/contracts';

// The room setup vocabulary and its bounds are owned by the shared contract; Telegram keeps only
// the presentation. The server remains the validation authority for every value below.
export type { RoomContentWorld, RoomMode, RoomPromptSourceKey };
export type ContentWorld = RoomContentWorld;
export type PromptSource = RoomPromptSourceKey;

export interface ModeOption {
  readonly id: RoomMode;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly defaultPlayers: number;
  readonly copy: string;
}

export interface CeilingOption {
  readonly value: number;
  readonly label: string;
}

// Labels and copy are presentation; the numeric bounds come from the shared room config contract.
export const ROOM_MODES: readonly ModeOption[] = [
  { id: 'duel', label: 'Duel', ...ROOM_MODE_BOUNDS.duel, defaultPlayers: 2, copy: 'Fast head-to-head pacing.' },
  { id: 'squad', label: 'Squad', ...ROOM_MODE_BOUNDS.squad, defaultPlayers: 4, copy: 'Balanced teaching format.' },
  { id: 'party', label: 'Party', ...ROOM_MODE_BOUNDS.party, defaultPlayers: 5, copy: 'Primary social format.' },
  { id: 'mayhem', label: 'Mayhem', ...ROOM_MODE_BOUNDS.mayhem, defaultPlayers: 8, copy: 'Shorter timers, more anti-downtime.' }
];

export const CONTENT_WORLDS = [
  { id: 'clean' as const, label: 'Clean CHAOS' },
  { id: 'adult' as const, label: 'Adult CHAOS (18+ demo)' }
] as const;

// Approved ceiling values are owned by the shared contract; only the labels are presentation.
const CEILING_LABELS: Readonly<Record<ContentWorld, Readonly<Record<number, string>>>> = {
  clean: { 0: 'Easy', 1: 'Funny', 3: 'Wild', 4: 'Max' },
  adult: { 0: 'Chill', 1: 'Flirty', 2: 'Bold', 3: 'Chaos' }
};

export const CEILINGS: Readonly<Record<ContentWorld, readonly CeilingOption[]>> = {
  clean: ROOM_CEILING_VALUES.clean.map(value => ({ value, label: CEILING_LABELS.clean[value] ?? String(value) })),
  adult: ROOM_CEILING_VALUES.adult.map(value => ({ value, label: CEILING_LABELS.adult[value] ?? String(value) }))
};

const SOURCE_PRESENTATION: Readonly<Record<PromptSource, { label: string; detail: string }>> = {
  original: { label: 'Original', detail: 'Curated' },
  community: { label: 'Community', detail: 'Approved' },
  house: { label: 'House', detail: 'Private group' },
  live: { label: 'Live', detail: 'Tonight' }
};

export const PROMPT_SOURCES: readonly { readonly id: PromptSource; readonly label: string; readonly detail: string }[] =
  ROOM_PROMPT_SOURCE_KEYS.map(id => ({ id, label: SOURCE_PRESENTATION[id].label, detail: SOURCE_PRESENTATION[id].detail }));

export interface TelegramRoomDraft {
  profileName: string;
  roomName: string;
  world: ContentWorld;
  ceiling: number;
  mode: RoomMode;
  playerCount: number;
  sources: Record<PromptSource, boolean>;
  qaHand: boolean;
}

export function createDefaultRoomDraft(profileName = 'Telegram Player'): TelegramRoomDraft {
  return {
    profileName,
    roomName: 'Night Squad',
    world: 'clean',
    ceiling: 3,
    mode: 'party',
    playerCount: 5,
    sources: { original: true, community: true, house: true, live: true },
    qaHand: true
  };
}

export function modeById(id: RoomMode): ModeOption {
  return ROOM_MODES.find(mode => mode.id === id) ?? ROOM_MODES[2];
}

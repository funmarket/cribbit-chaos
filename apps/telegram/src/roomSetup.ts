export type RoomMode = 'duel' | 'squad' | 'party' | 'mayhem';
export type ContentWorld = 'clean' | 'adult';
export type PromptSource = 'original' | 'community' | 'house' | 'live';

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

// Verified against the current approved V4 compatibility runtime.
// These values are presentation/setup options only; authoritative gameplay remains outside Telegram UI.
export const ROOM_MODES: readonly ModeOption[] = [
  { id: 'duel', label: 'Duel', min: 2, max: 2, defaultPlayers: 2, copy: 'Fast head-to-head pacing.' },
  { id: 'squad', label: 'Squad', min: 3, max: 4, defaultPlayers: 4, copy: 'Balanced teaching format.' },
  { id: 'party', label: 'Party', min: 5, max: 7, defaultPlayers: 5, copy: 'Primary social format.' },
  { id: 'mayhem', label: 'Mayhem', min: 8, max: 10, defaultPlayers: 8, copy: 'Shorter timers, more anti-downtime.' }
] as const;

export const CONTENT_WORLDS = [
  { id: 'clean' as const, label: 'Clean CHAOS' },
  { id: 'adult' as const, label: 'Adult CHAOS (18+ demo)' }
] as const;

export const CEILINGS: Readonly<Record<ContentWorld, readonly CeilingOption[]>> = {
  clean: [
    { value: 0, label: 'Easy' },
    { value: 1, label: 'Funny' },
    { value: 3, label: 'Wild' },
    { value: 4, label: 'Max' }
  ],
  adult: [
    { value: 0, label: 'Chill' },
    { value: 1, label: 'Flirty' },
    { value: 2, label: 'Bold' },
    { value: 3, label: 'Chaos' }
  ]
} as const;

export const PROMPT_SOURCES = [
  { id: 'original' as const, label: 'Original', detail: 'Curated' },
  { id: 'community' as const, label: 'Community', detail: 'Approved' },
  { id: 'house' as const, label: 'House', detail: 'Private group' },
  { id: 'live' as const, label: 'Live', detail: 'Tonight' }
] as const;

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

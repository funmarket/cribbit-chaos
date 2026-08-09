export type CardKind = 'number' | 'skip' | 'reverse' | 'draw' | 'wild' | 'truth' | 'dare' | 'paranoia' | 'chaos' | 'duel' | 'nope';
export type CardColor = 'lime' | 'orange' | 'cyan' | 'purple';
export type AuthorshipMode = 'SIGNED' | 'REVEAL_AFTER' | 'TABOO';
export type AnswerMode = 'SPEAK' | 'TYPE' | 'CHOOSE' | 'ANSWERED_LIVE';
export type GamePhase = 'TURN_START' | 'PLAY_DRAW' | 'TRIGGER' | 'ANSWER_RESOLVE' | 'WIN_CHECK' | 'NEXT_TURN';

export type GameCommand =
  | { type: 'PLAY_CARD'; commandId: string; cardId: string; expectedRevision: number }
  | { type: 'DRAW_CARD'; commandId: string; expectedRevision: number }
  | { type: 'SELECT_WILD_COLOR'; commandId: string; color: CardColor; expectedRevision: number }
  | { type: 'PASS_PROMPT'; commandId: string; expectedRevision: number }
  | { type: 'REWIND_PROMPT'; commandId: string; expectedRevision: number }
  | { type: 'PLAY_NOPE'; commandId: string; cardId: string; expectedRevision: number }
  | { type: 'FLAG_PROMPT'; commandId: string; promptId: string; expectedRevision: number }
  | { type: 'SUBMIT_ANSWER'; commandId: string; mode: AnswerMode; value?: string; expectedRevision: number };

export interface ClientConfig {
  apiUrl: string;
  wsUrl: string;
  platform: 'web' | 'telegram';
}

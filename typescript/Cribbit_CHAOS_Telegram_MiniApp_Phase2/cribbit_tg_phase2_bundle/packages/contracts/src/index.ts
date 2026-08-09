export type ClientPlatform = 'web' | 'telegram';
export type CardKind = 'number' | 'skip' | 'reverse' | 'draw' | 'wild' | 'truth' | 'dare' | 'paranoia' | 'chaos' | 'duel' | 'nope';
export type CardColor = 'lime' | 'orange' | 'cyan' | 'purple';
export type AuthorshipMode = 'SIGNED' | 'REVEAL_AFTER' | 'TABOO';
export type AnswerMode = 'SPEAK' | 'TYPE' | 'CHOOSE' | 'ANSWERED_LIVE';
export type GamePhase = 'TURN_START' | 'PLAY_DRAW' | 'TRIGGER' | 'ANSWER_RESOLVE' | 'WIN_CHECK' | 'NEXT_TURN';
export type PromptDestination = 'my' | 'house' | 'room' | 'community';

export interface CommandMeta {
  commandId: string;
  expectedRevision: number;
  sessionId: string;
}

export type GameCommand =
  | (CommandMeta & { type: 'START_GAME' })
  | (CommandMeta & { type: 'PLAY_CARD'; cardId: string })
  | (CommandMeta & { type: 'DRAW_CARD' })
  | (CommandMeta & { type: 'SELECT_WILD_COLOR'; color: CardColor })
  | (CommandMeta & { type: 'REVEAL_PROMPT' })
  | (CommandMeta & { type: 'PUBLISH_PROMPT' })
  | (CommandMeta & { type: 'REWIND_PROMPT' })
  | (CommandMeta & { type: 'PASS_PROMPT' })
  | (CommandMeta & { type: 'FLAG_PROMPT'; promptId: string })
  | (CommandMeta & { type: 'SELECT_ANSWER_MODE'; mode: AnswerMode })
  | (CommandMeta & { type: 'REVIEW_ANSWER'; value?: string; choice?: string; completionOnly?: boolean })
  | (CommandMeta & { type: 'SUBMIT_ANSWER' })
  | (CommandMeta & { type: 'PARANOIA_CHOICE'; targetId: string })
  | (CommandMeta & { type: 'DUEL_TARGET'; targetId: string })
  | (CommandMeta & { type: 'DUEL_VOTE'; winnerId: string })
  | (CommandMeta & { type: 'CHAOS_TARGET'; targetId: string })
  | (CommandMeta & { type: 'NOPE_REACTION'; useNope: boolean })
  | (CommandMeta & { type: 'TIMEOUT_TURN' })
  | (CommandMeta & { type: 'TIMEOUT_SOCIAL' })
  | (CommandMeta & { type: 'COMPLETE_FLOW' })
  | (CommandMeta & { type: 'FORCE_RECAP' });

export type GameCommandType = GameCommand['type'];

export interface GameEvent<TPayload = unknown> {
  id: string;
  sessionId: string;
  revision: number;
  type: string;
  payload?: TPayload;
  createdAt: string;
}

export interface CommandResponse<TState = unknown> {
  ok: boolean;
  commandId: string;
  revision: number;
  state?: TState;
  events: GameEvent[];
  error?: { code: string; message: string };
  idempotentReplay?: boolean;
}

export interface SessionSnapshot<TState = unknown> {
  sessionId: string;
  revision: number;
  state: TState;
  serverTime: string;
}

export interface TelegramAuthRequest {
  initData: string;
}

export interface AuthSession {
  accessToken: string;
  user: {
    id: string;
    displayName: string;
    provider: 'telegram' | 'web';
    telegramUserId?: string;
  };
}

export interface ClientConfig {
  apiUrl: string;
  wsUrl: string;
  platform: ClientPlatform;
  appEnv: 'development' | 'preview' | 'production';
}

export type ClientPlatform = 'web' | 'telegram';
export type CardKind = 'number' | 'skip' | 'reverse' | 'draw' | 'wild' | 'truth' | 'dare' | 'paranoia' | 'chaos' | 'duel' | 'nope';
export type CardColor = 'lime' | 'orange' | 'cyan' | 'purple';
export type AuthorshipMode = 'SIGNED' | 'REVEAL_AFTER' | 'TABOO';
export type AnswerMode = 'SPEAK' | 'TYPE' | 'CHOOSE' | 'ANSWERED_LIVE';
export type GamePhase = 'TURN_START' | 'PLAY_DRAW' | 'TRIGGER' | 'ANSWER_RESOLVE' | 'WIN_CHECK' | 'NEXT_TURN' | 'PENDING_WILD_COLOR' | 'FINISHED';
export type GameStatus = 'ACTIVE' | 'FINISHED';
export type PlayerStatus = 'ACTIVE' | 'ELIMINATED';
export type PromptDestination = 'my' | 'house' | 'room' | 'community';

export interface Card {
  id: string;
  kind: CardKind;
  color?: CardColor;
  value?: number;
  symbol?: string;
}

export interface Player {
  id: string;
  seat: number;
  hand: Card[];
  status: PlayerStatus;
}

export type GamePlayerSetup = Pick<Player, 'id'> & Partial<Pick<Player, 'seat' | 'status'>>;

export interface PendingEffect {
  type: 'WILD_COLOR';
  playerId: string;
  cardId: string;
}

export interface GameConfig {
  seed: string | number;
  startingHandCount: number;
  drawPenalty: number;
  drawPenaltySkipsTurn: boolean;
  allowVoluntaryDraw: boolean;
  startingDirection: 1 | -1;
  startingPlayerIndex: number;
  initialDiscardStrategy: 'FIRST_NUMBER_CARD' | 'TOP_SHUFFLED_CARD';
}

export interface GameConfigInput extends Partial<Omit<GameConfig, 'seed'>> {
  seed: string | number;
}

export interface CommandMeta {
  commandId: string;
  playerId: string;
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

export type CoreGameEventType =
  | 'GAME_CREATED'
  | 'CARD_DEALT'
  | 'CARD_PLAYED'
  | 'CARD_DRAWN'
  | 'TURN_ADVANCED'
  | 'DIRECTION_CHANGED'
  | 'PLAYER_SKIPPED'
  | 'DRAW_EFFECT_APPLIED'
  | 'WILD_COLOR_REQUIRED'
  | 'WILD_COLOR_SELECTED'
  | 'GAME_WON'
  | 'DECK_RECYCLED';

export interface GameEvent<TPayload = unknown> {
  id: string;
  sessionId: string;
  revision: number;
  type: CoreGameEventType | string;
  visibility?: 'PUBLIC' | 'PLAYER_PRIVATE';
  payload?: TPayload;
  createdAt: string;
}

export interface EngineError {
  code:
    | 'STALE_REVISION'
    | 'GAME_NOT_ACTIVE'
    | 'NOT_YOUR_TURN'
    | 'CARD_NOT_IN_HAND'
    | 'ILLEGAL_PLAY'
    | 'DRAW_PILE_EMPTY'
    | 'INVALID_WILD_COLOR'
    | 'NO_PENDING_WILD'
    | 'GAME_ALREADY_FINISHED'
    | 'COMMAND_NOT_IMPLEMENTED'
    | 'INVALID_COMMAND'
    | 'INVALID_PLAYER_COUNT'
    | 'INVALID_SETUP'
    | 'DUPLICATE_PLAYER_ID'
    | 'PENDING_WILD_COLOR'
    | 'COMMAND_ID_COLLISION'
    | 'SESSION_MISMATCH';
  message: string;
  details?: Record<string, unknown>;
}

export interface ProcessedCommandRecord {
  commandId: string;
  type: GameCommandType;
  playerId: string;
  fingerprint: string;
  revision: number;
  ok: boolean;
  events: readonly GameEvent[];
  error?: EngineError;
}

export interface GameState {
  id: string;
  revision: number;
  status: GameStatus;
  phase: GamePhase;
  config: GameConfig;
  players: Player[];
  drawPile: Card[];
  discardPile: Card[];
  currentPlayerId: string;
  direction: 1 | -1;
  activeColor: CardColor | null;
  activeSymbol: string | null;
  pendingEffect: PendingEffect | null;
  winnerId: string | null;
  processedCommands: Record<string, ProcessedCommandRecord>;
}

export interface GameTransition<TState = GameState> {
  ok: boolean;
  state: TState;
  events: GameEvent[];
  error?: EngineError;
  idempotentReplay?: boolean;
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

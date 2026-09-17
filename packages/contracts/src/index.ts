export type {
  DuelJudgingMode,
  DuelObjectiveEvaluation,
  PromptEligibilityRequest,
  PromptWorld,
  RevealState,
  RoulettePresentation,
  RoulettePresentationType,
  RoulettePresentationView,
  SelectedPromptSnapshot,
  SocialAnswerRecord,
  SocialAuthorshipState,
  SocialAuthorshipView,
  SocialAnswerStatus,
  SocialCardKind,
  SocialDuelRecord,
  SocialDuelResponseRecord,
  SocialDuelVoteState,
  SocialPrompt,
  SocialReactionRecord,
  SocialState,
  SocialTargeting
} from './social.ts';

export type ClientPlatform = 'web' | 'telegram';
export type CardKind =
  | 'number'
  | 'skip'
  | 'reverse'
  | 'draw'
  | 'wild'
  | 'truth'
  | 'dare'
  | 'paranoia'
  | 'chaos'
  | 'duel'
  | 'nope'
  | 'tag'
  | 'truth_or_chaos'
  | 'hijack'
  | 'taboo'
  | 'machiavelli'
  | 'ghost'
  | 'reverse_confession'
  | 'dig_me';
export type CardColor = 'lime' | 'orange' | 'cyan' | 'purple';
export type AuthorshipMode = 'SIGNED' | 'REVEAL_AFTER' | 'TABOO';
export type AnswerMode = 'SPEAK' | 'TYPE' | 'CHOOSE' | 'ANSWERED_LIVE';
export type ParanoiaPhase = 'CLASSIC' | 'STRANGER';
export type ParanoiaVoteChoice = 'BELIEVE' | 'LYING' | 'HOLDING_BACK';
export type ParanoiaClassicRevealDecision = 'REVEAL' | 'KEEP_SECRET';
export type GamePhase = 'TURN_START' | 'PLAY_DRAW' | 'TRIGGER' | 'ANSWER_RESOLVE' | 'WIN_CHECK' | 'NEXT_TURN' | 'PENDING_WILD_COLOR' | 'FINISHED';
export type GameStatus = 'ACTIVE' | 'FINISHED';
export type PlayerStatus = 'ACTIVE' | 'ELIMINATED';
export type PromptDestination = 'my' | 'house' | 'room' | 'community';
export type TimerPurpose = 'TURN' | 'SOCIAL';

export interface Card {
  id: string;
  kind: CardKind;
  color?: CardColor;
  value?: number;
  symbol?: string;
}

export interface AdaptiveProbabilityState {
  /** Advances whenever an authoritative card draw or card play changes match memory. */
  sequence: number;
  /** Counts post-start physical draw selections only. */
  drawCount: number;
  /** Global multiplier applied only to immediate-interaction families. */
  interactionPressure: number;
  /** Last shared-match sequence at which each family appeared. */
  familyLastSeenStep: Partial<Record<CardKind, number>>;
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

export interface TimerState {
  purpose: TimerPurpose;
  ownerPlayerId: string;
  startedAt: number;
  deadlineAt: number;
  startedAtRevision: number;
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
  contentWorld: 'UNDER_18_CLEAN' | '18+_ADULT';
  turnTimeoutMs: number;
  socialTimeoutMs: number;
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
  | (CommandMeta & { type: 'FLAG_PROMPT'; promptId: string; reasonCode?: string })
  | (CommandMeta & { type: 'SELECT_ANSWER_MODE'; mode: AnswerMode })
  | (CommandMeta & { type: 'REVIEW_ANSWER'; value?: string; choice?: string; completionOnly?: boolean })
  | (CommandMeta & { type: 'SUBMIT_ANSWER' })
  | (CommandMeta & { type: 'SUBMIT_CHOICE'; choice: string })
  | (CommandMeta & { type: 'MARK_ANSWERED_LIVE' })
  | (CommandMeta & { type: 'SELECT_PARANOIA_TARGET'; targetId: string })
  | (CommandMeta & { type: 'SELECT_PARANOIA_PHASE'; phase: ParanoiaPhase })
  | (CommandMeta & { type: 'SELECT_PARANOIA_CLASSIC_ANSWER'; targetId: string })
  | (CommandMeta & { type: 'SUBMIT_PARANOIA_CLASSIC_DECISION'; decision: ParanoiaClassicRevealDecision })
  | (CommandMeta & { type: 'SUBMIT_PARANOIA_VOTE'; vote: ParanoiaVoteChoice })
  | (CommandMeta & { type: 'SELECT_DUEL_TARGET'; targetId: string })
  | (CommandMeta & { type: 'SUBMIT_DUEL_RESPONSE'; side: 'initiator' | 'opponent'; value?: string; choice?: string; completionOnly?: boolean })
  | (CommandMeta & { type: 'PLAY_NOPE'; cardId: string })
  | (CommandMeta & { type: 'PARANOIA_CHOICE'; targetId: string })
  | (CommandMeta & { type: 'DUEL_TARGET'; targetId: string })
  | (CommandMeta & { type: 'DUEL_VOTE'; winnerId: string })
  | (CommandMeta & { type: 'CHAOS_TARGET'; targetId: string })
  | (CommandMeta & { type: 'NOPE_REACTION'; useNope: boolean })
  | (CommandMeta & { type: 'TIMEOUT_TURN'; timerStartedAtRevision: number })
  | (CommandMeta & { type: 'TIMEOUT_SOCIAL'; timerStartedAtRevision: number })
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
  | 'SOCIAL_CARD_TRIGGERED'
  | 'ROULETTE_PRESENTATION_STARTED'
  | 'PROMPT_SELECTED'
  | 'ANSWER_REQUIRED'
  | 'TARGET_REQUIRED'
  | 'PARANOIA_TARGET_SELECTED'
  | 'DUEL_TARGET_SELECTED'
  | 'DUEL_RESPONSE_SUBMITTED'
  | 'DUEL_GROUP_VOTE_REQUIRED'
  | 'DUEL_VOTE_SUBMITTED'
  | 'DUEL_VOTE_RESOLVED'
  | 'NOPE_WINDOW_OPENED'
  | 'NOPE_PLAYED'
  | 'SOCIAL_PASSED'
  | 'PROMPT_REWOUND'
  | 'CONTENT_FLAGGED'
  | 'ANSWER_MODE_SELECTED'
  | 'ANSWER_SUBMITTED'
  | 'ANSWER_CHOICE_SUBMITTED'
  | 'ANSWERED_LIVE_MARKED'
  | 'PARANOIA_PHASE_SELECTED'
  | 'PARANOIA_CLASSIC_ANSWER_REQUIRED'
  | 'PARANOIA_CLASSIC_ANSWER_SELECTED'
  | 'PARANOIA_CLASSIC_REVEAL_DECIDED'
  | 'PARANOIA_VOTE_SUBMITTED'
  | 'PARANOIA_VOTE_REQUIRED'
  | 'PARANOIA_VOTE_RESOLVED'
  | 'SOCIAL_EFFECT_RESOLVED'
  | 'TURN_TIMED_OUT'
  | 'SOCIAL_TIMED_OUT'
  | 'GAME_WON'
  | 'DECK_RECYCLED';

export interface GameEvent<TPayload = unknown> {
  id: string;
  sessionId: string;
  revision: number;
  type: CoreGameEventType | string;
  visibility?: 'PUBLIC' | 'PLAYER_PRIVATE';
  recipientPlayerIds?: readonly string[];
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
    | 'PENDING_SOCIAL_EFFECT'
    | 'NO_PENDING_SOCIAL'
    | 'NO_PENDING_TARGET'
    | 'NO_PENDING_REACTION'
    | 'NO_PENDING_DUEL'
    | 'NO_PENDING_PROMPT'
    | 'INVALID_SOCIAL_TARGET'
    | 'INVALID_SOCIAL_PROMPT'
    | 'INVALID_SOCIAL_RESPONSE'
    | 'INVALID_NOPE_REACTION'
    | 'NO_NOPE_CARD'
    | 'NO_ELIGIBLE_PROMPT'
    | 'PROMPT_NOT_ELIGIBLE'
    | 'INELIGIBLE_NOPE'
    | 'PASS_NOT_ALLOWED'
    | 'REWIND_ALREADY_USED'
    | 'REWIND_NOT_ALLOWED'
    | 'NO_ALTERNATE_PROMPT'
    | 'INVALID_FLAG_TARGET'
    | 'GAME_ALREADY_FINISHED'
    | 'COMMAND_NOT_IMPLEMENTED'
    | 'INVALID_COMMAND'
    | 'INVALID_PLAYER_COUNT'
    | 'INVALID_SETUP'
    | 'DUPLICATE_PLAYER_ID'
    | 'PENDING_WILD_COLOR'
    | 'COMMAND_ID_COLLISION'
    | 'SESSION_MISMATCH'
    | 'NO_PENDING_TIMER'
    | 'TIMEOUT_NOT_REACHED'
    | 'STALE_TIMEOUT';
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
  timer: TimerState | null;
  social: import('./social.ts').SocialState | null;
  winnerId: string | null;
  rewindUsedByPlayerIds: string[];
  processedCommands: Record<string, ProcessedCommandRecord>;
  adaptiveProbability?: AdaptiveProbabilityState;
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

export interface AuthIdentitySummary {
  provider: 'telegram' | 'web';
  username?: string;
}

export interface AuthUser {
  id: string;
  displayName: string;
  displayUsername?: string;
  identities: AuthIdentitySummary[];
}

export interface TelegramMiniAppAuthRequest {
  initData: string;
}

export type TelegramAuthRequest = TelegramMiniAppAuthRequest;

export interface WebRegisterRequest {
  loginUsername: string;
  password: string;
  displayUsername: string;
  displayName?: string;
  email?: string;
}

export interface WebLoginRequest {
  loginUsername: string;
  password: string;
}

export interface WebAuthResponse {
  user: AuthUser;
}

export interface ProfileUpdateRequest {
  displayName?: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export interface WebTelegramLoginConfiguration {
  configured: boolean;
  error?: 'TELEGRAM_WEB_LOGIN_NOT_CONFIGURED';
}

export interface ClientConfig {
  apiUrl: string;
  wsUrl: string;
  platform: ClientPlatform;
  appEnv: 'development' | 'preview' | 'production';
}

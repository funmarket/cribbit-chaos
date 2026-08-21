import type { AnswerMode, AuthorshipMode, ParanoiaClassicRevealDecision, ParanoiaPhase, ParanoiaVoteChoice, PromptDestination } from './index.ts';

export type PromptWorld = 'UNDER_18_CLEAN' | '18+_ADULT';
export type SocialCardKind =
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
  | 'reverse_confession'
  | 'dig_me';
export type SocialTargeting = 'current' | 'specific' | 'all';
export type SocialAnswerStatus = 'WAITING' | 'MODE_SELECTED' | 'CAPTURING' | 'REVIEW' | 'SUBMITTED';
export type RevealState = 'SEALED' | 'REVEALED';
export type RoulettePresentationType = 'PLAYER' | 'PROMPT' | 'CHOICE' | 'CHAOS';
export type DuelJudgingMode = 'GROUP_VOTE' | 'OBJECTIVE';
export type PromptSourceChoice = 'MANUAL' | 'ROULETTE';
export type ChaosEffectId = 'BLIND_SWAP' | 'REVERSE_ORDER';
export type MachiavelliEffectId =
  | 'CONVERT_WEAK'
  | 'TABOO_ALL'
  | 'NO_MERCY'
  | 'PARANOIA_SPREADS'
  | 'DOUBLE_PRESSURE'
  | 'REVERSE_CONFESSION_ALL';
export type CanonicalInteractionStep =
  | 'PROMPT_SOURCE'
  | 'MANUAL_PROMPT'
  | 'PRIVATE_PREVIEW'
  | 'TARGET'
  | 'ANSWER'
  | 'PARANOIA_PHASE'
  | 'PARANOIA_CLASSIC_ANSWER'
  | 'PARANOIA_CLASSIC_DECISION'
  | 'PARANOIA_TARGET_ANSWER'
  | 'PARANOIA_VOTE'
  | 'DUEL_TIMER'
  | 'DUEL_INITIATOR'
  | 'DUEL_OPPONENT'
  | 'DUEL_VOTE'
  | 'CHAOS_RESOLVE'
  | 'TABOO_QUESTION'
  | 'TABOO_ANSWER'
  | 'GROUP_QUESTION'
  | 'GROUP_ANSWER'
  | 'GROUP_DARE'
  | 'GROUP_COMPLETE'
  | 'MACHIAVELLI_CHOICE'
  | 'REVERSE_QUESTION'
  | 'REVERSE_ANSWER'
  | 'DIG_QUESTION'
  | 'DIG_ANSWER'
  | 'RESOLVED';

export type DuelObjectiveEvaluation =
  | { kind: 'EXACT_TEXT'; answer: string; caseSensitive?: boolean }
  | { kind: 'CHOICE'; correctChoice: string }
  | { kind: 'NUMERIC_CLOSEST'; answer: number };

export interface SocialPrompt {
  id: string;
  kind: SocialCardKind;
  text: string;
  world: PromptWorld;
  stage: number;
  groupSizeMin: number;
  groupSizeMax: number;
  intensity: number;
  language: string;
  callSuitability: string;
  targeting: SocialTargeting;
  repeatGroup?: string;
  antiRepeatKey?: string;
  options?: readonly string[];
  authorshipMode: AuthorshipMode;
  destination: PromptDestination;
  duelJudgingMode?: DuelJudgingMode;
  duelObjectiveEvaluation?: DuelObjectiveEvaluation;
}

export interface PromptEligibilityRequest {
  kind: SocialCardKind;
  world: PromptWorld;
  stage: number;
  groupSize: number;
  intensity: number;
  language: string;
  callSuitability: string;
  targeting: SocialTargeting;
  excludePromptIds?: readonly string[];
  excludeRepeatGroups?: readonly string[];
  excludeAntiRepeatKeys?: readonly string[];
}

export interface SelectedPromptSnapshot {
  promptId: string;
  prompt: SocialPrompt;
  selection: PromptEligibilityRequest;
  selectedByPlayerId: string;
  selectedAtRevision: number;
}

export interface RoulettePresentation {
  id: string;
  type: RoulettePresentationType;
  selectedResultId: string;
  candidateResultIds: readonly string[];
  revealState: RevealState;
  presentationSeed?: string;
  displayLabels?: Readonly<Record<string, string>>;
  startTimestamp?: string;
  durationHintMs?: number;
}

export interface RoulettePresentationView extends Omit<RoulettePresentation, 'selectedResultId' | 'candidateResultIds'> {
  selectedResultId?: string;
  candidateResultIds?: readonly string[];
}

export interface SocialAuthorshipState {
  mode: AuthorshipMode;
  authorPlayerId: string | null;
  revealState: RevealState;
  revealedAuthorPlayerId: string | null;
}

export interface SocialAuthorshipView {
  mode: AuthorshipMode;
  revealState: RevealState;
  authorPlayerId?: string;
}

export interface SocialAnswerRecord {
  status: SocialAnswerStatus;
  mode: AnswerMode | null;
  value?: string;
  choice?: string;
  completionOnly: boolean;
  submittedByPlayerId: string | null;
  submittedAtRevision: number | null;
}

export interface SocialReactionRecord {
  effectKind: SocialCardKind;
  effectCardId: string;
  actorId: string;
  targetPlayerId: string;
  eligiblePlayerIds: readonly string[];
  eligible: boolean;
  blocked: boolean;
  blockedByPlayerId: string | null;
  blockedByCardId: string | null;
}

export interface SocialDuelResponseRecord {
  playerId: string;
  submitted: boolean;
  mode: AnswerMode | null;
  value?: string;
  choice?: string;
  completionOnly: boolean;
  submittedAtRevision: number | null;
}

export interface SocialDuelVoteState {
  eligibleVoterIds: readonly string[];
  votes: Record<string, string>;
  resolutionApplied: boolean;
}

export interface SocialDuelRecord {
  initiatorId: string;
  opponentId: string | null;
  prompt: SocialPrompt | null;
  initiatorResponse: SocialDuelResponseRecord | null;
  opponentResponse: SocialDuelResponseRecord | null;
  resolutionReady: boolean;
  winnerId: string | null;
  vote: SocialDuelVoteState | null;
}

export interface SocialParanoiaVoteState {
  phase: ParanoiaPhase;
  eligibleVoterIds: readonly string[];
  votes: Record<string, ParanoiaVoteChoice>;
  resolutionApplied: boolean;
}

/**
 * Shared live interaction state. Existing specialised fields remain for the
 * mature Truth/Dare/Paranoia/Duel APIs; the canonical fields below model the
 * complete browser + Telegram interaction pipeline without client-owned state.
 */
export interface SocialState {
  cardId: string;
  cardKind: SocialCardKind;
  actorId: string;
  prompt: SocialPrompt | null;
  promptSelection: SelectedPromptSnapshot | null;
  roulettePresentation: RoulettePresentation | null;
  authorship: SocialAuthorshipState | null;
  pendingTargetId: string | null;
  pendingTargetIds: string[];
  pendingCompletionPlayerIds: string[];
  completedCompletionPlayerIds: string[];
  completionRecords: Record<string, SocialAnswerRecord>;
  pendingReaction: SocialReactionRecord | null;
  pendingDuel: SocialDuelRecord | null;
  paranoiaPhase: ParanoiaPhase | null;
  paranoiaVote: SocialParanoiaVoteState | null;
  classicAnswerPlayerId: string | null;
  classicRevealDecision: ParanoiaClassicRevealDecision | null;
  answerState: SocialAnswerRecord;
  resolutionComplete: boolean;
  mayAdvanceTurn: boolean;
  blockedByNope: boolean;

  canonicalStep?: CanonicalInteractionStep;
  promptSource?: PromptSourceChoice | null;
  manualPrompt?: string | null;
  duelTimerSeconds?: 15 | 30 | 45 | null;
  chaosEffectId?: ChaosEffectId | null;
  machiavelliEffectId?: MachiavelliEffectId | null;
  question?: string | null;
  questionAskedLive?: boolean;
  groupOptions?: string[];
  groupAnswers?: Record<string, string>;
  groupDare?: string | null;
  groupCompletions?: Record<string, 'DONE' | 'PASS'>;
  outcome?: string | null;
  forced?: boolean;
}

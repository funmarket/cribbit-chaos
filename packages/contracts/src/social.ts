import type { AnswerMode, AuthorshipMode, ParanoiaClassicRevealDecision, ParanoiaPhase, ParanoiaVoteChoice, PromptDestination } from './index.ts';

export type PromptWorld = 'UNDER_18_CLEAN' | '18+_ADULT';
export type SocialCardKind = 'truth' | 'dare' | 'paranoia' | 'chaos' | 'duel' | 'nope';
export type SocialTargeting = 'current' | 'specific' | 'all';
export type SocialAnswerStatus = 'WAITING' | 'MODE_SELECTED' | 'CAPTURING' | 'REVIEW' | 'SUBMITTED';
export type RevealState = 'SEALED' | 'REVEALED';
export type RoulettePresentationType = 'PLAYER' | 'PROMPT' | 'CHOICE' | 'CHAOS';
export type DuelJudgingMode = 'GROUP_VOTE' | 'OBJECTIVE';

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
}

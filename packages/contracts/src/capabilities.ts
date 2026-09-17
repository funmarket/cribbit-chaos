import type { CardColor, CardKind, GameCommand } from './index.ts';

export type RequiredActionKind =
  | 'PLAY_OR_DRAW'
  | 'CHOOSE_COLOR'
  | 'SELECT_TARGET'
  | 'SELECT_ANSWER_MODE'
  | 'SUBMIT_COMPLETION'
  | 'CAST_VOTE'
  | 'WAIT';

export type LegalCommandCategory =
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'COLOR'
  | 'TARGET'
  | 'ANSWER_MODE'
  | 'COMPLETION'
  | 'VOTE';

export interface LegalCommandPresentation {
  category: LegalCommandCategory;
  cardInstanceId?: string;
  cardKind?: CardKind;
  targetPlayerId?: string;
  color?: CardColor;
  answerMode?: 'ANSWERED_LIVE';
  voteForPlayerId?: string;
}

export interface LegalCommandOption {
  optionId: string;
  command: GameCommand;
  presentation: LegalCommandPresentation;
}

export interface PlayerDecisionCapabilities {
  requiredAction: RequiredActionKind | null;
  options: readonly LegalCommandOption[];
}

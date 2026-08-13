import type { AuthorshipMode, CardKind, GameCommandType, AnswerMode } from '@cribbit/contracts';

export type CardFamily =
  | 'truth'
  | 'dare'
  | 'paranoia'
  | 'chaos'
  | 'duel'
  | 'nope'
  | 'wild'
  | 'pass'
  | 'rewind'
  | 'roulette'
  | 'spice'
  | 'flag'
  | 'keyrule'
  | 'answer'
  | 'voice'
  | 'authorship'
  | 'stage'
  | 'intensity';

export type CardBackKind = 'classic' | 'chaos_tier' | 'house_deck';

export type CardAssetSize = 'master' | 'web-medium' | 'mobile' | 'thumbnail';

export type RuntimeCardRole =
  | 'playable-social-card'
  | 'playable-core-card'
  | 'reaction-card'
  | 'safety-action'
  | 'answer-mode'
  | 'answer-constraint'
  | 'authorship-mode'
  | 'presentation-metadata'
  | 'rules-reference'
  | 'stage-card'
  | 'intensity-card';

export interface GameCardMapping {
  readonly engineKind?: Extract<CardKind, 'wild' | 'truth' | 'dare' | 'paranoia' | 'chaos' | 'duel' | 'nope'>;
  readonly actionId?: GameCommandType;
  readonly secondaryActionId?: GameCommandType;
  readonly responseMode?: AnswerMode;
  readonly authorshipMode?: AuthorshipMode;
  readonly runtimeRole: RuntimeCardRole;
  readonly ambiguity?: string;
}

export interface CardDefinition {
  readonly id: string;
  readonly type: string;
  readonly family: CardFamily;
  readonly title: string;
  readonly instruction: string;
  readonly variant: number;
  readonly filename: string;
  readonly frontAsset: string;
  readonly defaultBack: CardBackKind;
  readonly gameMapping: GameCardMapping;
}

export interface CardBackDefinition {
  readonly kind: CardBackKind;
  readonly filename: string;
  readonly asset: string;
  readonly label: string;
}

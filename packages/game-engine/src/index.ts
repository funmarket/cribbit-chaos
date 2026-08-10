export type {
  Card,
  CardColor,
  GameCommand,
  GameCommandType,
  GameConfig,
  GameConfigInput,
  GameEvent,
  GamePhase,
  GameState,
  GameStatus,
  GameTransition,
  PendingEffect,
  Player,
  PlayerStatus,
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
  SocialPrompt,
  SocialReactionRecord,
  SocialState,
  SocialTargeting
} from '@cribbit/contracts';

export { createEngineError } from './errors.ts';
export { buildCoreDeck, drawCards, recycleDiscardPile } from './deck.ts';
export { applyCommand } from './reducer.ts';
export { createGame } from './setup.ts';
export { advanceTurn, getCurrentPlayer, getNextPlayerIndex, getPlayerIndex } from './turn.ts';
export { isLegalPlay, validateDraw, validatePlay, validateWildColor } from './validation.ts';
export {
  createAuthorshipState,
  createRoulettePresentation,
  projectAuthorship,
  projectRoulettePresentation,
  selectPromptForSocialEffect,
  type GameCommandContext,
  type SocialPromptSelection
} from './social.ts';


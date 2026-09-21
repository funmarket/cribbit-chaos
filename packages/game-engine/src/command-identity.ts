import type { GameCommand } from '@cribbit/contracts';

/**
 * Stable semantic identity for a gameplay command.
 *
 * commandId is the external idempotency key and expectedRevision is an execution precondition,
 * so neither is part of the semantic fingerprint. Session, actor, command type and payload are.
 */
export function fingerprintGameCommand(command: GameCommand): string {
  switch (command.type) {
    case 'PLAY_CARD':
      return [command.sessionId, command.type, command.playerId, command.cardId].join('|');
    case 'DRAW_CARD':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'SELECT_WILD_COLOR':
      return [command.sessionId, command.type, command.playerId, command.color].join('|');
    case 'PASS_PROMPT':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'REWIND_PROMPT':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'FLAG_PROMPT':
      return [command.sessionId, command.type, command.playerId, command.promptId, command.reasonCode ?? ''].join('|');
    case 'SELECT_ANSWER_MODE':
      return [command.sessionId, command.type, command.playerId, command.mode].join('|');
    case 'SELECT_PARANOIA_PHASE':
      return [command.sessionId, command.type, command.playerId, command.phase].join('|');
    case 'SELECT_PARANOIA_CLASSIC_ANSWER':
      return [command.sessionId, command.type, command.playerId, command.targetId].join('|');
    case 'SUBMIT_PARANOIA_CLASSIC_DECISION':
      return [command.sessionId, command.type, command.playerId, command.decision].join('|');
    case 'REVIEW_ANSWER':
      return [command.sessionId, command.type, command.playerId, command.value ?? '', command.choice ?? '', String(command.completionOnly ?? false)].join('|');
    case 'SUBMIT_CHOICE':
      return [command.sessionId, command.type, command.playerId, command.choice].join('|');
    case 'MARK_ANSWERED_LIVE':
      return [command.sessionId, command.type, command.playerId].join('|');
    case 'SELECT_PARANOIA_TARGET':
    case 'SELECT_DUEL_TARGET':
    case 'SELECT_SOCIAL_TARGET':
    case 'PARANOIA_CHOICE':
    case 'DUEL_TARGET':
    case 'CHAOS_TARGET':
      return [command.sessionId, command.type, command.playerId, command.targetId].join('|');
    case 'SELECT_MACHIAVELLI_EFFECT':
      return [command.sessionId, command.type, command.playerId, command.effect].join('|');
    case 'SUBMIT_PARANOIA_VOTE':
      return [command.sessionId, command.type, command.playerId, command.vote].join('|');
    case 'DUEL_VOTE':
      return [command.sessionId, command.type, command.playerId, command.winnerId].join('|');
    case 'SUBMIT_DUEL_RESPONSE':
      return [command.sessionId, command.type, command.playerId, command.side, command.value ?? '', command.choice ?? '', String(command.completionOnly ?? false)].join('|');
    case 'PLAY_NOPE':
      return [command.sessionId, command.type, command.playerId, command.cardId].join('|');
    case 'TIMEOUT_TURN':
    case 'TIMEOUT_SOCIAL':
      return [command.sessionId, command.type, command.playerId, command.timerStartedAtRevision].join('|');
    case 'SUBMIT_ANSWER':
      return [command.sessionId, command.type, command.playerId].join('|');
    default:
      return [command.sessionId, command.type, command.playerId].join('|');
  }
}

import type { GameCommand } from '@cribbit/contracts';

function base(command: GameCommand): [string, string, string] {
  return [command.sessionId, command.type, command.playerId];
}

function finish(command: never): never {
  throw new Error(`Unhandled game command fingerprint: ${JSON.stringify(command)}`);
}

/**
 * Stable semantic identity for a gameplay command.
 *
 * commandId is the external idempotency key and expectedRevision is an execution precondition,
 * so neither is part of the semantic fingerprint. Session, actor, command type and semantic
 * payload are. Every GameCommand variant is handled explicitly so new payload-bearing commands
 * cannot silently fall through without a typecheck failure.
 */
export function fingerprintGameCommand(command: GameCommand): string {
  switch (command.type) {
    case 'PLAY_CARD':
    case 'ACTIVATE_GHOST':
    case 'PLAY_NOPE':
      return [...base(command), command.cardId].join('|');

    case 'SELECT_WILD_COLOR':
      return [...base(command), command.color].join('|');

    case 'FLAG_PROMPT':
      return [...base(command), command.promptId, command.reasonCode ?? ''].join('|');

    case 'SELECT_ANSWER_MODE':
      return [...base(command), command.mode].join('|');

    case 'SELECT_PARANOIA_PHASE':
      return [...base(command), command.phase].join('|');

    case 'SELECT_PARANOIA_CLASSIC_ANSWER':
    case 'SELECT_PARANOIA_TARGET':
    case 'SELECT_DUEL_TARGET':
    case 'SELECT_SOCIAL_TARGET':
    case 'PARANOIA_CHOICE':
    case 'DUEL_TARGET':
    case 'CHAOS_TARGET':
      return [...base(command), command.targetId].join('|');

    case 'SUBMIT_PARANOIA_CLASSIC_DECISION':
      return [...base(command), command.decision].join('|');

    case 'REVIEW_ANSWER':
      return [...base(command), command.value ?? '', command.choice ?? '', String(command.completionOnly ?? false)].join('|');

    case 'SUBMIT_CHOICE':
      return [...base(command), command.choice].join('|');

    case 'SELECT_MACHIAVELLI_EFFECT':
      return [...base(command), command.effect].join('|');

    case 'SUBMIT_PARANOIA_VOTE':
      return [...base(command), command.vote].join('|');

    case 'DUEL_VOTE':
      return [...base(command), command.winnerId].join('|');

    case 'SUBMIT_DUEL_RESPONSE':
      return [...base(command), command.side, command.value ?? '', command.choice ?? '', String(command.completionOnly ?? false)].join('|');

    case 'NOPE_REACTION':
      return [...base(command), String(command.useNope)].join('|');

    case 'TIMEOUT_TURN':
    case 'TIMEOUT_SOCIAL':
      return [...base(command), String(command.timerStartedAtRevision)].join('|');

    case 'START_GAME':
    case 'DRAW_CARD':
    case 'REVEAL_PROMPT':
    case 'PUBLISH_PROMPT':
    case 'REWIND_PROMPT':
    case 'PASS_PROMPT':
    case 'SUBMIT_ANSWER':
    case 'MARK_ANSWERED_LIVE':
    case 'COMPLETE_FLOW':
    case 'FORCE_RECAP':
      return base(command).join('|');

    default:
      return finish(command);
  }
}

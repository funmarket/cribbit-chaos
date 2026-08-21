import type { GameCommand, GameEvent, GameState, GameTransition, ProcessedCommandRecord } from '@cribbit/contracts';
import { makeEvent } from './events.ts';
import { applyCommand as reduceCommand } from './reducer.ts';
import { createTurnResolution, type GameCommandContext } from './social.ts';
import { createEngineError } from './errors.ts';
import { applyCanonicalCommand, reconcileBonusTurnAfterBase, shouldHandleCanonical } from './canonical-flow.ts';

const CANONICAL_ONLY_COMMANDS = new Set<GameCommand['type']>([
  'SELECT_PROMPT_SOURCE','SUBMIT_MANUAL_PROMPT','SELECT_DARE_TARGET','SELECT_DUEL_TIMER','RESOLVE_CHAOS',
  'SELECT_TAG_TARGET','SELECT_HIJACK_TARGET','SELECT_TABOO_TARGET','SUBMIT_TABOO_QUESTION','SUBMIT_TABOO_ANSWER',
  'SUBMIT_GROUP_QUESTION','SUBMIT_GROUP_ANSWER','SUBMIT_GROUP_DARE','COMPLETE_GROUP_DARE','SELECT_MACHIAVELLI_EFFECT',
  'SELECT_REVERSE_CONFESSION_TARGET','SUBMIT_REVERSE_CONFESSION_QUESTION','SUBMIT_REVERSE_CONFESSION_ANSWER',
  'SELECT_DIG_ME_TARGET','SUBMIT_DIG_ME_QUESTION','COMPLETE_DIG_ME','ACTIVATE_GHOST','END_GHOST_TURN',
]);

type CanonicalContext = GameCommandContext & { canonicalFlow?: boolean };

function clone<T>(value: T): T { return structuredClone(value); }
function fingerprint(command: GameCommand & { type:'PLAY_NOPE' }): string { return [command.sessionId, command.type, command.playerId, command.cardId].join('|'); }

function recordOutcome<TState extends GameState>(state:TState,command:GameCommand & { type:'PLAY_NOPE' },ok:boolean,events:GameEvent[],error?:ReturnType<typeof createEngineError>):TState {
  const nextState=clone(state);
  const record:ProcessedCommandRecord={commandId:command.commandId,type:command.type,playerId:command.playerId,fingerprint:fingerprint(command),revision:nextState.revision,ok,events,...(error?{error}:{})};
  nextState.processedCommands={...nextState.processedCommands,[command.commandId]:record};
  return nextState;
}
function failCommand<TState extends GameState>(state:TState,command:GameCommand & { type:'PLAY_NOPE' },error:ReturnType<typeof createEngineError>):GameTransition<TState>{const nextState=recordOutcome(state,command,false,[],error);return{ok:false,state:nextState,events:[],error};}
function collision<TState extends GameState>(state:TState):GameTransition<TState>{return{ok:false,state,events:[],error:createEngineError('COMMAND_ID_COLLISION','This commandId was already used for a different command.')}}
function replayIfKnown<TState extends GameState>(state:TState,command:GameCommand & { type:'PLAY_NOPE' }):GameTransition<TState>|null{const prior=state.processedCommands[command.commandId];if(!prior)return null;if(prior.type!==command.type||prior.playerId!==command.playerId||prior.fingerprint!==fingerprint(command))return collision(state);return{ok:prior.ok,state,events:[],error:prior.error,idempotentReplay:true};}

/** Legacy Nope compatibility for compatibility-mode states. */
function applyPlayNope<TState extends GameState>(state:TState,command:GameCommand & { type:'PLAY_NOPE' },context:GameCommandContext={}):GameTransition<TState>{
  const replay=replayIfKnown(state,command);if(replay)return replay;
  if(command.sessionId!==state.id)return failCommand(state,command,createEngineError('SESSION_MISMATCH','The Nope command belongs to a different game session.'));
  if(command.expectedRevision!==state.revision)return failCommand(state,command,createEngineError('STALE_REVISION','The game state changed before this Nope was played.'));
  if(state.status!=='ACTIVE')return failCommand(state,command,createEngineError('GAME_ALREADY_FINISHED','The game has already finished.'));
  const social=state.social;
  if(!social)return failCommand(state,command,createEngineError('NO_PENDING_SOCIAL','No social effect is currently pending.'));
  if(social.cardKind!=='truth'&&social.cardKind!=='dare')return failCommand(state,command,createEngineError('INELIGIBLE_NOPE','Nope is currently defined only for Truth or Dare.'));
  if(!context.promptPool?.length)return failCommand(state,command,createEngineError('INELIGIBLE_NOPE','No authoritative Truth or Dare prompt context is available for this Nope reaction.'));
  if(social.resolutionComplete)return failCommand(state,command,createEngineError('INVALID_NOPE_REACTION','The current Truth or Dare is already resolved.'));
  if(social.actorId!==command.playerId)return failCommand(state,command,createEngineError('INVALID_NOPE_REACTION','Only the affected Truth or Dare player may use Nope.'));
  const sourcePlayer=state.players.find(player=>player.id===command.playerId);const nopeIndex=sourcePlayer?.hand.findIndex(card=>card.id===command.cardId&&card.kind==='nope')??-1;
  if(!sourcePlayer||nopeIndex<0)return failCommand(state,command,createEngineError('NO_NOPE_CARD','The affected player does not hold that Nope card.'));
  let nextState=clone(state);const player=nextState.players.find(item=>item.id===command.playerId)!;const[nopeCard]=player.hand.splice(player.hand.findIndex(card=>card.id===command.cardId),1);nextState.discardPile.push(nopeCard);
  const events:GameEvent[]=[makeEvent(nextState,'NOPE_PLAYED',{playerId:player.id,cardId:nopeCard.id,blockedCardId:social.cardId,blockedCardKind:social.cardKind},0,'PUBLIC')];
  createTurnResolution(nextState,player,events,social.cardKind,1,'blocked',context.now);nextState.revision=state.revision+1;events.forEach(event=>{event.revision=nextState.revision;});nextState=recordOutcome(nextState,command,true,events);return{ok:true,state:nextState,events};
}

/**
 * Live Railway and explicit simulation contexts opt into the canonical engine.
 * Old compatibility-mode regression tests may continue to exercise the mature
 * reducer until their fixtures are migrated; new canonical commands and a state
 * that already carries canonicalStep always stay on the canonical path.
 */
export function applyCommand<TState extends GameState>(state:TState,command:GameCommand,context:GameCommandContext={}):GameTransition<TState>{
  const canonicalContext=(context as CanonicalContext).canonicalFlow===true;
  const canonicalState=Boolean(state.social?.canonicalStep);
  const canonicalOnly=CANONICAL_ONLY_COMMANDS.has(command.type);
  if((canonicalContext||canonicalState||canonicalOnly)&&shouldHandleCanonical(state,command))return applyCanonicalCommand(state,command,context);
  if(command.type==='PLAY_NOPE')return applyPlayNope(state,command,context);
  const reduced=reduceCommand(state,command,context);
  return canonicalContext?reconcileBonusTurnAfterBase(state,command,reduced,context):reduced;
}

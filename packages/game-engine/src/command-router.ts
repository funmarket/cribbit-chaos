import type { GameCommand, GameEvent, GameState, GameTransition, ProcessedCommandRecord } from '@cribbit/contracts';
import { makeEvent } from './events.ts';
import { applyCommand as reduceCommand } from './reducer.ts';
import { createTurnResolution, type GameCommandContext } from './social.ts';
import { createEngineError } from './errors.ts';
import { applyCanonicalCommand, reconcileBonusTurnAfterBase, shouldHandleCanonical } from './canonical-flow.ts';
import { applyCanonicalSafety, isCanonicalSafetyCommand } from './canonical-safety.ts';

const CANONICAL_ONLY_COMMANDS=new Set<GameCommand['type']>(['SELECT_PROMPT_SOURCE','SUBMIT_MANUAL_PROMPT','SELECT_DARE_TARGET','SELECT_DUEL_TIMER','RESOLVE_CHAOS','SELECT_TAG_TARGET','SELECT_HIJACK_TARGET','SELECT_TABOO_TARGET','SUBMIT_TABOO_QUESTION','SUBMIT_TABOO_ANSWER','SUBMIT_GROUP_QUESTION','SUBMIT_GROUP_ANSWER','SUBMIT_GROUP_DARE','COMPLETE_GROUP_DARE','SELECT_MACHIAVELLI_EFFECT','SELECT_REVERSE_CONFESSION_TARGET','SUBMIT_REVERSE_CONFESSION_QUESTION','SUBMIT_REVERSE_CONFESSION_ANSWER','SELECT_DIG_ME_TARGET','SUBMIT_DIG_ME_QUESTION','COMPLETE_DIG_ME','ACTIVATE_GHOST','END_GHOST_TURN']);
const GHOST_IMMEDIATE_PLAY_KINDS=new Set(['number','skip','reverse','draw','ghost']);
type CanonicalContext=GameCommandContext&{canonicalFlow?:boolean};
function clone<T>(value:T):T{return structuredClone(value);}
function nopeFingerprint(command:GameCommand&{type:'PLAY_NOPE'}):string{return[command.sessionId,command.type,command.playerId,command.cardId].join('|');}
function canonicalFingerprint(command:GameCommand):string{const{commandId:_id,expectedRevision:_revision,...stable}=command;return JSON.stringify(stable);}
function canonicalReplay<T extends GameState>(state:T,command:GameCommand):GameTransition<T>|null{const prior=state.processedCommands[command.commandId];if(!prior)return null;if(prior.type!==command.type||prior.playerId!==command.playerId||prior.fingerprint!==canonicalFingerprint(command))return{ok:false,state,events:[],error:createEngineError('COMMAND_ID_COLLISION','This commandId was already used for a different command.')};return{ok:prior.ok,state,events:[],error:prior.error,idempotentReplay:true};}
function recordOutcome<TState extends GameState>(state:TState,command:GameCommand&{type:'PLAY_NOPE'},ok:boolean,events:GameEvent[],error?:ReturnType<typeof createEngineError>):TState{const nextState=clone(state);const record:ProcessedCommandRecord={commandId:command.commandId,type:command.type,playerId:command.playerId,fingerprint:nopeFingerprint(command),revision:nextState.revision,ok,events,...(error?{error}:{})};nextState.processedCommands={...nextState.processedCommands,[command.commandId]:record};return nextState;}
function failCommand<TState extends GameState>(state:TState,command:GameCommand&{type:'PLAY_NOPE'},error:ReturnType<typeof createEngineError>):GameTransition<TState>{const nextState=recordOutcome(state,command,false,[],error);return{ok:false,state:nextState,events:[],error};}
function collision<TState extends GameState>(state:TState):GameTransition<TState>{return{ok:false,state,events:[],error:createEngineError('COMMAND_ID_COLLISION','This commandId was already used for a different command.')}}
function replayIfKnown<TState extends GameState>(state:TState,command:GameCommand&{type:'PLAY_NOPE'}):GameTransition<TState>|null{const prior=state.processedCommands[command.commandId];if(!prior)return null;if(prior.type!==command.type||prior.playerId!==command.playerId||prior.fingerprint!==nopeFingerprint(command))return collision(state);return{ok:prior.ok,state,events:[],error:prior.error,idempotentReplay:true};}

function applyPlayNope<TState extends GameState>(state:TState,command:GameCommand&{type:'PLAY_NOPE'},context:GameCommandContext={}):GameTransition<TState>{
  const replay=replayIfKnown(state,command);if(replay)return replay;if(command.sessionId!==state.id)return failCommand(state,command,createEngineError('SESSION_MISMATCH','The Nope command belongs to a different game session.'));if(command.expectedRevision!==state.revision)return failCommand(state,command,createEngineError('STALE_REVISION','The game state changed before this Nope was played.'));if(state.status!=='ACTIVE')return failCommand(state,command,createEngineError('GAME_ALREADY_FINISHED','The game has already finished.'));
  const social=state.social;if(!social)return failCommand(state,command,createEngineError('NO_PENDING_SOCIAL','No social effect is currently pending.'));if(social.cardKind!=='truth'&&social.cardKind!=='dare')return failCommand(state,command,createEngineError('INELIGIBLE_NOPE','Nope is currently defined only for Truth or Dare.'));if(!context.promptPool?.length)return failCommand(state,command,createEngineError('INELIGIBLE_NOPE','No authoritative Truth or Dare prompt context is available for this Nope reaction.'));if(social.resolutionComplete)return failCommand(state,command,createEngineError('INVALID_NOPE_REACTION','The current Truth or Dare is already resolved.'));if(social.actorId!==command.playerId)return failCommand(state,command,createEngineError('INVALID_NOPE_REACTION','Only the affected Truth or Dare player may use Nope.'));
  const sourcePlayer=state.players.find(player=>player.id===command.playerId);const nopeIndex=sourcePlayer?.hand.findIndex(card=>card.id===command.cardId&&card.kind==='nope')??-1;if(!sourcePlayer||nopeIndex<0)return failCommand(state,command,createEngineError('NO_NOPE_CARD','The affected player does not hold that Nope card.'));
  let nextState=clone(state);const player=nextState.players.find(item=>item.id===command.playerId)!;const[nopeCard]=player.hand.splice(player.hand.findIndex(card=>card.id===command.cardId),1);nextState.discardPile.push(nopeCard);const events:GameEvent[]=[makeEvent(nextState,'NOPE_PLAYED',{playerId:player.id,cardId:nopeCard.id,blockedCardId:social.cardId,blockedCardKind:social.cardKind},0,'PUBLIC')];createTurnResolution(nextState,player,events,social.cardKind,1,'blocked',context.now);nextState.revision=state.revision+1;events.forEach(event=>{event.revision=nextState.revision;});nextState=recordOutcome(nextState,command,true,events);return{ok:true,state:nextState,events};
}

function ghostOwnerWhoseTurnCompleted(before:GameState,command:GameCommand,after:GameState):string|null{
  const priorSocial=before.social;
  if(priorSocial?.canonicalStep&&!priorSocial.forced){
    const owner=before.players.find(player=>player.id===priorSocial.actorId);
    if((owner?.ghostTurnsRemaining??0)>0&&after.social?.cardId!==priorSocial.cardId)return priorSocial.actorId;
  }
  if(command.type==='PLAY_CARD'){
    const owner=before.players.find(player=>player.id===command.playerId);
    const played=owner?.hand.find(card=>card.id===command.cardId);
    if((owner?.ghostTurnsRemaining??0)>0&&played&&GHOST_IMMEDIATE_PLAY_KINDS.has(played.kind))return command.playerId;
  }
  if(command.type==='SELECT_WILD_COLOR'){
    const owner=before.players.find(player=>player.id===command.playerId);
    if((owner?.ghostTurnsRemaining??0)>0&&before.pendingEffect?.type==='WILD_COLOR'&&before.pendingEffect.playerId===command.playerId&&!after.pendingEffect)return command.playerId;
  }
  return null;
}

function reconcileCanonicalOwnership<TState extends GameState>(before:TState,command:GameCommand,result:GameTransition<TState>):GameTransition<TState>{
  if(!result.ok||result.idempotentReplay)return result;
  const next=result.state;
  let events=[...result.events];
  let changed=false;

  // Truth or Chaos is explicitly a whole-group card: the holder answers and,
  // on disagreement, completes the same group Dare alongside everyone else.
  if(next.social?.cardKind==='truth_or_chaos'&&next.social.canonicalStep==='GROUP_QUESTION'){
    const allPlayerIds=next.players.map(player=>player.id);
    if(allPlayerIds.some(id=>!next.social!.pendingTargetIds.includes(id))){next.social.pendingTargetIds=allPlayerIds;changed=true;}
  }

  const ghostOwnerId=ghostOwnerWhoseTurnCompleted(before,command,next);
  if(ghostOwnerId){
    const owner=next.players.find(player=>player.id===ghostOwnerId);
    if(owner&&(owner.ghostTurnsRemaining??0)>0){
      owner.ghostTurnsRemaining=Math.max(0,(owner.ghostTurnsRemaining??0)-1);
      const event=makeEvent(next,'GHOST_TURN_ENDED',{playerId:ghostOwnerId,turnsRemaining:owner.ghostTurnsRemaining},events.length,'PUBLIC');
      event.revision=next.revision;events.push(event);changed=true;
    }
  }

  if(changed){
    const processed=next.processedCommands[command.commandId];
    if(processed)next.processedCommands={...next.processedCommands,[command.commandId]:{...processed,events:[...events]}};
    return{...result,state:next,events};
  }
  return result;
}

export function applyCommand<TState extends GameState>(state:TState,command:GameCommand,context:GameCommandContext={}):GameTransition<TState>{
  const canonicalContext=(context as CanonicalContext).canonicalFlow===true,canonicalState=Boolean(state.social?.canonicalStep),canonicalOnly=CANONICAL_ONLY_COMMANDS.has(command.type);
  if(canonicalContext||canonicalState||canonicalOnly){const replay=canonicalReplay(state,command);if(replay)return replay;}
  if(isCanonicalSafetyCommand(state,command))return reconcileCanonicalOwnership(state,command,applyCanonicalSafety(state,command,context));
  if((canonicalContext||canonicalState||canonicalOnly)&&shouldHandleCanonical(state,command))return reconcileCanonicalOwnership(state,command,applyCanonicalCommand(state,command,context));
  if(command.type==='PLAY_NOPE')return reconcileCanonicalOwnership(state,command,applyPlayNope(state,command,context));
  const reduced=reduceCommand(state,command,context);const reconciled=canonicalContext?reconcileBonusTurnAfterBase(state,command,reduced,context):reduced;return canonicalContext?reconcileCanonicalOwnership(state,command,reconciled):reconciled;
}

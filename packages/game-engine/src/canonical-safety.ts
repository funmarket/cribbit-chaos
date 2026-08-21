import type { GameCommand, GameEvent, GameState, GameTransition, ProcessedCommandRecord } from '@cribbit/contracts';
import { createEngineError } from './errors.ts';
import { makeEvent } from './events.ts';
import {
  createAuthorshipState,
  createRoulettePresentation,
  selectPromptForSocialEffect,
  type GameCommandContext,
} from './social.ts';
import { clearTimer, startTimer } from './timer.ts';

function clone<T>(value:T):T{return structuredClone(value);}
function fingerprint(command:GameCommand):string{const{commandId:_id,expectedRevision:_revision,...stable}=command;return JSON.stringify(stable);}
function record<T extends GameState>(state:T,command:GameCommand,ok:boolean,events:GameEvent[],error?:ReturnType<typeof createEngineError>):T{
  const entry:ProcessedCommandRecord={commandId:command.commandId,type:command.type,playerId:command.playerId,fingerprint:fingerprint(command),revision:state.revision,ok,events:[...events],...(error?{error}:{})};
  state.processedCommands={...state.processedCommands,[command.commandId]:entry};return state;
}
function fail<T extends GameState>(state:T,command:GameCommand,code:Parameters<typeof createEngineError>[0],message:string):GameTransition<T>{const error=createEngineError(code,message);const next=clone(state);record(next,command,false,[],error);return{ok:false,state:next,events:[],error};}
function commit<T extends GameState>(before:T,next:T,command:GameCommand,events:GameEvent[]):GameTransition<T>{next.revision=before.revision+1;events.forEach((event,index)=>{event.revision=next.revision;event.id=`${next.id}:r${next.revision}:${event.type}:${index}`;});record(next,command,true,events);return{ok:true,state:next,events};}

export function isCanonicalSafetyCommand(state:GameState,command:GameCommand):boolean{
  return Boolean(state.social?.canonicalStep)&&['REWIND_PROMPT','FLAG_PROMPT'].includes(command.type);
}

export function applyCanonicalSafety<T extends GameState>(state:T,command:GameCommand,context:GameCommandContext={}):GameTransition<T>{
  if(command.sessionId!==state.id)return fail(state,command,'SESSION_MISMATCH','The command belongs to a different game session.');
  if(command.expectedRevision!==state.revision)return fail(state,command,'STALE_REVISION','The game state changed before this command arrived.');
  if(state.status!=='ACTIVE')return fail(state,command,'GAME_ALREADY_FINISHED','The game has already finished.');
  const social=state.social;if(!social)return fail(state,command,'NO_PENDING_SOCIAL','No interaction is active.');

  if(command.type==='FLAG_PROMPT'){
    if(!social.prompt||social.prompt.id!==command.promptId)return fail(state,command,'INVALID_FLAG_TARGET','Only the currently active prompt may be flagged.');
    const next=clone(state);const events=[makeEvent(next,'CONTENT_FLAGGED',{promptId:command.promptId,flaggedByPlayerId:command.playerId,reasonCode:command.reasonCode??'USER_FLAG',cardKind:social.cardKind},0,'PLAYER_PRIVATE',[command.playerId])];
    return commit(state,next,command,events);
  }

  if(command.type==='REWIND_PROMPT'){
    if(!['truth','dare'].includes(social.cardKind)||social.canonicalStep!=='PRIVATE_PREVIEW'||social.promptSource!=='ROULETTE'||!social.prompt)return fail(state,command,'REWIND_NOT_ALLOWED','Rewind is available only for a private Roulette Truth or Dare prompt.');
    if(social.actorId!==command.playerId)return fail(state,command,'REWIND_NOT_ALLOWED','Only the card holder may Rewind this private prompt.');
    if(state.rewindUsedByPlayerIds.includes(command.playerId))return fail(state,command,'REWIND_ALREADY_USED','This player already used Rewind in this game.');
    const excluded=[...(context.promptProfile?.excludePromptIds??[]),social.prompt.id];
    const targeting=social.cardKind==='dare'?'specific':'current';
    const selected=selectPromptForSocialEffect(state,social.cardKind,targeting,{...context,promptProfile:{...(context.promptProfile??{}),excludePromptIds:excluded}});
    if('code' in selected)return fail(state,command,selected.code==='NO_ELIGIBLE_PROMPT'?'NO_ALTERNATE_PROMPT':selected.code,selected.message);
    const next=clone(state);const nextSocial=next.social!;
    nextSocial.prompt=selected.prompt;
    nextSocial.promptSelection={promptId:selected.prompt.id,prompt:selected.prompt,selection:selected.selection,selectedByPlayerId:command.playerId,selectedAtRevision:state.revision+1};
    nextSocial.authorship=createAuthorshipState(selected.prompt,context);
    nextSocial.roulettePresentation=createRoulettePresentation(next,'PROMPT',selected.prompt.id,selected.candidateResultIds);
    next.rewindUsedByPlayerIds=[...next.rewindUsedByPlayerIds,command.playerId];
    clearTimer(next);startTimer(next,'SOCIAL',command.playerId,context.now);
    const events=[makeEvent(next,'PROMPT_REWOUND',{playerId:command.playerId,oldPromptId:social.prompt.id,newPromptId:selected.prompt.id},0,'PLAYER_PRIVATE',[command.playerId])];
    return commit(state,next,command,events);
  }

  return fail(state,command,'INVALID_COMMAND','This is not a canonical safety command.');
}

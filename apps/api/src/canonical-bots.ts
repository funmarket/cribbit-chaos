import { randomUUID } from 'node:crypto';
import type { GameCommand, GameEvent, GameState, MachiavelliEffectId } from '../../../packages/contracts/src/index.ts';
import { applyCommand, isLegalPlay } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';

const BOT_PREFIX='bot:';
export function isBotPlayerId(playerId:string):boolean{return playerId.startsWith(BOT_PREFIX);}

type RoomBotConfig={sources?:Record<string,boolean>;ceiling?:number};
function context(config?:RoomBotConfig,now=Date.now()){return{canonicalFlow:true,now,promptPool:promptPoolForSources(config?.sources),promptProfile:{stage:Number.MAX_SAFE_INTEGER,intensity:Number.isFinite(Number(config?.ceiling))?Number(config?.ceiling):Number.MAX_SAFE_INTEGER,language:'*',callSuitability:'*'}};}
function command(state:GameState,playerId:string,body:any):GameCommand{return{...body,commandId:randomUUID(),playerId,expectedRevision:state.revision,sessionId:state.id} as GameCommand;}
function firstOther(state:GameState,id:string):string|null{return state.players.find(p=>p.id!==id)?.id??null;}
function botColor(state:GameState,id:string):'lime'|'orange'|'cyan'|'purple'{return state.players.find(p=>p.id===id)?.hand.find(c=>c.color)?.color??'lime';}
function botAnswerChoice(options:readonly string[]|undefined):string|undefined{return options?.[0];}

export function advanceCanonicalBots(initialState:GameState,config?:RoomBotConfig,now=Date.now()):{state:GameState;events:GameEvent[]}{
  let state=initialState;const events:GameEvent[]=[];let guard=0;
  const apply=(playerId:string,body:any):boolean=>{const result=applyCommand(state,command(state,playerId,body),context(config,now));state=result.state;events.push(...result.events);return result.ok;};

  while(state.status==='ACTIVE'&&guard++<160){
    if(state.pendingEffect?.type==='WILD_COLOR'){
      const id=state.pendingEffect.playerId;if(!isBotPlayerId(id)||!apply(id,{type:'SELECT_WILD_COLOR',color:botColor(state,id)}))break;continue;
    }

    const social=state.social;
    if(social?.canonicalStep){
      const step=social.canonicalStep;
      if(step==='TARGET'){
        if(!isBotPlayerId(social.actorId))break;
        const target=firstOther(state,social.actorId);if(!target)break;
        const type=social.cardKind==='dare'?'SELECT_DARE_TARGET':social.cardKind==='duel'?'SELECT_DUEL_TARGET':social.cardKind==='paranoia'?'SELECT_PARANOIA_TARGET':social.cardKind==='tag'?'SELECT_TAG_TARGET':social.cardKind==='hijack'?'SELECT_HIJACK_TARGET':social.cardKind==='taboo'?'SELECT_TABOO_TARGET':social.cardKind==='reverse_confession'?'SELECT_REVERSE_CONFESSION_TARGET':social.cardKind==='dig_me'?'SELECT_DIG_ME_TARGET':null;
        if(!type||!apply(social.actorId,{type,targetId:target}))break;continue;
      }
      if(step==='PROMPT_SOURCE'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SELECT_PROMPT_SOURCE',source:'ROULETTE'}))break;continue;
      }
      if(step==='PRIVATE_PREVIEW'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'PUBLISH_PROMPT'}))break;continue;
      }
      if(step==='ANSWER'){
        const responder=social.cardKind==='dare'?social.pendingTargetId:social.actorId;
        if(!responder||!isBotPlayerId(responder))break;
        if(social.prompt?.options?.length){if(!apply(responder,{type:'SUBMIT_CHOICE',choice:botAnswerChoice(social.prompt.options)!}))break;}
        else if(!apply(responder,{type:'MARK_ANSWERED_LIVE'}))break;continue;
      }
      if(step==='PARANOIA_PHASE'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SELECT_PARANOIA_PHASE',phase:'CLASSIC'}))break;continue;
      }
      if(step==='PARANOIA_CLASSIC_ANSWER'){
        const id=social.pendingTargetId;if(!id||!isBotPlayerId(id))break;const answer=firstOther(state,id);if(!answer||!apply(id,{type:'SELECT_PARANOIA_CLASSIC_ANSWER',targetId:answer}))break;continue;
      }
      if(step==='PARANOIA_CLASSIC_DECISION'){
        const id=social.classicAnswerPlayerId;if(!id||!isBotPlayerId(id)||!apply(id,{type:'SUBMIT_PARANOIA_CLASSIC_DECISION',decision:'REVEAL'}))break;continue;
      }
      if(step==='PARANOIA_TARGET_ANSWER'){
        const id=social.pendingTargetId;if(!id||!isBotPlayerId(id)||!apply(id,{type:'MARK_ANSWERED_LIVE'}))break;continue;
      }
      if(step==='PARANOIA_VOTE'){
        const id=social.paranoiaVote?.eligibleVoterIds.find(v=>isBotPlayerId(v)&&!social.paranoiaVote?.votes[v]);if(!id)break;if(!apply(id,{type:'SUBMIT_PARANOIA_VOTE',vote:'BELIEVE'}))break;continue;
      }
      if(step==='DUEL_TIMER'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SELECT_DUEL_TIMER',seconds:30}))break;continue;
      }
      if(step==='DUEL_INITIATOR'){
        const id=social.pendingDuel?.initiatorId;if(!id||!isBotPlayerId(id)||!apply(id,{type:'SUBMIT_DUEL_RESPONSE',side:'initiator',completionOnly:true}))break;continue;
      }
      if(step==='DUEL_OPPONENT'){
        const id=social.pendingDuel?.opponentId;if(!id||!isBotPlayerId(id)||!apply(id,{type:'SUBMIT_DUEL_RESPONSE',side:'opponent',completionOnly:true}))break;continue;
      }
      if(step==='DUEL_VOTE'){
        const duel=social.pendingDuel;const id=duel?.vote?.eligibleVoterIds.find(v=>isBotPlayerId(v)&&!duel.vote?.votes[v]);if(!id||!duel?.initiatorId)break;if(!apply(id,{type:'DUEL_VOTE',winnerId:duel.initiatorId}))break;continue;
      }
      if(step==='CHAOS_RESOLVE'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'RESOLVE_CHAOS'}))break;continue;
      }
      if(step==='TABOO_QUESTION'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SUBMIT_TABOO_QUESTION',text:'Answer yes if this is true for you.'}))break;continue;
      }
      if(step==='TABOO_ANSWER'){
        const id=social.pendingTargetId;if(!id||!isBotPlayerId(id)||!apply(id,{type:'SUBMIT_TABOO_ANSWER',answer:'YES'}))break;continue;
      }
      if(step==='GROUP_QUESTION'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SUBMIT_GROUP_QUESTION',text:'Pick one together.',options:['A','B']}))break;continue;
      }
      if(step==='GROUP_ANSWER'){
        const id=social.pendingTargetIds.find(v=>isBotPlayerId(v)&&!social.groupAnswers?.[v]);if(!id)break;if(!apply(id,{type:'SUBMIT_GROUP_ANSWER',choice:social.groupOptions?.[0]??'A'}))break;continue;
      }
      if(step==='GROUP_DARE'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SUBMIT_GROUP_DARE',text:'Everyone completes the group dare.'}))break;continue;
      }
      if(step==='GROUP_COMPLETE'){
        const id=social.pendingTargetIds.find(v=>isBotPlayerId(v)&&!social.groupCompletions?.[v]);if(!id)break;if(!apply(id,{type:'COMPLETE_GROUP_DARE',completion:'DONE'}))break;continue;
      }
      if(step==='MACHIAVELLI_CHOICE'){
        if(!isBotPlayerId(social.actorId))break;const effect:MachiavelliEffectId='CONVERT_WEAK';if(!apply(social.actorId,{type:'SELECT_MACHIAVELLI_EFFECT',effect}))break;continue;
      }
      if(step==='REVERSE_QUESTION'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SUBMIT_REVERSE_CONFESSION_QUESTION',text:'What would you confess right now?'}))break;continue;
      }
      if(step==='REVERSE_ANSWER'){
        const id=social.pendingTargetId;if(!id||!isBotPlayerId(id)||!apply(id,{type:'SUBMIT_REVERSE_CONFESSION_ANSWER',answeredLive:true}))break;continue;
      }
      if(step==='DIG_QUESTION'){
        if(!isBotPlayerId(social.actorId)||!apply(social.actorId,{type:'SUBMIT_DIG_ME_QUESTION',askedLive:true}))break;continue;
      }
      if(step==='DIG_ANSWER'){
        const id=social.pendingTargetId;if(!id||!isBotPlayerId(id)||!apply(id,{type:'COMPLETE_DIG_ME'}))break;continue;
      }
      break;
    }

    if(!isBotPlayerId(state.currentPlayerId))break;
    const bot=state.players.find(p=>p.id===state.currentPlayerId);if(!bot)break;
    if(bot.ghostArmedCard&&(bot.ghostTurnsRemaining??0)===0){if(!apply(bot.id,{type:'ACTIVATE_GHOST'}))break;continue;}
    const playable=bot.hand.find(card=>card.kind!=='nope'&&isLegalPlay(state,bot.id,card.id));
    if(playable){if(!apply(bot.id,{type:'PLAY_CARD',cardId:playable.id}))break;continue;}
    if((bot.ghostTurnsRemaining??0)>0){if(!apply(bot.id,{type:'END_GHOST_TURN'}))break;continue;}
    if(!apply(bot.id,{type:'DRAW_CARD'}))break;
  }
  return{state,events};
}

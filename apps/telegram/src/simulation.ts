import type { Card, CardColor, CardKind, GameCommand, GameState, GameTransition, MachiavelliEffectId } from '../../../packages/contracts/src/index.ts';
import { applyCommand, createGame, isLegalPlay } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';
import type { TelegramBackendGame, TelegramGameCommand } from './backendGame.ts';
import type { TelegramRoomDraft } from './roomSetup.ts';

export interface TelegramSimulationPlayer{readonly id:string;readonly name:string;readonly isHuman:boolean;}
export interface TelegramSimulation{readonly humanPlayerId:string;readonly players:readonly TelegramSimulationPlayer[];getState():GameState;playCard(cardId:string):GameTransition<GameState>;drawCard():GameTransition<GameState>;selectWildColor(color:CardColor):GameTransition<GameState>;passPrompt():GameTransition<GameState>;rewindPrompt():GameTransition<GameState>;flagPrompt(reasonCode?:string):GameTransition<GameState>;send(command:TelegramGameCommand):GameTransition<GameState>;subscribe(onUpdate:()=>void):()=>void;}

const HUMAN_PLAYER_ID='telegram-sim-human';
const QA_HAND_KINDS:readonly CardKind[]=['truth','dare','paranoia','chaos','duel','nope','wild'];
function simulationSeed(draft:TelegramRoomDraft):string{return['telegram-simulation-v4',draft.mode,draft.playerCount,draft.world,draft.ceiling,draft.qaHand?'qa-hand':'normal-hand',Object.entries(draft.sources).filter(([,enabled])=>enabled).map(([source])=>source).sort().join(',')].join('|');}
function createPlayers(draft:TelegramRoomDraft):TelegramSimulationPlayer[]{const profileName=draft.profileName.trim()||'You';return Array.from({length:draft.playerCount},(_,index)=>({id:index===0?HUMAN_PLAYER_ID:`telegram-sim-player-${index+1}`,name:index===0?profileName:`Player ${index+1}`,isHuman:index===0}));}
function installQaHand(state:GameState):void{const human=state.players.find(p=>p.id===HUMAN_PLAYER_ID);if(!human)return;state.drawPile.push(...human.hand);human.hand=QA_HAND_KINDS.map((kind,index):Card=>({id:`telegram-qa-${kind}-${index+1}`,kind,symbol:kind}));}

export function createTelegramSimulation(draft:TelegramRoomDraft):TelegramSimulation{
  const players=createPlayers(draft);const created=createGame({seed:simulationSeed(draft),startingHandCount:7,startingPlayerIndex:0,allowVoluntaryDraw:true,contentWorld:draft.world==='adult'?'18+_ADULT':'UNDER_18_CLEAN'},players.map((p,seat)=>({id:p.id,seat})),undefined,{now:Date.now()});if(!created.ok)throw created.error??new Error('Unable to create Telegram simulation.');
  let state=created.state;state.forcedQueue=[];state.bonusTurnStack=[];if(draft.qaHand)installQaHand(state);let commandSequence=0;const listeners=new Set<()=>void>();const promptPool=promptPoolForSources(draft.sources);
  function commandId(type:GameCommand['type'],playerId:string):string{commandSequence+=1;return`${state.id}:telegram:${state.revision}:${playerId}:${type}:${commandSequence}`;}
  function context(){return{canonicalFlow:true,now:Date.now(),promptPool,promptProfile:{stage:Number.MAX_SAFE_INTEGER,intensity:draft.ceiling,language:'*',callSuitability:'*'}};}
  function notify():void{listeners.forEach(listener=>listener());}
  function commandFor(playerId:string,command:TelegramGameCommand):GameCommand{return{...command,commandId:commandId(command.type,playerId),playerId,expectedRevision:state.revision,sessionId:state.id} as GameCommand;}
  function applyEngine(command:GameCommand):GameTransition<GameState>{const transition=applyCommand(state,command,context());state=transition.state;return transition;}
  function firstOther(id:string):string|null{return state.players.find(p=>p.id!==id)?.id??null;}

  function runAutomatedTurns():void{
    let guard=0;
    while(state.status==='ACTIVE'&&guard++<160){
      if(state.pendingEffect?.type==='WILD_COLOR'){const id=state.pendingEffect.playerId;if(id===HUMAN_PLAYER_ID)return;const owner=state.players.find(p=>p.id===id);if(!applyEngine(commandFor(id,{type:'SELECT_WILD_COLOR',color:owner?.hand.find(c=>c.color)?.color??'lime'})).ok)return;continue;}
      const social=state.social;
      if(social?.canonicalStep){const step=social.canonicalStep;
        if(step==='TARGET'){if(social.actorId===HUMAN_PLAYER_ID)return;const target=firstOther(social.actorId);if(!target)return;const type=social.cardKind==='dare'?'SELECT_DARE_TARGET':social.cardKind==='duel'?'SELECT_DUEL_TARGET':social.cardKind==='paranoia'?'SELECT_PARANOIA_TARGET':social.cardKind==='tag'?'SELECT_TAG_TARGET':social.cardKind==='hijack'?'SELECT_HIJACK_TARGET':social.cardKind==='taboo'?'SELECT_TABOO_TARGET':social.cardKind==='reverse_confession'?'SELECT_REVERSE_CONFESSION_TARGET':social.cardKind==='dig_me'?'SELECT_DIG_ME_TARGET':null;if(!type||!applyEngine(commandFor(social.actorId,{type,targetId:target} as TelegramGameCommand)).ok)return;continue;}
        if(step==='PROMPT_SOURCE'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SELECT_PROMPT_SOURCE',source:'ROULETTE'})).ok)return;continue;}
        if(step==='PRIVATE_PREVIEW'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'PUBLISH_PROMPT'})).ok)return;continue;}
        if(step==='ANSWER'){const id=social.cardKind==='dare'?social.pendingTargetId:social.actorId;if(!id||id===HUMAN_PLAYER_ID)return;const cmd=social.prompt?.options?.length?{type:'SUBMIT_CHOICE',choice:social.prompt.options[0]}:{type:'MARK_ANSWERED_LIVE'};if(!applyEngine(commandFor(id,cmd as TelegramGameCommand)).ok)return;continue;}
        if(step==='PARANOIA_PHASE'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SELECT_PARANOIA_PHASE',phase:'CLASSIC'})).ok)return;continue;}
        if(step==='PARANOIA_CLASSIC_ANSWER'){const id=social.pendingTargetId;if(!id||id===HUMAN_PLAYER_ID)return;const answer=firstOther(id);if(!answer||!applyEngine(commandFor(id,{type:'SELECT_PARANOIA_CLASSIC_ANSWER',targetId:answer})).ok)return;continue;}
        if(step==='PARANOIA_CLASSIC_DECISION'){const id=social.classicAnswerPlayerId;if(!id||id===HUMAN_PLAYER_ID||!applyEngine(commandFor(id,{type:'SUBMIT_PARANOIA_CLASSIC_DECISION',decision:'REVEAL'})).ok)return;continue;}
        if(step==='PARANOIA_TARGET_ANSWER'){const id=social.pendingTargetId;if(!id||id===HUMAN_PLAYER_ID||!applyEngine(commandFor(id,{type:'MARK_ANSWERED_LIVE'})).ok)return;continue;}
        if(step==='PARANOIA_VOTE'){const id=social.paranoiaVote?.eligibleVoterIds.find(v=>v!==HUMAN_PLAYER_ID&&!social.paranoiaVote?.votes[v]);if(!id)return;if(!applyEngine(commandFor(id,{type:'SUBMIT_PARANOIA_VOTE',vote:'BELIEVE'})).ok)return;continue;}
        if(step==='DUEL_TIMER'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SELECT_DUEL_TIMER',seconds:30})).ok)return;continue;}
        if(step==='DUEL_INITIATOR'){const id=social.pendingDuel?.initiatorId;if(!id||id===HUMAN_PLAYER_ID||!applyEngine(commandFor(id,{type:'SUBMIT_DUEL_RESPONSE',side:'initiator',completionOnly:true})).ok)return;continue;}
        if(step==='DUEL_OPPONENT'){const id=social.pendingDuel?.opponentId;if(!id||id===HUMAN_PLAYER_ID||!applyEngine(commandFor(id,{type:'SUBMIT_DUEL_RESPONSE',side:'opponent',completionOnly:true})).ok)return;continue;}
        if(step==='DUEL_VOTE'){const duel=social.pendingDuel;const id=duel?.vote?.eligibleVoterIds.find(v=>v!==HUMAN_PLAYER_ID&&!duel.vote?.votes[v]);if(!id||!duel?.initiatorId)return;if(!applyEngine(commandFor(id,{type:'DUEL_VOTE',winnerId:duel.initiatorId})).ok)return;continue;}
        if(step==='CHAOS_RESOLVE'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'RESOLVE_CHAOS'})).ok)return;continue;}
        if(step==='TABOO_QUESTION'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SUBMIT_TABOO_QUESTION',text:'Answer yes if this is true for you.'})).ok)return;continue;}
        if(step==='TABOO_ANSWER'){const id=social.pendingTargetId;if(!id||id===HUMAN_PLAYER_ID||!applyEngine(commandFor(id,{type:'SUBMIT_TABOO_ANSWER',answer:'YES'})).ok)return;continue;}
        if(step==='GROUP_QUESTION'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SUBMIT_GROUP_QUESTION',text:'Pick one together.',options:['A','B']})).ok)return;continue;}
        if(step==='GROUP_ANSWER'){const id=social.pendingTargetIds.find(v=>v!==HUMAN_PLAYER_ID&&!social.groupAnswers?.[v]);if(!id)return;if(!applyEngine(commandFor(id,{type:'SUBMIT_GROUP_ANSWER',choice:social.groupOptions?.[0]??'A'})).ok)return;continue;}
        if(step==='GROUP_DARE'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SUBMIT_GROUP_DARE',text:'Everyone completes the group dare.'})).ok)return;continue;}
        if(step==='GROUP_COMPLETE'){const id=social.pendingTargetIds.find(v=>v!==HUMAN_PLAYER_ID&&!social.groupCompletions?.[v]);if(!id)return;if(!applyEngine(commandFor(id,{type:'COMPLETE_GROUP_DARE',completion:'DONE'})).ok)return;continue;}
        if(step==='MACHIAVELLI_CHOICE'){if(social.actorId===HUMAN_PLAYER_ID)return;const effect:MachiavelliEffectId='CONVERT_WEAK';if(!applyEngine(commandFor(social.actorId,{type:'SELECT_MACHIAVELLI_EFFECT',effect})).ok)return;continue;}
        if(step==='REVERSE_QUESTION'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SUBMIT_REVERSE_CONFESSION_QUESTION',text:'What would you confess right now?'})).ok)return;continue;}
        if(step==='REVERSE_ANSWER'){const id=social.pendingTargetId;if(!id||id===HUMAN_PLAYER_ID||!applyEngine(commandFor(id,{type:'SUBMIT_REVERSE_CONFESSION_ANSWER',answeredLive:true})).ok)return;continue;}
        if(step==='DIG_QUESTION'){if(social.actorId===HUMAN_PLAYER_ID||!applyEngine(commandFor(social.actorId,{type:'SUBMIT_DIG_ME_QUESTION',askedLive:true})).ok)return;continue;}
        if(step==='DIG_ANSWER'){const id=social.pendingTargetId;if(!id||id===HUMAN_PLAYER_ID||!applyEngine(commandFor(id,{type:'COMPLETE_DIG_ME'})).ok)return;continue;}
        return;
      }
      if(state.currentPlayerId===HUMAN_PLAYER_ID)return;const bot=state.players.find(p=>p.id===state.currentPlayerId);if(!bot)return;
      if(bot.ghostArmedCard&&(bot.ghostTurnsRemaining??0)===0){if(!applyEngine(commandFor(bot.id,{type:'ACTIVATE_GHOST'})).ok)return;continue;}
      const playable=bot.hand.find(card=>card.kind!=='nope'&&isLegalPlay(state,bot.id,card.id));if(playable){if(!applyEngine(commandFor(bot.id,{type:'PLAY_CARD',cardId:playable.id})).ok)return;continue;}
      if((bot.ghostTurnsRemaining??0)>0){if(!applyEngine(commandFor(bot.id,{type:'END_GHOST_TURN'})).ok)return;continue;}
      if(!applyEngine(commandFor(bot.id,{type:'DRAW_CARD'})).ok)return;
    }
  }

  function apply(command:GameCommand):GameTransition<GameState>{const transition=applyEngine(command);if(transition.ok)runAutomatedTurns();notify();return{...transition,state};}
  function send(command:TelegramGameCommand):GameTransition<GameState>{return apply(commandFor(HUMAN_PLAYER_ID,command));}
  runAutomatedTurns();
  return{humanPlayerId:HUMAN_PLAYER_ID,players,getState:()=>state,playCard:cardId=>send({type:'PLAY_CARD',cardId}),drawCard:()=>send({type:'DRAW_CARD'}),selectWildColor:color=>send({type:'SELECT_WILD_COLOR',color}),passPrompt:()=>send({type:'PASS_PROMPT'}),rewindPrompt:()=>send({type:'REWIND_PROMPT'}),flagPrompt:reasonCode=>send({type:'FLAG_PROMPT',promptId:state.social?.prompt?.id??'',...(reasonCode?{reasonCode}:{})}),send,subscribe:onUpdate=>{listeners.add(onUpdate);return()=>listeners.delete(onUpdate);}};
}
function transitionResult(transition:GameTransition<GameState>):{ok:boolean;error?:{message:string}}{return transition.ok?{ok:true}:{ok:false,error:{message:transition.error?.message??'The simulation rejected that action.'}};}
export function createTelegramSimulationGame(draft:TelegramRoomDraft):TelegramBackendGame{const simulation=createTelegramSimulation(draft),sessionId=simulation.getState().id;return{humanPlayerId:simulation.humanPlayerId,players:simulation.players,sessionId,joinCode:'SIMULATION',getState:simulation.getState,refresh:async()=>undefined,playCard:async cardId=>transitionResult(simulation.playCard(cardId)),drawCard:async()=>transitionResult(simulation.drawCard()),selectWildColor:async color=>transitionResult(simulation.selectWildColor(color)),passPrompt:async()=>transitionResult(simulation.passPrompt()),rewindPrompt:async()=>transitionResult(simulation.rewindPrompt()),flagPrompt:async reasonCode=>transitionResult(simulation.flagPrompt(reasonCode)),send:async command=>transitionResult(simulation.send(command)),subscribe:simulation.subscribe};}

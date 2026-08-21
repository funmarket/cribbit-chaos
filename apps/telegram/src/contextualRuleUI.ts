import type { AnswerMode, GameState, MachiavelliEffectId, ParanoiaPhase } from '../../../packages/contracts/src/index.ts';
import { isLegalPlay } from '../../../packages/game-engine/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import type { TelegramBackendGame, TelegramGameResult } from './backendGame.ts';
import './styles/contextual.css';

type Tone='neutral'|'success'|'warning';
type StatusSetter=(message:{text:string;tone:Tone})=>void;
type ContextResult={ok:boolean;success?:string;error?:string};
type ContextAction={title:string;body:string};
const MACHIAVELLI:readonly [MachiavelliEffectId,string][]=[['CONVERT_WEAK','Convert Weak'],['TABOO_ALL','Taboo for All'],['NO_MERCY','No Mercy'],['PARANOIA_SPREADS','Paranoia Spreads'],['DOUBLE_PRESSURE','Double Pressure'],['REVERSE_CONFESSION_ALL','Reverse Confession All']];

export function openContextualRuleUI(host:HTMLElement,platform:PlatformAdapter,game:TelegramBackendGame,onChanged:()=>void,setStatus:StatusSetter):boolean{
  closeContextualRuleUI(host);const action=contextualAction(game.getState(),game);if(!action)return false;
  const wrapper=document.createElement('div');wrapper.className='tg-context-layer';wrapper.dataset.contextLayer='active';wrapper.innerHTML=`<button class="tg-context-scrim" type="button" data-context-scrim aria-label="Close contextual panel"></button><section class="tg-context-sheet" role="dialog" aria-modal="true" aria-labelledby="tgContextTitle"><div class="tg-context-handle" aria-hidden="true"></div><header class="tg-context-header"><div><small>ACTIVE GAME ACTION</small><h2 id="tgContextTitle">${escapeHTML(action.title)}</h2></div><button type="button" class="tg-context-close" data-context-close aria-label="Close">×</button></header>${action.body}<p class="tg-context-authority">Shared game state decides whether each action is legal and what happens next.</p></section>`;host.append(wrapper);
  const close=()=>closeContextualRuleUI(host);wrapper.querySelector<HTMLElement>('[data-context-scrim]')?.addEventListener('click',close);wrapper.querySelector<HTMLElement>('[data-context-close]')?.addEventListener('click',close);
  wrapper.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;const result=await runCommand(button,wrapper,game);platform.haptic(result.ok?'medium':'light');setStatus(result.ok?{text:result.success??'Game state updated.',tone:'success'}:{text:result.error??'The game rejected that action.',tone:'warning'});close();onChanged();}));
  platform.haptic('light');return true;
}
export function closeContextualRuleUI(host:HTMLElement):void{host.querySelector<HTMLElement>('[data-context-layer]')?.remove();}
export function hasContextualAction(state:GameState,game:TelegramBackendGame):boolean{return Boolean(contextualAction(state,game));}

function contextualAction(state:GameState,game:TelegramBackendGame):ContextAction|null{
  const humanId=game.humanPlayerId,human=state.players.find(p=>p.id===humanId),social=state.social;
  if(!social){
    if(state.currentPlayerId===humanId&&human?.ghostArmedCard&&(human.ghostTurnsRemaining??0)===0)return{title:'Ghost',body:`<p class="tg-context-copy">Activate your armed Ghost for two personal turns. Normal draw is unavailable while Ghost is active.</p>${commandButton('ACTIVATE_GHOST','Activate Ghost','')}`};
    if(state.currentPlayerId===humanId&&(human?.ghostTurnsRemaining??0)>0&&!human.hand.some(card=>isLegalPlay(state,humanId,card.id)))return{title:'Ghost Turn',body:`<p class="tg-context-copy">No legal card is available. End this Ghost turn without drawing.</p>${commandButton('END_GHOST_TURN','End Ghost Turn','')}`};
    return null;
  }
  const step=social.canonicalStep;
  if(!step){return null;}
  if(step==='PROMPT_SOURCE'&&social.actorId===humanId)return{title:'Choose Prompt Source',body:`<p class="tg-context-copy">Write your own prompt or use the room Roulette pool.</p><div class="tg-answer-grid">${commandButton('SELECT_PROMPT_SOURCE','Write My Own','MANUAL')}${commandButton('SELECT_PROMPT_SOURCE','Roulette','ROULETTE')}</div>`};
  if(step==='MANUAL_PROMPT'&&social.actorId===humanId)return{title:'Write Your Prompt',body:`${textArea('context-prompt','Question / Dare')}${commandButton('SUBMIT_MANUAL_PROMPT','Use This Prompt','')}`};
  if(step==='PRIVATE_PREVIEW'&&social.actorId===humanId)return{title:'Private Preview',body:`${promptCard('PRIVATE',social.prompt?.text??'Prompt ready.')}${commandButton('PUBLISH_PROMPT','Use This Question','')}`};
  if(step==='TARGET'&&social.actorId===humanId){const command=social.cardKind==='dare'?'SELECT_DARE_TARGET':social.cardKind==='paranoia'?'SELECT_PARANOIA_TARGET':social.cardKind==='duel'?'SELECT_DUEL_TARGET':social.cardKind==='tag'?'SELECT_TAG_TARGET':social.cardKind==='hijack'?'SELECT_HIJACK_TARGET':social.cardKind==='taboo'?'SELECT_TABOO_TARGET':social.cardKind==='reverse_confession'?'SELECT_REVERSE_CONFESSION_TARGET':social.cardKind==='dig_me'?'SELECT_DIG_ME_TARGET':'';return command?{title:`Choose ${titleForKind(social.cardKind)} Target`,body:targetGrid(state,game,social.pendingTargetIds,command)}:null;}
  if(step==='ANSWER'){
    const responder=social.cardKind==='dare'?social.pendingTargetId:social.actorId;if(responder!==humanId)return null;return truthDareAnswer(social.cardKind==='truth'?'Truth':'Dare',social.prompt?.text??'',social.prompt?.options,social.answerState.mode);
  }
  if(step==='PARANOIA_PHASE'&&social.actorId===humanId)return{title:'Classic or Stranger?',body:`<div class="tg-answer-grid">${commandButton('SELECT_PARANOIA_PHASE','Classic','CLASSIC')}${commandButton('SELECT_PARANOIA_PHASE','Stranger','STRANGER')}</div>`};
  if(step==='PARANOIA_CLASSIC_ANSWER'&&social.pendingTargetId===humanId)return{title:'Choose Answer Player',body:targetGrid(state,game,state.players.filter(p=>p.id!==humanId).map(p=>p.id),'SELECT_PARANOIA_CLASSIC_ANSWER')};
  if(step==='PARANOIA_CLASSIC_DECISION'&&social.classicAnswerPlayerId===humanId)return{title:'Reveal or Keep Secret?',body:`<div class="tg-answer-grid">${commandButton('SUBMIT_PARANOIA_CLASSIC_DECISION','Reveal','REVEAL')}${commandButton('SUBMIT_PARANOIA_CLASSIC_DECISION','Keep Secret','KEEP_SECRET')}</div>`};
  if(step==='PARANOIA_TARGET_ANSWER'&&social.pendingTargetId===humanId)return{title:'Stranger Response',body:`${promptCard('PARANOIA',social.prompt?.text??'Answer the selected Paranoia prompt.')}${commandButton('MARK_ANSWERED_LIVE','Answered Live','')}`};
  if(step==='PARANOIA_VOTE'&&social.paranoiaVote?.eligibleVoterIds.includes(humanId)&&!social.paranoiaVote.votes[humanId])return{title:'Stranger Vote',body:`<div class="tg-answer-grid">${commandButton('SUBMIT_PARANOIA_VOTE','Believe','BELIEVE')}${commandButton('SUBMIT_PARANOIA_VOTE','Lying','LYING')}${commandButton('SUBMIT_PARANOIA_VOTE','Holding Back','HOLDING_BACK')}</div>`};
  if(step==='DUEL_TIMER'&&social.actorId===humanId)return{title:'Set Duel Timer',body:`${promptCard('DUEL',social.prompt?.text??'Duel prompt ready.')}<div class="tg-answer-grid">${commandButton('SELECT_DUEL_TIMER','15 sec','15')}${commandButton('SELECT_DUEL_TIMER','30 sec','30')}${commandButton('SELECT_DUEL_TIMER','45 sec','45')}</div>`};
  if(step==='DUEL_INITIATOR'&&social.pendingDuel?.initiatorId===humanId)return{title:'Your Duel Response',body:`${promptCard('DUEL',social.prompt?.text??'Complete the Duel response.')}${textArea('duel-response','Your response')}${commandButton('SUBMIT_DUEL_TYPED','Submit Response','initiator')}${commandButton('SUBMIT_DUEL_LIVE','Answered Live','initiator')}`};
  if(step==='DUEL_OPPONENT'&&social.pendingDuel?.opponentId===humanId)return{title:'Your Duel Response',body:`${promptCard('DUEL',social.prompt?.text??'Complete the Duel response.')}${textArea('duel-response','Your response')}${commandButton('SUBMIT_DUEL_TYPED','Submit Response','opponent')}${commandButton('SUBMIT_DUEL_LIVE','Answered Live','opponent')}`};
  if(step==='DUEL_VOTE'&&social.pendingDuel?.vote?.eligibleVoterIds.includes(humanId)&&!social.pendingDuel.vote.votes[humanId])return{title:'Duel Group Vote',body:targetGrid(state,game,[social.pendingDuel.initiatorId,social.pendingDuel.opponentId!],'DUEL_VOTE')};
  if(step==='CHAOS_RESOLVE'&&social.actorId===humanId)return{title:'Chaos',body:`${promptCard('CHAOS',social.chaosEffectId==='BLIND_SWAP'?'Blind Swap — everyone passes up to 3 random cards.':'Reverse Order — direction reverses for this Chaos cycle.')}${commandButton('RESOLVE_CHAOS','Resolve Chaos','')}`};
  if(step==='TABOO_QUESTION'&&social.actorId===humanId)return{title:'Taboo Question',body:`${textArea('taboo-question','Ask the target one question')}${commandButton('SUBMIT_TABOO_QUESTION','Ask Question','')}`};
  if(step==='TABOO_ANSWER'&&social.pendingTargetId===humanId)return{title:'Taboo Answer',body:`${promptCard('TABOO',social.question??'Answer the question.')}${commandButton('SUBMIT_TABOO_ANSWER','YES','YES')}${commandButton('SUBMIT_TABOO_ANSWER','Anything Else / Refuse','OTHER')}`};
  if(step==='GROUP_QUESTION'&&social.actorId===humanId)return{title:'Truth or Chaos',body:`${textArea('group-question','Question for everyone')}${textInput('group-option-a','Choice A')}${textInput('group-option-b','Choice B')}${commandButton('SUBMIT_GROUP_QUESTION','Ask Everyone','')}`};
  if(step==='GROUP_ANSWER'&&social.pendingTargetIds.includes(humanId)&&!social.groupAnswers?.[humanId])return{title:'Choose Your Answer',body:`<div class="tg-answer-grid">${(social.groupOptions??[]).map(option=>commandButton('SUBMIT_GROUP_ANSWER',option,option)).join('')}</div>`};
  if(step==='GROUP_DARE'&&social.actorId===humanId)return{title:'Set Whole-Group Dare',body:`${textArea('group-dare','Dare for everyone')}${commandButton('SUBMIT_GROUP_DARE','Set Group Dare','')}`};
  if(step==='GROUP_COMPLETE'&&social.pendingTargetIds.includes(humanId)&&!social.groupCompletions?.[humanId])return{title:'Group Dare',body:`${promptCard('GROUP DARE',social.groupDare??'Complete the group Dare.')}${commandButton('COMPLETE_GROUP_DARE','Done','DONE')}${commandButton('COMPLETE_GROUP_DARE','Pass','PASS')}`};
  if(step==='MACHIAVELLI_CHOICE'&&social.actorId===humanId)return{title:'Machiavelli',body:`<div class="tg-answer-grid">${MACHIAVELLI.map(([effect,label])=>commandButton('SELECT_MACHIAVELLI_EFFECT',label,effect)).join('')}</div>`};
  if(step==='REVERSE_QUESTION'&&social.actorId===humanId)return{title:'Reverse Confession',body:`${textArea('reverse-question','Ask your target')}${commandButton('SUBMIT_REVERSE_CONFESSION_QUESTION','Ask Question','')}`};
  if(step==='REVERSE_ANSWER'&&social.pendingTargetId===humanId)return{title:'Reverse Confession Answer',body:`${promptCard('QUESTION',social.question??'Answer the card holder.')}${textArea('reverse-answer','Your answer')}${commandButton('SUBMIT_REVERSE_TYPED','Submit Answer','')}${commandButton('SUBMIT_REVERSE_LIVE','Answered Live','')}`};
  if(step==='DIG_QUESTION'&&social.actorId===humanId)return{title:'DIG ME',body:`${textArea('dig-question','Ask a question about yourself')}${commandButton('SUBMIT_DIG_QUESTION','Ask Question','')}${commandButton('SUBMIT_DIG_LIVE','Asked Live','')}`};
  if(step==='DIG_ANSWER'&&social.pendingTargetId===humanId)return{title:'DIG ME Answer',body:`${promptCard('DIG ME',social.question??'Answer the question asked live.')}${commandButton('COMPLETE_DIG_ME','Answered / Complete','')}`};
  return null;
}

function truthDareAnswer(title:string,prompt:string,options:readonly string[]|undefined,mode:AnswerMode|null):ContextAction{
  if(options?.length)return{title,body:`${promptCard(title.toUpperCase(),prompt)}<div class="tg-answer-grid">${options.map(option=>commandButton('SUBMIT_CHOICE',option,option)).join('')}</div>${commandButton('PASS_PROMPT','Pass / Not For Me','')}`};
  if(mode==='TYPE')return{title,body:`${promptCard(title.toUpperCase(),prompt)}${textArea('context-answer','Your answer')}${commandButton('SUBMIT_TYPED_ANSWER','Submit Answer','')}${commandButton('PASS_PROMPT','Pass / Not For Me','')}`};
  return{title,body:`${promptCard(title.toUpperCase(),prompt)}<div class="tg-answer-grid">${commandButton('ANSWERED_LIVE_NOW','Answered Live','')}${commandButton('SELECT_ANSWER_MODE','Type','TYPE')}</div>${commandButton('PASS_PROMPT','Pass / Not For Me','')}`};
}

function normalizeResult(result:TelegramGameResult,success:string):ContextResult{return result.ok?{ok:true,success}:{ok:false,error:result.error?.message??'The game rejected that action.'};}
async function runCommand(button:HTMLButtonElement,wrapper:HTMLElement,game:TelegramBackendGame):Promise<ContextResult>{
  const command=button.dataset.command??'',value=button.dataset.value??'';
  const send=async(payload:Parameters<TelegramBackendGame['send']>[0]):Promise<ContextResult>=>{const result=await game.send(payload);return result.ok?{ok:true}:{ok:false,error:result.error?.message??'The game rejected that action.'};};
  if(command==='SELECT_PROMPT_SOURCE')return{...(await send({type:'SELECT_PROMPT_SOURCE',source:value as'MANUAL'|'ROULETTE'})),success:`${value} selected.`};
  if(command==='SUBMIT_MANUAL_PROMPT'){const text=field(wrapper,'context-prompt');if(!text)return{ok:false,error:'Write your prompt first.'};return{...(await send({type:'SUBMIT_MANUAL_PROMPT',text})),success:'Prompt accepted.'};}
  if(command==='PUBLISH_PROMPT')return{...(await send({type:'PUBLISH_PROMPT'})),success:'Prompt published.'};
  if(command==='SELECT_DARE_TARGET')return{...(await send({type:'SELECT_DARE_TARGET',targetId:value})),success:'Dare target selected.'};
  if(command==='SELECT_ANSWER_MODE')return{...(await send({type:'SELECT_ANSWER_MODE',mode:value as AnswerMode})),success:`${value} selected.`};
  if(command==='ANSWERED_LIVE_NOW'||command==='MARK_ANSWERED_LIVE')return{...(await send({type:'MARK_ANSWERED_LIVE'})),success:'Answered Live recorded.'};
  if(command==='SUBMIT_TYPED_ANSWER'){const answer=field(wrapper,'context-answer');if(!answer)return{ok:false,error:'Type an answer before submitting.'};const reviewed=await send({type:'REVIEW_ANSWER',value:answer});if(!reviewed.ok)return reviewed;const submitted=await send({type:'SUBMIT_ANSWER'});return submitted.ok?{ok:true,success:'Answer submitted.'}:submitted;}
  if(command==='SUBMIT_CHOICE')return{...(await send({type:'SUBMIT_CHOICE',choice:value})),success:'Choice submitted.'};
  if(command==='PASS_PROMPT')return normalizeResult(await game.passPrompt(),'Prompt passed.');
  if(command==='SELECT_PARANOIA_TARGET')return{...(await send({type:'SELECT_PARANOIA_TARGET',targetId:value})),success:'Paranoia target selected.'};
  if(command==='SELECT_PARANOIA_PHASE')return{...(await send({type:'SELECT_PARANOIA_PHASE',phase:value as ParanoiaPhase})),success:`${value} selected.`};
  if(command==='SELECT_PARANOIA_CLASSIC_ANSWER')return{...(await send({type:'SELECT_PARANOIA_CLASSIC_ANSWER',targetId:value})),success:'Answer player selected.'};
  if(command==='SUBMIT_PARANOIA_CLASSIC_DECISION')return{...(await send({type:'SUBMIT_PARANOIA_CLASSIC_DECISION',decision:value as'REVEAL'|'KEEP_SECRET'})),success:'Paranoia decision submitted.'};
  if(command==='SUBMIT_PARANOIA_VOTE')return{...(await send({type:'SUBMIT_PARANOIA_VOTE',vote:value as'BELIEVE'|'LYING'|'HOLDING_BACK'})),success:'Vote submitted.'};
  if(command==='SELECT_DUEL_TARGET')return{...(await send({type:'SELECT_DUEL_TARGET',targetId:value})),success:'Duel target selected.'};
  if(command==='SELECT_DUEL_TIMER')return{...(await send({type:'SELECT_DUEL_TIMER',seconds:Number(value) as 15|30|45})),success:`Duel timer set to ${value} seconds.`};
  if(command==='SUBMIT_DUEL_TYPED'){const text=field(wrapper,'duel-response');if(!text)return{ok:false,error:'Write your Duel response first.'};return{...(await send({type:'SUBMIT_DUEL_RESPONSE',side:value as'initiator'|'opponent',value:text})),success:'Duel response submitted.'};}
  if(command==='SUBMIT_DUEL_LIVE')return{...(await send({type:'SUBMIT_DUEL_RESPONSE',side:value as'initiator'|'opponent',completionOnly:true})),success:'Duel response recorded.'};
  if(command==='DUEL_VOTE')return{...(await send({type:'DUEL_VOTE',winnerId:value})),success:'Duel vote submitted.'};
  if(command==='RESOLVE_CHAOS')return{...(await send({type:'RESOLVE_CHAOS'})),success:'Chaos resolved.'};
  if(command==='SELECT_TAG_TARGET')return{...(await send({type:'SELECT_TAG_TARGET',targetId:value})),success:'TAG target selected.'};
  if(command==='SELECT_HIJACK_TARGET')return{...(await send({type:'SELECT_HIJACK_TARGET',targetId:value})),success:'Hijack target selected.'};
  if(command==='SELECT_TABOO_TARGET')return{...(await send({type:'SELECT_TABOO_TARGET',targetId:value})),success:'Taboo target selected.'};
  if(command==='SUBMIT_TABOO_QUESTION'){const text=field(wrapper,'taboo-question');if(!text)return{ok:false,error:'Ask a question first.'};return{...(await send({type:'SUBMIT_TABOO_QUESTION',text})),success:'Question submitted.'};}
  if(command==='SUBMIT_TABOO_ANSWER')return{...(await send({type:'SUBMIT_TABOO_ANSWER',answer:value as'YES'|'OTHER'})),success:'Taboo resolved.'};
  if(command==='SUBMIT_GROUP_QUESTION'){const text=field(wrapper,'group-question'),a=field(wrapper,'group-option-a'),b=field(wrapper,'group-option-b');if(!text||!a||!b)return{ok:false,error:'Provide the question and both choices.'};return{...(await send({type:'SUBMIT_GROUP_QUESTION',text,options:[a,b]})),success:'Group question submitted.'};}
  if(command==='SUBMIT_GROUP_ANSWER')return{...(await send({type:'SUBMIT_GROUP_ANSWER',choice:value})),success:'Group answer submitted.'};
  if(command==='SUBMIT_GROUP_DARE'){const text=field(wrapper,'group-dare');if(!text)return{ok:false,error:'Write the group Dare first.'};return{...(await send({type:'SUBMIT_GROUP_DARE',text})),success:'Group Dare set.'};}
  if(command==='COMPLETE_GROUP_DARE')return{...(await send({type:'COMPLETE_GROUP_DARE',completion:value as'DONE'|'PASS'})),success:'Group Dare response recorded.'};
  if(command==='SELECT_MACHIAVELLI_EFFECT')return{...(await send({type:'SELECT_MACHIAVELLI_EFFECT',effect:value as MachiavelliEffectId})),success:'Machiavelli effect applied.'};
  if(command==='SELECT_REVERSE_CONFESSION_TARGET')return{...(await send({type:'SELECT_REVERSE_CONFESSION_TARGET',targetId:value})),success:'Reverse Confession target selected.'};
  if(command==='SUBMIT_REVERSE_CONFESSION_QUESTION'){const text=field(wrapper,'reverse-question');if(!text)return{ok:false,error:'Ask your target a question first.'};return{...(await send({type:'SUBMIT_REVERSE_CONFESSION_QUESTION',text})),success:'Question submitted.'};}
  if(command==='SUBMIT_REVERSE_TYPED'){const answer=field(wrapper,'reverse-answer');if(!answer)return{ok:false,error:'Type your answer first.'};return{...(await send({type:'SUBMIT_REVERSE_CONFESSION_ANSWER',value:answer})),success:'Answer submitted.'};}
  if(command==='SUBMIT_REVERSE_LIVE')return{...(await send({type:'SUBMIT_REVERSE_CONFESSION_ANSWER',answeredLive:true})),success:'Answered Live recorded.'};
  if(command==='SELECT_DIG_ME_TARGET')return{...(await send({type:'SELECT_DIG_ME_TARGET',targetId:value})),success:'DIG ME target selected.'};
  if(command==='SUBMIT_DIG_QUESTION'){const text=field(wrapper,'dig-question');if(!text)return{ok:false,error:'Ask a question about yourself first.'};return{...(await send({type:'SUBMIT_DIG_ME_QUESTION',text})),success:'DIG ME question submitted.'};}
  if(command==='SUBMIT_DIG_LIVE')return{...(await send({type:'SUBMIT_DIG_ME_QUESTION',askedLive:true})),success:'Live question recorded.'};
  if(command==='COMPLETE_DIG_ME')return{...(await send({type:'COMPLETE_DIG_ME'})),success:'DIG ME completed.'};
  if(command==='ACTIVATE_GHOST')return{...(await send({type:'ACTIVATE_GHOST'})),success:'Ghost activated.'};
  if(command==='END_GHOST_TURN')return{...(await send({type:'END_GHOST_TURN'})),success:'Ghost turn ended.'};
  return{ok:false,error:`Unsupported Telegram action: ${command}`};
}

function field(wrapper:HTMLElement,id:string):string{return(wrapper.querySelector<HTMLInputElement|HTMLTextAreaElement>(`[data-field="${id}"]`)?.value??'').trim();}
function targetGrid(_state:GameState,game:TelegramBackendGame,targetIds:readonly string[],command:string):string{return`<div class="tg-target-grid">${targetIds.map(id=>{const name=game.players.find(player=>player.id===id)?.name??id;return`<button type="button" data-command="${escapeHTML(command)}" data-value="${escapeHTML(id)}"><span>${escapeHTML(name.slice(0,1).toUpperCase())}</span><b>${escapeHTML(name)}</b></button>`;}).join('')}</div>`;}
function promptCard(label:string,text:string):string{return`<div class="tg-prompt-card"><small>${escapeHTML(label)}</small><p>${escapeHTML(text)}</p></div>`;}
function textArea(id:string,label:string):string{return`<label class="tg-context-copy">${escapeHTML(label)}</label><textarea class="tg-input" data-field="${escapeHTML(id)}" rows="4" maxlength="280"></textarea>`;}
function textInput(id:string,label:string):string{return`<label class="tg-context-copy">${escapeHTML(label)}</label><input class="tg-input" data-field="${escapeHTML(id)}" maxlength="120" />`;}
function commandButton(command:string,label:string,value:string):string{return`<button class="tg-context-wide" type="button" data-command="${escapeHTML(command)}" data-value="${escapeHTML(value)}">${escapeHTML(label)}</button>`;}
function titleForKind(kind:string):string{return kind.replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase());}
function escapeHTML(value:unknown):string{return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char]||char);}

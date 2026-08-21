import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card, GameCommand, GameState, SocialPrompt } from '@cribbit/contracts';
import { applyCommand, createGame } from '../src/index.ts';

function unwrap<T>(result:{ok:boolean;state:T;error?:{message:string}}):T{if(!result.ok)throw new Error(result.error?.message??'transition failed');return result.state;}
function card(id:string,kind:Card['kind']):Card{return{id,kind,symbol:kind};}
function state(playerCount=4):GameState{const created=createGame({seed:'canonical-specials',allowVoluntaryDraw:true},Array.from({length:playerCount},(_,i)=>({id:`p${i+1}`,seat:i})),undefined,{now:1000});const s=unwrap(created);s.forcedQueue=[];s.bonusTurnStack=[];s.currentPlayerId='p1';return s;}
function hands(s:GameState,values:Record<string,Card[]>):void{s.players.forEach(p=>p.hand=[...(values[p.id]??[])]);}
function prompt(id:string,kind:SocialPrompt['kind'],targeting:SocialPrompt['targeting']):SocialPrompt{return{id,kind,text:`${kind} ${id}`,world:'UNDER_18_CLEAN',stage:0,groupSizeMin:2,groupSizeMax:10,intensity:0,language:'*',callSuitability:'*',targeting,authorshipMode:'SIGNED',destination:'room',...(kind==='duel'?{duelJudgingMode:'GROUP_VOTE' as const}:{})};}
const promptPool=[prompt('truth','truth','current'),prompt('dare','dare','specific'),prompt('paranoia','paranoia','specific'),prompt('duel','duel','specific')];
function context(){return{canonicalFlow:true,now:2000,promptPool,promptProfile:{stage:Number.MAX_SAFE_INTEGER,intensity:Number.MAX_SAFE_INTEGER,language:'*',callSuitability:'*'}} as any;}
function command(s:GameState,playerId:string,body:any):GameCommand{return{...body,commandId:`${s.revision}:${playerId}:${body.type}:${Math.random()}`,playerId,expectedRevision:s.revision,sessionId:s.id} as GameCommand;}
function send(s:GameState,playerId:string,body:any):GameState{return unwrap(applyCommand(s,command(s,playerId,body),context()));}
function play(s:GameState,playerId:string,cardId:string):GameState{return send(s,playerId,{type:'PLAY_CARD',cardId});}

test('TAG grants exactly one target bonus action and blocks nested TAG',()=>{
  let s=state(3);hands(s,{p1:[card('tag-1','tag'),card('keep','number')],p2:[card('p2','number')],p3:[card('tag-2','tag'),card('bonus-skip','skip')]});
  s=play(s,'p1','tag-1');assert.equal(s.social?.cardKind,'tag');
  s=send(s,'p1',{type:'SELECT_TAG_TARGET',targetId:'p3'});assert.equal(s.currentPlayerId,'p3');assert.equal(s.bonusTurnStack?.at(-1)?.kind,'TAG');
  assert.equal(s.players.find(p=>p.id==='p3')?.hand.some(c=>c.id==='tag-2'),true);
  const nested=applyCommand(s,command(s,'p3',{type:'PLAY_CARD',cardId:'tag-2'}),context());assert.equal(nested.ok,false);assert.equal(nested.error?.code,'ILLEGAL_PLAY');
  s=play(s,'p3','bonus-skip');assert.equal(s.bonusTurnStack?.length??0,0);assert.equal(s.currentPlayerId,'p2');
});

test('Hijack permanently swaps positions, draws one for target, then gives target immediate action',()=>{
  let s=state(3);hands(s,{p1:[card('hijack','hijack'),card('keep','number')],p2:[card('p2','number')],p3:[card('p3','number')]});s.drawPile=[card('drawn','number')];
  const before=s.players.map(p=>p.id);
  s=play(s,'p1','hijack');s=send(s,'p1',{type:'SELECT_HIJACK_TARGET',targetId:'p2'});
  assert.deepEqual(s.players.map(p=>p.id),[before[1],before[0],before[2]]);assert.equal(s.currentPlayerId,'p2');assert.equal(s.players.find(p=>p.id==='p2')?.hand.length,2);assert.equal(s.bonusTurnStack?.at(-1)?.kind,'HIJACK');
});

test('Taboo anything except YES gives target Draw2 before turn resumes',()=>{
  let s=state(3);hands(s,{p1:[card('taboo','taboo'),card('keep','number')],p2:[card('p2','number')],p3:[card('p3','number')]});s.drawPile=[card('d1','number'),card('d2','number')];
  s=play(s,'p1','taboo');s=send(s,'p1',{type:'SELECT_TABOO_TARGET',targetId:'p2'});s=send(s,'p1',{type:'SUBMIT_TABOO_QUESTION',text:'Is this true?'});s=send(s,'p2',{type:'SUBMIT_TABOO_ANSWER',answer:'OTHER'});
  assert.equal(s.players.find(p=>p.id==='p2')?.hand.length,3);assert.equal(s.social,null);assert.equal(s.currentPlayerId,'p2');
});

test('Truth or Chaos disagreement becomes a whole-group Dare including the holder',()=>{
  let s=state(3);hands(s,{p1:[card('toc','truth_or_chaos'),card('keep','number')],p2:[card('p2','number')],p3:[card('p3','number')]});
  s=play(s,'p1','toc');assert.equal(s.social?.canonicalStep,'GROUP_QUESTION');assert.deepEqual(s.social?.pendingTargetIds,['p1','p2','p3']);
  s=send(s,'p1',{type:'SUBMIT_GROUP_QUESTION',text:'Pick one.',options:['A','B']});
  s=send(s,'p1',{type:'SUBMIT_GROUP_ANSWER',choice:'A'});s=send(s,'p2',{type:'SUBMIT_GROUP_ANSWER',choice:'A'});s=send(s,'p3',{type:'SUBMIT_GROUP_ANSWER',choice:'B'});assert.equal(s.social?.canonicalStep,'GROUP_DARE');
  s=send(s,'p1',{type:'SUBMIT_GROUP_DARE',text:'Everyone clap once.'});assert.equal(s.social?.canonicalStep,'GROUP_COMPLETE');
  s=send(s,'p1',{type:'COMPLETE_GROUP_DARE',completion:'DONE'});assert.equal(s.social?.canonicalStep,'GROUP_COMPLETE');
  s=send(s,'p2',{type:'COMPLETE_GROUP_DARE',completion:'DONE'});assert.equal(s.social?.canonicalStep,'GROUP_COMPLETE');
  s=send(s,'p3',{type:'COMPLETE_GROUP_DARE',completion:'DONE'});assert.equal(s.social,null);
});

test('Duel challenger chooses timer and nonparticipants decide group-vote winner',()=>{
  let s=state(4);hands(s,{p1:[card('duel-card','duel'),card('keep','number')],p2:[card('p2','number')],p3:[card('p3','number')],p4:[card('p4','number')]});
  s=play(s,'p1','duel-card');s=send(s,'p1',{type:'SELECT_DUEL_TARGET',targetId:'p2'});s=send(s,'p1',{type:'SELECT_PROMPT_SOURCE',source:'ROULETTE'});s=send(s,'p1',{type:'PUBLISH_PROMPT'});assert.equal(s.social?.canonicalStep,'DUEL_TIMER');
  s=send(s,'p1',{type:'SELECT_DUEL_TIMER',seconds:30});assert.equal(s.social?.duelTimerSeconds,30);
  s=send(s,'p1',{type:'SUBMIT_DUEL_RESPONSE',side:'initiator',completionOnly:true});s=send(s,'p2',{type:'SUBMIT_DUEL_RESPONSE',side:'opponent',completionOnly:true});assert.equal(s.social?.canonicalStep,'DUEL_VOTE');assert.deepEqual(s.social?.pendingDuel?.vote?.eligibleVoterIds,['p3','p4']);
  s=send(s,'p3',{type:'DUEL_VOTE',winnerId:'p1'});s=send(s,'p4',{type:'DUEL_VOTE',winnerId:'p1'});assert.equal(s.social,null);
});

test('Machiavelli Convert Weak changes Skip cards into Draw cards server-side',()=>{
  let s=state(3);hands(s,{p1:[card('mach','machiavelli'),card('keep','number')],p2:[card('skip-hand','skip')],p3:[card('p3','number')]});s.drawPile=[card('skip-deck','skip')];
  s=play(s,'p1','mach');assert.equal(s.social?.canonicalStep,'MACHIAVELLI_CHOICE');s=send(s,'p1',{type:'SELECT_MACHIAVELLI_EFFECT',effect:'CONVERT_WEAK'});
  assert.equal(s.players.find(p=>p.id==='p2')?.hand.find(c=>c.id==='skip-hand')?.kind,'draw');assert.equal(s.drawPile.find(c=>c.id==='skip-deck')?.kind,'draw');
});

test('Ghost consumes one personal turn after a completed ordinary play',()=>{
  let s=state(3);hands(s,{p1:[card('skip','skip'),card('keep','number')],p2:[card('p2','number')],p3:[card('p3','number')]});s.players[0].ghostTurnsRemaining=2;
  const transition=applyCommand(s,command(s,'p1',{type:'PLAY_CARD',cardId:'skip'}),context());s=unwrap(transition);
  assert.equal(s.players[0].ghostTurnsRemaining,1);assert.ok(transition.events.some(event=>event.type==='GHOST_TURN_ENDED'));
});

test('Ghost does not consume its personal turn until a social card fully resolves',()=>{
  let s=state(3);hands(s,{p1:[card('truth-card','truth'),card('keep','number')],p2:[card('p2','number')],p3:[card('p3','number')]});s.players[0].ghostTurnsRemaining=2;
  s=play(s,'p1','truth-card');assert.equal(s.players[0].ghostTurnsRemaining,2);
  s=send(s,'p1',{type:'SELECT_PROMPT_SOURCE',source:'ROULETTE'});s=send(s,'p1',{type:'PUBLISH_PROMPT'});assert.equal(s.players[0].ghostTurnsRemaining,2);
  s=send(s,'p1',{type:'MARK_ANSWERED_LIVE'});assert.equal(s.players[0].ghostTurnsRemaining,1);assert.equal(s.social,null);
});

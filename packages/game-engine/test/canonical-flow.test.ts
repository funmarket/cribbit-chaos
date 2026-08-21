import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card, GameCommand, GameState, SocialPrompt } from '@cribbit/contracts';
import { applyCommand, createGame } from '../src/index.ts';

function unwrap<T>(result:{ok:boolean;state:T;error?:Error}):T{if(!result.ok)throw result.error??new Error('transition failed');return result.state;}
function state(playerCount=3):GameState{const created=createGame({seed:'canonical-live-test',allowVoluntaryDraw:true},Array.from({length:playerCount},(_,i)=>({id:`p${i+1}`,seat:i})),undefined,{now:1000});const s=unwrap(created);s.forcedQueue=[];s.bonusTurnStack=[];return s;}
function card(id:string,kind:Card['kind']):Card{return{id,kind,symbol:kind};}
function setHands(s:GameState,hands:Record<string,Card[]>):void{s.players.forEach(p=>p.hand=[...(hands[p.id]??[])]);}
function prompt(id:string,kind:SocialPrompt['kind'],targeting:SocialPrompt['targeting']):SocialPrompt{return{id,kind,text:`${kind} ${id}`,world:'UNDER_18_CLEAN',stage:0,groupSizeMin:2,groupSizeMax:10,intensity:0,language:'*',callSuitability:'*',targeting,authorshipMode:'SIGNED',destination:'room',...(kind==='duel'?{duelJudgingMode:'GROUP_VOTE' as const}:{})};}
const pool=[prompt('truth-a','truth','current'),prompt('truth-b','truth','current'),prompt('dare-a','dare','specific'),prompt('paranoia-a','paranoia','specific'),prompt('duel-a','duel','specific')];
function ctx(){return{canonicalFlow:true,now:2000,promptPool:pool,promptProfile:{stage:Number.MAX_SAFE_INTEGER,intensity:Number.MAX_SAFE_INTEGER,language:'*',callSuitability:'*'}} as any;}
function cmd(s:GameState,playerId:string,body:any,id=`c-${s.revision}-${body.type}`):GameCommand{return{...body,commandId:id,playerId,expectedRevision:s.revision,sessionId:s.id} as GameCommand;}

function play(s:GameState,playerId:string,cardId:string){return applyCommand(s,cmd(s,playerId,{type:'PLAY_CARD',cardId}),ctx());}

test('Truth live play stops at prompt source with no preselected prompt',()=>{
  let s=state();const truth=card('truth','truth');setHands(s,{p1:[truth,card('keep','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';
  s=unwrap(play(s,'p1','truth'));
  assert.equal(s.social?.cardKind,'truth');assert.equal(s.social?.canonicalStep,'PROMPT_SOURCE');assert.equal(s.social?.prompt,null);
});

test('Dare is target-first then prompt-source',()=>{
  let s=state();const dare=card('dare','dare');setHands(s,{p1:[dare,card('keep','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';
  s=unwrap(play(s,'p1','dare'));assert.equal(s.social?.canonicalStep,'TARGET');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'SELECT_DARE_TARGET',targetId:'p2'}),ctx()));assert.equal(s.social?.pendingTargetId,'p2');assert.equal(s.social?.canonicalStep,'PROMPT_SOURCE');
});

test('Roulette prompt remains private until publish and Rewind changes it once',()=>{
  let s=state();const truth=card('truth','truth');setHands(s,{p1:[truth,card('keep','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';
  s=unwrap(play(s,'p1','truth'));s=unwrap(applyCommand(s,cmd(s,'p1',{type:'SELECT_PROMPT_SOURCE',source:'ROULETTE'}),ctx()));assert.equal(s.social?.canonicalStep,'PRIVATE_PREVIEW');const first=s.social?.prompt?.id;assert.ok(first);
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'REWIND_PROMPT'}),ctx()));assert.notEqual(s.social?.prompt?.id,first);assert.deepEqual(s.rewindUsedByPlayerIds,['p1']);
  const denied=applyCommand(s,cmd(s,'p1',{type:'REWIND_PROMPT'}),ctx());assert.equal(denied.ok,false);assert.equal(denied.error?.code,'REWIND_ALREADY_USED');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'PUBLISH_PROMPT'}),ctx()));assert.equal(s.social?.canonicalStep,'ANSWER');
});

test('forced interaction drawn is not kept in hand and triggers before turn advance',()=>{
  let s=state();setHands(s,{p1:[card('held','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';s.drawPile=[card('forced-truth','truth'),card('later','number')];
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'DRAW_CARD'}),ctx()));
  assert.equal(s.players[0].hand.some(c=>c.id==='forced-truth'),false);assert.equal(s.discardPile.at(-1)?.id,'forced-truth');assert.equal(s.social?.cardKind,'truth');assert.equal(s.social?.forced,true);assert.equal(s.currentPlayerId,'p1');
});

test('Chaos exposes only Blind Swap or Reverse Order and resolves server-side',()=>{
  let s=state();const chaos=card('chaos','chaos');setHands(s,{p1:[chaos,card('keep','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';
  s=unwrap(play(s,'p1','chaos'));assert.ok(['BLIND_SWAP','REVERSE_ORDER'].includes(s.social?.chaosEffectId??''));assert.equal(s.social?.canonicalStep,'CHAOS_RESOLVE');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'RESOLVE_CHAOS'}),ctx()));assert.equal(s.social,null);
});

test('Reverse Confession is holder target question then target answer',()=>{
  let s=state();const reverse=card('reverse','reverse_confession');setHands(s,{p1:[reverse,card('keep','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';
  s=unwrap(play(s,'p1','reverse'));assert.equal(s.social?.canonicalStep,'TARGET');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'SELECT_REVERSE_CONFESSION_TARGET',targetId:'p2'}),ctx()));assert.equal(s.social?.canonicalStep,'REVERSE_QUESTION');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'SUBMIT_REVERSE_CONFESSION_QUESTION',text:'What do you admit?'}),ctx()));assert.equal(s.social?.canonicalStep,'REVERSE_ANSWER');
  s=unwrap(applyCommand(s,cmd(s,'p2',{type:'SUBMIT_REVERSE_CONFESSION_ANSWER',answeredLive:true}),ctx()));assert.equal(s.social,null);
});

test('DIG ME requires holder target and holder question about self before target completes',()=>{
  let s=state();const dig=card('dig','dig_me');setHands(s,{p1:[dig,card('keep','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';
  s=unwrap(play(s,'p1','dig'));s=unwrap(applyCommand(s,cmd(s,'p1',{type:'SELECT_DIG_ME_TARGET',targetId:'p2'}),ctx()));assert.equal(s.social?.canonicalStep,'DIG_QUESTION');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'SUBMIT_DIG_ME_QUESTION',text:'What is my best habit?'}),ctx()));assert.equal(s.social?.canonicalStep,'DIG_ANSWER');
  s=unwrap(applyCommand(s,cmd(s,'p2',{type:'COMPLETE_DIG_ME'}),ctx()));assert.equal(s.social,null);
});

test('Ghost activation blocks normal draw for two personal turns',()=>{
  let s=state();setHands(s,{p1:[],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';s.players[0].ghostArmedCard=card('ghost','ghost');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'ACTIVATE_GHOST'}),ctx()));assert.equal(s.players[0].ghostTurnsRemaining,2);
  const draw=applyCommand(s,cmd(s,'p1',{type:'DRAW_CARD'}),ctx());assert.equal(draw.ok,false);assert.equal(draw.error?.code,'ILLEGAL_PLAY');
  s=unwrap(applyCommand(s,cmd(s,'p1',{type:'END_GHOST_TURN'}),ctx()));assert.equal(s.players[0].ghostTurnsRemaining,1);
});

test('canonical command replay is side-effect free',()=>{
  let s=state();const truth=card('truth','truth');setHands(s,{p1:[truth,card('keep','number')],p2:[card('x','number')],p3:[card('y','number')]});s.currentPlayerId='p1';
  const command=cmd(s,'p1',{type:'PLAY_CARD',cardId:'truth'},'same-id');const first=applyCommand(s,command,ctx());assert.equal(first.ok,true);const after=first.state;const replay=applyCommand(after,command,ctx());assert.equal(replay.ok,true);assert.equal(replay.idempotentReplay,true);assert.equal(replay.state.revision,after.revision);assert.deepEqual(replay.events,[]);
});

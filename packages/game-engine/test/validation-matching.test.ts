import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameState } from '@cribbit/contracts';
import { validatePlay } from '../src/validation.ts';

function card(id:string, kind:Card['kind'], fields:Partial<Card>={}):Card { return { id,kind,...fields }; }
function stateFor(topSymbol:string|null, handCard:Card):GameState {
  return {
    id:'matching-test',revision:0,status:'ACTIVE',phase:'PLAY_DRAW',
    config:{seed:'matching-test',startingHandCount:7,drawPenalty:2,drawPenaltySkipsTurn:true,allowVoluntaryDraw:true,startingDirection:1,startingPlayerIndex:0,initialDiscardStrategy:'FIRST_NUMBER_CARD',contentWorld:'UNDER_18_CLEAN',turnTimeoutMs:30000,socialTimeoutMs:45000},
    players:[{id:'p1',seat:0,hand:[handCard],status:'ACTIVE'},{id:'p2',seat:1,hand:[],status:'ACTIVE'}],
    drawPile:[],discardPile:[],currentPlayerId:'p1',direction:1,activeColor:'lime',activeSymbol:topSymbol,pendingEffect:null,timer:null,social:null,winnerId:null,rewindUsedByPlayerIds:[],processedCommands:{},forcedQueue:[],bonusTurnStack:[],
  };
}

test('every normal turn-playable special is legal regardless of active color or symbol', () => {
  const specials = ['skip','reverse','draw','wild','truth','dare','paranoia','chaos','duel','tag','truth_or_chaos','hijack','taboo','machiavelli','ghost','reverse_confession','dig_me'] as const;
  for (const kind of specials) {
    const candidate=card(kind,kind,{symbol:kind,color:kind==='wild'?undefined:'purple'});
    assert.equal(validatePlay(stateFor('9',candidate),'p1',candidate.id).ok,true,kind);
  }
});

test('Number still requires active color or number matching', () => {
  assert.equal(validatePlay(stateFor('7',card('bad','number',{color:'purple',value:4,symbol:'4'})),'p1','bad').ok,false);
  assert.equal(validatePlay(stateFor('7',card('number-match','number',{color:'purple',value:7,symbol:'7'})),'p1','number-match').ok,true);
  assert.equal(validatePlay(stateFor('4',card('color-match','number',{color:'lime',value:9,symbol:'9'})),'p1','color-match').ok,true);
});

test('Nope remains reaction-only and cannot become legal through activeSymbol matching', () => {
  const candidate=card('nope','nope',{symbol:'nope'});
  assert.equal(validatePlay(stateFor('nope',candidate),'p1',candidate.id).ok,false);
});

test('nested TAG is blocked while a TAG bonus action is active', () => {
  const candidate=card('tag','tag',{symbol:'tag'});
  const state=stateFor('number',candidate);
  state.bonusTurnStack=[{kind:'TAG',playerId:'p1',returnPlayerId:'p2',pendingWinnerId:null}];
  const result=validatePlay(state,'p1',candidate.id);
  assert.equal(result.ok,false);
  assert.equal(result.error?.code,'ILLEGAL_PLAY');
});

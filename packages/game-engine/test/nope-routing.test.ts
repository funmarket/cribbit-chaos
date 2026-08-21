import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameCommand } from '@cribbit/contracts';
import { promptDefinitions } from '@cribbit/prompts';
import { applyCommand, createGame } from '../src/index.ts';

function command(
  state: ReturnType<typeof createGame> extends infer _T ? any : never,
  type: GameCommand['type'],
  fields: Record<string, unknown> = {},
): GameCommand {
  return {
    type,
    commandId:`test-${type}-${state.revision}`,
    playerId:'p1',
    expectedRevision:state.revision,
    sessionId:state.id,
    ...fields,
  } as GameCommand;
}

test('Truth can be cancelled by an owned Nope through the public shared command path', () => {
  const created = createGame(
    { seed:'nope-routing', startingHandCount:0, startingPlayerIndex:0, allowVoluntaryDraw:true, contentWorld:'UNDER_18_CLEAN' },
    [{ id:'p1', seat:0 }, { id:'p2', seat:1 }],
    undefined,
    { now:1000 },
  );
  assert.equal(created.ok, true);
  let state = created.state;

  const truth: Card = { id:'truth-test', kind:'truth', symbol:'truth' };
  const nope: Card = { id:'nope-test', kind:'nope', symbol:'nope' };
  const filler: Card = { id:'filler-test', kind:'number', color:'lime', value:4, symbol:'4' };
  state.players[0].hand = [truth, nope, filler];

  const played = applyCommand(
    state,
    command(state, 'PLAY_CARD', { cardId:truth.id }),
    { now:1100, promptPool:promptDefinitions, promptProfile:{ stage:Number.MAX_SAFE_INTEGER, intensity:Number.MAX_SAFE_INTEGER, language:'*', callSuitability:'*' } },
  );
  assert.equal(played.ok, true);
  assert.equal(played.state.social?.cardKind, 'truth');
  state = played.state;

  const blocked = applyCommand(
    state,
    command(state, 'PLAY_NOPE', { cardId:nope.id }),
    { now:1200, promptPool:promptDefinitions },
  );
  assert.equal(blocked.ok, true);
  assert.equal(blocked.state.social, null);
  assert.equal(blocked.state.players[0].hand.some(card => card.id === nope.id), false);
  assert.equal(blocked.state.players[0].hand.some(card => card.id === filler.id), true);
  assert.equal(blocked.events.some(event => event.type === 'NOPE_PLAYED'), true);
  assert.equal(blocked.events.some(event => event.type === 'SOCIAL_EFFECT_RESOLVED'), true);
  assert.equal(blocked.events.some(event => event.type === 'DRAW_EFFECT_APPLIED'), false);
});

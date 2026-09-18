import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameCommand, GameCommandType, GameState, GameTransition, SocialPrompt } from '@cribbit/contracts';
import { applyCommand, createGame, projectDecisionCapabilities } from '../src/index.ts';

function makeCard(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return { id, kind, ...fields } as Card;
}

function unwrap<T>(transition: GameTransition<T>): T {
  if (!transition.ok) throw transition.error ?? new Error('Expected transition to succeed.');
  return transition.state;
}

function baseState(seed: string): GameState {
  return unwrap(createGame({ seed, startingHandCount: 0, startingPlayerIndex: 0, allowVoluntaryDraw: true }, [
    { id: 'player-1', seat: 0 },
    { id: 'player-2', seat: 1 },
    { id: 'player-3', seat: 2 }
  ], undefined, { now: 1000 }));
}

function setPlayableDiscard(state: GameState): void {
  state.discardPile = [makeCard('discard-lime-1', 'number', { color: 'lime', value: 1, symbol: '1' })];
  state.activeColor = 'lime';
  state.activeSymbol = '1';
}

function command(state: GameState, playerId: string, type: GameCommandType, fields: Partial<GameCommand> = {}): GameCommand {
  return {
    commandId: `${type}:${state.revision}:${playerId}:${JSON.stringify(fields)}`,
    playerId,
    expectedRevision: state.revision,
    sessionId: state.id,
    type,
    ...fields
  } as GameCommand;
}

function prompt(kind: SocialPrompt['kind'], targeting: SocialPrompt['targeting']): SocialPrompt {
  return {
    id: `${kind}-${targeting}`,
    kind,
    text: `${kind} ${targeting} prompt`,
    world: 'UNDER_18_CLEAN',
    stage: 0,
    groupSizeMin: 2,
    groupSizeMax: 10,
    intensity: 0,
    language: '*',
    callSuitability: '*',
    targeting,
    authorshipMode: 'SIGNED',
    destination: 'room',
    ...(kind === 'truth_or_chaos' ? { options: ['YES', 'NO'] } : {})
  };
}

const promptPool = [
  prompt('truth', 'specific'),
  prompt('dare', 'specific'),
  prompt('paranoia', 'specific'),
  prompt('reverse_confession', 'specific'),
  prompt('taboo', 'specific'),
  prompt('dig_me', 'specific'),
  prompt('chaos', 'all'),
  prompt('truth_or_chaos', 'all')
];

function playOnlyCard(kind: Card['kind']): GameState {
  let state = baseState(`corrected-${kind}`);
  setPlayableDiscard(state);
  state.players[0].hand = [makeCard(`${kind}-card`, kind, { symbol: kind })];
  return unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: `${kind}-card` }), { now: 1100, promptPool }));
}

test('Truth is target-first: actor chooses another player before selected target answers', () => {
  let state = playOnlyCard('truth');

  assert.equal(state.social?.cardKind, 'truth');
  assert.equal(state.social?.pendingTargetId, null);
  assert.deepEqual(state.social?.pendingTargetIds.sort(), ['player-2', 'player-3']);
  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, 'SELECT_TARGET');
  assert.equal(projectDecisionCapabilities(state, 'player-2').requiredAction, null);

  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_SOCIAL_TARGET', { targetId: 'player-2' }), { now: 1200, promptPool }));
  assert.equal(state.social?.pendingTargetId, 'player-2');
  assert.equal(state.social?.prompt?.kind, 'truth');
  assert.equal(state.social?.promptSelection?.selection.targeting, 'specific');
  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, null);
  assert.equal(projectDecisionCapabilities(state, 'player-2').requiredAction, 'SELECT_ANSWER_MODE');
});

test('Reverse Confession is target-first and completed by the selected target, not the actor', () => {
  let state = playOnlyCard('reverse_confession');

  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, 'SELECT_TARGET');
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_SOCIAL_TARGET', { targetId: 'player-3' }), { now: 1200, promptPool }));

  assert.equal(state.social?.pendingTargetId, 'player-3');
  assert.equal(state.social?.prompt?.kind, 'reverse_confession');
  assert.equal(state.social?.promptSelection?.selection.targeting, 'specific');
  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, null);
  assert.equal(projectDecisionCapabilities(state, 'player-3').requiredAction, 'SELECT_ANSWER_MODE');
});

test('TAG target draws exactly one real card and does not receive a bonus play action', () => {
  let state = baseState('corrected-tag');
  setPlayableDiscard(state);
  state.players[0].hand = [makeCard('tag-card', 'tag', { symbol: 'tag' })];
  state.drawPile = [makeCard('drawn-number', 'number', { color: 'cyan', value: 4, symbol: '4' })];
  const beforeTargetHand = state.players[1].hand.length;

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'tag-card' }), { now: 1100, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_SOCIAL_TARGET', { targetId: 'player-2' }), { now: 1200, promptPool }));

  assert.equal(state.players.find(player => player.id === 'player-2')?.hand.length, beforeTargetHand + 1);
  assert.equal(state.players.find(player => player.id === 'player-2')?.hand.at(-1)?.id, 'drawn-number');
  assert.notEqual(state.currentPlayerId, 'player-2');
  assert.equal(state.social, null);
});

test('shared engine forced-on-draw Truth enters target-first flow instead of hand inventory', () => {
  let state = baseState('forced-draw-truth');
  setPlayableDiscard(state);
  state.players[0].hand = [];
  state.drawPile = [makeCard('drawn-truth', 'truth', { symbol: 'truth' })];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'DRAW_CARD'), { now: 1100, promptPool }));

  assert.equal(state.players[0].hand.some(card => card.id === 'drawn-truth'), false);
  assert.equal(state.social?.cardId, 'drawn-truth');
  assert.equal(state.social?.cardKind, 'truth');
  assert.equal(state.social?.actorId, 'player-1');
  assert.deepEqual(state.social?.pendingTargetIds.sort(), ['player-2', 'player-3']);
  assert.equal(state.currentPlayerId, 'player-1');
  assert.equal(projectDecisionCapabilities(state, 'player-1').requiredAction, 'SELECT_TARGET');
});

test('shared engine draw penalties queue multiple forced-on-draw cards FIFO before play continues', () => {
  let state = baseState('forced-draw-penalty-fifo');
  setPlayableDiscard(state);
  state.players[0].hand = [makeCard('draw-card', 'draw', { color: 'lime', symbol: 'draw' })];
  state.players[1].hand = [];
  state.drawPile = [
    makeCard('drawn-truth', 'truth', { symbol: 'truth' }),
    makeCard('drawn-dare', 'dare', { symbol: 'dare' })
  ];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'draw-card' }), { now: 1100, promptPool }));

  const targetHandIds = state.players[1].hand.map(card => card.id);
  assert.deepEqual(targetHandIds, []);
  assert.equal(state.social?.cardId, 'drawn-truth');
  assert.equal(state.social?.cardKind, 'truth');
  assert.equal(state.social?.actorId, 'player-2');
  assert.deepEqual(state.pendingForcedInteractions.map(item => item.card.id), ['drawn-dare']);
  assert.equal(state.currentPlayerId, 'player-1');
});

test('Machiavelli Paranoia Spreads grants only DIG ME or PARANOIA generated cards', () => {
  let state = baseState('machiavelli-paranoia-spreads');
  setPlayableDiscard(state);
  state.players.forEach(player => { player.hand = []; });
  state.players[0].hand = [makeCard('machiavelli-card', 'machiavelli', { symbol: 'machiavelli' })];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'machiavelli-card' }), { now: 1100, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_MACHIAVELLI_EFFECT', { effect: 'PARANOIA_SPREADS' }), { now: 1200, promptPool }));

  const generatedKinds = state.players.flatMap(player => player.hand.filter(card => card.id.includes(':paranoia-spreads:')).map(card => card.kind));
  assert.deepEqual(new Set(generatedKinds), new Set(['dig_me', 'paranoia']));
  assert.equal(generatedKinds.includes('truth'), false);
});

test('Paranoia Classic voluntary Keep Secret applies Draw 1 to the answer player', () => {
  let state = baseState('paranoia-keep-secret-draw-one');
  setPlayableDiscard(state);
  state.players.forEach(player => { player.hand = []; });
  state.players[0].hand = [makeCard('paranoia-card', 'paranoia', { symbol: 'paranoia' })];
  state.drawPile = [makeCard('keep-secret-penalty', 'number', { color: 'cyan', value: 7, symbol: '7' })];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'paranoia-card' }), { now: 1100, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_PARANOIA_TARGET', { targetId: 'player-2' }), { now: 1200, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_PARANOIA_PHASE', { phase: 'CLASSIC' }), { now: 1300, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-2', 'SELECT_PARANOIA_CLASSIC_ANSWER', { targetId: 'player-3' }), { now: 1400, promptPool }));

  const before = state.players[2].hand.length;
  state = unwrap(applyCommand(state, command(state, 'player-3', 'SUBMIT_PARANOIA_CLASSIC_DECISION', { decision: 'KEEP_SECRET' }), { now: 1500, promptPool }));

  assert.equal(state.social?.classicRevealDecision, 'KEEP_SECRET');
  assert.equal(state.players[2].hand.length, before + 1);
  assert.equal(state.players[2].hand.at(-1)?.id, 'keep-secret-penalty');
});

test('Chaos Blind Swap transfers up to three cards simultaneously and transferred forced cards do not trigger', () => {
  let state = unwrap(createGame({ seed: 'chaos-blind-swap', startingHandCount: 0, startingPlayerIndex: 0, allowVoluntaryDraw: true }, [
    { id: 'player-1', seat: 0 },
    { id: 'player-2', seat: 1 },
    { id: 'player-3', seat: 2 },
    { id: 'player-4', seat: 3 }
  ], undefined, { now: 1000 }));
  setPlayableDiscard(state);
  state.players[0].hand = [
    makeCard('chaos-card', 'chaos', { symbol: 'chaos' }),
    makeCard('p1-a', 'number', { color: 'lime', value: 2, symbol: '2' }),
    makeCard('p1-b', 'truth', { symbol: 'truth' }),
    makeCard('p1-c', 'dare', { symbol: 'dare' })
  ];
  state.players[1].hand = [
    makeCard('p2-a', 'number', { color: 'cyan', value: 2, symbol: '2' }),
    makeCard('p2-b', 'number', { color: 'cyan', value: 3, symbol: '3' }),
    makeCard('p2-c', 'number', { color: 'cyan', value: 4, symbol: '4' })
  ];
  state.players[2].hand = [
    makeCard('p3-a', 'number', { color: 'orange', value: 2, symbol: '2' }),
    makeCard('p3-b', 'number', { color: 'orange', value: 3, symbol: '3' }),
    makeCard('p3-c', 'number', { color: 'orange', value: 4, symbol: '4' })
  ];
  state.players[3].hand = [
    makeCard('p4-a', 'paranoia', { symbol: 'paranoia' }),
    makeCard('p4-b', 'truth', { symbol: 'truth' }),
    makeCard('p4-c', 'dare', { symbol: 'dare' })
  ];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'chaos-card' }), { now: 1100, promptPool }));

  assert.equal(state.social, null);
  assert.deepEqual(state.pendingForcedInteractions, []);
  assert.deepEqual(state.players.map(player => player.hand.length), [3, 3, 3, 3]);
  assert.deepEqual(new Set(state.players[0].hand.map(card => card.id)), new Set(['p4-a', 'p4-b', 'p4-c']));
  assert.deepEqual(new Set(state.players[1].hand.map(card => card.id)), new Set(['p1-a', 'p1-b', 'p1-c']));
  assert.equal(state.players[0].hand.some(card => card.kind === 'truth' || card.kind === 'dare' || card.kind === 'paranoia'), true);
});

test('Chaos Reverse Order reverses direction and records persistent Chaos reverse state', () => {
  let state = unwrap(createGame({ seed: 'chaos-a', startingHandCount: 0, startingPlayerIndex: 0, allowVoluntaryDraw: true }, [
    { id: 'player-1', seat: 0 },
    { id: 'player-2', seat: 1 },
    { id: 'player-3', seat: 2 }
  ], undefined, { now: 1000 }));
  setPlayableDiscard(state);
  state.players[0].hand = [
    makeCard('chaos-card', 'chaos', { symbol: 'chaos' }),
    makeCard('kept-card', 'number', { color: 'lime', value: 2, symbol: '2' })
  ];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'chaos-card' }), { now: 1100, promptPool }));

  assert.equal(state.social, null);
  assert.equal(state.direction, -1);
  assert.equal(state.chaosReverseActive, true);
});

test('Truth or Chaos matching choices resolve as Truth consensus without group punishment', () => {
  let state = baseState('truth-or-chaos-match');
  setPlayableDiscard(state);
  state.players[0].hand = [makeCard('toc-card', 'truth_or_chaos', { symbol: 'truth_or_chaos' })];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'toc-card' }), { now: 1100, promptPool }));
  for (const playerId of ['player-1', 'player-2', 'player-3']) {
    state = unwrap(applyCommand(state, command(state, playerId, 'SELECT_ANSWER_MODE', { mode: 'CHOOSE' }), { now: 1200, promptPool }));
    const transition = applyCommand(state, command(state, playerId, 'SUBMIT_CHOICE', { choice: 'YES' }), { now: 1300, promptPool });
    if (playerId === 'player-3') {
      assert.equal(transition.ok, true);
      assert.equal(transition.events.some(event => event.type === 'TRUTH_OR_CHAOS_CONSENSUS_RESOLVED' && (event.payload as { outcome?: string }).outcome === 'TRUTH'), true);
    }
    state = unwrap(transition);
  }

  assert.equal(state.social, null);
});

test('Truth or Chaos differing choices enter group punishment state', () => {
  let state = baseState('truth-or-chaos-mismatch');
  setPlayableDiscard(state);
  state.players[0].hand = [makeCard('toc-card', 'truth_or_chaos', { symbol: 'truth_or_chaos' })];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'toc-card' }), { now: 1100, promptPool }));
  const choices: Record<string, string> = { 'player-1': 'YES', 'player-2': 'YES', 'player-3': 'NO' };
  for (const playerId of ['player-1', 'player-2', 'player-3']) {
    state = unwrap(applyCommand(state, command(state, playerId, 'SELECT_ANSWER_MODE', { mode: 'CHOOSE' }), { now: 1200, promptPool }));
    const transition = applyCommand(state, command(state, playerId, 'SUBMIT_CHOICE', { choice: choices[playerId] }), { now: 1300, promptPool });
    if (playerId === 'player-3') {
      assert.equal(transition.ok, true);
      assert.equal(transition.events.some(event => event.type === 'TRUTH_OR_CHAOS_CONSENSUS_RESOLVED' && (event.payload as { outcome?: string }).outcome === 'CHAOS'), true);
    }
    state = unwrap(transition);
  }

  assert.equal(state.social?.cardKind, 'truth_or_chaos');
  assert.equal(state.social?.truthOrChaosOutcome, 'CHAOS');
  assert.equal(state.social?.groupPunishmentPending, true);
});

test('Ghost can be armed, activated, and suppresses two normal no-legal-card draws', () => {
  let state = baseState('ghost-lifecycle');
  setPlayableDiscard(state);
  state.players[0].hand = [
    makeCard('ghost-card', 'ghost', { symbol: 'ghost' }),
    makeCard('after-ghost', 'number', { color: 'orange', value: 9, symbol: '9' })
  ];
  state.players[1].hand = [
    makeCard('p2-play', 'number', { color: 'lime', value: 2, symbol: '2' }),
    makeCard('p2-keep', 'number', { color: 'orange', value: 8, symbol: '8' })
  ];
  state.players[2].hand = [
    makeCard('p3-play', 'number', { color: 'lime', value: 3, symbol: '3' }),
    makeCard('p3-keep', 'number', { color: 'orange', value: 7, symbol: '7' })
  ];
  state.drawPile = [
    makeCard('should-not-draw', 'number', { color: 'cyan', value: 1, symbol: '1' }),
    makeCard('p2-draw', 'number', { color: 'cyan', value: 2, symbol: '2' }),
    makeCard('p3-draw', 'number', { color: 'cyan', value: 3, symbol: '3' })
  ];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'ghost-card' }), { now: 1100, promptPool }));
  assert.equal(state.ghostEffects[0]?.status, 'ARMED');

  state = unwrap(applyCommand(state, command(state, 'player-1', 'ACTIVATE_GHOST', { cardId: 'ghost-card' }), { now: 1150, promptPool }));
  assert.equal(state.ghostEffects[0]?.status, 'ACTIVE');
  assert.equal(state.ghostEffects[0]?.turnsRemaining, 2);

  state = unwrap(applyCommand(state, command(state, 'player-2', 'PLAY_CARD', { cardId: 'p2-play' }), { now: 1200, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-3', 'PLAY_CARD', { cardId: 'p3-play' }), { now: 1300, promptPool }));
  assert.equal(state.currentPlayerId, 'player-1');

  const handBefore = state.players[0].hand.map(card => card.id);
  state = unwrap(applyCommand(state, command(state, 'player-1', 'DRAW_CARD'), { now: 1400, promptPool }));
  assert.deepEqual(state.players[0].hand.map(card => card.id), handBefore);
  assert.equal(state.ghostEffects[0]?.turnsRemaining, 1);

  state = unwrap(applyCommand(state, command(state, 'player-2', 'DRAW_CARD'), { now: 1500, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-3', 'DRAW_CARD'), { now: 1600, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-1', 'DRAW_CARD'), { now: 1700, promptPool }));
  assert.equal(state.ghostEffects.length, 0);
});

test('Hijack swaps authoritative player order, not just seat labels', () => {
  let state = unwrap(createGame({ seed: 'hijack-turn-order', startingHandCount: 0, startingPlayerIndex: 0, allowVoluntaryDraw: true }, [
    { id: 'player-1', seat: 0 },
    { id: 'player-2', seat: 1 },
    { id: 'player-3', seat: 2 },
    { id: 'player-4', seat: 3 }
  ], undefined, { now: 1000 }));
  setPlayableDiscard(state);
  state.players.forEach(player => { player.hand = []; });
  state.players[0].hand = [makeCard('hijack-card', 'hijack', { symbol: 'hijack' })];
  state.drawPile = [makeCard('hijack-penalty', 'number', { color: 'purple', value: 5, symbol: '5' })];

  state = unwrap(applyCommand(state, command(state, 'player-1', 'PLAY_CARD', { cardId: 'hijack-card' }), { now: 1100, promptPool }));
  state = unwrap(applyCommand(state, command(state, 'player-1', 'SELECT_SOCIAL_TARGET', { targetId: 'player-3' }), { now: 1200, promptPool }));

  assert.deepEqual(state.players.map(player => player.id), ['player-3', 'player-2', 'player-1', 'player-4']);
  assert.deepEqual(state.players.map(player => player.seat), [0, 1, 2, 3]);
});

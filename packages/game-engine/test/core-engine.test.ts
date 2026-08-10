import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameCommand, GameEvent, GameState, GameTransition } from '@cribbit/contracts';
import { applyCommand, buildCoreDeck, createGame, drawCards, recycleDiscardPile, validatePlay } from '../src/index.ts';

function makeCard(id: string, kind: Card['kind'], fields: Partial<Card> = {}): Card {
  return {
    id,
    kind,
    ...fields
  } as Card;
}

function unwrap<T>(transition: GameTransition<T>): T {
  if (!transition.ok) {
    throw transition.error ?? new Error('Expected transition to succeed.');
  }
  return transition.state;
}

function baseState(playerCount = 3): GameState {
  const players = Array.from({ length: playerCount }, (_, index) => ({ id: `player-${index + 1}`, seat: index }));
  const transition = createGame({ seed: 'core-engine-test-seed' }, players);
  return unwrap(transition);
}

function setHands(state: GameState, hands: Record<string, Card[]>): void {
  for (const player of state.players) {
    player.hand = [...(hands[player.id] ?? [])];
  }
}

function setTopDiscard(state: GameState, card: Card): void {
  state.discardPile = [card];
  state.activeColor = card.color ?? null;
  state.activeSymbol = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : card.symbol ?? card.kind;
}

function playCommand(state: GameState, commandId: string, cardId: string, expectedRevision = state.revision): GameCommand {
  return {
    commandId,
    expectedRevision,
    sessionId: state.id,
    type: 'PLAY_CARD',
    cardId
  };
}

function drawCommand(state: GameState, commandId: string, expectedRevision = state.revision): GameCommand {
  return {
    commandId,
    expectedRevision,
    sessionId: state.id,
    type: 'DRAW_CARD'
  };
}

function selectColorCommand(state: GameState, commandId: string, color: 'lime' | 'orange' | 'cyan' | 'purple', expectedRevision = state.revision): GameCommand {
  return {
    commandId,
    expectedRevision,
    sessionId: state.id,
    type: 'SELECT_WILD_COLOR',
    color
  };
}

test('buildCoreDeck is deterministic and has the expected core composition', () => {
  const deckA = buildCoreDeck('deck-seed');
  const deckB = buildCoreDeck('deck-seed');

  assert.equal(deckA.length, 104);
  assert.deepEqual(deckA.map(card => card.id), deckB.map(card => card.id));

  const colors: Array<'lime' | 'orange' | 'cyan' | 'purple'> = ['lime', 'orange', 'cyan', 'purple'];
  for (const color of colors) {
    const colorCards = deckA.filter(card => card.color === color);
    assert.equal(colorCards.filter(card => card.kind === 'number').length, 19, `${color} number card count`);
    assert.equal(colorCards.filter(card => card.kind === 'skip').length, 2, `${color} skip card count`);
    assert.equal(colorCards.filter(card => card.kind === 'reverse').length, 2, `${color} reverse card count`);
    assert.equal(colorCards.filter(card => card.kind === 'draw').length, 2, `${color} draw card count`);
  }

  assert.equal(deckA.filter(card => card.kind === 'wild').length, 4);
});

test('createGame deals seven cards per player and starts with a numbered discard', () => {
  const transition = createGame({ seed: 'initial-game-seed' }, [{ id: 'alice' }, { id: 'bob' }]);
  const state = unwrap(transition);

  assert.equal(state.status, 'ACTIVE');
  assert.equal(state.phase, 'PLAY_DRAW');
  assert.equal(state.currentPlayerId, 'alice');
  assert.equal(state.players[0].hand.length, 7);
  assert.equal(state.players[1].hand.length, 7);
  assert.equal(state.discardPile.length, 1);
  assert.equal(state.discardPile[0].kind, 'number');
  assert.equal(state.revision, 0);
  assert.equal(state.processedCommands && Object.keys(state.processedCommands).length, 0);

  const totalCards =
    state.drawPile.length +
    state.discardPile.length +
    state.players.reduce((sum, player) => sum + player.hand.length, 0);
  assert.equal(totalCards, 104);
});

test('playing a matching card advances the turn, updates the discard, and records the command', () => {
  const state = baseState(2);
  const playedCard = makeCard('play-1', 'number', { color: 'orange', value: 3, symbol: '3' });
  const fillerCard = makeCard('filler', 'number', { color: 'cyan', value: 9, symbol: '9' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [playedCard, fillerCard],
    'player-2': []
  });

  const result = applyCommand(state, playCommand(state, 'play-match', 'play-1'));
  assert.equal(result.ok, true);
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.currentPlayerId, 'player-2');
  assert.equal(result.state.players[0].hand.length, 1);
  assert.equal(result.state.discardPile.at(-1)?.id, 'play-1');
  assert.equal(result.state.processedCommands['play-match']?.revision, 1);
  assert.deepEqual(result.events.map(event => event.type), ['CARD_PLAYED', 'TURN_ADVANCED']);
});

test('invalid play attempts are rejected before state changes', () => {
  const wrongTurnState = baseState(2);
  const legalCard = makeCard('legal', 'number', { color: 'lime', value: 3, symbol: '3' });

  wrongTurnState.currentPlayerId = 'player-2';
  setTopDiscard(wrongTurnState, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(wrongTurnState, {
    'player-1': [legalCard],
    'player-2': [makeCard('other', 'number', { color: 'cyan', value: 2, symbol: '2' })]
  });

  const wrongTurn = validatePlay(wrongTurnState, 'player-1', 'legal');
  assert.equal(wrongTurn.ok, false);
  assert.equal(wrongTurn.error?.code, 'NOT_YOUR_TURN');

  const missingCard = applyCommand(wrongTurnState, playCommand(wrongTurnState, 'missing-card', 'not-in-hand'));
  assert.equal(missingCard.ok, false);
  assert.equal(missingCard.error?.code, 'CARD_NOT_IN_HAND');

  const illegalState = baseState(2);
  const illegalCard = makeCard('illegal', 'number', { color: 'purple', value: 8, symbol: '8' });

  illegalState.currentPlayerId = 'player-1';
  setTopDiscard(illegalState, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(illegalState, {
    'player-1': [illegalCard],
    'player-2': []
  });

  const illegalPlay = applyCommand(illegalState, playCommand(illegalState, 'illegal-play', 'illegal'));
  assert.equal(illegalPlay.ok, false);
  assert.equal(illegalPlay.error?.code, 'ILLEGAL_PLAY');
  assert.equal(illegalState.revision, 0);
  assert.equal(illegalState.currentPlayerId, 'player-1');
});

test('drawing is blocked while a legal play exists when voluntary draws are disabled', () => {
  const state = baseState(2);
  const playableCard = makeCard('playable', 'number', { color: 'orange', value: 3, symbol: '3' });

  state.currentPlayerId = 'player-1';
  state.config.allowVoluntaryDraw = false;
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [playableCard],
    'player-2': []
  });

  const result = applyCommand(state, drawCommand(state, 'draw-blocked'));
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'ILLEGAL_PLAY');
});

test('drawing a card advances play to the next player when no legal play exists', () => {
  const state = baseState(3);
  const drawnCard = makeCard('drawn-1', 'number', { color: 'purple', value: 2, symbol: '2' });

  state.currentPlayerId = 'player-1';
  state.config.allowVoluntaryDraw = false;
  state.drawPile = [drawnCard];
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [makeCard('dead-card', 'number', { color: 'lime', value: 7, symbol: '7' })],
    'player-2': [],
    'player-3': []
  });

  const result = applyCommand(state, drawCommand(state, 'draw-allowed'));
  assert.equal(result.ok, true);
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.players[0].hand.length, 2);
  assert.equal(result.state.currentPlayerId, 'player-2');
  assert.equal(result.state.drawPile.length, 0);
  assert.equal(result.state.processedCommands['draw-allowed']?.revision, 1);
  assert.deepEqual(result.events.map(event => event.type), ['CARD_DRAWN', 'TURN_ADVANCED']);
});

test('draw effects force the next player to draw the configured penalty amount', () => {
  const state = baseState(3);
  const drawCard = makeCard('draw-card', 'draw', { color: 'cyan', symbol: 'draw' });
  const penaltyCards = [
    makeCard('penalty-1', 'number', { color: 'lime', value: 4, symbol: '4' }),
    makeCard('penalty-2', 'number', { color: 'purple', value: 6, symbol: '6' })
  ];

  state.currentPlayerId = 'player-1';
  state.config.drawPenalty = 2;
  state.drawPile = [...penaltyCards];
  setTopDiscard(state, makeCard('starter', 'number', { color: 'cyan', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [drawCard, makeCard('filler', 'number', { color: 'orange', value: 5, symbol: '5' })],
    'player-2': [],
    'player-3': []
  });

  const result = applyCommand(state, playCommand(state, 'draw-effect', 'draw-card'));
  assert.equal(result.ok, true);
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.players[1].hand.length, 2);
  assert.equal(result.state.currentPlayerId, 'player-2');
  assert.equal(result.state.discardPile.at(-1)?.id, 'draw-card');
  assert.deepEqual(result.events.map(event => event.type), ['CARD_PLAYED', 'DRAW_EFFECT_APPLIED', 'TURN_ADVANCED']);
});

test('skip and reverse resolve turn order correctly, including the two-player reverse rule', () => {
  const skipState = baseState(3);
  const skipCard = makeCard('skip-card', 'skip', { color: 'lime', symbol: 'skip' });
  skipState.currentPlayerId = 'player-1';
  setTopDiscard(skipState, makeCard('starter', 'number', { color: 'lime', value: 2, symbol: '2' }));
  setHands(skipState, {
    'player-1': [skipCard, makeCard('skip-filler', 'number', { color: 'orange', value: 8, symbol: '8' })],
    'player-2': [],
    'player-3': []
  });

  const skipResult = applyCommand(skipState, playCommand(skipState, 'skip-turn', 'skip-card'));
  assert.equal(skipResult.ok, true);
  assert.equal(skipResult.state.currentPlayerId, 'player-3');
  assert.deepEqual(skipResult.events.map(event => event.type), ['CARD_PLAYED', 'PLAYER_SKIPPED', 'TURN_ADVANCED']);

  const reverseState = baseState(2);
  const reverseCard = makeCard('reverse-card', 'reverse', { color: 'orange', symbol: 'reverse' });
  reverseState.currentPlayerId = 'player-1';
  setTopDiscard(reverseState, makeCard('starter', 'number', { color: 'orange', value: 5, symbol: '5' }));
  setHands(reverseState, {
    'player-1': [reverseCard, makeCard('reverse-filler', 'number', { color: 'lime', value: 7, symbol: '7' })],
    'player-2': []
  });

  const reverseResult = applyCommand(reverseState, playCommand(reverseState, 'reverse-turn', 'reverse-card'));
  assert.equal(reverseResult.ok, true);
  assert.equal(reverseResult.state.direction, -1);
  assert.equal(reverseResult.state.currentPlayerId, 'player-1');
  assert.deepEqual(reverseResult.events.map(event => event.type), ['CARD_PLAYED', 'DIRECTION_CHANGED', 'TURN_ADVANCED']);
});

test('wild cards defer turn advancement until a color is selected, and the final selection can win the game', () => {
  const state = baseState(2);
  const wildCard = makeCard('wild-card', 'wild', { symbol: 'wild' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'purple', value: 8, symbol: '8' }));
  setHands(state, {
    'player-1': [wildCard],
    'player-2': []
  });

  const playResult = applyCommand(state, playCommand(state, 'play-wild', 'wild-card'));
  assert.equal(playResult.ok, true);
  assert.equal(playResult.state.phase, 'PENDING_WILD_COLOR');
  assert.equal(playResult.state.currentPlayerId, 'player-1');
  assert.equal(playResult.state.pendingEffect?.type, 'WILD_COLOR');
  assert.deepEqual(playResult.events.map(event => event.type), ['CARD_PLAYED', 'WILD_COLOR_REQUIRED']);

  const selectResult = applyCommand(playResult.state, selectColorCommand(playResult.state, 'choose-wild-color', 'cyan'));
  assert.equal(selectResult.ok, true);
  assert.equal(selectResult.state.status, 'FINISHED');
  assert.equal(selectResult.state.phase, 'FINISHED');
  assert.equal(selectResult.state.winnerId, 'player-1');
  assert.equal(selectResult.state.pendingEffect, null);
  assert.deepEqual(selectResult.events.map(event => event.type), ['WILD_COLOR_SELECTED', 'GAME_WON']);
});

test('successful commands are idempotent when replayed with the same command id', () => {
  const state = baseState(2);
  state.currentPlayerId = 'player-1';
  state.config.allowVoluntaryDraw = true;
  state.drawPile = [makeCard('drawn-once', 'number', { color: 'lime', value: 4, symbol: '4' })];
  setTopDiscard(state, makeCard('starter', 'number', { color: 'cyan', value: 9, symbol: '9' }));
  setHands(state, {
    'player-1': [makeCard('dead-card', 'number', { color: 'orange', value: 2, symbol: '2' })],
    'player-2': []
  });

  const first = applyCommand(state, drawCommand(state, 'draw-once'));
  assert.equal(first.ok, true);
  assert.equal(first.state.players[0].hand.length, 2);
  assert.equal(first.state.currentPlayerId, 'player-2');

  const replay = applyCommand(first.state, drawCommand(first.state, 'draw-once', 0));
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.state.players[0].hand.length, 2);
  assert.equal(replay.state.currentPlayerId, 'player-2');
  assert.deepEqual(replay.events.map(event => event.type), first.events.map(event => event.type));
});

test('stale revisions are rejected after the authoritative state advances', () => {
  const state = baseState(2);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [makeCard('playable', 'number', { color: 'lime', value: 3, symbol: '3' })],
    'player-2': []
  });

  const result = applyCommand(state, playCommand(state, 'advance-once', 'playable'));
  assert.equal(result.ok, true);

  const stale = applyCommand(result.state, drawCommand(result.state, 'stale-revision', 0));
  assert.equal(stale.ok, false);
  assert.equal(stale.error?.code, 'STALE_REVISION');
});

test('discard recycling preserves the top card and feeds drawCards when the draw pile is empty', () => {
  const state = baseState(2);
  state.drawPile = [];
  state.discardPile = [
    makeCard('discard-1', 'number', { color: 'lime', value: 1, symbol: '1' }),
    makeCard('discard-2', 'number', { color: 'orange', value: 2, symbol: '2' }),
    makeCard('discard-top', 'number', { color: 'cyan', value: 3, symbol: '3' })
  ];

  const events: GameEvent[] = [];
  const recycled = recycleDiscardPile(state, events);
  assert.equal(recycled, true);
  assert.equal(state.discardPile.length, 1);
  assert.equal(state.discardPile[0].id, 'discard-top');
  assert.equal(state.drawPile.length, 2);
  assert.equal(events[0]?.type, 'DECK_RECYCLED');

  const drawn = drawCards(state, 1, events);
  assert.equal(drawn.length, 1);
  assert.equal(state.discardPile[0].id, 'discard-top');
  assert.equal(state.drawPile.length, 1);
});

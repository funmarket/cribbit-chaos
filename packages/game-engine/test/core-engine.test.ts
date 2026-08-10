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

function playCommand(
  state: GameState,
  commandId: string,
  cardId: string,
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'PLAY_CARD',
    cardId
  };
}

function drawCommand(
  state: GameState,
  commandId: string,
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'DRAW_CARD'
  };
}

function selectColorCommand(
  state: GameState,
  commandId: string,
  color: 'lime' | 'orange' | 'cyan' | 'purple',
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
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

test('createGame supports 10 players, rejects 1 and 11, and rejects duplicate ids', () => {
  const tenPlayers = Array.from({ length: 10 }, (_, index) => ({ id: `player-${index + 1}` }));
  const tenResult = createGame({ seed: 'ten-player-seed' }, tenPlayers);
  assert.equal(tenResult.ok, true);
  assert.equal(tenResult.state.players.length, 10);

  const oneResult = createGame({ seed: 'one-player-seed' }, [{ id: 'solo' }]);
  assert.equal(oneResult.ok, false);
  assert.equal(oneResult.error?.code, 'INVALID_PLAYER_COUNT');

  const elevenPlayers = Array.from({ length: 11 }, (_, index) => ({ id: `player-${index + 1}` }));
  const elevenResult = createGame({ seed: 'eleven-player-seed' }, elevenPlayers);
  assert.equal(elevenResult.ok, false);
  assert.equal(elevenResult.error?.code, 'INVALID_PLAYER_COUNT');

  const duplicateResult = createGame({ seed: 'duplicate-seed' }, [{ id: 'alice' }, { id: 'alice' }]);
  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicateResult.error?.code, 'DUPLICATE_PLAYER_ID');
});

test('createGame is deterministic for the same seed and respects configurable starting hand counts', () => {
  const players = [{ id: 'alice' }, { id: 'bob' }, { id: 'carol' }];
  const first = createGame({ seed: 'deterministic-seed', startingHandCount: 5 }, players);
  const second = createGame({ seed: 'deterministic-seed', startingHandCount: 5 }, players);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.state.players.map(player => player.hand.map(card => card.id)), second.state.players.map(player => player.hand.map(card => card.id)));
  assert.equal(first.state.players[0].hand.length, 5);
  assert.equal(second.state.players[1].hand.length, 5);

  const totalCards =
    first.state.drawPile.length +
    first.state.discardPile.length +
    first.state.players.reduce((sum, player) => sum + player.hand.length, 0);
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

test('matching number or symbol is legal across colors', () => {
  const state = baseState(2);
  const matchingCard = makeCard('match-3', 'number', { color: 'purple', value: 3, symbol: '3' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 3, symbol: '3' }));
  setHands(state, {
    'player-1': [matchingCard, makeCard('spare', 'number', { color: 'cyan', value: 8, symbol: '8' })],
    'player-2': []
  });

  const result = applyCommand(state, playCommand(state, 'match-number', 'match-3'));
  assert.equal(result.ok, true);
  assert.equal(result.state.currentPlayerId, 'player-2');
  assert.equal(result.state.discardPile.at(-1)?.id, 'match-3');
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

test('wrong actor cannot submit PLAY_CARD even when holding a playable card id', () => {
  const state = baseState(2);
  const currentCard = makeCard('current-card', 'number', { color: 'lime', value: 3, symbol: '3' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [currentCard],
    'player-2': [makeCard('other', 'number', { color: 'orange', value: 4, symbol: '4' })]
  });

  const result = applyCommand(state, playCommand(state, 'wrong-actor-play', 'current-card', 'player-2'));
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'NOT_YOUR_TURN');
  assert.equal(state.players[0].hand.length, 1);
});

test('wrong actor cannot submit DRAW_CARD', () => {
  const state = baseState(2);

  state.currentPlayerId = 'player-1';
  state.config.allowVoluntaryDraw = true;
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [makeCard('current', 'number', { color: 'purple', value: 9, symbol: '9' })],
    'player-2': [makeCard('other', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const result = applyCommand(state, drawCommand(state, 'wrong-actor-draw', 'player-2'));
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'NOT_YOUR_TURN');
});

test('wrong actor cannot select a pending Wild color', () => {
  const state = baseState(2);
  const wildCard = makeCard('wild-card', 'wild', { symbol: 'wild' });

  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'purple', value: 8, symbol: '8' }));
  setHands(state, {
    'player-1': [wildCard, makeCard('filler', 'number', { color: 'orange', value: 2, symbol: '2' })],
    'player-2': [makeCard('spectator', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const playResult = applyCommand(state, playCommand(state, 'play-wild', 'wild-card'));
  assert.equal(playResult.ok, true);
  assert.equal(playResult.state.phase, 'PENDING_WILD_COLOR');

  const wrongActor = applyCommand(playResult.state, selectColorCommand(playResult.state, 'wrong-actor-color', 'cyan', 'player-2'));
  assert.equal(wrongActor.ok, false);
  assert.equal(wrongActor.error?.code, 'NOT_YOUR_TURN');
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

  const postWinAttempt = applyCommand(selectResult.state, drawCommand(selectResult.state, 'after-win-draw', 'player-1'));
  assert.equal(postWinAttempt.ok, false);
  assert.equal(postWinAttempt.error?.code, 'GAME_ALREADY_FINISHED');
});

test('duplicate DRAW_CARD replays do not mutate state or emit old events', () => {
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

  const replay = applyCommand(first.state, drawCommand(first.state, 'draw-once', 'player-1', 0));
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.events.length, 0);
  assert.equal(replay.state.players[0].hand.length, 2);
  assert.equal(replay.state.currentPlayerId, 'player-2');
});

test('duplicate PLAY_CARD and SELECT_WILD_COLOR replays do not mutate state', () => {
  const playState = baseState(2);
  playState.currentPlayerId = 'player-1';
  setTopDiscard(playState, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(playState, {
    'player-1': [makeCard('playable', 'number', { color: 'lime', value: 3, symbol: '3' }), makeCard('spare', 'number', { color: 'orange', value: 7, symbol: '7' })],
    'player-2': []
  });

  const firstPlay = applyCommand(playState, playCommand(playState, 'play-once', 'playable'));
  assert.equal(firstPlay.ok, true);
  assert.equal(firstPlay.state.players[0].hand.length, 1);

  const replayPlay = applyCommand(firstPlay.state, playCommand(firstPlay.state, 'play-once', 'playable', 'player-1', 0));
  assert.equal(replayPlay.ok, true);
  assert.equal(replayPlay.idempotentReplay, true);
  assert.equal(replayPlay.events.length, 0);
  assert.equal(replayPlay.state.players[0].hand.length, 1);

  const wildState = baseState(2);
  wildState.currentPlayerId = 'player-1';
  setTopDiscard(wildState, makeCard('starter', 'number', { color: 'purple', value: 8, symbol: '8' }));
  setHands(wildState, {
    'player-1': [makeCard('wild-card', 'wild', { symbol: 'wild' }), makeCard('filler', 'number', { color: 'cyan', value: 2, symbol: '2' })],
    'player-2': []
  });

  const firstWild = applyCommand(wildState, playCommand(wildState, 'wild-once', 'wild-card'));
  assert.equal(firstWild.ok, true);
  const firstSelection = applyCommand(firstWild.state, selectColorCommand(firstWild.state, 'wild-color-once', 'cyan'));
  assert.equal(firstSelection.ok, true);

  const replaySelection = applyCommand(firstSelection.state, selectColorCommand(firstSelection.state, 'wild-color-once', 'cyan', 'player-1', 0));
  assert.equal(replaySelection.ok, true);
  assert.equal(replaySelection.idempotentReplay, true);
  assert.equal(replaySelection.events.length, 0);
  assert.equal(replaySelection.state.status, 'ACTIVE');
  assert.equal(replaySelection.state.currentPlayerId, 'player-2');
});

test('commandId collisions with different type, payload, or actor are rejected', () => {
  const state = baseState(2);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 9, symbol: '9' }));
  setHands(state, {
    'player-1': [
      makeCard('playable', 'number', { color: 'orange', value: 3, symbol: '3' }),
      makeCard('spare', 'number', { color: 'orange', value: 7, symbol: '7' })
    ],
    'player-2': [makeCard('other', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const first = applyCommand(state, playCommand(state, 'collision-id', 'playable'));
  assert.equal(first.ok, true);

  const diffType = applyCommand(first.state, drawCommand(first.state, 'collision-id', 'player-1'));
  assert.equal(diffType.ok, false);
  assert.equal(diffType.error?.code, 'COMMAND_ID_COLLISION');

  const diffPayload = applyCommand(first.state, playCommand(first.state, 'collision-id', 'spare', 'player-1', first.state.revision));
  assert.equal(diffPayload.ok, false);
  assert.equal(diffPayload.error?.code, 'COMMAND_ID_COLLISION');

  const diffActor = applyCommand(first.state, playCommand(first.state, 'collision-id', 'playable', 'player-2'));
  assert.equal(diffActor.ok, false);
  assert.equal(diffActor.error?.code, 'COMMAND_ID_COLLISION');
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

  const stale = applyCommand(result.state, drawCommand(result.state, 'stale-revision', 'player-2', 0));
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

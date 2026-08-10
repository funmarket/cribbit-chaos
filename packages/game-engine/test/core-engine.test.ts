import assert from 'node:assert/strict';
import test from 'node:test';

import type { Card, GameCommand, GameEvent, GameState, GameTransition, SocialPrompt } from '@cribbit/contracts';
import type { GameCommandContext } from '../src/index.ts';
import {
  applyCommand,
  buildCoreDeck,
  createGame,
  drawCards,
  projectAuthorship,
  projectRoulettePresentation,
  recycleDiscardPile,
  validatePlay
} from '../src/index.ts';
import { createSeededRandom } from '../src/rng.ts';

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

function baseState(playerCount = 3, now?: number): GameState {
  const players = Array.from({ length: playerCount }, (_, index) => ({ id: `player-${index + 1}`, seat: index }));
  const transition = createGame({ seed: 'core-engine-test-seed' }, players, undefined, { now });
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

function socialPrompt(
  id: string,
  kind: SocialPrompt['kind'],
  targeting: SocialPrompt['targeting'],
  overrides: Partial<SocialPrompt> = {}
): SocialPrompt {
  return {
    id,
    kind,
    text: overrides.text ?? `${kind} prompt ${id}`,
    world: overrides.world ?? 'UNDER_18_CLEAN',
    stage: overrides.stage ?? 0,
    groupSizeMin: overrides.groupSizeMin ?? 3,
    groupSizeMax: overrides.groupSizeMax ?? 3,
    intensity: overrides.intensity ?? 0,
    language: overrides.language ?? 'en',
    callSuitability: overrides.callSuitability ?? 'any',
    targeting,
    repeatGroup: overrides.repeatGroup,
    antiRepeatKey: overrides.antiRepeatKey,
    options: overrides.options,
    authorshipMode: overrides.authorshipMode ?? 'SIGNED',
    destination: overrides.destination ?? 'room'
  };
}

function socialContext(
  promptPool: readonly SocialPrompt[],
  promptProfile: GameCommandContext['promptProfile'] = {},
  selectedPrompt?: SocialPrompt,
  now?: number
): GameCommandContext {
  const context: GameCommandContext = { promptPool, promptProfile };
  if (selectedPrompt) context.selectedPrompt = selectedPrompt;
  if (typeof now === 'number') context.now = now;
  return context;
}

function answerModeCommand(
  state: GameState,
  commandId: string,
  mode: 'SPEAK' | 'TYPE' | 'CHOOSE' | 'ANSWERED_LIVE',
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'SELECT_ANSWER_MODE',
    mode
  };
}

function reviewAnswerCommand(
  state: GameState,
  commandId: string,
  payload: { value?: string; choice?: string; completionOnly?: boolean },
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'REVIEW_ANSWER',
    ...payload
  };
}

function submitChoiceCommand(
  state: GameState,
  commandId: string,
  choice: string,
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'SUBMIT_CHOICE',
    choice
  };
}

function markAnsweredLiveCommand(
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
    type: 'MARK_ANSWERED_LIVE'
  };
}

function submitAnswerCommand(
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
    type: 'SUBMIT_ANSWER'
  };
}

function selectParanoiaTargetCommand(
  state: GameState,
  commandId: string,
  targetId: string,
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'SELECT_PARANOIA_TARGET',
    targetId
  };
}

function selectDuelTargetCommand(
  state: GameState,
  commandId: string,
  targetId: string,
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'SELECT_DUEL_TARGET',
    targetId
  };
}

function submitDuelResponseCommand(
  state: GameState,
  commandId: string,
  side: 'initiator' | 'opponent',
  payload: { value?: string; choice?: string; completionOnly?: boolean } = {},
  playerId = state.currentPlayerId,
  expectedRevision = state.revision
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'SUBMIT_DUEL_RESPONSE',
    side,
    ...payload
  };
}

function playNopeCommand(
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
    type: 'PLAY_NOPE',
    cardId
  };
}

function passCommand(
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
    type: 'PASS_PROMPT'
  };
}

function rewindCommand(
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
    type: 'REWIND_PROMPT'
  };
}

function timeoutTurnCommand(
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
    type: 'TIMEOUT_TURN'
  };
}

function timeoutSocialCommand(
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
    type: 'TIMEOUT_SOCIAL'
  };
}

function flagCommand(
  state: GameState,
  commandId: string,
  promptId: string,
  playerId = state.currentPlayerId,
  expectedRevision = state.revision,
  reasonCode?: string
): GameCommand {
  return {
    commandId,
    playerId,
    expectedRevision,
    sessionId: state.id,
    type: 'FLAG_PROMPT',
    promptId,
    reasonCode
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

test('initial discard selection remains a provisional setup strategy', () => {
  const seed = 'discard-strategy-seed';
  const players = [{ id: 'alice' }, { id: 'bob' }];
  const shuffledDeck = buildCoreDeck(seed, createSeededRandom(seed));
  const deckAfterDeal = [...shuffledDeck];
  deckAfterDeal.splice(0, 7 * players.length);

  const firstNumberResult = createGame({ seed, initialDiscardStrategy: 'FIRST_NUMBER_CARD' }, players);
  assert.equal(firstNumberResult.ok, true);
  const firstNumberStarter = deckAfterDeal.find(card => card.kind === 'number') ?? deckAfterDeal.at(-1);
  assert.equal(firstNumberResult.state.discardPile[0].id, firstNumberStarter?.id);

  const topShuffledResult = createGame({ seed, initialDiscardStrategy: 'TOP_SHUFFLED_CARD' }, players);
  assert.equal(topShuffledResult.ok, true);
  assert.equal(topShuffledResult.state.discardPile[0].id, deckAfterDeal.at(-1)?.id);
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

test('normal DRAW_CARD advances exactly one player regardless of drawPenaltySkipsTurn', () => {
  const keepTurnState = baseState(3);
  keepTurnState.currentPlayerId = 'player-1';
  keepTurnState.config.allowVoluntaryDraw = true;
  keepTurnState.config.drawPenaltySkipsTurn = false;
  keepTurnState.drawPile = [makeCard('keep-turn-drawn', 'number', { color: 'purple', value: 2, symbol: '2' })];
  setTopDiscard(keepTurnState, makeCard('starter', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(keepTurnState, {
    'player-1': [makeCard('dead-card-a', 'number', { color: 'lime', value: 7, symbol: '7' })],
    'player-2': [],
    'player-3': []
  });

  const keepTurnResult = applyCommand(keepTurnState, drawCommand(keepTurnState, 'normal-draw-keep'));
  assert.equal(keepTurnResult.ok, true);
  assert.equal(keepTurnResult.state.currentPlayerId, 'player-2');
  assert.deepEqual(keepTurnResult.events.map(event => event.type), ['CARD_DRAWN', 'TURN_ADVANCED']);

  const skipTurnState = baseState(3);
  skipTurnState.currentPlayerId = 'player-1';
  skipTurnState.config.allowVoluntaryDraw = true;
  skipTurnState.config.drawPenaltySkipsTurn = true;
  skipTurnState.drawPile = [makeCard('skip-turn-drawn', 'number', { color: 'purple', value: 2, symbol: '2' })];
  setTopDiscard(skipTurnState, makeCard('starter', 'number', { color: 'orange', value: 1, symbol: '1' }));
  setHands(skipTurnState, {
    'player-1': [makeCard('dead-card-b', 'number', { color: 'lime', value: 7, symbol: '7' })],
    'player-2': [],
    'player-3': []
  });

  const skipTurnResult = applyCommand(skipTurnState, drawCommand(skipTurnState, 'normal-draw-skip'));
  assert.equal(skipTurnResult.ok, true);
  assert.equal(skipTurnResult.state.currentPlayerId, 'player-2');
  assert.deepEqual(skipTurnResult.events.map(event => event.type), ['CARD_DRAWN', 'TURN_ADVANCED']);
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

test('draw turn behavior follows the configured drawPenaltySkipsTurn rule', () => {
  const keepTurnState = baseState(3);
  const keepTurnCard = makeCard('draw-card-keep', 'draw', { color: 'cyan', symbol: 'draw' });
  keepTurnState.currentPlayerId = 'player-1';
  keepTurnState.config.drawPenalty = 2;
  keepTurnState.config.drawPenaltySkipsTurn = false;
  keepTurnState.drawPile = [
    makeCard('keep-1', 'number', { color: 'lime', value: 4, symbol: '4' }),
    makeCard('keep-2', 'number', { color: 'purple', value: 6, symbol: '6' })
  ];
  setTopDiscard(keepTurnState, makeCard('starter', 'number', { color: 'cyan', value: 1, symbol: '1' }));
  setHands(keepTurnState, {
    'player-1': [keepTurnCard, makeCard('keep-filler', 'number', { color: 'orange', value: 5, symbol: '5' })],
    'player-2': [],
    'player-3': []
  });

  const keepTurnResult = applyCommand(keepTurnState, playCommand(keepTurnState, 'draw-keep-turn', 'draw-card-keep'));
  assert.equal(keepTurnResult.ok, true);
  assert.equal(keepTurnResult.state.currentPlayerId, 'player-2');
  assert.deepEqual(keepTurnResult.events.map(event => event.type), ['CARD_PLAYED', 'DRAW_EFFECT_APPLIED', 'TURN_ADVANCED']);

  const skipTurnState = baseState(3);
  const skipTurnCard = makeCard('draw-card-skip', 'draw', { color: 'cyan', symbol: 'draw' });
  skipTurnState.currentPlayerId = 'player-1';
  skipTurnState.config.drawPenalty = 2;
  skipTurnState.config.drawPenaltySkipsTurn = true;
  skipTurnState.drawPile = [
    makeCard('skip-1', 'number', { color: 'lime', value: 4, symbol: '4' }),
    makeCard('skip-2', 'number', { color: 'purple', value: 6, symbol: '6' })
  ];
  setTopDiscard(skipTurnState, makeCard('starter', 'number', { color: 'cyan', value: 1, symbol: '1' }));
  setHands(skipTurnState, {
    'player-1': [skipTurnCard, makeCard('skip-filler', 'number', { color: 'orange', value: 5, symbol: '5' })],
    'player-2': [],
    'player-3': []
  });

  const skipTurnResult = applyCommand(skipTurnState, playCommand(skipTurnState, 'draw-skip-turn', 'draw-card-skip'));
  assert.equal(skipTurnResult.ok, true);
  assert.equal(skipTurnResult.state.currentPlayerId, 'player-3');
  assert.deepEqual(skipTurnResult.events.map(event => event.type), ['CARD_PLAYED', 'DRAW_EFFECT_APPLIED', 'TURN_ADVANCED']);
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

test('Truth plays select the first eligible prompt, stay pending, and block normal draws until resolved', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'lime' }), makeCard('filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
    'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'purple', value: 9, symbol: '9' })]
  });

  const promptPool = [
    socialPrompt('truth-b', 'truth', 'current', { text: 'truth b' }),
    socialPrompt('truth-a', 'truth', 'current', { text: 'truth a' }),
    socialPrompt('truth-wrong-world', 'truth', 'current', { world: '18+_ADULT', text: 'adult truth' }),
    socialPrompt('dare-1', 'dare', 'current', { text: 'dare prompt' })
  ];

  const result = applyCommand(state, playCommand(state, 'truth-play', 'truth-card'), socialContext(promptPool));
  assert.equal(result.ok, true);
  assert.equal(result.state.social?.cardKind, 'truth');
  assert.equal(result.state.social?.prompt?.id, 'truth-a');
  assert.equal(result.state.currentPlayerId, 'player-1');
  assert.equal(result.state.phase, 'ANSWER_RESOLVE');
  assert.deepEqual(result.events.map(event => event.type), ['CARD_PLAYED', 'SOCIAL_CARD_TRIGGERED', 'PROMPT_SELECTED', 'ROULETTE_PRESENTATION_STARTED', 'ANSWER_REQUIRED']);
  assert.equal(result.events[2]?.visibility, 'PLAYER_PRIVATE');
  assert.deepEqual(result.events[2]?.recipientPlayerIds, ['player-1']);
  assert.equal(result.state.social?.roulettePresentation?.selectedResultId, 'truth-a');

  const blockedDraw = applyCommand(result.state, drawCommand(result.state, 'truth-draw-blocked'));
  assert.equal(blockedDraw.ok, false);
  assert.equal(blockedDraw.error?.code, 'PENDING_SOCIAL_EFFECT');
});

test('Dare accepts an explicitly supplied eligible prompt and preserves its private selection boundary', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('dare-card', 'dare', { symbol: 'dare', color: 'orange' }), makeCard('filler', 'number', { color: 'cyan', value: 7, symbol: '7' })],
    'player-2': [makeCard('other-2', 'number', { color: 'lime', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'purple', value: 9, symbol: '9' })]
  });

  const selectedPrompt = socialPrompt('dare-selected', 'dare', 'current', { text: 'dare selected', options: ['one', 'two'] });
  const result = applyCommand(state, playCommand(state, 'dare-play', 'dare-card'), socialContext([], {}, selectedPrompt));
  assert.equal(result.ok, true);
  assert.equal(result.state.social?.prompt?.id, 'dare-selected');
  assert.equal(result.state.social?.promptSelection?.promptId, 'dare-selected');
  assert.equal(result.state.social?.promptSelection?.selectedByPlayerId, 'player-1');
  assert.equal(result.events[2]?.visibility, 'PLAYER_PRIVATE');
  assert.equal(result.events[3]?.type, 'ROULETTE_PRESENTATION_STARTED');
});

test('roulette presentation metadata is authoritative, deterministic, and selected before presentation', () => {
  const makeTruthState = (): GameState => {
    const state = baseState(3);
    state.currentPlayerId = 'player-1';
    setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
    setHands(state, {
      'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'lime' })],
      'player-2': [],
      'player-3': []
    });
    return state;
  };
  const promptPool = [
    socialPrompt('truth-b', 'truth', 'current', { text: 'second' }),
    socialPrompt('truth-a', 'truth', 'current', { text: 'first' })
  ];
  const first = applyCommand(makeTruthState(), playCommand(makeTruthState(), 'unused', 'truth-card'), socialContext(promptPool));
  const secondState = makeTruthState();
  const second = applyCommand(secondState, playCommand(secondState, 'roulette-repeat', 'truth-card'), socialContext(promptPool));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const presentation = second.state.social?.roulettePresentation;
  assert.ok(presentation);
  assert.equal(presentation.selectedResultId, 'truth-a');
  assert.deepEqual(presentation.candidateResultIds, ['truth-a', 'truth-b']);
  assert.equal(presentation.revealState, 'REVEALED');
  assert.equal(typeof presentation.presentationSeed, 'string');
  assert.deepEqual(presentation, first.state.social?.roulettePresentation);
  const selectedResultBeforeProjection = presentation.selectedResultId;
  projectRoulettePresentation(presentation);
  assert.equal(presentation.selectedResultId, selectedResultBeforeProjection);
  assert.equal(second.events.find(event => event.type === 'ROULETTE_PRESENTATION_STARTED')?.visibility, 'PLAYER_PRIVATE');
  assert.equal(second.events.filter(event => event.visibility === 'PUBLIC').some(event => JSON.stringify(event.payload).includes('truth-a')), false);
});

test('sealed roulette and authorship projections do not expose hidden values', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'lime' })],
    'player-2': [],
    'player-3': []
  });
  const prompt = socialPrompt('hidden-prompt', 'truth', 'current', { authorshipMode: 'REVEAL_AFTER' });
  const context = socialContext([], {}, prompt);
  context.authorshipByPromptId = { 'hidden-prompt': 'author-player' };
  const result = applyCommand(state, playCommand(state, 'hidden-authorship', 'truth-card'), context);

  assert.equal(result.ok, true);
  assert.equal(result.state.social?.authorship?.authorPlayerId, 'author-player');
  assert.equal(result.state.social?.authorship?.revealState, 'SEALED');
  assert.deepEqual(projectAuthorship(result.state.social!.authorship!), { mode: 'REVEAL_AFTER', revealState: 'SEALED' });

  const sealed = projectRoulettePresentation({
    ...result.state.social!.roulettePresentation!,
    selectedResultId: 'hidden-prompt',
    revealState: 'SEALED'
  });
  assert.equal('selectedResultId' in sealed, false);
  assert.equal('candidateResultIds' in sealed, false);
  assert.equal(Object.prototype.hasOwnProperty.call(sealed, 'selectedResultId'), false);
  assert.equal(JSON.stringify(sealed).includes('hidden-prompt'), false);

  const multipleCandidates = projectRoulettePresentation({
    ...result.state.social!.roulettePresentation!,
    selectedResultId: 'candidate-b',
    candidateResultIds: ['candidate-a', 'candidate-b'],
    revealState: 'SEALED'
  });
  assert.equal('selectedResultId' in multipleCandidates, false);
  assert.equal('candidateResultIds' in multipleCandidates, false);
  assert.equal(JSON.stringify(multipleCandidates).includes('candidate-b'), false);

  const revealed = projectRoulettePresentation({
    ...result.state.social!.roulettePresentation!,
    selectedResultId: 'revealed-prompt',
    candidateResultIds: ['revealed-prompt', 'other-prompt'],
    revealState: 'REVEALED'
  });
  assert.equal(revealed.selectedResultId, 'revealed-prompt');
  assert.deepEqual(revealed.candidateResultIds, ['revealed-prompt', 'other-prompt']);
  assert.equal(result.events.filter(event => event.visibility === 'PUBLIC').some(event => JSON.stringify(event.payload).includes('author-player')), false);
  assert.equal(result.events.filter(event => event.visibility === 'PUBLIC').some(event => JSON.stringify(event.payload).includes('hidden-prompt')), false);
});

test('explicit selected prompts use the full eligible pool for authoritative roulette candidates', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'lime' })],
    'player-2': [],
    'player-3': []
  });
  const selectedPrompt = socialPrompt('prompt-z', 'truth', 'current', { text: 'selected' });
  const promptPool = [selectedPrompt, socialPrompt('prompt-a', 'truth', 'current', { text: 'eligible alternative' })];
  const result = applyCommand(state, playCommand(state, 'selected-with-pool', 'truth-card'), socialContext(promptPool, {}, selectedPrompt));

  assert.equal(result.ok, true);
  assert.equal(result.state.social?.prompt?.id, 'prompt-z');
  assert.deepEqual(result.state.social?.roulettePresentation?.candidateResultIds, ['prompt-a', 'prompt-z']);
  assert.equal(result.state.social?.roulettePresentation?.selectedResultId, 'prompt-z');
});

test('authorship modes retain server identity while enforcing signed, reveal-after, and taboo visibility', () => {
  const modes: Array<['SIGNED' | 'REVEAL_AFTER' | 'TABOO', boolean]> = [
    ['SIGNED', true],
    ['REVEAL_AFTER', false],
    ['TABOO', false]
  ];
  for (const [mode, shouldReveal] of modes) {
    const state = baseState(3);
    state.currentPlayerId = 'player-1';
    setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
    setHands(state, {
      'player-1': [makeCard(`truth-${mode}`, 'truth', { symbol: 'truth', color: 'lime' })],
      'player-2': [],
      'player-3': []
    });
    const prompt = socialPrompt(`prompt-${mode}`, 'truth', 'current', { authorshipMode: mode });
    const context = socialContext([], {}, prompt);
    context.authorshipByPromptId = { [`prompt-${mode}`]: 'author-player' };
    const result = applyCommand(state, playCommand(state, `authorship-${mode}`, `truth-${mode}`), context);
    assert.equal(result.ok, true);
    assert.equal(result.state.social?.authorship?.authorPlayerId, 'author-player');
    assert.equal('authorPlayerId' in projectAuthorship(result.state.social!.authorship!), shouldReveal);
  }
});

test('Prompt eligibility accepts group-size ranges and rejects out-of-range prompts', () => {
  const makeTruthState = (): GameState => {
    const state = baseState(3);
    state.currentPlayerId = 'player-1';
    setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
    setHands(state, {
      'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'lime' })],
      'player-2': [],
      'player-3': []
    });
    return state;
  };

  let truthState = makeTruthState();
  const wrongKind = applyCommand(truthState, playCommand(truthState, 'truth-wrong-kind', 'truth-card'), socialContext([
    socialPrompt('dare-only', 'dare', 'current', { text: 'dare only', groupSizeMin: 1, groupSizeMax: 5 })
  ]));
  assert.equal(wrongKind.ok, false);
  assert.equal(wrongKind.error?.code, 'NO_ELIGIBLE_PROMPT');

  truthState = makeTruthState();
  const wrongWorld = applyCommand(truthState, playCommand(truthState, 'truth-wrong-world', 'truth-card'), socialContext([
    socialPrompt('truth-adult', 'truth', 'current', { world: '18+_ADULT', text: 'adult truth', groupSizeMin: 1, groupSizeMax: 5 })
  ]));
  assert.equal(wrongWorld.ok, false);
  assert.equal(wrongWorld.error?.code, 'NO_ELIGIBLE_PROMPT');

  truthState = makeTruthState();
  const atMinimum = applyCommand(truthState, playCommand(truthState, 'truth-at-min', 'truth-card'), socialContext([
    socialPrompt('truth-at-min', 'truth', 'current', { text: 'at min', groupSizeMin: 3, groupSizeMax: 5 })
  ]));
  assert.equal(atMinimum.ok, true);

  truthState = makeTruthState();
  const atMaximum = applyCommand(truthState, playCommand(truthState, 'truth-at-max', 'truth-card'), socialContext([
    socialPrompt('truth-at-max', 'truth', 'current', { text: 'at max', groupSizeMin: 1, groupSizeMax: 3 })
  ]));
  assert.equal(atMaximum.ok, true);

  truthState = makeTruthState();
  const insideRange = applyCommand(truthState, playCommand(truthState, 'truth-inside-range', 'truth-card'), socialContext([
    socialPrompt('truth-inside-range', 'truth', 'current', { text: 'inside range', groupSizeMin: 2, groupSizeMax: 4 })
  ]));
  assert.equal(insideRange.ok, true);

  truthState = makeTruthState();
  const belowMinimum = applyCommand(truthState, playCommand(truthState, 'truth-below-min', 'truth-card'), socialContext([
    socialPrompt('truth-below-min', 'truth', 'current', { text: 'below min', groupSizeMin: 4, groupSizeMax: 5 })
  ]));
  assert.equal(belowMinimum.ok, false);
  assert.equal(belowMinimum.error?.code, 'NO_ELIGIBLE_PROMPT');

  truthState = makeTruthState();
  const aboveMaximum = applyCommand(truthState, playCommand(truthState, 'truth-above-max', 'truth-card'), socialContext([
    socialPrompt('truth-above-max', 'truth', 'current', { text: 'above max', groupSizeMin: 1, groupSizeMax: 2 })
  ]));
  assert.equal(aboveMaximum.ok, false);
  assert.equal(aboveMaximum.error?.code, 'NO_ELIGIBLE_PROMPT');

  truthState = makeTruthState();
  const noEligiblePrompt = applyCommand(truthState, playCommand(truthState, 'truth-no-eligible', 'truth-card'), socialContext([
    socialPrompt('truth-repeat', 'truth', 'current', { repeatGroup: 'repeat-group', text: 'repeat me', groupSizeMin: 1, groupSizeMax: 5 })
  ], { excludeRepeatGroups: ['repeat-group'] }));
  assert.equal(noEligiblePrompt.ok, false);
  assert.equal(noEligiblePrompt.error?.code, 'NO_ELIGIBLE_PROMPT');
});

test('Paranoia rejects invalid targets and resolves a valid private target selection', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'purple', value: 8, symbol: '8' }));
  setHands(state, {
    'player-1': [makeCard('paranoia-card', 'paranoia', { symbol: 'paranoia', color: 'purple' }), makeCard('filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
    'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const promptPool = [socialPrompt('paranoia-1', 'paranoia', 'specific', { text: 'paranoia prompt' })];
  const playResult = applyCommand(state, playCommand(state, 'paranoia-play', 'paranoia-card'), socialContext(promptPool));
  assert.equal(playResult.ok, true);
  assert.deepEqual(playResult.state.social?.pendingTargetIds, ['player-2', 'player-3']);

  const selfTarget = applyCommand(playResult.state, selectParanoiaTargetCommand(playResult.state, 'paranoia-self', 'player-1'));
  assert.equal(selfTarget.ok, false);
  assert.equal(selfTarget.error?.code, 'INVALID_SOCIAL_TARGET');

  const missingTarget = applyCommand(playResult.state, selectParanoiaTargetCommand(playResult.state, 'paranoia-missing', 'nobody'));
  assert.equal(missingTarget.ok, false);
  assert.equal(missingTarget.error?.code, 'INVALID_SOCIAL_TARGET');

  const validTarget = applyCommand(playResult.state, selectParanoiaTargetCommand(playResult.state, 'paranoia-target', 'player-2'));
  assert.equal(validTarget.ok, true);
  assert.equal(validTarget.state.social, null);
  assert.equal(validTarget.state.currentPlayerId, 'player-2');
  assert.deepEqual(validTarget.events.map(event => event.type), ['PARANOIA_TARGET_SELECTED', 'ROULETTE_PRESENTATION_STARTED', 'SOCIAL_EFFECT_RESOLVED', 'TURN_ADVANCED']);
  assert.equal(validTarget.events[0]?.visibility, 'PLAYER_PRIVATE');
  assert.deepEqual(validTarget.events[0]?.recipientPlayerIds, ['player-1']);
});

test('Duel enters target selection, opens a Nope window, and rejects bad targets', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'cyan', value: 4, symbol: '4' }));
  setHands(state, {
    'player-1': [makeCard('duel-card', 'duel', { symbol: 'duel', color: 'cyan' }), makeCard('filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
    'player-2': [makeCard('nope-holder', 'nope', { symbol: 'nope' }), makeCard('other-2', 'number', { color: 'purple', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const promptPool = [socialPrompt('duel-target', 'duel', 'specific', { text: 'duel prompt' })];
  const playResult = applyCommand(state, playCommand(state, 'duel-play', 'duel-card'));
  assert.equal(playResult.ok, true);
  assert.deepEqual(playResult.state.social?.pendingTargetIds, ['player-2', 'player-3']);

  const invalidSelf = applyCommand(playResult.state, selectDuelTargetCommand(playResult.state, 'duel-self', 'player-1'));
  assert.equal(invalidSelf.ok, false);
  assert.equal(invalidSelf.error?.code, 'INVALID_SOCIAL_TARGET');

  const duelTarget = applyCommand(playResult.state, selectDuelTargetCommand(playResult.state, 'duel-target', 'player-2', 'player-1', playResult.state.revision), socialContext(promptPool));
  assert.equal(duelTarget.ok, true);
  assert.equal(duelTarget.state.social?.pendingDuel?.opponentId, 'player-2');
  assert.equal(duelTarget.state.social?.pendingReaction?.eligible, true);
  assert.equal(duelTarget.state.social?.prompt?.id, 'duel-target');
  assert.deepEqual(duelTarget.events.map(event => event.type), ['DUEL_TARGET_SELECTED', 'ROULETTE_PRESENTATION_STARTED', 'PROMPT_SELECTED', 'NOPE_WINDOW_OPENED']);
  assert.deepEqual(duelTarget.events[0]?.recipientPlayerIds, ['player-1', 'player-2']);
});

test('PLAY_NOPE keeps the Duel reaction window alive for initiator-first responses, closes on opponent response, and respects no-Nope-card flow', () => {
  const promptPool = [socialPrompt('duel-prompt', 'duel', 'specific', { text: 'duel prompt', groupSizeMin: 3, groupSizeMax: 4 })];

  const makeDuelState = (withNope: boolean): GameState => {
    const state = baseState(3);
    state.currentPlayerId = 'player-1';
    setTopDiscard(state, makeCard('starter', 'number', { color: 'cyan', value: 4, symbol: '4' }));
    setHands(state, {
      'player-1': [makeCard('duel-card', 'duel', { symbol: 'duel', color: 'cyan' }), makeCard('filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
      'player-2': withNope ? [makeCard('nope-card', 'nope', { symbol: 'nope' })] : [makeCard('response-card', 'number', { color: 'purple', value: 5, symbol: '5' })],
      'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
    });
    return state;
  };

  const stateA = makeDuelState(true);
  const playA = applyCommand(stateA, playCommand(stateA, 'duel-play-a', 'duel-card'), socialContext(promptPool));
  const targetA = applyCommand(playA.state, selectDuelTargetCommand(playA.state, 'duel-target-a', 'player-2'), socialContext(promptPool));
  assert.equal(targetA.ok, true);
  const initiatorFirst = applyCommand(targetA.state, submitDuelResponseCommand(targetA.state, 'duel-init-a', 'initiator', { completionOnly: true }, 'player-1'));
  assert.equal(initiatorFirst.ok, true);
  assert.equal(initiatorFirst.state.social?.pendingReaction?.eligible, true);
  const nopeAfterInitiator = applyCommand(initiatorFirst.state, playNopeCommand(initiatorFirst.state, 'duel-nope-a', 'nope-card', 'player-2'));
  assert.equal(nopeAfterInitiator.ok, true);
  assert.equal(nopeAfterInitiator.state.social, null);
  assert.deepEqual(nopeAfterInitiator.events.map(event => event.type), ['NOPE_PLAYED', 'SOCIAL_EFFECT_RESOLVED', 'TURN_ADVANCED']);

  const stateB = makeDuelState(true);
  const playB = applyCommand(stateB, playCommand(stateB, 'duel-play-b', 'duel-card'), socialContext(promptPool));
  const targetB = applyCommand(playB.state, selectDuelTargetCommand(playB.state, 'duel-target-b', 'player-2'), socialContext(promptPool));
  assert.equal(targetB.ok, true);
  const opponentDecline = applyCommand(targetB.state, submitDuelResponseCommand(targetB.state, 'duel-opponent-b', 'opponent', { completionOnly: true }, 'player-2'));
  assert.equal(opponentDecline.ok, true);
  assert.equal(opponentDecline.state.social?.pendingReaction, null);
  const lateNope = applyCommand(opponentDecline.state, playNopeCommand(opponentDecline.state, 'duel-nope-b', 'nope-card', 'player-2'));
  assert.equal(lateNope.ok, false);
  assert.equal(lateNope.error?.code, 'NO_PENDING_REACTION');

  const stateC = makeDuelState(false);
  const playC = applyCommand(stateC, playCommand(stateC, 'duel-play-c', 'duel-card'), socialContext(promptPool));
  const targetC = applyCommand(playC.state, selectDuelTargetCommand(playC.state, 'duel-target-c', 'player-2'), socialContext(promptPool));
  assert.equal(targetC.ok, true);
  assert.equal(targetC.state.social?.pendingReaction, null);
  const initiatorResponse = applyCommand(targetC.state, submitDuelResponseCommand(targetC.state, 'duel-init-c', 'initiator', { completionOnly: true }, 'player-1'));
  assert.equal(initiatorResponse.ok, true);
  const opponentResponse = applyCommand(initiatorResponse.state, submitDuelResponseCommand(initiatorResponse.state, 'duel-opponent-c', 'opponent', { completionOnly: true }, 'player-2'));
  assert.equal(opponentResponse.ok, true);
  assert.equal(opponentResponse.state.social, null);
});

test('SUBMIT_DUEL_RESPONSE validates response signals, choices, and rejected Nope windows without mutating state', () => {
  const promptPool = [socialPrompt('duel-response', 'duel', 'specific', { text: 'duel response prompt', groupSizeMin: 3, groupSizeMax: 4, options: ['alpha', 'beta'] })];

  const makeTargetedDuelState = (withNope: boolean): GameState => {
    const state = baseState(3);
    state.currentPlayerId = 'player-1';
    setTopDiscard(state, makeCard('starter', 'number', { color: 'cyan', value: 4, symbol: '4' }));
    setHands(state, {
      'player-1': [makeCard('duel-card', 'duel', { symbol: 'duel', color: 'cyan' }), makeCard('filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
      'player-2': withNope ? [makeCard('nope-card', 'nope', { symbol: 'nope' })] : [makeCard('response-card', 'number', { color: 'purple', value: 5, symbol: '5' })],
      'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
    });

    const playResult = applyCommand(state, playCommand(state, `duel-play-${withNope ? 'nope' : 'plain'}`, 'duel-card'), socialContext(promptPool));
    assert.equal(playResult.ok, true);
    const targetResult = applyCommand(playResult.state, selectDuelTargetCommand(playResult.state, `duel-target-${withNope ? 'nope' : 'plain'}`, 'player-2'), socialContext(promptPool));
    assert.equal(targetResult.ok, true);
    return targetResult.state;
  };

  const emptyState = makeTargetedDuelState(true);
  const emptyResponse = applyCommand(emptyState, submitDuelResponseCommand(emptyState, 'duel-empty', 'opponent', {}, 'player-2'));
  assert.equal(emptyResponse.ok, false);
  assert.equal(emptyResponse.error?.code, 'INVALID_SOCIAL_RESPONSE');
  assert.equal(emptyResponse.state.social?.pendingReaction?.eligible, true);
  assert.equal(emptyResponse.state.social?.pendingDuel?.opponentResponse, null);

  const completionState = makeTargetedDuelState(false);
  const completionOnly = applyCommand(completionState, submitDuelResponseCommand(completionState, 'duel-completion', 'opponent', { completionOnly: true }, 'player-2'));
  assert.equal(completionOnly.ok, true);

  const valueState = makeTargetedDuelState(false);
  const valueResponse = applyCommand(valueState, submitDuelResponseCommand(valueState, 'duel-value', 'initiator', { value: 'I answer now' }, 'player-1'));
  assert.equal(valueResponse.ok, true);

  const invalidChoiceState = makeTargetedDuelState(false);
  const invalidChoice = applyCommand(invalidChoiceState, submitDuelResponseCommand(invalidChoiceState, 'duel-choice-invalid', 'opponent', { choice: 'gamma' }, 'player-2'));
  assert.equal(invalidChoice.ok, false);
  assert.equal(invalidChoice.error?.code, 'INVALID_SOCIAL_RESPONSE');

  const validChoiceState = makeTargetedDuelState(false);
  const validChoice = applyCommand(validChoiceState, submitDuelResponseCommand(validChoiceState, 'duel-choice-valid', 'opponent', { choice: 'alpha' }, 'player-2'));
  assert.equal(validChoice.ok, true);
});

test('PLAY_NOPE is rejected for an ineligible social effect', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'lime', value: 1, symbol: '1' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'lime' }), makeCard('nope-card', 'nope', { symbol: 'nope' })],
    'player-2': [],
    'player-3': []
  });

  const promptPool = [socialPrompt('truth-prompt', 'truth', 'current', { text: 'truth prompt' })];
  const playResult = applyCommand(state, playCommand(state, 'truth-play-nope', 'truth-card'), socialContext(promptPool));
  const nopeAttempt = applyCommand(playResult.state, playNopeCommand(playResult.state, 'truth-nope', 'nope-card'));
  assert.equal(nopeAttempt.ok, false);
  assert.equal(nopeAttempt.error?.code, 'INELIGIBLE_NOPE');
});

test('PASS_PROMPT resolves eligible Truth and Dare prompts privately, advances exactly once, and caches failures safely', () => {
  const truthPrompt = socialPrompt('truth-pass-a', 'truth', 'current', { text: 'truth pass prompt a' });
  const darePrompt = socialPrompt('dare-pass-a', 'dare', 'current', { text: 'dare pass prompt a', groupSizeMin: 2, groupSizeMax: 2 });
  const paranoiaPrompt = socialPrompt('paranoia-pass-a', 'paranoia', 'specific', { text: 'paranoia pass prompt a' });

  const truthState = baseState(3);
  truthState.currentPlayerId = 'player-1';
  setTopDiscard(truthState, makeCard('starter-truth', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(truthState, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' }), makeCard('truth-filler', 'number', { color: 'cyan', value: 7, symbol: '7' })],
    'player-2': [makeCard('truth-p2', 'number', { color: 'lime', value: 4, symbol: '4' })],
    'player-3': [makeCard('truth-p3', 'number', { color: 'purple', value: 8, symbol: '8' })]
  });

  const truthPlay = applyCommand(truthState, playCommand(truthState, 'truth-pass-play', 'truth-card'), socialContext([truthPrompt]));
  assert.equal(truthPlay.ok, true);
  const truthPass = applyCommand(truthPlay.state, passCommand(truthPlay.state, 'truth-pass', 'player-1', truthPlay.state.revision));
  assert.equal(truthPass.ok, true);
  assert.equal(truthPass.state.social, null);
  assert.equal(truthPass.state.currentPlayerId, 'player-2');
  assert.equal(truthPass.state.players[0].hand.length, 1);
  assert.equal(truthPass.state.players[0].hand[0].id, 'truth-filler');
  assert.equal(truthPass.events[0].type, 'SOCIAL_PASSED');
  assert.equal(truthPass.events[0].visibility, 'PLAYER_PRIVATE');
  assert.deepEqual(truthPass.events[0].recipientPlayerIds, ['player-1']);
  assert.equal(truthPass.events[1].type, 'SOCIAL_EFFECT_RESOLVED');
  assert.equal(truthPass.events[2].type, 'TURN_ADVANCED');

  const replayTruthPass = applyCommand(truthPass.state, passCommand(truthPass.state, 'truth-pass', 'player-1', truthPlay.state.revision));
  assert.equal(replayTruthPass.ok, true);
  assert.equal(replayTruthPass.idempotentReplay, true);

  const collidingTruthPass = applyCommand(truthPass.state, passCommand(truthPass.state, 'truth-pass', 'player-2', truthPass.state.revision));
  assert.equal(collidingTruthPass.ok, false);
  assert.equal(collidingTruthPass.error?.code, 'COMMAND_ID_COLLISION');

  const noSocialPass = applyCommand(baseState(2), passCommand(baseState(2), 'pass-no-social'));
  assert.equal(noSocialPass.ok, false);
  assert.equal(noSocialPass.error?.code, 'NO_PENDING_SOCIAL');

  const dareState = baseState(2);
  dareState.currentPlayerId = 'player-1';
  setTopDiscard(dareState, makeCard('starter-dare', 'number', { color: 'cyan', value: 5, symbol: '5' }));
  setHands(dareState, {
    'player-1': [makeCard('dare-card', 'dare', { symbol: 'dare', color: 'cyan' })],
    'player-2': [makeCard('dare-p2', 'number', { color: 'lime', value: 4, symbol: '4' })]
  });

  const darePlay = applyCommand(dareState, playCommand(dareState, 'dare-pass-play', 'dare-card'), socialContext([darePrompt]));
  assert.equal(darePlay.ok, true);
  const darePass = applyCommand(darePlay.state, passCommand(darePlay.state, 'dare-pass'));
  assert.equal(darePass.ok, true);
  assert.equal(darePass.state.status, 'FINISHED');
  assert.equal(darePass.state.winnerId, 'player-1');
  assert.deepEqual(darePass.events.map(event => event.type), ['SOCIAL_PASSED', 'SOCIAL_EFFECT_RESOLVED', 'GAME_WON']);

  const paranoiaState = baseState(3);
  paranoiaState.currentPlayerId = 'player-1';
  setTopDiscard(paranoiaState, makeCard('starter-paranoia', 'number', { color: 'purple', value: 4, symbol: '4' }));
  setHands(paranoiaState, {
    'player-1': [makeCard('paranoia-card', 'paranoia', { symbol: 'paranoia', color: 'purple' }), makeCard('paranoia-filler', 'number', { color: 'cyan', value: 7, symbol: '7' })],
    'player-2': [makeCard('paranoia-p2', 'number', { color: 'lime', value: 4, symbol: '4' })],
    'player-3': [makeCard('paranoia-p3', 'number', { color: 'orange', value: 8, symbol: '8' })]
  });

  const paranoiaPlay = applyCommand(paranoiaState, playCommand(paranoiaState, 'paranoia-pass-play', 'paranoia-card'), socialContext([paranoiaPrompt]));
  assert.equal(paranoiaPlay.ok, true);
  const paranoiaPass = applyCommand(paranoiaPlay.state, passCommand(paranoiaPlay.state, 'paranoia-pass'));
  assert.equal(paranoiaPass.ok, true);
  assert.equal(paranoiaPass.state.social, null);
  assert.equal(paranoiaPass.state.currentPlayerId, 'player-2');
  assert.equal(paranoiaPass.state.players[0].hand.length, 1);
  assert.deepEqual(paranoiaPass.events.map(event => event.type), ['SOCIAL_PASSED', 'SOCIAL_EFFECT_RESOLVED', 'TURN_ADVANCED']);
});

test('PASS_PROMPT lets Chaos participants complete independently and supports Duel Pass before and after target selection', () => {
  const chaosPrompt = socialPrompt('chaos-pass', 'chaos', 'all', { text: 'chaos pass prompt', groupSizeMin: 3, groupSizeMax: 3 });

  const chaosState = baseState(3);
  chaosState.currentPlayerId = 'player-1';
  setTopDiscard(chaosState, makeCard('starter-chaos', 'number', { color: 'purple', value: 6, symbol: '6' }));
  setHands(chaosState, {
    'player-1': [makeCard('chaos-card', 'chaos', { symbol: 'chaos', color: 'purple' })],
    'player-2': [makeCard('chaos-p2', 'number', { color: 'lime', value: 4, symbol: '4' })],
    'player-3': [makeCard('chaos-p3', 'number', { color: 'orange', value: 8, symbol: '8' })]
  });

  const chaosPlay = applyCommand(chaosState, playCommand(chaosState, 'chaos-pass-play', 'chaos-card'), socialContext([chaosPrompt]));
  assert.equal(chaosPlay.ok, true);
  assert.deepEqual(chaosPlay.state.social?.pendingCompletionPlayerIds, ['player-1', 'player-2', 'player-3']);

  const chaosPass1 = applyCommand(chaosPlay.state, passCommand(chaosPlay.state, 'chaos-pass-1'));
  assert.equal(chaosPass1.ok, true);
  assert.ok(chaosPass1.state.social);
  assert.deepEqual(chaosPass1.state.social?.completedCompletionPlayerIds, ['player-1']);
  assert.equal(chaosPass1.state.currentPlayerId, 'player-1');

  const chaosPass2 = applyCommand(chaosPass1.state, passCommand(chaosPass1.state, 'chaos-pass-2', 'player-2'));
  assert.equal(chaosPass2.ok, true);
  assert.ok(chaosPass2.state.social);
  assert.deepEqual(chaosPass2.state.social?.completedCompletionPlayerIds, ['player-1', 'player-2']);
  assert.equal(chaosPass2.state.status, 'ACTIVE');

  const chaosPass3 = applyCommand(chaosPass2.state, passCommand(chaosPass2.state, 'chaos-pass-3', 'player-3'));
  assert.equal(chaosPass3.ok, true);
  assert.equal(chaosPass3.state.social, null);
  assert.equal(chaosPass3.state.status, 'FINISHED');
  assert.equal(chaosPass3.state.winnerId, 'player-1');
  assert.equal(chaosPass3.events[0].visibility, 'PLAYER_PRIVATE');
  assert.equal(chaosPass3.events.at(-1)?.type, 'GAME_WON');

  const duelPrompt = socialPrompt('duel-pass', 'duel', 'specific', { text: 'duel pass prompt' });
  const duelState = baseState(3);
  duelState.currentPlayerId = 'player-1';
  setTopDiscard(duelState, makeCard('starter-duel', 'number', { color: 'lime', value: 3, symbol: '3' }));
  setHands(duelState, {
    'player-1': [makeCard('duel-card', 'duel', { symbol: 'duel', color: 'lime' }), makeCard('duel-filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
    'player-2': [makeCard('duel-nope', 'nope', { symbol: 'nope' })],
    'player-3': [makeCard('duel-p3', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const duelPlay = applyCommand(duelState, playCommand(duelState, 'duel-pass-play', 'duel-card'), socialContext([duelPrompt]));
  assert.equal(duelPlay.ok, true);
  const duelPrePassWrong = applyCommand(duelPlay.state, passCommand(duelPlay.state, 'duel-pre-pass-wrong', 'player-2'));
  assert.equal(duelPrePassWrong.ok, false);
  assert.equal(duelPrePassWrong.error?.code, 'NOT_YOUR_TURN');
  const duelPrePass = applyCommand(duelPlay.state, passCommand(duelPlay.state, 'duel-pre-pass', 'player-1'));
  assert.equal(duelPrePass.ok, true);
  assert.equal(duelPrePass.state.social, null);
  assert.equal(duelPrePass.state.status, 'ACTIVE');
  assert.equal(duelPrePass.state.winnerId, null);
  assert.equal(duelPrePass.state.currentPlayerId, 'player-2');
  assert.equal(duelPrePass.state.players[0].hand.length, 1);
  assert.equal(duelPrePass.state.players[1].hand.length, 1);
  assert.deepEqual(duelPrePass.events.map(event => event.type), ['SOCIAL_PASSED', 'SOCIAL_EFFECT_RESOLVED', 'TURN_ADVANCED']);
  assert.equal(duelPrePass.events[0].visibility, 'PLAYER_PRIVATE');
  assert.deepEqual(duelPrePass.events[0].recipientPlayerIds, ['player-1']);

  const replayPrePass = applyCommand(duelPrePass.state, passCommand(duelPrePass.state, 'duel-pre-pass', 'player-1', duelPlay.state.revision));
  assert.equal(replayPrePass.ok, true);
  assert.equal(replayPrePass.idempotentReplay, true);

  const collisionPrePass = applyCommand(duelPrePass.state, passCommand(duelPrePass.state, 'duel-pre-pass', 'player-2', duelPrePass.state.revision));
  assert.equal(collisionPrePass.ok, false);
  assert.equal(collisionPrePass.error?.code, 'COMMAND_ID_COLLISION');

  const duelFinalState = baseState(2);
  duelFinalState.currentPlayerId = 'player-1';
  setTopDiscard(duelFinalState, makeCard('starter-duel-final', 'number', { color: 'lime', value: 3, symbol: '3' }));
  setHands(duelFinalState, {
    'player-1': [makeCard('duel-final-card', 'duel', { symbol: 'duel', color: 'lime' })],
    'player-2': [makeCard('duel-final-nope', 'nope', { symbol: 'nope' })]
  });

  const duelFinalPlay = applyCommand(duelFinalState, playCommand(duelFinalState, 'duel-final-play', 'duel-final-card'), socialContext([duelPrompt]));
  assert.equal(duelFinalPlay.ok, true);
  const duelFinalPass = applyCommand(duelFinalPlay.state, passCommand(duelFinalPlay.state, 'duel-final-pass', 'player-1'));
  assert.equal(duelFinalPass.ok, true);
  assert.equal(duelFinalPass.state.social, null);
  assert.equal(duelFinalPass.state.status, 'FINISHED');
  assert.equal(duelFinalPass.state.winnerId, 'player-1');
  assert.deepEqual(duelFinalPass.events.map(event => event.type), ['SOCIAL_PASSED', 'SOCIAL_EFFECT_RESOLVED', 'GAME_WON']);
  assert.equal(duelFinalPass.events[0].visibility, 'PLAYER_PRIVATE');

  const duelTarget = applyCommand(duelPlay.state, selectDuelTargetCommand(duelPlay.state, 'duel-pass-target', 'player-2'), socialContext([duelPrompt]));
  assert.equal(duelTarget.ok, true);
  const duelPassDenied = applyCommand(duelTarget.state, passCommand(duelTarget.state, 'duel-pass-denied', 'player-3'));
  assert.equal(duelPassDenied.ok, false);
  assert.equal(duelPassDenied.error?.code, 'NOT_YOUR_TURN');
  const duelPass = applyCommand(duelTarget.state, passCommand(duelTarget.state, 'duel-pass', 'player-2'));
  assert.equal(duelPass.ok, true);
  assert.equal(duelPass.state.social, null);
  assert.equal(duelPass.state.status, 'ACTIVE');
  assert.equal(duelPass.state.winnerId, null);
  assert.equal(duelPass.state.currentPlayerId, 'player-2');
  assert.equal(duelPass.state.players[0].hand.length, 1);
  assert.equal(duelPass.state.players[1].hand.length, 1);
  assert.deepEqual(duelPass.events.map(event => event.type), ['SOCIAL_PASSED', 'SOCIAL_EFFECT_RESOLVED', 'TURN_ADVANCED']);
});

test('REWIND_PROMPT replaces eligible Truth and Dare prompts deterministically and stays private', () => {
  const promptA = socialPrompt('prompt-a', 'truth', 'current', { text: 'prompt a' });
  const promptB = socialPrompt('prompt-b', 'truth', 'current', { text: 'prompt b' });
  const promptPool = [promptB, promptA];

  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter-rewind', 'number', { color: 'orange', value: 4, symbol: '4' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('rewind-p2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('rewind-p3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const playResult = applyCommand(state, playCommand(state, 'rewind-play', 'truth-card'), socialContext(promptPool));
  assert.equal(playResult.ok, true);
  assert.equal(playResult.state.social?.prompt?.id, 'prompt-a');

  const rewindCommandInput = rewindCommand(playResult.state, 'rewind-command');
  const rewindResult = applyCommand(playResult.state, rewindCommandInput, socialContext(promptPool));
  assert.equal(rewindResult.ok, true);
  assert.equal(rewindResult.state.currentPlayerId, 'player-1');
  assert.equal(rewindResult.state.status, 'ACTIVE');
  assert.deepEqual(rewindResult.state.rewindUsedByPlayerIds, ['player-1']);
  assert.equal(rewindResult.state.social?.prompt?.id, 'prompt-b');
  assert.equal(rewindResult.state.social?.promptSelection?.promptId, 'prompt-b');
  assert.ok(rewindResult.events.every(event => event.visibility === 'PLAYER_PRIVATE'));
  assert.equal(rewindResult.events[0].type, 'PROMPT_REWOUND');
  assert.equal(rewindResult.events[1].type, 'ROULETTE_PRESENTATION_STARTED');
  assert.equal(JSON.stringify(rewindResult.events).includes('prompt-a'), false);

  const projected = projectRoulettePresentation(rewindResult.state.social!.roulettePresentation!);
  assert.equal(projected.selectedResultId, undefined);
  assert.equal(projected.candidateResultIds, undefined);

  const rewindReplay = applyCommand(rewindResult.state, rewindCommandInput, socialContext(promptPool));
  assert.equal(rewindReplay.ok, true);
  assert.equal(rewindReplay.idempotentReplay, true);

  const rewindAgain = applyCommand(rewindResult.state, rewindCommand(rewindResult.state, 'rewind-second'), socialContext(promptPool));
  assert.equal(rewindAgain.ok, false);
  assert.equal(rewindAgain.error?.code, 'REWIND_ALREADY_USED');

  const noAlternateState = baseState(3);
  noAlternateState.currentPlayerId = 'player-1';
  setTopDiscard(noAlternateState, makeCard('starter-rewind-single', 'number', { color: 'orange', value: 4, symbol: '4' }));
  setHands(noAlternateState, {
    'player-1': [makeCard('truth-single', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('rewind-single-p2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('rewind-single-p3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const noAlternatePlay = applyCommand(noAlternateState, playCommand(noAlternateState, 'rewind-single-play', 'truth-single'), socialContext([promptA]));
  assert.equal(noAlternatePlay.ok, true);
  const noAlternateRewind = applyCommand(noAlternatePlay.state, rewindCommand(noAlternatePlay.state, 'rewind-single-command'), socialContext([promptA]));
  assert.equal(noAlternateRewind.ok, false);
  assert.equal(noAlternateRewind.error?.code, 'NO_ALTERNATE_PROMPT');
  assert.equal(noAlternateRewind.state.rewindUsedByPlayerIds.includes('player-1'), false);

  const wrongPlayer = applyCommand(playResult.state, rewindCommand(playResult.state, 'rewind-wrong-player', 'player-2'), socialContext(promptPool));
  assert.equal(wrongPlayer.ok, false);
  assert.equal(wrongPlayer.error?.code, 'NOT_YOUR_TURN');

  const chaosPrompt = socialPrompt('rewind-chaos', 'chaos', 'all', { text: 'rewind chaos prompt', groupSizeMin: 3, groupSizeMax: 3 });
  const chaosState = baseState(3);
  chaosState.currentPlayerId = 'player-1';
  setTopDiscard(chaosState, makeCard('starter-chaos', 'number', { color: 'purple', value: 6, symbol: '6' }));
  setHands(chaosState, {
    'player-1': [makeCard('chaos-card', 'chaos', { symbol: 'chaos', color: 'purple' })],
    'player-2': [makeCard('chaos-p2', 'number', { color: 'lime', value: 4, symbol: '4' })],
    'player-3': [makeCard('chaos-p3', 'number', { color: 'orange', value: 8, symbol: '8' })]
  });
  const chaosPlay = applyCommand(chaosState, playCommand(chaosState, 'rewind-chaos-play', 'chaos-card'), socialContext([chaosPrompt]));
  const chaosRewind = applyCommand(chaosPlay.state, rewindCommand(chaosPlay.state, 'rewind-chaos-command'), socialContext([chaosPrompt]));
  assert.equal(chaosRewind.ok, false);
  assert.equal(chaosRewind.error?.code, 'REWIND_NOT_ALLOWED');

  const duelPrompt = socialPrompt('rewind-duel', 'duel', 'specific', { text: 'rewind duel prompt' });
  const duelState = baseState(3);
  duelState.currentPlayerId = 'player-1';
  setTopDiscard(duelState, makeCard('starter-duel', 'number', { color: 'lime', value: 3, symbol: '3' }));
  setHands(duelState, {
    'player-1': [makeCard('duel-card', 'duel', { symbol: 'duel', color: 'lime' })],
    'player-2': [makeCard('duel-nope', 'nope', { symbol: 'nope' })],
    'player-3': [makeCard('duel-p3', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });
  const duelPlay = applyCommand(duelState, playCommand(duelState, 'rewind-duel-play', 'duel-card'), socialContext([duelPrompt]));
  const duelTarget = applyCommand(duelPlay.state, selectDuelTargetCommand(duelPlay.state, 'rewind-duel-target', 'player-2'), socialContext([duelPrompt]));
  const duelRewind = applyCommand(duelTarget.state, rewindCommand(duelTarget.state, 'rewind-duel-command'), socialContext([duelPrompt]));
  assert.equal(duelRewind.ok, false);
  assert.equal(duelRewind.error?.code, 'REWIND_NOT_ALLOWED');
});

test('FLAG_PROMPT records private moderation metadata without mutating gameplay state or leaking details publicly', () => {
  const prompt = socialPrompt('flag-prompt', 'truth', 'current', { text: 'flag prompt', authorshipMode: 'SIGNED' });

  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter-flag', 'number', { color: 'orange', value: 4, symbol: '4' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' }), makeCard('flag-filler', 'number', { color: 'cyan', value: 7, symbol: '7' })],
    'player-2': [makeCard('flag-p2', 'number', { color: 'lime', value: 4, symbol: '4' })],
    'player-3': [makeCard('flag-p3', 'number', { color: 'purple', value: 8, symbol: '8' })]
  });

  const playResult = applyCommand(state, playCommand(state, 'flag-play', 'truth-card'), socialContext([prompt]));
  assert.equal(playResult.ok, true);
  const flagCommandInput = flagCommand(playResult.state, 'flag-command', 'flag-prompt', 'player-1', playResult.state.revision, 'harassment');
  const flagResult = applyCommand(playResult.state, flagCommandInput);
  assert.equal(flagResult.ok, true);
  assert.equal(flagResult.state.social?.prompt?.id, 'flag-prompt');
  assert.equal(flagResult.state.currentPlayerId, 'player-1');
  assert.equal(flagResult.state.players[0].hand.length, 1);
  assert.equal(flagResult.state.discardPile.at(-1)?.id, 'truth-card');
  assert.equal(flagResult.events.length, 1);
  assert.equal(flagResult.events[0].type, 'CONTENT_FLAGGED');
  assert.equal(flagResult.events[0].visibility, 'PLAYER_PRIVATE');
  assert.deepEqual(flagResult.events[0].recipientPlayerIds, ['player-1']);
  assert.equal((flagResult.events[0].payload as { reasonCode?: string }).reasonCode, 'harassment');
  assert.equal(JSON.stringify(flagResult.events).includes('flag-prompt'), true);
  assert.equal(JSON.stringify(flagResult.events).includes('flag-filler'), false);

  const replayFlag = applyCommand(flagResult.state, flagCommandInput);
  assert.equal(replayFlag.ok, true);
  assert.equal(replayFlag.idempotentReplay, true);

  const collidingFlag = applyCommand(flagResult.state, flagCommand(flagResult.state, 'flag-command', 'different-prompt', 'player-1', flagResult.state.revision, 'harassment'));
  assert.equal(collidingFlag.ok, false);
  assert.equal(collidingFlag.error?.code, 'COMMAND_ID_COLLISION');

  const invalidTarget = applyCommand(playResult.state, flagCommand(playResult.state, 'flag-invalid', 'other-prompt', 'player-1', playResult.state.revision, 'harassment'));
  assert.equal(invalidTarget.ok, false);
  assert.equal(invalidTarget.error?.code, 'INVALID_FLAG_TARGET');

  const paranoiaPrompt = socialPrompt('paranoia-flag-prompt', 'paranoia', 'specific', { text: 'paranoia flag prompt' });
  const paranoiaState = baseState(3);
  paranoiaState.currentPlayerId = 'player-1';
  setTopDiscard(paranoiaState, makeCard('starter-paranoia-flag', 'number', { color: 'purple', value: 4, symbol: '4' }));
  setHands(paranoiaState, {
    'player-1': [makeCard('paranoia-truth', 'paranoia', { symbol: 'paranoia', color: 'purple' })],
    'player-2': [makeCard('paranoia-flag-p2', 'number', { color: 'lime', value: 4, symbol: '4' })],
    'player-3': [makeCard('paranoia-flag-p3', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const paranoiaPlay = applyCommand(paranoiaState, playCommand(paranoiaState, 'paranoia-flag-play', 'paranoia-truth'), socialContext([paranoiaPrompt]));
  assert.equal(paranoiaPlay.ok, true);
  const paranoiaCandidateFlag = applyCommand(paranoiaPlay.state, flagCommand(paranoiaPlay.state, 'paranoia-flag-candidate', 'paranoia-flag-prompt', 'player-2', paranoiaPlay.state.revision, 'harassment'));
  assert.equal(paranoiaCandidateFlag.ok, false);
  assert.equal(paranoiaCandidateFlag.error?.code, 'INVALID_FLAG_TARGET');
  const paranoiaActorFlag = applyCommand(paranoiaPlay.state, flagCommand(paranoiaPlay.state, 'paranoia-flag-actor', 'paranoia-flag-prompt', 'player-1', paranoiaPlay.state.revision, 'harassment'));
  assert.equal(paranoiaActorFlag.ok, true);
});

test('Answer modes Speak and Type resolve privately, reject empty submissions, and delay the final-card win', () => {
  const speakPrompt = socialPrompt('speak-answer', 'truth', 'current', { text: 'speak answer prompt', groupSizeMin: 2, groupSizeMax: 2 });
  const speakState = baseState(2);
  speakState.currentPlayerId = 'player-1';
  setTopDiscard(speakState, makeCard('starter-speak', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(speakState, {
    'player-1': [makeCard('speak-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('speak-other', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const speakPlay = applyCommand(speakState, playCommand(speakState, 'speak-play', 'speak-card'), socialContext([speakPrompt]));
  assert.equal(speakPlay.ok, true);
  const speakBeforeMode = applyCommand(speakPlay.state, submitAnswerCommand(speakPlay.state, 'speak-before-mode'));
  assert.equal(speakBeforeMode.ok, false);
  assert.equal(speakBeforeMode.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const speakBeforeModeReplay = applyCommand(speakBeforeMode.state, submitAnswerCommand(speakBeforeMode.state, 'speak-before-mode', 'player-1', speakBeforeMode.state.revision));
  assert.equal(speakBeforeModeReplay.ok, false);
  assert.equal(speakBeforeModeReplay.idempotentReplay, true);
  const speakBeforeModeCollision = applyCommand(speakBeforeMode.state, submitAnswerCommand(speakBeforeMode.state, 'speak-before-mode', 'player-2', speakBeforeMode.state.revision));
  assert.equal(speakBeforeModeCollision.ok, false);
  assert.equal(speakBeforeModeCollision.error?.code, 'COMMAND_ID_COLLISION');

  const speakMode = applyCommand(speakPlay.state, answerModeCommand(speakPlay.state, 'speak-mode', 'SPEAK'));
  assert.equal(speakMode.ok, true);
  const speakReview = applyCommand(speakMode.state, reviewAnswerCommand(speakMode.state, 'speak-review', { completionOnly: true }));
  assert.equal(speakReview.ok, true);
  assert.equal(speakReview.state.social?.answerState.mode, 'SPEAK');
  assert.equal(speakReview.state.social?.answerState.completionOnly, true);
  const speakSubmit = applyCommand(speakReview.state, submitAnswerCommand(speakReview.state, 'speak-submit'));
  assert.equal(speakSubmit.ok, true);
  assert.equal(speakSubmit.state.social, null);
  assert.equal(speakSubmit.state.status, 'FINISHED');
  assert.equal(speakSubmit.state.winnerId, 'player-1');
  assert.equal(JSON.stringify(speakSubmit.events.filter(event => event.visibility === 'PUBLIC')).includes('speak'), false);
  const speakReplay = applyCommand(speakSubmit.state, submitAnswerCommand(speakSubmit.state, 'speak-submit', 'player-1', speakReview.state.revision));
  assert.equal(speakReplay.ok, true);
  assert.equal(speakReplay.idempotentReplay, true);

  const typePrompt = socialPrompt('type-answer', 'truth', 'current', { text: 'type answer prompt', groupSizeMin: 2, groupSizeMax: 2 });
  const typeState = baseState(2);
  typeState.currentPlayerId = 'player-1';
  setTopDiscard(typeState, makeCard('starter-type', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(typeState, {
    'player-1': [makeCard('type-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('type-other', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const typePlay = applyCommand(typeState, playCommand(typeState, 'type-play', 'type-card'), socialContext([typePrompt]));
  assert.equal(typePlay.ok, true);
  const typeMode = applyCommand(typePlay.state, answerModeCommand(typePlay.state, 'type-mode', 'TYPE'));
  assert.equal(typeMode.ok, true);
  const typeMissing = applyCommand(typeMode.state, submitAnswerCommand(typeMode.state, 'type-missing'));
  assert.equal(typeMissing.ok, false);
  assert.equal(typeMissing.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const typeMissingReplay = applyCommand(typeMissing.state, submitAnswerCommand(typeMissing.state, 'type-missing'));
  assert.equal(typeMissingReplay.ok, false);
  assert.equal(typeMissingReplay.idempotentReplay, true);
  const typeMissingCollision = applyCommand(typeMissing.state, submitAnswerCommand(typeMissing.state, 'type-missing', 'player-2', typeMissing.state.revision));
  assert.equal(typeMissingCollision.ok, false);
  assert.equal(typeMissingCollision.error?.code, 'COMMAND_ID_COLLISION');

  const typeReview = applyCommand(typeMode.state, reviewAnswerCommand(typeMode.state, 'type-review', { value: 'typed answer' }));
  assert.equal(typeReview.ok, true);
  assert.equal(typeReview.state.social?.answerState.status, 'REVIEW');
  assert.equal(typeReview.state.social?.answerState.value, 'typed answer');
  const typeSubmit = applyCommand(typeReview.state, submitAnswerCommand(typeReview.state, 'type-submit'));
  assert.equal(typeSubmit.ok, true);
  assert.equal(typeSubmit.state.social, null);
  assert.equal(typeSubmit.state.status, 'FINISHED');
  assert.equal(typeSubmit.state.winnerId, 'player-1');
  assert.equal(JSON.stringify(typeSubmit.events.filter(event => event.visibility === 'PUBLIC')).includes('typed answer'), false);
  const typeReplay = applyCommand(typeSubmit.state, submitAnswerCommand(typeSubmit.state, 'type-submit', 'player-1', typeReview.state.revision));
  assert.equal(typeReplay.ok, true);
  assert.equal(typeReplay.idempotentReplay, true);
});

test('Choose answers validate authoritative options, cache failed reviews, and keep choice private', () => {
  const noOptionState = baseState(2);
  noOptionState.currentPlayerId = 'player-1';
  setTopDiscard(noOptionState, makeCard('starter-choose-none', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(noOptionState, {
    'player-1': [makeCard('choose-none-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('choose-none-other', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });
  const noOptionPlay = applyCommand(noOptionState, playCommand(noOptionState, 'choose-none-play', 'choose-none-card'), socialContext([socialPrompt('choose-none', 'truth', 'current', { text: 'choose none prompt', groupSizeMin: 2, groupSizeMax: 2 })]));
  assert.equal(noOptionPlay.ok, true);
  const noOptionMode = applyCommand(noOptionPlay.state, answerModeCommand(noOptionPlay.state, 'choose-none-mode', 'CHOOSE'));
  assert.equal(noOptionMode.ok, false);
  assert.equal(noOptionMode.error?.code, 'INVALID_SOCIAL_RESPONSE');

  const state = baseState(2);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const prompt = socialPrompt('truth-answer', 'truth', 'current', { text: 'truth answer prompt', groupSizeMin: 2, groupSizeMax: 2, options: ['alpha', 'beta'] });
  const playResult = applyCommand(state, playCommand(state, 'truth-answer-play', 'truth-card'), socialContext([prompt]));
  assert.equal(playResult.state.winnerId, null);

  const modeResult = applyCommand(playResult.state, answerModeCommand(playResult.state, 'truth-mode', 'CHOOSE'));
  assert.equal(modeResult.ok, true);
  assert.equal(modeResult.state.social?.answerState.status, 'MODE_SELECTED');

  const invalidDirectChoice = applyCommand(modeResult.state, submitChoiceCommand(modeResult.state, 'truth-submit-invalid-direct', 'gamma'));
  assert.equal(invalidDirectChoice.ok, false);
  assert.equal(invalidDirectChoice.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const invalidDirectChoiceReplay = applyCommand(invalidDirectChoice.state, submitChoiceCommand(invalidDirectChoice.state, 'truth-submit-invalid-direct', 'gamma', 'player-1', invalidDirectChoice.state.revision));
  assert.equal(invalidDirectChoiceReplay.ok, false);
  assert.equal(invalidDirectChoiceReplay.idempotentReplay, true);
  const invalidDirectChoiceCollision = applyCommand(invalidDirectChoice.state, submitChoiceCommand(invalidDirectChoice.state, 'truth-submit-invalid-direct', 'alpha', 'player-1', invalidDirectChoice.state.revision));
  assert.equal(invalidDirectChoiceCollision.ok, false);
  assert.equal(invalidDirectChoiceCollision.error?.code, 'COMMAND_ID_COLLISION');

  const directChoiceResult = applyCommand(modeResult.state, submitChoiceCommand(modeResult.state, 'truth-submit-direct', 'alpha'));
  assert.equal(directChoiceResult.ok, true);
  assert.equal(directChoiceResult.state.social, null);
  assert.equal(directChoiceResult.state.status, 'FINISHED');
  assert.equal(directChoiceResult.state.winnerId, 'player-1');
  assert.deepEqual(directChoiceResult.events.map(event => event.type), ['ANSWER_CHOICE_SUBMITTED', 'SOCIAL_EFFECT_RESOLVED', 'GAME_WON']);
  assert.equal(JSON.stringify(directChoiceResult.events.filter(event => event.visibility === 'PUBLIC')).includes('alpha'), false);

  const invalidReview = applyCommand(modeResult.state, reviewAnswerCommand(modeResult.state, 'truth-review-invalid', { choice: 'gamma' }));
  assert.equal(invalidReview.ok, false);
  assert.equal(invalidReview.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const invalidReviewReplay = applyCommand(invalidReview.state, reviewAnswerCommand(invalidReview.state, 'truth-review-invalid', { choice: 'gamma' }, 'player-1', invalidReview.state.revision));
  assert.equal(invalidReviewReplay.ok, false);
  assert.equal(invalidReviewReplay.idempotentReplay, true);
  const invalidReviewCollision = applyCommand(invalidReview.state, reviewAnswerCommand(invalidReview.state, 'truth-review-invalid', { choice: 'alpha' }, 'player-1', invalidReview.state.revision));
  assert.equal(invalidReviewCollision.ok, false);
  assert.equal(invalidReviewCollision.error?.code, 'COMMAND_ID_COLLISION');

  const reviewResult = applyCommand(modeResult.state, reviewAnswerCommand(modeResult.state, 'truth-review', { choice: 'alpha' }));
  assert.equal(reviewResult.ok, true);
  assert.equal(reviewResult.state.social?.answerState.status, 'REVIEW');
  assert.equal(reviewResult.state.social?.answerState.choice, 'alpha');

  const submitResult = applyCommand(reviewResult.state, submitChoiceCommand(reviewResult.state, 'truth-submit', 'alpha'));
  assert.equal(submitResult.ok, true);
  assert.equal(submitResult.state.social, null);
  assert.equal(submitResult.state.status, 'FINISHED');
  assert.equal(submitResult.state.winnerId, 'player-1');
  assert.deepEqual(submitResult.events.map(event => event.type), ['ANSWER_CHOICE_SUBMITTED', 'SOCIAL_EFFECT_RESOLVED', 'GAME_WON']);
  assert.equal(JSON.stringify(submitResult.events.filter(event => event.visibility === 'PUBLIC')).includes('alpha'), false);

  const replaySubmit = applyCommand(submitResult.state, submitChoiceCommand(submitResult.state, 'truth-submit', 'alpha', 'player-1', reviewResult.state.revision));
  assert.equal(replaySubmit.ok, true);
  assert.equal(replaySubmit.idempotentReplay, true);
  const staleAnswer = applyCommand(submitResult.state, submitChoiceCommand(submitResult.state, 'truth-submit-stale', 'alpha', 'player-1', 0));
  assert.equal(staleAnswer.ok, false);
  assert.equal(staleAnswer.error?.code, 'STALE_REVISION');
});

test('Answered Live marks completion privately, rejects wrong modes, and stays replay-safe', () => {
  const livePrompt = socialPrompt('live-answer', 'truth', 'current', { text: 'live answer prompt', groupSizeMin: 2, groupSizeMax: 2 });

  const liveState = baseState(2);
  liveState.currentPlayerId = 'player-1';
  setTopDiscard(liveState, makeCard('starter-live', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(liveState, {
    'player-1': [makeCard('live-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('live-other', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const livePlay = applyCommand(liveState, playCommand(liveState, 'live-play', 'live-card'), socialContext([livePrompt]));
  assert.equal(livePlay.ok, true);
  const wrongMode = applyCommand(livePlay.state, answerModeCommand(livePlay.state, 'live-wrong-mode', 'TYPE'));
  assert.equal(wrongMode.ok, true);
  const wrongModeMark = applyCommand(wrongMode.state, markAnsweredLiveCommand(wrongMode.state, 'live-wrong-mark'));
  assert.equal(wrongModeMark.ok, false);
  assert.equal(wrongModeMark.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const wrongModeReplay = applyCommand(wrongModeMark.state, markAnsweredLiveCommand(wrongModeMark.state, 'live-wrong-mark'));
  assert.equal(wrongModeReplay.ok, false);
  assert.equal(wrongModeReplay.idempotentReplay, true);
  const wrongModeCollision = applyCommand(wrongModeMark.state, markAnsweredLiveCommand(wrongModeMark.state, 'live-wrong-mark', 'player-2'));
  assert.equal(wrongModeCollision.ok, false);
  assert.equal(wrongModeCollision.error?.code, 'COMMAND_ID_COLLISION');

  const liveMode = applyCommand(livePlay.state, answerModeCommand(livePlay.state, 'live-mode', 'ANSWERED_LIVE'));
  assert.equal(liveMode.ok, true);
  const liveMark = applyCommand(liveMode.state, markAnsweredLiveCommand(liveMode.state, 'live-mark'));
  assert.equal(liveMark.ok, true);
  assert.equal(liveMark.state.social, null);
  assert.equal(liveMark.state.status, 'FINISHED');
  assert.equal(liveMark.state.winnerId, 'player-1');
  assert.deepEqual(liveMark.events[0]?.payload, { playerId: 'player-1', cardKind: 'truth', completionOnly: true });
  assert.equal(JSON.stringify(liveMark.events.filter(event => event.visibility === 'PUBLIC')).includes('live'), false);
  const liveReplay = applyCommand(liveMark.state, markAnsweredLiveCommand(liveMark.state, 'live-mark', 'player-1', liveMode.state.revision));
  assert.equal(liveReplay.ok, true);
  assert.equal(liveReplay.idempotentReplay, true);
});

test('Chaos targeting all supports mixed answer modes and resolves only after every required player completes', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'purple', value: 5, symbol: '5' }));
  setHands(state, {
    'player-1': [makeCard('chaos-card', 'chaos', { symbol: 'chaos', color: 'purple' })],
    'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const prompt = socialPrompt('chaos-live', 'chaos', 'all', { text: 'chaos live prompt', groupSizeMin: 3, groupSizeMax: 5, options: ['alpha', 'beta'] });
  const playResult = applyCommand(state, playCommand(state, 'chaos-play', 'chaos-card'), socialContext([prompt]));
  assert.equal(playResult.ok, true);
  assert.deepEqual(playResult.state.social?.pendingCompletionPlayerIds, ['player-1', 'player-2', 'player-3']);
  assert.equal(playResult.state.winnerId, null);

  const p1Mode = applyCommand(playResult.state, answerModeCommand(playResult.state, 'chaos-mode-1', 'TYPE', 'player-1'));
  assert.equal(p1Mode.ok, true);
  const p1Review = applyCommand(p1Mode.state, reviewAnswerCommand(p1Mode.state, 'chaos-review-1', { value: 'typed chaos answer' }, 'player-1'));
  assert.equal(p1Review.ok, true);
  const p1Submit = applyCommand(p1Review.state, submitAnswerCommand(p1Review.state, 'chaos-submit-1', 'player-1'));
  assert.equal(p1Submit.ok, true);
  assert.ok(p1Submit.state.social);
  assert.deepEqual(p1Submit.state.social?.completedCompletionPlayerIds, ['player-1']);
  assert.equal(p1Submit.state.winnerId, null);

  const p2Mode = applyCommand(p1Submit.state, answerModeCommand(p1Submit.state, 'chaos-mode-2', 'ANSWERED_LIVE', 'player-2'));
  assert.equal(p2Mode.ok, true);
  const p2Review = applyCommand(p2Mode.state, reviewAnswerCommand(p2Mode.state, 'chaos-review-2', { completionOnly: true }, 'player-2'));
  assert.equal(p2Review.ok, true);
  const p2Mark = applyCommand(p2Review.state, markAnsweredLiveCommand(p2Review.state, 'chaos-mark-2', 'player-2'));
  assert.equal(p2Mark.ok, true);
  assert.ok(p2Mark.state.social);
  assert.deepEqual(p2Mark.state.social?.completedCompletionPlayerIds, ['player-1', 'player-2']);
  assert.equal(p2Mark.state.winnerId, null);

  const p3Mode = applyCommand(p2Mark.state, answerModeCommand(p2Mark.state, 'chaos-mode-3', 'CHOOSE', 'player-3'));
  assert.equal(p3Mode.ok, true);
  const p3Review = applyCommand(p3Mode.state, reviewAnswerCommand(p3Mode.state, 'chaos-review-3', { choice: 'alpha' }, 'player-3'));
  assert.equal(p3Review.ok, true);
  const p3Submit = applyCommand(p3Review.state, submitChoiceCommand(p3Review.state, 'chaos-submit-3', 'alpha', 'player-3'));
  assert.equal(p3Submit.ok, true);
  assert.equal(p3Submit.state.social, null);
  assert.equal(p3Submit.state.status, 'FINISHED');
  assert.equal(p3Submit.state.winnerId, 'player-1');
  assert.deepEqual(p3Submit.events.map(event => event.type), ['ANSWER_CHOICE_SUBMITTED', 'SOCIAL_EFFECT_RESOLVED', 'GAME_WON']);
});

test('Social command idempotency and commandId collision protection still hold for new commands', () => {
  const makeDuelState = (withNope: boolean): GameState => {
    const state = baseState(3);
    state.currentPlayerId = 'player-1';
    setTopDiscard(state, makeCard('starter', 'number', { color: 'cyan', value: 4, symbol: '4' }));
    setHands(state, {
      'player-1': [makeCard('duel-card', 'duel', { symbol: 'duel', color: 'cyan' }), makeCard('filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
      'player-2': withNope ? [makeCard('nope-card', 'nope', { symbol: 'nope' })] : [makeCard('response-card', 'number', { color: 'purple', value: 5, symbol: '5' })],
      'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
    });
    return state;
  };

  const makeTruthState = (): GameState => {
    const state = baseState(3);
    state.currentPlayerId = 'player-1';
    setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 2, symbol: '2' }));
    setHands(state, {
      'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' })],
      'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
      'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
    });
    return state;
  };

  const duelPromptPool = [socialPrompt('duel-collision', 'duel', 'specific')];
  const duelState = makeDuelState(true);
  const duelPlay = applyCommand(duelState, playCommand(duelState, 'duel-collision-play', 'duel-card'), socialContext(duelPromptPool));
  const duelTarget = applyCommand(duelPlay.state, selectDuelTargetCommand(duelPlay.state, 'duel-collision-target', 'player-2'), socialContext(duelPromptPool));
  assert.equal(duelTarget.ok, true);

  const firstResponse = applyCommand(duelTarget.state, submitDuelResponseCommand(duelTarget.state, 'duel-response', 'opponent', { completionOnly: true }, 'player-2'));
  assert.equal(firstResponse.ok, true);
  const replayResponse = applyCommand(firstResponse.state, submitDuelResponseCommand(firstResponse.state, 'duel-response', 'opponent', { completionOnly: true }, 'player-2', 0));
  assert.equal(replayResponse.ok, true);
  assert.equal(replayResponse.idempotentReplay, true);

  const collision = applyCommand(firstResponse.state, selectDuelTargetCommand(firstResponse.state, 'duel-response', 'player-3', 'player-1', firstResponse.state.revision));
  assert.equal(collision.ok, false);
  assert.equal(collision.error?.code, 'COMMAND_ID_COLLISION');

  const paranoiaState = baseState(3);
  paranoiaState.currentPlayerId = 'player-1';
  setTopDiscard(paranoiaState, makeCard('starter', 'number', { color: 'purple', value: 8, symbol: '8' }));
  setHands(paranoiaState, {
    'player-1': [makeCard('paranoia-card', 'paranoia', { symbol: 'paranoia', color: 'purple' }), makeCard('filler', 'number', { color: 'orange', value: 7, symbol: '7' })],
    'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const paranoiaPromptPool = [socialPrompt('paranoia-1', 'paranoia', 'specific', { text: 'paranoia prompt' })];
  const paranoiaPlay = applyCommand(paranoiaState, playCommand(paranoiaState, 'paranoia-play', 'paranoia-card'), socialContext(paranoiaPromptPool));
  const invalidParanoia = applyCommand(paranoiaPlay.state, selectParanoiaTargetCommand(paranoiaPlay.state, 'paranoia-cache', 'nobody'));
  assert.equal(invalidParanoia.ok, false);
  assert.equal(invalidParanoia.error?.code, 'INVALID_SOCIAL_TARGET');
  const replayParanoia = applyCommand(invalidParanoia.state, selectParanoiaTargetCommand(invalidParanoia.state, 'paranoia-cache', 'player-2'));
  assert.equal(replayParanoia.ok, false);
  assert.equal(replayParanoia.error?.code, 'COMMAND_ID_COLLISION');

  const nopeState = makeDuelState(false);
  const nopePlay = applyCommand(nopeState, playCommand(nopeState, 'duel-nope-play', 'duel-card'), socialContext(duelPromptPool));
  const nopeTarget = applyCommand(nopePlay.state, selectDuelTargetCommand(nopePlay.state, 'duel-nope-target', 'player-2'), socialContext(duelPromptPool));
  assert.equal(nopeTarget.ok, true);
  const emptyNope = applyCommand(nopeTarget.state, playNopeCommand(nopeTarget.state, 'duel-nope-cache', 'nope-card', 'player-2'));
  assert.equal(emptyNope.ok, false);
  assert.equal(emptyNope.error?.code, 'NO_PENDING_REACTION');
  const replayNope = applyCommand(emptyNope.state, playNopeCommand(emptyNope.state, 'duel-nope-cache', 'other-card', 'player-2'));
  assert.equal(replayNope.ok, false);
  assert.equal(replayNope.error?.code, 'COMMAND_ID_COLLISION');

  const modeState = makeTruthState();
  setHands(modeState, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const modePrompt = [socialPrompt('truth-mode-cache', 'truth', 'current', { text: 'truth mode prompt' })];
  const modePlay = applyCommand(modeState, playCommand(modeState, 'truth-mode-play', 'truth-card'), socialContext(modePrompt));
  const modeFailure = applyCommand(modePlay.state, answerModeCommand(modePlay.state, 'truth-mode-cache', 'CHOOSE'));
  assert.equal(modeFailure.ok, false);
  assert.equal(modeFailure.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const modeReplay = applyCommand(modeFailure.state, answerModeCommand(modeFailure.state, 'truth-mode-cache', 'CHOOSE', 'player-1', modeFailure.state.revision));
  assert.equal(modeReplay.ok, false);
  assert.equal(modeReplay.idempotentReplay, true);

  const typeReviewState = makeTruthState();
  setHands(typeReviewState, {
    'player-1': [makeCard('truth-type-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('other-2-type', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3-type', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const typeReviewPrompt = [socialPrompt('truth-type-cache', 'truth', 'current', { text: 'truth type prompt' })];
  const typeReviewPlay = applyCommand(typeReviewState, playCommand(typeReviewState, 'truth-type-play', 'truth-type-card'), socialContext(typeReviewPrompt));
  const typeReviewMode = applyCommand(typeReviewPlay.state, answerModeCommand(typeReviewPlay.state, 'truth-type-mode', 'TYPE'));
  assert.equal(typeReviewMode.ok, true);
  const typeReviewFailure = applyCommand(typeReviewMode.state, reviewAnswerCommand(typeReviewMode.state, 'truth-type-cache', {}));
  assert.equal(typeReviewFailure.ok, false);
  assert.equal(typeReviewFailure.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const typeReviewReplay = applyCommand(typeReviewFailure.state, reviewAnswerCommand(typeReviewFailure.state, 'truth-type-cache', {}, 'player-1', typeReviewFailure.state.revision));
  assert.equal(typeReviewReplay.ok, false);
  assert.equal(typeReviewReplay.idempotentReplay, true);
  const typeReviewCollision = applyCommand(typeReviewFailure.state, reviewAnswerCommand(typeReviewFailure.state, 'truth-type-cache', { value: 'typed answer' }, 'player-1', typeReviewFailure.state.revision));
  assert.equal(typeReviewCollision.ok, false);
  assert.equal(typeReviewCollision.error?.code, 'COMMAND_ID_COLLISION');

  const liveReviewState = makeTruthState();
  setHands(liveReviewState, {
    'player-1': [makeCard('truth-live-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('other-2-live', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3-live', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const liveReviewPrompt = [socialPrompt('truth-live-cache', 'truth', 'current', { text: 'truth live prompt' })];
  const liveReviewPlay = applyCommand(liveReviewState, playCommand(liveReviewState, 'truth-live-play', 'truth-live-card'), socialContext(liveReviewPrompt));
  const liveReviewMode = applyCommand(liveReviewPlay.state, answerModeCommand(liveReviewPlay.state, 'truth-live-mode', 'TYPE'));
  assert.equal(liveReviewMode.ok, true);
  const liveReviewFailure = applyCommand(liveReviewMode.state, markAnsweredLiveCommand(liveReviewMode.state, 'truth-live-cache'));
  assert.equal(liveReviewFailure.ok, false);
  assert.equal(liveReviewFailure.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const liveReviewReplay = applyCommand(liveReviewFailure.state, markAnsweredLiveCommand(liveReviewFailure.state, 'truth-live-cache', 'player-1', liveReviewFailure.state.revision));
  assert.equal(liveReviewReplay.ok, false);
  assert.equal(liveReviewReplay.idempotentReplay, true);
  const liveReviewCollision = applyCommand(liveReviewFailure.state, markAnsweredLiveCommand(liveReviewFailure.state, 'truth-live-cache', 'player-2', liveReviewFailure.state.revision));
  assert.equal(liveReviewCollision.ok, false);
  assert.equal(liveReviewCollision.error?.code, 'COMMAND_ID_COLLISION');

  const choiceState = baseState(3);
  choiceState.currentPlayerId = 'player-1';
  setTopDiscard(choiceState, makeCard('starter-choice', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(choiceState, {
    'player-1': [makeCard('truth-card-choice', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('other-2-choice', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3-choice', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const choicePrompt = [socialPrompt('truth-choice-cache', 'truth', 'current', { text: 'truth choice prompt', options: ['alpha', 'beta'] })];
  const choicePlay = applyCommand(choiceState, playCommand(choiceState, 'truth-choice-play', 'truth-card-choice'), socialContext(choicePrompt));
  const choiceMode = applyCommand(choicePlay.state, answerModeCommand(choicePlay.state, 'truth-choice-mode', 'CHOOSE'));
  assert.equal(choiceMode.ok, true);
  const choiceFailure = applyCommand(choiceMode.state, submitChoiceCommand(choiceMode.state, 'truth-choice-cache', 'gamma'));
  assert.equal(choiceFailure.ok, false);
  assert.equal(choiceFailure.error?.code, 'INVALID_SOCIAL_RESPONSE');
  const choiceReplay = applyCommand(choiceFailure.state, submitChoiceCommand(choiceFailure.state, 'truth-choice-cache', 'gamma', 'player-1', choiceFailure.state.revision));
  assert.equal(choiceReplay.ok, false);
  assert.equal(choiceReplay.idempotentReplay, true);
});

test('Answer mode and review fingerprints include payload changes for idempotency safety', () => {
  const state = baseState(3);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('other-2', 'number', { color: 'cyan', value: 5, symbol: '5' })],
    'player-3': [makeCard('other-3', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const prompt = socialPrompt('truth-fingerprint', 'truth', 'current', { text: 'truth fingerprint prompt', options: ['alpha', 'beta'] });
  const playResult = applyCommand(state, playCommand(state, 'truth-fingerprint-play', 'truth-card'), socialContext([prompt]));
  assert.equal(playResult.ok, true);

  const firstMode = applyCommand(playResult.state, answerModeCommand(playResult.state, 'truth-mode-fingerprint', 'CHOOSE'));
  assert.equal(firstMode.ok, true);
  const replayMode = applyCommand(firstMode.state, answerModeCommand(firstMode.state, 'truth-mode-fingerprint', 'CHOOSE', 'player-1', firstMode.state.revision));
  assert.equal(replayMode.ok, true);
  assert.equal(replayMode.idempotentReplay, true);
  const collidingMode = applyCommand(firstMode.state, answerModeCommand(firstMode.state, 'truth-mode-fingerprint', 'ANSWERED_LIVE', 'player-1', firstMode.state.revision));
  assert.equal(collidingMode.ok, false);
  assert.equal(collidingMode.error?.code, 'COMMAND_ID_COLLISION');

  const firstReview = applyCommand(firstMode.state, reviewAnswerCommand(firstMode.state, 'truth-review-fingerprint', { choice: 'alpha' }));
  assert.equal(firstReview.ok, true);
  const replayReview = applyCommand(firstReview.state, reviewAnswerCommand(firstReview.state, 'truth-review-fingerprint', { choice: 'alpha' }, 'player-1', firstReview.state.revision));
  assert.equal(replayReview.ok, true);
  assert.equal(replayReview.idempotentReplay, true);
  const replayReviewWithCompletionOnly = applyCommand(firstReview.state, reviewAnswerCommand(firstReview.state, 'truth-review-fingerprint', { choice: 'alpha', completionOnly: true }, 'player-1', firstReview.state.revision));
  assert.equal(replayReviewWithCompletionOnly.ok, false);
  assert.equal(replayReviewWithCompletionOnly.error?.code, 'COMMAND_ID_COLLISION');
  const collidingReview = applyCommand(firstReview.state, reviewAnswerCommand(firstReview.state, 'truth-review-fingerprint', { choice: 'beta' }, 'player-1', firstReview.state.revision));
  assert.equal(collidingReview.ok, false);
  assert.equal(collidingReview.error?.code, 'COMMAND_ID_COLLISION');
});

test('turn timeout starts from the authored deadline and only resolves once the deadline is reached', () => {
  const state = baseState(2, 1000);
  assert.equal(state.timer?.purpose, 'TURN');
  assert.equal(state.timer?.ownerPlayerId, 'player-1');

  const earlyNow = state.timer!.deadlineAt - 1;
  const earlyCommand = timeoutTurnCommand(state, 'turn-timeout-early');
  const early = applyCommand(state, earlyCommand, { now: earlyNow });
  assert.equal(early.ok, false);
  assert.equal(early.error?.code, 'TIMEOUT_NOT_REACHED');

  const earlyReplay = applyCommand(early.state, earlyCommand, { now: earlyNow });
  assert.equal(earlyReplay.ok, false);
  assert.equal(earlyReplay.idempotentReplay, true);

  const collision = applyCommand(early.state, timeoutTurnCommand(early.state, 'turn-timeout-early', 'player-2', early.state.revision), { now: earlyNow });
  assert.equal(collision.ok, false);
  assert.equal(collision.error?.code, 'COMMAND_ID_COLLISION');

  const successCommand = timeoutTurnCommand(state, 'turn-timeout-success');
  const success = applyCommand(state, successCommand, { now: state.timer!.deadlineAt });
  assert.equal(success.ok, true);
  assert.equal(success.state.currentPlayerId, 'player-2');
  assert.equal(success.state.timer?.purpose, 'TURN');
  assert.equal(success.state.timer?.ownerPlayerId, 'player-2');
  assert.equal(success.events.some(event => event.type === 'TURN_TIMED_OUT'), true);
  assert.equal(success.events.some(event => event.type === 'TURN_ADVANCED'), true);

  const successReplay = applyCommand(success.state, successCommand, { now: state.timer!.deadlineAt });
  assert.equal(successReplay.ok, true);
  assert.equal(successReplay.idempotentReplay, true);
});

test('truth answer timeout stays replay-safe and still delays the final-card win boundary', () => {
  const state = baseState(2, 1000);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter-truth-timeout', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' })],
    'player-2': [makeCard('spare-card', 'number', { color: 'cyan', value: 5, symbol: '5' })]
  });

  const prompt = socialPrompt('truth-timeout', 'truth', 'current', { text: 'truth timeout prompt', groupSizeMin: 2, groupSizeMax: 2 });
  const playResult = applyCommand(state, playCommand(state, 'truth-timeout-play', 'truth-card'), socialContext([prompt], {}, undefined, 1000));
  assert.equal(playResult.ok, true);
  assert.equal(playResult.state.timer?.purpose, 'SOCIAL');

  const earlyNow = playResult.state.timer!.deadlineAt - 1;
  const earlyCommand = timeoutSocialCommand(playResult.state, 'truth-timeout-early');
  const early = applyCommand(playResult.state, earlyCommand, { now: earlyNow });
  assert.equal(early.ok, false);
  assert.equal(early.error?.code, 'TIMEOUT_NOT_REACHED');

  const earlyReplay = applyCommand(early.state, earlyCommand, { now: earlyNow });
  assert.equal(earlyReplay.ok, false);
  assert.equal(earlyReplay.idempotentReplay, true);

  const collision = applyCommand(early.state, timeoutSocialCommand(early.state, 'truth-timeout-early', 'player-2', early.state.revision), { now: earlyNow });
  assert.equal(collision.ok, false);
  assert.equal(collision.error?.code, 'COMMAND_ID_COLLISION');

  const successCommand = timeoutSocialCommand(playResult.state, 'truth-timeout-success');
  const success = applyCommand(playResult.state, successCommand, { now: playResult.state.timer!.deadlineAt });
  assert.equal(success.ok, true);
  assert.equal(success.state.status, 'FINISHED');
  assert.equal(success.state.winnerId, 'player-1');
  assert.equal(success.state.social, null);
  assert.equal(success.events.some(event => event.type === 'SOCIAL_TIMED_OUT'), true);
  assert.equal(success.events.some(event => event.type === 'GAME_WON'), true);

  const successReplay = applyCommand(success.state, successCommand, { now: playResult.state.timer!.deadlineAt });
  assert.equal(successReplay.ok, true);
  assert.equal(successReplay.idempotentReplay, true);
});

test('answer completion before deadline invalidates the old social timeout', () => {
  const state = baseState(2, 1000);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter-live-timeout', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' }), makeCard('spare-card', 'number', { color: 'cyan', value: 6, symbol: '6' })],
    'player-2': [makeCard('other-card', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const prompt = socialPrompt('truth-answered-live', 'truth', 'current', { text: 'truth answered live prompt', groupSizeMin: 2, groupSizeMax: 2 });
  const playResult = applyCommand(state, playCommand(state, 'truth-answered-live-play', 'truth-card'), socialContext([prompt], {}, undefined, 1000));
  assert.equal(playResult.ok, true);
  const modeResult = applyCommand(playResult.state, answerModeCommand(playResult.state, 'truth-answered-live-mode', 'ANSWERED_LIVE'));
  assert.equal(modeResult.ok, true);
  const markResult = applyCommand(modeResult.state, markAnsweredLiveCommand(modeResult.state, 'truth-answered-live-mark'), { now: 2000 });
  assert.equal(markResult.ok, true);
  assert.equal(markResult.state.currentPlayerId, 'player-2');
  assert.equal(markResult.state.timer?.purpose, 'TURN');

  const staleTimeout = applyCommand(markResult.state, timeoutSocialCommand(markResult.state, 'truth-answered-live-timeout', 'player-1', markResult.state.revision), { now: playResult.state.timer!.deadlineAt });
  assert.equal(staleTimeout.ok, false);
  assert.equal(staleTimeout.error?.code, 'STALE_TIMEOUT');
});

test('pass resolution invalidates the old social timeout and starts the next turn timer', () => {
  const state = baseState(2, 1000);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter-pass-timeout', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' }), makeCard('spare-card', 'number', { color: 'cyan', value: 6, symbol: '6' })],
    'player-2': [makeCard('other-card', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const prompt = socialPrompt('truth-pass-timeout', 'truth', 'current', { text: 'truth pass prompt', groupSizeMin: 2, groupSizeMax: 2 });
  const playResult = applyCommand(state, playCommand(state, 'truth-pass-play', 'truth-card'), socialContext([prompt], {}, undefined, 1000));
  assert.equal(playResult.ok, true);
  const passResult = applyCommand(playResult.state, passCommand(playResult.state, 'truth-pass-command'), { now: 2000 });
  assert.equal(passResult.ok, true);
  assert.equal(passResult.state.currentPlayerId, 'player-2');
  assert.equal(passResult.state.timer?.purpose, 'TURN');

  const staleTimeout = applyCommand(passResult.state, timeoutSocialCommand(passResult.state, 'truth-pass-timeout', 'player-1', passResult.state.revision), { now: playResult.state.timer!.deadlineAt });
  assert.equal(staleTimeout.ok, false);
  assert.equal(staleTimeout.error?.code, 'STALE_TIMEOUT');
});

test('rewind starts a fresh timer and the old deadline cannot resolve the replacement prompt', () => {
  const state = baseState(2, 1000);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter-rewind-timeout', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('truth-card', 'truth', { symbol: 'truth', color: 'orange' }), makeCard('spare-card', 'number', { color: 'cyan', value: 6, symbol: '6' })],
    'player-2': [makeCard('other-card', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const promptPool = [
    socialPrompt('rewind-prompt-a', 'truth', 'current', { text: 'rewind prompt a', groupSizeMin: 2, groupSizeMax: 2 }),
    socialPrompt('rewind-prompt-b', 'truth', 'current', { text: 'rewind prompt b', groupSizeMin: 2, groupSizeMax: 2 })
  ];
  const playResult = applyCommand(state, playCommand(state, 'truth-rewind-play', 'truth-card'), socialContext(promptPool, {}, undefined, 1000));
  assert.equal(playResult.ok, true);

  const rewindResult = applyCommand(playResult.state, rewindCommand(playResult.state, 'truth-rewind-command'), socialContext(promptPool, {}, undefined, 2000));
  assert.equal(rewindResult.ok, true);
  assert.equal(rewindResult.state.timer?.purpose, 'SOCIAL');
  assert.equal(rewindResult.state.timer?.startedAtRevision, rewindResult.state.revision);
  assert.equal(rewindResult.state.timer!.deadlineAt > playResult.state.timer!.deadlineAt, true);

  const oldDeadlineTimeout = applyCommand(rewindResult.state, timeoutSocialCommand(rewindResult.state, 'truth-rewind-old-timeout', 'player-1', rewindResult.state.revision), { now: playResult.state.timer!.deadlineAt });
  assert.equal(oldDeadlineTimeout.ok, false);
  assert.equal(oldDeadlineTimeout.error?.code, 'TIMEOUT_NOT_REACHED');

  const freshTimeoutCommand = timeoutSocialCommand(rewindResult.state, 'truth-rewind-fresh-timeout');
  const freshTimeout = applyCommand(rewindResult.state, freshTimeoutCommand, { now: rewindResult.state.timer!.deadlineAt });
  assert.equal(freshTimeout.ok, true);
  assert.equal(freshTimeout.events.some(event => event.type === 'SOCIAL_TIMED_OUT'), true);
});

test('duel timeout resolves both pre-target and post-target reaction states without inventing a winner', () => {
  const promptPool = [socialPrompt('duel-timeout', 'duel', 'specific', { text: 'duel timeout prompt', options: ['alpha', 'beta'] })];

  const preState = baseState(3, 1000);
  preState.currentPlayerId = 'player-1';
  setTopDiscard(preState, makeCard('starter-duel-pre', 'number', { color: 'cyan', value: 4, symbol: '4' }));
  setHands(preState, {
    'player-1': [makeCard('duel-card-pre', 'duel', { symbol: 'duel', color: 'cyan' }), makeCard('spare-pre', 'number', { color: 'cyan', value: 6, symbol: '6' })],
    'player-2': [makeCard('nope-pre', 'nope', { symbol: 'nope', color: 'cyan' })],
    'player-3': [makeCard('spare-three', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const prePlay = applyCommand(preState, playCommand(preState, 'duel-pre-play', 'duel-card-pre'), socialContext(promptPool, {}, undefined, 1000));
  assert.equal(prePlay.ok, true);
  const preTimeout = applyCommand(prePlay.state, timeoutSocialCommand(prePlay.state, 'duel-pre-timeout'), { now: prePlay.state.timer!.deadlineAt });
  assert.equal(preTimeout.ok, true);
  assert.equal(preTimeout.state.social, null);
  assert.equal(preTimeout.state.winnerId, null);
  assert.equal(preTimeout.state.currentPlayerId, 'player-2');

  const postState = baseState(3, 1000);
  postState.currentPlayerId = 'player-1';
  setTopDiscard(postState, makeCard('starter-duel-post', 'number', { color: 'cyan', value: 4, symbol: '4' }));
  setHands(postState, {
    'player-1': [makeCard('duel-card-post', 'duel', { symbol: 'duel', color: 'cyan' }), makeCard('spare-post', 'number', { color: 'cyan', value: 6, symbol: '6' })],
    'player-2': [makeCard('nope-post', 'nope', { symbol: 'nope', color: 'cyan' })],
    'player-3': [makeCard('spare-three-post', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });
  const postPlay = applyCommand(postState, playCommand(postState, 'duel-post-play', 'duel-card-post'), socialContext(promptPool, {}, undefined, 1000));
  assert.equal(postPlay.ok, true);
  const postTarget = applyCommand(postPlay.state, selectDuelTargetCommand(postPlay.state, 'duel-post-target', 'player-2'), socialContext(promptPool, {}, undefined, 1000));
  assert.equal(postTarget.ok, true);
  assert.equal(Boolean(postTarget.state.social?.pendingReaction), true);

  const postEarly = applyCommand(postTarget.state, timeoutSocialCommand(postTarget.state, 'duel-post-timeout'), { now: postTarget.state.timer!.deadlineAt - 1 });
  assert.equal(postEarly.ok, false);
  assert.equal(postEarly.error?.code, 'TIMEOUT_NOT_REACHED');

  const postTimeout = applyCommand(postTarget.state, timeoutSocialCommand(postTarget.state, 'duel-post-timeout-success'), { now: postTarget.state.timer!.deadlineAt });
  assert.equal(postTimeout.ok, true);
  assert.equal(postTimeout.state.social, null);
  assert.equal(postTimeout.state.winnerId, null);
  assert.equal(postTimeout.state.currentPlayerId, 'player-2');
  assert.equal(postTimeout.events.some(event => event.type === 'SOCIAL_TIMED_OUT'), true);
});

test('chaos timeout preserves completed records and resolves the remaining players once', () => {
  const state = baseState(3, 1000);
  state.currentPlayerId = 'player-1';
  setTopDiscard(state, makeCard('starter-chaos-timeout', 'number', { color: 'orange', value: 2, symbol: '2' }));
  setHands(state, {
    'player-1': [makeCard('chaos-card', 'chaos', { symbol: 'chaos', color: 'orange' })],
    'player-2': [makeCard('spare-two', 'number', { color: 'cyan', value: 6, symbol: '6' })],
    'player-3': [makeCard('spare-three', 'number', { color: 'lime', value: 9, symbol: '9' })]
  });

  const prompt = socialPrompt('chaos-timeout', 'chaos', 'all', { text: 'chaos timeout prompt', options: ['alpha', 'beta'] });
  const playResult = applyCommand(state, playCommand(state, 'chaos-timeout-play', 'chaos-card'), socialContext([prompt], {}, undefined, 1000));
  assert.equal(playResult.ok, true);

  const modeResult = applyCommand(playResult.state, answerModeCommand(playResult.state, 'chaos-timeout-mode', 'CHOOSE'));
  assert.equal(modeResult.ok, true);
  const choiceResult = applyCommand(modeResult.state, submitChoiceCommand(modeResult.state, 'chaos-timeout-submit', 'alpha'));
  assert.equal(choiceResult.ok, true);
  assert.equal(choiceResult.state.social?.completionRecords['player-1']?.status, 'SUBMITTED');

  const timeoutCommand = timeoutSocialCommand(choiceResult.state, 'chaos-timeout-final');
  const timeoutResult = applyCommand(choiceResult.state, timeoutCommand, { now: choiceResult.state.timer!.deadlineAt });
  assert.equal(timeoutResult.ok, true);
  assert.equal(timeoutResult.state.status, 'FINISHED');
  assert.equal(timeoutResult.state.winnerId, 'player-1');
  assert.equal(timeoutResult.state.social, null);
  assert.equal(timeoutResult.events.some(event => event.type === 'SOCIAL_TIMED_OUT'), true);
  assert.equal(timeoutResult.events.some(event => event.type === 'GAME_WON'), true);

  const replay = applyCommand(timeoutResult.state, timeoutCommand, { now: choiceResult.state.timer!.deadlineAt });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotentReplay, true);
});

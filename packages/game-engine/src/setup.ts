import type { Card, GameConfig, GameConfigInput, GameEvent, GamePlayerSetup, GameState, GameTransition, Player } from '@cribbit/contracts';
import { createEngineError } from './errors.ts';
import { buildCoreDeck } from './deck.ts';
import type { RandomSource } from './rng.ts';
import { createSeededRandom, toSeedString } from './rng.ts';
import { makeEvent } from './events.ts';
import { startTimer } from './timer.ts';

const DEFAULT_CONFIG: Omit<GameConfig, 'seed'> = {
  startingHandCount: 7,
  drawPenalty: 2,
  drawPenaltySkipsTurn: false,
  allowVoluntaryDraw: false,
  startingDirection: 1,
  startingPlayerIndex: 0,
  initialDiscardStrategy: 'FIRST_NUMBER_CARD',
  contentWorld: 'UNDER_18_CLEAN',
  turnTimeoutMs: 40_000,
  socialTimeoutMs: 45_000
};

function resolveConfig(input: GameConfigInput): GameConfig {
  return {
    seed: input.seed,
    startingHandCount: input.startingHandCount ?? DEFAULT_CONFIG.startingHandCount,
    drawPenalty: input.drawPenalty ?? DEFAULT_CONFIG.drawPenalty,
    drawPenaltySkipsTurn: input.drawPenaltySkipsTurn ?? DEFAULT_CONFIG.drawPenaltySkipsTurn,
    allowVoluntaryDraw: input.allowVoluntaryDraw ?? DEFAULT_CONFIG.allowVoluntaryDraw,
    startingDirection: input.startingDirection ?? DEFAULT_CONFIG.startingDirection,
    startingPlayerIndex: input.startingPlayerIndex ?? DEFAULT_CONFIG.startingPlayerIndex,
    initialDiscardStrategy: input.initialDiscardStrategy ?? DEFAULT_CONFIG.initialDiscardStrategy,
    contentWorld: input.contentWorld ?? DEFAULT_CONFIG.contentWorld,
    turnTimeoutMs: input.turnTimeoutMs ?? DEFAULT_CONFIG.turnTimeoutMs,
    socialTimeoutMs: input.socialTimeoutMs ?? DEFAULT_CONFIG.socialTimeoutMs
  };
}

function validatePlayers(players: readonly GamePlayerSetup[]): ReturnType<typeof createEngineError> | null {
  if (players.length < 2 || players.length > 10) {
    return createEngineError('INVALID_PLAYER_COUNT', 'Cribbit CHAOS supports 2 through 10 players.', { playerCount: players.length });
  }
  const ids = new Set<string>();
  for (const player of players) {
    if (ids.has(player.id)) {
      return createEngineError('DUPLICATE_PLAYER_ID', 'Each player must have a unique id.', { playerId: player.id });
    }
    ids.add(player.id);
  }
  return null;
}

function createPlayers(players: readonly GamePlayerSetup[]): Player[] {
  return players.map((player, index) => ({
    id: player.id,
    seat: Number.isInteger(player.seat) ? Number(player.seat) : index,
    status: player.status ?? 'ACTIVE',
    hand: []
  }));
}

function pickStarterCard(deck: Card[], strategy: GameConfig['initialDiscardStrategy']): Card {
  if (strategy === 'TOP_SHUFFLED_CARD') {
    const starter = deck.pop();
    if (!starter) {
      throw createEngineError('INVALID_SETUP', 'The deck did not contain a valid starter card.');
    }
    return starter;
  }

  let starterIndex = deck.findIndex(card => card.kind === 'number');
  if (starterIndex < 0) starterIndex = deck.length - 1;
  const [starter] = deck.splice(starterIndex, 1);
  if (!starter) {
    throw createEngineError('INVALID_SETUP', 'The deck did not contain a valid starter card.');
  }
  return starter;
}

export function createGame(
  config: GameConfigInput,
  players: readonly GamePlayerSetup[],
  rng: RandomSource = createSeededRandom(config.seed),
  context: { now?: number } = {}
): GameTransition<GameState> {
  const validationError = validatePlayers(players);
  if (validationError) {
    return { ok: false, state: undefined as never, events: [], error: validationError };
  }
  const resolvedConfig = resolveConfig(config);
  const gameId = `game-${toSeedString(resolvedConfig.seed)}`;
  const nextPlayers = createPlayers(players);
  const deck = buildCoreDeck(resolvedConfig.seed, rng);
  const dealtHands: Record<string, readonly string[]> = {};

  for (const player of nextPlayers) {
    player.hand = deck.splice(0, resolvedConfig.startingHandCount);
    dealtHands[player.id] = player.hand.map(card => card.id);
  }

  const starter = pickStarterCard(deck, resolvedConfig.initialDiscardStrategy);
  const startingPlayerIndex = ((resolvedConfig.startingPlayerIndex % nextPlayers.length) + nextPlayers.length) % nextPlayers.length;
  const currentPlayerId = nextPlayers[startingPlayerIndex]?.id ?? nextPlayers[0].id;
  const state: GameState = {
    id: gameId,
    revision: 0,
    status: 'ACTIVE',
    phase: 'PLAY_DRAW',
    config: resolvedConfig,
    players: nextPlayers,
    drawPile: deck,
    discardPile: [starter],
    currentPlayerId,
    direction: resolvedConfig.startingDirection,
    activeColor: starter.color || null,
    activeSymbol: starter.kind === 'number' ? String(starter.value ?? 0) : starter.symbol ?? starter.kind,
    pendingEffect: null,
    timer: null,
    social: null,
    winnerId: null,
    rewindUsedByPlayerIds: [],
    processedCommands: {}
  };

  startTimer(state, 'TURN', currentPlayerId, context.now, state.revision);

  const events: GameEvent[] = [
    makeEvent(state, 'GAME_CREATED', {
      gameId: state.id,
      playerCount: state.players.length,
      startingHandCount: resolvedConfig.startingHandCount,
      currentPlayerId,
      direction: state.direction,
      activeColor: state.activeColor,
      activeSymbol: state.activeSymbol
    }),
    ...state.players.map((player, index) =>
      makeEvent(state, 'CARD_DEALT', {
        playerId: player.id,
        seat: player.seat,
        cardIds: dealtHands[player.id],
        handCount: player.hand.length
      }, index, 'PLAYER_PRIVATE', [player.id])
    )
  ];

  return { ok: true, state, events };
}

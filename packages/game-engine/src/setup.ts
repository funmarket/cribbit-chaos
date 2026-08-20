import type { Card, GameConfig, GameConfigInput, GameEvent, GamePlayerSetup, GameState, GameTransition, Player } from '@cribbit/contracts';
import { createEngineError } from './errors.ts';
import { buildCoreDeck } from './deck.ts';
import type { RandomSource } from './rng.ts';
import { createSeededRandom, toSeedString } from './rng.ts';
import { makeEvent } from './events.ts';
import { startTimer } from './timer.ts';
import { createAdaptiveProbabilityState, dealAdaptiveOpeningHands } from './adaptive-distribution.ts';

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

/**
 * Starter selection keeps its existing deterministic setup contract, but the chosen
 * card is reserved before the constrained opening dealer runs. This prevents the
 * adaptive dealer from accidentally consuming the starter and lets opening hands
 * vary without changing the initial-discard strategy.
 */
function reserveStarterCard(
  deck: Card[],
  strategy: GameConfig['initialDiscardStrategy'],
  openingCardCount: number
): Card {
  const candidateStart = Math.min(Math.max(0, openingCardCount), Math.max(0, deck.length - 1));
  const candidateZone = deck.slice(candidateStart);

  let candidate: Card | undefined;
  if (strategy === 'TOP_SHUFFLED_CARD') {
    candidate = candidateZone.at(-1) ?? deck.at(-1);
  } else {
    candidate = candidateZone.find(card => card.kind === 'number')
      ?? candidateZone.at(-1)
      ?? deck.find(card => card.kind === 'number')
      ?? deck.at(-1);
  }

  if (!candidate) {
    throw createEngineError('INVALID_SETUP', 'The deck did not contain a valid starter card.');
  }

  const index = deck.findIndex(card => card.id === candidate!.id);
  if (index < 0) {
    throw createEngineError('INVALID_SETUP', 'The reserved starter card was not present in the physical deck.');
  }
  const [starter] = deck.splice(index, 1);
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
  const canonicalDeck = buildCoreDeck(resolvedConfig.seed, rng);
  const starter = reserveStarterCard(
    canonicalDeck,
    resolvedConfig.initialDiscardStrategy,
    nextPlayers.length * resolvedConfig.startingHandCount
  );
  const openingDeal = dealAdaptiveOpeningHands(
    canonicalDeck,
    nextPlayers.length,
    resolvedConfig.startingHandCount,
    createSeededRandom(`${toSeedString(resolvedConfig.seed)}:opening`)
  );
  const deck = openingDeal.remainingDeck;
  const dealtHands: Record<string, readonly string[]> = {};

  for (let index = 0; index < nextPlayers.length; index += 1) {
    const player = nextPlayers[index];
    player.hand = openingDeal.hands[index] ?? [];
    dealtHands[player.id] = player.hand.map(card => card.id);
  }

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
    processedCommands: {},
    adaptiveProbability: createAdaptiveProbabilityState()
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
      activeSymbol: state.activeSymbol,
      distribution: 'CHAOS_PULSE_ADAPTIVE_V1'
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

/**
 * What this does: ephemeral Local QA Simulation for the Web client. It drives the
 * shared packages/game-engine against in-memory state so gameplay and rule work can
 * continue without a server, a room or a database.
 * Key invariant: every transition goes through the shared engine (applyCommand) and
 * the shared bot policy (chooseBotOption); this module owns no rules, no deck and no
 * persistence, and it never calls the Live API.
 * Explicitly out of scope: PostgreSQL persistence, Live room/session creation,
 * fabricated Live users, and the known special-card interaction stall.
 */
import type {
  CardColor,
  GameCommand,
  GameState,
  GameTransition,
} from '../../../packages/contracts/src/index.ts';
import { applyCommand, chooseBotOption, createGame } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';

export interface WebSimulationPlayer {
  readonly id: string;
  readonly name: string;
  readonly isHuman: boolean;
}

export type WebSimulationCommand<T = GameCommand> = T extends GameCommand
  ? Omit<T, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>
  : never;

export interface WebSimulationConfig {
  readonly playerCount: number;
  readonly profileName?: string;
  readonly world?: 'clean' | 'adult';
  readonly ceiling?: number;
  readonly sources?: Readonly<Record<string, boolean>>;
  readonly seed?: string;
}

export interface WebSimulationSession {
  readonly humanPlayerId: string;
  readonly players: readonly WebSimulationPlayer[];
  getState(): GameState;
  playCard(cardId: string): GameTransition<GameState>;
  drawCard(): GameTransition<GameState>;
  selectWildColor(color: CardColor): GameTransition<GameState>;
  send(command: WebSimulationCommand): GameTransition<GameState>;
  subscribe(listener: () => void): () => void;
}

const HUMAN_PLAYER_ID = 'web-sim-human';
const MAX_AUTOMATED_STEPS = 100;

function createPlayers(config: WebSimulationConfig): WebSimulationPlayer[] {
  const count = Math.max(2, Math.round(config.playerCount));
  const profileName = config.profileName?.trim() || 'You';
  return Array.from({ length: count }, (_unused, index) => ({
    id: index === 0 ? HUMAN_PLAYER_ID : `web-sim-player-${index + 1}`,
    name: index === 0 ? profileName : `Player ${index + 1}`,
    isHuman: index === 0,
  }));
}

function simulationSeed(config: WebSimulationConfig, players: readonly WebSimulationPlayer[]): string {
  if (config.seed) return config.seed;
  return [
    'web-local-simulation-v1',
    players.length,
    config.world ?? 'clean',
    config.ceiling ?? 3,
  ].join('|');
}

/**
 * Create a local QA simulation: engine-dealt hands, bots driven by the shared bot
 * policy, and no persistence of any kind.
 */
export function createWebSimulation(config: WebSimulationConfig): WebSimulationSession {
  const players = createPlayers(config);
  const created = createGame(
    {
      seed: simulationSeed(config, players),
      startingHandCount: 7,
      startingPlayerIndex: 0,
      allowVoluntaryDraw: true,
      contentWorld: config.world === 'adult' ? '18+_ADULT' : 'UNDER_18_CLEAN',
    },
    players.map((player, seat) => ({ id: player.id, seat })),
    undefined,
    { now: Date.now() },
  );

  if (!created.ok) {
    throw created.error ?? new Error('Unable to create the local QA simulation.');
  }

  let state = created.state;
  let commandSequence = 0;
  const listeners = new Set<() => void>();
  const promptPool = promptPoolForSources(config.sources);

  function isBotPlayerId(playerId: string): boolean {
    return playerId !== HUMAN_PLAYER_ID;
  }

  function commandId(type: GameCommand['type'], playerId: string): string {
    commandSequence += 1;
    return `${state.id}:websim:${state.revision}:${playerId}:${type}:${commandSequence}`;
  }

  function context() {
    return {
      now: Date.now(),
      promptPool,
      promptProfile: {
        stage: Number.MAX_SAFE_INTEGER,
        intensity: config.ceiling ?? 3,
        language: '*',
        callSuitability: '*',
      },
    };
  }

  function applyEngine(command: GameCommand): GameTransition<GameState> {
    const transition = applyCommand(state, command, context());
    state = transition.state;
    return transition;
  }

  function botCandidateIds(): string[] {
    if (state.pendingEffect?.type === 'WILD_COLOR') {
      return isBotPlayerId(state.pendingEffect.playerId) ? [state.pendingEffect.playerId] : [];
    }
    if (state.social) return state.players.map(player => player.id).filter(isBotPlayerId);
    return state.currentPlayerId && isBotPlayerId(state.currentPlayerId) ? [state.currentPlayerId] : [];
  }

  /** Bot turns run on the shared bot policy; a bot that cannot decide stops the loop. */
  function runAutomatedTurns(): void {
    let steps = 0;
    while (state.status === 'ACTIVE' && steps < MAX_AUTOMATED_STEPS) {
      steps += 1;
      const beforeRevision = state.revision;
      let advanced = false;

      for (const playerId of botCandidateIds()) {
        const decision = chooseBotOption(state, playerId, undefined, { isBotPlayerId });
        if (decision.kind !== 'command') continue;
        const transition = applyEngine({
          ...decision.option.command,
          commandId: commandId(decision.option.command.type, playerId),
          playerId,
          expectedRevision: state.revision,
          sessionId: state.id,
        } as GameCommand);
        if (!transition.ok) return;
        advanced = true;
        break;
      }

      if (!advanced || state.revision === beforeRevision) return;
    }
  }

  function notify(): void {
    listeners.forEach(listener => listener());
  }

  function apply(command: GameCommand): GameTransition<GameState> {
    const transition = applyEngine(command);
    if (transition.ok) runAutomatedTurns();
    notify();
    return { ...transition, state };
  }

  function send(command: WebSimulationCommand): GameTransition<GameState> {
    return apply({
      ...command,
      commandId: commandId(command.type, HUMAN_PLAYER_ID),
      playerId: HUMAN_PLAYER_ID,
      expectedRevision: state.revision,
      sessionId: state.id,
    } as GameCommand);
  }

  runAutomatedTurns();

  return {
    humanPlayerId: HUMAN_PLAYER_ID,
    players,
    getState: () => state,
    playCard: cardId => send({ type: 'PLAY_CARD', cardId }),
    drawCard: () => send({ type: 'DRAW_CARD' }),
    selectWildColor: color => send({ type: 'SELECT_WILD_COLOR', color }),
    send,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

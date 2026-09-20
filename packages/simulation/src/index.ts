/**
 * What this does: the single shared Local QA Simulation orchestrator. Both frontends run
 * their local simulation through it, so orchestration is written once while presentation
 * stays platform-specific.
 * Key invariant: every transition is decided by the shared packages/game-engine
 * (createGame / applyCommand / chooseBotOption). This module owns no legality, turn,
 * penalty, prompt-resolution or winner rule, and it never touches the API, a database,
 * a room, Socket.IO or any persistent store.
 * Explicitly out of scope: platform presentation, Live rooms/sessions and persistence.
 */
import type {
  Card,
  CardColor,
  CardKind,
  GameCommand,
  GameState,
  GameTransition,
} from '../../../packages/contracts/src/index.ts';
import { applyCommand, chooseBotOption, createGame } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';

export type SimulationCommand<T = GameCommand> = T extends GameCommand
  ? Omit<T, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>
  : never;

/** Explicit normalized input. Clients map their own setup into this; no DOM, no UI state. */
export interface SimulationConfig {
  /** Simulated seats; seat 0 is the human. */
  readonly playerCount: number;
  readonly humanDisplayName?: string;
  readonly world?: 'clean' | 'adult';
  readonly ceiling?: number;
  readonly sources?: Readonly<Record<string, boolean>>;
  /** Install the canonical QA fixture hand for the human (fixture-only inventory). */
  readonly qaHand?: boolean;
  /** QA escape hatch that overrides the normalized deterministic seed. */
  readonly seed?: string;
}

export interface SimulationPlayer {
  readonly id: string;
  readonly name: string;
  readonly isHuman: boolean;
}

export interface SimulationSession {
  readonly humanPlayerId: string;
  readonly players: readonly SimulationPlayer[];
  getState(): GameState;
  playCard(cardId: string): GameTransition<GameState>;
  drawCard(): GameTransition<GameState>;
  selectWildColor(color: CardColor): GameTransition<GameState>;
  passPrompt(): GameTransition<GameState>;
  rewindPrompt(): GameTransition<GameState>;
  flagPrompt(reasonCode?: string): GameTransition<GameState>;
  send(command: SimulationCommand): GameTransition<GameState>;
  subscribe(onUpdate: () => void): () => void;
}

export const SIMULATION_HUMAN_PLAYER_ID = 'sim-human';
export const SIMULATION_DEFAULT_HAND_SIZE = 7;
export const SIMULATION_MAX_AUTOMATED_STEPS = 100;

/** The one canonical QA fixture inventory: one card of each special family. */
export const SIMULATION_QA_HAND_KINDS: readonly CardKind[] = ['truth', 'dare', 'paranoia', 'chaos', 'duel', 'nope', 'wild'];
const QA_CARD_ID_PREFIX = 'sim-qa-';

export function simulationBotPlayerId(seat: number): string {
  return `sim-player-${seat + 1}`;
}

export function isSimulationBotPlayerId(playerId: string): boolean {
  return playerId !== SIMULATION_HUMAN_PLAYER_ID;
}

function simulationPlayers(config: SimulationConfig): SimulationPlayer[] {
  const count = Math.max(2, Math.round(config.playerCount));
  const profileName = config.humanDisplayName?.trim() || 'You';
  return Array.from({ length: count }, (_unused, index) => ({
    id: index === 0 ? SIMULATION_HUMAN_PLAYER_ID : simulationBotPlayerId(index),
    name: index === 0 ? profileName : `Player ${index + 1}`,
    isHuman: index === 0,
  }));
}

/**
 * Normalized deterministic seed: identical normalized configuration produces identical
 * engine initialization on every platform. It never changes the engine RNG itself.
 */
function simulationSeed(config: SimulationConfig, players: readonly SimulationPlayer[]): string {
  if (config.seed) return config.seed;
  return [
    'simulation-v1',
    players.length,
    config.world ?? 'clean',
    config.ceiling ?? 3,
    config.qaHand ? 'qa-hand' : 'normal-hand',
    Object.entries(config.sources ?? {}).filter(([, enabled]) => enabled).map(([source]) => source).sort().join(','),
  ].join('|');
}

/**
 * Install the canonical QA fixture hand. Fixture behaviour, not game mechanics: the cards
 * the engine already dealt go back to the draw pile and the human receives clearly
 * fixture-identified QA cards so special flows can be exercised quickly.
 */
export function installSimulationQaHand(state: GameState, humanPlayerId = SIMULATION_HUMAN_PLAYER_ID): void {
  const human = state.players.find(player => player.id === humanPlayerId);
  if (!human) return;
  state.drawPile.push(...human.hand);
  human.hand = SIMULATION_QA_HAND_KINDS.map((kind, index): Card => ({
    id: `${QA_CARD_ID_PREFIX}${kind}-${index + 1}`,
    kind,
    ...(kind === 'wild' ? { symbol: 'wild' } : { symbol: kind }),
  }));
}

export function isSimulationFixtureCardId(cardId: string): boolean {
  return cardId.startsWith(QA_CARD_ID_PREFIX);
}

/**
 * Create an ephemeral local QA simulation: engine-dealt hands, bots driven by the shared
 * bot policy, no persistence of any kind.
 */
export function createSimulation(config: SimulationConfig): SimulationSession {
  const players = simulationPlayers(config);
  const created = createGame(
    {
      seed: simulationSeed(config, players),
      startingHandCount: SIMULATION_DEFAULT_HAND_SIZE,
      startingPlayerIndex: 0,
      allowVoluntaryDraw: true,
      contentWorld: config.world === 'adult' ? '18+_ADULT' : 'UNDER_18_CLEAN',
    },
    players.map((player, seat) => ({ id: player.id, seat })),
    undefined,
    { now: Date.now() },
  );

  if (!created.ok) throw created.error ?? new Error('Unable to create the local QA simulation.');

  let state = created.state;
  if (config.qaHand) installSimulationQaHand(state);

  let commandSequence = 0;
  const promptPool = promptPoolForSources(config.sources);
  const listeners = new Set<() => void>();

  function nextCommandId(type: GameCommand['type'], playerId: string): string {
    commandSequence += 1;
    return `${state.id}:sim:${state.revision}:${playerId}:${type}:${commandSequence}`;
  }

  /** The single Simulation command envelope: commandId, playerId, expectedRevision, sessionId. */
  function envelope(playerId: string, command: SimulationCommand): GameCommand {
    return {
      ...command,
      commandId: nextCommandId(command.type, playerId),
      playerId,
      expectedRevision: state.revision,
      sessionId: state.id,
    } as GameCommand;
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
      return isSimulationBotPlayerId(state.pendingEffect.playerId) ? [state.pendingEffect.playerId] : [];
    }
    if (state.social) return state.players.map(player => player.id).filter(isSimulationBotPlayerId);
    return state.currentPlayerId && isSimulationBotPlayerId(state.currentPlayerId) ? [state.currentPlayerId] : [];
  }

  /**
   * Run eligible bot commands until the human must act. Which command is legal is decided
   * by the shared engine plus the shared bot policy; this loop only sequences them, with a
   * bounded step guard so a stall cannot become an infinite loop.
   */
  function runAutomatedTurns(): void {
    let steps = 0;
    while (state.status === 'ACTIVE' && steps < SIMULATION_MAX_AUTOMATED_STEPS) {
      steps += 1;
      const beforeRevision = state.revision;
      let advanced = false;

      for (const playerId of botCandidateIds()) {
        const decision = chooseBotOption(state, playerId, undefined, { isBotPlayerId: isSimulationBotPlayerId });
        if (decision.kind !== 'command') continue;
        const transition = applyEngine(envelope(playerId, decision.option.command as SimulationCommand));
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

  function send(command: SimulationCommand): GameTransition<GameState> {
    return apply(envelope(SIMULATION_HUMAN_PLAYER_ID, command));
  }

  runAutomatedTurns();

  return {
    humanPlayerId: SIMULATION_HUMAN_PLAYER_ID,
    players,
    getState: () => state,
    playCard: cardId => send({ type: 'PLAY_CARD', cardId } as SimulationCommand),
    drawCard: () => send({ type: 'DRAW_CARD' } as SimulationCommand),
    selectWildColor: color => send({ type: 'SELECT_WILD_COLOR', color } as SimulationCommand),
    passPrompt: () => send({ type: 'PASS_PROMPT' } as SimulationCommand),
    rewindPrompt: () => send({ type: 'REWIND_PROMPT' } as SimulationCommand),
    flagPrompt: reasonCode => send({
      type: 'FLAG_PROMPT',
      promptId: state.social?.prompt?.id ?? '',
      ...(reasonCode ? { reasonCode } : {}),
    } as SimulationCommand),
    send,
    subscribe: onUpdate => {
      listeners.add(onUpdate);
      return () => listeners.delete(onUpdate);
    },
  };
}

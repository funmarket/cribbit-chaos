import type { CardColor, GameCommand, GameState, GameTransition } from '../../../packages/contracts/src/index.ts';
import { applyCommand, createGame } from '../../../packages/game-engine/src/index.ts';
import type { TelegramBackendGame } from './backendGame.ts';
import type { TelegramRoomDraft } from './roomSetup.ts';

export interface TelegramSimulationPlayer {
  readonly id: string;
  readonly name: string;
  readonly isHuman: boolean;
}

export interface TelegramSimulation {
  readonly humanPlayerId: string;
  readonly players: readonly TelegramSimulationPlayer[];
  getState(): GameState;
  playCard(cardId: string): GameTransition<GameState>;
  drawCard(): GameTransition<GameState>;
  selectWildColor(color: CardColor): GameTransition<GameState>;
  passPrompt(): GameTransition<GameState>;
  rewindPrompt(): GameTransition<GameState>;
  flagPrompt(reasonCode?: string): GameTransition<GameState>;
  send(command: Omit<GameCommand, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>): GameTransition<GameState>;
  subscribe(onUpdate: () => void): () => void;
}

const HUMAN_PLAYER_ID = 'telegram-sim-human';

function simulationSeed(draft: TelegramRoomDraft): string {
  return [
    'telegram-simulation-v1',
    draft.mode,
    draft.playerCount,
    draft.world,
    draft.ceiling,
  ].join('|');
}

function createPlayers(draft: TelegramRoomDraft): TelegramSimulationPlayer[] {
  const profileName = draft.profileName.trim() || 'You';
  return Array.from({ length: draft.playerCount }, (_, index) => ({
    id: index === 0 ? HUMAN_PLAYER_ID : `telegram-sim-player-${index + 1}`,
    name: index === 0 ? profileName : `Player ${index + 1}`,
    isHuman: index === 0,
  }));
}

export function createTelegramSimulation(draft: TelegramRoomDraft): TelegramSimulation {
  const players = createPlayers(draft);
  const created = createGame(
    {
      seed: simulationSeed(draft),
      startingHandCount: 7,
      startingPlayerIndex: 0,
      allowVoluntaryDraw: true,
      contentWorld: draft.world === 'adult' ? '18+_ADULT' : 'UNDER_18_CLEAN',
    },
    players.map((player, seat) => ({ id: player.id, seat })),
    undefined,
    { now: Date.now() },
  );

  if (!created.ok) {
    throw created.error ?? new Error('Unable to create Telegram simulation.');
  }

  let state = created.state;
  let commandSequence = 0;
  const listeners = new Set<() => void>();

  function commandId(type: GameCommand['type'], playerId: string): string {
    commandSequence += 1;
    return `${state.id}:telegram:${state.revision}:${playerId}:${type}:${commandSequence}`;
  }

  function notify(): void {
    listeners.forEach(listener => listener());
  }

  function apply(command: GameCommand): GameTransition<GameState> {
    const transition = applyCommand(state, command, { now: Date.now() });
    state = transition.state;
    if (transition.ok) runAutomatedTurns();
    notify();
    return { ...transition, state };
  }

  function runAutomatedTurns(): void {
    const maximumTurns = Math.max(players.length * 2, 4);
    let turns = 0;

    while (
      state.status === 'ACTIVE' &&
      state.currentPlayerId !== HUMAN_PLAYER_ID &&
      !state.pendingEffect &&
      !state.social &&
      turns < maximumTurns
    ) {
      const playerId = state.currentPlayerId;
      const transition = applyCommand(
        state,
        {
          type: 'DRAW_CARD',
          commandId: commandId('DRAW_CARD', playerId),
          playerId,
          expectedRevision: state.revision,
          sessionId: state.id,
        },
        { now: Date.now() },
      );
      state = transition.state;
      if (!transition.ok) break;
      turns += 1;
    }
  }

  function humanCommand<T extends GameCommand>(command: Omit<T, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>): T {
    return {
      ...command,
      commandId: commandId(command.type, HUMAN_PLAYER_ID),
      playerId: HUMAN_PLAYER_ID,
      expectedRevision: state.revision,
      sessionId: state.id,
    } as T;
  }

  function send(command: Omit<GameCommand, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>): GameTransition<GameState> {
    return apply(humanCommand(command as never));
  }

  return {
    humanPlayerId: HUMAN_PLAYER_ID,
    players,
    getState: () => state,
    playCard: cardId => send({ type: 'PLAY_CARD', cardId } as never),
    drawCard: () => send({ type: 'DRAW_CARD' } as never),
    selectWildColor: color => send({ type: 'SELECT_WILD_COLOR', color } as never),
    passPrompt: () => send({ type: 'PASS_PROMPT' } as never),
    rewindPrompt: () => send({ type: 'REWIND_PROMPT' } as never),
    flagPrompt: reasonCode => {
      const promptId = state.social?.prompt?.id ?? '';
      return send({
        type: 'FLAG_PROMPT',
        promptId,
        ...(reasonCode ? { reasonCode } : {}),
      } as never);
    },
    send,
    subscribe: onUpdate => {
      listeners.add(onUpdate);
      return () => listeners.delete(onUpdate);
    },
  };
}

function transitionResult(transition: GameTransition<GameState>): { ok:boolean; error?:{ message:string } } {
  return transition.ok
    ? { ok:true }
    : { ok:false, error:{ message:transition.error?.message ?? 'The simulation rejected that action.' } };
}

export function createTelegramSimulationGame(draft: TelegramRoomDraft): TelegramBackendGame {
  const simulation = createTelegramSimulation(draft);
  const sessionId = simulation.getState().id;

  return {
    humanPlayerId: simulation.humanPlayerId,
    players: simulation.players,
    sessionId,
    joinCode: 'SIMULATION',
    getState: simulation.getState,
    refresh: async () => undefined,
    playCard: async cardId => transitionResult(simulation.playCard(cardId)),
    drawCard: async () => transitionResult(simulation.drawCard()),
    selectWildColor: async color => transitionResult(simulation.selectWildColor(color)),
    passPrompt: async () => transitionResult(simulation.passPrompt()),
    rewindPrompt: async () => transitionResult(simulation.rewindPrompt()),
    flagPrompt: async reasonCode => transitionResult(simulation.flagPrompt(reasonCode)),
    send: async command => transitionResult(simulation.send(command)),
    subscribe: simulation.subscribe,
  };
}

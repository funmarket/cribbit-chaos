import type { CardColor, GameCommand, GameState, GameTransition } from '../../../packages/contracts/src/index.ts';
import { applyCommand, createGame } from '../../../packages/game-engine/src/index.ts';
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

  function commandId(type: GameCommand['type'], playerId: string): string {
    commandSequence += 1;
    return `${state.id}:telegram:${state.revision}:${playerId}:${type}:${commandSequence}`;
  }

  function apply(command: GameCommand): GameTransition<GameState> {
    const transition = applyCommand(state, command, { now: Date.now() });
    state = transition.state;
    if (transition.ok) runAutomatedTurns();
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

  return {
    humanPlayerId: HUMAN_PLAYER_ID,
    players,
    getState: () => state,
    playCard: cardId => apply(humanCommand<GameCommand & { type: 'PLAY_CARD'; cardId: string }>({ type: 'PLAY_CARD', cardId })),
    drawCard: () => apply(humanCommand<GameCommand & { type: 'DRAW_CARD' }>({ type: 'DRAW_CARD' })),
    selectWildColor: color => apply(humanCommand<GameCommand & { type: 'SELECT_WILD_COLOR'; color: CardColor }>({ type: 'SELECT_WILD_COLOR', color })),
    passPrompt: () => apply(humanCommand<GameCommand & { type: 'PASS_PROMPT' }>({ type: 'PASS_PROMPT' })),
    rewindPrompt: () => apply(humanCommand<GameCommand & { type: 'REWIND_PROMPT' }>({ type: 'REWIND_PROMPT' })),
    flagPrompt: reasonCode => {
      const promptId = state.social?.prompt?.id ?? '';
      return apply(humanCommand<GameCommand & { type: 'FLAG_PROMPT'; promptId: string; reasonCode?: string }>({
        type: 'FLAG_PROMPT',
        promptId,
        ...(reasonCode ? { reasonCode } : {}),
      }));
    },
  };
}

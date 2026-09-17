import type { Card, CardColor, CardKind, GameCommand, GameState, GameTransition } from '../../../packages/contracts/src/index.ts';
import { applyCommand, chooseBotOption, createGame } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';
import type { TelegramBackendGame, TelegramGameCommand } from './backendGame.ts';
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
  send(command: TelegramGameCommand): GameTransition<GameState>;
  subscribe(onUpdate: () => void): () => void;
}

const HUMAN_PLAYER_ID = 'telegram-sim-human';
const QA_HAND_KINDS: readonly CardKind[] = ['truth','dare','paranoia','chaos','duel','nope','wild'];

function simulationSeed(draft: TelegramRoomDraft): string {
  return [
    'telegram-simulation-v3',
    draft.mode,
    draft.playerCount,
    draft.world,
    draft.ceiling,
    draft.qaHand ? 'qa-hand' : 'normal-hand',
    Object.entries(draft.sources).filter(([,enabled]) => enabled).map(([source]) => source).sort().join(','),
  ].join('|');
}

function createPlayers(draft: TelegramRoomDraft): TelegramSimulationPlayer[] {
  const profileName = draft.profileName.trim() || 'You';
  return Array.from({ length:draft.playerCount }, (_, index) => ({
    id:index === 0 ? HUMAN_PLAYER_ID : `telegram-sim-player-${index + 1}`,
    name:index === 0 ? profileName : `Player ${index + 1}`,
    isHuman:index === 0,
  }));
}

function installQaHand(state: GameState): void {
  const human = state.players.find(player => player.id === HUMAN_PLAYER_ID);
  if (!human) return;

  // Match the approved Web compatibility QA fixture: the human receives one
  // Truth, Dare, Paranoia, Chaos, Duel, Nope and Wild. The original physical
  // opening cards go back to the draw pile; QA cards are fixture-only inventory.
  state.drawPile.push(...human.hand);
  human.hand = QA_HAND_KINDS.map((kind, index): Card => ({
    id:`telegram-qa-${kind}-${index + 1}`,
    kind,
    ...(kind === 'wild' ? { symbol:'wild' } : { symbol:kind }),
  }));
}

export function createTelegramSimulation(draft: TelegramRoomDraft): TelegramSimulation {
  const players = createPlayers(draft);
  const created = createGame(
    {
      seed:simulationSeed(draft),
      startingHandCount:7,
      startingPlayerIndex:0,
      allowVoluntaryDraw:true,
      contentWorld:draft.world === 'adult' ? '18+_ADULT' : 'UNDER_18_CLEAN',
    },
    players.map((player, seat) => ({ id:player.id, seat })),
    undefined,
    { now:Date.now() },
  );

  if (!created.ok) throw created.error ?? new Error('Unable to create Telegram simulation.');

  let state = created.state;
  if (draft.qaHand) installQaHand(state);

  let commandSequence = 0;
  const listeners = new Set<() => void>();
  const promptPool = promptPoolForSources(draft.sources);

  function commandId(type: GameCommand['type'], playerId: string): string {
    commandSequence += 1;
    return `${state.id}:telegram:${state.revision}:${playerId}:${type}:${commandSequence}`;
  }

  function context() {
    return {
      now:Date.now(),
      promptPool,
      promptProfile:{
        stage:Number.MAX_SAFE_INTEGER,
        intensity:draft.ceiling,
        language:'*',
        callSuitability:'*',
      },
    };
  }

  function notify(): void { listeners.forEach(listener => listener()); }

  function commandFor(playerId: string, command: TelegramGameCommand): GameCommand {
    return {
      ...command,
      commandId:commandId(command.type, playerId),
      playerId,
      expectedRevision:state.revision,
      sessionId:state.id,
    } as GameCommand;
  }

  function applyEngine(command: GameCommand): GameTransition<GameState> {
    const transition = applyCommand(state, command, context());
    state = transition.state;
    return transition;
  }

  function isBotPlayerId(playerId: string): boolean {
    return playerId !== HUMAN_PLAYER_ID;
  }

  function candidateBotIds(): string[] {
    if (state.pendingEffect?.type === 'WILD_COLOR') {
      return isBotPlayerId(state.pendingEffect.playerId) ? [state.pendingEffect.playerId] : [];
    }
    if (state.social) return state.players.map(player => player.id).filter(isBotPlayerId);
    return state.currentPlayerId && isBotPlayerId(state.currentPlayerId) ? [state.currentPlayerId] : [];
  }

  function runAutomatedTurns(): void {
    let steps = 0;
    while (state.status === 'ACTIVE' && steps < 100) {
      steps += 1;
      const beforeRevision = state.revision;
      let advanced = false;

      for (const playerId of candidateBotIds()) {
        const decision = chooseBotOption(state, playerId, undefined, { isBotPlayerId });
        if (decision.kind !== 'command') continue;
        const transition = applyEngine({
          ...decision.option.command,
          commandId:commandId(decision.option.command.type, playerId),
          playerId,
          expectedRevision:state.revision,
          sessionId:state.id,
        } as GameCommand);
        if (!transition.ok) return;
        advanced = true;
        break;
      }

      if (!advanced || state.revision === beforeRevision) return;
    }
  }

  function apply(command: GameCommand): GameTransition<GameState> {
    const transition = applyEngine(command);
    if (transition.ok) runAutomatedTurns();
    notify();
    return { ...transition, state };
  }

  function send(command: TelegramGameCommand): GameTransition<GameState> {
    return apply(commandFor(HUMAN_PLAYER_ID, command));
  }

  runAutomatedTurns();

  return {
    humanPlayerId:HUMAN_PLAYER_ID,
    players,
    getState:() => state,
    playCard:cardId => send({ type:'PLAY_CARD', cardId }),
    drawCard:() => send({ type:'DRAW_CARD' }),
    selectWildColor:color => send({ type:'SELECT_WILD_COLOR', color }),
    passPrompt:() => send({ type:'PASS_PROMPT' }),
    rewindPrompt:() => send({ type:'REWIND_PROMPT' }),
    flagPrompt:reasonCode => send({ type:'FLAG_PROMPT', promptId:state.social?.prompt?.id ?? '', ...(reasonCode ? { reasonCode } : {}) }),
    send,
    subscribe:onUpdate => {
      listeners.add(onUpdate);
      return () => listeners.delete(onUpdate);
    },
  };
}

function transitionResult(transition: GameTransition<GameState>): { ok:boolean; error?:{ message:string } } {
  return transition.ok ? { ok:true } : { ok:false, error:{ message:transition.error?.message ?? 'The simulation rejected that action.' } };
}

export function createTelegramSimulationGame(draft: TelegramRoomDraft): TelegramBackendGame {
  const simulation = createTelegramSimulation(draft);
  const sessionId = simulation.getState().id;
  return {
    humanPlayerId:simulation.humanPlayerId,
    players:simulation.players,
    sessionId,
    joinCode:'SIMULATION',
    getState:simulation.getState,
    refresh:async () => undefined,
    playCard:async cardId => transitionResult(simulation.playCard(cardId)),
    drawCard:async () => transitionResult(simulation.drawCard()),
    selectWildColor:async color => transitionResult(simulation.selectWildColor(color)),
    passPrompt:async () => transitionResult(simulation.passPrompt()),
    rewindPrompt:async () => transitionResult(simulation.rewindPrompt()),
    flagPrompt:async reasonCode => transitionResult(simulation.flagPrompt(reasonCode)),
    send:async command => transitionResult(simulation.send(command)),
    subscribe:simulation.subscribe,
  };
}

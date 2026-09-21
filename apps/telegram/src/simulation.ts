/**
 * What this does: the Telegram presentation adapter for the shared Local QA Simulation.
 * It maps the Telegram room draft onto the shared normalized Simulation configuration and
 * exposes the result through the TelegramBackendGame contract so the Telegram room view can
 * render a simulation without a Live session.
 * Key invariant: all orchestration lives in packages/simulation and all mechanics in
 * packages/game-engine; this file owns no rules, no player/seed/QA-fixture logic and no
 * command envelope, and it never calls the API.
 * Explicitly out of scope: Telegram presentation details, Live rooms and persistence.
 */
import { createSimulation, type SimulationSession } from '../../../packages/simulation/src/index.ts';
import type { TelegramBackendGame } from './backendGame.ts';
import type { TelegramRoomDraft } from './roomSetup.ts';

export function telegramSimulationConfig(draft: TelegramRoomDraft) {
  return {
    playerCount: draft.playerCount,
    humanDisplayName: draft.profileName,
    world: draft.world,
    ceiling: draft.ceiling,
    sources: draft.sources,
    qaHand: draft.qaHand,
  };
}

function transitionResult(transition: { ok: boolean; error?: { message?: string } }): { ok: boolean; error?: { message: string } } {
  return transition.ok ? { ok: true } : { ok: false, error: { message: transition.error?.message ?? 'The simulation rejected that action.' } };
}

export function createTelegramSimulation(draft: TelegramRoomDraft): SimulationSession {
  return createSimulation(telegramSimulationConfig(draft));
}

export function createTelegramSimulationGame(draft: TelegramRoomDraft): TelegramBackendGame {
  const simulation = createSimulation(telegramSimulationConfig(draft));
  const sessionId = simulation.getState().id;
  return {
    humanPlayerId: simulation.humanPlayerId,
    players: simulation.players,
    sessionId,
    joinCode: 'SIMULATION',
    getState: simulation.getState,
    getCapabilities: simulation.getCapabilities,
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

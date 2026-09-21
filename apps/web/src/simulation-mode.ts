/**
 * What this does: wires the Local QA Simulation to the existing Web board. A real
 * click on #startGameButton builds an ephemeral engine-backed simulation and renders
 * it through the shared board renderer, so gameplay work needs no server and no room.
 * Key invariant: this module never calls the Live API, never creates rooms/sessions
 * and owns no rules; every action is applied by the shared game engine locally.
 * Explicitly out of scope: persistence, Live semantics, and the known special-card stall.
 */
import type { CardColor } from '../../../packages/contracts/src/index.ts';
import { cribbitAuth } from '../../../packages/ui/src/auth-controller.ts';
import { readRoomCreatePayload, renderLiveSession, toast, type LiveSessionView } from './live-session.ts';
import {
  createSimulation,
  type SimulationCommand,
  type SimulationSession,
} from '../../../packages/simulation/src/index.ts';

const SIMULATION_JOIN_CODE = 'QA Simulation';

export function startLocalSimulationMode(): () => void {
  let simulation: SimulationSession | null = null;

  const humanName = (): string | undefined => {
    const auth = cribbitAuth.current;
    return auth.status === 'AUTHENTICATED' ? auth.user.displayName : undefined;
  };

  const currentView = (): LiveSessionView | null => (simulation
    ? {
      room: { joinCode: SIMULATION_JOIN_CODE },
      state: simulation.getState(),
      capabilities: simulation.getCapabilities(),
      players: simulation.players.map(player => ({ id: player.id, name: player.name, isHuman: player.isHuman })),
    }
    : null);

  const render = (): void => {
    const view = currentView();
    if (view && simulation) renderLiveSession(view, simulation.humanPlayerId, 'LOCAL');
  };

  const report = (transition: { ok: boolean; error?: { message?: string } }): void => {
    if (!transition.ok) {
      toast('Simulation rejected action', transition.error?.message || 'The shared engine rejected that action.');
    }
  };

  const start = (): void => {
    if (simulation) {
      render();
      return;
    }

    const payload = readRoomCreatePayload();
    try {
      simulation = createSimulation({
        playerCount: payload.playerCount,
        humanDisplayName: humanName(),
        world: payload.world,
        ceiling: payload.ceiling,
        sources: payload.sources,
        qaHand: false,
      });
    } catch (error) {
      toast(
        'Local QA Simulation unavailable',
        error instanceof Error ? error.message : 'The shared game engine rejected the simulation setup.',
      );
      return;
    }

    simulation.subscribe(render);
    render();
    toast(
      'Local QA Simulation',
      `${simulation.players.length} players · ephemeral local state · no room, session or database row created.`,
    );
  };

  /** Only act on board controls while the board is actually showing the local simulation. */
  const ownsBoard = (): boolean =>
    document.querySelector<HTMLElement>('#modeBadge')?.textContent === 'SIMULATION';

  const capture = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('#startGameButton')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      start();
      return;
    }

    if (!simulation || !ownsBoard()) return;

    const play = target.closest<HTMLElement>('[data-action="play-card"]');
    if (play?.dataset.cardId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      report(simulation.playCard(play.dataset.cardId));
      return;
    }

    const draw = target.closest<HTMLElement>('[data-action="draw-card"]');
    if (draw) {
      event.preventDefault();
      event.stopImmediatePropagation();
      report(simulation.drawCard());
      return;
    }

    const liveOption = target.closest<HTMLElement>('[data-live-option-id]');
    if (liveOption?.dataset.liveOptionId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const selected = simulation.getCapabilities()
        .options.find(option => option.optionId === liveOption.dataset.liveOptionId);
      if (selected) report(simulation.send(selected.command as SimulationCommand));
      return;
    }

    const liveAction = target.closest<HTMLElement>('[data-live-action]');
    if (liveAction?.dataset.liveAction === 'wild-color' && liveAction.dataset.color) {
      event.preventDefault();
      event.stopImmediatePropagation();
      report(simulation.selectWildColor(liveAction.dataset.color as CardColor));
    }
  };

  document.addEventListener('click', capture);
  return () => document.removeEventListener('click', capture);
}

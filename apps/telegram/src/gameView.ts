import type { CardColor, GameState } from '../../../packages/contracts/src/index.ts';
import { isLegalPlay } from '../../../packages/game-engine/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import { renderCribbitCard, renderCribbitCardBack } from './cardRenderer.ts';
import type { TelegramRoomDraft } from './roomSetup.ts';
import { createTelegramSimulation, type TelegramSimulation } from './simulation.ts';
import './styles/game.css';

type ActiveStateCopy = {
  kicker?: string;
  title: string;
  detail?: string;
};

export function renderTelegramGame(
  host: HTMLElement,
  platform: PlatformAdapter,
  draft: TelegramRoomDraft,
  onBack: () => void,
): void {
  const simulation = createTelegramSimulation(draft);
  let timerHandle: number | null = null;
  let statusMessage = 'Simulation uses the shared canonical game engine. No multiplayer room is being created.';
  let statusTone: 'neutral' | 'success' | 'warning' = 'neutral';

  const cleanup = (): void => {
    if (timerHandle !== null) {
      window.clearInterval(timerHandle);
      timerHandle = null;
    }
  };

  const render = (): void => {
    cleanup();
    const state = simulation.getState();
    host.innerHTML = gameTemplate(state, simulation, draft, statusMessage, statusTone);
    bindGame(host, platform, simulation, draft, render, message => {
      statusMessage = message.text;
      statusTone = message.tone;
    }, () => {
      cleanup();
      onBack();
    });
    timerHandle = startTimerDisplay(host, simulation);
  };

  render();
  platform.haptic('light');
}

function gameTemplate(
  state: GameState,
  simulation: TelegramSimulation,
  draft: TelegramRoomDraft,
  statusMessage: string,
  statusTone: 'neutral' | 'success' | 'warning',
): string {
  const human = state.players.find(player => player.id === simulation.humanPlayerId);
  const current = state.players.find(player => player.id === state.currentPlayerId);
  const discard = state.discardPile[state.discardPile.length - 1];
  const humanTurn = state.currentPlayerId === simulation.humanPlayerId;
  const activeState = describeActiveState(state, simulation);

  return `
    <main class="tg-app tg-game-page" data-telegram-app data-game-simulation>
      <header class="tg-app__header tg-game-header">
        <button class="tg-icon-button tg-icon-button--back" type="button" aria-label="Back to room creation" data-game-back>←</button>
        <div class="tg-app__title-block">
          <strong>Cribbit Chaos</strong>
          <span>Telegram Mini App</span>
        </div>
        <button class="tg-icon-button" type="button" aria-label="Game information" data-game-info>•••</button>
      </header>

      <section class="tg-live-strip" aria-label="Simulation status">
        <span class="tg-live-dot" aria-hidden="true"></span>
        <strong>SIMULATION</strong>
        <span>${escapeHTML(draft.mode)}</span>
      </section>

      <section class="tg-game-meta" aria-label="Room and turn information">
        <div class="tg-game-meta__room">
          <span class="tg-game-meta__mark" aria-hidden="true">●</span>
          <div>
            <small>ROOM</small>
            <strong>${escapeHTML(draft.roomName || 'Cribbit Room')}</strong>
            <span>${state.players.length} players · rev ${state.revision}</span>
          </div>
        </div>
        <div class="tg-game-meta__turn">
          <div>
            <small>CURRENT TURN</small>
            <strong>${escapeHTML(playerName(simulation, current?.id) || '—')}</strong>
          </div>
          <div class="tg-timer-ring" aria-label="Turn timer">
            <span data-timer-seconds>${secondsRemaining(state)}</span>
            <small>SEC</small>
          </div>
        </div>
      </section>

      <section class="tg-board" aria-label="Card board">
        <div class="tg-board__piles">
          <article class="tg-board-zone tg-board-zone--discard">
            <span class="tg-board-zone__label">DISCARD</span>
            <div class="tg-discard-stack" aria-label="Discard pile">
              ${discard ? renderCribbitCard(discard, 'board', { interactive: false }) : '<span class="tg-empty-pile">No discard</span>'}
            </div>
          </article>
          <article class="tg-board-zone tg-board-zone--draw">
            <span class="tg-board-zone__label">DRAW PILE<br><small>${state.drawPile.length} cards left</small></span>
            <button class="tg-deck" type="button" data-action="draw-card" aria-label="Draw a card" aria-disabled="${String(!humanTurn)}">
              ${renderCribbitCardBack('board')}
            </button>
          </article>
        </div>
      </section>

      <section class="tg-player-strip" aria-label="Players">
        <div class="tg-player-rail">
          ${state.players.map(player => `
            <div class="tg-player-chip${player.id === state.currentPlayerId ? ' is-active' : ''}${player.id === simulation.humanPlayerId ? ' is-human' : ''}">
              <span class="tg-player-avatar" aria-hidden="true">${escapeHTML(playerName(simulation, player.id).slice(0, 1).toUpperCase())}</span>
              <span><b>${escapeHTML(playerName(simulation, player.id))}</b><small>${player.hand.length} cards</small></span>
            </div>
          `).join('')}
        </div>
      </section>

      ${activeState ? `
        <section class="tg-active-state" aria-live="polite" data-active-state>
          ${activeState.kicker ? `<small>${escapeHTML(activeState.kicker)}</small>` : ''}
          <strong>${escapeHTML(activeState.title)}</strong>
          ${activeState.detail ? `<span>${escapeHTML(activeState.detail)}</span>` : ''}
          ${state.social?.prompt ? '<button class="tg-active-state__flag" type="button" data-action="safety-flag">⚑ Flag prompt</button>' : ''}
        </section>
      ` : ''}

      ${state.pendingEffect?.type === 'WILD_COLOR' && state.pendingEffect.playerId === simulation.humanPlayerId
        ? wildColorPicker()
        : ''}

      <section class="tg-hand" aria-label="Your hand">
        <div class="tg-section-label"><span>Your Hand</span><strong>${human?.hand.length ?? 0}</strong></div>
        <div class="tg-hand-rail">
          ${(human?.hand ?? []).map(card => renderCribbitCard(card, 'hand', {
            legal: humanTurn && isLegalPlay(state, simulation.humanPlayerId, card.id),
            interactive: true,
          })).join('') || '<p class="tg-hand-empty">Your hand is empty.</p>'}
        </div>
      </section>

      <nav class="tg-safety-bar" aria-label="Game actions">
        <button type="button" data-action="safety-pass" aria-disabled="${String(!state.social)}"><span>↪</span><b>Pass</b></button>
        <button type="button" data-action="safety-rewind" aria-disabled="${String(!state.social)}"><span>↶</span><b>Rewind</b></button>
        <button type="button" data-action="safety-nope" aria-disabled="true" title="Nope is available only during an eligible reaction window"><span>✋</span><b>Nope</b></button>
        <button type="button" data-action="draw-card" aria-disabled="${String(!humanTurn)}"><span>▱</span><b>Draw</b></button>
      </nav>

      <div class="tg-action-status" data-game-status data-tone="${statusTone}" role="status" aria-live="polite">${escapeHTML(statusMessage)}</div>
    </main>
  `;
}

function bindGame(
  host: HTMLElement,
  platform: PlatformAdapter,
  simulation: TelegramSimulation,
  draft: TelegramRoomDraft,
  render: () => void,
  setStatus: (message: { text: string; tone: 'neutral' | 'success' | 'warning' }) => void,
  onBack: () => void,
): void {
  host.querySelector<HTMLButtonElement>('[data-game-back]')?.addEventListener('click', onBack);
  host.querySelector<HTMLButtonElement>('[data-game-info]')?.addEventListener('click', () => {
    setStatus({ text: `Local simulation · ${draft.playerCount} players · canonical engine state.`, tone: 'neutral' });
    render();
  });

  bindDrawActions(host, platform, simulation, render, setStatus);
  bindPlayActions(host, platform, simulation, render, setStatus);

  host.querySelectorAll<HTMLButtonElement>('[data-wild-color]').forEach(button => {
    button.addEventListener('click', () => {
      const color = button.dataset.wildColor as CardColor | undefined;
      if (!color) return;
      const result = simulation.selectWildColor(color);
      platform.haptic(result.ok ? 'medium' : 'light');
      setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? `Active color changed to ${color}.` : undefined));
      render();
    });
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-pass"]')?.addEventListener('click', () => {
    const result = simulation.passPrompt();
    platform.haptic(result.ok ? 'medium' : 'light');
    setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Prompt passed through the canonical engine.' : undefined));
    render();
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-rewind"]')?.addEventListener('click', () => {
    const result = simulation.rewindPrompt();
    platform.haptic(result.ok ? 'medium' : 'light');
    setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Prompt rewind requested through the canonical engine.' : undefined));
    render();
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-nope"]')?.addEventListener('click', () => {
    platform.haptic('light');
    setStatus({ text: 'Nope becomes available only when the canonical engine opens an eligible reaction window.', tone: 'warning' });
    render();
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-flag"]')?.addEventListener('click', () => {
    const result = simulation.flagPrompt('telegram-simulation');
    platform.haptic(result.ok ? 'medium' : 'light');
    setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Prompt flagged through the canonical engine.' : undefined));
    render();
  });
}

function bindDrawActions(
  host: HTMLElement,
  platform: PlatformAdapter,
  simulation: TelegramSimulation,
  render: () => void,
  setStatus: (message: { text: string; tone: 'neutral' | 'success' | 'warning' }) => void,
): void {
  host.querySelectorAll<HTMLButtonElement>('[data-action="draw-card"]').forEach(button => {
    button.addEventListener('click', () => {
      const result = simulation.drawCard();
      platform.haptic(result.ok ? 'medium' : 'light');
      setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Card drawn through the canonical engine.' : undefined));
      render();
    });
  });
}

function bindPlayActions(
  host: HTMLElement,
  platform: PlatformAdapter,
  simulation: TelegramSimulation,
  render: () => void,
  setStatus: (message: { text: string; tone: 'neutral' | 'success' | 'warning' }) => void,
): void {
  host.querySelectorAll<HTMLButtonElement>('[data-action="play-card"]').forEach(button => {
    button.addEventListener('click', () => {
      const cardId = button.dataset.cardId;
      if (!cardId) return;
      const result = simulation.playCard(cardId);
      platform.haptic(result.ok ? 'medium' : 'light');
      setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Card played through the canonical engine.' : undefined));
      render();
    });
  });
}

function transitionMessage(ok: boolean, error?: string, success?: string): { text: string; tone: 'neutral' | 'success' | 'warning' } {
  return ok
    ? { text: success ?? 'Simulation state updated.', tone: 'success' }
    : { text: error ?? 'The canonical engine rejected that action.', tone: 'warning' };
}

function describeActiveState(state: GameState, simulation: TelegramSimulation): ActiveStateCopy | null {
  if (state.status === 'FINISHED') {
    return {
      kicker: 'GAME COMPLETE',
      title: `${playerName(simulation, state.winnerId ?? '') || 'Player'} WINS`,
      detail: 'The canonical engine accepted the winning state.',
    };
  }
  if (state.pendingEffect?.type === 'WILD_COLOR') {
    return {
      kicker: 'WILD',
      title: 'CHOOSE A COLOR',
      detail: state.pendingEffect.playerId === simulation.humanPlayerId ? 'Choose the next active color.' : 'Waiting for the active player to choose a color.',
    };
  }
  if (state.social && !state.social.resolutionComplete) {
    return {
      kicker: 'SOCIAL EFFECT',
      title: state.social.cardKind.replaceAll('_', ' ').toUpperCase(),
      detail: state.social.prompt?.text ?? 'Waiting for the authoritative prompt/effect data required by this card.',
    };
  }
  if (state.currentPlayerId === simulation.humanPlayerId) {
    return null;
  }
  return {
    kicker: 'TURN IN PROGRESS',
    title: playerName(simulation, state.currentPlayerId).toUpperCase(),
    detail: 'The local simulation is resolving the next canonical turn.',
  };
}

function wildColorPicker(): string {
  const colors: readonly CardColor[] = ['lime', 'orange', 'cyan', 'purple'];
  return `
    <section class="tg-wild-picker" aria-label="Choose wild color">
      <span>Choose active color</span>
      <div>${colors.map(color => `<button type="button" data-wild-color="${color}" data-color="${color}">${color}</button>`).join('')}</div>
    </section>
  `;
}

function playerName(simulation: TelegramSimulation, playerId: string | undefined): string {
  if (!playerId) return '';
  return simulation.players.find(player => player.id === playerId)?.name ?? playerId;
}

function secondsRemaining(state: GameState): number {
  if (!state.timer) return 0;
  return Math.max(0, Math.ceil((state.timer.deadlineAt - Date.now()) / 1000));
}

function startTimerDisplay(host: HTMLElement, simulation: TelegramSimulation): number {
  const update = (): void => {
    const node = host.querySelector<HTMLElement>('[data-timer-seconds]');
    if (node) node.textContent = String(secondsRemaining(simulation.getState()));
  };
  update();
  return window.setInterval(update, 250);
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

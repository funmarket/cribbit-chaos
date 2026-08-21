import type { CardColor, GameState } from '../../../packages/contracts/src/index.ts';
import { isLegalPlay } from '../../../packages/game-engine/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import { renderCribbitCard, renderCribbitCardBack } from './cardRenderer.ts';
import type { TelegramRoomDraft } from './roomSetup.ts';
import type { TelegramBackendGame } from './backendGame.ts';
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
  game: TelegramBackendGame,
  onBack: () => void,
): void {
  let timerHandle: number | null = null;
  let unsubscribe: (() => void) | null = null;
  let statusMessage = `Connected to shared game session ${game.joinCode}.`;
  let statusTone: 'neutral' | 'success' | 'warning' = 'success';

  const cleanupTimer = (): void => {
    if (timerHandle !== null) {
      window.clearInterval(timerHandle);
      timerHandle = null;
    }
  };

  const cleanup = (): void => {
    cleanupTimer();
    unsubscribe?.();
    unsubscribe = null;
  };

  const render = (): void => {
    cleanupTimer();
    const state = game.getState();
    host.innerHTML = gameTemplate(state, game, draft, statusMessage, statusTone);
    bindGame(host, platform, game, draft, render, message => {
      statusMessage = message.text;
      statusTone = message.tone;
    }, () => {
      cleanup();
      onBack();
    });
    timerHandle = startTimerDisplay(host, game);
  };

  render();
  unsubscribe = game.subscribe(render);
  platform.haptic('light');
}

function gameTemplate(
  state: GameState,
  game: TelegramBackendGame,
  draft: TelegramRoomDraft,
  statusMessage: string,
  statusTone: 'neutral' | 'success' | 'warning',
): string {
  const human = state.players.find(player => player.id === game.humanPlayerId);
  const current = state.players.find(player => player.id === state.currentPlayerId);
  const discard = state.discardPile[state.discardPile.length - 1];
  const humanTurn = state.currentPlayerId === game.humanPlayerId;
  const activeState = describeActiveState(state, game);

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
        <strong>LIVE GAME</strong>
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
            <strong>${escapeHTML(playerName(game, current?.id) || '—')}</strong>
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
            <div class="tg-player-chip${player.id === state.currentPlayerId ? ' is-active' : ''}${player.id === game.humanPlayerId ? ' is-human' : ''}">
              <span class="tg-player-avatar" aria-hidden="true">${escapeHTML(playerName(game, player.id).slice(0, 1).toUpperCase())}</span>
              <span><b>${escapeHTML(playerName(game, player.id))}</b><small>${player.hand.length} cards</small></span>
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

      ${state.pendingEffect?.type === 'WILD_COLOR' && state.pendingEffect.playerId === game.humanPlayerId
        ? wildColorPicker()
        : ''}

      <section class="tg-hand" aria-label="Your hand">
        <div class="tg-section-label"><span>Your Hand</span><strong>${human?.hand.length ?? 0}</strong></div>
        <div class="tg-hand-rail">
          ${(human?.hand ?? []).map(card => renderCribbitCard(card, 'hand', {
            legal: humanTurn && isLegalPlay(state, game.humanPlayerId, card.id),
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
  game: TelegramBackendGame,
  draft: TelegramRoomDraft,
  render: () => void,
  setStatus: (message: { text: string; tone: 'neutral' | 'success' | 'warning' }) => void,
  onBack: () => void,
): void {
  host.querySelector<HTMLButtonElement>('[data-game-back]')?.addEventListener('click', onBack);
  host.querySelector<HTMLButtonElement>('[data-game-info]')?.addEventListener('click', () => {
    setStatus({ text: `Shared session ${game.joinCode} · ${draft.playerCount} players.`, tone: 'neutral' });
    render();
  });

  bindDrawActions(host, platform, game, render, setStatus);
  bindPlayActions(host, platform, game, render, setStatus);

  host.querySelectorAll<HTMLButtonElement>('[data-wild-color]').forEach(button => {
    button.addEventListener('click', async () => {
      const color = button.dataset.wildColor as CardColor | undefined;
      if (!color) return;
      const result = await game.selectWildColor(color);
      platform.haptic(result.ok ? 'medium' : 'light');
      setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? `Active color changed to ${color}.` : undefined));
      render();
    });
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-pass"]')?.addEventListener('click', async () => {
    const result = await game.passPrompt();
    platform.haptic(result.ok ? 'medium' : 'light');
    setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Prompt passed.' : undefined));
    render();
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-rewind"]')?.addEventListener('click', async () => {
    const result = await game.rewindPrompt();
    platform.haptic(result.ok ? 'medium' : 'light');
    setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Prompt rewind requested.' : undefined));
    render();
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-nope"]')?.addEventListener('click', () => {
    platform.haptic('light');
    setStatus({ text: 'Nope becomes available only when the game opens an eligible reaction window.', tone: 'warning' });
    render();
  });

  host.querySelector<HTMLButtonElement>('[data-action="safety-flag"]')?.addEventListener('click', async () => {
    const result = await game.flagPrompt('telegram');
    platform.haptic(result.ok ? 'medium' : 'light');
    setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Prompt flagged.' : undefined));
    render();
  });
}

function bindDrawActions(
  host: HTMLElement,
  platform: PlatformAdapter,
  game: TelegramBackendGame,
  render: () => void,
  setStatus: (message: { text: string; tone: 'neutral' | 'success' | 'warning' }) => void,
): void {
  host.querySelectorAll<HTMLButtonElement>('[data-action="draw-card"]').forEach(button => {
    button.addEventListener('click', async () => {
      const result = await game.drawCard();
      platform.haptic(result.ok ? 'medium' : 'light');
      setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Card drawn.' : undefined));
      render();
    });
  });
}

function bindPlayActions(
  host: HTMLElement,
  platform: PlatformAdapter,
  game: TelegramBackendGame,
  render: () => void,
  setStatus: (message: { text: string; tone: 'neutral' | 'success' | 'warning' }) => void,
): void {
  host.querySelectorAll<HTMLButtonElement>('[data-action="play-card"]').forEach(button => {
    button.addEventListener('click', async () => {
      const cardId = button.dataset.cardId;
      if (!cardId) return;
      const result = await game.playCard(cardId);
      platform.haptic(result.ok ? 'medium' : 'light');
      setStatus(transitionMessage(result.ok, result.error?.message, result.ok ? 'Card played.' : undefined));
      render();
    });
  });
}

function transitionMessage(ok: boolean, error?: string, success?: string): { text: string; tone: 'neutral' | 'success' | 'warning' } {
  return ok
    ? { text: success ?? 'Game state updated.', tone: 'success' }
    : { text: error ?? 'The game rejected that action.', tone: 'warning' };
}

function describeActiveState(state: GameState, game: TelegramBackendGame): ActiveStateCopy | null {
  if (state.status === 'FINISHED') {
    return {
      kicker: 'GAME COMPLETE',
      title: `${playerName(game, state.winnerId ?? '') || 'Player'} WINS`,
      detail: 'The game accepted the winning state.',
    };
  }
  if (state.pendingEffect?.type === 'WILD_COLOR') {
    return {
      kicker: 'WILD',
      title: 'CHOOSE A COLOR',
      detail: state.pendingEffect.playerId === game.humanPlayerId ? 'Choose the next active color.' : 'Waiting for the active player to choose a color.',
    };
  }
  if (state.social && !state.social.resolutionComplete) {
    return {
      kicker: 'SOCIAL EFFECT',
      title: state.social.cardKind.replaceAll('_', ' ').toUpperCase(),
      detail: state.social.prompt?.text ?? 'Waiting for the game data required by this card.',
    };
  }
  if (state.currentPlayerId === game.humanPlayerId) {
    return null;
  }
  return {
    kicker: 'TURN IN PROGRESS',
    title: playerName(game, state.currentPlayerId).toUpperCase(),
    detail: 'Waiting for the current player.',
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

function playerName(game: TelegramBackendGame, playerId: string | undefined): string {
  if (!playerId) return '';
  return game.players.find(player => player.id === playerId)?.name ?? playerId;
}

function secondsRemaining(state: GameState): number {
  if (!state.timer) return 0;
  return Math.max(0, Math.ceil((state.timer.deadlineAt - Date.now()) / 1000));
}

function startTimerDisplay(host: HTMLElement, game: TelegramBackendGame): number {
  const update = (): void => {
    const node = host.querySelector<HTMLElement>('[data-timer-seconds]');
    if (node) node.textContent = String(secondsRemaining(game.getState()));
  };
  update();
  return window.setInterval(update, 250);
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

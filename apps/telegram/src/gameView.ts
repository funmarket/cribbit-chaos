import type { Card } from '../../../packages/contracts/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import { installContextualRuleUI } from './contextualRuleUI.ts';
import './styles/game.css';

interface DemoPlayer {
  readonly id: string;
  readonly name: string;
  readonly cards: number;
  readonly active?: boolean;
}

interface TelegramDemoGame {
  readonly roomName: string;
  readonly roomCode: string;
  readonly mode: string;
  readonly timerSeconds: number;
  readonly drawCount: number;
  readonly discard: Card;
  readonly hand: readonly Card[];
  readonly players: readonly DemoPlayer[];
}

const DEMO_GAME: TelegramDemoGame = {
  roomName: 'Night Squad',
  roomCode: 'NIGHT',
  mode: 'Party',
  timerSeconds: 35,
  drawCount: 24,
  discard: { id: 'demo-discard-3', kind: 'number', color: 'orange', value: 3, symbol: '3' },
  hand: [
    { id: 'demo-truth', kind: 'truth', color: 'lime', symbol: 'TRUTH' },
    { id: 'demo-dare', kind: 'dare', color: 'orange', symbol: 'DARE' },
    { id: 'demo-paranoia', kind: 'paranoia', color: 'purple', symbol: 'PARANOIA' },
    { id: 'demo-chaos', kind: 'chaos', symbol: 'CHAOS' },
    { id: 'demo-duel', kind: 'duel', color: 'cyan', symbol: 'DUEL' },
    { id: 'demo-nope', kind: 'nope', symbol: 'NOPE' },
    { id: 'demo-wild', kind: 'wild', symbol: 'WILD' }
  ],
  players: [
    { id: 'you', name: 'You', cards: 7, active: true },
    { id: 'leo', name: 'Leo', cards: 5 },
    { id: 'nina', name: 'Nina', cards: 6 },
    { id: 'jordan', name: 'Jordan', cards: 4 }
  ]
};

export function renderTelegramGame(host: HTMLElement, platform: PlatformAdapter, onBack: () => void): void {
  host.innerHTML = gameTemplate(DEMO_GAME);
  bindGamePreview(host, platform, onBack);
  installContextualRuleUI(host, platform);
  platform.haptic('light');
}

function gameTemplate(game: TelegramDemoGame): string {
  return `
    <main class="tg-app tg-game-page" data-telegram-app data-game-preview>
      <header class="tg-app__header tg-game-header">
        <button class="tg-icon-button tg-icon-button--back" type="button" aria-label="Back to room creation" data-game-back>←</button>
        <div class="tg-app__title-block">
          <strong>Cribbit Chaos</strong>
          <span>Telegram Mini App</span>
        </div>
        <button class="tg-icon-button" type="button" aria-label="Game menu">•••</button>
      </header>

      <section class="tg-live-strip" aria-label="Live game">
        <span class="tg-live-dot" aria-hidden="true"></span>
        <strong>LIVE GAME</strong>
        <span>${escapeHTML(game.mode)}</span>
      </section>

      <section class="tg-game-meta" aria-label="Room and turn information">
        <div>
          <small>ROOM</small>
          <strong>${escapeHTML(game.roomName)}</strong>
          <span>Code: ${escapeHTML(game.roomCode)}</span>
        </div>
        <div class="tg-turn-pill">
          <small>CURRENT TURN</small>
          <strong>You</strong>
          <span>${game.timerSeconds}s</span>
        </div>
      </section>

      <section class="tg-board" aria-label="Card board">
        <div class="tg-board__label">CARD BOARD</div>
        <div class="tg-board__piles">
          <article class="tg-board-zone tg-board-zone--discard">
            <span class="tg-board-zone__label">DISCARD CARD</span>
            ${renderCard(game.discard, 'board')}
          </article>
          <article class="tg-board-zone tg-board-zone--draw">
            <span class="tg-board-zone__label">DRAW PILE</span>
            <button class="tg-deck" type="button" data-action="draw-card" aria-label="Draw a card">
              <span class="tg-deck__back" aria-hidden="true"><b>CRIBBIT</b><em>CHAOS</em></span>
              <span class="tg-deck__count">${game.drawCount} left</span>
            </button>
          </article>
        </div>
        <div class="tg-board-actions">
          <button class="tg-button tg-button--board-action" type="button" data-action="draw-card">Draw</button>
          <button class="tg-button tg-button--board-action tg-button--chaos" type="button" data-action="open-chaos-board">Chaos Board</button>
        </div>
      </section>

      <section class="tg-player-strip" aria-label="Players">
        <div class="tg-section-label"><span>Players</span><small>${game.players.length} in room</small></div>
        <div class="tg-player-rail">
          ${game.players.map(player => `
            <div class="tg-player-chip${player.active ? ' is-active' : ''}">
              <span class="tg-player-avatar" aria-hidden="true">${escapeHTML(player.name.slice(0, 1).toUpperCase())}</span>
              <span><b>${escapeHTML(player.name)}</b><small>${player.cards} cards</small></span>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="tg-active-state" aria-live="polite">
        <small>YOUR TURN</small>
        <strong>PLAY OR DRAW</strong>
        <span>Tap a special card to preview its contextual rule panel, or draw.</span>
      </section>

      <section class="tg-hand" aria-label="Your hand">
        <div class="tg-section-label"><span>Your QA Hand</span><strong>${game.hand.length} cards</strong></div>
        <div class="tg-hand-rail">
          ${game.hand.map(card => renderCard(card, 'hand')).join('')}
        </div>
      </section>

      <nav class="tg-safety-bar" aria-label="Safety actions">
        <button type="button" data-action="safety-pass"><span>↪</span><b>Pass</b></button>
        <button type="button" data-action="safety-rewind"><span>↶</span><b>Rewind</b></button>
        <button type="button" data-action="use-nope"><span>✋</span><b>Nope</b></button>
        <button type="button" data-action="safety-flag"><span>⚑</span><b>Flag</b></button>
      </nav>

      <div class="tg-action-status" data-game-status role="status" aria-live="polite">Demo preview only — no authoritative multiplayer state is being changed.</div>
    </main>
  `;
}

function renderCard(card: Card, size: 'board' | 'hand'): string {
  const tone = card.color || 'wild';
  const title = cardTitle(card);
  const symbol = cardSymbol(card);
  return `
    <button class="tg-card tg-card--${size}" type="button" data-card-id="${escapeHTML(card.id)}" data-card-kind="${card.kind}" data-card-color="${tone}" data-action="play-card" aria-label="${escapeHTML(title)} card">
      <span class="tg-card__corner tg-card__corner--top">${escapeHTML(symbol)}</span>
      <span class="tg-card__center">
        <small>${escapeHTML(card.kind.toUpperCase())}</small>
        <strong>${escapeHTML(symbol)}</strong>
        <em>${escapeHTML(title)}</em>
      </span>
      <span class="tg-card__corner tg-card__corner--bottom">${escapeHTML(symbol)}</span>
    </button>
  `;
}

function cardTitle(card: Card): string {
  switch (card.kind) {
    case 'number': return `${card.color || ''} ${card.value ?? card.symbol ?? ''}`.trim();
    case 'skip': return 'Skip';
    case 'reverse': return 'Reverse';
    case 'draw': return 'Draw Two';
    case 'wild': return 'Wild';
    case 'truth': return 'Truth';
    case 'dare': return 'Dare';
    case 'paranoia': return 'Paranoia';
    case 'chaos': return 'Chaos';
    case 'duel': return 'Duel';
    case 'nope': return 'Nope';
  }
}

function cardSymbol(card: Card): string {
  if (card.kind === 'number') return String(card.value ?? card.symbol ?? '');
  if (card.kind === 'skip') return '⊘';
  if (card.kind === 'reverse') return '↻';
  if (card.kind === 'draw') return '+2';
  if (card.kind === 'wild') return '★';
  if (card.kind === 'truth') return '?';
  if (card.kind === 'dare') return '⚡';
  if (card.kind === 'paranoia') return '◉';
  if (card.kind === 'chaos') return '✹';
  if (card.kind === 'duel') return '⚔';
  return '✋';
}

function bindGamePreview(host: HTMLElement, platform: PlatformAdapter, onBack: () => void): void {
  const status = host.querySelector<HTMLElement>('[data-game-status]');
  host.querySelector<HTMLButtonElement>('[data-game-back]')?.addEventListener('click', onBack);

  host.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action || '';
      if (action === 'play-card') {
        host.querySelectorAll<HTMLButtonElement>('[data-card-id]').forEach(card => card.classList.remove('is-selected'));
        button.classList.add('is-selected');
        platform.haptic('light');
        if (status) status.textContent = 'Card selected. Context UI may open, but no authoritative play command is sent in the demo preview.';
        return;
      }
      platform.haptic(action === 'draw-card' ? 'medium' : 'light');
      if (status) status.textContent = actionMessage(action);
    });
  });
}

function actionMessage(action: string): string {
  switch (action) {
    case 'draw-card': return 'Draw action mapped. Demo preview does not change the authoritative draw pile.';
    case 'open-chaos-board': return 'CHAOS Board is a secondary view and remains outside the core T3/T4 slice.';
    case 'safety-pass': return 'Pass action mapped to the existing PASS_PROMPT safety command boundary.';
    case 'safety-rewind': return 'Rewind action mapped to the existing REWIND_PROMPT safety command boundary.';
    case 'use-nope': return 'Nope action mapped to the existing PLAY_NOPE reaction command boundary.';
    case 'safety-flag': return 'Flag action mapped to the existing FLAG_PROMPT safety command boundary.';
    default: return 'Demo preview only — no authoritative multiplayer state was changed.';
  }
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

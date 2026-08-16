import type { Card } from '../../../packages/contracts/src/index.ts';
import '../../../packages/ui/src/styles.css';
import '../../../packages/ui/src/compact-cards.css';
import './styles/cards.css';

type TelegramCardSize = 'board' | 'hand';

type CardVisual = {
  title: string;
  glyph: string;
  ruleLead: string;
  ruleDetail: string;
};

export interface TelegramCardRenderOptions {
  readonly legal?: boolean;
  readonly interactive?: boolean;
}

const CARD_VISUALS: Record<Card['kind'], CardVisual> = {
  number: { title: 'Number', glyph: '', ruleLead: 'Match color or value.', ruleDetail: 'Fast hand-management play.' },
  skip: { title: 'Skip', glyph: '⊘', ruleLead: 'Tempo control.', ruleDetail: 'Next player loses a turn.' },
  reverse: { title: 'Reverse', glyph: '⇄', ruleLead: 'Change direction.', ruleDetail: 'Two-player mode returns the turn.' },
  draw: { title: 'Draw', glyph: '+2', ruleLead: 'Pressure card.', ruleDetail: 'Resolve the canonical Draw +2 effect.' },
  wild: { title: 'Wild', glyph: '●●●', ruleLead: 'Choose the active color.', ruleDetail: 'Server validates the choice.' },
  truth: { title: 'Truth', glyph: '?', ruleLead: 'Truth', ruleDetail: 'Resolve the canonical Truth interaction.' },
  dare: { title: 'Dare', glyph: 'ϟ', ruleLead: 'Dare', ruleDetail: 'Resolve the canonical Dare interaction.' },
  paranoia: { title: 'Paranoia', glyph: '◉', ruleLead: 'Paranoia', ruleDetail: 'Resolve the canonical Paranoia interaction.' },
  chaos: { title: 'Chaos', glyph: '↻', ruleLead: 'Chaos', ruleDetail: 'Resolve one approved server-selected Chaos effect.' },
  duel: { title: 'Duel', glyph: '⚔', ruleLead: 'Duel', ruleDetail: 'Resolve the canonical Duel interaction.' },
  nope: { title: 'Nope', glyph: '✋', ruleLead: 'Nope', ruleDetail: 'Reaction card for eligible effects only.' },
  tag: { title: 'TAG', glyph: 'TAG', ruleLead: 'TAG', ruleDetail: 'Resolve the canonical TAG interaction.' },
  truth_or_chaos: { title: 'Truth or Chaos', glyph: '?/ϟ', ruleLead: 'Truth or Chaos', ruleDetail: 'Resolve the canonical Truth-or-Dare choice flow.' },
  hijack: { title: 'Hijack', glyph: '↯', ruleLead: 'Hijack', ruleDetail: 'Resolve the canonical Hijack interaction.' },
  taboo: { title: 'Taboo', glyph: '!', ruleLead: 'Taboo', ruleDetail: 'Resolve the canonical Taboo interaction.' },
  machiavelli: { title: 'Machiavelli', glyph: 'M', ruleLead: 'Machiavelli', ruleDetail: 'Choose one of the six fixed server-enforced effects.' },
  ghost: { title: 'Ghost', glyph: 'G', ruleLead: 'Ghost', ruleDetail: 'Arm the canonical delayed Ghost interaction.' },
  reverse_confession: { title: 'Reverse Confession', glyph: 'RC', ruleLead: 'Reverse Confession', ruleDetail: 'Resolve the canonical confession interaction.' },
  dig_me: { title: 'DIG ME', glyph: 'DM', ruleLead: 'DIG ME', ruleDetail: 'Resolve the canonical DIG ME interaction.' }
};

export function renderCribbitCard(card: Card, size: TelegramCardSize, options: TelegramCardRenderOptions = {}): string {
  const visual = CARD_VISUALS[card.kind];
  const title = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : visual.title;
  const glyph = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : visual.glyph;
  const kindAttr = ` data-kind="${escapeHTML(card.kind)}"`;
  const colorAttr = card.color ? ` data-color="${escapeHTML(card.color)}"` : '';
  const modifier = size === 'board' ? 'game-card--tg-board' : 'game-card--tg-hand';
  const tabMarkup = size === 'board'
    ? `<span class="game-card__tab" aria-hidden="true">${escapeHTML(glyph || title.slice(0, 1))}</span>`
    : '';
  const interactive = options.interactive !== false;
  const legal = options.legal !== false;
  const actionAttr = interactive ? ' data-action="play-card"' : '';
  const legalityAttr = interactive ? ` aria-disabled="${String(!legal)}"` : '';

  return `
    <button
      class="game-card ${modifier}"
      type="button"
      data-card-id="${escapeHTML(card.id)}"
      data-card-kind="${escapeHTML(card.kind)}"
      data-legal="${String(legal)}"
      ${actionAttr}
      ${kindAttr}
      ${colorAttr}
      ${legalityAttr}
      aria-label="${escapeHTML(`${title} card`)}"
    >
      ${tabMarkup}
      <strong class="game-card__title">${escapeHTML(title)}</strong>
      <span class="game-card__icon${card.kind === 'number' ? ' is-number' : ''}" aria-hidden="true">${escapeHTML(glyph)}</span>
      <p class="game-card__rule"><strong>${escapeHTML(visual.ruleLead)}</strong><br>${escapeHTML(visual.ruleDetail)}</p>
      <span class="frog-seal" aria-hidden="true">●</span>
    </button>
  `;
}

export function renderCribbitCardBack(size: TelegramCardSize): string {
  return `
    <span class="tg-shared-card-back tg-shared-card-back--${size}" aria-hidden="true">
      <b>CRIBBIT</b>
      <em>CHAOS</em>
    </span>
  `;
}

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

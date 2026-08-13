import type { Card } from '../../../packages/contracts/src/index.ts';
import '../../../packages/ui/src/styles.css';

type TelegramCardSize = 'board' | 'hand';

type CardVisual = {
  title: string;
  glyph: string;
  ruleLead: string;
  ruleDetail: string;
};

const CARD_VISUALS: Record<Card['kind'], CardVisual> = {
  number: { title: 'Number', glyph: '', ruleLead: 'Match color or value.', ruleDetail: 'Fast hand-management play.' },
  skip: { title: 'Skip', glyph: '⊘', ruleLead: 'Tempo control.', ruleDetail: 'Next player loses a turn.' },
  reverse: { title: 'Reverse', glyph: '⇄', ruleLead: 'Change direction.', ruleDetail: 'Two-player mode returns the turn.' },
  draw: { title: 'Draw', glyph: '+2', ruleLead: 'Pressure card.', ruleDetail: 'Next player draws the configured penalty.' },
  wild: { title: 'Wild', glyph: '●●●', ruleLead: 'Choose the active color.', ruleDetail: 'Server validates the choice.' },
  truth: { title: 'Truth', glyph: '?', ruleLead: 'Reveal something real.', ruleDetail: 'Answer honestly.' },
  dare: { title: 'Dare', glyph: 'ϟ', ruleLead: 'Do something bold.', ruleDetail: 'Complete the challenge.' },
  paranoia: { title: 'Paranoia', glyph: '◉', ruleLead: 'Trust no one.', ruleDetail: 'Choose, guess or suspect.' },
  chaos: { title: 'Chaos', glyph: '↻', ruleLead: 'Shake things up.', ruleDetail: 'Resolve the effect.' },
  duel: { title: 'Duel', glyph: '⚔', ruleLead: 'Challenge another player.', ruleDetail: 'Resolve the Duel.' },
  nope: { title: 'Nope', glyph: '✋', ruleLead: 'Not today.', ruleDetail: 'Block an eligible effect.' }
};

export function renderCribbitCard(card: Card, size: TelegramCardSize): string {
  const visual = CARD_VISUALS[card.kind];
  const title = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : visual.title;
  const glyph = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : visual.glyph;
  const kindAttr = card.kind === 'number' || ['skip', 'reverse', 'draw'].includes(card.kind)
    ? ''
    : ` data-kind="${escapeHTML(card.kind)}"`;
  const colorAttr = card.color ? ` data-color="${escapeHTML(card.color)}"` : '';
  const modifier = size === 'board' ? 'game-card--tg-board' : 'game-card--tg-hand';

  return `
    <button
      class="game-card ${modifier}"
      type="button"
      data-card-id="${escapeHTML(card.id)}"
      data-card-kind="${escapeHTML(card.kind)}"
      data-action="play-card"
      data-legal="true"
      ${kindAttr}
      ${colorAttr}
      aria-label="${escapeHTML(`${title} card`)}"
    >
      <span class="game-card__tab" aria-hidden="true">${escapeHTML(glyph || title.slice(0, 1))}</span>
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

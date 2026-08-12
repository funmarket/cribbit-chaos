import type { Card, CardKind } from '../../../packages/contracts/src/index.ts';
import './styles/cards.css';

type CardVisual = {
  title: string;
  icon: string;
  copy: string;
  tone: 'lime' | 'orange' | 'purple' | 'pink' | 'cyan' | 'gold' | 'red' | 'wild';
};

const CARD_VISUALS: Record<CardKind, CardVisual> = {
  number: { title: 'Number', icon: '#', copy: 'Match color or number.', tone: 'gold' },
  skip: { title: 'Skip', icon: '⊘', copy: 'Skip the next turn.', tone: 'red' },
  reverse: { title: 'Reverse', icon: '↶', copy: 'Reverse play direction.', tone: 'cyan' },
  draw: { title: 'Draw Two', icon: '+2', copy: 'Make the next player draw.', tone: 'orange' },
  wild: { title: 'Wild', icon: '◉', copy: 'Be any color. Play anytime.', tone: 'wild' },
  truth: { title: 'Truth', icon: '?', copy: 'Reveal something real. Answer honestly.', tone: 'lime' },
  dare: { title: 'Dare', icon: '⚡', copy: 'Do something bold. No backing out.', tone: 'orange' },
  paranoia: { title: 'Paranoia', icon: '◉', copy: 'Trust no one. Guess, bluff, expose secrets.', tone: 'purple' },
  chaos: { title: 'Chaos', icon: '◌', copy: 'Shake things up. Unpredictable effects.', tone: 'pink' },
  duel: { title: 'Duel', icon: '⚔', copy: 'Challenge another player. Winner takes the win.', tone: 'cyan' },
  nope: { title: 'Nope', icon: '✋', copy: 'Not today. Block or cancel a card or effect.', tone: 'gold' }
};

export function renderCribbitCard(card: Card, size: 'board' | 'hand'): string {
  const visual = resolveVisual(card);
  const value = card.kind === 'number' ? String(card.value ?? card.symbol ?? '') : visual.icon;
  const title = card.kind === 'number' ? value : visual.title;
  const label = card.kind === 'number' ? `${colorName(card.color)} ${value}`.trim() : visual.title;
  const tone = card.kind === 'number' ? numberTone(card) : visual.tone;

  return `
    <button
      class="cribbit-card cribbit-card--${size} cribbit-card--${tone}"
      type="button"
      data-card-id="${escapeHTML(card.id)}"
      data-card-kind="${card.kind}"
      data-card-color="${card.color || ''}"
      data-action="play-card"
      aria-label="${escapeHTML(label)} card"
    >
      <span class="cribbit-card__frame" aria-hidden="true"></span>
      <span class="cribbit-card__corner cribbit-card__corner--top" aria-hidden="true">${escapeHTML(value)}</span>
      <span class="cribbit-card__art" aria-hidden="true">
        <span class="cribbit-card__halo"></span>
        <span class="cribbit-card__icon">${escapeHTML(value)}</span>
      </span>
      <span class="cribbit-card__title">${escapeHTML(title)}</span>
      <span class="cribbit-card__rule">${escapeHTML(visual.copy)}</span>
      <span class="cribbit-card__brand" aria-hidden="true">◡ CRIBBIT</span>
      <span class="cribbit-card__corner cribbit-card__corner--bottom" aria-hidden="true">${escapeHTML(value)}</span>
    </button>
  `;
}

function resolveVisual(card: Card): CardVisual {
  if (card.kind === 'number') {
    return {
      title: String(card.value ?? card.symbol ?? ''),
      icon: String(card.value ?? card.symbol ?? ''),
      copy: 'Match color or number.',
      tone: numberTone(card)
    };
  }
  return CARD_VISUALS[card.kind];
}

function numberTone(card: Card): CardVisual['tone'] {
  if (card.color === 'lime') return 'lime';
  if (card.color === 'orange') return 'orange';
  if (card.color === 'cyan') return 'cyan';
  if (card.color === 'purple') return 'purple';
  return 'gold';
}

function colorName(color: Card['color']): string {
  return color ? color[0].toUpperCase() + color.slice(1) : '';
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

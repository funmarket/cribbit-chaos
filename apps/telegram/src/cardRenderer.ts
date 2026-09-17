import type { Card } from '../../../packages/contracts/src/index.ts';
import {
  resolveCanonicalCardBackPath,
  resolveCanonicalCardFacePath,
} from '../../../packages/cards/src/index.ts';
import './styles/cards.css';

type TelegramCardSize = 'board' | 'hand';

export interface TelegramCardRenderOptions {
  readonly legal?: boolean;
  readonly interactive?: boolean;
}

const ASSET_URLS = import.meta.glob(
  '../../../packages/cards/assets/CHAOS-133-V1/**/*.jpg',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

const ASSET_PREFIX = '../../../packages/cards/assets/CHAOS-133-V1/';
const assetByPath = new Map<string, string>(
  Object.entries(ASSET_URLS).map(([key, url]) => [key.replace(ASSET_PREFIX, ''), url]),
);

function canonicalAssetUrl(path: string | null): string | null {
  return path ? assetByPath.get(path) ?? null : null;
}

function cardFaceUrl(card: Card): string | null {
  return canonicalAssetUrl(resolveCanonicalCardFacePath({
    family: card.kind,
    color: card.color,
    value: card.value,
  }));
}

function cardBackUrl(): string | null {
  return canonicalAssetUrl(resolveCanonicalCardBackPath());
}

export function renderCribbitCard(card: Card, size: TelegramCardSize, options: TelegramCardRenderOptions = {}): string {
  const source = cardFaceUrl(card);
  if (!source) {
    throw new Error(`Missing canonical CHAOS-133-V1 artwork for ${describeCard(card)}.`);
  }

  const modifier = size === 'board' ? 'game-card--tg-board' : 'game-card--tg-hand';
  const interactive = options.interactive !== false;
  const legal = options.legal !== false;
  const actionAttr = interactive ? ' data-action="play-card"' : '';
  const legalityAttr = interactive ? ` aria-disabled="${String(!legal)}"` : '';
  const colorAttr = card.color ? ` data-color="${escapeHTML(card.color)}"` : '';

  return `
    <button
      class="game-card ${modifier}"
      type="button"
      data-card-id="${escapeHTML(card.id)}"
      data-card-kind="${escapeHTML(card.kind)}"
      data-kind="${escapeHTML(card.kind)}"
      data-legal="${String(legal)}"
      ${colorAttr}
      ${actionAttr}
      ${legalityAttr}
      aria-label="${escapeHTML(`${describeCard(card)} card`)}"
    >
      <img
        class="game-card__art"
        src="${escapeHTML(source)}"
        alt=""
        draggable="false"
        aria-hidden="true"
      >
      ${interactive && legal ? '<span class="game-card__legal-badge" aria-hidden="true">LEGAL</span>' : ''}
    </button>
  `;
}

export function renderCribbitCardBack(size: TelegramCardSize): string {
  const source = cardBackUrl();
  if (!source) {
    throw new Error('Missing canonical CHAOS-133-V1 card-back artwork.');
  }

  return `
    <span class="tg-shared-card-back tg-shared-card-back--${size}" aria-hidden="true">
      <img src="${escapeHTML(source)}" alt="" draggable="false">
    </span>
  `;
}

function describeCard(card: Card): string {
  if (card.kind === 'number') {
    return `${card.color ?? ''} ${card.value ?? ''}`.trim();
  }
  return card.kind.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

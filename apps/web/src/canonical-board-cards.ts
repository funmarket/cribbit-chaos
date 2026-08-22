import type { CardColor, CardFamily } from '../../../packages/cards/src/types.ts';
import {
  isCanonicalCardFamily,
  resolveCanonicalCardBackPath,
  resolveCanonicalCardFacePath,
} from '../../../packages/cards/src/index.ts';
import './canonical-board-cards.css';

const ASSET_URLS = import.meta.glob(
  '../../../packages/cards/assets/CHAOS-133-V1/**/*.jpg',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

const ASSET_PREFIX = '../../../packages/cards/assets/CHAOS-133-V1/';
const assetByPath = new Map<string, string>(
  Object.entries(ASSET_URLS).map(([key, url]) => [key.replace(ASSET_PREFIX, ''), url]),
);

const discardedHistory: string[] = [];
let currentPlayKey = '';
let currentPlayMarkup = '';
let syncingPilePresentation = false;

function familyFromCardElement(card: HTMLElement): CardFamily | null {
  const explicit = card.dataset.kind;
  if (explicit && isCanonicalCardFamily(explicit)) return explicit;

  if (card.querySelector('.game-card__icon.is-number')) return 'number';

  const title = card.querySelector<HTMLElement>('.game-card__title')?.textContent?.trim().toLowerCase();
  if (!title) return null;

  const normalized = title.replace(/\s+/g, '_');
  return isCanonicalCardFamily(normalized) ? normalized : null;
}

function canonicalFaceFor(card: HTMLElement): string | null {
  const family = familyFromCardElement(card);
  if (!family) return null;

  const color = card.dataset.color as CardColor | undefined;
  const valueText = card.querySelector<HTMLElement>('.game-card__icon.is-number')?.textContent?.trim();
  const value = valueText === undefined ? undefined : Number(valueText);
  const path = resolveCanonicalCardFacePath({
    family,
    color,
    value: Number.isFinite(value) ? value : undefined,
  });

  return path ? assetByPath.get(path) ?? null : null;
}

function hydrateFace(card: HTMLElement): void {
  const source = canonicalFaceFor(card);
  if (!source) return;

  let image = card.querySelector<HTMLImageElement>(':scope > .cc-canonical-card-face');
  if (!image) {
    image = document.createElement('img');
    image.className = 'cc-canonical-card-face';
    image.alt = '';
    image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    card.prepend(image);
  }

  if (image.src !== source) image.src = source;
  card.classList.add('cc-has-canonical-face');
}

function hydrateBacks(root: ParentNode): void {
  const backSource = assetByPath.get(resolveCanonicalCardBackPath());
  if (!backSource) return;

  root.querySelectorAll<HTMLElement>('.deck-stack, .deck-card, [data-role="draw-pile"], [aria-label*="draw pile" i]')
    .forEach(node => {
      node.style.setProperty('--cc-canonical-card-back', `url("${backSource}")`);
      node.classList.add('cc-has-canonical-back');
    });
}

function cardKey(card: HTMLElement): string {
  return [
    card.dataset.cardId ?? '',
    card.dataset.kind ?? '',
    card.dataset.color ?? '',
    card.getAttribute('aria-label') ?? '',
    card.querySelector<HTMLElement>('.game-card__icon.is-number')?.textContent?.trim() ?? '',
  ].join('|');
}

function presentationMarkup(card: HTMLElement): string {
  const clone = card.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.removeAttribute('data-action');
  clone.removeAttribute('data-card-id');
  clone.removeAttribute('aria-disabled');
  clone.removeAttribute('tabindex');
  clone.setAttribute('aria-hidden', 'true');
  clone.classList.remove('cc-current-play-card');
  clone.querySelectorAll<HTMLElement>('[id],[data-action],[data-card-id]').forEach(node => {
    node.removeAttribute('id');
    node.removeAttribute('data-action');
    node.removeAttribute('data-card-id');
  });
  return clone.outerHTML;
}

function ensurePlayStack(playSlot: HTMLElement): void {
  if (playSlot.querySelector(':scope > .cc-play-stack-layer')) return;
  for (let index = 0; index < 3; index += 1) {
    const layer = document.createElement('span');
    layer.className = `cc-play-stack-layer cc-play-stack-layer--${index + 1}`;
    layer.setAttribute('aria-hidden', 'true');
    playSlot.prepend(layer);
  }
}

function ensurePileLayout(): void {
  const tablePiles = document.querySelector<HTMLElement>('.table-piles');
  const playSlot = document.querySelector<HTMLElement>('#discardSlot');
  const deck = document.querySelector<HTMLElement>('#drawPileVisual');
  const playPile = playSlot?.closest<HTMLElement>('.table-pile');
  const deckPile = deck?.closest<HTMLElement>('.table-pile');
  if (!tablePiles || !playSlot || !playPile || !deckPile) return;

  playPile.classList.add('cc-current-play-pile');
  playSlot.classList.add('cc-current-play-slot');
  playSlot.setAttribute('aria-label', 'Current play pile');
  const playLabel = playPile.querySelector<HTMLElement>('.table-pile__label');
  if (playLabel) playLabel.textContent = 'Play pile';
  ensurePlayStack(playSlot);

  if (!document.querySelector('#usedDiscardSlot')) {
    const discardedPile = document.createElement('div');
    discardedPile.className = 'table-pile cc-used-discard-pile';
    discardedPile.innerHTML = '<div class="desktop-discard cc-used-discard-slot" id="usedDiscardSlot" aria-label="Discarded cards"></div><span class="table-pile__label">Discarded</span>';
    tablePiles.insertBefore(discardedPile, deckPile);
  }
}

function renderDiscardedHistory(): void {
  const slot = document.querySelector<HTMLElement>('#usedDiscardSlot');
  if (!slot) return;
  if (!discardedHistory.length) {
    slot.innerHTML = '<span class="cc-discard-empty" aria-hidden="true"></span>';
    return;
  }

  slot.innerHTML = discardedHistory
    .slice(-4)
    .map((markup, index, visible) => `<span class="cc-used-discard-card cc-used-discard-card--${Math.min(index + 1, 4)}" style="--cc-discard-depth:${visible.length - index}">${markup}</span>`)
    .join('');
}

function syncPilePresentation(): void {
  if (syncingPilePresentation) return;
  syncingPilePresentation = true;
  try {
    ensurePileLayout();
    const playSlot = document.querySelector<HTMLElement>('#discardSlot');
    if (!playSlot) return;
    ensurePlayStack(playSlot);

    const current = playSlot.querySelector<HTMLElement>(':scope > .game-card');
    if (!current) return;
    current.classList.add('cc-current-play-card');

    const nextKey = cardKey(current);
    const nextMarkup = presentationMarkup(current);
    if (currentPlayKey && nextKey !== currentPlayKey && currentPlayMarkup) {
      discardedHistory.push(currentPlayMarkup);
      if (discardedHistory.length > 8) discardedHistory.splice(0, discardedHistory.length - 8);
      renderDiscardedHistory();
    }
    currentPlayKey = nextKey;
    currentPlayMarkup = nextMarkup;
  } finally {
    syncingPilePresentation = false;
  }
}

function hydrateBoard(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.game-card').forEach(hydrateFace);
  hydrateBacks(root);
  syncPilePresentation();
}

export function startCanonicalBoardCardHydration(): () => void {
  ensurePileLayout();
  renderDiscardedHistory();
  hydrateBoard();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches('.game-card')) hydrateFace(node);
        hydrateBoard(node);
      }
    }
    syncPilePresentation();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

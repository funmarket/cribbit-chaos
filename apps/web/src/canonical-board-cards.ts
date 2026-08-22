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

function hydrateBoard(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.game-card').forEach(hydrateFace);
  hydrateBacks(root);
}

export function startCanonicalBoardCardHydration(): () => void {
  hydrateBoard();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches('.game-card')) hydrateFace(node);
        hydrateBoard(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

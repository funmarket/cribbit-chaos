type StaticCardRenderer<T> = (card: T) => string;

type PileSlots = {
  playSlot: HTMLElement;
  discardedSlot: HTMLElement;
};

/**
 * Web-only board composition helper.
 *
 * This runs synchronously from the existing Simulation/Live render paths. It
 * does not observe, clone, move, or replace interactive hand/deck controls.
 * The only element it may add is the passive middle discarded-card slot.
 */
export function ensureWebPileLayout(): PileSlots | null {
  const tablePiles = document.querySelector<HTMLElement>('.table-piles');
  const playSlot = document.querySelector<HTMLElement>('#discardSlot');
  const deckControl = document.querySelector<HTMLElement>('#drawPileVisual');
  const playPile = playSlot?.closest<HTMLElement>('.table-pile');
  const deckPile = deckControl?.closest<HTMLElement>('.table-pile');

  if (!tablePiles || !playSlot || !playPile || !deckPile) return null;

  tablePiles.classList.add('cc-three-piles');
  playPile.classList.add('cc-play-pile');
  playSlot.classList.add('cc-play-pile-slot');
  playSlot.setAttribute('aria-label', 'Current play pile');

  const playLabel = playPile.querySelector<HTMLElement>('.table-pile__label');
  if (playLabel) playLabel.textContent = 'Play pile';

  let discardedSlot = document.querySelector<HTMLElement>('#usedDiscardSlot');
  if (!discardedSlot) {
    const discardedPile = document.createElement('div');
    discardedPile.className = 'table-pile cc-used-discard-pile';
    discardedPile.innerHTML = [
      '<div class="desktop-discard cc-used-discard-slot" id="usedDiscardSlot" aria-label="Discarded cards"></div>',
      '<span class="table-pile__label">Discarded</span>',
    ].join('');
    tablePiles.insertBefore(discardedPile, deckPile);
    discardedSlot = discardedPile.querySelector<HTMLElement>('#usedDiscardSlot');
  }

  if (!discardedSlot) return null;
  return { playSlot, discardedSlot };
}

export function buildPlayPileMarkup<T>(cards: readonly T[], renderStaticCard: StaticCardRenderer<T>): string {
  const top = cards.at(-1);
  if (!top) return '<span class="cc-pile-empty" aria-hidden="true"></span>';

  return [
    '<div class="discard-stack cc-play-pile-stack" aria-label="Current play pile stack">',
    '<span class="cc-play-pile-backing cc-play-pile-backing--3" aria-hidden="true"></span>',
    '<span class="cc-play-pile-backing cc-play-pile-backing--2" aria-hidden="true"></span>',
    '<span class="cc-play-pile-backing cc-play-pile-backing--1" aria-hidden="true"></span>',
    `<div class="discard-layer is-top cc-play-pile-top" style="--dx:0px;--dy:0px;--rot:0deg;--scale:1;--op:1;--z:5">${renderStaticCard(top)}</div>`,
    '</div>',
  ].join('');
}

export function buildDiscardedPileMarkup<T>(cards: readonly T[], renderStaticCard: StaticCardRenderer<T>): string {
  const discarded = cards.slice(0, -1).slice(-4);
  if (!discarded.length) return '<span class="cc-pile-empty" aria-hidden="true"></span>';

  const layers = discarded.map((card, index) => {
    const depth = discarded.length - index - 1;
    const direction = index % 2 === 0 ? -1 : 1;
    const dx = depth * 3 * direction;
    const dy = depth * 2;
    const rotation = depth * 1.7 * direction;
    const scale = 1 - Math.min(0.045, depth * 0.012);
    const opacity = 0.55 + (index / Math.max(1, discarded.length - 1)) * 0.45;
    const topClass = index === discarded.length - 1 ? ' is-top' : '';

    return `<div class="discard-layer cc-used-discard-card${topClass}" style="--dx:${dx}px;--dy:${dy}px;--rot:${rotation}deg;--scale:${scale};--op:${opacity};--z:${index + 1}">${renderStaticCard(card)}</div>`;
  }).join('');

  return `<div class="discard-stack cc-used-discard-stack" aria-label="Discarded card stack">${layers}</div>`;
}

export function renderWebPiles<T>(cards: readonly T[], renderStaticCard: StaticCardRenderer<T>): void {
  const slots = ensureWebPileLayout();
  if (!slots) return;

  slots.playSlot.innerHTML = buildPlayPileMarkup(cards, renderStaticCard);
  slots.discardedSlot.innerHTML = buildDiscardedPileMarkup(cards, renderStaticCard);
}

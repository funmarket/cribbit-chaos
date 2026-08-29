import './pile-presentation.css';

type PileCard = {
  id?: string;
  kind: string;
  color?: string;
  value?: number;
};

type PileSlots = {
  playSlot: HTMLElement;
  discardedSlot: HTMLElement;
};

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char] || char);
}

function titleForCard(card: PileCard): string {
  if (card.kind === 'number') return `${card.color ?? ''} ${card.value ?? ''}`.trim();
  return card.kind.replaceAll('_',' ').replace(/\b\w/g, char => char.toUpperCase());
}

function renderStaticCard(card: PileCard): string {
  const kind = escapeHTML(card.kind);
  const color = card.color ? ` data-color="${escapeHTML(card.color)}"` : '';
  const number = card.kind === 'number'
    ? `<span class="game-card__icon is-number">${escapeHTML(card.value)}</span>`
    : '<span class="game-card__icon" aria-hidden="true"></span>';

  return `<div class="game-card game-card--mini cc-passive-pile-card" data-kind="${kind}"${color} data-legal="false" aria-label="${escapeHTML(titleForCard(card))}" aria-hidden="true"><strong class="game-card__title">${escapeHTML(titleForCard(card))}</strong>${number}</div>`;
}

/**
 * Web-only board composition helper.
 *
 * This is deliberately passive. It never clones/moves interactive controls,
 * never rewrites the hand, and never takes ownership of #discardSlot. The
 * existing Simulation and Live renderers continue to own the current top card.
 * The only added DOM is a passive middle discarded-card slot.
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

export function buildDiscardedPileMarkup(cards: readonly PileCard[]): string {
  const discarded = cards.slice(0, -1).slice(-4);
  if (!discarded.length) return '<span class="cc-pile-empty" aria-hidden="true"></span>';

  const layers = discarded.map((card, index) => {
    const depth = discarded.length - index - 1;
    const direction = index % 2 === 0 ? -1 : 1;
    const dx = depth * 3 * direction;
    const dy = depth * 2;
    const rotation = depth * 1.7 * direction;
    const scale = 1 - Math.min(0.045, depth * 0.012);
    const opacity = 0.58 + (index / Math.max(1, discarded.length - 1)) * 0.42;
    const topClass = index === discarded.length - 1 ? ' is-top' : '';

    return `<div class="discard-layer cc-used-discard-card${topClass}" style="--dx:${dx}px;--dy:${dy}px;--rot:${rotation}deg;--scale:${scale};--op:${opacity};--z:${index + 1}">${renderStaticCard(card)}</div>`;
  }).join('');

  return `<div class="discard-stack cc-used-discard-stack" aria-label="Discarded card stack">${layers}</div>`;
}

export function renderDiscardedPile(cards: readonly PileCard[]): void {
  const slots = ensureWebPileLayout();
  if (!slots) return;
  slots.discardedSlot.innerHTML = buildDiscardedPileMarkup(cards);
}

/**
 * Simulation is still compatibility/local state. Keep this adapter presentation
 * only: it reads the already-authoritative local session object and updates only
 * the passive middle pile when that discard sequence changes.
 */
export function startSimulationDiscardedPileSync(): () => void {
  let previousSignature = '';
  const timer = window.setInterval(() => {
    const runtime = (window as Window & {
      __CRIBBIT_CANONICAL_GAME__?: { state?: { active?: boolean; session?: { discard?: PileCard[] } } };
    }).__CRIBBIT_CANONICAL_GAME__;
    const session = runtime?.state?.session;
    const meta = document.querySelector<HTMLElement>('#gameRoomMeta')?.textContent ?? '';

    if (!runtime?.state?.active || !session?.discard || !meta.includes('Canonical GameRules.md')) return;

    const signature = session.discard.map(card => card.id ?? `${card.kind}:${card.color ?? ''}:${card.value ?? ''}`).join('|');
    if (signature === previousSignature && document.querySelector('#usedDiscardSlot')) return;
    previousSignature = signature;
    renderDiscardedPile(session.discard);
  }, 120);

  ensureWebPileLayout();
  return () => window.clearInterval(timer);
}

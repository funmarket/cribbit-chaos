/**
 * What this does: presentation-only page switching for the shared application
 * template. Clicks on the existing [data-nav] controls activate the matching
 * existing [data-view] section and mark the current navigation state.
 * Key invariant: this controller owns no gameplay, session, room, rule, deck or
 * turn state and imports no game runtime; it never starts, resolves or advances
 * a game, and it never decides what a page contains.
 * Explicitly out of scope: view content rendering, board/library/create tab
 * state, session availability gating and every authoritative game transition.
 */

const NAV_VIEW_TOKEN = /^[a-z][a-z0-9-]*$/;

export interface SharedNavigationControl {
  getAttribute(name: string): string | null;
}

export interface SharedNavigationElement {
  dataset: Record<string, string | undefined>;
  classList: { toggle(token: string, force?: boolean): unknown };
  setAttribute(name: string, value: string): void;
}

export interface SharedNavigationRoot {
  querySelector(selector: string): SharedNavigationElement | null;
  querySelectorAll(selector: string): ArrayLike<SharedNavigationElement>;
}

/** Resolve the destination view declared by an existing [data-nav] control. */
export function navigationViewFor(control: SharedNavigationControl): string | null {
  const requested = control.getAttribute('data-nav')?.trim().toLowerCase() ?? '';
  return NAV_VIEW_TOKEN.test(requested) ? requested : null;
}

/**
 * Activate one existing view section and mark the current navigation state.
 * Returns false when the template has no such view, so nothing is faked.
 */
export function activateSharedView(view: string, root: SharedNavigationRoot): boolean {
  if (!NAV_VIEW_TOKEN.test(view)) return false;
  const target = root.querySelector(`.view[data-view="${view}"]`);
  if (!target) return false;

  for (const section of Array.from(root.querySelectorAll('.view'))) {
    section.classList.toggle('is-active', section.dataset.view === view);
  }

  for (const control of Array.from(root.querySelectorAll('[data-nav]'))) {
    control.setAttribute('aria-current', control.dataset.nav === view ? 'page' : 'false');
  }

  root.querySelector('body')?.classList.toggle('is-game-view', view === 'game');
  return true;
}

const installedRoots = new WeakSet<Document>();

/**
 * Install the delegated navigation controller once per document.
 * Presentation only: it reads [data-nav] / [data-view] / data-room-anchor and
 * the mobile navigation dialog, and writes only classes and attributes.
 */
export function installSharedNavigation(target: Document): void {
  if (installedRoots.has(target)) return;
  installedRoots.add(target);

  const root = target as unknown as SharedNavigationRoot;

  target.addEventListener('click', event => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;

    const navControl = origin.closest<HTMLElement>('[data-nav]');
    if (navControl) {
      const view = navigationViewFor(navControl);
      if (!view) return;

      event.preventDefault();
      navControl.closest<HTMLDialogElement>('dialog[open]')?.close();
      if (!activateSharedView(view, root)) return;

      if (view === 'game' && target.activeElement instanceof HTMLElement) {
        target.activeElement.blur();
      }

      resetSharedViewScroll(target);

      const anchor = navControl.getAttribute('data-room-anchor');
      if (anchor) scrollToRoomAnchor(target, anchor);
      return;
    }

    const mobileNavTrigger = origin.closest('[data-action="open-mobile-nav"]');
    if (!mobileNavTrigger) return;

    const dialog = target.querySelector<HTMLDialogElement>('#mobileNavDialog');
    if (!dialog) return;

    event.preventDefault();
    if (!dialog.open) dialog.showModal();
  });
}

function resetSharedViewScroll(target: Document): void {
  const view = target.defaultView;
  if (!view) return;

  const root = target.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  root.scrollTop = 0;
  target.body.scrollTop = 0;
  view.scrollTo(0, 0);

  view.requestAnimationFrame(() => {
    root.scrollTop = 0;
    target.body.scrollTop = 0;
    view.scrollTo(0, 0);
    root.style.scrollBehavior = previous;
  });
}

function scrollToRoomAnchor(target: Document, anchor: string): void {
  const view = target.defaultView;
  if (!view) return;

  view.requestAnimationFrame(() => {
    const preferred = typeof view.matchMedia === 'function'
      && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.getElementById(anchor)?.scrollIntoView({
      block: 'start',
      behavior: preferred ? 'auto' : 'smooth',
    });
  });
}

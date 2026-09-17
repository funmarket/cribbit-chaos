export const ROOM_CREATION_ID = 'roomCreation';
export const ROOM_CREATION_HASH = `#${ROOM_CREATION_ID}`;

type ScrollTarget = {
  scrollIntoView(options?: ScrollIntoViewOptions): void;
};

export function isRoomCreationHash(hash: string): boolean {
  if (!hash.startsWith('#')) return false;
  try {
    return decodeURIComponent(hash.slice(1)) === ROOM_CREATION_ID;
  } catch {
    return false;
  }
}

export function normalizeTrailingDotHostname(hostname: string): string {
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

export function scrollRoomCreationTarget(
  hash: string,
  findTarget: (id: string) => ScrollTarget | null,
): boolean {
  if (!isRoomCreationHash(hash)) return false;
  const target = findTarget(ROOM_CREATION_ID);
  if (!target) return false;
  target.scrollIntoView({ behavior: 'auto', block: 'start' });
  return true;
}

/**
 * Web-only deep-link adapter for the dynamically mounted lobby setup panel.
 *
 * The initial HTML only contains #app. main.ts mounts the shared template and
 * assigns #roomCreation synchronously before its first await. This adapter is
 * loaded immediately after main.ts and re-applies the hash once layout exists,
 * then keeps later hash navigation deterministic on mobile and desktop.
 */
export function installRoomCreationDeepLink(): () => void {
  const normalizedHostname = normalizeTrailingDotHostname(window.location.hostname);
  if (normalizedHostname && normalizedHostname !== window.location.hostname) {
    const normalizedUrl = new URL(window.location.href);
    normalizedUrl.hostname = normalizedHostname;
    window.location.replace(normalizedUrl.href);
    return () => undefined;
  }

  let frameOne = 0;
  let frameTwo = 0;

  const cancelScheduledScroll = (): void => {
    if (frameOne) window.cancelAnimationFrame(frameOne);
    if (frameTwo) window.cancelAnimationFrame(frameTwo);
    frameOne = 0;
    frameTwo = 0;
  };

  const applyHash = (): void => {
    cancelScheduledScroll();
    if (!isRoomCreationHash(window.location.hash)) return;

    // Two frames let the dynamically mounted lobby and responsive mobile layout
    // settle before calculating the final target position.
    frameOne = window.requestAnimationFrame(() => {
      frameOne = 0;
      frameTwo = window.requestAnimationFrame(() => {
        frameTwo = 0;
        scrollRoomCreationTarget(
          window.location.hash,
          id => document.getElementById(id),
        );
      });
    });
  };

  window.addEventListener('hashchange', applyHash);
  window.addEventListener('load', applyHash, { once: true });
  applyHash();

  return () => {
    cancelScheduledScroll();
    window.removeEventListener('hashchange', applyHash);
    window.removeEventListener('load', applyHash);
  };
}

const DESKTOP_RAIL_QUERY = '(min-width: 901px)';

let originalParent: HTMLElement | null = null;
let originalNextSibling: ChildNode | null = null;
let safetyHost: HTMLElement | null = null;

function ensureSafetyHost(rightRail: HTMLElement): HTMLElement | null {
  const panelBody = rightRail.querySelector<HTMLElement>(':scope > .panel-body');
  if (!panelBody) return null;

  if (safetyHost?.isConnected) return safetyHost;

  const host = document.createElement('section');
  host.className = 'cc-web-safety-rail';
  host.setAttribute('aria-label', 'Safety controls');
  host.innerHTML = `
    <div class="cc-web-safety-rail__header">
      <b>Safety</b>
      <span>Always available</span>
    </div>
  `;

  panelBody.append(host);
  safetyHost = host;
  return host;
}

function restoreSafetyBar(bar: HTMLElement): void {
  if (!originalParent) return;

  bar.classList.remove('cc-web-safety-rail__grid');

  if (originalNextSibling?.parentNode === originalParent) {
    originalParent.insertBefore(bar, originalNextSibling);
  } else {
    originalParent.append(bar);
  }

  safetyHost?.remove();
  safetyHost = null;
}

function syncSafetyControls(): void {
  const bar = document.querySelector<HTMLElement>('.desktop-safety-bar');
  const rightRail = document.querySelector<HTMLElement>('#rightRail');

  if (!bar || !rightRail) return;

  if (!originalParent) {
    originalParent = bar.parentElement;
    originalNextSibling = bar.nextSibling;
  }

  if (!window.matchMedia(DESKTOP_RAIL_QUERY).matches) {
    restoreSafetyBar(bar);
    return;
  }

  const host = ensureSafetyHost(rightRail);
  if (!host) return;

  bar.classList.add('cc-web-safety-rail__grid');
  if (bar.parentElement !== host) host.append(bar);
}

function initializeWebSafetyRail(): void {
  const media = window.matchMedia(DESKTOP_RAIL_QUERY);
  const observer = new MutationObserver(syncSafetyControls);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  media.addEventListener('change', syncSafetyControls);
  window.addEventListener('resize', syncSafetyControls, { passive: true });

  syncSafetyControls();
}

initializeWebSafetyRail();

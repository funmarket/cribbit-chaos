export type FeedbackTone =
  | 'cyan'
  | 'lime'
  | 'magenta'
  | 'orange'
  | 'gold'
  | 'red';

const TONE_COLORS: Record<FeedbackTone, string> = {
  cyan: 'var(--cyan)',
  lime: 'var(--lime)',
  magenta: 'var(--magenta)',
  orange: 'var(--orange)',
  gold: 'var(--gold)',
  red: 'var(--red)'
};

function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[character] ?? character
  );
}

export function toast(
  title: string,
  message: string,
  tone: FeedbackTone = 'cyan',
  duration = 3200
): void {
  const region = document.querySelector<HTMLElement>('#toastRegion');

  if (!region) {
    throw new Error(
      'Feedback toast owner requires #toastRegion to exist in the mounted composition.'
    );
  }

  const node = document.createElement('div');
  node.className = 'toast';
  node.style.setProperty('--toast-color', TONE_COLORS[tone]);
  node.innerHTML =
    `<b>${escapeHTML(title)}</b>` +
    `<p>${escapeHTML(message)}</p>`;

  region.append(node);

  window.setTimeout(() => {
    node.remove();
  }, duration);
}

export function announce(message: string): void {
  const node = document.querySelector<HTMLElement>('#liveRegion');

  if (!node) {
    throw new Error(
      'Feedback announcer requires #liveRegion to exist in the mounted composition.'
    );
  }

  node.textContent = '';

  requestAnimationFrame(() => {
    node.textContent = message;
  });
}

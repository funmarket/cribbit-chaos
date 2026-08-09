import type { PlatformAdapter, LaunchIdentityPreview } from './types.ts';

export class BrowserPlatform implements PlatformAdapter {
  readonly kind = 'web' as const;
  private backHandler: (() => void) | null = null;

  initialize(): void {
    document.documentElement.dataset.platform = 'web';
  }

  getRawAuthPayload(): string | null { return null; }

  getIdentityPreview(): LaunchIdentityPreview {
    return { provider: 'web', trusted: false, displayName: 'Web Player' };
  }

  haptic(): void { /* Browser: intentionally no-op. */ }

  setBackHandler(handler: (() => void) | null): void {
    if (this.backHandler) window.removeEventListener('popstate', this.backHandler);
    this.backHandler = handler;
    if (handler) window.addEventListener('popstate', handler);
  }

  enableCloseConfirmation(enabled: boolean): void {
    window.onbeforeunload = enabled ? () => '' : null;
  }

  async shareRoom(url: string): Promise<void> {
    if (navigator.share) {
      await navigator.share({ title: 'Cribbit CHAOS', url });
      return;
    }
    window.prompt('Copy room link', url);
  }
}

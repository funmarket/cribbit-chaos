import type { PlatformAdapter, LaunchIdentityPreview } from './types.ts';

type TgUser = { id?: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { user?: TgUser; start_param?: string; chat_type?: string; chat_instance?: string };
  colorScheme?: string;
  platform?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: { impactOccurred(style: string): void; notificationOccurred(type: string): void };
  openTelegramLink?: (url: string) => void;
};

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp }; }
}

export class TelegramPlatform implements PlatformAdapter {
  readonly kind = 'telegram' as const;
  private backHandler: (() => void) | null = null;
  private get tg(): TelegramWebApp | undefined { return window.Telegram?.WebApp; }

  initialize(): void {
    document.documentElement.dataset.platform = 'telegram';
    this.tg?.ready?.();
    this.tg?.expand?.();
    this.tg?.setHeaderColor?.('#05060a');
    this.tg?.setBackgroundColor?.('#05060a');
    this.tg?.setBottomBarColor?.('#05060a');
  }

  getRawAuthPayload(): string | null {
    return this.tg?.initData || null;
  }

  getIdentityPreview(): LaunchIdentityPreview {
    const user = this.tg?.initDataUnsafe?.user;
    const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Telegram Player';
    return {
      provider: 'telegram',
      providerUserId: user?.id ? String(user.id) : undefined,
      displayName,
      username: user?.username,
      languageCode: user?.language_code,
      trusted: false
    };
  }

  haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'): void {
    if (kind === 'success' || kind === 'warning' || kind === 'error') this.tg?.HapticFeedback?.notificationOccurred(kind);
    else this.tg?.HapticFeedback?.impactOccurred(kind);
  }

  setBackHandler(handler: (() => void) | null): void {
    if (this.backHandler) this.tg?.BackButton?.offClick(this.backHandler);
    this.backHandler = handler;
    if (handler) {
      this.tg?.BackButton?.onClick(handler);
      this.tg?.BackButton?.show();
    } else {
      this.tg?.BackButton?.hide();
    }
  }

  enableCloseConfirmation(enabled: boolean): void {
    if (enabled) this.tg?.enableClosingConfirmation?.();
    else this.tg?.disableClosingConfirmation?.();
  }

  async shareRoom(url: string): Promise<void> {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Join my Cribbit CHAOS room')}`;
    this.tg?.openTelegramLink?.(shareUrl);
  }
}

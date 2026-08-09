export type ClientPlatform = 'web' | 'telegram';

export interface LaunchIdentityPreview {
  provider: 'telegram' | 'web';
  providerUserId?: string;
  displayName?: string;
  username?: string;
  languageCode?: string;
  trusted: boolean;
}

export interface PlatformAdapter {
  readonly kind: ClientPlatform;
  initialize(): void;
  destroy?(): void;
  getRawAuthPayload(): string | null;
  getIdentityPreview(): LaunchIdentityPreview;
  getStartParam(): string | null;
  haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'): void;
  setBackHandler(handler: (() => void) | null): void;
  enableCloseConfirmation(enabled: boolean): void;
  shareRoom(url: string): Promise<void>;
  requestFullscreen(): Promise<boolean>;
  exitFullscreen(): Promise<boolean>;
  isFullscreen(): boolean;
}

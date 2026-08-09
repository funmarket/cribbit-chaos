import type { PlatformAdapter, LaunchIdentityPreview } from './types.ts';

type TgUser = { id?: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
type Insets = { top:number; bottom:number; left:number; right:number };
type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { user?: TgUser; start_param?: string; chat_type?: string; chat_instance?: string };
  colorScheme?: string; platform?: string; version?: string;
  isFullscreen?: boolean; isExpanded?: boolean; viewportHeight?: number; viewportStableHeight?: number;
  safeAreaInset?: Insets; contentSafeAreaInset?: Insets;
  ready?: () => void; expand?: () => void;
  requestFullscreen?: () => void; exitFullscreen?: () => void;
  setHeaderColor?: (color:string)=>void; setBackgroundColor?: (color:string)=>void; setBottomBarColor?: (color:string)=>void;
  enableClosingConfirmation?: () => void; disableClosingConfirmation?: () => void;
  BackButton?: { show():void; hide():void; onClick(cb:()=>void):void; offClick(cb:()=>void):void };
  HapticFeedback?: { impactOccurred(style:string):void; notificationOccurred(type:string):void };
  openTelegramLink?: (url:string)=>void;
  onEvent?: (event:string, cb:()=>void)=>void; offEvent?: (event:string, cb:()=>void)=>void;
};

declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp }; } }

export class TelegramPlatform implements PlatformAdapter {
  readonly kind = 'telegram' as const;
  private backHandler: (()=>void)|null = null;
  private readonly syncViewportBound = () => { this.syncViewportVars(); window.dispatchEvent(new Event('cribbit:fullscreenchange')); };
  private get tg(): TelegramWebApp | undefined { return window.Telegram?.WebApp; }

  initialize(): void {
    document.documentElement.dataset.platform = 'telegram';
    this.tg?.ready?.();
    this.tg?.expand?.();
    this.tg?.setHeaderColor?.('#05060a');
    this.tg?.setBackgroundColor?.('#05060a');
    this.tg?.setBottomBarColor?.('#05060a');
    this.syncViewportVars();
    ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'].forEach(name => this.tg?.onEvent?.(name, this.syncViewportBound));
  }

  destroy(): void { ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'].forEach(name => this.tg?.offEvent?.(name, this.syncViewportBound)); }

  private syncViewportVars(): void {
    const root = document.documentElement;
    const safe = this.tg?.safeAreaInset;
    const content = this.tg?.contentSafeAreaInset;
    const stable = this.tg?.viewportStableHeight || this.tg?.viewportHeight;
    if (stable) root.style.setProperty('--cribbit-platform-height', `${stable}px`);
    const values = {
      '--cribbit-safe-top': content?.top ?? safe?.top ?? 0,
      '--cribbit-safe-right': content?.right ?? safe?.right ?? 0,
      '--cribbit-safe-bottom': content?.bottom ?? safe?.bottom ?? 0,
      '--cribbit-safe-left': content?.left ?? safe?.left ?? 0
    } as const;
    Object.entries(values).forEach(([key,value]) => root.style.setProperty(key, `${value}px`));
  }

  getRawAuthPayload(): string | null { return this.tg?.initData || null; }
  getStartParam(): string | null { return this.tg?.initDataUnsafe?.start_param || new URL(location.href).searchParams.get('tgWebAppStartParam'); }
  getIdentityPreview(): LaunchIdentityPreview {
    const user = this.tg?.initDataUnsafe?.user;
    return {
      provider:'telegram', providerUserId:user?.id ? String(user.id) : undefined,
      displayName:[user?.first_name,user?.last_name].filter(Boolean).join(' ') || 'Telegram Player',
      username:user?.username, languageCode:user?.language_code, trusted:false
    };
  }
  haptic(kind:'light'|'medium'|'heavy'|'success'|'warning'|'error'): void {
    if (['success','warning','error'].includes(kind)) this.tg?.HapticFeedback?.notificationOccurred(kind);
    else this.tg?.HapticFeedback?.impactOccurred(kind);
  }
  setBackHandler(handler:(()=>void)|null): void {
    if (this.backHandler) this.tg?.BackButton?.offClick(this.backHandler);
    this.backHandler = handler;
    if (handler) { this.tg?.BackButton?.onClick(handler); this.tg?.BackButton?.show(); }
    else this.tg?.BackButton?.hide();
  }
  enableCloseConfirmation(enabled:boolean): void { enabled ? this.tg?.enableClosingConfirmation?.() : this.tg?.disableClosingConfirmation?.(); }
  async shareRoom(url:string): Promise<void> {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Join my Cribbit CHAOS room')}`;
    this.tg?.openTelegramLink?.(shareUrl);
  }
  async requestFullscreen(): Promise<boolean> {
    if (!this.tg?.requestFullscreen) return false;
    try { this.tg.requestFullscreen(); return true; } catch { return false; }
  }
  async exitFullscreen(): Promise<boolean> {
    if (!this.tg?.exitFullscreen) return false;
    try { this.tg.exitFullscreen(); return true; } catch { return false; }
  }
  isFullscreen(): boolean { return Boolean(this.tg?.isFullscreen); }
}

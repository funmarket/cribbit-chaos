import { cribbitSessionTokenStore } from '../../../packages/api-client/src/session-token-store.ts';
import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { cribbitAuth } from '../../../packages/ui/src/auth-controller.ts';
import { bootstrapTelegram } from './bootstrapTelegram.ts';
import './styles/hardening.css';

const platform = new TelegramPlatform();
const params = new URLSearchParams(location.search);
const compatibilityFixture = params.get('compat') === '1' && Boolean(params.get('fixture'));

type TelegramPopupButton = { id?: string; type?: 'default'|'ok'|'close'|'cancel'|'destructive'; text?: string };
type TelegramNativeExtras = {
  close?: () => void;
  showPopup?: (
    params: {
      title?: string;
      message: string;
      buttons?: TelegramPopupButton[];
    },
    callback?: (buttonId: string) => void,
  ) => void;
};

function nativeTelegram(): TelegramNativeExtras | undefined {
  return window.Telegram?.WebApp as TelegramNativeExtras | undefined;
}

function setVisibleAuthState(connected: boolean): void {
  const authState = document.querySelector<HTMLElement>('[data-auth-state]');
  if (authState) {
    authState.textContent = connected ? 'Connected' : 'Auth unavailable';
    authState.dataset.state = connected ? 'success' : 'warning';
  }
}

function setVisibleStatus(text: string, tone: 'neutral'|'success'|'warning' = 'neutral'): void {
  const status = document.querySelector<HTMLElement>('[data-action-status],[data-game-status]');
  if (!status) return;
  status.textContent = text;
  status.dataset.tone = tone;
}

async function restorePersistedAuthSession(): Promise<boolean> {
  if (window.__CRIBBIT_AUTH__) {
    cribbitAuth.authenticated(window.__CRIBBIT_AUTH__.user,'TELEGRAM');
    return true;
  }
  const token = cribbitSessionTokenStore.get();
  const api = window.__CRIBBIT_API__;
  if (!token || !api) {
    cribbitAuth.guest();
    return false;
  }

  try {
    const me = await api.getMe();
    window.__CRIBBIT_AUTH__ = { accessToken:token, user:me.user };
    cribbitAuth.authenticated(me.user,'TELEGRAM');
    setVisibleAuthState(true);
    return true;
  } catch (error) {
    console.warn('[Cribbit] Persisted Telegram session could not be restored.', error);
    cribbitSessionTokenStore.clear();
    delete window.__CRIBBIT_AUTH__;
    cribbitAuth.guest();
    setVisibleAuthState(false);
    return false;
  }
}

function openTopMenu(): void {
  platform.haptic('light');
  const connected = Boolean(window.__CRIBBIT_AUTH__) || Boolean(cribbitSessionTokenStore.get());
  const inGame = Boolean(document.querySelector('[data-game-simulation]'));
  const tg = nativeTelegram();

  const buttons: TelegramPopupButton[] = inGame
    ? [
        { id:'room', type:'default', text:'Room Setup' },
        { id:'account', type:'default', text:connected ? 'Account: Connected' : 'Account: Reconnect' },
        { id:'close', type:'destructive', text:'Close App' },
      ]
    : [
        { id:'simulation', type:'default', text:'Start Simulation' },
        { id:'account', type:'default', text:connected ? 'Account: Connected' : 'Account: Reconnect' },
        { id:'close', type:'destructive', text:'Close App' },
      ];

  const handleChoice = (buttonId: string): void => {
    if (buttonId === 'simulation') {
      document.querySelector<HTMLButtonElement>('[data-action="demo-game"]')?.click();
      return;
    }
    if (buttonId === 'room') {
      document.querySelector<HTMLButtonElement>('[data-game-back]')?.click();
      return;
    }
    if (buttonId === 'account') {
      void restorePersistedAuthSession().then(ok => {
        setVisibleStatus(
          ok ? 'Telegram identity is connected to the shared Cribbit account.' : 'Telegram authentication is not established for this launch.',
          ok ? 'success' : 'warning',
        );
      });
      return;
    }
    if (buttonId === 'close') nativeTelegram()?.close?.();
  };

  if (tg?.showPopup) {
    tg.showPopup(
      {
        title:'Cribbit Chaos',
        message:connected ? 'Live account connected.' : 'Live account needs authentication. Simulation is still available.',
        buttons,
      },
      handleChoice,
    );
    return;
  }

  const fallback = document.createElement('div');
  fallback.setAttribute('data-tg-menu-fallback', '');
  fallback.style.position = 'fixed';
  fallback.style.inset = '0';
  fallback.style.zIndex = '9999';
  fallback.style.display = 'grid';
  fallback.style.placeItems = 'end center';
  fallback.style.padding = '16px';
  fallback.style.background = 'rgba(0,0,0,.62)';
  fallback.innerHTML = `
    <section class="tg-setup-card" style="width:min(100%,430px);display:grid;gap:8px" role="dialog" aria-modal="true" aria-label="Cribbit menu">
      <div class="tg-section-label"><span>Cribbit Menu</span><small>${connected ? 'Account connected' : 'Authentication required'}</small></div>
      ${buttons.map(button => `<button class="tg-button" type="button" data-menu-choice="${button.id ?? ''}">${button.text ?? button.id ?? 'Action'}</button>`).join('')}
      <button class="tg-button" type="button" data-menu-dismiss>Cancel</button>
    </section>`;
  fallback.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target : null;
    const choice = element?.closest<HTMLElement>('[data-menu-choice]')?.dataset.menuChoice;
    if (choice) {
      fallback.remove();
      handleChoice(choice);
      return;
    }
    if (element?.matches('[data-menu-dismiss]') || element === fallback) fallback.remove();
  });
  document.body.append(fallback);
}

// Capture live-room actions before the page-specific handler. A valid bearer
// session is stored in sessionStorage, while window globals are reset by a
// Mini App reload. Restore the authoritative user first, then replay the click.
document.addEventListener('click', event => {
  const element = event.target instanceof Element ? event.target : null;
  const liveAction = element?.closest<HTMLButtonElement>('[data-action="create-game"],[data-action="join-room"]');
  if (!liveAction || window.__CRIBBIT_AUTH__) return;
  if (!cribbitSessionTokenStore.get() || !window.__CRIBBIT_API__) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  void restorePersistedAuthSession().then(ok => {
    if (ok) liveAction.click();
    else setVisibleStatus('Live game authentication is not established. Reopen the Mini App from Telegram or use Simulation.', 'warning');
  });
}, true);

// The approved header already contains these controls. Keep the appearance and
// give both room and game screens the same functional top menu.
document.addEventListener('click', event => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-tg-back],[data-tg-menu],[data-game-info]')
    : null;
  if (!target) return;

  if (target.matches('[data-tg-back]')) {
    platform.haptic('light');
    nativeTelegram()?.close?.();
    return;
  }

  if (target.matches('[data-tg-menu],[data-game-info]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openTopMenu();
  }
}, true);

if (compatibilityFixture) {
  void import('../../../packages/ui/src/bootstrap.ts').then(({ bootstrap, mountSharedTemplate }) => {
    mountSharedTemplate();
    return bootstrap(platform, { runtimeMode:'legacy-compatibility' });
  });
} else {
  cribbitAuth.loading();
  void bootstrapTelegram(platform).then(() => {
    void restorePersistedAuthSession();
  });
}

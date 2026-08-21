import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { bootstrapTelegram } from './bootstrapTelegram.ts';
import './styles/hardening.css';

const platform = new TelegramPlatform();
const params = new URLSearchParams(location.search);
const compatibilityFixture = params.get('compat') === '1' && Boolean(params.get('fixture'));

type TelegramNativeExtras = {
  close?: () => void;
  showPopup?: (params: {
    title?: string;
    message: string;
    buttons?: Array<{ id?: string; type?: 'default'|'ok'|'close'|'cancel'|'destructive'; text?: string }>;
  }) => void;
};

function nativeTelegram(): TelegramNativeExtras | undefined {
  return window.Telegram?.WebApp as TelegramNativeExtras | undefined;
}

// These controls already exist in the approved Telegram composition. Keep their
// appearance unchanged and connect them to Telegram-native behavior.
document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tg-back],[data-tg-menu]') : null;
  if (!target) return;

  if (target.matches('[data-tg-back]')) {
    platform.haptic('light');
    nativeTelegram()?.close?.();
    return;
  }

  if (target.matches('[data-tg-menu]')) {
    platform.haptic('light');
    const connected = Boolean(window.__CRIBBIT_AUTH__);
    const message = connected
      ? 'Telegram identity is connected. Create or join a live room, or use Simulation for local QA play.'
      : 'Simulation is available without authentication. Live room creation and joining require Telegram authentication.';
    const tg = nativeTelegram();
    if (tg?.showPopup) {
      tg.showPopup({
        title:'Cribbit Chaos',
        message,
        buttons:[{ type:'close' }],
      });
    } else {
      const status = document.querySelector<HTMLElement>('[data-action-status]');
      if (status) {
        status.textContent = message;
        status.dataset.tone = connected ? 'success' : 'neutral';
      }
    }
  }
});

if (compatibilityFixture) {
  void import('../../../packages/ui/src/bootstrap.ts').then(({ bootstrap, mountSharedTemplate }) => {
    mountSharedTemplate();
    return bootstrap(platform, { runtimeMode:'legacy-compatibility' });
  });
} else {
  void bootstrapTelegram(platform);
}

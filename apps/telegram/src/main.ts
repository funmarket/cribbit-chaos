import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { bootstrapTelegram } from './bootstrapTelegram.ts';
import { renderTelegramGame } from './gameView.ts';
import './styles/hardening.css';

const platform = new TelegramPlatform();
const params = new URLSearchParams(location.search);
const compatibilityFixture = params.get('compat') === '1' && Boolean(params.get('fixture'));

if (compatibilityFixture) {
  void import('../../../packages/ui/src/bootstrap.ts').then(({ bootstrap, mountSharedTemplate }) => {
    mountSharedTemplate();
    return bootstrap(platform, { runtimeMode: 'legacy-compatibility' });
  });
} else {
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-action="demo-game"]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const host = document.querySelector<HTMLDivElement>('#app');
    if (!host) return;
    renderTelegramGame(host, platform, () => {
      location.assign(location.pathname);
    });
  }, true);

  void bootstrapTelegram(platform);
}

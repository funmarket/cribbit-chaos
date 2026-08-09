import template from './template.html?raw';
import './styles.css';
import type { PlatformAdapter } from '../../platform/src/types.ts';
import { CribbitApiClient, clientConfig } from '../../api-client/src/index.ts';
import type { AuthSession } from '../../contracts/src/index.ts';

export async function bootstrap(platform: PlatformAdapter): Promise<void> {
  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) throw new Error('Missing #app host');
  host.innerHTML = template;
  platform.initialize();

  const config = clientConfig(platform.kind);
  const api = new CribbitApiClient(config);
  window.__CRIBBIT_PLATFORM__ = platform;
  window.__CRIBBIT_API__ = api;
  window.__CRIBBIT_START_PARAM__ = platform.getStartParam();

  // Telegram identity is useful for display immediately, but remains untrusted until
  // the Railway API validates the signed raw initData. Failure never breaks the UI.
  if (platform.kind === 'telegram' && config.apiUrl) {
    const initData = platform.getRawAuthPayload();
    if (initData) {
      try { window.__CRIBBIT_AUTH__ = await api.telegramAuth({ initData }); }
      catch (error) { console.warn('[Cribbit] Telegram server authentication not available yet.', error); }
    }
  }

  await import('../../legacy-runtime/src/runtime.ts');
}

declare global {
  interface Window {
    __CRIBBIT_PLATFORM__?: PlatformAdapter;
    __CRIBBIT_API__?: CribbitApiClient;
    __CRIBBIT_AUTH__?: AuthSession;
    __CRIBBIT_START_PARAM__?: string | null;
  }
}

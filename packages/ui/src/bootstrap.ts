import template from './template.html?raw';
import './styles.css';
import './compact-cards.css';
import type { PlatformAdapter } from '../../platform/src/types.ts';
import { CribbitApiClient, clientConfig } from '../../api-client/src/index.ts';
import type { AuthSession } from '../../contracts/src/index.ts';
import { resolveVisualFixture, type VisualFixtureName, VISUAL_FIXTURES } from './fixtures.ts';

export type BootstrapRuntimeMode = 'none' | 'legacy-compatibility';

export interface BootstrapOptions {
  /**
   * The legacy runtime is preview/demo compatibility only and must never load
   * implicitly. Every caller must opt into it explicitly while that caller is
   * still being migrated away from compatibility ownership.
   */
  runtimeMode: BootstrapRuntimeMode;
}

/**
 * Mount the historical shared application template explicitly.
 *
 * This is compatibility composition, not a production Web ownership model.
 * Callers that still depend on the shared template must opt into mounting it
 * before bootstrap services are initialized. Web can now remove this call
 * surface-by-surface without hidden DOM injection inside bootstrap().
 */
export function mountSharedTemplate(): HTMLDivElement {
  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) throw new Error('Missing #app host');
  host.innerHTML = template;
  return host;
}

export async function bootstrap(
  platform: PlatformAdapter,
  options: BootstrapOptions,
): Promise<void> {
  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) throw new Error('Missing #app host');

  platform.initialize();

  const config = clientConfig(platform.kind);
  const api = new CribbitApiClient(config);
  const fixture = resolveVisualFixture(location.search, platform.getStartParam());
  window.__CRIBBIT_PLATFORM__ = platform;
  window.__CRIBBIT_API__ = api;
  window.__CRIBBIT_START_PARAM__ = platform.getStartParam();
  window.__CRIBBIT_VISUAL_FIXTURE__ = fixture;
  window.__CRIBBIT_VISUAL_FIXTURE_META__ = fixture ? VISUAL_FIXTURES[fixture] : null;
  document.documentElement.dataset.fixture = fixture || '';
  if (fixture) host.dataset.fixture = fixture;
  setupWebTelegramLogin(platform.kind, api, config.apiUrl);

  // Telegram identity is useful for display immediately, but remains untrusted until
  // the Railway API validates the signed raw initData. Failure never breaks the UI.
  if (platform.kind === 'telegram' && config.apiUrl) {
    const initData = platform.getRawAuthPayload();
    if (initData) {
      try { window.__CRIBBIT_AUTH__ = await api.telegramAuth({ initData }); }
      catch (error) { console.warn('[Cribbit] Telegram server authentication not available yet.', error); }
    }
  }

  if (options.runtimeMode === 'legacy-compatibility') {
    await import('../../legacy-runtime/src/runtime.ts');
  }
}

function setupWebTelegramLogin(platformKind: PlatformAdapter['kind'], api: CribbitApiClient, apiUrl: string): void {
  const button = document.querySelector<HTMLButtonElement>('[data-action="continue-with-telegram"]');
  const status = document.querySelector<HTMLElement>('[data-auth-status]');
  if (!button || !status) return;
  if (platformKind !== 'web') {
    button.hidden = true;
    return;
  }
  if (!apiUrl) {
    status.hidden = false;
    status.textContent = 'Telegram login needs API config';
    return;
  }
  button.addEventListener('click', async () => {
    try {
      const configuration = await api.getWebTelegramLoginConfiguration();
      if (!configuration.configured) {
        status.hidden = false;
        status.textContent = 'Telegram login not configured';
        return;
      }
      api.startWebTelegramLogin();
    } catch {
      status.hidden = false;
      status.textContent = 'Telegram login unavailable';
    }
  });
}

declare global {
  interface Window {
    __CRIBBIT_PLATFORM__?: PlatformAdapter;
    __CRIBBIT_API__?: CribbitApiClient;
    __CRIBBIT_AUTH__?: AuthSession;
    __CRIBBIT_START_PARAM__?: string | null;
    __CRIBBIT_VISUAL_FIXTURE__?: VisualFixtureName | null;
    __CRIBBIT_VISUAL_FIXTURE_META__?: { name: VisualFixtureName; label: string; summary: string } | null;
  }
}

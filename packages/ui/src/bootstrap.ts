import template from './template.html?raw';
import './styles.css';
import './compact-cards.css';
import './draw-pile-card-back.css';
import type { PlatformAdapter } from '../../platform/src/types.ts';
import { ApiError, CribbitApiClient, clientConfig } from '../../api-client/src/index.ts';
import type { AuthSession } from '../../contracts/src/index.ts';
import { cribbitAuth } from './auth-controller.ts';
import { installSharedNavigation } from './navigation-controller.ts';
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

  // Page switching is shared presentation, not game authority: install it only
  // when no compatibility runtime is loaded, so no client has two owners.
  if (options.runtimeMode === 'none') {
    installSharedNavigation(document);
  installAppearance(document);
  installDiagnosticSurface(document);
  }

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

  cribbitAuth.loading();

  // Telegram identity is useful for display immediately, but remains untrusted until
  // the Railway API validates the signed raw initData. Failure never breaks the UI.
  if (platform.kind === 'telegram' && config.apiUrl) {
    const initData = platform.getRawAuthPayload();
    if (initData) {
      try {
        window.__CRIBBIT_AUTH__ = await api.telegramAuth({ initData });
        cribbitAuth.authenticated(window.__CRIBBIT_AUTH__.user, 'TELEGRAM');
      } catch (error) {
        cribbitAuth.guest();
        console.warn('[Cribbit] Telegram server authentication not available yet.', error);
      }
    } else {
      cribbitAuth.guest();
    }
  } else if (platform.kind === 'web' && config.apiUrl) {
    try {
      const session = await api.getAuthSession();
      cribbitAuth.authenticated(session.user, 'WEB');
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.warn('[Cribbit] Web session check failed.', error);
      }
      cribbitAuth.guest();
    }
  } else {
    cribbitAuth.guest();
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
    status.textContent = 'Authentication needs API config';
    return;
  }
  button.addEventListener('click', async () => {
    try {
      const configuration = await api.getWebTelegramLoginConfiguration();
      if (!configuration.configured) {
        status.hidden = false;
        status.textContent = 'Telegram Web login is optional and not configured';
        return;
      }
      api.startWebTelegramLogin();
    } catch {
      status.hidden = false;
      status.textContent = 'Telegram Web login unavailable';
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

/**
 * APP-SHELL-1 — appearance preference for the shared shell.
 *
 * Presentation only: the preference never reaches the API, never changes
 * canonical card or board data, and never touches gameplay. It is stored on the
 * document element so switching pages cannot reset it, and remembered locally
 * for the next visit.
 */
export type AppearancePreference = 'dark' | 'light';

export const APPEARANCE_STORAGE_KEY = 'cribbit.appearance';

export function resolveAppearance(stored: string | null | undefined, prefersLight: boolean): AppearancePreference {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersLight ? 'light' : 'dark';
}

function appearanceStorage(root: Document): Storage | null {
  try {
    return root.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function applyAppearance(root: Document, preference: AppearancePreference): void {
  root.documentElement.dataset.appearance = preference;
  const control = root.querySelector<HTMLElement>('[data-action="toggle-appearance"]');
  if (!control) return;
  const light = preference === 'light';
  control.setAttribute('aria-pressed', light ? 'true' : 'false');
  control.setAttribute('aria-label', light ? 'Switch to dark appearance' : 'Switch to light appearance');
}

export function installAppearance(root: Document, storage: Storage | null = appearanceStorage(root)): void {
  const prefersLight = root.defaultView?.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  let preference = resolveAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY) ?? null, prefersLight);
  applyAppearance(root, preference);
  root.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-action="toggle-appearance"]') : null;
    if (!trigger) return;
    preference = preference === 'light' ? 'dark' : 'light';
    applyAppearance(root, preference);
    try {
      storage?.setItem(APPEARANCE_STORAGE_KEY, preference);
    } catch {
      // Local storage refused: the preference still applies for this session.
    }
  });
}

/**
 * APP-SHELL-1 — diagnostic surface.
 *
 * QA/status presentation stays reachable under ?diagnostics=1 without occupying
 * or resizing the production product bar.
 */
export function installDiagnosticSurface(root: Document): void {
  const requested = new URLSearchParams(root.defaultView?.location?.search ?? '').get('diagnostics') === '1';
  const strip = root.querySelector<HTMLElement>('[data-diagnostics]');
  if (!requested || !strip) return;
  strip.hidden = false;
  root.documentElement.dataset.diagnostics = '1';
}


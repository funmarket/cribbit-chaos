import type { AuthSession, AuthUser } from '../../../packages/contracts/src/index.ts';
import { CribbitApiClient, clientConfig } from '../../../packages/api-client/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import { resolveVisualFixture, VISUAL_FIXTURES, type VisualFixtureName } from '../../../packages/ui/src/fixtures.ts';
import './styles/telegram.css';

const telegramShell = `
  <main class="tg-app" data-telegram-app>
    <header class="tg-app__header">
      <button class="tg-icon-button" type="button" aria-label="Back" data-tg-back hidden>←</button>
      <div class="tg-app__title-block">
        <strong>Cribbit Chaos</strong>
        <span>Telegram Mini App</span>
      </div>
      <button class="tg-icon-button" type="button" aria-label="Menu" data-tg-menu>•••</button>
    </header>

    <section class="tg-brand" aria-labelledby="tg-mobile-title">
      <div class="tg-brand__mark" aria-hidden="true">●</div>
      <div>
        <p class="tg-eyebrow">MOBILE GAME UI</p>
        <h1 id="tg-mobile-title">Telegram presentation foundation</h1>
        <p class="tg-brand__copy">The Telegram client now owns its mobile composition. Room creation and the game board are implemented in the next controlled slices.</p>
      </div>
    </section>

    <section class="tg-panel" aria-labelledby="tg-session-title">
      <div class="tg-panel__heading">
        <div>
          <p class="tg-eyebrow">SESSION</p>
          <h2 id="tg-session-title">Shared Cribbit account</h2>
        </div>
        <span class="tg-status-pill" data-auth-state>Checking…</span>
      </div>

      <dl class="tg-account-grid">
        <div>
          <dt>Profile</dt>
          <dd data-profile-name>Telegram Player</dd>
        </div>
        <div>
          <dt>Platform</dt>
          <dd>Telegram</dd>
        </div>
        <div>
          <dt>API</dt>
          <dd data-api-state>Configured</dd>
        </div>
      </dl>
    </section>

    <section class="tg-panel tg-panel--accent" aria-labelledby="tg-next-title">
      <p class="tg-eyebrow">T1 — PRESENTATION BOUNDARY</p>
      <h2 id="tg-next-title">Mobile composition active</h2>
      <p>This shell is intentionally Telegram-only. It does not load the desktop page hierarchy or legacy visual runtime on the normal Mini App route.</p>
      <a class="tg-secondary-link" href="?fixture=mobile">Open legacy mobile fixture for compatibility QA</a>
    </section>
  </main>
`;

export async function bootstrapTelegram(platform: PlatformAdapter): Promise<void> {
  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) throw new Error('Missing #app host');

  host.innerHTML = telegramShell;
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
  document.documentElement.dataset.telegramComposition = 'mobile';

  const authState = host.querySelector<HTMLElement>('[data-auth-state]');
  const profileName = host.querySelector<HTMLElement>('[data-profile-name]');
  const apiState = host.querySelector<HTMLElement>('[data-api-state]');

  if (!config.apiUrl || !config.wsUrl) {
    if (apiState) apiState.textContent = 'Not configured';
    if (authState) {
      authState.textContent = 'Offline demo';
      authState.dataset.state = 'warning';
    }
    return;
  }

  const initData = platform.getRawAuthPayload();
  if (!initData) {
    if (authState) {
      authState.textContent = 'Auth pending';
      authState.dataset.state = 'warning';
    }
    return;
  }

  try {
    const session = await api.telegramAuth({ initData });
    window.__CRIBBIT_AUTH__ = session;
    const me = await api.getMe();
    applyUser(me.user, profileName, authState);
  } catch (error) {
    console.warn('[Cribbit] Telegram server authentication not available yet.', error);
    if (authState) {
      authState.textContent = 'Auth unavailable';
      authState.dataset.state = 'warning';
    }
  }
}

function applyUser(user: AuthUser, profileName: HTMLElement | null, authState: HTMLElement | null): void {
  if (profileName) profileName.textContent = user.displayName;
  if (authState) {
    authState.textContent = 'Connected';
    authState.dataset.state = 'success';
  }
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

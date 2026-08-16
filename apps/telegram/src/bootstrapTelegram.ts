import type { AuthSession, AuthUser } from '../../../packages/contracts/src/index.ts';
import { CribbitApiClient, clientConfig } from '../../../packages/api-client/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import { resolveVisualFixture, VISUAL_FIXTURES, type VisualFixtureName } from '../../../packages/ui/src/fixtures.ts';
import { renderTelegramGame } from './gameView.ts';
import {
  CEILINGS,
  CONTENT_WORLDS,
  PROMPT_SOURCES,
  ROOM_MODES,
  createDefaultRoomDraft,
  modeById,
  type ContentWorld,
  type PromptSource,
  type RoomMode,
  type TelegramRoomDraft
} from './roomSetup.ts';
import './styles/telegram.css';

type JoinRoomResult = { roomId?: string; sessionId?: string; ok?: boolean; error?: string; message?: string };

export async function bootstrapTelegram(platform: PlatformAdapter): Promise<void> {
  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) throw new Error('Missing #app host');

  platform.initialize();

  const config = clientConfig(platform.kind);
  const api = new CribbitApiClient(config);
  const fixture = resolveVisualFixture(location.search, platform.getStartParam());
  const preview = platform.getIdentityPreview();
  const draft = createDefaultRoomDraft(preview.displayName || 'Telegram Player');

  window.__CRIBBIT_PLATFORM__ = platform;
  window.__CRIBBIT_API__ = api;
  window.__CRIBBIT_START_PARAM__ = platform.getStartParam();
  window.__CRIBBIT_VISUAL_FIXTURE__ = fixture;
  window.__CRIBBIT_VISUAL_FIXTURE_META__ = fixture ? VISUAL_FIXTURES[fixture] : null;

  document.documentElement.dataset.fixture = fixture || '';
  document.documentElement.dataset.telegramComposition = 'mobile';

  const showRoomCreation = (): void => {
    host.innerHTML = renderRoomCreation(draft);
    bindRoomCreation(host, platform, api, draft, () => {
      renderTelegramGame(host, platform, draft, showRoomCreation);
    });

    if (window.__CRIBBIT_AUTH__) {
      setAuthState(host, 'Connected', 'success');
    }
  };

  showRoomCreation();

  const apiState = host.querySelector<HTMLElement>('[data-api-state]');
  if (!config.apiUrl || !config.wsUrl) {
    if (apiState) apiState.textContent = 'API not configured';
    setStatus(host, 'Local simulation is available. Railway API is not configured in this build.', 'warning');
    return;
  }

  const initData = platform.getRawAuthPayload();
  if (!initData) {
    setAuthState(host, 'Auth pending', 'warning');
    setStatus(host, 'Room setup and local simulation are available. Telegram identity will be trusted only after Railway validates raw initData.', 'neutral');
    return;
  }

  try {
    const session = await api.telegramAuth({ initData });
    window.__CRIBBIT_AUTH__ = session;
    const me = await api.getMe();
    applyUser(host, draft, me.user);
    setAuthState(host, 'Connected', 'success');
    setStatus(host, 'Telegram identity connected to the shared Cribbit account.', 'success');
  } catch (error) {
    console.warn('[Cribbit] Telegram server authentication not available yet.', error);
    setAuthState(host, 'Auth unavailable', 'warning');
    setStatus(host, 'Telegram authentication is not live yet. No fake account or room was created.', 'warning');
  }
}

function renderRoomCreation(draft: TelegramRoomDraft): string {
  const ceilings = CEILINGS[draft.world];
  return `
    <main class="tg-app tg-room-page" data-telegram-app>
      <header class="tg-app__header">
        <button class="tg-icon-button tg-icon-button--back" type="button" aria-label="Back" data-tg-back>←</button>
        <div class="tg-app__title-block">
          <strong>Cribbit Chaos</strong>
          <span>Telegram Mini App</span>
        </div>
        <button class="tg-icon-button" type="button" aria-label="Menu" data-tg-menu>•••</button>
      </header>

      <section class="tg-room-hero" aria-labelledby="tg-room-title">
        <div class="tg-room-hero__kicker"><span class="tg-frog-mark" aria-hidden="true">●</span><span>Room Creation</span></div>
        <h1 id="tg-room-title"><span>Build</span> Tonight's <span>Chaos</span></h1>
        <p>Set the room, pick the chaos, and jump in.</p>
      </section>

      <form class="tg-room-form" data-room-form novalidate>
        <section class="tg-setup-card">
          <label class="tg-field-label" for="tgProfileName"><span aria-hidden="true">♙</span> Profile Name</label>
          <div class="tg-input-wrap">
            <input id="tgProfileName" class="tg-input" data-profile-input maxlength="20" value="${escapeHTML(draft.profileName)}" autocomplete="name" />
            <span class="tg-field-icon" aria-hidden="true">✎</span>
          </div>
          <div class="tg-field-meta"><span data-auth-state>Checking…</span><span data-api-state>Shared Railway API</span></div>
        </section>

        <section class="tg-setup-card">
          <label class="tg-field-label" for="tgRoomName"><span aria-hidden="true">⌂</span> Room Name</label>
          <input id="tgRoomName" class="tg-input" data-room-name maxlength="28" value="${escapeHTML(draft.roomName)}" />
        </section>

        <section class="tg-setup-card tg-grid-2">
          <div>
            <label class="tg-field-label" for="tgWorld"><span aria-hidden="true">◎</span> Content World</label>
            <select id="tgWorld" class="tg-select" data-world>
              ${CONTENT_WORLDS.map(world => `<option value="${world.id}"${world.id === draft.world ? ' selected' : ''}>${world.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="tg-field-label" for="tgCeiling"><span aria-hidden="true">♛</span> Personal Ceiling</label>
            <select id="tgCeiling" class="tg-select" data-ceiling>
              ${ceilings.map(option => `<option value="${option.value}"${option.value === draft.ceiling ? ' selected' : ''}>${option.label}</option>`).join('')}
            </select>
          </div>
        </section>

        <section class="tg-setup-card">
          <div class="tg-section-label"><span>Choose Mode</span><small data-mode-copy>${escapeHTML(modeById(draft.mode).copy)}</small></div>
          <div class="tg-mode-grid" data-mode-grid>
            ${renderModeButtons(draft)}
          </div>
        </section>

        <section class="tg-setup-card">
          <div class="tg-section-label"><span>Player Count</span><strong data-player-count-value>${draft.playerCount}</strong></div>
          <div class="tg-count-grid" data-player-grid>
            ${renderPlayerCountButtons(draft)}
          </div>
        </section>

        <section class="tg-setup-card">
          <div class="tg-section-label"><span>Live Prompt Sources</span><small>Current room draft</small></div>
          <div class="tg-source-grid" data-source-grid>
            ${PROMPT_SOURCES.map(source => renderSourceButton(source.id, source.label, source.detail, draft.sources[source.id])).join('')}
          </div>
        </section>

        <section class="tg-setup-card tg-toggle-row">
          <div>
            <span class="tg-field-label"><span aria-hidden="true">⚗</span> QA Test Hand</span>
            <small>Show the canonical engine simulation entry point for visual and interaction QA.</small>
          </div>
          <label class="tg-switch">
            <input type="checkbox" data-qa-hand${draft.qaHand ? ' checked' : ''} aria-label="Enable QA simulation" />
            <span></span>
          </label>
        </section>

        <section class="tg-setup-card">
          <label class="tg-field-label" for="tgJoinCode"><span aria-hidden="true">#</span> Join Room</label>
          <div class="tg-join-row">
            <input id="tgJoinCode" class="tg-input" data-join-code maxlength="12" inputmode="text" autocomplete="off" placeholder="Enter room code" />
            <button class="tg-button tg-button--join" data-action="join-room" type="button">Join</button>
          </div>
        </section>

        <div class="tg-action-status" data-action-status role="status" aria-live="polite"></div>

        <div class="tg-primary-actions">
          <button class="tg-button tg-button--create" data-action="create-game" type="button">Create Game</button>
          <button class="tg-button tg-button--demo" data-action="demo-game" type="button">Start Simulation</button>
        </div>
      </form>
    </main>
  `;
}

function renderModeButtons(draft: TelegramRoomDraft): string {
  return ROOM_MODES.map(mode => `
    <button class="tg-mode-card" type="button" data-mode="${mode.id}" aria-pressed="${mode.id === draft.mode}">
      <span class="tg-mode-card__icon" aria-hidden="true">${mode.id === 'duel' ? '⚔' : mode.id === 'squad' ? '♟' : mode.id === 'party' ? '●' : '✹'}</span>
      <b>${mode.label}</b>
      <small>${mode.min === mode.max ? `${mode.min} players` : `${mode.min}–${mode.max} players`}</small>
    </button>
  `).join('');
}

function renderPlayerCountButtons(draft: TelegramRoomDraft): string {
  const mode = modeById(draft.mode);
  return Array.from({ length: 9 }, (_, index) => index + 2).map(count => {
    const allowed = count >= mode.min && count <= mode.max;
    return `<button class="tg-count-chip" type="button" data-player-count="${count}" aria-pressed="${count === draft.playerCount}"${allowed ? '' : ' disabled'}>${count}</button>`;
  }).join('');
}

function renderSourceButton(id: PromptSource, label: string, detail: string, active: boolean): string {
  return `
    <button class="tg-source-card" type="button" data-source="${id}" aria-pressed="${active}">
      <span class="tg-source-card__icon" aria-hidden="true">${id === 'original' ? '▤' : id === 'community' ? '♟' : id === 'house' ? '⌂' : '◉'}</span>
      <span><b>${label}</b><small>${detail}</small></span>
      <i aria-hidden="true">${active ? '✓' : ''}</i>
    </button>
  `;
}

function bindRoomCreation(
  host: HTMLElement,
  platform: PlatformAdapter,
  api: CribbitApiClient,
  draft: TelegramRoomDraft,
  onSimulation: () => void,
): void {
  const profileInput = host.querySelector<HTMLInputElement>('[data-profile-input]');
  const roomNameInput = host.querySelector<HTMLInputElement>('[data-room-name]');
  const worldSelect = host.querySelector<HTMLSelectElement>('[data-world]');
  const ceilingSelect = host.querySelector<HTMLSelectElement>('[data-ceiling]');
  const qaToggle = host.querySelector<HTMLInputElement>('[data-qa-hand]');
  const joinInput = host.querySelector<HTMLInputElement>('[data-join-code]');

  profileInput?.addEventListener('input', () => { draft.profileName = profileInput.value.slice(0, 20); });
  profileInput?.addEventListener('change', () => { void persistProfile(host, api, draft); });
  roomNameInput?.addEventListener('input', () => { draft.roomName = roomNameInput.value.slice(0, 28); });

  worldSelect?.addEventListener('change', () => {
    draft.world = worldSelect.value as ContentWorld;
    const available = CEILINGS[draft.world];
    if (!available.some(option => option.value === draft.ceiling)) draft.ceiling = available[0].value;
    if (ceilingSelect) {
      ceilingSelect.innerHTML = available.map(option => `<option value="${option.value}"${option.value === draft.ceiling ? ' selected' : ''}>${option.label}</option>`).join('');
    }
    platform.haptic('light');
  });

  ceilingSelect?.addEventListener('change', () => {
    draft.ceiling = Number(ceilingSelect.value);
    platform.haptic('light');
  });

  host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode as RoomMode;
      const nextMode = modeById(mode);
      draft.mode = nextMode.id;
      draft.playerCount = nextMode.defaultPlayers;
      host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.mode === draft.mode)));
      const copy = host.querySelector<HTMLElement>('[data-mode-copy]');
      if (copy) copy.textContent = nextMode.copy;
      rerenderPlayerCounts(host, draft);
      platform.haptic('light');
    });
  });

  bindPlayerCountButtons(host, platform, draft);

  host.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(button => {
    button.addEventListener('click', () => {
      const source = button.dataset.source as PromptSource;
      draft.sources[source] = !draft.sources[source];
      button.setAttribute('aria-pressed', String(draft.sources[source]));
      const marker = button.querySelector('i');
      if (marker) marker.textContent = draft.sources[source] ? '✓' : '';
      platform.haptic('light');
    });
  });

  qaToggle?.addEventListener('change', () => { draft.qaHand = qaToggle.checked; });

  host.querySelector<HTMLButtonElement>('[data-action="join-room"]')?.addEventListener('click', () => {
    void joinRoom(host, api, joinInput?.value || '');
  });

  joinInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void joinRoom(host, api, joinInput.value);
    }
  });

  host.querySelector<HTMLButtonElement>('[data-action="create-game"]')?.addEventListener('click', () => {
    platform.haptic('medium');
    setStatus(host, 'Create Game is blocked until the shared room/session backend migration is complete. No fake room was created.', 'warning');
  });

  host.querySelector<HTMLButtonElement>('[data-action="demo-game"]')?.addEventListener('click', () => {
    platform.haptic('medium');
    onSimulation();
  });
}

function bindPlayerCountButtons(host: HTMLElement, platform: PlatformAdapter, draft: TelegramRoomDraft): void {
  host.querySelectorAll<HTMLButtonElement>('[data-player-count]').forEach(button => {
    button.addEventListener('click', () => {
      draft.playerCount = Number(button.dataset.playerCount);
      host.querySelectorAll<HTMLButtonElement>('[data-player-count]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.playerCount) === draft.playerCount)));
      const value = host.querySelector<HTMLElement>('[data-player-count-value]');
      if (value) value.textContent = String(draft.playerCount);
      platform.haptic('light');
    });
  });
}

function rerenderPlayerCounts(host: HTMLElement, draft: TelegramRoomDraft): void {
  const grid = host.querySelector<HTMLElement>('[data-player-grid]');
  if (!grid) return;
  grid.innerHTML = renderPlayerCountButtons(draft);
  const value = host.querySelector<HTMLElement>('[data-player-count-value]');
  if (value) value.textContent = String(draft.playerCount);
  const platform = window.__CRIBBIT_PLATFORM__;
  if (platform) bindPlayerCountButtons(host, platform, draft);
}

async function persistProfile(host: HTMLElement, api: CribbitApiClient, draft: TelegramRoomDraft): Promise<void> {
  const displayName = draft.profileName.trim();
  if (!displayName) {
    setStatus(host, 'Profile name cannot be empty.', 'warning');
    return;
  }
  if (!window.__CRIBBIT_AUTH__) {
    setStatus(host, 'Profile changes are local until Telegram authentication is connected.', 'neutral');
    return;
  }
  try {
    const result = await api.updateProfile({ displayName });
    applyUser(host, draft, result.user);
    setStatus(host, 'Profile name saved to the shared Cribbit account.', 'success');
  } catch (error) {
    console.warn('[Cribbit] Profile update failed.', error);
    setStatus(host, 'Profile update could not be saved. The local room draft is unchanged.', 'warning');
  }
}

async function joinRoom(host: HTMLElement, api: CribbitApiClient, rawCode: string): Promise<void> {
  const code = rawCode.trim();
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) {
    setStatus(host, 'Room code must contain 4–12 letters or numbers.', 'warning');
    return;
  }
  setStatus(host, 'Checking room code…', 'neutral');
  try {
    const result = api.joinRoom(code) as unknown as Promise<JoinRoomResult>;
    const joined = await result;
    if (!joined.roomId) {
      const message = joined.message || (joined.error === 'ROOMS_NOT_MIGRATED' ? 'Real room joining is not active until the room/session backend migration is complete.' : 'Room joining is not available yet.');
      setStatus(host, `${message} No fake room was created.`, 'warning');
      return;
    }
    setStatus(host, `Joined room ${joined.roomId}.`, 'success');
  } catch (error) {
    console.warn('[Cribbit] Room join request failed.', error);
    setStatus(host, 'Room joining is currently unavailable. No fake room was created.', 'warning');
  }
}

function applyUser(host: HTMLElement, draft: TelegramRoomDraft, user: AuthUser): void {
  draft.profileName = user.displayName;
  const profileInput = host.querySelector<HTMLInputElement>('[data-profile-input]');
  if (profileInput) profileInput.value = user.displayName;
}

function setAuthState(host: HTMLElement, text: string, tone: 'success' | 'warning' | 'neutral'): void {
  const authState = host.querySelector<HTMLElement>('[data-auth-state]');
  if (!authState) return;
  authState.textContent = text;
  authState.dataset.state = tone;
}

function setStatus(host: HTMLElement, text: string, tone: 'success' | 'warning' | 'neutral'): void {
  const status = host.querySelector<HTMLElement>('[data-action-status]');
  if (!status) return;
  status.textContent = text;
  status.dataset.tone = tone;
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
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

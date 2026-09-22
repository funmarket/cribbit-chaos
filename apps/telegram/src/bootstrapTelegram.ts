import type { AuthSession, AuthUser } from '../../../packages/contracts/src/index.ts';
import { ApiError, CribbitApiClient, isTelegramIdentityUnlinked, CribbitRealtimeClient, clientConfig, type RoomConfigUpdateRequest, type RoomSessionResult, type WaitingRoomResult } from '../../../packages/api-client/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import { resolveVisualFixture, VISUAL_FIXTURES, type VisualFixtureName } from '../../../packages/ui/src/fixtures.ts';
import { createTelegramBackendGame } from './backendGame.ts';
import { renderTelegramGame } from './gameView.ts';
import { createTelegramSimulationGame } from './simulation.ts';
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

  const openBackendSession = async (room: RoomSessionResult): Promise<boolean> => {
    const auth = window.__CRIBBIT_AUTH__;
    if (!auth) {
      setStatus(host, 'Telegram authentication is required before entering a live game.', 'warning');
      return false;
    }
    try {
      const game = await createTelegramBackendGame(api, room, auth.user.id);
      renderTelegramGame(host, platform, draft, game, showRoomCreation);
      return true;
    } catch (error) {
      console.warn('[Cribbit] Shared game session could not be loaded.', error);
      showRoomCreation();
      setStatus(host, 'The shared game session could not be loaded.', 'warning');
      return false;
    }
  };

  const openSimulation = (): void => {
    const game = createTelegramSimulationGame(draft);
    renderTelegramGame(host, platform, draft, game, showRoomCreation);
  };

  const showRoomCreation = (): void => {
    host.innerHTML = renderRoomCreation(draft);
    bindRoomCreation(host, platform, api, draft, openBackendSession, openSimulation);

    if (window.__CRIBBIT_AUTH__) {
      setAuthState(host, 'Connected', 'success');
    }
  };

  showRoomCreation();

  const apiState = host.querySelector<HTMLElement>('[data-api-state]');
  if (!config.apiUrl || !config.wsUrl) {
    if (apiState) apiState.textContent = 'API not configured';
    setStatus(host, 'Railway API is not configured in this build. Simulation remains available.', 'warning');
    return;
  }

  const initData = platform.getRawAuthPayload();
  if (!initData) {
    setAuthState(host, 'Auth pending', 'warning');
    setStatus(host, 'Telegram did not provide Mini App initData. Simulation remains available; live rooms require a valid Telegram launch.', 'neutral');
    return;
  }

  try {
    const session = await api.telegramAuth({ initData });
    window.__CRIBBIT_AUTH__ = session;
    const me = await api.getMe();
    applyUser(host, draft, me.user);
    setAuthState(host, 'Connected', 'success');
    setStatus(host, 'Telegram identity connected to the shared Cribbit account.', 'success');
    if (!me.user.identities.some(identity => identity.provider === 'web')) {
      renderWebCredentialPanel(host, api);
    }
  } catch (error) {
    if (isTelegramIdentityUnlinked(error)) {
      setAuthState(host, 'Account required', 'warning');
      renderAccountOnboarding(host, api, initData);
      return;
    }
    console.warn('[Cribbit] Telegram server authentication not available yet.', error);
    setAuthState(host, 'Auth unavailable', 'warning');
    setStatus(host, telegramAuthFailureMessage(error), 'warning');
  }
}

/**
 * Unknown Telegram identities are never provisioned automatically: the human chooses
 * either to create a Cribbit account, to link an existing one (Web credential or link
 * code), and Telegram-origin accounts can attach a Web login afterwards.
 */
function renderAccountOnboarding(host:HTMLElement, api:CribbitApiClient, initData:string):void {
  host.innerHTML = `
    <main class="tg-app" data-telegram-app>
      <header class="tg-app__header"><h1>Cribbit CHAOS</h1></header>
      <section class="tg-card">
        <h2>Finish setting up Cribbit</h2>
        <p>This Telegram account is not connected to a Cribbit account yet.</p>
        <button class="tg-button tg-button--primary" type="button" data-account="create">Create Cribbit account</button>
        <form data-account-form="link">
          <h3>I already have a Cribbit account</h3>
          <input class="tg-input" name="loginUsername" placeholder="Cribbit login" autocomplete="username" />
          <input class="tg-input" name="password" type="password" placeholder="Cribbit password" autocomplete="current-password" />
          <button class="tg-button" type="submit">Link existing account</button>
        </form>
        <form data-account-form="code">
          <h3>I have a link code from the Web app</h3>
          <input class="tg-input" name="code" placeholder="Link code" />
          <button class="tg-button" type="submit">Use link code</button>
        </form>
        <p data-account-status role="status"></p>
      </section>
    </main>
  `;

  const status = host.querySelector<HTMLElement>('[data-account-status]');
  const report = (message:string):void => { if (status) status.textContent = message; };
  const finish = ():void => { report('Connected. Reloading…'); window.location.reload(); };

  host.querySelector<HTMLButtonElement>('[data-account="create"]')?.addEventListener('click', () => {
    report('Creating your Cribbit account…');
    void api.telegramRegisterAccount({ initData }).then(finish).catch(() => report('Could not create the account.'));
  });

  host.querySelector<HTMLFormElement>('[data-account-form="link"]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    report('Linking your existing Cribbit account…');
    void api.telegramLinkExistingAccount({
      initData,
      loginUsername:String(data.get('loginUsername') || ''),
      password:String(data.get('password') || ''),
    }).then(finish).catch(() => report('That Cribbit login or password was not accepted.'));
  });

  host.querySelector<HTMLFormElement>('[data-account-form="code"]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    report('Using your link code…');
    void api.telegramLinkWithCode({ initData, code:String(data.get('code') || '').trim() })
      .then(finish)
      .catch(() => report('That link code is invalid, expired or already used.'));
  });
}

/** Telegram-origin accounts may attach a Web login without creating another user. */
function renderWebCredentialPanel(host:HTMLElement, api:CribbitApiClient):void {
  const panel = document.createElement('section');
  panel.className = 'tg-card';
  panel.dataset.webCredential = 'true';
  panel.innerHTML = `
    <h2>Add a Web login</h2>
    <p>Use the same Cribbit account on the Web app. This never creates a second account.</p>
    <form data-web-credential-form>
      <input class="tg-input" name="loginUsername" placeholder="Choose a login" autocomplete="username" />
      <input class="tg-input" name="displayUsername" placeholder="Display username" autocomplete="nickname" />
      <input class="tg-input" name="password" type="password" placeholder="Password (10+ characters)" autocomplete="new-password" />
      <button class="tg-button" type="submit">Attach Web login</button>
    </form>
    <p class="tg-hint" data-web-login-hint role="status"></p>
    <p data-web-credential-status role="status"></p>
  `;
  host.append(panel);
  const status = panel.querySelector<HTMLElement>('[data-web-credential-status]');
  const hint = panel.querySelector<HTMLElement>('[data-web-login-hint]');
  const loginInput = panel.querySelector<HTMLInputElement>('input[name="loginUsername"]');

  // The backend decides whether the Telegram username may be suggested as a Web login.
  // Nothing is claimed here: an unavailable suggestion just means the human picks a login.
  void api.getWebLoginSuggestion().then(suggestion => {
    if (suggestion.loginUsername && loginInput) {
      loginInput.value = suggestion.loginUsername;
      if (hint) hint.textContent = 'Suggested from your Telegram username. Edit it or choose another login.';
      return;
    }
    if (hint) {
      hint.textContent = suggestion.reason === 'LOGIN_TAKEN'
        ? 'Your Telegram username is already used as a Web login. Choose another login.'
        : 'Choose your own Cribbit login username.';
    }
  }).catch(() => {
    if (hint) hint.textContent = 'Choose your own Cribbit login username.';
  });

  panel.querySelector<HTMLFormElement>('[data-web-credential-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    if (status) status.textContent = 'Attaching your Web login…';
    void api.attachWebCredential({
      loginUsername:String(data.get('loginUsername') || ''),
      displayUsername:String(data.get('displayUsername') || ''),
      password:String(data.get('password') || ''),
    })
      .then(() => { if (status) status.textContent = 'Web login attached to this Cribbit account.'; })
      .catch(() => { if (status) status.textContent = 'That login or display username is not available.'; });
  });
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

/**
 * Room setup controls are presentation for a local draft until this host owns a live waiting room.
 * While it does, the approved controls publish their change to the canonical server room through
 * packages/api-client; the server validates it and the waiting panel refetches authoritative state.
 * Nothing is published when the surface has no host-owned live room (joiners, simulation, no room).
 */
let publishRoomSetupChange: ((patch: RoomConfigUpdateRequest) => void) | null = null;

function bindRoomCreation(
  host: HTMLElement,
  platform: PlatformAdapter,
  api: CribbitApiClient,
  draft: TelegramRoomDraft,
  onSession: (room: RoomSessionResult) => Promise<boolean>,
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
  // The room name is published when the field is committed rather than on every keystroke.
  roomNameInput?.addEventListener('change', () => { publishRoomSetupChange?.({ roomName: draft.roomName }); });

  worldSelect?.addEventListener('change', () => {
    draft.world = worldSelect.value as ContentWorld;
    const available = CEILINGS[draft.world];
    if (!available.some(option => option.value === draft.ceiling)) draft.ceiling = available[0].value;
    if (ceilingSelect) {
      ceilingSelect.innerHTML = available.map(option => `<option value="${option.value}"${option.value === draft.ceiling ? ' selected' : ''}>${option.label}</option>`).join('');
    }
    // World and ceiling travel together because the persisted ceiling may not be approved for the
    // new world; the server re-validates both against the shared contract.
    publishRoomSetupChange?.({ world: draft.world, ceiling: draft.ceiling });
    platform.haptic('light');
  });

  ceilingSelect?.addEventListener('change', () => {
    draft.ceiling = Number(ceilingSelect.value);
    publishRoomSetupChange?.({ ceiling: draft.ceiling });
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
      publishRoomSetupChange?.({ mode: draft.mode, playerCount: draft.playerCount });
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
      publishRoomSetupChange?.({ sources: { ...draft.sources } });
      platform.haptic('light');
    });
  });

  qaToggle?.addEventListener('change', () => { draft.qaHand = qaToggle.checked; });

  host.querySelector<HTMLButtonElement>('[data-action="join-room"]')?.addEventListener('click', () => {
    platform.haptic('medium');
    void joinRoom(host, api, joinInput?.value || '', onSession);
  });

  joinInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      platform.haptic('medium');
      void joinRoom(host, api, joinInput.value, onSession);
    }
  });

  host.querySelector<HTMLButtonElement>('[data-action="create-game"]')?.addEventListener('click', async () => {
    platform.haptic('medium');
    if (!window.__CRIBBIT_AUTH__) {
      setStatus(host, 'Live game authentication is not established. Check the authentication status above; Simulation remains available.', 'warning');
      return;
    }
    setStatus(host, 'Creating shared game…', 'neutral');
    try {
      const room = await api.createRoom({
        roomName: draft.roomName,
        mode: draft.mode,
        playerCount: draft.playerCount,
        world: draft.world,
        ceiling: draft.ceiling,
        sources: draft.sources,
      });
      setStatus(host, `Game created · opening room ${room.joinCode}…`, 'neutral');
      openWaitingRoom(host, api, room, onSession);
    } catch (error) {
      console.warn('[Cribbit] Room creation failed.', error);
      setStatus(host, 'The shared game could not be created.', 'warning');
    }
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
      publishRoomSetupChange?.({ mode: draft.mode, playerCount: draft.playerCount });
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

async function joinRoom(
  host: HTMLElement,
  api: CribbitApiClient,
  rawCode: string,
  onSession: (room: RoomSessionResult) => Promise<boolean>,
): Promise<void> {
  const code = rawCode.trim();
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) {
    setStatus(host, 'Room code must contain 4–12 letters or numbers.', 'warning');
    return;
  }
  if (!window.__CRIBBIT_AUTH__) {
    setStatus(host, 'Live game authentication is not established. Simulation remains available.', 'warning');
    return;
  }
  setStatus(host, 'Checking room code…', 'neutral');
  try {
    const joined = await api.joinRoom(code);
    setStatus(host, `Room ${joined.joinCode} found · opening live session…`, 'neutral');
    openWaitingRoom(host, api, joined, onSession);
  } catch (error) {
    console.warn('[Cribbit] Room join request failed.', error);
    const detail = error instanceof ApiError ? error.message : '';
    if (detail.includes('ROOM_NOT_FOUND')) {
      setStatus(host, 'That room code does not exist.', 'warning');
    } else if (detail.includes('SESSION_NOT_STARTED')) {
      setStatus(host, 'That room exists, but its game session has not started yet.', 'warning');
    } else if (detail.includes('GAME_ALREADY_STARTED')) {
      setStatus(host, 'That game has already started and is no longer accepting new players.', 'warning');
    } else if (detail.includes('ROOM_FULL')) {
      setStatus(host, 'That room is already full.', 'warning');
    } else {
      setStatus(host, 'Room joining is currently unavailable.', 'warning');
    }
  }
}


function escapeWaiting(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char] || char);
}

async function startWaitingRoom(host: HTMLElement, api: CribbitApiClient, room: WaitingRoomResult, onSession: (room: RoomSessionResult) => Promise<boolean>): Promise<void> {
  try {
    await onSession(await api.startRoom(room.roomId));
  } catch (error) {
    console.warn('[Cribbit] Room start failed.', error);
    setStatus(host, 'The game could not be started.', 'warning');
  }
}

function openWaitingRoom(
  host: HTMLElement,
  api: CribbitApiClient,
  room: WaitingRoomResult,
  onSession: (room: RoomSessionResult) => Promise<boolean>,
): void {
  host.querySelector('[data-waiting-room]')?.remove();
  if (room.status === 'STARTED' && room.sessionId) {
    void onSession({ ok:true, roomId:room.roomId, sessionId:room.sessionId, joinCode:room.joinCode, players:[] });
    return;
  }

  const panel = document.createElement('section');
  panel.className = 'tg-setup-card';
  panel.setAttribute('data-waiting-room', room.roomId);
  const anchor = host.querySelector('[data-action-status]');
  if (anchor?.parentElement) anchor.parentElement.insertBefore(panel, anchor);
  else host.append(panel);

  const auth = (window as unknown as { __CRIBBIT_AUTH__?: { user?: { id?: string } } }).__CRIBBIT_AUTH__;
  const isHost = Boolean(auth?.user?.id) && auth?.user?.id === room.ownerUserId;

  const paint = (state: WaitingRoomResult): void => {
    panel.innerHTML = `
      <label class="tg-field-label"><span aria-hidden="true">#</span> Live room ${escapeWaiting(state.joinCode)}</label>
      <p class="tg-field-hint">${state.status === 'STARTED' ? 'Game started.' : `Waiting for real players · ${state.memberCount}/${state.playerCount}`}</p>
      <ul class="tg-member-list">${state.members.map(member => `<li><b>${escapeWaiting(member.name)}</b><span>${escapeWaiting(member.role)}</span></li>`).join('')}</ul>
      ${isHost && state.status !== 'STARTED' ? `<button class="tg-button tg-button--create" data-action="start-game" type="button"${state.memberCount === state.playerCount ? '' : ' disabled'}>Start Game</button>` : ''}`;
  };
  paint(room);

  // Only the host of a live waiting room owns canonical room setup. A joiner's setup controls stay
  // local presentation for their own draft/simulation and never publish a server change.
  publishRoomSetupChange = isHost && room.status !== 'STARTED'
    ? (patch: RoomConfigUpdateRequest): void => {
        void api.updateRoomConfig(room.roomId, patch)
          .then(next => { paint(next); })
          .catch(error => {
            console.warn('[Cribbit] Room setup update rejected.', error);
            setStatus(host, `Room setup was not accepted: ${error instanceof Error ? error.message : 'unknown error'}`, 'warning');
          });
      }
    : null;

  panel.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-action="start-game"]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void startWaitingRoom(host, api, room, onSession);
  });

  const realtime = new CribbitRealtimeClient(api.config);
  const socket = realtime.connect();
  realtime.joinRoomChannel(room.roomId);
  socket.on('room-updated', () => { void api.getRoom(room.roomId).then(next => { paint(next); }).catch(() => undefined); });
  socket.on('room-started', (payload:{ sessionId?:string }) => {
    if (!payload?.sessionId) return;
    // The server freezes room setup at Start, so the host's setup controls stop publishing here.
    publishRoomSetupChange = null;
    realtime.disconnect();
    void onSession({ ok:true, roomId:room.roomId, sessionId:payload.sessionId, joinCode:room.joinCode, players:[] });
  });
}

function telegramAuthFailureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.message.trim();
    if (detail.includes('TELEGRAM_BOT_TOKEN') || detail.includes('TELEGRAM_AUTH_INVALID')) {
      return `Railway rejected Telegram authentication: ${detail}`;
    }
    return `Telegram authentication failed: ${detail}`;
  }
  return `Telegram authentication failed: ${error instanceof Error ? error.message : 'Unknown authentication error.'}`;
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

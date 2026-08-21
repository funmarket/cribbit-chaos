import { ApiError, type CribbitApiClient } from '../../../packages/api-client/src/index.ts';
import { cribbitAuth, type FrontendAuthState } from '../../../packages/ui/src/auth-controller.ts';
import './web-auth.css';

function escapeHTML(value:string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char] || char);
}

function errorMessage(error:unknown): string {
  if (error instanceof ApiError) {
    try {
      const body = JSON.parse(error.message) as { message?:string; error?:string };
      return body.message || body.error || 'Authentication failed.';
    } catch {
      return error.message || 'Authentication failed.';
    }
  }
  return error instanceof Error ? error.message : 'Authentication failed.';
}

function ensureHeaderButton(): HTMLButtonElement | null {
  const tools = document.querySelector<HTMLElement>('.header-tools');
  if (!tools) return null;
  let button = tools.querySelector<HTMLButtonElement>('[data-action="web-auth"]');
  if (button) return button;
  button = document.createElement('button');
  button.className = 'tool-button';
  button.type = 'button';
  button.dataset.action = 'web-auth';
  button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-person" /></svg><span>Sign In</span>';
  const telegram = tools.querySelector('[data-action="continue-with-telegram"]');
  tools.insertBefore(button, telegram ?? tools.firstChild);
  return button;
}

function renderHeaderState(button:HTMLButtonElement, state:FrontendAuthState): void {
  const label = button.querySelector('span');
  const profile = document.querySelector<HTMLButtonElement>('.profile-chip');
  if (state.status === 'AUTHENTICATED') {
    if (label) label.textContent = state.user.displayUsername || state.user.displayName;
    button.dataset.authenticated = 'true';
    if (profile) profile.textContent = (state.user.displayUsername || state.user.displayName || 'U').slice(0,1).toUpperCase();
  } else {
    if (label) label.textContent = state.status === 'LOADING' ? 'Checking…' : 'Sign In';
    button.dataset.authenticated = 'false';
  }
}

function dialogMarkup(authenticated:FrontendAuthState): string {
  if (authenticated.status === 'AUTHENTICATED') {
    const name = authenticated.user.displayUsername || authenticated.user.displayName;
    return `
      <div class="cc-web-auth-backdrop" data-web-auth-backdrop>
        <section class="panel cc-web-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="ccAuthTitle">
          <header class="panel-header"><div><h2 class="panel-title" id="ccAuthTitle">Cribbit account</h2><p class="panel-subtitle">Signed in with Web credentials.</p></div></header>
          <div class="panel-body">
            <div class="authority-box"><b>${escapeHTML(name)}</b><p>${escapeHTML(authenticated.user.displayName)} · Canonical user ${escapeHTML(authenticated.user.id)}</p></div>
            <p class="cc-web-auth-note">This Web identity stays separate from any Telegram identity unless you explicitly link them in a future account-linking flow.</p>
            <div class="cc-web-auth-message" data-web-auth-message></div>
            <div class="cc-web-auth-actions"><button class="button" type="button" data-web-auth-close>Close</button><button class="button button--primary" type="button" data-web-auth-logout>Sign Out</button></div>
          </div>
        </section>
      </div>`;
  }

  return `
    <div class="cc-web-auth-backdrop" data-web-auth-backdrop>
      <section class="panel cc-web-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="ccAuthTitle">
        <header class="panel-header"><div><h2 class="panel-title" id="ccAuthTitle">Cribbit account</h2><p class="panel-subtitle">Use Cribbit directly on the Web without Telegram.</p></div></header>
        <div class="panel-body">
          <div class="cc-web-auth-tabs">
            <button class="button" type="button" data-web-auth-tab="login" aria-pressed="true">Sign In</button>
            <button class="button" type="button" data-web-auth-tab="register" aria-pressed="false">Register</button>
          </div>
          <form class="cc-web-auth-form" data-web-login-form>
            <div class="field"><label for="ccLoginUsername">Login username</label><input class="input" id="ccLoginUsername" name="loginUsername" autocomplete="username" minlength="3" maxlength="32" required /></div>
            <div class="field"><label for="ccLoginPassword">Password</label><input class="input" id="ccLoginPassword" name="password" type="password" autocomplete="current-password" minlength="10" maxlength="128" required /></div>
            <div class="cc-web-auth-actions"><button class="button" type="button" data-web-auth-close>Cancel</button><button class="button button--primary" type="submit">Sign In</button></div>
          </form>
          <form class="cc-web-auth-form" data-web-register-form hidden>
            <div class="field"><label for="ccRegisterLogin">Login username</label><input class="input" id="ccRegisterLogin" name="loginUsername" autocomplete="username" minlength="3" maxlength="32" required /><span class="field-help">Private sign-in identifier.</span></div>
            <div class="field"><label for="ccDisplayUsername">Display username</label><input class="input" id="ccDisplayUsername" name="displayUsername" autocomplete="nickname" minlength="2" maxlength="24" required /><span class="field-help">Public Cribbit handle. It is not your login credential.</span></div>
            <div class="field"><label for="ccDisplayName">Display name <small>optional</small></label><input class="input" id="ccDisplayName" name="displayName" maxlength="40" /></div>
            <div class="field"><label for="ccEmail">Email <small>optional</small></label><input class="input" id="ccEmail" name="email" type="email" autocomplete="email" maxlength="254" /></div>
            <div class="field"><label for="ccRegisterPassword">Password</label><input class="input" id="ccRegisterPassword" name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required /><span class="field-help">10+ characters with at least one letter and one number.</span></div>
            <div class="cc-web-auth-actions"><button class="button" type="button" data-web-auth-close>Cancel</button><button class="button button--primary" type="submit">Create Account</button></div>
          </form>
          <div class="cc-web-auth-message" data-web-auth-message role="status" aria-live="polite"></div>
          <p class="cc-web-auth-note">Telegram Mini App users continue to authenticate automatically through Telegram. A matching username does not merge the two accounts.</p>
        </div>
      </section>
    </div>`;
}

export function openWebAuthDialog(api:CribbitApiClient): void {
  document.querySelector('[data-web-auth-backdrop]')?.remove();
  const container = document.createElement('div');
  container.innerHTML = dialogMarkup(cribbitAuth.current);
  const backdrop = container.firstElementChild as HTMLElement | null;
  if (!backdrop) return;
  document.body.append(backdrop);

  const close = (): void => backdrop.remove();
  const message = backdrop.querySelector<HTMLElement>('[data-web-auth-message]');
  const setMessage = (text:string, tone:'neutral'|'warning'|'success'='neutral'): void => {
    if (!message) return;
    message.textContent = text;
    message.dataset.tone = tone;
  };

  backdrop.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === backdrop || target?.closest('[data-web-auth-close]')) close();
  });

  backdrop.querySelectorAll<HTMLButtonElement>('[data-web-auth-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.webAuthTab;
      backdrop.querySelectorAll<HTMLButtonElement>('[data-web-auth-tab]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const login = backdrop.querySelector<HTMLFormElement>('[data-web-login-form]');
      const register = backdrop.querySelector<HTMLFormElement>('[data-web-register-form]');
      if (login) login.hidden = tab !== 'login';
      if (register) register.hidden = tab !== 'register';
      setMessage('');
    });
  });

  backdrop.querySelector<HTMLFormElement>('[data-web-login-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage('Signing in…');
    void api.webLogin({
      loginUsername:String(form.get('loginUsername') || ''),
      password:String(form.get('password') || ''),
    }).then(result => {
      cribbitAuth.authenticated(result.user, 'WEB');
      close();
    }).catch(error => setMessage(errorMessage(error), 'warning'));
  });

  backdrop.querySelector<HTMLFormElement>('[data-web-register-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get('displayName') || '').trim();
    const email = String(form.get('email') || '').trim();
    setMessage('Creating your Cribbit account…');
    void api.webRegister({
      loginUsername:String(form.get('loginUsername') || ''),
      password:String(form.get('password') || ''),
      displayUsername:String(form.get('displayUsername') || ''),
      ...(displayName ? { displayName } : {}),
      ...(email ? { email } : {}),
    }).then(result => {
      cribbitAuth.authenticated(result.user, 'WEB');
      close();
    }).catch(error => setMessage(errorMessage(error), 'warning'));
  });

  backdrop.querySelector<HTMLButtonElement>('[data-web-auth-logout]')?.addEventListener('click', () => {
    setMessage('Signing out…');
    void api.webLogout().then(() => {
      cribbitAuth.guest();
      close();
    }).catch(error => setMessage(errorMessage(error), 'warning'));
  });
}

export function startWebAuthUI(api:CribbitApiClient): () => void {
  const button = ensureHeaderButton();
  if (!button) return () => undefined;
  const unsubscribe = cribbitAuth.subscribe(state => renderHeaderState(button, state));
  button.addEventListener('click', () => openWebAuthDialog(api));
  return unsubscribe;
}

/**
 * What this does: the minimum Web account UI. It shows which authentication methods are
 * attached to the canonical Cribbit account and issues a short-lived single-use link code
 * that is consumed inside the Telegram Mini App.
 * Key invariant: the backend stays authoritative; this module only collects intent and
 * displays server responses. It never creates or merges accounts, never invents an
 * identity decision and never renders the canonical user id.
 */
import { ApiError, type CribbitApiClient } from '../../../packages/api-client/src/index.ts';

function transportState(providers: string[], provider: 'web' | 'telegram'): string {
  const connected = providers.includes(provider);
  if (provider === 'web') return `Web login: ${connected ? 'Connected' : 'Not connected'}`;
  return `Telegram: ${connected ? 'Connected' : 'Not connected'}`;
}

function minutesUntil(expiresAt: string): number | null {
  const deadline = Date.parse(expiresAt);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.round((deadline - Date.now()) / 60000));
}

export function startWebIdentityLinkUI(api: CribbitApiClient): () => void {
  const dialog = document.querySelector<HTMLDialogElement>('#profileDialog');
  const body = dialog?.querySelector<HTMLElement>('.dialog-body');
  if (!dialog || !body) return () => undefined;

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.dataset.identityPanel = 'true';
  panel.innerHTML = `
    <div class="panel-body">
      <h3 class="panel-title">Cribbit account</h3>
      <p class="panel-subtitle">One Cribbit account, several ways to sign in. Linking is optional.</p>
      <ul class="library-list" data-identity-list><li class="library-item">Loading…</li></ul>
      <button class="button button--sm" type="button" data-action="link-telegram-code">Connect Telegram</button>
      <p class="field-help" data-telegram-link-status role="status"></p>
    </div>
  `;
  body.append(panel);

  const list = panel.querySelector<HTMLElement>('[data-identity-list]');
  const status = panel.querySelector<HTMLElement>('[data-telegram-link-status]');
  const linkButton = panel.querySelector<HTMLButtonElement>('[data-action="link-telegram-code"]');

  const renderTransportStates = (providers: string[]): void => {
    if (!list) return;
    list.innerHTML = ['web', 'telegram']
      .map(provider => `<li class="library-item" data-transport="${provider}">${transportState(providers, provider as 'web' | 'telegram')}</li>`)
      .join('');
  };

  const refresh = async (): Promise<void> => {
    if (!list) return;
    try {
      const me = await api.getMe();
      renderTransportStates(me.user.identities.map(identity => identity.provider));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        list.innerHTML = '<li class="library-item">Sign in or create a Cribbit account to manage linked sign-in methods.</li>';
        return;
      }
      list.innerHTML = '<li class="library-item">Could not load account state.</li>';
    }
  };

  linkButton?.addEventListener('click', () => {
    if (linkButton) linkButton.disabled = true;
    if (status) status.textContent = 'Creating a single-use code…';
    void api.createTelegramLinkCode()
      .then(challenge => {
        if (!status) return;
        const minutes = minutesUntil(challenge.expiresAt);
        const expiry = minutes === null ? 'It works once and expires soon.' : `It works once and expires in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
        status.textContent = `Code ${challenge.code} — open Cribbit inside Telegram, choose Link existing account, and enter it. ${expiry}`;
        void refresh();
      })
      .catch((error: unknown) => {
        if (!status) return;
        if (error instanceof ApiError && error.status === 401) {
          status.textContent = 'Sign in or create a Cribbit account before connecting Telegram.';
          return;
        }
        const detail = error instanceof ApiError ? `${error.status} ${error.message}`.slice(0, 160) : 'unexpected error';
        status.textContent = `Could not create a link code (${detail}).`;
      })
      .finally(() => { if (linkButton) linkButton.disabled = false; });
  });

  const openTrigger = document.querySelector<HTMLElement>('[data-action="open-profile"]');
  const openProfile = (): void => {
    if (!dialog.open) dialog.showModal();
    void refresh();
  };
  openTrigger?.addEventListener('click', openProfile);

  return () => { openTrigger?.removeEventListener('click', openProfile); };
}

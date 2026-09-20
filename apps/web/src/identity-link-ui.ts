/**
 * What this does: the minimum Web account UI for identity convergence. It shows which
 * transports are linked to the canonical Cribbit user and issues a single-use link code
 * that is consumed inside the Telegram Mini App.
 * Key invariant: the backend stays authoritative; this module only collects intent and
 * displays server responses. It never creates or merges accounts and owns no identity logic.
 */
import { ApiError, type CribbitApiClient } from '../../../packages/api-client/src/index.ts';

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
      <p class="panel-subtitle">One Cribbit account, several ways to sign in.</p>
      <ul class="library-list" data-identity-list><li class="library-item">Loading…</li></ul>
      <button class="button button--sm" type="button" data-action="link-telegram-code">Link Telegram</button>
      <p class="field-help" data-telegram-link-status role="status"></p>
    </div>
  `;
  body.append(panel);

  const list = panel.querySelector<HTMLElement>('[data-identity-list]');
  const status = panel.querySelector<HTMLElement>('[data-telegram-link-status]');

  const refresh = async (): Promise<void> => {
    if (!list) return;
    try {
      const me = await api.getMe();
      const providers = me.user.identities.map(identity => identity.provider).sort();
      list.innerHTML = providers
        .map(provider => `<li class="library-item">${provider === 'web' ? 'Web login' : 'Telegram'} linked</li>`)
        .join('') || '<li class="library-item">No transport linked yet</li>';
    } catch (error) {
      list.innerHTML = `<li class="library-item">${error instanceof ApiError && error.status === 401 ? 'Sign in to manage linked transports' : 'Could not load account state'}</li>`;
    }
  };

  panel.querySelector<HTMLButtonElement>('[data-action="link-telegram-code"]')?.addEventListener('click', () => {
    if (status) status.textContent = 'Creating a single-use code…';
    void api.createTelegramLinkCode()
      .then(challenge => {
        if (status) {
          status.textContent = `Code ${challenge.code} — open Cribbit inside Telegram, choose Link existing account, and enter it. It works once and expires soon.`;
        }
      })
      .catch((error: unknown) => {
        if (!status) return;
        if (error instanceof ApiError && error.status === 401) {
          status.textContent = 'Sign in to Cribbit before linking Telegram.';
          return;
        }
        const detail = error instanceof ApiError ? `${error.status} ${error.message}`.slice(0, 160) : 'unexpected error';
        status.textContent = `Could not create a link code (${detail}).`;
      });
  });

  const openTrigger = document.querySelector<HTMLElement>('[data-action="open-profile"]');
  const openProfile = (): void => {
    if (!dialog.open) dialog.showModal();
    void refresh();
  };
  openTrigger?.addEventListener('click', openProfile);

  return () => { openTrigger?.removeEventListener('click', openProfile); };
}

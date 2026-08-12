import type { CardKind } from '../../../packages/contracts/src/index.ts';
import type { PlatformAdapter } from '../../../packages/platform/src/types.ts';
import './styles/contextual.css';

type ContextKind = 'wild' | 'truth' | 'dare' | 'paranoia' | 'duel' | 'chaos' | 'nope' | 'pass' | 'rewind' | 'flag';

const TARGETS = ['Leo', 'Nina', 'Jordan'];

export function installContextualRuleUI(host: HTMLElement, platform: PlatformAdapter): void {
  host.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-card-kind],[data-action]') : null;
    if (!target) return;

    const cardKind = target.dataset.cardKind as CardKind | undefined;
    if (cardKind && isContextCard(cardKind)) {
      openContext(host, platform, cardKind);
      return;
    }

    const action = target.dataset.action;
    if (action === 'use-nope') openContext(host, platform, 'nope');
    if (action === 'safety-pass') openContext(host, platform, 'pass');
    if (action === 'safety-rewind') openContext(host, platform, 'rewind');
    if (action === 'safety-flag') openContext(host, platform, 'flag');
  });
}

function isContextCard(kind: CardKind): kind is Extract<CardKind, ContextKind> {
  return ['wild','truth','dare','paranoia','duel','chaos','nope'].includes(kind);
}

function openContext(host: HTMLElement, platform: PlatformAdapter, kind: ContextKind): void {
  closeContext(host);
  const wrapper = document.createElement('div');
  wrapper.className = 'tg-context-layer';
  wrapper.dataset.contextLayer = kind;
  wrapper.innerHTML = contextTemplate(kind);
  host.append(wrapper);
  platform.haptic(kind === 'chaos' || kind === 'duel' ? 'medium' : 'light');

  wrapper.querySelector<HTMLElement>('[data-context-scrim]')?.addEventListener('click', () => closeContext(host));
  wrapper.querySelector<HTMLElement>('[data-context-close]')?.addEventListener('click', () => closeContext(host));

  wrapper.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => {
    button.addEventListener('click', () => {
      const command = button.dataset.command || '';
      const detail = button.dataset.value || button.dataset.mode || button.textContent?.trim() || '';
      const status = host.querySelector<HTMLElement>('[data-game-status]');
      if (status) status.textContent = `${command}${detail ? ` • ${detail}` : ''} UI mapped. Demo preview did not send an authoritative command.`;
      platform.haptic('medium');
      closeContext(host);
    });
  });
}

function closeContext(host: HTMLElement): void {
  host.querySelector<HTMLElement>('[data-context-layer]')?.remove();
}

function contextTemplate(kind: ContextKind): string {
  const body = contextBody(kind);
  return `
    <button class="tg-context-scrim" type="button" data-context-scrim aria-label="Close contextual panel"></button>
    <section class="tg-context-sheet tg-context-sheet--${kind}" role="dialog" aria-modal="true" aria-labelledby="tgContextTitle">
      <div class="tg-context-handle" aria-hidden="true"></div>
      <header class="tg-context-header">
        <div>
          <small>CONTEXTUAL RULE</small>
          <h2 id="tgContextTitle">${contextTitle(kind)}</h2>
        </div>
        <button type="button" class="tg-context-close" data-context-close aria-label="Close">×</button>
      </header>
      ${body}
      <p class="tg-context-authority">Preview only. Shared game state/server authority decides whether this command is legal and what happens next.</p>
    </section>
  `;
}

function contextTitle(kind: ContextKind): string {
  switch (kind) {
    case 'wild': return 'Choose a Color';
    case 'truth': return 'Truth';
    case 'dare': return 'Dare';
    case 'paranoia': return 'Choose a Player';
    case 'duel': return 'Choose Duel Target';
    case 'chaos': return 'Chaos Resolution';
    case 'nope': return 'Nope Reaction';
    case 'pass': return 'Pass / Not For Me';
    case 'rewind': return 'Rewind Prompt';
    case 'flag': return 'Flag Prompt';
  }
}

function contextBody(kind: ContextKind): string {
  if (kind === 'wild') {
    return `<div class="tg-color-grid">
      ${['lime','orange','cyan','purple'].map(color => `<button type="button" data-command="SELECT_WILD_COLOR" data-value="${color}" data-color-choice="${color}">${color}</button>`).join('')}
    </div>`;
  }

  if (kind === 'truth' || kind === 'dare') {
    return `
      <div class="tg-prompt-card">
        <small>${kind === 'truth' ? 'TRUTH PROMPT' : 'DARE CHALLENGE'}</small>
        <p>${kind === 'truth' ? 'What harmless talent would surprise this group the most?' : 'Act like a cartoon villain for 20 seconds. The group guesses the type.'}</p>
      </div>
      <div class="tg-answer-grid">
        <button type="button" data-command="SELECT_ANSWER_MODE" data-mode="SPEAK">Speak</button>
        <button type="button" data-command="SELECT_ANSWER_MODE" data-mode="TYPE">Type</button>
        <button type="button" data-command="SELECT_ANSWER_MODE" data-mode="CHOOSE">Choose</button>
        <button type="button" data-command="MARK_ANSWERED_LIVE" data-mode="ANSWERED_LIVE">Answered Live</button>
      </div>
      <button class="tg-context-wide" type="button" data-command="PASS_PROMPT">Pass / Not For Me</button>`;
  }

  if (kind === 'paranoia') {
    return `<p class="tg-context-copy">The prompt remains sealed until the existing Paranoia contract permits its reveal. Select the target only.</p>${targetGrid('SELECT_PARANOIA_TARGET')}`;
  }

  if (kind === 'duel') {
    return `<p class="tg-context-copy">Select the opponent. The shared Duel state owns the sequential response windows and result.</p>${targetGrid('SELECT_DUEL_TARGET')}`;
  }

  if (kind === 'chaos') {
    return `<div class="tg-chaos-preview"><span>✹</span><b>Chaos effect selected by game state</b><p>The Telegram client presents the resolved effect; it does not choose or randomize the authoritative effect.</p></div><button class="tg-context-wide" type="button" data-command="COMPLETE_FLOW">Acknowledge</button>`;
  }

  if (kind === 'nope') {
    return `<div class="tg-reaction-window"><strong>NOPE AVAILABLE</strong><span>Reaction window</span></div><button class="tg-context-wide tg-context-wide--gold" type="button" data-command="PLAY_NOPE">Use Nope</button>`;
  }

  if (kind === 'pass') {
    return `<p class="tg-context-copy">Pass uses the existing safety contract and does not require the Telegram client to decide eligibility.</p><button class="tg-context-wide" type="button" data-command="PASS_PROMPT">Pass Prompt</button>`;
  }

  if (kind === 'rewind') {
    return `<p class="tg-context-copy">Rewind requests an eligible alternate prompt through the existing shared rule.</p><button class="tg-context-wide" type="button" data-command="REWIND_PROMPT">Rewind</button>`;
  }

  return `<p class="tg-context-copy">Flag the current prompt for moderation using the existing safety command.</p><div class="tg-flag-grid"><button type="button" data-command="FLAG_PROMPT" data-value="inappropriate">Inappropriate</button><button type="button" data-command="FLAG_PROMPT" data-value="unsafe">Unsafe</button><button type="button" data-command="FLAG_PROMPT" data-value="other">Other</button></div>`;
}

function targetGrid(command: string): string {
  return `<div class="tg-target-grid">${TARGETS.map(name => `<button type="button" data-command="${command}" data-value="${name}"><span>${name.slice(0,1)}</span><b>${name}</b></button>`).join('')}</div>`;
}

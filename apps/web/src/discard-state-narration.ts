const SPECIAL_TITLES = new Set([
  'truth',
  'dare',
  'paranoia',
  'chaos',
  'duel',
  'tag',
  'truth or chaos',
  'hijack',
  'taboo',
  'machiavelli',
  'ghost',
  'reverse confession',
  'dig me',
]);

function normalized(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function latestPlayedBy(eventList: HTMLElement, cardTitle: string): string | null {
  const expectedTitle = normalized(cardTitle);
  const items = Array.from(eventList.querySelectorAll<HTMLElement>('.event-item'));

  for (const item of items) {
    const type = normalized(item.querySelector<HTMLElement>('.event-item__top b')?.textContent);
    if (type !== 'card played') continue;

    const message = item.querySelector<HTMLParagraphElement>('p')?.textContent?.trim() ?? '';
    const match = message.match(/^(.+?) played (.+?)\.$/i);
    if (!match) continue;

    if (normalized(match[2]) === expectedTitle) {
      return match[1].trim();
    }
  }

  return null;
}

export function startDiscardStateNarration(): () => void {
  const discardSlot = document.querySelector<HTMLElement>('#discardSlot');
  const eventList = document.querySelector<HTMLElement>('#eventList');
  const activeTitle = document.querySelector<HTMLElement>('#activeChallengeTitle');

  if (!discardSlot || !eventList || !activeTitle) {
    return () => undefined;
  }

  const pile = discardSlot.parentElement;
  if (!pile) return () => undefined;

  let status = pile.querySelector<HTMLElement>('#discardStateStatus');
  if (!status) {
    status = document.createElement('span');
    status.id = 'discardStateStatus';
    status.className = 'tag';
    status.dataset.tone = 'cyan';
    status.hidden = true;
    discardSlot.insertAdjacentElement('afterend', status);
  }

  const sync = (): void => {
    const topCard = discardSlot.querySelector<HTMLElement>('.discard-layer.is-top .game-card');
    const cardTitle = topCard?.querySelector<HTMLElement>('.game-card__title')?.textContent?.trim() ?? '';
    const family = normalized(cardTitle);

    if (!cardTitle || !SPECIAL_TITLES.has(family)) {
      status.hidden = true;
      status.textContent = '';
      return;
    }

    const active = normalized(activeTitle.textContent).includes(`${family} resolution`);
    const actor = latestPlayedBy(eventList, cardTitle);

    status.hidden = false;

    if (active) {
      status.dataset.tone = family === 'dare' ? 'orange' : family === 'truth' ? 'lime' : 'purple';
      status.textContent = actor
        ? `Active ${cardTitle} · played by ${actor}`
        : `Active ${cardTitle}`;
      return;
    }

    status.dataset.tone = 'cyan';
    status.textContent = actor
      ? `Resolved ${cardTitle} · played by ${actor} · remains top discard until another card is played`
      : `Resolved ${cardTitle} · remains top discard until another card is played`;
  };

  const observer = new MutationObserver(sync);
  observer.observe(discardSlot, { childList: true, subtree: true, characterData: true });
  observer.observe(eventList, { childList: true, subtree: true, characterData: true });
  observer.observe(activeTitle, { childList: true, subtree: true, characterData: true });

  sync();
  return () => observer.disconnect();
}

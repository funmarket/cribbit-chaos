import { BrowserPlatform } from '../../../packages/platform/src/browser.ts';
import { bootstrap, mountSharedTemplate } from '../../../packages/ui/src/bootstrap.ts';
import { startCanonicalBoardCardHydration } from './canonical-board-cards.ts';
import { mountChaosPulseLab } from './chaos-pulse-lab.ts';
import './web-game.css';
import './web-compact.css';
import './canonical-hero-cards.css';
import './chaos-pulse-lab.css';

const CANONICAL_HERO_CARDS = [
  {
    className: 'cc-web-card-reverse-confession',
    label: 'Reverse Confession',
    src: new URL(
      '../../../packages/cards/assets/CHAOS-133-V1/cards/reverse_confession/fIYGR_01.jpg',
      import.meta.url,
    ).href,
  },
  {
    className: 'cc-web-card-paranoia',
    label: 'Paranoia',
    src: new URL(
      '../../../packages/cards/assets/CHAOS-133-V1/cards/paranoia/paranoia_01.jpg',
      import.meta.url,
    ).href,
  },
  {
    className: 'cc-web-card-dig-me',
    label: 'Dig Me',
    src: new URL(
      '../../../packages/cards/assets/CHAOS-133-V1/cards/Dig_Me/digme.jpg',
      import.meta.url,
    ).href,
  },
  {
    className: 'cc-web-card-nope',
    label: 'Nope',
    src: new URL(
      '../../../packages/cards/assets/CHAOS-133-V1/cards/nope/nope_01.jpg',
      import.meta.url,
    ).href,
  },
] as const;

function canonicalHeroCardMarkup(): string {
  return CANONICAL_HERO_CARDS.map(
    card => `
      <figure class="cc-web-hero-card ${card.className}" aria-label="${card.label} card">
        <img class="cc-web-hero-card__image" src="${card.src}" alt="${card.label} card artwork" draggable="false">
      </figure>
    `,
  ).join('');
}

function mountCribbitChaosHero(): void {
  const heroHost =
    document.querySelector<HTMLElement>('.lobby-hero');

  const roomCreation =
    document.querySelector<HTMLElement>('.setup-panel');

  const startButton =
    document.querySelector<HTMLButtonElement>(
      '#startGameButton',
    );

  if (!heroHost || !roomCreation) {
    return;
  }

  roomCreation.id = 'roomCreation';

  heroHost.innerHTML = `
    <div class="cc-web-hero">
      <div class="cc-web-cards-bg" aria-hidden="true">
        ${canonicalHeroCardMarkup()}
      </div>

      <div class="cc-web-content">
        <div class="cc-web-eyebrow">
          <div class="cc-web-eyebrow-dot"></div>
          <span class="cc-web-eyebrow-text">Now Live</span>
          <div class="cc-web-eyebrow-sep"></div>
          <span class="cc-web-eyebrow-tag">Social Card Game</span>
        </div>

        <div class="cc-web-logo">
          <div class="cc-web-logo-frog">🐸</div>
          <div class="cc-web-logo-text">
            <div class="cc-web-logo-cribbit">Cribbit</div>
            <div class="cc-web-logo-chaos">CHAOS</div>
          </div>
        </div>

        <div class="cc-web-headline">
          Your friends<br>
          <em>won't survive</em><br>
          <span class="cc-web-line-pink">night two.</span>
        </div>

        <div class="cc-web-stats">
          <div class="cc-web-stat s1">
            <div class="cc-web-stat-num">2–10</div>
            <div class="cc-web-stat-label">Players</div>
          </div>
          <div class="cc-web-stat s2">
            <div class="cc-web-stat-num">7</div>
            <div class="cc-web-stat-label">Cards Dealt</div>
          </div>
          <div class="cc-web-stat s3">
            <div class="cc-web-stat-num">133</div>
            <div class="cc-web-stat-label">Cards</div>
          </div>
          <div class="cc-web-stat s4">
            <div class="cc-web-stat-num">∞</div>
            <div class="cc-web-stat-label">Stories</div>
          </div>
        </div>

        <p class="cc-web-description">
          <span class="cc-web-kicker">Cribbit CHAOS is a shedding card game with a social fuse.</span>
          Deal seven cards, match color or symbol, then watch the social layer detonate —
          <span class="cc-web-highlight">truths, dares, paranoia, chaos, duels,</span>
          and tactical Nopes that can flip a round.
          First to legally empty their hand wins.
          <span class="cc-web-highlight">Everyone else explains themselves.</span>
        </p>

        <div class="cc-web-mechanics">
          <span class="cc-web-pill p-truth">❓ Truth</span>
          <span class="cc-web-pill p-dare">⚡ Dare</span>
          <span class="cc-web-pill p-paranoia">◉ Paranoia</span>
          <span class="cc-web-pill p-chaos">↻ Chaos</span>
          <span class="cc-web-pill p-duel">⚔️ Duel</span>
          <span class="cc-web-pill p-nope">✋ Nope</span>
        </div>

        <div class="cc-web-infobar">
          <span class="cc-web-infobar-shield">🛡️</span>
          <div class="cc-web-infobar-text">
            <b>Explicit safety controls built in.</b>
            Pass, Rewind, Nope and Flag keep CHAOS on your terms.
          </div>
        </div>

        <div class="cc-web-actions">
          <a class="button cc-web-create" href="#roomCreation">Create a game</a>
        </div>
      </div>
    </div>
  `;

  /* Preserve the existing runtime-bound button identity. */
  if (startButton) {
    heroHost
      .querySelector<HTMLElement>('.cc-web-actions')
      ?.append(startButton);
  }
}

function setupHomepageHeaderScroll(): void {
  const header = document.querySelector<HTMLElement>('.app-header');
  const lobbyView = document.querySelector<HTMLElement>('[data-view="lobby"]');

  if (!header || !lobbyView) {
    return;
  }

  let previousScrollY = window.scrollY;

  const isLobbyActive = (): boolean =>
    lobbyView.classList.contains('is-active');

  const syncHeaderMode = (): void => {
    const lobbyActive = isLobbyActive();

    header.classList.toggle('web-lobby-header', lobbyActive);

    if (!lobbyActive) {
      header.classList.remove('web-secondary-hidden');
    }
  };

  const handleScroll = (): void => {
    if (!isLobbyActive()) {
      header.classList.remove('web-secondary-hidden');
      previousScrollY = window.scrollY;
      return;
    }

    const currentScrollY = window.scrollY;

    if (currentScrollY < 80) {
      header.classList.remove('web-secondary-hidden');
    } else if (currentScrollY > previousScrollY + 5) {
      header.classList.add('web-secondary-hidden');
    } else if (currentScrollY < previousScrollY - 5) {
      header.classList.remove('web-secondary-hidden');
    }

    previousScrollY = currentScrollY;
  };

  syncHeaderMode();

  window.addEventListener('scroll', handleScroll, { passive: true });

  const observer = new MutationObserver(syncHeaderMode);
  observer.observe(lobbyView, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

async function startWeb(): Promise<void> {
  const platform = new BrowserPlatform();

  // Compatibility composition is explicit while each surface is transferred.
  // bootstrap() no longer injects the historical application DOM implicitly.
  mountSharedTemplate();
  mountCribbitChaosHero();

  await bootstrap(platform, {
    runtimeMode: 'legacy-compatibility',
  });

  startCanonicalBoardCardHydration();
  setupHomepageHeaderScroll();
  mountChaosPulseLab();
}

void startWeb();

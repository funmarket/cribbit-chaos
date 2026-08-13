import { BrowserPlatform } from '../../../packages/platform/src/browser.ts';
import { bootstrap } from '../../../packages/ui/src/bootstrap.ts';
import './web-game.css';

async function startWeb(): Promise<void> {
  await bootstrap(new BrowserPlatform());

  const hero = document.querySelector<HTMLElement>('.lobby-hero');
  const setup = document.querySelector<HTMLElement>('.setup-panel');
  const start = document.querySelector<HTMLButtonElement>('#startGameButton');

  if (!hero || !setup || !start) return;

  setup.id = 'roomCreation';

  hero.innerHTML = `
    <div class="web-home-hero">
      <div class="web-home-content">

        <div class="web-home-eyebrow">
          <span class="web-home-dot"></span>
          <span>NOW LIVE</span>
          <i></i>
          <span class="muted">SOCIAL CARD GAME</span>
        </div>

        <div class="web-home-logo">
          <span class="frog">🐸</span>
          <div>
            <strong>CRIBBIT</strong>
            <em>CHAOS</em>
          </div>
        </div>

        <h1 class="web-home-headline">
          YOUR FRIENDS<br>
          <em>WON'T FORGET</em><br>
          <span>NIGHT TWO.</span>
        </h1>

        <div class="web-home-stats">
          <div><strong>2–10</strong><span>PLAYERS</span></div>
          <div><strong>20–60</strong><span>MINUTES</span></div>
          <div><strong>112</strong><span>CARDS</span></div>
          <div><strong>∞</strong><span>STORIES</span></div>
        </div>

        <p class="web-home-description">
          <strong>Cribbit CHAOS is a shedding card game with a social fuse.</strong>
          Deal seven cards, match color or symbol, then let Truth, Dare,
          Paranoia, Chaos, Duel and tactical Nope reactions light up the room.
          First to empty their hand wins.
        </p>

        <div class="web-home-mechanics">
          <span class="truth">? Truth</span>
          <span class="dare">⚡ Dare</span>
          <span class="paranoia">◉ Paranoia</span>
          <span class="chaos">↻ Chaos</span>
          <span class="duel">⚔ Duel</span>
          <span class="nope">✋ Nope</span>
        </div>

        <div class="web-home-safety">
          <span>🛡️</span>
          <p>
            <strong>Safety controls stay distinct.</strong>
            Pass declines a prompt, Rewind replaces eligible Truth/Dare prompts,
            Nope blocks eligible effects, and Flag handles moderation.
          </p>
        </div>

        <div class="web-lobby-actions">
          <a class="button web-create-game-button" href="#roomCreation">
            Create a game
          </a>
        </div>
      </div>

      <div class="web-home-cards" aria-hidden="true">
        <div class="web-deco-card truth-card">
          <span>?</span>
          <b>TRUTH</b>
        </div>

        <div class="web-deco-card dare-card">
          <span>⚡</span>
          <b>DARE</b>
        </div>

        <div class="web-deco-card paranoia-card">
          <span>◉</span>
          <b>PARANOIA</b>
        </div>

        <div class="web-deco-card duel-card">
          <span>⚔</span>
          <b>DUEL</b>
        </div>

        <div class="web-deco-card nope-card">
          <span>✋</span>
          <b>NOPE</b>
        </div>
      </div>
    </div>
  `;

  const actions = hero.querySelector('.web-lobby-actions');
  if (actions) {
    start.classList.add('web-hero-start');
    actions.append(start);
  }
}

void startWeb();

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

  const actions = document.createElement('div');
  actions.className = 'web-lobby-actions';
  actions.innerHTML = '<a class="button button--primary" href="#roomCreation">Create a game</a>';
  actions.append(start);
  hero.append(actions);
}

void startWeb();

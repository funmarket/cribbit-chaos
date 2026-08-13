import { BrowserPlatform } from '../../../packages/platform/src/browser.ts';
import { bootstrap } from '../../../packages/ui/src/bootstrap.ts';
import './web-game.css';

async function startWeb(): Promise<void> {
  const platform = new BrowserPlatform();

  await bootstrap(platform);
}

void startWeb();

import { BrowserPlatform } from '../../../packages/platform/src/browser.ts';
import { bootstrap } from '../../../packages/ui/src/bootstrap.ts';
import './web-game.css';

void bootstrap(new BrowserPlatform());

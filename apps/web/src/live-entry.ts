import type { CribbitApiClient } from '../../../packages/api-client/src/index.ts';
import { startWebAuthUI } from './web-auth.ts';
import { startWebLiveRooms } from './live-session.ts';

let started = false;
let attempts = 0;

function startWhenReady(): void {
  if (started) return;
  attempts += 1;
  const api = (window as Window & { __CRIBBIT_API__?:CribbitApiClient }).__CRIBBIT_API__;
  const app = document.querySelector('#app');
  const roomForm = document.querySelector('#joinCode');
  if (api && app && roomForm) {
    started = true;
    startWebAuthUI(api);
    startWebLiveRooms(api);
    return;
  }
  if (attempts < 200) window.setTimeout(startWhenReady,25);
  else console.error('[Cribbit] Web live/auth entry could not find the bootstrapped app.');
}

startWhenReady();

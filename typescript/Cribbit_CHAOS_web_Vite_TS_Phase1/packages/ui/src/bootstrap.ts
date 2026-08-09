import template from './template.html?raw';
import './styles.css';
import type { PlatformAdapter } from '../../platform/src/types.ts';

export async function bootstrap(platform: PlatformAdapter): Promise<void> {
  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) throw new Error('Missing #app host');
  host.innerHTML = template;
  platform.initialize();
  window.__CRIBBIT_PLATFORM__ = platform;
  await import('../../legacy-runtime/src/runtime.ts');
}

declare global {
  interface Window { __CRIBBIT_PLATFORM__?: PlatformAdapter; }
}

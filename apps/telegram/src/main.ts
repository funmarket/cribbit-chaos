import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { bootstrap, mountSharedTemplate } from '../../../packages/ui/src/bootstrap.ts';
import { initializeCanonicalGameRuntime } from '../../web/src/canonical-game-runtime.ts';
import { startCanonicalBoardCardHydration } from '../../web/src/canonical-board-cards.ts';
import { startDiscardStateNarration } from '../../web/src/discard-state-narration.ts';
import '../../web/src/web-compact.css';
import './styles/telegram-shared-game.css';

function prepareTelegramSharedUI(platform: TelegramPlatform): void {
  document.documentElement.dataset.telegramComposition = 'shared-game';

  const preview = platform.getIdentityPreview();
  const profileName = document.querySelector<HTMLInputElement>('#profileName');
  if (profileName && preview.displayName) profileName.value = preview.displayName;

  const qaToggle = document.querySelector<HTMLInputElement>('#qaHandToggle');
  if (qaToggle) {
    qaToggle.checked = false;
    qaToggle.closest<HTMLElement>('.knob-row')?.remove();
  }

  const startButton = document.querySelector<HTMLButtonElement>('#startGameButton');
  if (startButton) {
    startButton.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-play" /></svg>Start Game';
  }

  const joinField = document.querySelector<HTMLInputElement>('#joinCode')?.closest<HTMLElement>('.setup-row');
  joinField?.remove();

  document.querySelectorAll<HTMLElement>('.demo-note').forEach(node => node.remove());
}

async function startTelegram(): Promise<void> {
  const platform = new TelegramPlatform();

  // Telegram is a presentation adapter over the same gameplay composition as Web.
  // Mount the shared DOM once, then initialize the same canonical runtime that owns
  // card legality, social flows, bots, forced-on-draw handling and win boundaries.
  mountSharedTemplate();
  prepareTelegramSharedUI(platform);
  initializeCanonicalGameRuntime();

  await bootstrap(platform, {
    runtimeMode: 'legacy-compatibility',
  });

  startCanonicalBoardCardHydration();
  startDiscardStateNarration();
}

void startTelegram();

import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { bootstrapTelegram } from './bootstrapTelegram.ts';

const platform = new TelegramPlatform();
const params = new URLSearchParams(location.search);
const compatibilityFixture = params.get('compat') === '1' && Boolean(params.get('fixture'));

if (compatibilityFixture) {
  void import('../../../packages/ui/src/bootstrap.ts').then(({ bootstrap }) => bootstrap(platform));
} else {
  void bootstrapTelegram(platform);
}

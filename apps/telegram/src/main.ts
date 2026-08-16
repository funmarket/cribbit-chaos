import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { bootstrapTelegram } from './bootstrapTelegram.ts';
import './styles/hardening.css';

const platform = new TelegramPlatform();
const params = new URLSearchParams(location.search);
const compatibilityFixture = params.get('compat') === '1' && Boolean(params.get('fixture'));

if (compatibilityFixture) {
  void import('../../../packages/ui/src/bootstrap.ts').then(({ bootstrap, mountSharedTemplate }) => {
    mountSharedTemplate();
    return bootstrap(platform, { runtimeMode: 'legacy-compatibility' });
  });
} else {
  void bootstrapTelegram(platform);
}

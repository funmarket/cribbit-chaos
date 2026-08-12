import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { bootstrapTelegram } from './bootstrapTelegram.ts';

void bootstrapTelegram(new TelegramPlatform());

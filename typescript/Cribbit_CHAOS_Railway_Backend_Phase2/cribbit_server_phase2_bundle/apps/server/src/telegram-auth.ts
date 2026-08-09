import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ValidatedTelegramUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  authDate: number;
}

function hmacSha256(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

export function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 3600): ValidatedTelegramUser {
  if (!initData) throw new Error('Missing Telegram initData.');
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  const params = new URLSearchParams(initData);
  const suppliedHash = params.get('hash');
  if (!suppliedHash || !/^[a-f0-9]{64}$/i.test(suppliedHash)) throw new Error('Invalid Telegram hash.');

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([key,value]) => `${key}=${value}`)
    .join('\n');

  // Telegram Mini Apps spec: secret_key = HMAC_SHA256(bot_token, key='WebAppData').
  const secretKey = hmacSha256('WebAppData', botToken);
  const calculated = hmacSha256(secretKey, dataCheckString);
  const supplied = Buffer.from(suppliedHash, 'hex');
  if (supplied.length !== calculated.length || !timingSafeEqual(supplied, calculated)) throw new Error('Telegram initData signature mismatch.');

  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now()/1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || now - authDate > maxAgeSeconds || authDate > now + 30) throw new Error('Telegram initData is stale or invalid.');

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('Telegram initData contains no user.');
  const user = JSON.parse(rawUser) as { id:number|string; first_name?:string; last_name?:string; username?:string; language_code?:string };
  if (!user.id) throw new Error('Telegram user id missing.');
  return {
    id:String(user.id), firstName:user.first_name, lastName:user.last_name,
    username:user.username, languageCode:user.language_code, authDate
  };
}

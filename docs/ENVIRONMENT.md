# Environment

Copy `.env.example` to `.env` and fill only the variables that apply to the target surface.

Client variables:

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_APP_ENV`

Railway/server variables:

- `APP_ENV`
- `ALLOW_GUEST_AUTH`
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_LOGIN_CLIENT_ID`
- `TELEGRAM_LOGIN_CLIENT_SECRET`
- `TELEGRAM_LOGIN_REDIRECT_URI`
- `SESSION_SECRET`
- `JWT_SECRET`
- `FRONTEND_ORIGINS`
- `TELEGRAM_INITDATA_MAX_AGE_SECONDS`
- `PORT`

`ALLOW_GUEST_AUTH` is an explicit local/demo escape hatch only. It defaults to disabled and is ignored when `APP_ENV` or `NODE_ENV` is `production`. Production and public staging must use Telegram authentication rather than silently creating guest accounts.

Never commit `.env` or real credentials.

Never expose server secrets to Vite client bundles.

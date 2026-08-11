# Environment

Copy `.env.example` to `.env` and fill only the variables that apply to the target surface.

Client variables:

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_APP_ENV`

Railway/server variables:

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

Never commit `.env` or real credentials.

Never expose server secrets to Vite client bundles.

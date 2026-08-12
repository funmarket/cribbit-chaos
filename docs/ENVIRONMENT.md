# Environment

This is a living environment-control document. Update it whenever variable ownership, deployment hosts, secrets, origins, or verified runtime configuration changes.

Copy `.env.example` to `.env` for local development and fill only the variables that apply to the target surface.

## Client variables

Cloudflare Pages Web and Telegram use only client-safe Vite variables:

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_APP_ENV`

Current primary production API values:

```text
VITE_API_URL=https://api-production-2556.up.railway.app
VITE_WS_URL=https://api-production-2556.up.railway.app
```

These values may also exist on secondary/fallback Vercel projects, but Vercel is not the primary current staging host.

## Railway/server variables

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

Current Railway frontend origins are the exact primary Cloudflare origins:

```text
https://cribbit-chaos-web.pages.dev
https://cribbit-chaos-telegram.pages.dev
```

## Ownership rules

Railway-only secrets:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_LOGIN_CLIENT_ID`
- `TELEGRAM_LOGIN_CLIENT_SECRET`
- `TELEGRAM_LOGIN_REDIRECT_URI`
- server session/JWT secrets

Never place these in Cloudflare Pages, Vercel public variables, or Vite client bundles.

Never commit `.env` or real credentials.

The previous Telegram bot token shared during staging must be treated as compromised and replaced before live Mini App authentication proof.

After each environment/configuration implementation slice, synchronize this file, `PLAN.md`, `docs/DEPLOYMENT.md`, related auth docs, and the active PR description.

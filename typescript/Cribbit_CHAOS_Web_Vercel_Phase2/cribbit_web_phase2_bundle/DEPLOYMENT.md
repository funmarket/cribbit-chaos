# Deployment plan

## 1. GitHub

Push the repository as one monorepo. Keep `main` protected and use Vercel previews for UI review.

## 2. Railway

Create one Railway project containing:

- PostgreSQL service
- `cribbit-chaos-api` service from this GitHub repository

Server service variables:

```text
DATABASE_URL=<Railway Postgres reference>
TELEGRAM_BOT_TOKEN=<BotFather secret>
TELEGRAM_INITDATA_MAX_AGE_SECONDS=3600
SESSION_SECRET=<32+ random bytes>
FRONTEND_ORIGINS=https://<web-domain>,https://<telegram-domain>
```

Run `db/migrations/001_initial.sql` against PostgreSQL before enabling persistent endpoints.

The API service must remain the only owner of game mutations. Do not connect either browser client directly to PostgreSQL.

## 3. Vercel Web project

- Import the same GitHub repository.
- Root Directory: `apps/web`.
- Ensure source files outside Root Directory are included (current Vercel projects normally enable this for monorepos).
- Build command: `cd ../.. && npm run build:web`.
- Output directory: `dist`.
- Set `VITE_API_URL`, `VITE_WS_URL`, `VITE_APP_ENV`.

## 4. Vercel Telegram project

- Import the same repository again as a second Vercel project.
- Root Directory: `apps/telegram`.
- Build command: `cd ../.. && npm run build:telegram`.
- Output directory: `dist`.
- Use the same Railway API and WS values as the web project.

## 5. BotFather

Create/configure the Cribbit CHAOS bot and enable its Main Mini App. Set the Telegram Vercel production HTTPS URL as the Mini App URL. Use direct links such as a `startapp` room/invite parameter only as lookup context; Railway must validate membership and authorization after Telegram authentication.

## 6. Production gate

Do not switch `VITE_BACKEND_MODE`/client behavior to authoritative remote play until the game reducer, database transaction layer, command idempotency and reconnect tests are complete. Phase 2 intentionally keeps the V4 demo runtime functioning locally while defining every production backend ownership boundary.

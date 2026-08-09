# Telegram + Vercel + Railway architecture review

Reviewed against official platform documentation on 2026-08-09.

## Telegram Mini App decision

Cribbit CHAOS should use a Telegram Mini App as the primary Telegram surface, not the older Bot API HTML5 Game flow. Mini Apps are ordinary HTML5/JavaScript applications inside Telegram and explicitly support shared/concurrent chat-context usage, including multiplayer games. The same app can call the same Railway API and PostgreSQL database as the standalone web client.

Production requirements implemented or reserved in this repository:

- Load `https://telegram.org/js/telegram-web-app.js` only in the Telegram build.
- Call `ready()` and `expand()` on startup.
- Treat `initDataUnsafe` as display-only; send raw `initData` to Railway for cryptographic validation.
- Validate Telegram `auth_date` server-side to reject stale replay attempts.
- Support `start_param` / `tgWebAppStartParam` so deep links can resolve a room/invite.
- Respect Telegram safe-area/content-safe-area values and viewport changes.
- Use Telegram fullscreen API where supported rather than browser Fullscreen API.
- Keep passive call audio outside gameplay. Voice capture must remain explicit and scoped.
- `chat_instance` can be useful room-launch context but is not a user identity or authorization primitive.

Official source: https://core.telegram.org/bots/webapps

## One database, two clients

Both clients use internal Cribbit user IDs. Telegram identities are rows in `user_identities` keyed by `(provider, provider_user_id)`. Browser/web identities can later be guest, email, Telegram Login/OIDC, or another explicit provider without changing game/session tables.

Neither browser client connects directly to PostgreSQL.

```text
Telegram Mini App on Vercel ----\
                                  > Railway API + realtime ---- Railway PostgreSQL
Standalone Web App on Vercel ---/
```

The game server is authoritative for current turn, hand ownership, legal play, prompt eligibility, reaction windows, winner, revision and reconnect snapshots.

## Vercel review

The repository is structured as a JavaScript monorepo with separate `apps/web` and `apps/telegram` Vercel projects and shared packages. Vercel supports multiple projects from one monorepo and shared source outside the selected Root Directory. Each app contains an SPA rewrite to `index.html`.

Recommended Vercel projects:

1. `cribbit-chaos-web` → Root Directory `apps/web`
2. `cribbit-chaos-telegram` → Root Directory `apps/telegram`

Both set only public client configuration:

- `VITE_API_URL=https://<railway-api-domain>`
- `VITE_WS_URL=wss://<railway-api-domain>`
- `VITE_APP_ENV=production`

Never place the Telegram bot token, database URL, session secret or moderation secrets in a `VITE_*` variable because Vite client variables are compiled into browser code.

Official sources:
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/monorepos

## Railway review

Railway is the intended long-running authoritative API/realtime host. It can run the Fastify/Socket.IO service and a PostgreSQL service in the same Railway project. PostgreSQL provides `DATABASE_URL` plus the standard PG variables. Railway documents WebSocket/Socket.IO deployment and reconnect support.

Official sources:
- https://docs.railway.com/databases/postgresql
- https://docs.railway.com/guides/socketio

## Secrets boundary

Railway only:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `SESSION_SECRET`
- moderation/service secrets

Vercel clients only receive public API/realtime addresses.

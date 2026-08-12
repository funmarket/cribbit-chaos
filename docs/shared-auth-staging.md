# Shared auth staging

This is a living auth/staging control document. Update it whenever hosting, auth configuration, identity proof, backend state, or staging blockers change.

Cribbit CHAOS is one product with two clients. Web and Telegram must converge on the same Railway API, the same Railway PostgreSQL database, and the same internal `users.id` UUID.

## Current architecture

```text
Web Cloudflare Pages
        \
         Railway API -> Railway PostgreSQL
        /
Telegram Cloudflare Pages
```

Primary frontend URLs:

- Web: `https://cribbit-chaos-web.pages.dev`
- Telegram: `https://cribbit-chaos-telegram.pages.dev`

Vercel remains secondary/fallback only.

## Dedicated Railway foundation

Cribbit CHAOS uses only the dedicated Railway project `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`).

Current production environment:

- environment ID: `60d848a2-a7df-4145-a2ec-757a5ec4dc31`
- API service ID: `c255714c-95a2-4194-8bb0-e1846a5e4cf1`
- PostgreSQL service ID: `951b9c62-7cd3-404b-b9f0-c93e2c2a51d7`
- API domain: `https://api-production-2556.up.railway.app`
- PostgreSQL is deployed with persistent storage
- API deploy source: `funmarket/cribbit-chaos` / `feature/visual-integration-checkpoint`
- database migrations run before API deployment
- Railway health check: `/health`
- `FRONTEND_ORIGINS` includes the exact two Cloudflare production origins

The separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) belongs to another repository/product and must never be mutated for Cribbit CHAOS.

## Auth methods

Telegram Mini App:

```text
raw Telegram.WebApp.initData
-> Railway API
-> server-side initData validation
-> resolveOrCreateTelegramIdentity()
-> users.id
```

Browser Web:

```text
Telegram Web Login/OIDC
-> Railway API
-> server-side Authorization Code + PKCE callback verification
-> resolveOrCreateTelegramIdentity()
-> same users.id
```

The Web OIDC routes fail closed with `TELEGRAM_WEB_LOGIN_NOT_CONFIGURED` until the Railway-only Telegram login secrets are configured and the flow is implemented/live-verified. The repository must not fake Telegram OIDC success without a verified identity adapter.

The browser bearer-token handoff must follow `docs/browser-auth-handoff.md`; the Cribbit bearer session token must never be placed in a redirect URL.

## Identity convergence

Telegram identity is not the Cribbit primary key.

```text
Telegram numeric user ID
-> user_identities(provider='telegram', provider_user_id='<telegram id>')
-> users.id
```

The database migration includes `UNIQUE(provider, provider_user_id)` so the same Telegram account cannot create multiple Telegram identity rows.

## Session transport

HTTP and realtime use the same Cribbit server session token:

```text
Authorization: Bearer <session token>
```

Clients store the staging token in `sessionStorage` with an in-memory fallback when storage is unavailable. Tokens are never placed in URLs and should never be logged.

The server stores only SHA-256 token hashes in `auth_sessions.token_hash`. Plaintext session tokens are not persisted server-side.

## Secrets

Railway only:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_LOGIN_CLIENT_ID`
- `TELEGRAM_LOGIN_CLIENT_SECRET`
- `TELEGRAM_LOGIN_REDIRECT_URI`
- `FRONTEND_ORIGINS`
- server session/JWT secrets

Cloudflare Pages primary clients:

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_APP_ENV`

Never expose `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, Telegram client secrets, JWT secrets, or session secrets to Vite.

## Current staging state

Completed foundation:

- dedicated Cribbit Chaos Railway API live
- dedicated Cribbit Chaos Railway PostgreSQL live
- migrations execute before API deployment
- Railway API deployment successful
- current-head Cloudflare Web deployment successful
- current-head Cloudflare Telegram deployment successful
- both primary clients point to the same Railway API/WS URL
- Railway CORS/origins configured for both exact Cloudflare origins

Still open:

- live Web visual smoke test
- live Telegram visual smoke test
- regenerated Railway-only `TELEGRAM_BOT_TOKEN`
- BotFather Main Mini App link to the Cloudflare Telegram URL
- Mini App live auth proof
- Web Telegram OIDC implementation and live proof
- same Telegram account resolving to the same Cribbit UUID from both clients
- shared profile update/read proof across both clients

Vercel Git deployment freshness is not a Phase 3.5 blocker while the current-head Cloudflare staging path remains healthy.

After each auth/staging implementation slice, synchronize this file, `PLAN.md`, relevant deployment/environment/database docs, and the active PR description.

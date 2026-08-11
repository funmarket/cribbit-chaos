# Shared auth staging

Cribbit CHAOS is one product with two clients. Web and Telegram must converge on the same Railway API, the same Railway PostgreSQL database, and the same internal `users.id` UUID.

## Architecture

```text
Web Vercel
      \
       Railway API -> Railway PostgreSQL
      /
Telegram Vercel
```

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

The Web OIDC routes fail closed with `TELEGRAM_WEB_LOGIN_NOT_CONFIGURED` until the Railway-only Telegram login secrets are configured. The repository does not fake Telegram OIDC success without a verified identity adapter.

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

The server stores only `sha256` token hashes in `auth_sessions.token_hash`. Plaintext session tokens are not persisted server-side.

## Secrets

Railway only:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_LOGIN_CLIENT_ID`
- `TELEGRAM_LOGIN_CLIENT_SECRET`
- `TELEGRAM_LOGIN_REDIRECT_URI`
- `FRONTEND_ORIGINS`

Vercel:

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_APP_ENV`

Never expose `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, Telegram client secrets, JWT secrets, or session secrets to Vite.

## Staging blockers

- dedicated Cribbit Chaos Railway API live
- dedicated Cribbit Chaos Railway PostgreSQL live
- both Vercel apps pointing to the same Railway API
- Mini App live auth proof
- Web Telegram login live proof
- same Telegram account resolving to the same Cribbit UUID from both clients
- Vercel Git deployment proof from current GitHub source
- BotFather Main Mini App link for `@CribbitChaos_bot`

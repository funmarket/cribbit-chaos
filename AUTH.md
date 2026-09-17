# Cribbit Chaos Authentication

Cribbit Chaos has one application identity domain and two independent authentication adapters.

```text
                    Cribbit Chaos API
                           |
                    CurrentPrincipal
                           |
                         users
                        /     \
                       /       \
       Telegram user_identities   web_credentials
                 |                     |
          Telegram initData        username/password
                 |                     |
          bearer auth_session       cookie auth_session
                       \             /
                        \           /
                     canonical user.id
                           |
              rooms / games / prompts / profile
```

## Telegram Mini App

Telegram users do not register a Cribbit password in the Mini App.

1. Telegram supplies signed Mini App `initData`.
2. The Mini App sends raw `initData` to `POST /v1/auth/telegram`.
3. Railway validates the signature using the server-only `TELEGRAM_BOT_TOKEN`.
4. The verified Telegram user ID resolves through `user_identities(provider='telegram')` to a canonical `users.id`.
5. Railway returns an opaque Telegram bearer session.
6. The Mini App sends that bearer token to authenticated API routes.

Never accept a browser-supplied Telegram user ID as proof of identity.

## Normal Web app

The normal browser app has independent Cribbit credentials and does not require Telegram.

### Register

`POST /v1/auth/register`

```json
{
  "loginUsername": "john1986",
  "password": "a strong password",
  "displayUsername": "Johnny",
  "displayName": "John",
  "email": "optional@example.com"
}
```

`displayName` and `email` are optional. `loginUsername` and `displayUsername` are intentionally separate.

The successful response contains the canonical user only. The Web session token is never returned in JSON; it is set as an HttpOnly cookie.

### Sign in

`POST /v1/auth/login`

```json
{
  "loginUsername": "john1986",
  "password": "a strong password"
}
```

### Current session

`GET /v1/auth/session`

Returns the canonical user and authentication source.

### Sign out

`POST /v1/auth/logout`

Revokes the stored server session and expires the browser cookie.

## Shared principal

Protected routes resolve both adapters through the same internal principal:

```ts
CurrentPrincipal {
  user
  userId
  authSource
}
```

Business/game code uses `userId`, never Telegram IDs or login usernames.

If a request contains valid Telegram and Web credentials:

- same canonical user: allowed
- different canonical users: rejected with `AUTH_CONFLICT`

## No automatic account merging

A Telegram identity and Web credential remain different Cribbit users unless a future explicit linking flow verifies control of both identities.

Matching usernames, names or email addresses are never sufficient to merge users.

## Live rooms

Both frontends use the same platform-neutral endpoints:

```text
POST /v1/rooms
POST /v1/rooms/join
GET  /v1/games/:sessionId/snapshot
POST /v1/games/:sessionId/commands
Socket.IO /v1/realtime -> game:<sessionId>
```

Therefore a room created by a Telegram-authenticated user can be joined by a Web-authenticated user and vice versa. Room ownership and membership are stored by canonical `users.id`.

The Web app keeps a separate explicit Simulation mode while the remaining game-engine parity work is completed. Simulation rooms are local and are not joinable from another device.

## Cookie and CORS requirements

The current production topology is Cloudflare Pages frontend(s) plus Railway API. Production Web session cookies use:

- `HttpOnly`
- `Secure`
- `SameSite=None`
- `Path=/`

The API must list every allowed frontend origin explicitly in `FRONTEND_ORIGINS`; wildcard credentialed CORS must not be used. The shared API client uses `credentials: "include"` for browser requests.

## Required server environment

```text
DATABASE_URL
TELEGRAM_BOT_TOKEN
TELEGRAM_INITDATA_MAX_AGE_SECONDS
FRONTEND_ORIGINS
APP_ENV=production
NODE_ENV=production
```

Node.js 24.7+ is required for the built-in Argon2id password implementation.

No password, session token or Telegram bot token belongs in a `VITE_*` variable.

## Database migrations

Authentication schema changes are forward-only:

- `001_initial.sql` — canonical users, provider identities, sessions and application ownership
- `002_dual_web_auth.sql` — Web credentials, display usernames, login throttle metadata and session last-use timestamp

Applied migration files must never be edited in place.

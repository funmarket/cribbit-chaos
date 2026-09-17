# Cribbit Chaos Authentication Audit

## Scope

This audit covers the source-level dual-authentication migration for the Web app and Telegram Mini App. It records the repository state inspected before implementation and the architectural decisions applied.

## Existing canonical identity model

The repository already had the correct application identity boundary in `db/migrations/001_initial.sql`:

- `users.id` is the canonical Cribbit user ID.
- `user_identities` maps external identity providers to `users.id` and already permits `telegram` and `web` providers.
- `auth_sessions` stores a SHA-256 hash of opaque session tokens and points to `users.id`.
- `rooms.owner_user_id`, `room_members.user_id`, `game_commands.actor_user_id`, prompts, answers and other application data point to canonical users rather than Telegram IDs.

This migration therefore does **not** create a second user system or duplicate game/application data.

## Problems found

### Telegram authentication

Telegram Mini App authentication already followed the correct proof boundary:

1. Telegram provides signed `initData`.
2. The Mini App sends raw `initData` to Railway.
3. Railway verifies it with the server-only `TELEGRAM_BOT_TOKEN`.
4. `resolveOrCreateTelegramIdentity()` resolves a `user_identities(provider='telegram')` record to one canonical `users.id`.
5. The API creates a hashed server session and returns the bearer token to the Telegram Mini App.

The Telegram frontend previously lost its in-memory auth object on reload even when its bearer session survived. That path was repaired separately by restoring the user from `/v1/me`.

### Web authentication

The normal Web app had no production username/password credential model. A development guest route existed, and a Telegram Web/OIDC start route remained an unimplemented stub. The normal browser therefore had no independent production authentication mechanism.

### Web room creation and joining

The Web room-code UI was not connected to Railway. Its legacy compatibility runtime interpreted `join-room` locally, renamed a simulated room and showed a simulated-success toast. `Start Game` also created a browser-local session.

By contrast, Telegram live rooms already used:

- `POST /v1/rooms`
- `POST /v1/rooms/join`
- `GET /v1/games/:sessionId/snapshot`
- `POST /v1/games/:sessionId/commands`
- Socket.IO `game:<sessionId>` updates

This was the root cause of rooms created on Telegram being invisible to the Web app.

### Live command persistence

The Telegram live adapter generated command IDs by prefixing a UUID with session/type text even though `game_commands.command_id` is a PostgreSQL `uuid`. That caused live command writes to fail with HTTP 500. The adapter now sends a plain `crypto.randomUUID()`.

## Migration decisions

### Canonical User stays unchanged

`users.id` remains the only application identity. Business/game services continue consuming `AuthUser.id` / `CurrentPrincipal.userId`.

### Telegram identity stays in the existing identity table

No duplicate `telegram_identities` table is introduced. Existing `user_identities(provider='telegram')` is the canonical Telegram adapter.

### Web credentials are separate from User

Migration `002_dual_web_auth.sql` adds `web_credentials` with:

- one credential record per canonical user
- unique normalized login username
- Argon2id password hash
- optional email
- password/change timestamps

It also adds a separate public `display_username` to `users`. Login username, public display username and friendly display name are separate concepts.

### Web sessions reuse the existing session domain

`auth_sessions` remains the single server session table. Web sessions use the same opaque-token/hash design but the raw Web token is returned only as a secure HttpOnly cookie. It is never exposed to browser JavaScript.

### Authentication adapters stay separate

The API accepts two proof/session adapters:

- Telegram bearer session
- Web HttpOnly cookie session

Both normalize into:

```ts
type CurrentPrincipal = {
  user: AuthUser;
  userId: string;
  authSource: 'telegram' | 'web' | 'telegram+web';
};
```

If both credentials are supplied and resolve to different users, the API returns `AUTH_CONFLICT`. It never silently chooses one identity.

### No automatic account linking

Accounts are never merged because of matching:

- login username
- Telegram username
- display username/name
- email
- avatar/profile data

Explicit account linking remains a future capability and must prove control of both identities.

## Web session security

Production Web cookies are:

- HttpOnly
- Secure
- SameSite=None
- Path=/
- 30-day maximum age

`SameSite=None` is required by the current cross-site Cloudflare Pages → Railway deployment. Credentialed CORS uses explicit `FRONTEND_ORIGINS`, and cookie-authenticated mutations enforce an allowed `Origin` when origins are configured.

For a future first-party custom domain, placing Web and API under the same site would reduce third-party-cookie dependency.

## Password security

Web passwords use Node.js built-in Argon2id, requiring Node 24.7+.

Current parameters:

- memory: 64 MiB
- passes: 3
- parallelism: 1
- 32-byte output tag
- random 16-byte salt

The encoded verifier never contains the plaintext password. Unknown usernames follow a dummy Argon2 verification path. Failed sign-ins are throttled by normalized login username plus a hashed client-IP key.

## Frontend state

Both frontends publish authentication through `packages/ui/src/auth-controller.ts`:

- `LOADING`
- `GUEST`
- `AUTHENTICATED`

An authenticated state includes source `TELEGRAM` or `WEB`.

The Telegram Mini App never shows the Web password form. The normal Web app can register/sign in without Telegram.

## Live room ownership

A room is not a "Telegram room" or a "Web room". It is a shared database record:

```text
rooms.owner_user_id -> users.id
room_members.user_id -> users.id
game_sessions.room_id -> rooms.id
```

The Web live-room bridge now uses the same Railway room/session endpoints as Telegram. Web local gameplay remains available only as an explicit Simulation path during the remaining shared-engine migration.

## Still separate from this auth migration

The shared backend game engine is still behind the richer Web compatibility runtime for several newer special-card families. Dual authentication and cross-platform room transport do not redefine those game rules. Backend rule parity must continue as a separate source-level migration.

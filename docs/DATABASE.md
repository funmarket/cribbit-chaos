# Database

Canonical persistence model for Cribbit CHAOS. Update this file whenever schema ownership, identity mapping, persistence boundaries, migrations, or verified database deployment state changes.

## One database, one schema

Cribbit CHAOS uses exactly one Railway PostgreSQL database for both clients. Never create a Web database, a Telegram database, a per-client table, or a parallel persistence model because an API vertical is still incomplete.

```text
Web client ------\
                  -> Railway API -> Railway PostgreSQL (single database)
Telegram client --/
```

- Railway project: `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`)
- PostgreSQL service: `951b9c62-7cd3-404b-b9f0-c93e2c2a51d7`
- The separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) is a different product and must never be used here.
- `DATABASE_URL` is server-only: never in Cloudflare Pages variables, Vite bundles, or documentation.
- Clients never connect directly to PostgreSQL. Only `apps/api/src/db.ts` and `db/migrations/` touch persistence.
- No production database mutation without an explicit owner gate; recovery work uses a local disposable database.

## Migrations

```text
db/migrations/001_initial.sql                   users, identities, sessions, rooms, game and prompt domains
db/migrations/002_dual_web_auth.sql             Web credentials, throttling, prompt pool/flags, saved prompts
db/migrations/003_identity_link_challenges.sql  identity_link_challenges (separate from auth_sessions)
```

Migrations are additive and idempotent. Keep the original table and column names: the schema is the contract with the live database.

## Tables (17, as defined by the migrations)

| Area | Tables |
|---|---|
| Identity and auth | `users`, `user_identities`, `auth_sessions`, `web_credentials`, `web_login_throttle`, `identity_link_challenges` |
| Rooms | `rooms`, `room_members` |
| Gameplay | `game_sessions`, `game_commands`, `game_events` |
| Prompts and content | `prompts`, `saved_prompts`, `room_prompt_pool`, `prompt_flags` |
| Social output | `answers`, `recaps` |

There is no `game_players`, `session_snapshots`, `house_decks`, `moderation` or `audit` table in the canonical schema; older documentation listing them was inaccurate and has been corrected here.

## Canonical persistence facts

- `game_sessions.state` is `jsonb` and holds the authoritative `GameState`. **Its keys are part of the database contract**: renaming or removing a `GameState` key silently changes the meaning of already-persisted rows. Add keys, migrate deliberately, and never "clean up" a key name as a refactor.
- `game_sessions.revision` is the authoritative monotonic revision used by clients for optimistic concurrency (`expectedRevision`).
- `game_commands.command_id` is `uuid` and is the **global** primary key/idempotency key of the command log. The API looks it up globally, not by `(command_id, session_id)`. The persisted `payload` is compared with the incoming command through the same `fingerprintGameCommand` used by the shared engine. Same UUID + same semantic fingerprint replays the stored result; same UUID + different session/player/type/payload returns controlled `COMMAND_ID_COLLISION` without a second gameplay mutation. `expected_revision` is intentionally excluded from semantic identity because it is an execution precondition, not command meaning. `command_type` is `text`, `payload`/`result` are `jsonb`, `expected_revision` is `bigint`, `session_id`/`actor_user_id` are `uuid`.
- A Live command id must be an RFC 4122 UUID; the API rejects any other value with `400 INVALID_COMMAND_ENVELOPE` before persistence (COMMAND-ID-1). Simulation command ids are deterministic in-memory strings and are never persisted.
- `game_events` is the event log for a session; clients render the authoritative projection, not the raw event log.
- Reserved-but-unused tables (`answers`, `recaps`, `prompts`, `saved_prompts`, `room_prompt_pool`, `prompt_flags`) exist for product verticals that are still UNMIGRATED. Their presence is not proof of a feature: do not treat "table exists" as "feature implemented", and do not add a second store for the same concern.

## Identity model

```text
canonical account      users.id (uuid)
provider identity      user_identities(provider in ('telegram','web'), provider_user_id) -> users.id
Web login              web_credentials -> users.id
session                auth_sessions -> users.id
link challenge         identity_link_challenges -> users.id   (purpose-scoped, short TTL, atomic single use)
```

- Provider IDs (Telegram numeric id, Web login username) are external identities, never primary keys.
- `identity_link_challenges` is deliberately separate from `auth_sessions`: a challenge value must never authenticate a session, and session revocation must never consume a challenge.
- Profile authority: `users.display_name` is written once at explicit account creation and afterwards only by an explicit profile action; provider re-authentication refreshes provider metadata only.

## Verified state

- Local disposable PostgreSQL used for recovery proofs; the production Railway database is untouched by this work.
- Schema migrations were previously applied and verified locally. RECOVERY-HARDEN-3 reconciled command-log idempotency/collision source semantics and is exact-SHA CI green; however, the new DB-backed cross-session collision regression has not been rerun against disposable PostgreSQL in this environment because GitHub CI has no `DATABASE_URL`.
- Cross-client same-`users.id` convergence is verified locally with spec-signed Telegram `initData`; a genuine Telegram Mini App runtime is NOT VERIFIED here.

## Rules for future work

1. One database, one schema, one persistence owner (`apps/api`).
2. Never add a client-side store for product data (no `localStorage`/IndexedDB persistence of game, account or room state).
3. Never add a compatibility database, shadow table, or second write path to work around an incomplete API vertical.
4. Keep migrations additive, idempotent and named in sequence.
5. Document any new table here together with the vertical it serves and its classification (`ACTIVE` / `UNMIGRATED` / `COMPATIBILITY REFERENCE`).

# Database

This is a living database-control document. Update it whenever schema ownership, identity mapping, persistence boundaries, migrations, or verified database deployment state changes.

Cribbit CHAOS uses exactly one shared Railway PostgreSQL database for Web and Telegram.

Current Railway project:

- project: `Cribbit Chaos`
- project ID: `e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`
- PostgreSQL service ID: `951b9c62-7cd3-404b-b9f0-c93e2c2a51d7`
- persistent storage: active

Never use the separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) for Cribbit CHAOS.

## Access boundary

Clients do not connect directly to PostgreSQL.

```text
Cloudflare Web --------\
                        Railway API -> Railway PostgreSQL
Cloudflare Telegram ---/
```

`DATABASE_URL` is Railway-only and must never appear in Cloudflare Pages, Vercel public variables, or Vite client bundles.

## Identity model

The schema uses internal UUIDs for users and maps provider identities through `user_identities`.

Canonical identity:

```text
users.id UUID
```

Telegram identity:

```text
Telegram numeric user ID
-> user_identities(provider='telegram', provider_user_id='<telegram id>')
-> users.id
```

The same Telegram human using both Web and Telegram must resolve to the same internal `users.id`.

## Current schema foundation

The current foundation lives in `db/migrations/001_initial.sql` and subsequent migration support executed before Railway API deployment.

Core domains include:

- users
- user_identities
- auth_sessions
- rooms
- room_members
- game_sessions
- game_players
- game_commands
- game_events
- session_snapshots
- prompts
- answers
- saved decks
- house decks
- moderation
- recaps

## Current verification state

- dedicated Railway PostgreSQL deployment: successful
- persistent storage: active
- Railway API connects to this database
- migrations run before API deploy
- shared same-UUID cross-client proof: still pending
- shared-profile write/read proof across both clients: still pending

The authoritative game engine is implemented in `packages/game-engine`, but Phase 4 multiplayer persistence/transport wiring has not started yet.

After each database-affecting implementation slice, synchronize this file, `PLAN.md`, `docs/ARCHITECTURE.md`, `docs/shared-auth-staging.md`, and the active PR description.

# Architecture

Cribbit CHAOS is one multiplayer platform with two clients: `apps/web` and `apps/telegram`. Both clients are presentation layers over the same shared backend, realtime transport, and PostgreSQL data model.

The production source of truth lives in:

- `apps/web`
- `apps/telegram`
- `apps/api`
- `packages/contracts`
- `packages/game-engine`
- `packages/cards`
- `packages/prompts`
- `packages/platform`
- `packages/ui`
- `db/`

`apps/api` owns authentication, Telegram `initData` validation, room/session boundaries, database access, and Socket.IO transport.

`packages/game-engine` is deliberately fail-closed until the authoritative reducer and transition tests are migrated. Unmigrated gameplay routes return `ENGINE_NOT_MIGRATED`.

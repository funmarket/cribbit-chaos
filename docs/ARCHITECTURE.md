# Architecture

The web and Telegram clients are two adapters over one platform. `packages/ui` owns the approved visual implementation; `packages/platform` owns browser/Telegram capabilities; `packages/contracts` is the single API/realtime contract source; `apps/api` owns authentication, room/session boundaries, Telegram initData validation, PostgreSQL access, and Socket.IO transport.

`packages/game-engine` is deliberately fail-closed until authoritative rule migration and transition tests are complete. Unmigrated gameplay routes return `ENGINE_NOT_MIGRATED`.

# Testing

This is the current testing contract for the recovery line.

Run the repository checks in this order when validating shared changes:

```sh
npm run typecheck
npm test
npm run build:web
npm run build:telegram
npm run build:api
npm run audit:ui
```

`npm run build` wraps the three build commands.

## GitHub CI

The recovery-branch CI runs:

- Node 24.7.0 with `npm ci`;
- `npm run typecheck`;
- PostgreSQL 16 service for the test job;
- `npm run migrate:db` before tests;
- `npm test` with `DATABASE_URL` present, so DB-backed integration rows execute;
- `npm run build:web`;
- `npm run build:telegram`;
- `npm run build:api`.

Exact accepted evidence for RECOVERY-HARDEN-3B implementation SHA `3fd53f7748f28ddc10883278ce1f1b57fdb60434` is GitHub Actions run `35667385029`: all five jobs passed; migrations `001_initial.sql`, `002_dual_web_auth.sql`, and `003_identity_link_challenges.sql` applied; 252 tests ran, 246 passed, 0 failed, 6 skipped.

Historical RECOVERY-HARDEN-3B closeout `625f0ade6889a97a8577eebe3682879f1819ee8a` passed exact-SHA run `35667604453`.

Current accepted RECOVERY-HARDEN-4 closeout `a7e984bc6bb4bd22bf23d471550d677a4cba5500` passed exact-SHA GitHub Actions run `35674013904`: typecheck, PostgreSQL-backed test, build-web, build-telegram, and build-api all succeeded.

`npm run audit:ui` is a required local/shared-UI gate when UI/action-registry surfaces change, but it is not currently a separate GitHub Actions job. Do not claim it ran from CI unless the workflow is changed to run it.

A green workflow proves only the checks represented above; runtime/browser/deployment acceptance remains separate evidence.


## ROOM-CONFIG-1 test surface

Room-config coverage is split into a PostgreSQL-backed contract/integration suite and a static boundary suite:

- `apps/api/test/room-config.test.ts` — host-only mutation (403 non-owner, 403 non-member), 404 unknown room, mode/playerCount/world/ceiling/source validation, capacity floor, freeze-after-start, session consumption of the persisted config.
- `apps/api/test/room-config-race.test.ts` — PATCH-vs-Start serialization on the room row; the invariant is asserted in every concurrent round and never depends on which request wins the lock.
- `apps/api/test/room-config-boundary.test.ts` — source-shape boundary: one REST room-config route, realtime invalidation only, shared-contract vocabulary, and api-client/Telegram/Web wiring.

All three are registered in the root `npm test` script. `npm test` needs `DATABASE_URL` for the DB-backed rows; local runs use a disposable PostgreSQL (`127.0.0.1:55433`) and every race claim comes from that real database, never from a mock.

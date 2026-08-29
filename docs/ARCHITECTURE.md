# Architecture

This is a living architecture document. Update it whenever the verified deployment model, authority boundary, auth flow, or shared-data model changes.

Cribbit CHAOS is one multiplayer platform with two clients: `apps/web` and `apps/telegram`. Both clients are presentation layers over the same Railway backend, realtime transport, and Railway PostgreSQL data model.

GitHub is the canonical source of truth for deployable source and project documentation.

## Current deployment architecture

```text
GitHub
  |
  +--> Cloudflare Pages Web
  |
  +--> Cloudflare Pages Telegram
              \
               Railway API
                   |
            Railway PostgreSQL
```

Primary live frontend hosts:

- Web: `https://cribbit-chaos-web.pages.dev`
- Telegram: `https://cribbit-chaos-telegram.pages.dev`

Backend:

- Railway API: `https://api-production-2556.up.railway.app`
- Railway project: `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`)
- Railway PostgreSQL service: `951b9c62-7cd3-404b-b9f0-c93e2c2a51d7`

Vercel Web and Telegram projects are secondary/fallback deployments only.

The separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) belongs to another product and must never be used for Cribbit CHAOS.

## Source boundaries

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

`packages/game-engine` owns the authoritative game reducer, command validation, deterministic setup, and transition rules already implemented through Phase 3.

The clients are never authoritative for multiplayer gameplay.

## Shared identity/data boundary

Web and Telegram must converge on:

- the same Railway API
- the same Railway PostgreSQL database
- the same canonical internal `users.id` UUID

Telegram IDs are provider identities in `user_identities`; they are not Cribbit primary keys.

Clients never connect directly to PostgreSQL.

## Current phase boundary

Phase 3.5 is active. Primary Cloudflare staging and the dedicated Railway foundation are live. Remaining Phase 3.5 work is live visual proof, Telegram Mini App authentication, browser Telegram OIDC, same-UUID proof, and shared-profile proof.

Phase 4 multiplayer transport must not start until Phase 3.5 completes.

After each architecture-affecting implementation slice, synchronize this file, `PLAN.md`, related operational docs, and the active PR description.

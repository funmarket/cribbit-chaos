# Cribbit CHAOS

Cribbit CHAOS is one multiplayer platform with two clients:

- `apps/web` — the standalone browser client on Vercel
- `apps/telegram` — the Telegram Mini App on Vercel

Both clients share one Railway API, one PostgreSQL database, one account system, one room/session system, and one shared game core.

## Architecture

- Web client → Vercel
- Telegram client → Vercel
- Shared API and realtime layer → Railway
- Shared PostgreSQL database → Railway

The authoritative multiplayer state lives on the server. The clients render UI and submit commands, but they are not the source of truth for gameplay.

## Repository structure

```text
.
├── .github/
├── apps/
│   ├── api/
│   ├── telegram/
│   └── web/
├── db/
├── docs/
├── packages/
│   ├── action-registry/
│   ├── api-client/
│   ├── cards/
│   ├── contracts/
│   ├── game-engine/
│   ├── legacy-runtime/
│   ├── platform/
│   ├── prompts/
│   └── ui/
├── reference/
│   └── approved-v4-template.html
├── scripts/
├── AGENTS.md
├── PLAN.md
├── README.md
├── REQUIREMENTS.md
├── env.d.ts
├── package-lock.json
├── package.json
├── server-shims.d.ts
├── tsconfig.api.json
├── tsconfig.base.json
└── tsconfig.check.json
```

The historical migration copies that used to live under `typescript/`, `webappchaos/`, and `telegramchaos/` are removed from the production tree and preserved in git history.

## Applications

### `apps/web`

Vite browser client deployed to Vercel. It hosts the standalone web experience.

### `apps/telegram`

Vite Telegram Mini App deployed to Vercel. It shares the same design system and shared packages as the web client.

### `apps/api`

Fastify + Socket.IO backend deployed to Railway. It owns authentication, Telegram `initData` validation, PostgreSQL access, room/session state, and the multiplayer command boundary.

## Shared packages

### Core shared packages

- `packages/contracts` — shared API and realtime types
- `packages/game-engine` — authoritative game engine boundary
- `packages/cards` — card and deck data model
- `packages/prompts` — prompt domain model
- `packages/platform` — browser and Telegram capability adapters
- `packages/ui` — approved visual system and shared UI implementation

### Support packages

- `packages/api-client` — typed client helpers
- `packages/action-registry` — action metadata used by the shared UI
- `packages/legacy-runtime` — transitional runtime support retained during migration

## Requirements

This workspace declares `npm@10.9.2` in `package.json`.

The current local toolchain in this environment is Node `v24.15.0` and npm `11.13.0`.

## Local setup

```sh
npm install
```

## Running locally

```sh
npm run dev:web
npm run dev:telegram
npm run dev:api
```

## Build

```sh
npm run build:web
npm run build:telegram
npm run build:api
npm run build
```

## Testing

```sh
npm run typecheck
npm run test
npm run audit:ui
```

The test runner currently passes, but substantive game tests are not implemented yet. That is the next milestone after the authoritative reducer lands.

## Environment variables

See:

- [`.env.example`](./.env.example)
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)

Never put secrets in README files or Vite client variables.

## Deployments

- Web: Vercel
- Telegram: Vercel
- API: Railway
- PostgreSQL: Railway

Operational notes live in:

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/TELEGRAM.md](./docs/TELEGRAM.md)
- [docs/DATABASE.md](./docs/DATABASE.md)

## Telegram

Telegram authentication must go through server-side validation of raw `initData`.

`initDataUnsafe` is for display only and cannot establish identity.

See [docs/TELEGRAM.md](./docs/TELEGRAM.md) for the security boundary and client behavior notes.

## Development rules

- [AGENTS.md](./AGENTS.md)
- [REQUIREMENTS.md](./REQUIREMENTS.md)
- [PLAN.md](./PLAN.md)

## Current status

The production monorepo, deployment scaffolding, database foundation, and button audit are in place.

The authoritative core game-engine slice is now implemented and covered by transition tests.

`apps/api` still needs its gameplay command wiring and multiplayer transport integration in later phases.

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/BUTTON_MAP.md](./docs/BUTTON_MAP.md)
- [docs/DATABASE.md](./docs/DATABASE.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- [docs/TELEGRAM.md](./docs/TELEGRAM.md)
- [docs/TESTING.md](./docs/TESTING.md)
- [docs/cleanup-manifest.md](./docs/cleanup-manifest.md)
- [docs/cleanup-manifest.json](./docs/cleanup-manifest.json)

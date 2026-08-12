# Cribbit CHAOS

Cribbit CHAOS is one multiplayer platform with two clients:

- `apps/web` — standalone browser client, primary live host on Cloudflare Pages
- `apps/telegram` — Telegram Mini App, primary live host on Cloudflare Pages

Both clients share one Railway API, one Railway PostgreSQL database, one account system, one room/session system, and one shared game core.

GitHub is the canonical source of truth for deployable source and project documentation.

## Current architecture

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

Primary live endpoints:

- Web: `https://cribbit-chaos-web.pages.dev`
- Telegram: `https://cribbit-chaos-telegram.pages.dev`
- API: `https://api-production-2556.up.railway.app`

Vercel projects remain secondary/fallback deployments only. They are not the source of truth and do not block current staging progress.

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

Vite browser client. Primary live deployment is Cloudflare Pages at `https://cribbit-chaos-web.pages.dev`.

### `apps/telegram`

Vite Telegram Mini App. Primary live deployment is Cloudflare Pages at `https://cribbit-chaos-telegram.pages.dev`. It shares the same design system and shared packages as the Web client.

### `apps/api`

Fastify + Socket.IO backend deployed to the dedicated Railway `Cribbit Chaos` project. It owns authentication, Telegram `initData` validation, PostgreSQL access, room/session state, and the multiplayer command boundary.

The separate Railway project named `Cribbit` belongs to another product and must never be used for Cribbit CHAOS.

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

The current test runner includes substantive gameplay coverage and shared visual checkpoint coverage. Run the full suite before changing shared packages.

## Environment variables

See:

- [`.env.example`](./.env.example)
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)

Client-safe public values include the Railway API/WS URLs. Server secrets stay Railway-only.

Never put `DATABASE_URL`, Telegram bot/OIDC secrets, session credentials, or other server secrets in README files, Cloudflare Pages public variables, Vercel public variables, or Vite bundles.

## Deployments

Primary:

- Web: Cloudflare Pages
- Telegram: Cloudflare Pages
- API: Railway
- PostgreSQL: Railway

Secondary/fallback:

- Web: Vercel
- Telegram: Vercel

Operational notes live in:

- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/TELEGRAM.md](./docs/TELEGRAM.md)
- [docs/DATABASE.md](./docs/DATABASE.md)
- [docs/shared-auth-staging.md](./docs/shared-auth-staging.md)

## Telegram

Telegram authentication must go through server-side validation of raw `initData`.

`initDataUnsafe` is for display only and cannot establish identity.

Browser Telegram login uses a separate server-side OIDC flow and remains incomplete until implemented and live-verified.

See [docs/TELEGRAM.md](./docs/TELEGRAM.md) and [docs/browser-auth-handoff.md](./docs/browser-auth-handoff.md).

## Living project-control documents

The project documents must stay synchronized with verified runtime reality.

After every completed implementation slice, update the affected `.md` files, remove resolved blockers/obsolete instructions, update the active PR description when needed, and replace `PLAN.md`'s `Current Next Task` with the next real unfinished task.

See:

- [AGENTS.md](./AGENTS.md)
- [REQUIREMENTS.md](./REQUIREMENTS.md)
- [PLAN.md](./PLAN.md)

## Current status

Phases 0–3 are complete.

Phase 3.5 is in progress. The dedicated Railway API and PostgreSQL foundation is live, and current-head primary Cloudflare Web and Telegram deployments are live from the active GitHub branch.

The next controlled task is the live Web visual smoke test documented in `PLAN.md`.

Phase 4 multiplayer transport remains blocked until Phase 3.5 staging/auth identity proof is complete.

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/BUTTON_MAP.md](./docs/BUTTON_MAP.md)
- [docs/DATABASE.md](./docs/DATABASE.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- [docs/shared-auth-staging.md](./docs/shared-auth-staging.md)
- [docs/browser-auth-handoff.md](./docs/browser-auth-handoff.md)
- [docs/TELEGRAM.md](./docs/TELEGRAM.md)
- [docs/TESTING.md](./docs/TESTING.md)
- [docs/visual-integration-checkpoint.md](./docs/visual-integration-checkpoint.md)
- [docs/cleanup-manifest.md](./docs/cleanup-manifest.md)
- [docs/cleanup-manifest.json](./docs/cleanup-manifest.json)

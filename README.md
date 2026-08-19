# Cribbit CHAOS

Cribbit CHAOS is one multiplayer platform with two clients:

- `apps/web` — standalone browser client, primary live host on Cloudflare Pages
- `apps/telegram` — Telegram Mini App, primary live host on Cloudflare Pages

Both clients share one Railway API, one Railway PostgreSQL database, one account system, one room/session system, and one shared game core.

GitHub is the canonical source of truth for deployable source, game rules, implementation status, and project documentation.

## Mandatory delivery workflow

Every implementation slice follows:

**inspect living status → make change → test/verify → remove superseded/stale artifacts → update living docs → merge/publish → verify actual runtime state**

See `AGENTS.md` for the mandatory no-stale-debt rule and `docs/LIVING_STATUS.md` for the concise verified project state.

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

Vercel projects remain secondary/fallback deployments only. They are not the source of truth.

The authoritative multiplayer state lives on the server/shared game boundary. Clients render UI and submit commands; they do not own card legality, effects, timers, prompt eligibility, or winner state.

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

Historical migration copies previously kept under `typescript/`, `webappchaos/`, and `telegramchaos/` are removed from the production tree and remain available in git history.

## Applications

### `apps/web`

Vite browser client. It currently contains the most complete playable visual/mechanical prototype and is the temporary card-visual baseline while mechanics are stabilized.

### `apps/telegram`

Vite Telegram Mini App. The source card renderer is being migrated away from the temporary PNG package to the Web-style HTML/CSS card presentation so both clients can converge on one shared card/game model.

### `apps/api`

Fastify + Socket.IO backend deployed to the dedicated Railway `Cribbit Chaos` project. It owns authentication, Telegram `initData` validation, PostgreSQL access, room/session state, and the multiplayer command boundary.

The separate Railway project named `Cribbit` belongs to another product and must never be used for Cribbit CHAOS.

## Canonical playable deck

The current production target is exactly **112 playable cards**:

- 92 colored engine cards
  - per color: 0 x1, 1–9 x2, Skip x1, Reverse x1, Draw x2
- Wild x4
- Truth x3
- Dare x3
- Paranoia x3
- Chaos x3
- Duel x2
- Nope x2

Pass, Rewind, Flag, Spice Dial, Speak, Type, Choose, and Answered Live are controls/systems, not hand-card inventory.

`packages/game-engine` is the canonical gameplay/deck boundary. Client-local deck builders are transitional debt and must be removed as the migration completes.

## Shared packages

### Core shared packages

- `packages/contracts` — shared API and realtime types
- `packages/game-engine` — authoritative game engine and canonical playable deck boundary
- `packages/cards` — transitional card asset/registry package pending cleanup after PNG migration verification
- `packages/prompts` — prompt domain model, including shared Duel question eligibility via `type='duel'`
- `packages/platform` — browser and Telegram capability adapters
- `packages/ui` — approved Web visual system and shared UI implementation

### Support packages

- `packages/api-client` — typed client helpers
- `packages/action-registry` — action metadata used by the shared UI
- `packages/legacy-runtime` — transitional Web runtime support retained only until its callers are migrated

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

Run the full relevant suite before completing changes to shared packages or mechanics. Do not call a slice complete while stale assertions or skipped required builds remain.

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

These four files must stay synchronized with verified reality after each completed slice:

- [README.md](./README.md)
- [PLAN.md](./PLAN.md)
- [AGENTS.md](./AGENTS.md)
- [docs/LIVING_STATUS.md](./docs/LIVING_STATUS.md)

Update affected technical/operational docs at the same time. Remove resolved blockers and obsolete instructions instead of accumulating stale project-control debt.

## Current status

Phases 0–3 remain complete.

The active mechanics/card migration is converting the shared engine to the canonical 112-card deck and converging Telegram on the Web card presentation before rules/buttons/audio polish.

The shared deck builder now produces 112 cards. Typecheck passes, but current CI is not green because three stale assertions in the large legacy core-engine test still expect the previous 104-card core-only deck. Builds were skipped after that test failure. This must be repaired before the PNG asset package is deleted.

See `PLAN.md` and `docs/LIVING_STATUS.md` for the exact active task and verified status.

## Documentation

- [docs/LIVING_STATUS.md](./docs/LIVING_STATUS.md)
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

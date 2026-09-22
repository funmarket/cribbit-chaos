# Cribbit CHAOS


## Current recovery state

The active recovery source line is `recovery/single-engine-authority`. The accepted RECOVERY-HARDEN-4 baseline is `a7e984bc6bb4bd22bf23d471550d677a4cba5500`, verified by GitHub Actions run `35674013904` with typecheck, test, build-web, build-telegram, and build-api all successful. The HARDEN-4 chain is RED `b5df94103455569a2dc12b1627aab0818d5e3bbf` -> implementation `cb3126c96c58db68f9401304cc23cd2fde5911d4` -> documentation closeout `a7e984bc6bb4bd22bf23d471550d677a4cba5500`. This living-document reconciliation follows that accepted engineering baseline and does not change gameplay behavior.

The recovery branch is **not deployed to production**. Railway API production is sourced from `main`; the original Cloudflare Pages Web and Telegram projects still use `feature/visual-integration-checkpoint` as their production branch. Source recovery state and deployed-runtime state must never be conflated.

The gameplay mutation transport contradiction is resolved by RECOVERY-HARDEN-4: gameplay commands reach the authoritative engine only through `POST /v1/games/:sessionId/commands`, the client realtime surface is subscription/invalidation only, and `packages/action-registry` marks only `backendClass:'realtime'` entries as `method:'WS'`. Truth-or-Chaos completion remains blocked on unresolved owner rule decisions. `AUTHORITY-GUARD-1` remains unauthorized and not started.

Cribbit CHAOS is one multiplayer platform with two clients:

- `apps/web` — standalone browser client, primary live host on Cloudflare Pages
- `apps/telegram` — Telegram Mini App, primary live host on Cloudflare Pages

Both clients share one Railway API, one Railway PostgreSQL database, one account system, one room/session system, and one shared game core.

GitHub is the canonical source of truth for deployable source, game rules, implementation status, and project documentation.

## Mandatory delivery workflow

Every implementation slice follows:

**inspect living status → make change → test/verify → remove superseded/stale artifacts → update living docs → merge/publish → verify actual runtime state**

Resume order for any agent: `AGENTS.md` -> `HANDOFF.md` -> `docs/LIVING_STATUS.md` -> the `CURRENT TASK` in `PLAN.md` -> relevant rule/domain docs -> source.

See `AGENTS.md` for the mandatory no-stale-debt rule and the documentation set, and `docs/LIVING_STATUS.md` for the single verified current state.

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

The authoritative multiplayer state lives on the server/shared game boundary. Clients render UI and submit commands; they do not own card legality, effects, timers, prompt eligibility, or winner state.

### Live room lifecycle (verified locally)

```text
packages/game-engine -> apps/api -> PostgreSQL -> packages/api-client -> Web / Telegram
```

- Create: `POST /v1/rooms` creates the room and the owner's `room_members` row only. No bots, no `createGame()`, no deal, no `game_sessions` row. Returns a waiting-room projection.
- Join: `POST /v1/rooms/join` inserts real membership only. A started game rejects new members (`GAME_ALREADY_STARTED`); a full room rejects with `ROOM_FULL`. No bot-seat substitution.
- Start: `POST /v1/rooms/:roomId/start` is owner-only, refuses a duplicate start, requires real membership to equal the configured `playerCount`, seats the owner at 0 and the rest in `joined_at` order, calls the canonical `createGame()` exactly once, deals seven cards each, and persists one `game_sessions` row.
- Realtime: `room:<roomId>` via `join-room-channel` carries `room-updated` and `room-started {roomId, sessionId}`. The server stays authoritative; clients refetch.
- `GET /v1/rooms/:roomId` returns the waiting-room projection to members.

Simulation remains a separate local/bot mode and does not use the Live session lifecycle.

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
│   ├── simulation/
│   └── ui/
├── reference/
│   └── approved-v4-template.html
├── scripts/
├── AGENTS.md
├── HANDOFF.md
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

Vite browser client. Live gameplay presentation consumes authoritative server snapshots and server-projected decision capabilities; it does not own Live gameplay legality.

### `apps/telegram`

Vite Telegram Mini App. It shares the API/client contracts and authoritative game state with Web. Source compatibility is established, but genuine Telegram Mini App runtime acceptance remains NOT VERIFIED in the recovery environment.

### `apps/api`

Fastify + Socket.IO backend deployed to the dedicated Railway `Cribbit Chaos` project. It owns authentication, Telegram `initData` validation, PostgreSQL access, room/session state, and the multiplayer command boundary.

The separate Railway project named `Cribbit` belongs to another product and must never be used for Cribbit CHAOS.

## Canonical playable deck

The canonical physical deck is `CHAOS-133-V1`: exactly **133 playable physical card instances**.

- Number cards: 76 total
  - per color: 0 x1 and 1–9 x2 across lime, orange, cyan, and purple
- Skip x6
- Reverse x6
- Draw x6
- Wild x3
- Truth x3
- Dare x3
- Paranoia x3
- Chaos x3
- Duel x3
- Nope x3
- Tag x3
- Truth or Chaos x3
- Hijack x3
- Taboo x3
- Machiavelli x1
- Ghost x1
- Reverse Confession x3
- Dig Me x1

Pass, Rewind, Flag, Spice Dial, Speak, Type, Choose, and Answered Live are controls/systems, not hand-card inventory.

`packages/cards` owns the canonical physical card registry/assets. `packages/game-engine` imports that registry for the authoritative playable deck boundary. Client-local deck builders are transitional debt and must be removed as the migration completes.

## Shared packages

### Core shared packages

- `packages/contracts` — shared API and realtime types
- `packages/game-engine` — authoritative game engine, hand legality, effects, timers and win state
- `packages/cards` — canonical `CHAOS-133-V1` card registry and assets
- `packages/simulation` — client-independent local QA Simulation orchestration (in-memory only; no persistence, no DOM, no network)
- `packages/prompts` — prompt domain model, including shared Duel question eligibility via `type='duel'`
- `packages/platform` — browser and Telegram capability adapters
- `packages/ui` — approved Web visual system and shared UI implementation

### Support packages

- `packages/api-client` — typed client helpers
- `packages/action-registry` — action metadata used by the shared UI
- `packages/legacy-runtime` — `COMPATIBILITY REFERENCE`: old Web board runtime reachable only through the fixture-preview `runtimeMode: 'legacy-compatibility'` branch

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

Never put `DATABASE_URL`, Telegram bot/OIDC secrets, session credentials, or other server secrets in README files, Cloudflare Pages public variables, or Vite bundles.

## Deployments

Primary:

- Web: Cloudflare Pages
- Telegram: Cloudflare Pages
- API: Railway
- PostgreSQL: Railway

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

The verified current state is maintained in `docs/LIVING_STATUS.md`; the roadmap lives in `PLAN.md`. Summary:

- Recovery work is published on `recovery/single-engine-authority`; the recovery branch is **not deployed** to production.
- One application, two delivery surfaces: Web and Telegram both go through `packages/api-client` to the same API, the same `packages/game-engine`, and the same Railway PostgreSQL database.
- Verified locally: real Live multiplayer lifecycle (create -> join -> start) with no fabricated bots, authoritative command handling, private hands, sealed Roulette masking, canonical Live command-id contract, canonical identity/login model, shared Navigation, shared local QA Simulation.
- Canonical gameplay rules are owned by `Game_rules.md` (current slices: `RULE-SPECIAL-PLAY-001`..`008` and `RULE-VOLUNTARY-DRAW-001`..`007`, implemented in the shared engine).
- Whole-product capabilities that are still unmigrated (prompts, prompt pool, answers, recaps, notifications, moderation, Admin Control Room, real Telegram Mini App runtime) are tracked in `docs/PRODUCT_SCOPE.md` and `docs/LIVING_STATUS.md`; unmigrated is not dead.

Canonical deck authority is covered by `packages/cards/test/card-registry.test.ts`, `packages/cards/test/card-assets.test.ts`, `packages/game-engine/test/deck-composition.test.ts`, `packages/cards/test/deck-docs-consistency.test.ts` and `packages/cards/test/game-rules-authority.test.ts`.

## Documentation

- [AGENTS.md](./AGENTS.md) — operating contract and reading order
- [HANDOFF.md](./HANDOFF.md) — operational resume point
- [PLAN.md](./PLAN.md) — roadmap and current phase
- [Game_rules.md](./Game_rules.md) — canonical gameplay rules
- [docs/LIVING_STATUS.md](./docs/LIVING_STATUS.md) — the single execution ledger
- [docs/PRODUCT_SCOPE.md](./docs/PRODUCT_SCOPE.md) — whole-product scope and preservation classifications
- [docs/CHANGE_GOVERNANCE.md](./docs/CHANGE_GOVERNANCE.md) — authority chain and rule-ID governance
- [docs/HISTORICAL_PRODUCT_EVIDENCE.md](./docs/HISTORICAL_PRODUCT_EVIDENCE.md) — product-history evidence (not rule authority)
- [docs/ADMIN_CONTROL_ROOM.md](./docs/ADMIN_CONTROL_ROOM.md) — operator control-plane scope
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

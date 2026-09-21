# Architecture

Verified ownership and dependency direction. Update this file whenever the deployment model, ownership boundary, auth flow, or shared-data boundary changes.

Gameplay meaning is owned by `Game_rules.md`; this file explains who may implement or render it, not what it means.

## Deployment architecture

```text
GitHub (canonical source)
  |
  +--> Cloudflare Pages: Web client
  |
  +--> Cloudflare Pages: Telegram Mini App
                 \
                  Railway API (Node, Fastify + Socket.IO)
                       |
                  Railway PostgreSQL (one database)
```

- Web host: `https://cribbit-chaos-web.pages.dev`
- Telegram host: `https://cribbit-chaos-telegram.pages.dev`
- API: `https://api-production-2556.up.railway.app`
- Railway project `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`), PostgreSQL service `951b9c62-7cd3-404b-b9f0-c93e2c2a51d7`
- The separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) belongs to another product and must never be used for Cribbit CHAOS.

Recovery work is published on `recovery/single-engine-authority` for preservation and review but is **not deployed**. Exact publication/deployment state lives in `docs/LIVING_STATUS.md`.

## Authoritative runtime direction

```text
apps/web  ----\
                -> packages/api-client -> apps/api routes -> domain services (game-service, identity-linking, db)
apps/telegram -/                                   |
                                                   +-> packages/game-engine (+ packages/contracts, packages/cards, packages/prompts)
                                                        when the operation changes gameplay
                                                   |
                                                   +-> Railway PostgreSQL (one database, one schema)
```

Hard rules:

- No client-side gameplay engine is authoritative. `packages/game-engine` + `apps/api/src/game-service.ts` own legality, effects, timers and winner state. Live snapshots and command responses include the viewer's server-derived `PlayerDecisionCapabilities`; Web and Telegram render those capabilities and submit commands without importing gameplay-decision helpers from `packages/game-engine`.
- Realtime is a change-intent channel, not state: the server emits `room-updated`, `room-started` and `session-updated {sessionId, revision}`; clients refetch the authoritative snapshot.
- Clients never connect to PostgreSQL. Only `apps/api/src/db.ts` (plus `db/migrations/`) touches persistence.
- Baseline deployment chain is GitHub source -> Cloudflare Pages clients -> Railway API -> Railway PostgreSQL.

## Ownership map

| Owner | Owns | Classification |
|---|---|---|
| `packages/contracts` | Shared API/realtime/game types, `GameCommand`/`GameEvent` definitions, config type | ACTIVE |
| `packages/game-engine` | Authoritative reducer, play/draw legality, command routing, setup/deal, social/prompt flow, win check, timer model | ACTIVE |
| `packages/cards` | Canonical `CHAOS-133-V1` physical card registry and assets | ACTIVE |
| `packages/prompts` | Prompt domain model and prompt pool/profile types | ACTIVE |
| `packages/simulation` | Client-independent local QA Simulation orchestration (fixtures, bot loop, command envelopes, human QA capability projection); no persistence, no DOM, no network | ACTIVE (QA) |
| `packages/api-client` | Typed HTTP/Socket client boundary used by both clients (`credentials` for Web, bearer for Telegram) | ACTIVE |
| `packages/platform` | Browser/Telegram capability adapters (viewport, safe area, theme, native lifecycle) | ACTIVE |
| `packages/ui` | Approved shared visual system, template, navigation controller, bootstrap entry | ACTIVE |
| `packages/action-registry` | Action -> backend-class mapping used by the shared UI | ACTIVE |
| `apps/api` | HTTP routes, auth, Telegram `initData` validation, room/session service, viewer state + gameplay-capability projection boundary, Socket.IO, persistence access | ACTIVE |
| `apps/web` | Browser presentation: auth/account UI, Live rooms, local QA Simulation entry, safety rail, card/board presentation | ACTIVE |
| `apps/telegram` | Mini App presentation: onboarding, room setup, Live game view, contextual rule UI, card renderer | ACTIVE (Live path NOT VERIFIED here) |
| `packages/legacy-runtime` | Old canonical Web board runtime | COMPATIBILITY REFERENCE — reachable only through the fixture-preview `runtimeMode: 'legacy-compatibility'` branch in `packages/ui/src/bootstrap.ts` |
| `apps/web/src/canonical-game-runtime.ts` | Nothing in the active authoritative runtime path (zero importers) | UNKNOWN — PRESERVE |

## Client composition (verified)

```text
apps/web/src/main.ts
  -> packages/ui/src/bootstrap.ts        (runtimeMode 'none' -> navigation controller; 'legacy-compatibility' -> packages/legacy-runtime)
  -> apps/web/src/live-entry.ts
       -> web-auth.ts            (account/login UI)
       -> live-session.ts        (Live rooms, realtime, authoritative snapshots/capabilities, commands)
       -> simulation-mode.ts     (local QA Simulation via packages/simulation)
       -> identity-link-ui.ts    (account linking panel)

apps/telegram/src/main.ts
  -> bootstrapTelegram.ts   (onboarding, room setup, Live game binding)
  -> backendGame.ts         (API + realtime client for Live sessions; caches server-projected capabilities)
  -> simulation.ts          (thin presentation adapter over packages/simulation)
  -> main.ts also boots packages/ui with runtimeMode 'legacy-compatibility'
     only for the explicit fixture preview (`?compat=1&fixture=1`)
```

Local QA Simulation never persists and never creates a Live room: it runs the shared engine in memory through `packages/simulation`.

## Rule and prompt authority

- Gameplay meaning: `Game_rules.md` with permanent rule IDs (current gameplay slice: `RULE-SPECIAL-PLAY-001`..`008`, `RULE-VOLUNTARY-DRAW-001`..`007`).
- Change governance and preservation classes: `docs/CHANGE_GOVERNANCE.md`.
- Prompt content lives in the prompt domain (`packages/prompts`) and is selected server-side; clients never choose prompts.

## Verification levels used in this repository

```text
VERIFIED LOCALLY      run against a local API + local disposable PostgreSQL
BROWSER-VERIFIED      exercised through a real browser session
NOT VERIFIED          not exercised in this environment (state the reason)
SOURCE-VERIFIED       proven by reading current source and/or tests only
```

Current unverified areas: real Telegram Mini App runtime (`initData` cannot be minted here), browser Telegram OIDC login (endpoints fail closed), and all unmigrated product verticals listed in `docs/LIVING_STATUS.md`.

## Architecture debt recorded (not authorized work)

- `packages/legacy-runtime` still contains the old board runtime; it is retained only for the fixture preview and its tests.
- CHAOS Pulse adaptive draw is implemented in the shared engine; the legacy board is not yet consuming it.
- Prompt library/pool, answers, recaps, notifications and moderation are unimplemented API verticals with persisted tables already reserved.
- The API client still exposes a `game-command` socket emit path that the server does not handle; the authoritative gameplay mutation path is `POST /v1/games/:sessionId/commands`. Caller/ownership reconciliation remains a separate hardening task.
- `apps/web/src/canonical-game-runtime.ts` — `UNKNOWN — PRESERVE`: Zero importers and not part of the active authoritative runtime path. Removal is not authorized until ownership, historical product purpose, and migration/replacement status are proven.
- Local Simulation can stall on a special-card interaction that expects human-style input.
- The Truth-or-Chaos flow can deadlock in `ANSWER_RESOLVE` (`packages/game-engine/src/capabilities.ts`, `reducer.ts`).

Do not fix these outside an explicitly authorized slice.

# Cribbit CHAOS — Telegram Mobile Frontend Implementation Plan

## Status

- Phase: **3.5 — Telegram mobile composition + shared staging**
- Active branch: `feature/visual-integration-checkpoint`
- Active PR: #8
- Telegram: `https://cribbit-chaos-telegram.pages.dev`
- Web: `https://cribbit-chaos-web.pages.dev`
- API: `https://api-production-2556.up.railway.app`
- Shared database: Railway PostgreSQL in dedicated `Cribbit Chaos`
- T1 implementation head verified by CI: `80008599d42d70b6453a9e9d314b4cc9310dfd19`
- T2 implementation/deployment head verified: `e88f141d83e6b21100a461969d670230109bdc6d`
- T3 implementation/deployment head verified: `561f9056c73a279cdf2ddb8207f875bcc4414398`
- Current task: **T4 — Contextual rule UI**

This is a living execution document. After every T-slice, update this file, `PLAN.md`, affected technical/operational docs, and PR #8 before starting the next slice.

## Locked architecture

```text
GitHub = canonical source of truth
        |
        +--> apps/web
        |      Web/desktop presentation
        |      Cloudflare Web
        |
        +--> apps/telegram
               Telegram/mobile presentation
               Cloudflare Telegram

Both clients
        |
        v
same Railway API
        |
        v
same Railway PostgreSQL
```

Permanent identity rule:

```text
Telegram login -> Railway API -> user_identities -> users.id = ABC -> PostgreSQL
Web login      -> Railway API -> same identity -> users.id = ABC -> same PostgreSQL
```

Never create separate Web/Telegram accounts, APIs, databases, or gameplay rules.

## Product rule

Web and Telegram share backend/domain behavior, but **do not share page composition requirements**.

Shared:

- Railway API
- PostgreSQL
- canonical `users.id`
- Telegram identity mapping
- auth/session model
- game engine
- contracts/action semantics
- card/game data
- persistent room/game/account data

Platform-specific:

- navigation
- screen hierarchy
- layout
- board composition
- control placement
- touch interaction
- density
- contextual presentation

Primary implementation rule:

> Rebuild the Telegram presentation, not the Cribbit game.

## Scope guardrails

T1–T6 may change Telegram presentation and bindings only.

Do not implement during T1–T6:

- Web redesign
- new rules/game engine
- new API contracts unless an existing contract is objectively missing and separately approved
- new PostgreSQL schema
- Phase 4 room persistence
- Phase 4 authoritative multiplayer
- alternate Railway project/database
- Cloudflare backend
- Vercel migration

## Database/API boundary

Telegram never talks to PostgreSQL directly.

```text
Telegram -> Railway API -> PostgreSQL
```

Railway-only secrets:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- OIDC/client secrets
- server session secrets

Client-safe configuration only:

- `VITE_API_URL`
- `VITE_WS_URL`

Existing database domains remain sufficient for the visual conversion:

- `users`
- `user_identities`
- `auth_sessions`
- `rooms`
- `room_members`
- `game_sessions`
- `game_commands`
- `game_events`
- `prompts`
- `saved_prompts`
- `room_prompt_pool`
- `prompt_flags`
- `answers`
- `recaps`

No database migration is authorized for T1–T6.

## Existing API contracts to preserve

| UI concern | Existing API/client contract | Status during Phase 3.5 |
|---|---|---|
| Telegram auth | `POST /v1/auth/telegram` | implemented; live proof needs Railway bot token |
| Load profile | `GET /v1/me` | implemented |
| Edit profile | `PATCH /v1/me/profile` | implemented |
| Join room | `POST /v1/rooms/join` / `api.joinRoom(code)` | endpoint exists; real room service still unavailable |
| Room config | `PATCH /v1/rooms/:roomId/config` | placeholder until Phase 4 |
| Game snapshot | `GET /v1/games/:sessionId/snapshot` | placeholder until multiplayer migration |
| Game command | `POST /v1/games/:sessionId/commands` | placeholder until multiplayer migration |
| Realtime | Socket.IO `/v1/realtime` | transport foundation only |

Do not create Telegram-only duplicate endpoints.

## T1 — Telegram presentation boundary — COMPLETE

Implemented:

- `apps/telegram/src/main.ts` now boots a Telegram-specific bootstrap.
- Added `apps/telegram/src/bootstrapTelegram.ts`.
- Added Telegram-owned mobile shell styles under `apps/telegram/src/styles/telegram.css`.
- Normal Telegram route no longer loads the desktop/shared page hierarchy or legacy visual runtime as its primary UI.
- Preserved `TelegramPlatform` initialization.
- Preserved safe-area/viewport CSS variables.
- Preserved `CribbitApiClient` and client config.
- Preserved raw Telegram `initData` auth attempt.
- Preserved `GET /v1/me` profile hydration when authentication succeeds.
- Preserved fixture metadata/start-param resolution for compatibility QA.
- Did not change `apps/web`, API routes, game engine, Railway architecture, or PostgreSQL schema.

Verification on exact implementation head `80008599d42d70b6453a9e9d314b4cc9310dfd19`:

- typecheck: PASS
- tests: PASS
- Web build: PASS
- Telegram build: PASS
- API build: PASS

T1 exit gate: **passed**.

## T2 — Telegram Room Creation screen — IMPLEMENTED / VISUAL HARDENING DEFERRED TO T5–T6

Implemented in Telegram-owned TypeScript/Vite UI:

- compact Telegram header and room-creation hierarchy
- Profile Name
- Room Name
- canonical Content World values
- canonical Personal Ceiling values
- canonical Duel / Squad / Party / Mayhem modes
- exact mode-dependent player counts
- Original / Community / House / Live prompt-source toggles
- QA Test Hand staging toggle
- Join Room bound to the existing `api.joinRoom(code)` contract
- same-row `[ CREATE GAME ] [ DEMO GAME ]` with Create Game visually dominant
- profile hydration/update through existing auth/profile client methods
- honest staging messages when auth/room persistence are unavailable
- no fake room persistence or multiplayer success

T2 verified on implementation/deployment head `e88f141d83e6b21100a461969d670230109bdc6d`:

- typecheck: PASS
- tests: PASS
- Web build: PASS
- Telegram build: PASS
- API build: PASS
- Cloudflare Telegram Git deployment: PASS

Real-device pixel/spacing refinement remains part of T5/T6 and must not be confused with implementation incompleteness.

## T3 — Core mobile Game screen — IMPLEMENTED / VISUAL HARDENING DEFERRED TO T5–T6

Implemented:

- Telegram-owned `gameView.ts`
- dedicated mobile game styles in `apps/telegram/src/styles/game.css`
- compact live-game strip
- room / code / current-turn / timer header
- full-width mobile board with discard and draw pile as primary content
- no permanent desktop `PLAY OR DRAW` side column
- compact horizontal player strip
- contextual active-state host
- horizontally scrollable hand rail
- selected-card visual state
- compact persistent Pass / Rewind / Nope / Flag bar
- Draw and CHAOS Board action surfaces
- Demo Game now routes to the Telegram mobile board instead of the legacy desktop-style game composition
- explicit compatibility fixture route remains available only when `compat=1` is requested

T3 demo preview uses canonical `Card` contract shapes and existing action names. It does **not** execute authoritative multiplayer state changes. This is intentional until Phase 4/7 replaces fixture/demo state with Railway authoritative state.

T3 verified on exact implementation/deployment head `561f9056c73a279cdf2ddb8207f875bcc4414398`:

- typecheck: PASS
- tests: PASS
- Web build: PASS
- Telegram build: PASS
- API build: PASS
- Cloudflare Telegram Git deployment: PASS

T3 does not modify:

- `apps/web`
- `packages/game-engine`
- API routes/contracts
- Railway architecture
- PostgreSQL schema

## T4 — Contextual rule UI — CURRENT

Use state-triggered panels/sheets for existing mechanics only:

- Wild / choose color
- Truth
- Dare
- Paranoia
- Duel
- Chaos
- Nope reaction window
- Speak / Type / Choose / Answered Live
- Pass / Rewind / Flag

Rules for T4:

- do not duplicate rule logic in Telegram
- panels appear only when the corresponding existing game state/fixture calls for them
- reuse existing command/action names and shared contract terminology
- no new gameplay rule or backend route
- demo interactions may preview the UI but must clearly avoid pretending to mutate authoritative multiplayer state

## T5 — Mobile hardening — PENDING

Verify/fix:

- 320–430 px widths
- Telegram top/bottom safe areas
- expanded/non-fullscreen WebView
- keyboard-open state
- long names
- 7+ card hands
- contextual modal overflow
- touch targets
- body overflow
- hand-only horizontal scrolling
- controlled haptics/animation

## T6 — Live Telegram signoff — PENDING

For exact GitHub head:

```text
GitHub push
 -> Cloudflare Telegram build
 -> open in actual Telegram
 -> compare against approved room/game references
 -> record real-device defects
 -> fix only verified defects
```

Browser responsive mode is supportive QA; actual Telegram WebView is final acceptance.

## Authentication after visual approval

After T1–T6 visual approval, resume Phase 3.5 identity proof:

```text
regenerated bot token
 -> Railway TELEGRAM_BOT_TOKEN
 -> raw initData
 -> POST /v1/auth/telegram
 -> canonical users.id
 -> GET /v1/me
```

Then browser Telegram OIDC must resolve the same Telegram human to the same `users.id` and shared profile.

## Phase 4 handoff rule

The UI should be finished before authoritative multiplayer wiring.

Expected transition:

```text
Phase 3.5 visual state source: fixture/demo compatibility state
Phase 4/7 production source: Railway authoritative room/game state
```

The presentation should remain stable while the state provider becomes real.

## Current Next Task

**T4 — Contextual rule UI.**

Implement Telegram-specific state-triggered panels/sheets for the already-existing Wild, Truth, Dare, Paranoia, Duel, Chaos, Nope, answer-mode, Pass, Rewind and Flag mechanics. Reuse existing shared contract/action terminology, keep all rule authority outside Telegram view code, preserve honest demo-only behavior until authoritative multiplayer is active, and do not modify Web, backend routes, Railway architecture, PostgreSQL schema, or Phase 4 multiplayer behavior.
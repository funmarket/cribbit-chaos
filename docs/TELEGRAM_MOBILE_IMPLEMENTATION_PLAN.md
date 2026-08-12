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
- Current task: **T2 — Telegram Room Creation screen**

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

## T2 — Telegram Room Creation screen — CURRENT

Replace the temporary T1 foundation shell with the approved mobile Room Creation composition.

### Layout target

```text
Cribbit Chaos
Telegram Mini App

ROOM CREATION
BUILD TONIGHT'S CHAOS
Set your room, pick the chaos, and jump in.

PROFILE NAME
[ authenticated/current profile ]

CONTENT WORLD
[ canonical value ▼ ]

PERSONAL CEILING
[ canonical value ▼ ]

CHOOSE MODE
[ DUEL ] [ SQUAD ] [ PARTY ] [ MAYHEM ]

PLAYER COUNT
[2] [3] [4] [5] [6] [7] [8]

PROMPT SOURCES
[ ORIGINAL ] [ COMMUNITY ]
[ HOUSE    ] [ LIVE      ]

QA TEST HAND                 [toggle]

JOIN ROOM
[ room code ] [ JOIN ]

[        CREATE GAME        ] [ DEMO GAME ]
```

### T2 rules

- Use canonical existing values only; do not invent Grok/reference-image rule values.
- Profile field hydrates from existing Telegram auth/session + `/v1/me` when available.
- Profile editing, if enabled in this slice, must use existing `PATCH /v1/me/profile`.
- Room configuration selections remain draft/presentation state until a real room exists.
- Do not call the API for every mode/player/source tap.
- Join Room must bind to existing `api.joinRoom(code)` and show the real current unavailable/`ROOMS_NOT_MIGRATED` outcome honestly.
- `CREATE GAME` is the dominant normal CTA.
- `DEMO GAME` is secondary and uses deterministic demo/fixture compatibility state.
- Do not fabricate successful multiplayer or fake persisted rooms.
- Keep both CTAs on the same row where target width permits; preserve usability down to 320 px.

### Responsive target

Test:

- 320 px
- 360 px
- 375 px
- 390 px
- 412 px
- 430 px

Requirements:

- no body horizontal overflow
- no whole-page scaling
- Telegram safe-area variables respected
- touch-safe controls
- readable labels and values
- long profile names must truncate/wrap safely
- software keyboard must not destroy layout

### T2 exit criteria

- approved Room Creation hierarchy rendered by Telegram-owned TypeScript/Vite UI
- all controls have known ownership/bindings
- `CREATE GAME | DEMO GAME` implementation matches product decision
- no fake server success
- Web source/appearance untouched
- CI typecheck/tests/Web build/Telegram build/API build pass
- exact Cloudflare Telegram deployment head recorded
- project-control docs synchronized

## T3 — Core mobile Game screen — PENDING

After T2 passes, implement:

- compact room/turn/timer bar
- full-width game board
- real Cribbit active/discard card renderer/assets
- draw pile
- compact horizontal player strip
- contextual active-state strip
- horizontally scrollable hand
- persistent compact Pass / Rewind / Nope / Flag bar

Board must own the available width. Do not recreate the previous desktop split-screen instruction column.

## T4 — Contextual rule UI — PENDING

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

Do not duplicate rule logic in Telegram.

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

**T2 — Telegram Room Creation screen.**

Implement the approved mobile room-creation composition in `apps/telegram` using the existing T1 Telegram bootstrap. Reuse current auth/profile/API/setup semantics, preserve honest unavailable behavior for real room persistence, keep `[ CREATE GAME ] [ DEMO GAME ]` on the same row with Create Game dominant, and do not modify Web, gameplay rules, API contracts, Railway architecture, PostgreSQL schema, or Phase 4 multiplayer behavior.

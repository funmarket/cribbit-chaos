# Cribbit CHAOS — Telegram Mobile Frontend Implementation Plan

## Status

- Phase: **3.5 — Telegram mobile composition + shared staging**
- Active branch: `feature/visual-integration-checkpoint`
- Active PR: #8
- Telegram: `https://cribbit-chaos-telegram.pages.dev`
- Web: `https://cribbit-chaos-web.pages.dev`
- API: `https://api-production-2556.up.railway.app`
- Shared database: Railway PostgreSQL in dedicated `Cribbit Chaos`
- T1 verified head: `80008599d42d70b6453a9e9d314b4cc9310dfd19`
- T2 verified deployment head: `e88f141d83e6b21100a461969d670230109bdc6d`
- T3 verified deployment head: `561f9056c73a279cdf2ddb8207f875bcc4414398`
- T4 verified deployment head: `76cbdaff1ff4ff64e81a0914f7fe1318eb00337d`
- Current task: **T5 — Mobile hardening**

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

Web and Telegram share backend/domain behavior but do not share page composition requirements.

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
- new API contracts unless separately approved
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

No database migration is authorized for T1–T6.

## Existing API contracts to preserve

| UI concern | Existing API/client contract | Status during Phase 3.5 |
|---|---|---|
| Telegram auth | `POST /v1/auth/telegram` | implemented; live proof needs Railway bot token |
| Load profile | `GET /v1/me` | implemented |
| Edit profile | `PATCH /v1/me/profile` | implemented |
| Join room | `POST /v1/rooms/join` / `api.joinRoom(code)` | endpoint exists; real room service unavailable |
| Room config | `PATCH /v1/rooms/:roomId/config` | placeholder until Phase 4 |
| Game snapshot | `GET /v1/games/:sessionId/snapshot` | placeholder until multiplayer migration |
| Game command | `POST /v1/games/:sessionId/commands` | placeholder until multiplayer migration |
| Realtime | Socket.IO `/v1/realtime` | transport foundation only |

Do not create Telegram-only duplicate endpoints.

## T1 — Telegram presentation boundary — COMPLETE

Implemented and verified:

- Telegram-specific bootstrap and mobile composition ownership
- preserved `TelegramPlatform`, API/auth initialization, safe areas, fixture metadata
- normal Telegram route no longer uses shared desktop hierarchy as its primary composition
- Web/backend/database untouched
- CI passed

## T2 — Telegram Room Creation screen — COMPLETE FOR IMPLEMENTATION

Implemented:

- compact Telegram room-creation hierarchy
- Profile Name and Room Name
- canonical Content World / Personal Ceiling values
- Duel / Squad / Party / Mayhem
- exact mode-dependent player counts
- Original / Community / House / Live prompt-source toggles
- QA Test Hand staging toggle
- Join Room bound to existing `api.joinRoom(code)`
- same-row `[ CREATE GAME ] [ DEMO GAME ]`
- no fake room persistence

Verified on head `e88f141d83e6b21100a461969d670230109bdc6d` with CI and Cloudflare Telegram deployment.

## T3 — Core mobile Game screen — COMPLETE FOR IMPLEMENTATION

Implemented:

- Telegram-owned `gameView.ts`
- mobile game styles
- compact live-game / room / current-turn / timer presentation
- full-width discard and draw board
- compact player strip
- contextual active-state host
- horizontally scrollable hand rail
- Pass / Rewind / Nope / Flag action bar
- Demo Game enters Telegram mobile board
- explicit legacy compatibility fixture route remains available only with `compat=1`
- demo interactions do not fake authoritative multiplayer changes

Verified on head `561f9056c73a279cdf2ddb8207f875bcc4414398` with CI and Cloudflare Telegram deployment.

## T4 — Contextual rule UI — COMPLETE FOR IMPLEMENTATION

Implemented in Telegram-owned presentation code:

- Wild / choose color bottom sheet
- Truth panel with Speak / Type / Choose / Answered Live controls
- Dare panel with answer-mode controls
- Paranoia player-target selection
- Duel target selection
- Chaos resolution preview panel
- Nope reaction preview with countdown-style presentation
- Pass confirmation panel
- Rewind confirmation panel
- Flag confirmation panel
- contextual overlay and bottom-sheet styling

Rules preserved:

- contextual panels are presentation only
- existing action/contract terminology is reused
- no gameplay rule is duplicated in Telegram
- no new API route or database behavior
- demo interactions clearly state that authoritative multiplayer state is not being changed

Exact T4 head `76cbdaff1ff4ff64e81a0914f7fe1318eb00337d` verification:

- typecheck: PASS
- tests: PASS
- Web build: PASS
- Telegram build: PASS
- API build: PASS
- Cloudflare Telegram Git deployment: PASS

## T5 — Mobile hardening — CURRENT

Verify and fix only presentation defects at:

- 320 px
- 360 px
- 375 px
- 390 px
- 412 px
- 430 px

Required checks:

- Telegram top and bottom safe areas
- expanded/non-fullscreen WebView behavior
- keyboard-open room form
- long profile and room names
- 7+ card hands
- contextual sheet overflow
- touch targets
- no body horizontal overflow
- horizontal scrolling limited to intended rails such as hand/player strips
- sticky CTA/safety controls do not cover content
- board remains readable and dominant
- contextual sheets remain dismissible and usable on short screens
- controlled haptics/animation only

Do not redesign during T5. Fix only mobile usability/layout defects against the approved composition.

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

Actual Telegram WebView is final visual acceptance.

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

Then browser Telegram OIDC must resolve the same human to the same `users.id` and shared profile.

## Phase 4 handoff rule

The UI should be finished before authoritative multiplayer wiring.

```text
Phase 3.5 state source: fixture/demo compatibility state
Phase 4/7 state source: Railway authoritative room/game state
```

Presentation should remain stable while the state provider becomes real.

## Current Next Task

**T5 — Mobile hardening.**

Verify and fix the Telegram-owned room, game, and contextual-rule presentation at 320–430 px widths, Telegram safe areas, keyboard-open state, long names, 7+ card hands, contextual-sheet overflow, touch targets, body overflow, and intended horizontal rails only. Do not modify Web, backend routes, game mechanics, Railway architecture, PostgreSQL schema, or Phase 4 multiplayer behavior.
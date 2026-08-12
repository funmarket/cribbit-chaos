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
- T5 verified deployment head: `df581a56accbf6f128e7e460317508f26cdd366e`
- Current task: **T6 — Live Telegram real-device signoff**

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

Telegram owns its TypeScript/Vite composition while preserving `TelegramPlatform`, safe-area variables, API/auth initialization, fixture metadata, shared contracts, Web source, Railway API, and PostgreSQL schema.

## T2 — Telegram Room Creation screen — COMPLETE FOR IMPLEMENTATION

Implemented:
- Profile Name and Room Name
- canonical Content World / Personal Ceiling values
- Duel / Squad / Party / Mayhem
- mode-dependent player counts
- Original / Community / House / Live prompt sources
- QA test-hand staging toggle
- Join Room bound to existing API contract
- same-row `[ CREATE GAME ] [ DEMO GAME ]`
- no fake room persistence

## T3 — Core mobile Game screen — COMPLETE FOR IMPLEMENTATION

Implemented:
- Telegram-owned mobile game view
- full-width discard + draw board
- compact room/current-turn/timer information
- compact player strip
- contextual active-state host
- horizontal hand rail
- Pass / Rewind / Nope / Flag bar
- Demo Game opens Telegram mobile board
- explicit `compat=1` path retains legacy compatibility QA
- no authoritative multiplayer mutation in demo state

## T4 — Contextual rule UI — COMPLETE FOR IMPLEMENTATION

Implemented state-triggered Telegram sheets/panels for:
- Wild color choice
- Truth
- Dare
- Paranoia
- Duel
- Chaos
- Nope reaction
- answer modes
- Pass
- Rewind
- Flag

No game rule was duplicated in Telegram and no backend/database behavior changed.

## T5 — Mobile hardening — COMPLETE FOR IMPLEMENTATION

Implemented dedicated `apps/telegram/src/styles/hardening.css` and loaded it from the Telegram entrypoint.

Hardening covers:
- 320–430 px responsive ranges
- explicit 320–359, 360–389, and 390–430 behavior
- Telegram safe-area-aware horizontal and bottom padding
- prevention of body/page horizontal overflow
- hand/player rails as intended horizontal scrolling surfaces
- touch-safe minimum control heights
- responsive room setup controls
- same-line `CREATE GAME | DEMO GAME` preservation on very narrow widths
- responsive full-width game board/card/deck sizing
- compact player-name truncation
- 7+ card hand rail sizing and inertial touch scroll
- sticky safety bar with safe-area bottom spacing
- contextual sheet max-height based on Telegram platform height and safe areas
- short-height/keyboard-open fallback that disables sticky action bars so fields are not covered
- reduced-motion support

Before hardening, the current Telegram entrypoint was rechecked against the live branch and confirmed that normal Demo Game clicks are intercepted to open `renderTelegramGame`, while `compat=1` remains the explicit legacy fixture route. No backend/database change was needed.

Exact T5 implementation head `df581a56accbf6f128e7e460317508f26cdd366e` verification:
- typecheck: PASS
- tests: PASS
- Web build: PASS
- Telegram build: PASS
- API build: PASS
- Cloudflare Telegram Git deployment: PASS

T5 does not modify:
- `apps/web`
- `packages/game-engine`
- API routes/contracts
- Railway architecture
- PostgreSQL schema

## T6 — Live Telegram signoff — CURRENT

For exact GitHub head:

```text
GitHub push
 -> Cloudflare Telegram build
 -> open stable Telegram Pages URL inside actual Telegram
 -> compare Room Creation against approved reference
 -> enter Demo Game
 -> compare mobile game board against approved reference
 -> trigger contextual sheets
 -> record real-device defects
 -> fix only verified defects
```

Required device checks:
- room creation first viewport and scrolling
- `CREATE GAME | DEMO GAME` same-line CTA
- no body horizontal overflow
- board/discard/draw hierarchy
- player strip horizontal scroll
- hand horizontal scroll with 7 cards
- card readability/touchability
- Pass / Rewind / Nope / Flag bar
- Wild/Truth/Dare/Paranoia/Duel/Chaos/Nope/safety sheets
- top and bottom Telegram safe areas
- keyboard-open state on profile/room/join inputs

Actual Telegram WebView is final visual acceptance.

## Authentication after visual approval

After T6 visual approval, resume Phase 3.5 identity proof:

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

**T6 — Live Telegram real-device signoff.**

Open `https://cribbit-chaos-telegram.pages.dev` inside the actual Telegram Mini App/WebView and compare Room Creation, Demo Game board, player/hand rails, safety actions, and contextual rule sheets against the approved references. Record screenshots/defects and fix only verified real-device issues. Do not modify Web, backend routes, game mechanics, Railway architecture, PostgreSQL schema, or begin Phase 4 multiplayer.
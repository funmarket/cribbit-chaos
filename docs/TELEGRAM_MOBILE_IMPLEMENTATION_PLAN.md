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
- T6 card-visual correction code head: `2094e1464d3a8d0b0ed67e23b275e254341bb0da`
- Current task: **T6 — re-verify corrected cards on real Telegram device**

This is a living execution document. After every controlled slice, update this file, `PLAN.md`, affected technical/operational docs, and PR #8 before proceeding.

## Locked architecture

```text
GitHub = canonical source of truth
        |
        +--> apps/web
        |      Web/desktop presentation
        |
        +--> apps/telegram
               Telegram/mobile presentation

Both clients -> same Railway API -> same Railway PostgreSQL
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

Implemented Profile Name, Room Name, canonical Content World / Personal Ceiling, Duel / Squad / Party / Mayhem, mode-dependent player counts, prompt sources, QA test hand, Join Room, and same-row `[ CREATE GAME ] [ DEMO GAME ]` without fake room persistence.

## T3 — Core mobile Game screen — COMPLETE FOR IMPLEMENTATION

Implemented Telegram-owned full-width game board, room/current-turn/timer info, player strip, contextual state host, horizontal hand rail, Pass/Rewind/Nope/Flag bar, and Demo Game flow without authoritative multiplayer mutation.

## T4 — Contextual rule UI — COMPLETE FOR IMPLEMENTATION

Implemented presentation-only state-triggered sheets for Wild, Truth, Dare, Paranoia, Duel, Chaos, Nope, answer modes, Pass, Rewind and Flag. No rule or backend/database behavior was duplicated.

## T5 — Mobile hardening — COMPLETE FOR IMPLEMENTATION

Implemented 320–430 px hardening, Telegram safe-area spacing, overflow containment, hand/player rail touch scrolling, long-name handling, short-height/keyboard fallback, contextual-sheet bounds, sticky safety controls and reduced motion.

Exact T5 head `df581a56accbf6f128e7e460317508f26cdd366e` passed typecheck, tests, Web build, Telegram build and API build, and deployed successfully to Cloudflare Telegram.

## T6 — Live Telegram signoff — CURRENT

### Real-device findings

The first real-device T6 screenshots verified that the room-creation layout, same-row `CREATE GAME | DEMO GAME`, mobile board hierarchy, player strip, hand rail and safety bar are rendering inside Telegram.

A verified defect was found: **the game cards were generic placeholder cards and did not match the approved Cribbit card visual family.**

The approved visual direction is the supplied Cribbit card family: dark/black card body, neon category frame, top-left category marker, large central category symbol/art, strong uppercase title, compact rule copy, and Cribbit branding. Category tones remain consistent with the supplied references, including lime Truth, orange Dare, purple Paranoia, pink Chaos, cyan Duel, gold Nope, rainbow Wild, and matching number/action treatments.

### T6 card correction — IMPLEMENTED / NEEDS REAL-DEVICE RECHECK

Implemented:
- new Telegram `apps/telegram/src/cardRenderer.ts`
- new `apps/telegram/src/styles/cards.css`
- separate TypeScript renderer consuming the existing shared `Card` contract
- Truth, Dare, Paranoia, Chaos, Duel, Nope, Wild, Number, Skip, Reverse and Draw visual treatments
- board and hand use the same renderer at different responsive sizes
- retained existing `data-card-id`, `data-card-kind`, `data-card-color` and `data-action="play-card"` hooks
- no gameplay rule changes
- no API/database/backend changes
- no Web presentation change

The implementation deliberately recreates the approved card language as TypeScript/CSS components rather than embedding flattened reference screenshots as gameplay cards.

Exact card-correction code head `2094e1464d3a8d0b0ed67e23b275e254341bb0da` verification:
- typecheck: PASS
- tests: PASS
- Web build: PASS
- Telegram build: PASS
- API build: PASS
- Cloudflare Telegram Git deployment: PASS

### Remaining T6 checks

Re-open the stable Telegram URL and verify:
- discard card now follows Cribbit card visual language
- Truth / Dare / Paranoia / Chaos / Duel / Nope / Wild hand cards match the approved family closely enough for mobile gameplay
- hand cards remain readable/tappable at real device width
- horizontal hand scrolling still works
- card selection lift/highlight still works
- contextual sheets still open from special cards
- board layout remains intact
- no body horizontal overflow
- safe-area and keyboard behavior remain acceptable

Actual Telegram WebView remains final visual acceptance.

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

**T6 — Real-device recheck of the corrected Cribbit cards.**

Open `https://cribbit-chaos-telegram.pages.dev` inside the actual Telegram Mini App/WebView, enter Demo Game, and verify the corrected card renderer against the approved card references. Record screenshots and fix only verified remaining card/layout defects. Do not modify Web, backend routes, game mechanics, Railway architecture, PostgreSQL schema, or begin Phase 4 multiplayer.
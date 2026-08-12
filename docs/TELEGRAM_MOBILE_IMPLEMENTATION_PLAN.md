# Cribbit CHAOS — Telegram Mobile Frontend Implementation Plan

## Status

- Phase: 3.5 — Telegram mobile composition + shared staging
- GitHub branch: `feature/visual-integration-checkpoint`
- Active PR: #8
- Primary Telegram deployment: `https://cribbit-chaos-telegram.pages.dev`
- Primary Web deployment: `https://cribbit-chaos-web.pages.dev`
- Shared API: `https://api-production-2556.up.railway.app`
- Shared database: Railway PostgreSQL in project `Cribbit Chaos`

This document is a **living implementation-control plan**. It is the detailed source of truth for the Telegram mobile frontend conversion until the work is complete. After every implementation slice, update this file, `PLAN.md`, affected technical/operational docs, and the active PR description before starting the next slice.

---

## 1. Locked product decision

Cribbit CHAOS has two different client presentations:

```text
GitHub — canonical source of truth
        |
        +--> apps/web
        |      desktop / large-screen Web product
        |      Cloudflare: cribbit-chaos-web.pages.dev
        |
        +--> apps/telegram
               Telegram/mobile product
               Cloudflare: cribbit-chaos-telegram.pages.dev

Both clients
        |
        v
Railway API
        |
        v
Railway PostgreSQL
```

The Web app and Telegram Mini App are **not required to share layout composition**.

They must continue to share:

- one Railway API
- one Railway PostgreSQL database
- one canonical internal `users.id` UUID per human
- one Telegram identity mapping
- one account/profile record
- shared game rules and authoritative engine
- shared contracts and command semantics
- shared persistent room/game/account data

They may differ in:

- navigation
- page hierarchy
- layout
- board composition
- control placement
- touch interactions
- mobile/desktop density
- contextual presentation

### Permanent identity rule

```text
Telegram Mini App login
        |
        v
Railway API
        |
        v
user_identities(provider='telegram', provider_user_id=<telegram id>)
        |
        v
users.id = ABC
        |
        v
Railway PostgreSQL

Browser Telegram login
        |
        v
same Railway API
        |
        v
same Telegram identity mapping
        |
        v
users.id = ABC
        |
        v
same Railway PostgreSQL
```

The same human must never receive separate Web and Telegram accounts.

---

## 2. Scope of this plan

This plan converts the approved Telegram room-creation and game-board visual references into a real **TypeScript + Vite Telegram frontend**.

This phase changes **presentation and client composition**, not gameplay authority.

### In scope

- dedicated Telegram bootstrap/presentation boundary
- Telegram room-creation screen
- Telegram active-game screen
- responsive mobile layout
- existing Cribbit card rendering/assets
- existing setup features and controls
- existing action IDs and command semantics
- existing Telegram platform adapter
- existing API client/auth/session handling
- existing fixture/demo compatibility state for visual proof
- contextual rule panels
- Telegram safe-area/viewport behavior
- phone-width QA
- live Telegram device smoke testing

### Out of scope

- Web redesign
- new game rules
- new game engine
- new database
- new identity system
- separate Telegram user records
- Phase 4 room persistence implementation
- Phase 4 authoritative multiplayer implementation
- new Railway project
- Cloudflare backend migration
- Vercel migration

### Primary implementation rule

> Rebuild the Telegram presentation, not the Cribbit game.

---

## 3. Current technical constraint to remove

The current Telegram entrypoint uses `TelegramPlatform` but then calls the same shared UI bootstrap as Web:

```ts
import { TelegramPlatform } from '../../../packages/platform/src/telegram.ts';
import { bootstrap } from '../../../packages/ui/src/bootstrap.ts';

void bootstrap(new TelegramPlatform());
```

The shared bootstrap injects the shared UI template and shared visual runtime. This is why the Telegram build currently behaves like a compressed Web layout.

The first controlled implementation slice must establish a Telegram-only composition boundary while keeping shared domain/backend systems intact.

---

## 4. Target source structure

Preferred direction:

```text
apps/telegram/src/
  main.ts
  bootstrapTelegram.ts

  views/
    RoomCreationView.ts
    GameView.ts
    LobbyView.ts

  components/
    TelegramHeader.ts
    RoomTurnBar.ts
    GameBoard.ts
    PlayerStrip.ts
    HandRail.ts
    ActionBar.ts
    ContextPanel.ts
    RoomSetup.ts
    ModeSelector.ts
    PromptSourceSelector.ts

  state/
    telegramUiState.ts
    telegramBindings.ts

  styles/
    telegram.css
    tokens.css
    room.css
    game.css
```

This layout is guidance, not permission to over-componentize. Keep the smallest maintainable structure that achieves the presentation boundary.

### Shared packages that must remain authoritative

```text
packages/game-engine
packages/contracts
packages/api-client
packages/platform
shared card/game data and action semantics
```

### Telegram files may own

- DOM composition
- mobile layout
- view switching
- drawers/modals
- selected-card visual state
- responsive sizing
- touch interactions
- contextual presentation

### Telegram files must not own

- card legality
- authoritative draw results
- turn progression
- timeout resolution
- social-card rules
- winner calculation
- server revision
- persistent room/game state
- database access
- Telegram signature validation

---

## 5. Telegram platform adapter — preserve and reuse

The existing `TelegramPlatform` remains the platform integration layer.

The new UI must continue to use its existing capabilities:

- `Telegram.WebApp.ready()`
- `expand()`
- Telegram background/header/bottom-bar colors
- safe-area handling
- content-safe-area handling
- stable viewport height
- Telegram BackButton
- close confirmation
- haptics
- Telegram share flow
- raw `initData`
- `start_param`
- fullscreen integration

The responsive layout must use Telegram safe-area/viewport variables rather than assume one screenshot size.

Target phone widths:

- 320 px
- 360 px
- 375 px
- 390 px
- 412 px
- 430 px

No global scale transform. No fixed desktop canvas shrunk to a phone.

---

## 6. Target Telegram user flow

```text
Telegram opens Mini App
        |
        v
Telegram platform initialization
        |
        v
Telegram auth attempt
        |
        v
Room / Home screen
        |
        +--> CREATE GAME
        |
        +--> JOIN ROOM
        |
        +--> DEMO GAME
                |
                v
          Lobby / Game View
                |
                v
      contextual rule interactions
```

The Telegram product should open like a game, not like a marketing website.

---

## 7. Room Creation screen specification

Use the approved mobile reference as the visual hierarchy while using **real Cribbit terminology and values**.

### Header

Compact internal header:

```text
Cribbit Chaos
Telegram Mini App
```

Do not reproduce the full Web navigation/header.

### Page title

```text
ROOM CREATION
BUILD TONIGHT'S CHAOS
Set your room, pick the chaos, and jump in.
```

### Profile Name

Display authenticated profile when available.

Data flow:

```text
Telegram.WebApp.initData
        |
        v
POST /v1/auth/telegram
        |
        v
AuthSession { accessToken, user }
        |
        v
GET /v1/me
        |
        v
Profile Name field
```

Editing the profile uses the existing endpoint:

```http
PATCH /v1/me/profile
Authorization: Bearer <session>
Content-Type: application/json

{
  "displayName": "New Name"
}
```

Database effect remains on the canonical `users` row only. Do not create a second user or second identity.

### Content World

Use the current canonical setup values only.

UI example:

```text
CONTENT WORLD
[ Clean CHAOS ▼ ]
```

During Phase 3.5 this is local room-draft state. Later the real room service persists the same value into room configuration.

### Personal Ceiling

Use current canonical values only.

```text
PERSONAL CEILING
[ Wild ▼ ]
```

Do not invent Telegram-specific rule values.

### Choose Mode

Use compact mobile tiles:

```text
[ DUEL ] [ SQUAD ] [ PARTY ] [ MAYHEM ]
```

The selected mode updates local draft state and visual selected state.

Requirements:

- reuse existing supported mode values
- no new Telegram-only enum
- touch-safe target size
- selected state via `aria-pressed`
- optional Telegram light haptic on selection
- no API call on every tap

### Player Count

Preferred mobile control:

```text
[2] [3] [4] [5] [6] [7] [8]
```

or a compact decrement/value/increment control if required by the canonical player-range rules.

Do not use a hard-to-aim slider for exact player counts.

### Prompt Sources

Use current source toggles:

```text
[ ORIGINAL ] [ COMMUNITY ]
[ HOUSE    ] [ LIVE      ]
```

Local draft shape should reuse existing semantics, conceptually:

```ts
{
  original: true,
  community: true,
  house: false,
  live: false
}
```

No API call for every toggle.

### QA Test Hand

Keep as a demo/development visual-testing control only.

It must never be confused with authoritative multiplayer state.

Production visibility must remain controlled.

### Join Room

Normal player wording:

```text
JOIN ROOM
[ Enter room code ] [ JOIN ]
```

Do not use `JOIN SIMULATED ROOM` in the normal product path.

Keep the existing client contract:

```ts
api.joinRoom(code)
```

which targets:

```http
POST /v1/rooms/join
Authorization: Bearer <session>
```

The current server still returns `ROOMS_NOT_MIGRATED` after input validation. During the visual phase, preserve the real binding and show an honest staging/unavailable state rather than fabricate successful multiplayer.

### Primary CTAs

Approved CTA layout:

```text
[        CREATE GAME        ] [ DEMO GAME ]
```

Both on the same row.

Guideline:

- `CREATE GAME`: visually dominant, roughly 65–70% width
- `DEMO GAME`: secondary, roughly 30–35% width

`CREATE GAME` means real multiplayer room creation.

`DEMO GAME` means deterministic local/demo compatibility state for current staging and UI QA.

Do not label the main path `Simulated Game`.

---

## 8. Create Game backend contract rule

Do **not** invent a new backend implementation during the visual slice.

The database already contains room/game domains, but the production room service is not active yet.

The intended future create-room request will conceptually contain:

```json
{
  "name": "Night Squad",
  "config": {
    "mode": "party",
    "playerCount": 5,
    "world": "...",
    "ceiling": "...",
    "sources": {
      "original": true,
      "community": true,
      "house": false,
      "live": false
    }
  }
}
```

But the frontend visual slice must not create a fake server route or fake PostgreSQL records.

Until Phase 4 activates room creation, `CREATE GAME` must use the existing production action boundary/staging behavior and clearly report that real room creation is not active.

`DEMO GAME` remains the current way to enter a fully rendered visual game state for staging.

---

## 9. Telegram Game View specification

Target vertical hierarchy:

```text
CRIBBIT CHAOS
LIVE GAME

NIGHT SQUAD
Room Code: NIGHT
Current Turn: YOU      10 sec

+------------------------------+
|                              |
|      ACTIVE / DISCARD        |
|                              |
|        [ OUR CARD ]          |
|                              |
|                 DRAW PILE    |
|                              |
+------------------------------+

YOU 10 | LEO 8 | NINA 6 | JORDAN 7

          PLAY OR DRAW

YOUR HAND                      7
[card][card][card][card][partial ->]

[ PASS ] [ REWIND ] [ NOPE ] [ FLAG ]
```

### Board priority

The board owns the horizontal width.

Do not use a permanent desktop-style split with `PLAY OR DRAW` occupying a left column.

Visual priority:

1. active/discard card
2. draw pile
3. hand
4. current player / timer
5. contextual state
6. other players
7. secondary controls

### Card renderer

Use the real Cribbit card assets/components/data.

The reference images define:

- scale
- spacing
- hierarchy
- placement

They do not replace the canonical card artwork or game data.

### Draw pile

Display-only state:

```text
DRAW PILE
24 CARDS LEFT
```

Do not directly decrement client counts on tap.

Correct authority:

```text
tap DRAW
  -> existing action/command
  -> authoritative state transition
  -> new state
  -> render new draw count
```

During demo mode, the fixture/runtime compatibility layer may simulate the state for visual testing.

### Player strip

Use a compact horizontal strip:

```text
[ YOU 10 ] [ LEO 8 ] [ NINA 6 ] [ JORDAN 7 ] ->
```

Each item shows only:

- avatar/initial
- display name
- card count
- current-turn indication

Do not permanently render a desktop player table.

### Active state host

Normal state:

```text
PLAY OR DRAW
Choose a card to play or draw from the pile
```

This is a contextual host. It changes when the authoritative/game state changes.

Examples:

- `CHOOSE A COLOR`
- `SELECT A PLAYER`
- `ANSWER THE PROMPT`
- `WAITING FOR NINA`
- `NOPE WINDOW — 4 SEC`
- `DUEL ACTIVE`
- `CHAOS RESOLUTION`

Do not allocate permanent screen panels for every rule.

---

## 10. Hand rail specification

The hand must be horizontally scrollable on narrow devices.

Desired behavior:

```text
YOUR HAND                    7 CARDS
[card][card][card][card][partial ->]
```

CSS behavior should use a dedicated horizontal hand rail, not whole-page horizontal overflow.

Requirements:

- horizontal touch scrolling
- readable minimum card width
- partial next card as scroll affordance when useful
- selected card lifts/highlights
- touch-safe card targets
- no forcing seven cards into an unreadably small width

Interaction:

```text
tap card
  -> visual selection

tap selected card / Play action
  -> existing play-card action
```

Legality must continue to come from shared game state/rules, not Telegram UI logic.

---

## 11. Bottom safety/action bar

Persistent compact controls:

```text
[ PASS ] [ REWIND ] [ NOPE ] [ FLAG ]
```

These correspond to existing Cribbit mechanics.

The UI only reflects availability state:

- enabled
- disabled
- available reaction
- cooldown/one-use state
- reaction deadline

The Telegram frontend does not decide whether an action is legal.

---

## 12. Contextual rule interfaces

Complex rule controls appear only when invoked by game state.

### Wild / choose color

```text
CHOOSE COLOR
[LIME] [ORANGE]
[CYAN] [PURPLE]
```

Reuse the existing `choose-wild` action semantics.

### Truth / Dare

Use focused modal/bottom sheet with existing explicit answer paths:

- Speak
- Type
- Choose when applicable
- Answered Live
- Pass

### Paranoia

Player selection sheet.

### Duel

Target/response view using existing Duel semantics.

### Chaos

Temporary full-width contextual resolution panel.

### Nope

Short reaction overlay with countdown and existing Nope action.

### Safety

Pass, Rewind and Flag retain their existing game-engine semantics.

No rule logic is reimplemented inside Telegram view code.

---

## 13. Authentication integration

Telegram bootstrap order:

```text
1. initialize TelegramPlatform
2. read raw Telegram.WebApp.initData
3. if available, POST /v1/auth/telegram
4. receive AuthSession
5. existing API client stores bearer session token
6. GET /v1/me
7. hydrate profile UI
8. render room screen
```

Current staging must continue to allow the interface to render when live auth is not yet configured, but it must not fake an authenticated user.

Once `TELEGRAM_BOT_TOKEN` is configured in Railway, the same frontend should authenticate without architectural change.

Never expose the bot token to Vite/Cloudflare client variables.

---

## 14. API integration matrix

| Telegram UI feature | API contract | Current status | Persistent target |
|---|---|---|---|
| Telegram authentication | `POST /v1/auth/telegram` | implemented; live proof requires valid Railway bot token | `users`, `user_identities`, `auth_sessions` |
| Load profile | `GET /v1/me` | implemented | `users`, `user_identities` |
| Edit profile | `PATCH /v1/me/profile` | implemented | `users` |
| Join room | `POST /v1/rooms/join` | endpoint exists; real room service not migrated | `rooms`, `room_members` |
| Update room config | `PATCH /v1/rooms/:roomId/config` | placeholder | `rooms.config` |
| Create room/game | production route not active | Phase 4 | `rooms`, `room_members`, `game_sessions` |
| Game snapshot | `GET /v1/games/:sessionId/snapshot` | placeholder | `game_sessions` |
| Game command | `POST /v1/games/:sessionId/commands` | placeholder | `game_commands`, `game_events`, `game_sessions` |
| Realtime | Socket.IO `/v1/realtime` | transport foundation exists; authoritative game loop not active | server-owned session state |

Do not add parallel Telegram-only API endpoints for the same concepts.

---

## 15. Database rules

No schema change is required for this Telegram visual implementation.

Existing domains already include:

```text
users
user_identities
auth_sessions
rooms
room_members
game_sessions
game_commands
game_events
prompts
saved_prompts
room_prompt_pool
prompt_flags
answers
recaps
```

### Client/database boundary

Never:

```text
Telegram Mini App -> PostgreSQL
```

Always:

```text
Telegram Mini App
      |
      v
Railway API
      |
      v
Railway PostgreSQL
```

### Secret ownership

Railway-only:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- Telegram OIDC secrets
- session/JWT secrets

Cloudflare/Vite client-safe only:

- `VITE_API_URL`
- `VITE_WS_URL`
- public app environment values

### Identity integrity

The same Telegram provider ID always resolves through `user_identities` to the same `users.id`.

The Telegram mobile redesign must never change that contract.

---

## 16. State ownership

### Telegram presentation state

May live only in the Telegram client:

- current view
- open menu/drawer
- selected card visual state
- modal visibility
- collapsed/expanded player strip
- local scroll positions

### Room draft state

Before a real room is created:

- room name
- mode
- world
- ceiling
- player count
- prompt source selections

### Authoritative game state

Must never be owned by Telegram UI:

- current turn
- actual hand contents
- draw pile state
- discard state
- legal plays
- timers/results
- winner
- pending effects
- game revision

Long-term authority remains Railway/server-side.

---

## 17. Web protection rule

The Web product stays at:

`https://cribbit-chaos-web.pages.dev`

Telegram presentation work must not redesign Web.

Preferred rule:

- Telegram composition lives under `apps/telegram`
- `apps/web` remains unchanged during Telegram mobile slices
- shared packages change only when the change is truly cross-platform/domain-level
- do not solve Telegram layout by adding large piles of Telegram/mobile overrides to the shared Web-oriented stylesheet

Every Telegram implementation slice must still run the Web build to detect accidental shared breakage.

---

## 18. Verification gates

For each implementation slice, run the relevant full verification set:

```text
npm run typecheck
npm run test
npm run build:web
npm run build:telegram
npm run build:api
npm run audit:ui
```

Do not overstate results. Record exact failures if any.

### Telegram layout QA

Test at minimum:

- 320 px
- 360 px
- 375 px
- 390 px
- 412 px
- 430 px

Test these conditions:

- portrait
- Telegram expanded view
- Telegram safe-area top/bottom
- software keyboard open
- long profile/player names
- large hand sizes
- 7+ cards
- contextual rule modal
- horizontal hand swipe
- menu/drawer open
- timer visible
- no body horizontal overflow

Touch targets should remain comfortable and readable.

---

## 19. GitHub-first deployment workflow

GitHub is the only source of truth for deployable application source.

Correct workflow:

```text
edit controlled branch
      |
      v
commit to GitHub
      |
      v
PR #8 head changes
      |
      +--> Cloudflare Telegram Git integration
      |       npm run build:telegram
      |       apps/telegram/dist
      |       cribbit-chaos-telegram.pages.dev
      |
      +--> Cloudflare Web Git integration
              npm run build:web
              apps/web/dist
              cribbit-chaos-web.pages.dev
```

The Web project may rebuild because it watches the same branch, but its visual output must stay unchanged.

Railway should not need an API redeploy for Telegram-only visual source changes unless an API watched path actually changes.

Never copy source manually into Cloudflare, Railway, or Vercel as an alternate source of truth.

---

## 20. Real-device acceptance loop

For every meaningful Telegram UI slice:

```text
GitHub commit
    |
    v
Cloudflare Telegram build/deploy
    |
    v
open inside real Telegram client
    |
    v
compare against approved visual reference
    |
    v
record defect
    |
    v
fix only verified defect
```

Browser responsive mode is useful, but the real Telegram WebView is the final visual acceptance environment.

---

## 21. Controlled implementation slices

### T1 — Telegram presentation boundary

Goal: Telegram stops booting the desktop/shared page composition.

Tasks:

- create Telegram-specific bootstrap/composition layer
- preserve `TelegramPlatform`
- preserve API client/auth initialization
- preserve fixture/demo access
- avoid Web source changes
- render a minimal Telegram-owned shell successfully
- verify Web remains unchanged

Exit criteria:

- Telegram build succeeds
- Web build succeeds
- Telegram no longer depends on desktop page hierarchy for its primary layout
- no game/backend/database changes

### T2 — Room Creation screen

Implement:

- compact Telegram header
- Room Creation title/hero
- Profile Name
- Content World
- Personal Ceiling
- Mode tiles
- Player Count chips/control
- Prompt Source controls
- QA Test Hand staging control
- Join Room input/button
- `CREATE GAME | DEMO GAME` same-row CTA

Bindings:

- profile -> existing auth/profile client methods
- setup controls -> existing local setup/draft semantics
- Join Room -> existing `api.joinRoom` contract with honest unavailable state while backend room service is incomplete
- Demo Game -> existing deterministic fixture/demo state
- Create Game -> production action boundary/staging unavailable state until Phase 4

Exit criteria:

- reference composition matched on target widths
- all controls have real action ownership
- no fake multiplayer success
- Web unchanged

### T3 — Core Game screen

Implement:

- room/turn/timer bar
- full-width board
- real Cribbit discard card
- draw pile
- compact player strip
- contextual active-state strip
- horizontal hand rail
- bottom Pass/Rewind/Nope/Flag bar

Use current fixture/demo game state for visual proof.

Exit criteria:

- board fills mobile width appropriately
- no desktop split-screen instruction column
- cards remain readable
- hand scrolls naturally
- existing actions preserved

### T4 — Contextual rule UI

Implement presentation for existing mechanics only:

- Wild color choice
- Truth
- Dare
- Paranoia
- Duel
- Chaos
- Nope reaction
- Pass
- Rewind
- Flag
- existing answer modes

Exit criteria:

- contextual controls appear only when state calls for them
- no rule logic duplicated in Telegram
- existing action/command semantics preserved

### T5 — Mobile hardening

Test and fix:

- 320–430 px widths
- safe areas
- keyboard
- long names
- 7+ card hands
- horizontal hand scroll
- touch target sizes
- contextual modal overflow
- timer/turn readability
- no body horizontal overflow
- animation/haptic polish only where it does not change game behavior

Exit criteria:

- all target widths pass visual QA
- no Web regression

### T6 — Live Telegram staging signoff

- deploy exact GitHub head through Cloudflare Git integration
- open `https://cribbit-chaos-telegram.pages.dev` inside Telegram
- compare room screen with approved room reference
- compare game screen with approved game reference
- record exact real-device result
- fix only defects found by live test
- update this document, `PLAN.md`, related docs and PR #8 body

Exit criteria:

- real-device Telegram presentation approved
- exact GitHub head recorded
- Cloudflare deployment status recorded
- no unsupported claim that multiplayer/auth is complete

---

## 22. Work that must not begin during T1–T6

Do not start:

- real room persistence
- real room creation API implementation
- authoritative multiplayer command loop
- server game snapshots
- Socket.IO game synchronization
- reconnect system
- Phase 4 database behavior
- Web redesign

These remain Phase 4/later work.

---

## 23. After Telegram visual approval

Resume Phase 3.5 shared identity proof:

```text
regenerated Telegram bot token
        |
        v
Railway TELEGRAM_BOT_TOKEN
        |
        v
Telegram raw initData
        |
        v
POST /v1/auth/telegram
        |
        v
users.id = ABC
        |
        v
GET /v1/me
```

Then implement/live-verify browser Telegram OIDC and prove:

```text
Telegram /v1/me -> users.id = ABC
Web      /v1/me -> users.id = ABC
```

Then prove shared profile write/read through the same PostgreSQL database.

Only after Phase 3.5 is complete may Phase 4 multiplayer begin.

---

## 24. Phase 4 handoff principle

The purpose of this plan is to finish the Telegram UI **before** real multiplayer wiring so the UI does not need another redesign later.

Expected transition:

```text
Phase 3.5 state source:
fixture/demo compatibility state

Phase 4/7 state source:
Railway authoritative room/game state
```

The presentation remains the same. Only the state provider and server-backed actions become real.

Expected future mapping:

```text
CREATE GAME
  staging-bound now
  -> real room creation later

JOIN ROOM
  contract-bound now
  -> real room join later

GAME VIEW
  fixture-bound now
  -> server snapshot/realtime state later

PLAY / DRAW / RULE ACTIONS
  existing semantics now
  -> authoritative GameCommand / Socket.IO later
```

---

## 25. Non-negotiable guardrails

1. GitHub is canonical.
2. Telegram presentation changes must not redesign Web.
3. One Railway API only.
4. One Railway PostgreSQL only.
5. One canonical `users.id` per human.
6. Telegram IDs remain provider identities, not primary user IDs.
7. No database access from Vite clients.
8. No bot token/database/session secrets in Cloudflare/Vite.
9. Do not fake room/game persistence while Phase 4 is incomplete.
10. Do not put authoritative gameplay logic in Telegram UI.
11. Preserve existing action/command semantics.
12. `CREATE GAME` is the normal path; `DEMO GAME` is secondary and clearly non-production gameplay.
13. Update living docs after every implementation slice.
14. Never leave a completed task as the current next task.
15. Do not merge PR #8 until the active phase gates are actually satisfied and explicitly approved.

---

## Current Next Task

**T1 — Telegram presentation boundary.**

Create the Telegram-specific TypeScript/Vite bootstrap and presentation layer so `apps/telegram` no longer uses the desktop/shared page composition as its primary layout, while preserving `TelegramPlatform`, the existing API client/auth initialization, fixture/demo access, game contracts, Web appearance, Railway API, and PostgreSQL schema.

Do not begin room persistence or Phase 4 multiplayer work.

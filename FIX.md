# DEPLOYMENT AUTHORITY — READ FIRST

This note is intentionally first so future recovery work does not waste time on the wrong host.

- **GitHub is the source of truth.** Fixes are committed to the controlled GitHub branch/PR first.
- **Cloudflare Pages is the authoritative frontend host** for both Web and Telegram builds.
- **Railway is authoritative for backend services only**: API and PostgreSQL. Frontend-only commits may correctly appear as `SKIPPED` in Railway and that is not a frontend deployment failure.
- **Vercel is NOT part of the current authoritative Cribbit CHAOS deployment path.** It is an old/fallback integration that may still auto-trigger when GitHub commits are pushed. Its build failures must NOT block fixes, validation, merging, or resuming work unless Vercel itself is explicitly being audited or removed.
- Do **not** modify product source merely to make Vercel green.
- Before claiming a frontend fix is live, verify the exact Git SHA on Cloudflare Pages. Before claiming a backend fix is live, verify the corresponding Railway API deployment.

Authoritative deployment shape:

```text
GitHub
  ├─ Cloudflare Pages → Web
  ├─ Cloudflare Pages → Telegram frontend
  └─ Railway
       ├─ API
       └─ PostgreSQL
```

---

# Cribbit CHAOS — FIX.md

## Source-Level Frontend Recovery & Legacy-Runtime Elimination Protocol

**Status:** IN PROGRESS  
**Branch:** `feature/visual-integration-checkpoint`  
**Primary objective:** Web production must have **zero** `legacy-runtime` consumers.  
**Rule:** Fix every problem at the authoritative source. Never patch around it.

---

# 1. NON-NEGOTIABLE RULES

Before editing any bug, display issue, interaction issue, or architectural conflict, trace the complete path first:

- data / state
- trigger / open / close / lifecycle logic
- component / modal / panel / popover / container that renders it
- parent layout / container hierarchy
- positioning / portal / stacking-context logic
- CSS / Tailwind / style definitions
- responsive / mobile / viewport behavior
- empty / single / many / long-content / loading / error / active / inactive / open / closed / repeated-open / reconnect states
- list and item rendering
- imports and usages recursively
- shared components, hooks, stores, contexts, providers, design tokens, layout primitives, utilities
- legacy-runtime involvement
- deployment branch/version whenever live behavior is involved

If any relevant source is unknown, the task is **BLOCKED** until it is found.

## Never do this

- no patching or workaround layers
- no arbitrary z-index escalation
- no hardcoded offsets/dimensions solely to make one current screenshot fit
- no duplicate components, handlers, state, route logic, IDs, `data-action`, or `data-nav`
- no second CSS rule whose purpose is to override a broken first rule
- no `!important`
- no fake/mocked production data
- no hiding/clipping broken overflow to conceal a layout problem
- no unrelated redesign
- no inline-style compensation for broken source layout
- no post-render DOM replacement as permanent ownership
- no weakening tests merely to make CI green
- no changing stale `104` expectations to stale `128` when the higher authority is `CHAOS-133-V1`

If a shared source is wrong, fix that source and remove the downstream conflict.

## Preserve correct behavior

Do not change unrelated colors, typography, icons, radius, shadows, navigation, scrolling, containment, focus, keyboard behavior, animation, responsive behavior, or interaction patterns unless the root bug specifically requires it.

Long content must remain contained and scroll inside the intended container.

---

# 2. REQUIRED FIX TRACE BEFORE EVERY PRODUCT EDIT

Every product edit requires:

1. **Issue** — exact observed problem.
2. **Acceptance reference** — screenshot, URL, user description, accepted prior UI, design reference, or explicit criteria.
3. **Reproduction** — exact steps.
4. **Render source** — exact template/component/route/panel/list/item renderer.
5. **State source** — exact local state/store/context/server snapshot/API response/derived/fixture state.
6. **Trigger/lifecycle** — exact click/event/open/close/mount/unmount/effect/subscription/router/reconnect path.
7. **Parent hierarchy** — DOM/component path to the app shell.
8. **Layout/positioning** — flex/grid, dimensions, sticky/fixed/absolute, overflow, transforms, stacking contexts, portals.
9. **Styling** — every selector, stylesheet, token, inline style, media query, and conflicting definition.
10. **Responsive behavior** — every breakpoint and alternate layout.
11. **Related states** — empty, one, many, long text, loading, error, open, closed, repeated open, desktop, tablet/narrow, mobile, zoom, reconnect/refresh as applicable.
12. **Import/use graph** — recurse until the authoritative owner is proven.
13. **Root cause** — one precise sentence.
14. **Authoritative fix location** — exact files and why.
15. **Files that must NOT change** — downstream files that would only create another patch.

No product edit is allowed until this trace is complete for that slice.

---

# 3. SOURCE-OF-TRUTH ORDER

1. canonical game/product specification
2. authoritative engine/server state
3. contracts/domain model
4. shared controller/hook/store/provider
5. shared component/layout primitive
6. platform composition layer
7. platform-specific component styling
8. route presentation
9. legacy compatibility code
10. one-off override files

A lower layer must never conceal a defect in a higher layer.

---

# 4. ROOT-FIX EXECUTION CYCLE

## A — Inspect
No code changes. Trace state, lifecycle, DOM, rendering, styling, responsive behavior, dependencies, legacy participation, and deployment identity.

## B — Diagnose
Record root cause, authoritative owner, conflicting sources, obsolete sources, and intended ownership after the fix.

## C — Plan
List only the minimum authoritative files required.

## D — Implement
Edit the broken source. Remove obsolete conflicting code. Do not create parallel ownership.

## E — Validate
Run all available relevant checks:

- typecheck
- build
- lint
- unit tests
- integration tests
- browser/visual checks
- responsive checks
- edge states
- duplicate DOM/source inspection

## F — Record
Only a successfully validated source fix may enter **Completed Fixes Log**.

If a regression occurs, revert the failed change. Do not stack another correction on top.

---

# 5. VALIDATION RULE

| Check | Requirement |
|---|---|
| Typecheck | required when TS affected |
| Build | required |
| Lint | required if configured/relevant |
| Unit tests | required when relevant |
| Integration tests | required when relevant |
| Browser render | required for visual fixes when tooling exists |
| Desktop/narrow/mobile | required for visual fixes |
| Long content / containment | required where content can grow |
| Empty/single/many | required where applicable |
| Open/close/repeated-open/outside-click | required for overlays |
| Loading/error/reconnect | required for async/stateful surfaces |
| Duplicate DOM/source check | required |
| No new override layer | required |

A pre-existing failing check must be proven against an earlier commit and recorded as a blocker. It must never be silently treated as a pass.

---

# 6. REQUIRED END STATE

```text
Web
  → Web composition
  → typed controllers / feature layer
  → typed API client
  → authoritative API / engine / persistence
```

Forbidden end state:

```text
Web
  → legacy-compatibility
  → packages/legacy-runtime/src/runtime.ts
```

`legacy-compatibility` is temporary migration scaffolding only. It is not a completed fix and must not remain a Web production dependency.

---

# 7. CURRENT VERIFIED STARTUP TRACE

## Before current elimination pass

```text
apps/web/index.html
→ apps/web/src/main.ts
→ packages/ui/src/bootstrap.ts
→ implicit full template injection
→ Web beforeRuntime DOM mutation
→ legacy-runtime import
→ legacy runtime initialization
```

## Current branch after source-boundary correction

```text
apps/web/index.html
→ apps/web/src/main.ts
→ explicit mountSharedTemplate()
→ current Web hero compatibility composition
→ bootstrap(platform, { runtimeMode: 'legacy-compatibility' })
→ legacy runtime
```

`bootstrap()` no longer silently injects the historical application DOM. Compatibility composition is now visible at the caller and can be removed surface-by-surface.

This is an architectural normalization step, **not** legacy-runtime elimination completion.

---

# 8. LEGACY RUNTIME ELIMINATION PASS

## Status: IN PROGRESS
## Started: 2026-08-15

## L0 — FULL LEGACY-RUNTIME DEPENDENCY AUDIT

### Audit result

The uploaded L1-L4 extraction outline is directionally useful but its initial example list is incomplete for this repository. The real runtime owns substantially more than navigation, modals, rails and activity feed. L5 (`runtimeMode: 'none'`) is forbidden until every user-visible/runtime-required surface below has a new authoritative owner.

### Ownership transfer map

| Surface | Current legacy owner / responsibility | Target authority | Status |
|---|---|---|---|
| Compatibility application DOM | shared template + runtime selector assumptions | Web composition for Web; explicit fixture composition only for compatibility tests | IN PROGRESS |
| Lobby hero | shared legacy hero + Web replacement | one Web-owned source | PENDING |
| Header connection/revision/fixture state | `syncHeader`, `syncFixtureBadge` | Web shell/status controller fed by real state | PENDING |
| Product navigation | `initializeNavigationMenus`, global `[data-nav]` handler, `showView` | typed Web navigation/router controller | PENDING |
| Board/library/create tab navigation | global click handler + `state.ecosystem.*Tab` | typed route/view state | PENDING |
| Room Creator state | `state.setup`, `renderSetup`, `setMode`, direct form handlers | typed Room Creator controller/store | PENDING |
| Room Creator create/start | `commandStartGame`, `serverCommand('START_GAME')` local simulation | authoritative room/start API after backend migration | BLOCKED BY BACKEND/CANON |
| Join room | simulated `join-room` handler | `CribbitApiClient.joinRoom` + migrated room service | BLOCKED BY BACKEND |
| Game session state | `state.session`, `state.flow`, `state.revision` | authoritative session snapshot | BLOCKED BY BACKEND/CANON |
| Game command dispatch | local `serverCommand` dispatcher | typed API `sendCommand` / realtime command path | BLOCKED BY BACKEND/CANON |
| Game board rendering | `renderGame` and subordinate renderers | Web game view driven only by server snapshot + available actions | BLOCKED BY BACKEND/CANON |
| Card legality / draw availability presentation | runtime local rule calculations | server `availableActions` / canonical engine | BLOCKED BY CANON |
| Timer/reconnect presentation | `tick`, `renderTimerOnly`, reconnect simulation | server timer/snapshot + realtime reconnect controller | BLOCKED BY BACKEND |
| Responsive game rails | `layoutState`, `initializeLayoutController`, `syncRailMode`, `fitGameBoard`, ResizeObserver | Web Rail/LayoutController | PENDING |
| Fullscreen/focus | legacy layout functions | Web Rail/LayoutController / platform adapter | PENDING |
| Activity event feed | `state.events`, `renderEvents` | server event/revision projection | BLOCKED BY BACKEND for production data; renderer extraction PENDING |
| Prompt history | `renderEvents` + local `state.prompts` | server-resolved prompt history | BLOCKED BY BACKEND |
| Flow dialog | `renderFlowDialog` + local `state.flow` | interaction view driven by server active interaction | BLOCKED BY BACKEND/CANON |
| Reconnect dialog | `renderReconnectDialog` + simulated connection state | realtime/snapshot reconnect controller | BLOCKED BY BACKEND |
| Search dialog | `renderGlobalSearch` + local prompt DB | Web utility controller + real prompt source | PENDING/BACKEND |
| Notifications dialog | `renderNotifications` + hardcoded notifications | real notification API or no production fake state | BLOCKED BY BACKEND |
| Profile dialog | global action handler + local setup state | Web profile controller + `/v1/me/profile` | PENDING |
| Rooms view | `renderRooms`, room weight/category state | room feature/controller + migrated room API | BLOCKED BY BACKEND |
| CHAOS Board | `renderBoard`, local `BASE_PROMPTS` | prompt service/controller | BLOCKED BY BACKEND |
| Library | `renderLibrary`, local Sets | saved/house/live prompt APIs | BLOCKED BY BACKEND |
| Create prompt | `renderCreate`, submit handler, local moderation simulation | prompt/moderation APIs | BLOCKED BY BACKEND |
| Call Mode | `renderCallMode`, local flow state | Web presentation of authoritative interaction | BLOCKED BY BACKEND/CANON |
| Recap | `renderRecap`, local session/prompt state | authoritative completed snapshot / recap projection | BLOCKED BY BACKEND |
| Rules/Lab | runtime knobs and QA mutations | DEV-ONLY fixture/test tooling outside production Web | PENDING |
| Visual fixtures | runtime fixture mutation helpers | dedicated fixture/dev-only harness | PENDING |
| Toast/live region | `toast`, `announce` | reusable UI primitive/controller | PENDING |
| Card detail | `openCardDetail`, runtime card lookup/rules | Web component using authoritative card instance/snapshot | BLOCKED BY CANON |
| Prompt selection/Roulette | local `BASE_PROMPTS`, `promptEligible`, `selectEligiblePrompt`, `startRouletteSpin` | authoritative server Roulette subsystem | BLOCKED BY BACKEND/CANON |
| Bot simulation | `scheduleBotTurn`, `botTakeTurn`, social bot resolution | server/engine only or fixture-only | BLOCKED BY BACKEND/CANON |

### Confirmed `data-action` vocabulary currently handled by legacy runtime

```text
toggle-left-rail
toggle-right-rail
toggle-focus-mode
toggle-fullscreen
close-rail-drawers
simulate-disconnect
reset-demo
cycle-fixture
reconnect-now
join-room
open-mobile-nav
open-global-search
open-notifications
open-profile
save-profile
toggle-activity
apply-room-config
add-to-room
remove-from-room
advance-submission
prompt-detail
draw-card
play-card
card-detail
choose-wild
spin-roulette
publish-prompt
answer-mode
finish-speak
review-typed-answer
review-choice-answer
review-live-answer
submit-answer
edit-answer
complete-flow
safety-pass
safety-rewind
safety-flag
use-nope
nope-reaction
paranoia-choice
duel-target
duel-vote
chaos-target
resolve-chaos
save-prompt
focus-create-prompt
lab-add-card
lab-one-card
lab-human-turn
lab-trigger-draw
lab-queue-chaos
retry-last-command
force-recap
clear-log
flow-close-request
play-again
share-recap
```

Additionally the runtime owns delegated selectors for:

```text
[data-nav]
[data-board-tab]
[data-library-tab]
[data-create-destination]
[data-room-category]
.mode-card[data-mode]
[data-source]
[data-filter]
[data-close-dialog]
[data-call-mode]
```

### Confirmed direct DOM/state identities grouped by surface

This is the current verified grouped selector inventory. It is intentionally grouped by ownership rather than treated as permission to duplicate these bindings in new controllers.

**Setup / Room Creator**

```text
#profileName
#roomName
#worldSelect
#ceilingSelect
#playerCount
#playerCountValue
#qaHandToggle
#startGameButton
#joinCode
#modeGrid / .mode-card
#sourceGrid / .source-toggle
#knobStartingHand
#knobDrawPenalty
#knobTurnTimer
#knobStageEvery
#knobVoluntaryDraw
#knobSocialAlways
#knobFinalSocial
#knobNopeContract
```

**Game / layout**

```text
#gameLayout
#leftRail
#rightRail
#toggleLeftRail
#toggleRightRail
#focusModeButton
#fullscreenButton
#gameStage
#handScroll
.hand-zone
.table-zone
#phaseTrack
#playerList
#discardSlot
#drawPileCount
#statsGrid
#eventList
#promptHistoryList
#activeChallengeTitle
#activeChallengeCopy
#inlineFlowControls
#timerValue
#timerProgress
#modeBadge
#gameRoomName
#gameRoomMeta
#stageChip
#currentTurnName
#activeColorLabel
#activeSymbolLabel
#directionLabel
#phoneRevision
#boardPhaseLabel
#handCount
#authorityCopy
```

**Header / utility / dialogs**

```text
#connectionPill
#revisionLabel
#fixturePill
#fixtureLabel
#mobileNavDialog
#searchDialog
#globalSearchInput
#globalSearchResults
#notificationsDialog
#notificationList
#profileDialog
#profileDialogName
#profileDialogWorld
#cardDialog
#cardDialogBody
#flowDialog
#flowDialogBody
#reconnectDialog
#reconnectBody
#toastRegion
#liveRegion
```

**Rooms / Board / Library / Create / Call / Recap / Lab**

```text
#familyFilters
#promptSearch
#promptList
#boardTabs
#boardResultMeta
#libraryTabs
#libraryPageList
#libraryPanelTitle
#libraryPanelCopy
#destinationGrid
#createDestinationSummary
#currentDestinationLabel
#communityFields
#promptWorld
#promptIntensity
#submissionList
#ecosystemPromptForm
#callRoster
#callRosterMeta
#callStateCopy
#callPrompt
#callOrb
#stateTable
#champPanel
#saveThatList
```

### L0 safe extraction order

The runtime dependency graph proves the extraction cannot stop after navigation/modals/rails/activity. The safe order is:

1. **Composition boundary** — make historical template mounting explicit and remove hidden bootstrap DOM ownership. IN PROGRESS.
2. **Pure UI utilities** — toast/live-region helpers where behavior is self-contained.
3. **Layout/rail/fullscreen/focus** — state is presentation-only and does not require canonical game-rule decisions.
4. **Navigation shell** — only after route state and board/library/create substate have a typed Web owner; do not add a second click handler while runtime handler remains.
5. **Profile/auth utility** — use existing real profile API.
6. **DEV-only fixture/Lab isolation** — move out of production ownership.
7. **Room/prompt backend migration** — required before Rooms, Board, Library, Create, notifications and real join/create can leave runtime without fake data.
8. **Canonical contracts/engine migration to CHAOS-133-V1** — required before production game state/actions can replace runtime.
9. **Authoritative game API/persistence/realtime** — enable snapshot/commands only after canonical engine tests pass.
10. **Game/interaction/Roulette/recap rendering** — switch to authoritative snapshots/actions/events.
11. **Remove Web `legacy-compatibility` consumer** — only when every production surface is transferred.
12. **Verify no legacy runtime in production bundle/source graph.**

### L0 conclusion

**L0 is COMPLETE as an ownership audit.**

It proves a critical fact: total Web legacy-runtime elimination is coupled to two additional source-level migrations that cannot be ignored or faked:

- the production API currently returns `ROOMS_NOT_MIGRATED`, `PROMPTS_NOT_MIGRATED`, and `ENGINE_NOT_MIGRATED` for the very state/actions the runtime currently simulates;
- contracts/engine/card composition are stale (`104` test expectations, `128` engine, limited `CardKind`) relative to `CHAOS-133-V1`.

Therefore setting `runtimeMode: 'none'` now would not be a fix. It would remove the only current owner of major working surfaces without an authoritative replacement.

---

# 9. IMPLEMENTED SOURCE CHANGES — NOT YET COMPLETED FIXES

## E0-A — Explicit runtime mode boundary

Earlier change made legacy-runtime loading opt-in rather than implicit.

**Status:** transitional and not sufficient. Web still consumes legacy runtime.

## E0-B — Shared bootstrap no longer owns historical DOM injection implicitly

Commits in this slice:

- `e777bac443b0241b1a42d84a38b7b9c09a2559be` — `packages/ui/src/bootstrap.ts`
- `82329947fe00f3024b2f1c404c2ff8b767a86fb6` — `apps/web/src/main.ts`
- `1976a02427d088e05d5fe324166ac2a6649fa252` — `apps/telegram/src/main.ts`

**Root cause:** `bootstrap()` previously performed complete historical DOM composition as a hidden side effect, which made it impossible for a caller to remove legacy composition surface-by-surface.

**Source change:** `mountSharedTemplate()` is now an explicit compatibility composition operation. `bootstrap()` no longer injects the historical application DOM. Web calls the mount explicitly while migration is incomplete. Telegram compatibility-fixture mode explicitly mounts it; normal Telegram remains on `bootstrapTelegram`.

**Why this source was correct:** template ownership belongs at composition, not inside a platform/service bootstrap that also initializes auth/API/runtime services.

**Validation evidence on head `1976a024...`:**

- `npm ci`: PASS
- `npm run typecheck`: PASS
- test suite: 77 PASS / 3 FAIL
- the three failures are the same pre-existing deck-count assertions: actual `128`, expected `104`
- `build:web`, `build:telegram`, `build:api`: skipped by CI because tests execute first
- no new failure was introduced before the known test gate

**Status:** IMPLEMENTED / PARTIALLY VALIDATED / NOT IN COMPLETED FIXES LOG. Build and browser verification remain blocked by the pre-existing validation gate.

---

# 10. CURRENT BLOCKERS THAT MUST BE FIXED, NOT IGNORED

## B1 — Canonical card authority conflict

Current repository has three conflicting truths:

```text
game-engine tests: 104
current engine:     128
approved authority: 133 (CHAOS-133-V1)
```

Do not patch tests to 128. This requires canonical contracts/engine/deck/test normalization.

## B2 — Contracts are missing approved card families

Current `CardKind` does not include all `CHAOS-133-V1` families. Production engine/API activation cannot be considered canonical until contracts represent the approved deck and runtime-generated Machiavelli provenance where required.

## B3 — Production game API is not migrated

Current API explicitly returns `ENGINE_NOT_MIGRATED` for snapshot and command routes and realtime command rejection. Removing the local runtime game owner before replacing this backend path would intentionally break the game.

## B4 — Room/prompt ecosystem API is not migrated

Current API returns `ROOMS_NOT_MIGRATED`, `PROMPTS_NOT_MIGRATED`, and related 501 responses. Rooms/Board/Library/Create must not be rewired to fake client data after runtime removal.

## B5 — CI hides build checks behind the stale deck test failure

Builds are skipped after `npm test` fails. Do not weaken CI. Fix the canonical authority conflict, then let the normal pipeline reach build validation.

## B6 — Cloudflare Pages control plane cannot be independently inspected with the currently connected Cloudflare tool

Do not claim a Git commit is live without deployment evidence.

## B7 — Browser visual verification remains required

No visual source migration may be called complete until it is visually tested at affected desktop/narrow/mobile states.

## B8 — Vercel is not usable as fallback validation today

Its current Web builds fail before app compilation with `vite: command not found`. Do not confuse that deployment configuration failure with product-source validation.

---

# 11. NORMALIZATION / ELIMINATION TRACKER

## N0 — Deployment authority
- [x] repo CI inspected
- [x] repo Cloudflare workflow/config absence confirmed
- [x] intended Web build/output documented
- [ ] Cloudflare project branch independently verified
- [ ] live Pages build matched to exact Git SHA

## L0 — Full legacy-runtime dependency audit
- [x] runtime state ownership mapped
- [x] route/navigation ownership mapped
- [x] setup ownership mapped
- [x] game/layout/render ownership mapped
- [x] dialog/utility ownership mapped
- [x] rooms/board/library/create/call/recap/lab ownership mapped
- [x] data-action vocabulary recorded
- [x] direct selector groups recorded
- [x] backend/canonical blockers proven
- [x] safe extraction order established

## L1 — Pure presentation utility extraction
- [ ] trace exact toast/live-region behavior
- [ ] extract only after proving one owner and removal path

## L2 — Responsive rail/layout extraction
- [ ] trace all layout functions and listeners
- [ ] establish one owner
- [ ] remove runtime ownership rather than guard/duplicate

## L3 — Navigation/router extraction
- [ ] create typed route/view state
- [ ] include board/library/create substate
- [ ] remove legacy navigation handler in same ownership transfer
- [ ] no second delegated navigation handler allowed

## L4 — Profile/auth utility extraction
- [ ] use actual `/v1/me/profile`
- [ ] no local fake profile authority

## L5 — DEV-only fixture/Lab isolation
- [ ] move QA/demo mutation out of production Web path
- [ ] preserve explicit compatibility fixture path only where intentionally requested

## L6 — Room/prompt backend migration
- [ ] room create/join/config/start
- [ ] prompt pool
- [ ] Board/Library/Create persistence
- [ ] notifications or explicit absence state

## L7 — Canonical engine/contracts migration
- [ ] `CHAOS-133-V1` deck/card-kind authority
- [ ] server game state and commands canonical
- [ ] tests canonical and passing

## L8 — Production game API/realtime
- [ ] snapshots
- [ ] available actions same revision
- [ ] commands
- [ ] persistence transaction
- [ ] realtime revisions
- [ ] reconnect snapshot replacement

## L9 — Game/interaction presentation migration
- [ ] game board
- [ ] activity events
- [ ] social interactions
- [ ] Roulette presentation from committed server result
- [ ] recap

## L10 — Remove Web legacy consumer
- [ ] `apps/web/src` has zero `legacy-runtime` references
- [ ] Web uses no `legacy-compatibility`
- [ ] production bundle contains no legacy runtime
- [ ] all routes/browser states verified

---

# 12. COMPLETED FIXES LOG

None yet under this protocol.

A source change is not promoted here until the required validation is truthfully complete.

---

# 13. NEXT AUTHORIZED SOURCE WORK

The next work must not pretend that extracting four UI controllers is sufficient to remove the runtime.

Proceed in this order:

1. trace and extract a **pure presentation-only** owner that can be removed from runtime ownership without touching gameplay semantics;
2. in parallel, start the canonical authority migration required to unblock CI and the production backend — contracts/deck/test alignment to `CHAOS-133-V1` must be treated as its own root-fix trace, not as a test patch;
3. do not set Web to `runtimeMode: 'none'` until every production surface in the ownership map has a real replacement;
4. do not wire production UI to API routes that currently return 501 and then hide the failure with local fallback data.

The current `legacy-compatibility` consumer remains a **known open defect** until L10 is complete.

---

# 14. REQUIRED COMPLETION REPORT

```text
FIX COMPLETE — [issue]

Root cause:
[one precise sentence]

Authoritative source files changed:
- [file]

Why these were the correct sources:
[explanation]

Conflicting/obsolete code removed:
- [file / selector / handler]

Validation:
- typecheck: PASS
- build: PASS
- lint: PASS / N/A
- tests: PASS / documented unrelated pre-existing blocker only when proven
- visual/browser: PASS
- responsive: PASS
- edge states: PASS / N/A

Patch/workaround introduced: NO
Duplicate ownership introduced: NO
Unrelated redesign: NO
```

Do not report completion if these fields cannot be truthfully filled in.
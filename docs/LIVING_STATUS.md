# Cribbit CHAOS Living Status

Last verified source branch: `main` (remote `36915e4`, which adds `docs/audio-media-plan.md`; reconciliation pending)

Local recovery branch: `recovery/single-engine-authority`. The Live multiplayer slice is committed locally only; nothing pushed or deployed.

This file is the concise operational status companion to `PLAN.md`. It records what is accepted, what is currently implemented, and what we do next.

## Source of truth

GitHub is canonical for deployable source, game rules, documentation, and implementation status.

Current development mode: **Web-first**. Telegram remains contract/state compatible but is not the active UI priority until Web gameplay is stable.

## Live multiplayer lifecycle — VERIFIED LOCALLY

- Create -> waiting room with real owner membership only: no bots, no session, no deal.
- Join -> real membership only; started games and full rooms are rejected.
- Start -> owner only, configured capacity must be full, real players only, exactly one authoritative session, seven cards each.
- Realtime `room:<roomId>` (`room-updated`, `room-started`) with PostgreSQL authoritative.
- Realtime root cause: `CribbitRealtimeClient.connect()` built a second socket while the first was still connecting, so listeners and membership diverged. Fix: `if (this.socket) return this.socket`.
- Web five-real-user lifecycle, five-client convergence after one ordinary command, and private hands: VERIFIED LOCALLY.
- Telegram live runtime: NOT VERIFIED (Telegram Mini App `initData` cannot be minted here).
- Production Web Simulation: CORE WORKING with a SPECIAL-FLOW BLOCKER (a bot reaches a special-card interaction expecting human-style input) — owner-verified on the deployed app; outside this slice.

## Page navigation (NAV-1) — VERIFIED LOCALLY

`packages/ui/src/navigation-controller.ts` restores presentation-only page switching for the shared template: `[data-nav]` activates the matching existing `[data-view]`, sets `aria-current`, closes the mobile navigation dialog, honours `data-room-anchor`, and opens `#mobileNavDialog` from its existing trigger. It is installed from `bootstrap()` only when `runtimeMode` is `'none'`, so no client has two navigation owners.

Browser-verified: all seven destinations switch through their real controls, the mobile path uses the same handler, and the desktop Play popover reveals through real hover and keyboard focus with real clicks reaching Active Game and Recent Recap. The existing `:hover` / `:focus-within` CSS already worked, so no navigation source change was needed for the popover. Commit `efb72401ed23f007f8db4c95137a0769cca9ff63`.

## Canonical identity (IDENTITY-2) — VERIFIED LOCALLY

Telegram authentication is lookup-only: an unknown Telegram identity returns `409 TELEGRAM_IDENTITY_UNLINKED` and never provisions a user; `POST /v1/auth/telegram/register` is the explicit creation action, `POST /v1/auth/telegram/link` (Web credential) and `POST /v1/auth/telegram/link-with-code` (single-use code from `POST /v1/me/identities/telegram/link-code`) link an existing account, and `POST /v1/me/identities/web-credential` attaches a Web login to the current canonical user. Codes live in `auth_sessions` under a namespaced hash, so they cannot be replayed as sessions.

LINK-1 conflict semantics are preserved (`IDENTITY_ALREADY_LINKED`, `IDENTITY_PROVIDER_ALREADY_LINKED`) with no merges or data movement, and authentication refreshes provider metadata only — Telegram re-authentication no longer rewrites the canonical display name.

Real API + PostgreSQL proof: no silent provisioning, exactly one user per explicit creation, Web-first and Telegram-first converging on one `users.id`, a link code issued by the real Web UI consumed over the Telegram transport for the same user with replay rejected, and invalid or stale proof rejected. A real Telegram Mini App runtime is still unavailable here, so the Mini App client path remains NOT VERIFIED.

## Web Local QA Simulation (SIM-1) — VERIFIED LOCALLY

`#startGameButton` is Local QA Simulation (locked product decision), not Live host Start. It is served by `apps/web/src/simulation-mode.ts` -> `apps/web/src/simulation-session.ts` -> the shared `packages/game-engine`, with ephemeral local state and no persistence.

Browser-verified: a real click starts it (game view, five players, seven cards each, engine deal and discard), ordinary human play and draw update the board, bots complete ordinary turns, and the whole simulation produced zero `/v1` requests and zero database rows. Live Create still creates a waiting room with real membership and no session before host Start.

`packages/action-registry` was corrected: `#startGameButton` now records `local game-engine simulation`, not the Live start endpoint.

## Next task

`SIMSHARE-1`: replace the two duplicated simulation harnesses with one shared engine-backed harness consumed by both clients. After that: Roulette privacy projection, approved SVG Roulette presentation, then persistent webpage verticals (Rooms -> CHAOS Board -> Library/Create -> Recap) through `UI -> packages/api-client -> API/domain -> PostgreSQL`.

## Backlog (recorded, untouched)

Truth-or-Chaos engine deadlock (evidence session `c2cb7b4c`) · malformed `commandId` -> raw 500 · origin rejection -> 500 instead of 403 · CRLF-sensitive source-shape tests · duplicate/fallback Wild renderer.

## Canonical deck

Physical game-start deck: **CHAOS-133-V1 = 133 playable physical card instances**.

Family counts:

- Number 76
- Skip 6
- Reverse 6
- Draw 6
- Wild 3
- Truth 3
- Dare 3
- Paranoia 3
- Chaos 3
- Duel 3
- Nope 3
- TAG 3
- Truth or Chaos 3
- Hijack 3
- Taboo 3
- Machiavelli 1
- Ghost 1
- Reverse Confession 3
- DIG ME 1

Machiavelli may generate approved runtime card instances after game start, so active game card count can exceed 133 without changing the physical starting-deck authority.

Known separate asset QA issue: `cards/numbers/lime/number_lime_1_02.jpg` is zero-byte. This is not a gameplay-rule change.

## Accepted runtime behavior

### Roulette — ACCEPTED

- authoritative prompt selected before spin
- Roulette is presentation only
- prompt survives spin
- stable SVG wheel removed old flicker

### Fixture Preview close — ACCEPTED

Visual-only preview can close and clears fixture-preview state.

### Active gameplay close guard — ACCEPTED

Unresolved gameplay effects cannot be dismissed. Close attempts keep the modal open and instruct the player to finish the action.

### Hybrid Paranoia — ACCEPTED

Classic and Stranger flows, target/answer-player identity, voting, penalties, Continue, and win boundaries were browser-verified.

### Truth / Dare Manual + Roulette — ACCEPTED

Manual/Roulette prompt flow and refusal behavior are accepted.

`Pass / Not for Me` draws exactly 2 before resolution/win checking.

### Duel — ACCEPTED

Current subjective/manual/app text Duels use `GROUP_VOTE`; challenger/opponent cannot vote; unique top wins; tie/no voters means no Duel winner; two-player Duel does not hang. Duel cannot be Noped.

## Visual fix — draw pile canonical card back

Source renders the canonical `backs/card_back.jpg` on the Web draw pile while preserving the count overlay and stack silhouette.

Status: **SOURCE FIXED — browser verification pending**.

## Machiavelli locked rule

Machiavelli uses exactly six server-enforced options and is one-use -> Exhausted. Canonical definitions remain in `Game_rules.md` and `PLAN.md`.

## CHAOS Pulse adaptive distribution — SOURCE IMPLEMENTED / MANUAL TRIAL PENDING

The adaptive probability architecture is now implemented in the shared game engine.

Canonical order:

```text
ADAPTIVE WEIGHTS
-> PRIMARY CHAOS VARIANCE
-> ADAPTIVE REBALANCER
-> SECONDARY CHAOS VARIANCE
-> HARD SAFETY GUARD
-> NORMALIZE
-> SELECT ONE REAL PHYSICAL CARD
```

### Opening dealer

The shared dealer now:

- uses real `CHAOS-133-V1` physical instances;
- deals exactly 7 cards per player;
- guarantees **1–2 high-impact/special cards** in each starting hand;
- avoids one fixed repeated hand template;
- adapts one-vs-two special probability to remaining inventory/player count;
- reserves the starter card before the adaptive deal;
- keeps opening-hand interaction cards dormant until voluntarily played;
- remains deterministic for a recorded seed while new production matches can use fresh seeds.

### Post-start selection

`packages/game-engine/src/deck.ts::drawCards()` now selects cards through the shared CHAOS Pulse adaptive selector.

Current trial model includes:

- base physical availability (`10 x remaining drawable copies`);
- family freshness/memory;
- global interaction pressure;
- mild rare-tier trial weighting;
- primary bounded variance;
- category rebalancing;
- smaller secondary within-category jitter;
- real physical-instance removal after selection.

Multi-card draws recalculate sequentially after each physical card.

### Shared source files

- `packages/contracts/src/index.ts`
- `packages/game-engine/src/adaptive-distribution.ts`
- `packages/game-engine/src/deck.ts`
- `packages/game-engine/src/setup.ts`
- `packages/game-engine/src/index.ts`
- `packages/game-engine/test/adaptive-distribution.test.ts`

### Validation

CI run for source commit `c18b431e24d7bac53fba1c627d404fea770b59b4` completed **SUCCESS**.

Passed in CI:

- [x] typecheck
- [x] Web build
- [x] Telegram build
- [x] API build
- [x] tests

Adaptive tests cover 2–10 players, 1–2 opening specials, 133-card conservation, deterministic replay, seed variety, freshness, interaction pressure, both variance layers, rebalancing, zero availability, real-card removal, and sequential multi-card draws.

This is **source verification only**, not browser gameplay acceptance.

## Web trial surface — removed before PR #8 merge

The earlier separate **Try CHAOS Pulse** lobby panel is not present in current `main`. The removed files are:

- `apps/web/src/chaos-pulse-lab.ts`
- `apps/web/src/chaos-pulse-lab.css`

Do not use that removed panel as the next checkpoint. The current app-facing verification target is the main Web board.

Status: **REMOVED PANEL — MAIN BOARD MIGRATION PENDING**.

## Important compatibility boundary

On the recovery branch (`recovery/single-engine-authority`) the Web client boots as follows: `apps/web/src/main.ts` mounts the shared template and calls `bootstrap()` with `runtimeMode: 'none'`, so neither `packages/legacy-runtime` nor `canonical-game-runtime.ts` is loaded by Web.

Current runtime classification on this branch:

- `apps/web/src/canonical-game-runtime.ts` is dead for Web boot and must not be imported by Web entry points.
- `packages/legacy-runtime/src/runtime.ts` is loaded only by the Telegram client (`runtimeMode: 'legacy-compatibility'`); it is not a Web board runtime.
- `apps/web/src/live-entry.ts` is the active auth/Live entry; `apps/web/src/live-session.ts` owns the Live board, and `apps/web/src/simulation-mode.ts` + `apps/web/src/simulation-session.ts` own the local QA simulation board.

That legacy runtime still contains its own old local deck/deal/draw implementation. Therefore:

- the removed **Try CHAOS Pulse** panel is no longer an app-facing checkpoint;
- the **main playable compatibility board is not yet using CHAOS Pulse for its actual deck**;
- do not copy the adaptive algorithm into `legacy-runtime` as another rules engine;
- next migration must bridge/remove the compatibility deck seam and consume the shared engine instead.

## Locked draw rule — opening optional, post-start interaction immediate

Opening-hand interaction cards stay in hand and can be played voluntarily later.

Post-start physical draws of these families must resolve immediately:

- Truth
- Dare
- Paranoia
- Duel
- Taboo
- Reverse Confession
- TAG
- Truth or Chaos
- Hijack
- DIG ME
- Chaos
- Machiavelli

Hand-resident on draw:

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

Generated/direct-to-hand cards follow their generating effect and are not silently reclassified as draws.

## Chained draws

Multiple physical draws are selected sequentially from the current adaptive state. Immediate interactions must then resolve FIFO in physical selection order, with no overlapping social flows.

## Current corrected-rules implementation status

The current local source has completed Phases 0–7 of the live GameRules execution plan recorded in `chaosfixplan.md`.

Verified source behavior now includes:

- shared-engine forced-on-draw FIFO through `pendingForcedInteractions`;
- narrow Truth/Dare Nope, including selected-target Nope through `PLAY_NOPE`;
- Machiavelli Paranoia Spreads generating only approved DIG ME / Paranoia cards;
- Paranoia Classic voluntary Keep Secret applying Draw 1 to the answer player;
- Hijack swapping authoritative player order, not only seat labels;
- Chaos approved catalogue slices: Blind Swap and Reverse Order;
- Truth or Chaos consensus match / group-punishment state;
- Ghost arm, activate, and two-own-turn normal-draw suppression lifecycle;
- Web and Telegram live clients submitting Ghost and Nope through shared `projectDecisionCapabilities()` options.

Current verification snapshot:

```text
npm run typecheck -> exit 0
npm test -> 155 tests, 149 passed, 6 skipped, 0 failed
npm run build -> exit 0 for Web, Telegram, and API
```

This remains **source/local verification only**. It is not a live Railway/Cloudflare deployment claim; Phase 8 requires explicit approval before live mutation/readback.

## Active integration task

**Phase 8 — live Railway/client verification after source proof.**

Verification checklist:

- [x] Phase 1 contract guard proves live Web and Telegram both use the API session adapter.
- [x] Phase 1 contract guard proves API command processing applies the shared reducer before backend bot advancement.
- [x] Phase 2 shared-engine forced-on-draw FIFO has reducer and contract coverage.
- [x] Phase 3 selected-target Truth/Dare Nope has reducer/router coverage.
- [x] Phase 4 special-card gaps have reducer coverage for Chaos, Truth or Chaos, Ghost, Machiavelli, Paranoia, and Hijack.
- [x] Phase 5 proves Web and Telegram use shared capability projection for Ghost activation and Nope reaction.
- [x] Phase 6 updates traceability docs.
- [x] Phase 7 full local verification after docs are updated.
- [>] Phase 8 live Railway/client deployment and readback after explicit approval.

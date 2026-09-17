# Cribbit CHAOS Living Status

Last verified source branch: `main`

This file is the concise operational status companion to `PLAN.md`. It records what is accepted, what is currently implemented, and what we do next.

## Source of truth

GitHub is canonical for deployable source, game rules, documentation, and implementation status.

Current development mode: **Web-first**. Telegram remains contract/state compatible but is not the active UI priority until Web gameplay is stable.

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

The current main Web gameplay board now has one boot path: `apps/web/src/main.ts` starts the shared UI and requests `runtimeMode: legacy-compatibility`.

PR #9 removed the extra direct `canonical-game-runtime.ts` bootstrap from `apps/web/index.html`, so the Web shell no longer starts both the canonical browser runtime and the compatibility path at page load.

Current runtime classification:

- `apps/web/src/canonical-game-runtime.ts` is reference/dead for Web boot and must not be imported by `apps/web/index.html`.
- `packages/legacy-runtime/src/runtime.ts` remains the active transitional board runtime.
- `apps/web/src/live-entry.ts` and `apps/web/src/live-session.ts` remain active auth/live-room command bridges.

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

## Active integration task

PR #11 merged the shared CHAOS Pulse board seam and canonical forced-on-draw FIFO guards. The active follow-up is now bot stability through one shared backend policy, not separate Web-vs-Telegram bot fixes.

Verified Phase 1 backend-contract facts:

```text
Web live room -> packages/api-client -> Railway API -> game_sessions state -> shared game-engine reducer -> API bot advancement
Telegram live room -> packages/api-client -> Railway API -> game_sessions state -> shared game-engine reducer -> API bot advancement
```

Current source still has local QA/simulation surfaces for fallback/demo use, but they are not the live multiplayer authority.

Do not implement separate Web bot behavior and Telegram bot behavior. Fix bot decisions at the shared API/game-engine boundary, then let both clients render the same resulting state.

## Repository guardrails

Never commit temporary artifacts such as `FIX.md`, scratch files, recovery notes, generated diffs, diagnostics, logs, or temporary planning files.

Runtime-affecting work is not accepted until browser/live-Web verification confirms it.

## Current next task

**Phase 2 — extract one deterministic shared BotPolicy / legal-action enumerator for API bot advancement.**

Verification checklist:

- [x] Phase 1 contract guard proves live Web and Telegram both use the API session adapter.
- [x] Phase 1 contract guard proves API command processing applies the shared reducer before backend bot advancement.
- [x] Phase 2A adds a shared engine `projectDecisionCapabilities()` legal-action enumerator.
- [x] Phase 2A tests prove advertised options are accepted by the reducer for play/draw, Wild color, Truth completion-only, and Duel target/response/vote flows.
- [x] Phase 2A tests established the fail-closed legal-action boundary.
- [x] Phase 2B moves API bot decision selection out of hardcoded card-family branches into shared `chooseBotOption()`.
- [x] Phase 2B wires API bot advancement to choose from `projectDecisionCapabilities()`.
- [x] Phase 2B adds no frontend-specific bot rule path.
- [x] Phase 2B verifies bot settlement for Truth, Dare, Chaos, Paranoia, Duel, TAG, Truth or Chaos, Hijack, Taboo, Machiavelli, Reverse Confession, and DIG ME.
- [ ] live browser/deployed-game readback after PR/CI/deployment.

# Cribbit CHAOS Living Status

Last verified source branch: `feature/visual-integration-checkpoint`

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

## Web trial surface — ready for manual check

The Web lobby now contains a **Try CHAOS Pulse** button backed by the real shared game engine.

Files:

- `apps/web/src/chaos-pulse-lab.ts`
- `apps/web/src/chaos-pulse-lab.css`
- `apps/web/src/main.ts`

The trial panel lets us:

- choose 2–10 players;
- generate a fresh-seeded match;
- inspect all opening hands;
- see special + interaction counts for each hand;
- produce 12 sequential adaptive physical draws;
- see interaction pressure before/after every draw;
- reroll repeatedly to judge variety and pacing.

Status: **BUILD VERIFIED — USER/BROWSER TRIAL PENDING**.

## Important compatibility boundary

The current main Web gameplay board still boots under `runtimeMode: legacy-compatibility`.

That legacy runtime still contains its own old local deck/deal/draw implementation. Therefore:

- the **Try CHAOS Pulse** panel is using the new shared adaptive engine now;
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

The shared engine now owns **which real physical card is selected**. The remaining integration task is to make the actual Web board consume that shared authority and route selected immediate-interaction cards into the one forced-interaction FIFO dispatcher.

Required convergence:

```text
shared adaptive opening dealer
-> actual board starting hands

shared CHAOS Pulse draw selector
-> actual board draw/penalty paths
-> hand-resident card OR immediate-interaction queue
-> existing family flow
-> FIFO resolution
-> turn/win continuation only when queue is clear
```

Do not implement a second CHAOS Pulse inside the legacy runtime.

## Repository guardrails

Never commit temporary artifacts such as `FIX.md`, scratch files, recovery notes, generated diffs, diagnostics, logs, or temporary planning files.

Runtime-affecting work is not accepted until browser/live-Web verification confirms it.

## Current next task

**Run the Web app and manually evaluate `Try CHAOS Pulse`; after the distribution feels directionally correct, migrate the main compatibility board's deck/deal/draw seam to the shared engine and connect post-start interaction draws to the shared FIFO resolver.**

Trial checklist:

- [ ] 2-player repeated rerolls show varied hands and every hand has 1–2 specials
- [ ] 5-player repeated rerolls show varied hands and every hand has 1–2 specials
- [ ] 10-player repeated rerolls show varied hands and every hand has 1–2 specials
- [ ] no obvious repeated fixed hand recipe
- [ ] common 6-copy actions feel more frequent than 3-copy families
- [ ] 1-copy cards remain visibly scarce across rerolls
- [ ] adaptive 12-draw sequences do not show an obvious fixed window pattern
- [ ] interaction pressure visibly falls after an interaction and rebuilds through quieter draws
- [ ] unusual/repeated outcomes remain possible enough to feel chaotic
- [ ] trial UI is usable on desktop/mobile

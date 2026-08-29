# Cribbit CHAOS Implementation Plan

## Mandatory project-control workflow

Every implementation slice must follow:

**inspect living status -> make one controlled change -> validate source -> verify runtime when applicable -> remove superseded/stale artifacts -> update living docs -> publish -> verify deployed behavior**

GitHub is the canonical source of truth for deployable source, game rules, documentation, and implementation status.

`README.md`, `PLAN.md`, `AGENTS.md`, and `docs/LIVING_STATUS.md` must not contradict verified reality.

Temporary planning/recovery artifacts such as `FIX.md`, scratch files, recovery notes, generated diffs, diagnostics, and debug logs must never be committed.

## Working mode

- Web-first until gameplay is stable.
- Telegram UI work is deferred unless a Web change requires shared-contract compatibility.
- Backend/server/runtime owns authoritative gameplay state and rule enforcement.
- UI is presentation/input only.
- Do not create duplicate card engines, duplicate Roulette systems, duplicate refusal paths, or family-specific copies of shared mechanics when one authoritative dispatcher/handler can own the rule.
- Do not claim runtime acceptance from static tests alone.

## Canonical architecture

```text
GitHub = source of truth
    |
    +--> Cloudflare Pages Web
    |
    +--> Cloudflare Pages Telegram
                 |
                 v
              Railway API
                 |
                 v
          Railway PostgreSQL
```

Web and Telegram are two clients of one game. They may use different responsive layouts, but may not own separate deck composition, card behavior, commands, or authoritative rules.

## Canonical physical deck — CHAOS-133-V1

The game starts from exactly 133 physical playable card instances.

Current family counts:

- Number x76
- Skip x6
- Reverse x6
- Draw x6
- Wild x3
- Truth x3
- Dare x3
- Paranoia x3
- Chaos x3
- Duel x3
- Nope x3
- TAG x3
- Truth or Chaos x3
- Hijack x3
- Taboo x3
- Machiavelli x1
- Ghost x1
- Reverse Confession x3
- DIG ME x1

Pass, Rewind, Flag, Roulette, answer-mode controls, and other UI controls are systems, not physical hand-card families.

Machiavelli may create approved runtime card instances after game start. That can increase the active game card count above 133, but it does not change the physical starting deck authority.

### Card asset authority

- Canonical card package: `CHAOS-133-V1`.
- Reverse Confession canonical assets use JPEG:
  - `cards/reverse_confession/fIYGR_01.jpg`
  - `cards/reverse_confession/fIYGR_02.jpg`
  - `cards/reverse_confession/fIYGR_03.jpg`
- Do not retain duplicate PNG/JPEG versions of the same canonical physical card.
- Known separate production QA issue: `cards/numbers/lime/number_lime_1_02.jpg` is zero-byte. This is an artwork/integrity issue, not a gameplay-rule change.

## Completed/accepted gameplay slices

### Roulette presentation — ACCEPTED

- One authoritative prompt is selected before animation.
- Roulette is presentation only.
- Selected prompt survives the spin.
- SVG-based wheel rendering removed the old rotating-HTML flicker.

### Fixture Preview close behavior — ACCEPTED

Fixture Preview is visual-only and dismissible. Closing it clears fixture-preview state without touching authoritative gameplay.

### Active unresolved-flow close behavior — ACCEPTED

Unresolved gameplay effects cannot be dismissed. Close attempts keep the modal open and show the guard message telling the player to finish the action first.

### Hybrid Paranoia — ACCEPTED

Canonical entry:

```text
Play Paranoia
-> choose prompt source
-> Manual or Roulette
-> prompt established
-> choose initial target
-> choose Classic or Stranger
```

Classic:

```text
paranoia-choice
-> paranoia-phase
-> paranoia-classic-answer-player
-> paranoia-classic-decision
-> resolved
-> Continue / win check
```

- Initial target is preserved separately from the later answer player.
- Initial target names the Classic answer player.
- Named answer player alone chooses Reveal or Keep Secret.
- Classic phase selection itself must not resolve the card.

Stranger:

```text
paranoia-choice
-> paranoia-phase
-> paranoia-target-answer
-> paranoia-stranger-vote
-> resolved
-> Continue / win check
```

- Eligible voters are everyone except the target.
- Tie means no penalty.
- Strict `LYING` / `HOLDING_BACK` majority makes the target draw 2.

Manual browser checks passed for Classic no-winner, Stranger no-winner, last-card Paranoia winner, and Truth/Dare Continue regression.

### Truth / Dare Manual + Roulette — ACCEPTED

Canonical flow:

```text
Play Truth/Dare
-> choose prompt source
-> Manual or Roulette
-> prompt established
-> preview/reveal/answer
```

Manual prompt validation: 10-280 characters. Manual prompts are one-off runtime prompts and are not automatically saved permanently.

### Truth / Dare Pass / Not for Me — ACCEPTED

Locked rule:

```text
Pass / Not for Me
-> draw exactly 2 real cards
-> authoritative hand mutates
-> social effect resolves
-> Continue / turn resolution
-> win check
```

This applies equally to Truth and Dare, Manual and Roulette.

Critical ordering:

```text
play last Truth/Dare
-> hand reaches 0 temporarily
-> Pass / Not for Me
-> Draw 2 happens first
-> player cannot win from that play
```

Browser acceptance confirmed Truth Manual, Truth Roulette, Dare Manual, Dare Roulette, normal no-penalty completion, last-card non-win behavior, and normal Continue/turn resolution.

### Duel — ACCEPTED

Canonical model:

```text
Play Duel
-> choose opponent
-> choose Duel question source
-> Manual or Duel Roulette
-> establish ONE shared question
-> challenger selects timer
-> challenger answers
-> opponent answers the SAME question
-> resolve winner
-> Continue / win check
```

Current subjective/manual/team/app text Duel questions use `GROUP_VOTE`.

Group-vote rules:

- Candidates: challenger and opponent only.
- Eligible voters: every session player except challenger and opponent.
- Participants cannot vote on their own Duel.
- Each eligible voter votes once.
- Unique top vote wins.
- Tie = no Duel winner.
- No eligible submitted votes = no winner.
- Two-player Duel therefore resolves with no Duel winner and must not hang.

Duel cannot be Noped.

Human voter identity is derived from the actual local human player. Bot/internal votes can pass explicit voter identity only through the internal non-human path.

Bot-vote lifecycle is accepted in the browser: entering `duel-vote` wakes the existing bot social resolver, mixed human/bot voter groups wait only for eligible humans, all-bot eligible voter groups complete, and two-player no-voter Duels resolve without a frozen voting screen.

Objective automatic judging remains future work and must require structured objective evaluation metadata. Do not infer Roulette = automatic judging and do not use AI free-text judging as a substitute.

## Machiavelli — LOCKED PRODUCT RULE

Machiavelli is not free-text rule authoring.

Private chooser contains exactly six server-enforced options:

1. Convert the Weak
2. Taboo for All
3. No Mercy
4. Paranoia Spreads
5. Double the Pressure
6. Reverse Confession

Effects:

- Convert the Weak: convert all Skip cards in hands, draw pile, and discard into Draw +2 cards.
- Taboo for All: add one generated Taboo to each player's hand.
- No Mercy: permanently remove all Nope cards from hands, draw pile, and discard.
- Paranoia Spreads: add one generated DIG ME / Paranoia-family card to each player's hand; exact family-selection semantics remain to be locked if still unspecified.
- Double the Pressure: duplicate every remaining Truth and Dare currently in the draw pile and shuffle the duplicates into that draw pile.
- Reverse Confession: add one generated Reverse Confession to each player's hand.

Machiavelli is one-use and moves to Exhausted after resolution.

## CHAOS Pulse adaptive distribution — SOURCE IMPLEMENTED / BROWSER TRIAL PENDING

The product rule is locked in `Game_rules.md` and detailed in `docs/adaptive-card-distribution-rule.md`.

Canonical pipeline:

```text
ADAPTIVE WEIGHTS
-> PRIMARY CHAOS VARIANCE
-> ADAPTIVE REBALANCER
-> SECONDARY CHAOS VARIANCE
-> HARD SAFETY GUARD
-> NORMALIZE
-> SELECT ONE REAL PHYSICAL CARD
```

### Shared-engine source now implemented

- `packages/contracts/src/index.ts` carries authoritative adaptive probability state.
- `packages/game-engine/src/adaptive-distribution.ts` owns one shared implementation of opening dealing, family classification, freshness, interaction pressure, two-stage variance, category rebalancing, and real physical-card selection.
- `packages/game-engine/src/setup.ts` deals adaptive 7-card opening hands with exactly 1–2 high-impact/special cards per player and reserves the existing deterministic starter-card strategy without consuming the starter during the adaptive deal.
- `packages/game-engine/src/deck.ts` routes authoritative `drawCards()` through the adaptive selector.
- `packages/game-engine/src/index.ts` exports the shared helpers; no second adaptive algorithm is allowed in the UI or compatibility runtime.

### Current source tuning candidates

These are trial values, not production-final constants:

- family freshness: `0.55 -> 0.66 -> 0.77 -> 0.86 -> 0.94 -> 1.0`
- interaction after interaction: `pressure x 0.62`, bounded to `0.55..1.9`
- quiet/non-interaction draw: `pressure x 1.08 + 0.02`, same bounds
- primary CHAOS variance: `0.85..1.15`
- secondary CHAOS jitter: `0.97..1.03`
- one-copy rare tier currently receives a mild `0.9` trial multiplier after physical availability

These constants must be tuned from browser experience and larger simulations rather than treated as permanent product rules.

### Deterministic tests

`packages/game-engine/test/adaptive-distribution.test.ts` covers:

- 2–10 player opening deals;
- every opening hand exactly 7 cards;
- every opening hand exactly 1–2 high-impact specials;
- all 133 physical IDs conserved and unique;
- same seed replay determinism;
- different-seed opening variety;
- 6/3/1-copy physical weighting;
- freshness suppression without hard bans;
- primary variance;
- category rebalancing;
- secondary jitter;
- zero-availability protection;
- real-card removal;
- sequential multi-card recalculation;
- interaction-pressure rise/reset.

CI for shared-engine source commit `c18b431e24d7bac53fba1c627d404fea770b59b4` is **GREEN**: typecheck, Web build, Telegram build, API build, and tests pass.

### Web trial surface

The Web lobby now mounts a **Try CHAOS Pulse** panel using the real shared engine directly.

Files:

- `apps/web/src/chaos-pulse-lab.ts`
- `apps/web/src/chaos-pulse-lab.css`
- `apps/web/src/main.ts`

The panel lets us:

- choose 2–10 players;
- create a fresh-seeded random match;
- inspect each opening hand and its special/interaction count;
- generate 12 sequential adaptive physical draws;
- observe global interaction pressure before and after each draw;
- reroll repeatedly to judge whether hands/pacing feel repetitive or appropriately chaotic.

Status: **SOURCE BUILDS — manual browser trial still required.**

### Compatibility-runtime migration boundary

The main visible gameplay board still boots with:

```text
runtimeMode: legacy-compatibility
```

That legacy runtime still owns an obsolete local deck/deal/draw implementation. Do **not** copy CHAOS Pulse into it as a second algorithm.

The next convergence step is to bridge/remove the legacy deck/deal/draw seam so the main board consumes the shared authoritative CHAOS Pulse engine. Until that migration is browser-verified, the lobby trial panel is the correct place to evaluate the new distribution itself.

## Locked game-feel rule — opening hand is free, later interaction draws auto-play

Cribbit CHAOS should become more active and less passive whenever the deck produces a social/player-interaction card after play has begun.

### Opening-hand exception

Interaction cards dealt as part of the player's **initial starting hand** are normal hand cards. They remain in hand and may be voluntarily played later whenever normal play legality allows.

They do **not** auto-trigger merely because they were part of the opening deal.

### Post-start draw rule

After the initial deal is complete, any immediate-interaction card drawn from the authoritative draw source must auto-play immediately and cannot be stored for later voluntary play.

Immediate interaction families:

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

Hand-resident families:

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

### Chained draw behavior

If a draw effect yields several immediate interactions, they resolve FIFO in physical selection order, with no overlapping social flows.

## Active gameplay slice — convergence of adaptive draw + interaction-on-draw

The shared engine now owns adaptive physical-card selection. The remaining gameplay integration is to connect selected post-start interaction cards to the one authoritative forced-interaction dispatcher/queue and migrate the current Web compatibility board away from its duplicate local deck seam.

Architecture requirement:

```text
INITIAL DEAL
-> shared adaptive dealer
-> opening interactions remain in hand

POST-START AUTHORITATIVE DRAW
-> shared CHAOS Pulse selects one real physical card
-> hand-resident family: add/keep in hand
-> immediate-interaction family: commit/enqueue immediate play
-> resolve queued interactions FIFO
-> resume original effect/turn only when queue is empty
```

Implementation requirements:

- one central family classification and adaptive selector only;
- one forced-interaction queue only;
- no copy of CHAOS Pulse in `legacy-runtime`;
- migrate/bridge the legacy board to shared deck/deal/draw authority;
- initial deal explicitly bypasses auto-play;
- applies to normal draws and every penalty/effect draw path;
- real physical card identity remains authoritative;
- replay/idempotency cannot select or trigger the same card twice;
- bots use the same shared path;
- turn advancement and win checks wait for queued interactions.

### First dispatcher verification set

Begin with already-accepted family flows:

1. Truth
2. Dare
3. Paranoia
4. Duel

Then connect remaining families as their shared authoritative flows are completed/verified.

## Remaining special-card mechanics after interaction-on-draw foundation

Complete and verify the still-incomplete families using one authoritative implementation per mechanic:

- Chaos deterministic effect catalogue
- TAG
- Truth or Chaos
- Hijack
- Taboo
- Machiavelli six-option implementation
- Reverse Confession
- DIG ME
- Ghost lifecycle / delayed-resolution behavior
- final Nope eligibility matrix for any non-Duel effects

## Cleanup / convergence after mechanics are stable

- remove the obsolete legacy local deck authority once the board consumes shared CHAOS Pulse;
- make every visible gameplay button map to one implemented command;
- remove duplicate command aliases and stale variants;
- derive enabled/disabled controls from authoritative legal state;
- remove client-local rule implementations made obsolete by shared ownership;
- add deterministic complete-turn tests for every family;
- verify reconnect/timeout behavior against authoritative state;
- keep Telegram synchronized at the contract/state level without diverting from Web-first stabilization.

## Validation rules

For source changes, run where available:

```text
git diff --check
npm run typecheck
npm run build:web
npm test
```

Known asset failures must be kept separate from gameplay regressions.

Runtime-affecting work is not accepted until manually verified in the browser/live Web app.

## Staging/auth work — separate track

Do not silently mark these complete while working on gameplay:

- live Web smoke proof
- Telegram raw-`initData` live proof
- browser Telegram OIDC live proof
- same Telegram human -> same internal UUID across both clients
- shared profile write/read proof through Railway PostgreSQL

## Current Next Task

**Browser-test the new `Try CHAOS Pulse` shared-engine trial surface, then migrate the legacy Web board's deck/deal/draw seam to the shared adaptive engine without duplicating CHAOS Pulse.**

1. Pull the branch and run Web locally.
2. Use `Try CHAOS Pulse` for 2, 5, and 10 players; reroll several matches and inspect opening-hand variety and adaptive draw pressure.
3. Tune only if the observed distribution feels too calm, too repetitive, or too interaction-heavy.
4. Audit the exact compatibility-runtime deck/deal/draw boundary.
5. Bridge that seam to the shared canonical 133-card/dealer/draw authority.
6. Connect post-start selected interaction cards to the existing forced family flows through one FIFO dispatcher.
7. Browser-verify the actual game board before marking CHAOS Pulse gameplay accepted.

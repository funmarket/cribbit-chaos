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

## Implemented but still requiring browser acceptance

### Truth / Dare prompt source

Implemented flow:

```text
Play Truth/Dare
-> choose prompt source
-> Manual or Roulette
-> prompt established
-> preview/reveal/answer
```

Manual prompt validation: 10-280 characters. Manual prompts are one-off runtime prompts and are not automatically saved permanently.

### Truth / Dare Pass / Not for Me — LOCKED RULE

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

Source implementation and reducer tests exist. Manual Web verification is still required before the full Truth/Dare slice is marked accepted.

### Duel — SOURCE IMPLEMENTED, RUNTIME ACCEPTANCE PENDING

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

Bot-vote lifecycle source fix is implemented: entering `duel-vote` wakes the existing bot social resolver so eligible bot voters can submit their votes. Human voter identity is derived from the actual local human player; bot/internal votes can pass explicit voter identity only through the internal non-human path.

Objective automatic judging remains future work and must require structured objective evaluation metadata. Do not infer Roulette = automatic judging and do not use AI free-text judging as a substitute.

Required browser acceptance checks:

- human challenger + bot opponent + eligible bot voter -> bot vote resolves
- mixed human + bot eligible voters -> bots auto-vote; runtime waits only for eligible human
- all-bot eligible voters -> each votes once and resolves
- two-player Duel -> no-voter/no-winner resolution without frozen voting UI

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

## Next gameplay slice — forced-on-draw dispatcher

Do not start this until Truth/Dare and Duel browser acceptance is completed or a reproducible blocker is recorded.

One authoritative forced-draw dispatcher must decide whether a newly drawn card stays in hand or immediately enters its existing family flow.

Forced on draw:

- Truth
- Dare
- Paranoia
- Chaos
- Duel
- TAG
- Truth or Chaos
- Hijack
- Taboo
- Machiavelli
- Reverse Confession
- DIG ME

Not forced on draw:

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

Architecture requirement:

```text
DRAW_CARD
-> authoritative card draw
-> inspect drawn family
-> normal hand family: keep in hand
-> forced family: invoke existing authoritative family entry flow
```

Do not build a second Truth/Dare/Paranoia/Duel implementation for forced draws.

## Remaining special-card mechanics after forced-on-draw

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

- make every visible gameplay button map to one implemented command
- remove duplicate command aliases and stale variants
- derive enabled/disabled controls from authoritative legal state
- remove client-local rule implementations made obsolete by shared ownership
- add deterministic complete-turn tests for every family
- verify reconnect/timeout behavior against authoritative state
- keep Telegram synchronized at the contract/state level without diverting from Web-first stabilization

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

**Runtime acceptance checkpoint for the synchronized Truth/Dare and Duel source changes.**

1. Verify Truth Manual, Truth Roulette, Dare Manual, and Dare Roulette `Pass / Not for Me -> Draw 2` behavior in the Web app.
2. Verify last-card Truth/Dare pass cannot win.
3. Verify normal Truth/Dare completion draws no refusal penalty.
4. Verify Duel bot-voter lifecycle, mixed voters, all-bot voters, and two-player no-voter resolution.
5. Update `docs/LIVING_STATUS.md` immediately with pass/fail findings.
6. Once those checks pass, mark Truth/Dare and Duel accepted and begin the single authoritative forced-on-draw dispatcher.

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

## Locked game-feel rule — opening hand is free, later interaction draws auto-play

Cribbit CHAOS should become more active and less passive whenever the deck produces a social/player-interaction card after play has begun.

### Opening-hand exception

Interaction cards dealt as part of the player's **initial starting hand** are normal hand cards. They remain in hand and may be voluntarily played later whenever normal play legality allows.

They do **not** auto-trigger merely because they were part of the opening deal.

This opening-hand exception is important: players begin with strategic choice, but subsequent interaction draws create immediate table activity.

### Post-start draw rule

After the initial deal is complete, **any card whose primary purpose is immediate player-to-player, player-to-group, or group-wide interaction must auto-play as soon as it is drawn from the authoritative draw pile.** It cannot be stored for a later voluntary turn.

This applies to every post-start authoritative draw source, including:

- normal voluntary draw
- forced draw / Draw penalties
- Truth/Dare refusal Draw 2
- Paranoia penalties
- any future authoritative effect that explicitly draws from the draw pile

The source of the card therefore matters:

```text
INITIAL DEAL -> interaction card stays in hand -> player may play it later
POST-START DRAW -> interaction card auto-plays immediately
```

Cards granted or generated directly into a hand are not treated as draws unless the granting effect explicitly defines them as drawn. They follow the semantics of the granting effect.

### Immediate interaction families

Current canonical classification:

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

These families auto-trigger when drawn after the opening deal because they create an immediate social choice, target, challenge, confession, group effect, or rule-changing interaction.

### Non-immediate / hand-resident families

These stay in hand when drawn unless another rule explicitly consumes them:

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

Ghost remains the explicit exception because its canonical identity is a delayed/persistent threat rather than an immediate social-resolution card.

### Auto-play lifecycle for a drawn interaction card

A post-start drawn interaction card must use its real physical card identity and enter the same authoritative flow as if that card had been legally played from hand.

Conceptually:

```text
post-start draw interaction card
-> card is identified as immediate-interaction
-> card is committed to play immediately
-> existing family flow opens
-> card follows its normal discard/exhaust/persistent lifecycle
-> it does not remain available in hand for later play
```

No duplicate special copy of the card is created.

### Chained draw behavior

If resolving one effect draws multiple cards and one or more of those cards are immediate-interaction families, they must be queued and resolved **one at a time in draw order**.

Example:

```text
Truth refusal
-> Draw 2
-> first drawn card = Number -> stays in hand
-> second drawn card = Taboo -> queue Taboo interaction
-> finish the current Truth refusal resolution boundary
-> immediately enter queued Taboo flow
-> resolve Taboo
-> only then resume normal turn progression
```

If both drawn cards are interaction cards, the first drawn interaction resolves first, then the second. No overlapping modals, no parallel social flows, and no interaction card silently left dormant because another flow was already active.

## Active gameplay slice — authoritative post-start interaction-on-draw dispatcher

One authoritative draw dispatcher/queue must distinguish initial dealing from later draws and decide whether each post-start drawn physical card stays in hand or immediately enters its existing family flow.

Architecture requirement:

```text
INITIAL DEAL
-> deal cards directly into starting hands
-> do NOT run interaction auto-play

POST-START AUTHORITATIVE DRAW
-> remove physical card from draw pile
-> inspect drawn family
-> hand-resident family: add/keep in hand
-> immediate-interaction family: commit/enqueue immediate play
-> resolve queued interactions sequentially
-> after queue is empty, continue the original turn/effect boundary
```

Do not build a second Truth/Dare/Paranoia/Duel implementation for drawn cards.

### Implementation requirements

- one central classification source and one dispatcher/queue only
- initial deal is explicitly distinguishable from post-start draws
- opening-hand interaction cards never auto-trigger during setup
- family classification is explicit and testable
- applies to every post-start authoritative draw path, not only the visible Draw button
- drawn physical card identity remains authoritative
- no fake replacement card is created
- post-start drawn interaction card cannot become a dormant later-play card
- forced interaction uses the same family flow as normal voluntary play wherever that flow exists
- unresolved interactions block normal play/draw
- queued interactions resolve FIFO in draw order
- final win checks and turn advancement happen only after the originating effect and forced-interaction queue are complete
- command replay/idempotency must not trigger the same drawn interaction twice
- bots traverse the same queue and family flows
- no UI-only forced resolution state
- direct-to-hand generated/granted cards follow their granting effect and are not silently reclassified as draws

### First implementation/verification set

Start with families whose normal flows are already accepted:

1. Truth
2. Dare
3. Paranoia
4. Duel

Then connect Taboo, Reverse Confession, TAG, Truth or Chaos, Hijack, DIG ME, Chaos, and Machiavelli as each authoritative family flow is completed or confirmed reusable.

Tests must include at minimum:

- opening deal contains interaction card -> it stays in starting hand and does not auto-trigger
- player later voluntarily plays that opening-hand interaction card -> normal family flow
- normal post-start draw -> interaction auto-triggers
- penalty Draw 2 -> interaction card auto-triggers
- two interaction cards drawn together -> FIFO sequential resolution
- normal/basic card drawn -> remains in hand
- command replay -> no duplicate forced interaction
- bot draw -> same forced path
- original turn does not advance until forced queue empties
- win check cannot bypass unresolved queued interaction

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

**Implement the single authoritative post-start interaction-on-draw dispatcher/queue, beginning with the already-accepted Truth, Dare, Paranoia, and Duel family flows while explicitly exempting the opening deal.**

1. Audit initial-deal code separately from every post-start authoritative draw path in the shared reducer and legacy Web runtime.
2. Add one central immediate-interaction family classification.
3. Add one FIFO forced-interaction queue for post-start draws only.
4. Route post-start drawn Truth/Dare/Paranoia/Duel cards into their existing entry flows.
5. Ensure identical cards received in the initial deal remain normal voluntarily playable hand cards.
6. Preserve hand behavior for Number, Skip, Reverse, Draw, Wild, Nope, and Ghost.
7. Add deterministic tests for the opening-hand exemption, voluntary later play, post-start draw, penalty draws, multi-interaction draws, replay safety, bot traversal, turn ordering, and win ordering.
8. Validate source, then browser-test the Web runtime before marking interaction-on-draw accepted.

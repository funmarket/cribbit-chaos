# Cribbit CHAOS Living Status

Last verified source branch: `feature/visual-integration-checkpoint`

This file is the concise operational status companion to `PLAN.md`. It records what is accepted, what is currently being implemented, and what we do next.

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

Reverse Confession canonical assets are JPEG:

- `cards/reverse_confession/fIYGR_01.jpg`
- `cards/reverse_confession/fIYGR_02.jpg`
- `cards/reverse_confession/fIYGR_03.jpg`

Do not keep duplicate PNG/JPEG versions of the same canonical physical card.

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

Prompt source first, then target, then Classic/Stranger.

Classic:

- phase selection does not resolve
- initial target names answer player
- named answer player chooses Reveal / Keep Secret
- Continue runs the normal win boundary

Stranger:

- target answers
- eligible voters are everyone except target
- tie = no penalty
- strict `LYING` / `HOLDING_BACK` majority -> target Draw 2

Manual browser checks passed for Classic no-winner, Stranger no-winner, last-card Paranoia winner, and Truth/Dare Continue regression.

### Truth / Dare Manual + Roulette — ACCEPTED

```text
Play Truth/Dare
-> choose Manual or Roulette
-> establish prompt
-> preview/reveal/answer
```

Manual prompt validation remains 10-280 characters and Manual prompts are one-off runtime prompts.

Refusal behavior is accepted:

```text
Pass / Not for Me
-> exactly Draw 2
-> authoritative hand updates
-> social effect resolves
-> win/turn resolution occurs afterward
```

Browser acceptance confirmed:

- [x] Truth Manual -> Pass / Not for Me -> exactly Draw 2
- [x] Truth Roulette -> Pass / Not for Me -> exactly Draw 2
- [x] Dare Manual -> Pass / Not for Me -> exactly Draw 2
- [x] Dare Roulette -> Pass / Not for Me -> exactly Draw 2
- [x] normal Truth completion -> no refusal Draw 2
- [x] normal Dare completion -> no refusal Draw 2
- [x] last-card Truth pass -> no win
- [x] last-card Dare pass -> no win
- [x] Continue / turn resolution runs normally

### Duel — ACCEPTED

Canonical model:

```text
Play Duel
-> opponent
-> Manual or Duel Roulette
-> ONE shared Duel question
-> challenger-selected timer
-> challenger response
-> opponent response to same question
-> winner resolution
-> Continue / win check
```

Current subjective/manual/team/app text Duel prompts use `GROUP_VOTE`.

Group-vote authority:

- candidates = challenger and opponent only
- eligible voters = all session players except those two participants
- participants cannot vote
- each eligible voter votes once
- unique top wins
- tie = no winner
- no eligible submitted votes = no winner
- two-player Duel resolves no-winner and must not hang

Duel cannot be Noped.

Browser acceptance confirmed:

- [x] human challenger + bot opponent + eligible bot voter -> bot auto-votes and resolves
- [x] mixed human + bot eligible voters -> bot votes automatically; waits only for eligible human
- [x] all-bot eligible voters -> each votes once and resolves
- [x] two-player Duel -> no eligible voters -> no-winner resolution without frozen vote UI

Objective automatic judging remains future work and requires structured objective evaluation metadata.

## Machiavelli locked rule

Machiavelli opens a private six-option server-enforced chooser only:

1. Convert the Weak
2. Taboo for All
3. No Mercy
4. Paranoia Spreads
5. Double the Pressure
6. Reverse Confession

Effects are the canonical definitions recorded in `PLAN.md`. Machiavelli is one-use and moves to Exhausted after resolution.

## Locked game-feel rule — interaction cards fire on draw

Any card whose primary purpose is immediate social/player interaction must activate as soon as it is drawn from the authoritative draw pile. It must not sit dormant in hand waiting for a later voluntary play.

This rule applies to normal draws and penalty/forced draws, including Draw 2 penalties. Generated/direct-to-hand cards are not treated as draws unless their effect explicitly says they are drawn.

Current immediate-interaction families:

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

Current hand-resident / non-immediate families:

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

Ghost remains a delayed/persistent card and does not auto-resolve simply because it was drawn.

If a draw produces multiple interaction cards, they resolve one at a time in draw order. There must never be overlapping social flows or multiple active interaction modals.

Example:

```text
Truth refusal
-> Draw 2
-> Number stays in hand
-> Taboo is queued
-> Truth refusal finishes
-> queued Taboo starts immediately
-> Taboo resolves
-> only then may the original turn continue
```

## Active task — authoritative interaction-on-draw dispatcher/queue

One authoritative mechanism must handle **every draw source**:

```text
ANY AUTHORITATIVE DRAW
-> remove physical card from draw pile
-> inspect family
-> hand-resident card: keep/add to hand
-> interaction card: enqueue immediate family flow
-> resolve interaction queue FIFO
-> resume original effect/turn only when queue is empty
```

Implementation constraints:

- one central family classification
- one dispatcher/queue only
- no family-specific draw hacks
- no duplicate Truth/Dare/Paranoia/Duel flows
- physical drawn-card identity stays authoritative
- no fake replacement cards
- queued interactions resolve FIFO in draw order
- unresolved queue blocks normal play/draw
- original turn advancement and win check wait for the queue to empty
- replay/idempotency cannot fire the same drawn interaction twice
- bots use the same path
- generated/direct-to-hand cards do not auto-trigger unless explicitly defined as draws

First implementation set:

- Truth
- Dare
- Paranoia
- Duel

Then connect the remaining interaction families as their authoritative normal flows are completed/verified:

- Taboo
- Reverse Confession
- TAG
- Truth or Chaos
- Hijack
- DIG ME
- Chaos
- Machiavelli

Required tests include:

- voluntary draw of interaction card -> immediate flow
- penalty Draw 2 containing interaction card -> immediate flow
- two interaction cards in same draw -> sequential FIFO flows
- basic/tactical draw -> stays in hand
- replay safety -> no duplicate flow
- bot draw -> same behavior
- turn cannot advance until queue empties
- win check cannot bypass unresolved queued interaction

## Following mechanics work

After the interaction-on-draw foundation, complete and verify:

- Chaos deterministic effect catalogue
- TAG
- Truth or Chaos
- Hijack
- Taboo
- Machiavelli six-option runtime implementation
- Reverse Confession
- DIG ME
- Ghost lifecycle
- final Nope eligibility matrix for any future eligible effects

Then clean duplicate commands/client-local rule ownership, add complete-turn regression tests for every family, and tune pacing/UX only after mechanics are stable.

## Repository guardrails

Never commit temporary artifacts such as:

- `FIX.md`
- scratch files
- recovery notes
- generated diffs
- diagnostics
- debug logs
- temporary planning files

Runtime-affecting work is not accepted until browser/live-Web verification confirms it.

## Current next task

**Audit all authoritative draw paths in the shared reducer and legacy Web runtime, then implement the single FIFO interaction-on-draw dispatcher/queue beginning with Truth, Dare, Paranoia, and Duel.**

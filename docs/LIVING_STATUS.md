# Cribbit CHAOS Living Status

Last verified source branch: `feature/visual-integration-checkpoint`

This file is the concise operational status companion to `PLAN.md`. It records what is accepted, what is source-complete but still needs browser proof, and what we do next.

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

## Source-complete / browser acceptance pending

### Truth / Dare Manual + Roulette

Implemented source flow:

```text
Play Truth/Dare
-> choose Manual or Roulette
-> establish prompt
-> preview/reveal/answer
```

Manual prompt validation: 10-280 characters. Manual prompts are one-off runtime prompts, not automatically saved permanently.

### Truth / Dare refusal rule

Locked canonical rule:

```text
Pass / Not for Me
-> draw exactly 2 real cards
-> authoritative hand updates
-> effect resolves
-> win/turn resolution occurs afterward
```

Applies to Truth and Dare, Manual and Roulette.

Last-card ordering is locked: playing the last Truth/Dare and then passing cannot win because Draw 2 occurs first.

Automated source tests exist. Browser verification is still required before marking Truth/Dare accepted.

### Duel

Implemented source model:

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

Human vote identity is derived from the local human player. Internal/bot votes may use explicit voter identity only on the non-human path.

Bot-vote lifecycle source fix is present: entering Duel voting wakes the existing bot social resolver.

Browser verification is still required before marking Duel accepted.

## Machiavelli locked rule

Machiavelli opens a private six-option server-enforced chooser only:

1. Convert the Weak
2. Taboo for All
3. No Mercy
4. Paranoia Spreads
5. Double the Pressure
6. Reverse Confession

Effects are the canonical definitions recorded in `PLAN.md`. Machiavelli is one-use and moves to Exhausted after resolution.

## Current runtime acceptance checklist

Truth/Dare:

- [ ] Truth Manual -> Pass / Not for Me -> exactly Draw 2
- [ ] Truth Roulette -> Pass / Not for Me -> exactly Draw 2
- [ ] Dare Manual -> Pass / Not for Me -> exactly Draw 2
- [ ] Dare Roulette -> Pass / Not for Me -> exactly Draw 2
- [ ] normal Truth completion -> no refusal Draw 2
- [ ] normal Dare completion -> no refusal Draw 2
- [ ] last-card Truth pass -> no win
- [ ] last-card Dare pass -> no win
- [ ] Continue / turn resolution runs once

Duel:

- [ ] human challenger + bot opponent + eligible bot voter -> bot auto-votes and resolves
- [ ] mixed human + bot eligible voters -> bot votes automatically; waits only for eligible human
- [ ] all-bot eligible voters -> each votes once and resolves
- [ ] two-player Duel -> no eligible voters -> no-winner resolution without frozen vote UI

## Next implementation after acceptance

**Single authoritative forced-on-draw dispatcher.**

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

The dispatcher must reuse the existing authoritative family entry flows. Do not create duplicate family implementations for forced draws.

## Following mechanics work

After forced-on-draw, complete and verify the remaining special-card families:

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

**Perform the Truth/Dare + Duel runtime acceptance checklist against the Web app, record each result here immediately, then begin forced-on-draw only after the accepted paths are green or a reproducible blocker is documented.**

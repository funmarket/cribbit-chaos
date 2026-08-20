# Cribbit CHAOS — GameRules.md

> **Canonical local rule snapshot**
>
> This file records the gameplay rules recovered and approved in the current design conversation.
>
> **Important authority rule:** Do not rewrite these rules from current runtime behavior, old registry descriptions, incomplete code, or outdated documents. If the app behaves differently, the implementation must be fixed unless a gameplay rule is explicitly changed by the game owner.
>
> **Status convention**
>
> - **LOCKED** = explicitly decided and should be implemented as written.
> - **UNRESOLVED** = not fully decided; do not invent behavior.
> - Implementation status belongs in implementation/status documents, not in the gameplay rules.

---

# 1. Game Objective — LOCKED

Cribbit CHAOS is a social hand-shedding party card game.

The objective is:

> **Be the first player to legally empty your hand.**

A player does **not** win merely because their visible hand temporarily reaches zero.

A win is valid only after:

1. the final card was legally played;
2. the card's required effect has fully resolved;
3. all targets, answers, reactions, votes, reveals and decisions are complete;
4. all mandatory penalties and draws are complete;
5. all forced-on-draw interaction cards created by those draws have resolved;
6. the authoritative win check confirms that the player's hand is empty.

No card-specific victory, Duel result, vote result, confession or social result replaces the normal zero-card victory condition unless a future rule explicitly says so.

---

# 2. Canonical Physical Deck — CHAOS-133-V1 — LOCKED

Every normal game starts with exactly **133 physical card instances**.

| Card family | Count |
|---|---:|
| Number | 76 |
| Skip | 6 |
| Reverse | 6 |
| Draw | 6 |
| Wild | 3 |
| Truth | 3 |
| Dare | 3 |
| Paranoia | 3 |
| Chaos | 3 |
| Duel | 3 |
| Nope | 3 |
| TAG | 3 |
| Truth or Chaos | 3 |
| Hijack | 3 |
| Taboo | 3 |
| Machiavelli | 1 |
| Ghost | 1 |
| Reverse Confession | 3 |
| DIG ME | 1 |
| **TOTAL** | **133** |

The physical starting deck remains 133 cards even if an approved effect later generates runtime cards.

Generated runtime cards must have unique authoritative IDs.

No mechanic may create cards from nothing unless that mechanic is explicitly approved in these rules.

---

# 3. Starting Hand — LOCKED

Every player starts with exactly **7 physical cards**.

Every opening hand contains:

- minimum **1 high-impact/special card**;
- maximum **2 high-impact/special cards**.

The opening dealer must not use the old QA/demo hand that intentionally loads a player with many special cards.

Opening hands use the real physical `CHAOS-133-V1` inventory.

Opening-hand interaction cards remain **dormant in the hand**.

They do **not** automatically trigger simply because they were dealt during setup.

---

# 4. CHAOS Pulse — Internal Draw/Deal System — LOCKED ARCHITECTURE

CHAOS Pulse is the internal dealing and post-start draw-selection mechanic of the normal Cribbit CHAOS game.

It is **not**:

- a separate mode;
- an optional game;
- a player toggle;
- a separate lab mechanic.

Allowed adaptive inputs include:

- real remaining physical-card counts;
- family freshness;
- global recent interaction density;
- lifecycle state;
- authoritative RNG state.

Forbidden adaptive inputs include:

- player identity;
- who is winning or losing;
- who has the fewest cards;
- skill/MMR/account history;
- a desire to punish or rescue a specific player.

Conceptual pipeline:

```text
PHYSICAL AVAILABILITY
+
FAMILY FRESHNESS
+
GLOBAL INTERACTION PRESSURE
+
LIFECYCLE / TIER STATE
↓
ADAPTIVE WEIGHTS
↓
PRIMARY CHAOS VARIANCE
↓
ADAPTIVE REBALANCER
↓
SECONDARY CHAOS VARIANCE
↓
HARD SAFETY
↓
NORMALIZE
↓
SELECT ONE REAL DRAWABLE PHYSICAL CARD
```

Base family availability concept:

```text
BaseAvailability(f) = 10 × remaining drawable physical copies of family f
```

Exact tuning constants are **UNRESOLVED** and must be playtested without changing the fairness rules above.

---

# 5. Opening Deal vs Post-Start Draws — LOCKED

## 5.1 Opening deal

Immediate-interaction cards dealt into the initial seven-card hand do not trigger automatically.

They remain in hand until legally played.

## 5.2 Forced-on-draw families

After setup is complete, these card families immediately enter their card flow when physically drawn:

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

They cannot be saved in hand when physically drawn after game start.

## 5.3 Not forced-on-draw

These cards normally remain in hand when drawn:

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

## 5.4 Direct grants are not draws

Cards generated or transferred directly into a player's hand are not automatically treated as physical draws.

Therefore they do not auto-trigger unless the generating/transferring rule explicitly says otherwise.

## 5.5 Multiple forced interactions

If a player draws multiple cards and more than one is an immediate-interaction card:

```text
draw/select cards sequentially
→ ordinary cards stay in hand
→ immediate interactions enter FIFO queue
→ resolve first interaction completely
→ resolve next interaction
→ continue only after queue is empty
```

No overlapping social modals.

---

# 6. Normal Turn Structure — LOCKED

A normal turn follows this authority order:

1. current player makes one legal play/draw decision;
2. the selected card/effect starts;
3. required target/prompt/reaction/social flow resolves;
4. mandatory penalties resolve;
5. any forced-on-draw interactions resolve FIFO;
6. the played card enters its correct lifecycle zone;
7. authoritative win check runs;
8. if there is no winner, play advances/resumes.

A UI Continue button may not run duplicate win checks or duplicate turn advancement.

---

# 7. Number — LOCKED

A Number card is a normal hand-shedding card.

It may be legally played when it matches the active play condition by color or number/value.

```text
Play Number
→ no special effect
→ resolve turn
→ win check
→ advance
```

---

# 8. Skip — LOCKED

> **Skip the next eligible player.**

```text
Play SKIP
→ next eligible player loses that turn
→ rotation continues
```

---

# 9. Reverse — LOCKED

> **Reverse the current direction of play.**

```text
clockwise
→ REVERSE
→ counter-clockwise
```

In a two-player game, Reverse behaves as a turn-return effect.

---

# 10. Draw — PARTLY LOCKED

The approved core rule is:

> **Playing Draw ends the actor's action/turn and the next eligible player draws exactly 2 real cards.**

```text
Player A plays DRAW
→ A's action ends
→ next eligible Player B draws exactly 2 real cards
→ any forced-on-draw cards resolve FIFO
```

**UNRESOLVED:** It has not yet been explicitly locked whether Player B then takes their normal turn after the Draw 2 or whether the Draw card also removes that turn.

Do not silently add a Skip effect until this is explicitly decided.

---

# 11. Wild — LOCKED

> **Choose the active color.**

```text
Play WILD
→ choose active color
→ chosen color becomes authoritative
→ resolve turn
```

---

# 12. Prompt Architecture — LOCKED

Prompt-driven families reuse shared prompt infrastructure, but their ordering is family-specific.

Current locked ordering:

```text
TRUTH:
prompt source
→ prompt
→ answer

DARE:
target
→ prompt source
→ challenge
→ target response

PARANOIA:
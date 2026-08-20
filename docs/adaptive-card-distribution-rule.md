# Cribbit CHAOS — Adaptive Card Distribution Rule

> **Status:** Product rule specification for the authoritative card-distribution system.
>
> This document defines how Cribbit CHAOS deals opening hands and selects post-start draws without repeating fixed patterns, targeting individual players, or violating the physical `CHAOS-133-V1` inventory.
>
> `Game_rules.md` remains the consolidated living rulebook. This document is the detailed implementation authority for the adaptive-distribution mechanic.

---

## 1. Core design rule

Cribbit CHAOS uses **adaptive probability with bounded CHAOS variance**.

The system must feel unpredictable without becoming unfair or mathematically uncontrolled.

The important ordering is:

```text
PHYSICAL AVAILABILITY
        +
MATCH MEMORY / FRESHNESS
        +
INTERACTION PRESSURE
        +
TIER / LIFECYCLE STATE
        ↓
ADAPTIVE WEIGHTS
        ↓
CHAOS VARIANCE
        ↓
ADAPTIVE REBALANCER / GUARDRAILS
        ↓
NORMALIZED FINAL PROBABILITIES
        ↓
SELECT ONE REAL PHYSICAL CARD
```

**Adaptive weights are calculated before CHAOS variance.**

The variance is then allowed to disturb those weights so the next card cannot be predicted mechanically.

After variance, a final **Adaptive Rebalancer** checks the disturbed weights against the adaptive intent and physical rules. It corrects excessive distortion without removing the uncertainty that variance introduced.

This means CHAOS is allowed to bend the equation, but it is not allowed to take control of the equation.

---

## 2. Physical-card authority

Every normal match begins with the canonical 133 physical cards from `CHAOS-133-V1`.

Adaptive probability never creates, duplicates, deletes, resurrects, or replaces a physical card merely to obtain a desired probability result.

Every physical instance must exist in exactly one authoritative location:

- player hand;
- drawable pool;
- discard;
- exhausted;
- persistent/active area;
- permanently removed.

Machiavelli-generated runtime instances remain the explicitly approved exception and receive unique authoritative IDs.

If a family has zero drawable instances, its probability is always zero.

---

## 3. Rarity groups

Rarity and runtime behavior are separate properties.

### Number / baseline

- Number x76

### Common action — six-copy families

- Skip x6
- Reverse x6
- Draw x6

### Three-copy families

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
- Reverse Confession x3

### One-copy rare families

- Machiavelli x1
- Ghost x1
- DIG ME x1

Base availability is derived from the real number of drawable copies:

```text
6 drawable copies -> base weight 60
5 drawable copies -> base weight 50
4 drawable copies -> base weight 40
3 drawable copies -> base weight 30
2 drawable copies -> base weight 20
1 drawable copy   -> base weight 10
0 drawable copies -> base weight 0
```

These are weights, not literal percentages.

---

## 4. Behavior groups

### Immediate interaction on post-start draw

- Truth
- Dare
- Paranoia
- Chaos
- Duel
- TAG
- Truth or Chaos
- Hijack
- Taboo
- Reverse Confession
- Machiavelli
- DIG ME

Locked behavior:

```text
INITIAL DEAL
-> interaction card stays in hand
-> player may voluntarily play it later

POST-START DRAW
-> interaction card resolves immediately
-> it cannot remain dormant for later voluntary play
```

### Hand-resident / non-immediate draw families

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

Ghost remains the delayed/persistent exception.

---

## 5. Opening-hand rule

Each player starts with exactly seven physical cards.

Every opening hand must contain:

- **minimum 1 high-impact/special card**;
- **maximum 2 high-impact/special cards**.

The remaining slots are filled through the authoritative weighted opening dealer.

The dealer must not use one repeated template such as exactly `4 Number + 1 Action + 2 Special` for every player. Multiple legal hand shapes must remain possible.

The probability of receiving one versus two specials is itself adaptive to:

- player count;
- real remaining physical inventory;
- the requirement that every later player can still receive 1–2 specials;
- the desired health of the remaining drawable pool.

It must never depend on player identity, skill, score, winning position, or account history.

Every new production match receives a fresh authoritative server seed, so new matches do not repeat fixed opening hands.

---

## 6. Stage 1 — Adaptive Weights

Before random CHAOS variance is applied, the server calculates the intended adaptive weight for every eligible family `f`:

```text
AdaptiveWeight(f)
=
BaseAvailability(f)
x Freshness(f)
x InteractionPressure(f)
x TierLifecycle(f)
```

### BaseAvailability

```text
BaseAvailability(f) = 10 x drawablePhysicalCopies(f)
```

Physical scarcity therefore remains the first source of rarity.

### Freshness

When a family appears or resolves, its short-term freshness multiplier falls.

As unrelated game events occur, it recovers toward its natural value.

Example:

```text
Skip appears
-> Skip freshness falls

later unrelated draws/events
-> Skip freshness gradually recovers
```

A recent family becomes less likely, never automatically impossible.

### InteractionPressure

Immediate-interaction families share global pacing pressure.

```text
quiet/non-interaction draws
-> interaction pressure rises

interaction resolves
-> interaction pressure falls
```

This reduces extreme droughts and clusters without a fixed `2 per 8` pattern.

### TierLifecycle

This modifier represents approved lifecycle effects that change a family's legitimate availability or pacing.

Examples:

- exhausted one-use card with no drawable instance -> zero;
- reusable discard legitimately returned -> availability rises;
- Machiavelli conversion/removal/duplication/generation -> affected weights recalculate.

---

## 7. Stage 2 — CHAOS Variance

Only after the adaptive model has established its intended weights does the system add controlled randomness.

For every eligible family:

```text
NoisyWeight(f)
=
AdaptiveWeight(f)
x ChaosVariance(f)
```

`ChaosVariance(f)` is a server-seeded bounded random multiplier around `1.0`.

Initial simulation candidate:

```text
approximately 0.85 to 1.15
```

This range is not production-final.

Example:

```text
Truth adaptive weight = 24
variance = 1.11
noisy weight = 26.64

Skip adaptive weight = 35
variance = 0.88
noisy weight = 30.80
```

This is intentional. A lower adaptive-weight family can occasionally overtake a higher adaptive-weight family.

That prevents the adaptive system from becoming predictable.

---

## 8. Stage 3 — Adaptive Rebalancer

CHAOS variance is **not** the final authority.

After variance perturbs the adaptive weights, the server runs an Adaptive Rebalancer before final normalization.

The rebalancer is deliberately lighter than the main adaptive calculation. Its job is to correct excessive distortion while preserving the random surprise.

Conceptually:

```text
CorrectedWeight(f)
=
Rebalance(
  AdaptiveWeight(f),
  NoisyWeight(f),
  category totals,
  hard physical rules
)
```

### The rebalancer must preserve

- zero probability for unavailable families;
- physical-card integrity;
- opening-hand special bounds;
- lifecycle/exhaustion/removal rules;
- global interaction pacing established by InteractionPressure;
- broad rarity relationships established by physical availability.

### The rebalancer must NOT erase

- legitimate family-to-family variance;
- occasional back-to-back interactions;
- occasional repeated families;
- surprising rare appearances;
- legal quiet stretches.

### Recommended mathematical strategy

The adaptive model establishes **category probability mass** first.

Examples of categories may include:

- baseline Number;
- common actions;
- immediate interactions;
- retained tactical specials;
- one-copy rare tier.

CHAOS variance may redistribute weight **inside** those categories.

After variance, the rebalancer can renormalize family weights inside a category back toward that category's adaptive probability mass.

Example:

```text
Adaptive interaction category mass = 28%

CHAOS variance temporarily favors:
Truth up
Duel down
Taboo up
Paranoia down

Rebalancer:
-> preserves most of those internal family changes
-> keeps total interaction mass near the adaptive 28% target
```

This prevents random noise from accidentally turning a carefully calculated interaction probability into an uncontrolled 45% interaction spike.

A small bounded category-level deviation may later be allowed if simulation shows it improves game feel, but it must itself have hard limits.

---

## 9. Final probability

After rebalancing:

```text
P(f)
=
CorrectedWeight(f)
/
sum(CorrectedWeight(all eligible families))
```

The server then selects exactly one eligible family from that probability distribution and then selects one real drawable physical instance from that family.

The selected physical instance is removed from the drawable pool before any subsequent physical draw is calculated.

---

## 10. Event-driven adaptation

The equation changes after authoritative match events.

### Opening deal

A physical card entering a starting hand leaves drawable availability immediately.

### Post-start draw

After a physical card is selected:

- drawable availability changes;
- family freshness changes;
- interaction pressure changes where appropriate;
- the next draw uses the new adaptive state.

### Card played from hand

A played card is not removed from the drawable pool a second time. It already left that pool when it was dealt/drawn.

Its appearance/resolution can still update family freshness and match memory.

### Recycle

Reusable cards legitimately returned from discard increase drawable availability again.

### Exhaust/permanent removal

Unavailable cards cannot be drawn.

### Machiavelli

Any approved Machiavelli deck mutation immediately triggers a complete affected-weight recalculation.

---

## 11. Multi-card draws

Multi-card draws are selected sequentially.

```text
Draw 2
-> calculate/select card 1
-> update physical + adaptive state
-> calculate/select card 2 from the NEW state
```

If interaction cards are selected, they enter the existing forced-interaction FIFO queue according to physical selection order.

Probability logic never replaces family-resolution logic.

---

## 12. Shared-match fairness

Allowed inputs:

- remaining physical family counts;
- recent global card-family history;
- recent interaction density;
- approved lifecycle state;
- authoritative server RNG state.

Forbidden inputs:

- identity of the player about to draw;
- who is winning;
- who is losing;
- who has fewer cards;
- player skill/MMR;
- account history;
- desire to punish or rescue a player.

The system changes the **shared probability environment**, never an individual player's personal odds.

---

## 13. CHAOS Meter

The app may expose the global interaction-pressure state through a non-exact meter:

```text
CALM
STIRRING
RISING
HOT
DANGER
```

The meter is a pressure signal, not a countdown and not a promise.

Even at `DANGER`, a normal card may still be selected.

Exact internal weights, variance rolls, corrected weights, and RNG results remain hidden until a draw is committed.

---

## 14. Deterministic replay

Every new match receives a fresh authoritative server seed.

The server must persist enough information to reproduce the same selection sequence from the same authoritative command/event stream.

Replay state includes at minimum:

- initial RNG seed/state;
- physical-card locations;
- freshness state;
- interaction pressure;
- lifecycle modifiers;
- CHAOS variance RNG consumption;
- rebalancer configuration;
- generated-card events.

```text
same seed + same authoritative events
-> same result

new match
-> new seed
-> different evolution
```

---

## 15. Tuning constants remain simulation-controlled

The rule locks the **order and architecture**:

```text
Adaptive Weights
-> CHAOS Variance
-> Adaptive Rebalancer
-> Normalize
-> Draw
```

The following numeric values remain tunable until simulation/playtesting establishes production settings:

- opening 1-vs-2 special curve;
- freshness drop;
- freshness recovery;
- interaction-pressure rise/reset;
- rare-tier spacing strength;
- CHAOS variance range;
- rebalancer tolerance;
- category-level variance allowance;
- CHAOS Meter thresholds.

---

## 16. Required tests

Automated simulation/property tests must prove at minimum:

- every opening hand has exactly 7 physical cards;
- every opening hand has 1–2 specials;
- all physical instances are unique/accounted for;
- unavailable family probability is always zero;
- 6/3/1-copy base availability follows real remaining copies;
- AdaptiveWeight is calculated before variance;
- variance remains within configured bounds;
- the rebalancer prevents variance from breaking category/physical guardrails;
- the rebalancer does not collapse all variance back to the pre-variance weights;
- same seed + same authoritative events reproduces draws;
- different seeds produce varied matches;
- no player identity/game-position data enters the probability equation;
- multi-card draws recalculate sequentially;
- post-start interaction cards enter the existing FIFO interaction flow;
- opening-hand interaction cards remain dormant until voluntarily played;
- Machiavelli mutations trigger correct recalculation.

Large simulations must measure:

- family frequencies;
- interaction droughts;
- interaction clusters;
- repeat-family frequency;
- rare-event spacing;
- opening-hand variety;
- behavior from 2 through 10 players;
- late-game composition;
- predictability/pattern leakage.

---

## 17. Canonical summary

The Cribbit CHAOS distribution engine is:

```text
REAL PHYSICAL AVAILABILITY
        +
MATCH MEMORY
        +
GLOBAL INTERACTION PRESSURE
        +
LIFECYCLE STATE
        ↓
ADAPTIVE WEIGHTS
        ↓
BOUNDED CHAOS VARIANCE
        ↓
ADAPTIVE REBALANCER
        ↓
FINAL NORMALIZED PROBABILITY
        ↓
ONE REAL PHYSICAL CARD
        ↓
STATE CHANGES
        ↓
NEXT DRAW USES A NEW EQUATION
```

The adaptive system establishes the game's intended rhythm. CHAOS variance destabilizes it. The Adaptive Rebalancer keeps that instability inside fair, physical, game-safe boundaries.

That combination is intentionally unpredictable without becoming arbitrary or player-targeted.

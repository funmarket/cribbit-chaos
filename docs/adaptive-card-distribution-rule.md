# Cribbit CHAOS — Adaptive Card Distribution Rule

> **Status:** Product rule specification for the authoritative card-distribution system.
>
> This document defines how Cribbit CHAOS deals opening hands and selects post-start draws without repeating fixed patterns, targeting individual players, or violating the physical `CHAOS-133-V1` inventory.
>
> `Game_rules.md` remains the consolidated living rulebook. This document is the detailed implementation authority for the adaptive-distribution mechanic.

---

## 1. Core design rule

Cribbit CHAOS uses **adaptive probability with two bounded CHAOS-variance layers**.

The system must feel unpredictable without becoming unfair or mathematically uncontrolled.

The authoritative order is:

```text
PHYSICAL AVAILABILITY
        +
MATCH MEMORY / FRESHNESS
        +
INTERACTION PRESSURE
        +
TIER / LIFECYCLE STATE
        ↓
1. ADAPTIVE WEIGHTS
        ↓
2. PRIMARY CHAOS VARIANCE
        ↓
3. ADAPTIVE REBALANCER
        ↓
4. SECONDARY CHAOS VARIANCE / FINAL JITTER
        ↓
5. HARD SAFETY GUARD
        ↓
6. NORMALIZED FINAL PROBABILITIES
        ↓
SELECT ONE REAL PHYSICAL CARD
```

The first adaptive calculation establishes the intended match rhythm. Primary CHAOS variance disturbs it. The Adaptive Rebalancer prevents that disturbance from becoming excessive. A second, smaller CHAOS-variance pass then restores uncertainty that the rebalancer might otherwise smooth away.

The final hard-safety guard enforces only non-negotiable rules. It does **not** rebalance the probabilities again.

Therefore the final draw remains chaotic while still physically valid and globally fair.

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

## 7. Stage 2 — Primary CHAOS Variance

Only after the adaptive model has established its intended weights does the first random disturbance occur.

For every eligible family:

```text
PrimaryNoisyWeight(f)
=
AdaptiveWeight(f)
x PrimaryChaosVariance(f)
```

`PrimaryChaosVariance(f)` is a server-seeded bounded random multiplier around `1.0`.

Initial simulation candidate:

```text
approximately 0.85 to 1.15
```

This range is not production-final.

Example:

```text
Truth adaptive weight = 24
primary variance = 1.11
primary noisy weight = 26.64

Skip adaptive weight = 35
primary variance = 0.88
primary noisy weight = 30.80
```

A lower adaptive-weight family can therefore temporarily overtake a higher one.

That is intentional and prevents the adaptive system from becoming mechanically predictable.

---

## 8. Stage 3 — Adaptive Rebalancer

The primary CHAOS variance is not allowed to destroy the intended macro-balance.

The server therefore runs an Adaptive Rebalancer:

```text
RebalancedWeight(f)
=
Rebalance(
  AdaptiveWeight(f),
  PrimaryNoisyWeight(f),
  category totals,
  hard physical rules
)
```

The rebalancer is deliberately lighter than the main adaptive calculation. It corrects excessive distortion while preserving most legitimate family-to-family variation.

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

The adaptive model establishes broad **category probability mass** first.

Possible categories:

- baseline Number;
- common actions;
- immediate interactions;
- retained tactical specials;
- one-copy rare tier.

The primary CHAOS pass may distort both families and categories. The rebalancer pulls category totals back toward the adaptive target while preserving much of the family-level disturbance.

Example:

```text
Adaptive interaction category mass = 28%

Primary CHAOS temporarily pushes interactions = 41%

Rebalancer:
-> pulls total interaction mass back near the adaptive target
-> preserves internal changes such as Truth up, Duel down, Taboo up
```

The exact allowed category deviation is a simulation-controlled tuning value.

---

## 9. Stage 4 — Secondary CHAOS Variance / Final Jitter

The Adaptive Rebalancer can make the distribution too clean if its output becomes the final probability.

Therefore a **second, smaller CHAOS variance** is applied after rebalancing.

```text
FinalNoisyWeight(f)
=
RebalancedWeight(f)
x SecondaryChaosVariance(f)
```

The secondary variance is intentionally narrower than the primary variance.

Initial simulation candidate:

```text
Primary CHAOS variance:   approximately 0.85 to 1.15
Secondary CHAOS variance: approximately 0.97 to 1.03
```

These ranges are tuning values, not yet production-final.

### Why the second variance is smaller

The first CHAOS pass is allowed to significantly disturb the adaptive equation.

The rebalancer then repairs excessive distortion.

The second pass exists only to prevent the repaired result from becoming too exact or predictable.

If the second variance were as large as the first, it could simply recreate the imbalance the rebalancer was added to solve.

### Preferred implementation — within-category final jitter

By default, the secondary CHAOS variance should operate **inside the rebalanced category mass**.

Example:

```text
Rebalanced immediate-interaction mass = 29%

Secondary CHAOS jitter changes:
Truth        up slightly
Duel         down slightly
Taboo        up slightly
Paranoia     down slightly

Total immediate-interaction mass remains approximately 29%
```

This gives us an important property:

> The rebalancer protects the broad rhythm, while the final CHAOS pass protects surprise about the exact family.

A very small category-level final jitter may be tested later, but it must have a separate hard bound.

---

## 10. Stage 5 — Hard Safety Guard

Nothing after the second CHAOS pass should rebalance the game again, because doing so would erase the final uncertainty.

The last pass is therefore only a **hard safety guard**.

It may enforce only non-negotiable conditions such as:

- family with zero drawable cards -> weight 0;
- exhausted/permanently removed card -> unavailable;
- no duplicate physical instances;
- opening-hand 1–2 special invariant;
- explicit card/lifecycle exclusions;
- finite/non-negative weights;
- valid normalized probability total.

The hard guard must **not** say:

```text
"Truth is now a little too likely, reduce it."
```

That is the rebalancer's job and already happened before the secondary CHAOS pass.

---

## 11. Final probability

After the hard safety guard:

```text
P(f)
=
SafeFinalWeight(f)
/
sum(SafeFinalWeight(all eligible families))
```

The server selects exactly one eligible family and then one real drawable physical instance from that family.

The selected physical instance leaves the drawable pool before any subsequent physical draw is calculated.

---

## 12. Event-driven adaptation

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

## 13. Multi-card draws

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

## 14. Shared-match fairness

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

## 15. CHAOS Meter

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

Exact adaptive weights, primary variance rolls, rebalanced weights, secondary variance rolls, and RNG results remain hidden until a draw is committed.

---

## 16. Deterministic replay

Every new match receives a fresh authoritative server seed.

The server must persist enough information to reproduce the same selection sequence from the same authoritative command/event stream.

Replay state includes at minimum:

- initial RNG seed/state;
- physical-card locations;
- freshness state;
- interaction pressure;
- lifecycle modifiers;
- primary CHAOS variance RNG consumption;
- rebalancer configuration;
- secondary CHAOS variance RNG consumption;
- generated-card events.

```text
same seed + same authoritative events
-> same result

new match
-> new seed
-> different evolution
```

---

## 17. Tuning constants remain simulation-controlled

The rule locks the **order and architecture**:

```text
Adaptive Weights
-> Primary CHAOS Variance
-> Adaptive Rebalancer
-> Secondary CHAOS Variance
-> Hard Safety Guard
-> Normalize
-> Draw
```

The following numeric values remain tunable until simulation/playtesting establishes production settings:

- opening 1-vs-2 special curve;
- freshness drop;
- freshness recovery;
- interaction-pressure rise/reset;
- rare-tier spacing strength;
- primary CHAOS variance range;
- rebalancer tolerance;
- allowed category-level deviation;
- secondary CHAOS variance range;
- whether secondary variance is strictly within-category or permits tiny bounded category jitter;
- CHAOS Meter thresholds.

---

## 18. Required tests

Automated simulation/property tests must prove at minimum:

- every opening hand has exactly 7 physical cards;
- every opening hand has 1–2 specials;
- all physical instances are unique/accounted for;
- unavailable family probability is always zero;
- 6/3/1-copy base availability follows real remaining copies;
- AdaptiveWeight is calculated before primary variance;
- primary variance remains inside its configured bounds;
- the rebalancer prevents primary variance from breaking macro/category guardrails;
- the rebalancer does not collapse all family-level variance back to pre-variance values;
- secondary variance occurs after rebalancing;
- secondary variance remains inside its smaller configured bounds;
- within-category secondary jitter preserves category mass within configured tolerance;
- the hard safety guard never performs a new soft rebalance;
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
- predictability/pattern leakage;
- how much entropy is restored by the secondary CHAOS pass;
- whether the secondary pass materially reintroduces macro imbalance.

---

## 19. Canonical summary

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
PRIMARY CHAOS VARIANCE
        ↓
ADAPTIVE REBALANCER
        ↓
SECONDARY CHAOS VARIANCE
        ↓
HARD SAFETY GUARD
        ↓
FINAL NORMALIZED PROBABILITY
        ↓
ONE REAL PHYSICAL CARD
        ↓
STATE CHANGES
        ↓
NEXT DRAW USES A NEW EQUATION
```

The adaptive system establishes the intended rhythm. Primary CHAOS destabilizes it. The rebalancer repairs excessive distortion. Secondary CHAOS makes the repaired result unpredictable again. The hard safety guard protects only non-negotiable physical and rule invariants.

That makes the deck intentionally unstable without making it arbitrary, scripted, or player-targeted.

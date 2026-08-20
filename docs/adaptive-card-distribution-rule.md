# Cribbit CHAOS — Adaptive Card Distribution Rule

> **Status:** Product rule specification for the authoritative card-distribution system.
>
> This document defines how Cribbit CHAOS should deal opening hands and select post-start draws without repeating fixed hand patterns, without targeting individual players, and without violating the physical CHAOS-133-V1 card inventory.
>
> `Game_rules.md` remains the consolidated living rulebook. This document is the detailed implementation authority for the adaptive distribution mechanic and must be kept synchronized with the consolidated rulebook when the mechanic is integrated.

---

## 1. Design goal

Cribbit CHAOS must feel random, fair, social, and unstable without feeling secretly rigged.

The distribution system must avoid two bad extremes:

- **pure uncontrolled randomness**, which can create boring droughts or exhausting clusters;
- **fixed scripted distribution**, which players can learn and predict.

The game therefore uses **adaptive probability**.

The probability of every drawable card family changes continuously during the match according to:

1. how many real physical copies remain drawable;
2. how recently that family has appeared or been played;
3. how much immediate-interaction activity has recently occurred;
4. family/tier lifecycle rules;
5. a bounded random CHAOS variance that prevents the equation from becoming mechanically predictable.

The system adapts to the **shared match state**, never to the identity or success of the player who is about to draw.

---

## 2. Canonical physical deck authority

Every normal game begins from the canonical `CHAOS-133-V1` physical deck.

No adaptive probability rule may create, duplicate, erase, or resurrect a physical starting-deck card.

At all times, every physical card instance must exist in exactly one authoritative location such as:

- a player's hand;
- the drawable pool;
- discard;
- exhausted;
- persistent/active area;
- permanently removed.

Machiavelli-generated runtime instances remain the explicitly approved exception and receive unique authoritative instance IDs.

If a family has zero drawable physical copies, its draw probability is exactly zero regardless of every other multiplier.

---

## 3. Card rarity groups

Rarity and gameplay behavior are separate properties.

### 3.1 Number / baseline pool

- Number x76

### 3.2 Common action families

Six copies per family:

- Skip x6
- Reverse x6
- Draw x6

These are common tactical actions.

### 3.3 Three-copy families

Three copies per family:

- Wild
- Truth
- Dare
- Paranoia
- Chaos
- Duel
- Nope
- TAG
- Truth or Chaos
- Hijack
- Taboo
- Reverse Confession

### 3.4 One-copy rare families

- Machiavelli x1
- Ghost x1
- DIG ME x1

The rarity system begins from real physical availability rather than an arbitrary fixed rarity percentage.

Conceptual base family weights therefore naturally look like:

```text
6 drawable copies -> base weight 60
5 drawable copies -> base weight 50
4 drawable copies -> base weight 40
3 drawable copies -> base weight 30
2 drawable copies -> base weight 20
1 drawable copy   -> base weight 10
0 drawable copies -> base weight 0
```

The scale `10 x remaining copies` is a weight scale, not a literal percentage.

Actual probabilities are produced only after all eligible family weights are normalized against one another.

---

## 4. Behavior groups

Rarity does not decide whether a card auto-plays.

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

These 32 physical starting-deck cards use the existing locked rule:

```text
INITIAL DEAL
-> interaction card remains in hand
-> player may voluntarily play it later

POST-START DRAW
-> interaction card activates immediately
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

## 5. New-match randomness and deterministic replay

Every new production match receives a fresh authoritative server-generated seed.

Therefore two new matches should not repeat the same opening hands or probability history merely because they use the same player count.

The seed and all adaptive probability state transitions must be recorded sufficiently for deterministic replay/debugging.

```text
same match seed + same authoritative commands
-> reproducible result

new match
-> new seed
-> new probability evolution
```

The UI must never generate or own the authoritative randomness.

---

## 6. Opening-hand rule

Each player starts with seven physical cards.

The production dealer must never use the old QA/demo hand that intentionally served many special families together.

### Hard opening-hand bounds

Every player must receive:

- **minimum 1 high-impact/special card**;
- **maximum 2 high-impact/special cards**.

The remainder of the seven-card hand is filled from eligible normal/common-action cards according to the authoritative weighted dealer.

A starting interaction card remains dormant in hand until voluntarily played; the post-start immediate-draw rule does not run during setup.

### Opening variety

The dealer must not use one fixed recipe such as exactly `4 Numbers + 1 Action + 2 Specials` for every player.

Different legal shapes must remain possible while preserving the 1–2 special bound.

Examples of acceptable variety include:

```text
Number, Number, Number, Number, Reverse, Truth, Nope

Number, Number, Number, Skip, Draw, Duel, Taboo

Number, Number, Number, Number, Number, Dare, Machiavelli
```

Subject to any later explicitly locked opening restriction on a specific family.

### Adaptive special-count choice

The probability of receiving one versus two opening specials is not a permanently fixed `60/40` or `70/30` constant.

It must be calculated from the real physical inventory still available during the deal so that:

- early hands cannot drain the special pool unfairly;
- later hands still satisfy the same 1–2 bound;
- remaining draw-pool composition stays healthy;
- every player is governed by the same rule.

The algorithm may consider player count and remaining pool composition but not player identity, skill, score, historical performance, or seat-specific favoritism.

---

## 7. CHAOS Pulse adaptive draw equation

For every eligible drawable family `f`, the authoritative server computes an effective weight:

```text
W(f) = BaseAvailability(f)
       x Freshness(f)
       x InteractionPressure(f)
       x TierLifecycle(f)
       x ChaosVariance(f)
```

Then:

```text
P(f) = W(f) / sum(W(all eligible families))
```

After a family is selected, one real remaining physical instance from that family is selected and removed from the drawable pool.

### 7.1 BaseAvailability

```text
BaseAvailability(f) = 10 x drawablePhysicalCopies(f)
```

Examples:

```text
Skip with 6 drawable copies        -> 60
Skip with 5 drawable copies        -> 50
Truth with 3 drawable copies       -> 30
Truth with 1 drawable copy         -> 10
Machiavelli with 1 drawable copy   -> 10
family with no drawable copies     -> 0
```

This preserves real physical rarity.

### 7.2 Freshness

Freshness reduces the short-term probability of a family that has just appeared or been resolved, then gradually returns that family toward its natural weight.

Conceptual behavior:

```text
family just appeared
-> freshness drops

subsequent unrelated draws/events
-> freshness recovers gradually

family not seen recently
-> freshness approaches 1.0
```

A recently seen card is **less likely**, not forbidden.

This prevents a rigid rotation while reducing repetitive patterns such as repeated Truth, repeated Skip, or repeated Duel sequences.

### 7.3 InteractionPressure

The twelve immediate-interaction families share a global pacing state.

Conceptual behavior:

```text
several non-interaction draws
-> interaction pressure rises gradually

interaction resolves
-> interaction pressure falls

more quiet draws
-> pressure rebuilds
```

This controls droughts and clustering without fixed `2 cards every 8 draws` blocks.

Interaction pressure is global to the match, not assigned to a player.

### 7.4 TierLifecycle

This modifier handles explicitly approved family/tier behavior that cannot be represented by physical availability alone.

Examples may include:

- stronger temporary spacing after an exceptionally disruptive rare event;
- permanent probability zero after a one-use card is exhausted and no drawable copy remains;
- immediate recalculation after Machiavelli converts, removes, duplicates, or generates approved cards.

Tier/lifecycle modifiers must never silently contradict a locked card rule.

---

## 8. CHAOS Variance — bounded room for error

The adaptive equation must intentionally contain a bounded random variance so that players cannot reverse-engineer the next draw from visible match history.

This is the game's controlled **room for error**.

It is not an implementation mistake and it is not permission to violate physical inventory or target players.

For every draw evaluation, eligible family weights receive a fresh server-seeded variance multiplier around their calculated adaptive value.

Conceptual model:

```text
ChaosVariance(f) = random bounded multiplier around 1.0
```

Initial simulation range to test:

```text
normal CHAOS variance: approximately 0.85 to 1.15
```

Example:

```text
Truth calculated weight before variance = 24
current variance multiplier = 1.11
final draw weight = 26.64

Skip calculated weight before variance = 35
current variance multiplier = 0.88
final draw weight = 30.8
```

The variance is regenerated from the authoritative server RNG and is included in deterministic replay state.

### Why variance exists

Without variance, sufficiently observant players could estimate:

- which family was recently suppressed;
- when interaction pressure has risen;
- when a family has recovered;
- and therefore approximate the next family too accurately.

Bounded variance creates deliberate uncertainty:

```text
high probability != guarantee
low probability  != impossible
```

unless physical availability or an explicit game rule makes a result impossible.

### Hard limits that variance cannot override

CHAOS variance may never:

- draw a family with zero drawable instances;
- clone a physical card;
- ignore permanent removal/exhaustion;
- break the opening-hand 1–2 special bound;
- bypass an immediate-interaction flow;
- target a specific player;
- change a card after the player has already been told what was drawn;
- rewrite an authoritative completed result.

### Soft chaos rather than hard patterns

The system should prefer **soft probability pressure** over rigid spacing rules.

Therefore:

- back-to-back interactions remain possible, just less likely after an interaction;
- the same family may repeat, just less likely while freshness is low;
- a quiet stretch remains possible, but interaction pressure increasingly resists extreme droughts;
- rare cards may appear surprisingly early, but their low physical availability keeps them scarce.

This intentional possibility of unusual outcomes is part of Cribbit CHAOS.

---

## 9. Event-driven probability updates

The adaptive state recalculates after authoritative events that change either physical availability or match memory.

Examples:

### Card enters a hand from opening deal

- remove that physical instance from drawable inventory;
- recalculate family base availability.

### Card is drawn post-start

- remove that physical instance from drawable inventory;
- recalculate family base availability;
- update family freshness;
- update interaction pressure if applicable;
- route the card according to immediate-interaction vs hand-resident behavior.

### Card is played from a player's hand

Playing the card does not remove it from the draw pool a second time because it left that pool when originally dealt/drawn.

However, its family appearance/resolution may update freshness and match-memory state.

### Reusable discard is recycled

When reusable physical cards legitimately return to drawable inventory, their available-copy counts rise again and their base availability is recalculated.

### Exhaust / permanent removal

When a card becomes exhausted or permanently removed, it cannot contribute to drawable availability unless a later explicit mechanic restores or generates an approved instance.

### Machiavelli

Approved Machiavelli effects may materially change pool composition.

The adaptive system must recalculate affected family counts immediately after the authoritative Machiavelli effect completes.

---

## 10. Shared-match fairness rule

The adaptive engine may react to:

- remaining physical family counts;
- recently drawn families;
- recently played/resolved families;
- recent global interaction density;
- explicitly approved lifecycle changes;
- the authoritative random seed/variance stream.

It may **not** react to:

- which player is about to draw;
- which player is winning;
- which player has the fewest cards;
- player skill/MMR;
- a desire to punish a specific player;
- a desire to rescue a losing player;
- player identity or account history.

Correct:

```text
Truth just resolved
-> Truth freshness falls globally
```

Incorrect:

```text
Player A is winning
-> increase Chaos probability for Player A
```

All players draw from the same shared adaptive match state.

---

## 11. Multi-card draws and forced-interaction queue

Every card in a multi-card draw is selected sequentially from the authoritative adaptive state.

After each physical card is selected, the physical pool and adaptive state update before selecting the next card.

Example:

```text
Draw 2 penalty

select physical card 1
-> Number
-> availability/pacing state updates

select physical card 2 using new state
-> Taboo
-> availability/pacing state updates

Number stays in hand
Taboo enters forced-interaction FIFO queue
```

If two immediate interactions are drawn, they resolve FIFO according to physical draw order.

The adaptive probability system must not overlap or replace the existing authoritative forced-interaction queue.

---

## 12. Player-facing CHAOS Meter

The application may expose the adaptive interaction pressure through a non-exact player-facing meter.

Recommended states:

```text
CALM
STIRRING
RISING
HOT
DANGER
```

The meter must represent **pressure/probability**, not a promise about the next card.

Even at `DANGER`, a normal card may still be selected.

The UI must never reveal internal exact family weights or the server RNG result before the physical draw is committed.

This allows strategic tension without making the next card deterministic.

---

## 13. Replay and audit requirements

The authoritative match state must contain enough information to reproduce card selection deterministically for debugging and dispute analysis.

At minimum the engine needs a deterministic record of:

- initial match seed or equivalent RNG state;
- physical card locations/availability;
- family freshness state;
- interaction pressure state;
- tier/lifecycle modifiers;
- authoritative sequence of commands/events;
- generated-card events;
- variance/RNG consumption order.

Replaying the same authoritative event stream must reproduce the same card selections.

---

## 14. Tuning constants are simulation-controlled

The product rule locks the **adaptive model**, not untested magic constants.

The following remain tuning parameters until simulation and runtime playtesting choose production values:

- exact one-vs-two opening-special distribution curve;
- freshness drop after a family appears;
- freshness recovery speed;
- interaction-pressure rise per quiet draw;
- interaction-pressure reset after an interaction;
- rare-tier temporary spacing strength;
- normal CHAOS variance range;
- any maximum/minimum soft multipliers;
- CHAOS Meter thresholds.

Initial candidate values may be simulated, but they must not be treated as canonical merely because they were convenient test numbers.

---

## 15. Required deterministic tests

Before production acceptance, automated simulation/property tests must prove at minimum:

- every opening hand contains exactly 7 physical cards;
- every opening hand contains 1–2 high-impact/special cards;
- no physical starting-deck instance exists in two places;
- all 133 physical starting instances are accounted for;
- zero-availability families have zero draw probability;
- 6-copy families begin with proportionally greater base availability than 3-copy and 1-copy families;
- removing a drawable copy reduces that family's base weight correctly;
- returning a reusable physical card restores availability correctly;
- recent family appearance suppresses but does not necessarily prohibit that family;
- freshness recovers according to the configured curve;
- quiet draws raise global interaction pressure;
- an interaction reduces global interaction pressure;
- CHAOS variance remains inside configured bounds;
- variance never enables an unavailable card;
- same seed + same authoritative commands reproduces the same draws;
- different match seeds produce meaningfully different opening hands/draw histories;
- no draw calculation contains player identity, score, hand advantage, or win position as an input;
- post-start immediate-interaction draws enter the forced-interaction queue;
- opening-hand interaction cards remain voluntarily playable instead of auto-triggering during setup;
- multi-card draws update adaptive state sequentially and preserve FIFO resolution;
- Machiavelli deck-changing effects cause correct probability-state recalculation.

Large-run simulations must also measure:

- family appearance frequency;
- interaction drought distribution;
- interaction cluster distribution;
- repeated-family frequency;
- rare-event spacing;
- opening-hand variety;
- 2 through 10 player behavior;
- late-game composition;
- whether any predictable periodic pattern emerges.

---

## 16. Canonical summary

Cribbit CHAOS uses an **adaptive physical-card probability system** rather than a fixed post-start draw order or fixed interaction windows.

```text
REAL PHYSICAL AVAILABILITY
        x
FAMILY FRESHNESS
        x
GLOBAL INTERACTION PRESSURE
        x
TIER / LIFECYCLE STATE
        x
BOUNDED CHAOS VARIANCE
        ↓
CURRENT FAMILY WEIGHTS
        ↓
NORMALIZE
        ↓
SELECT ONE REAL DRAWABLE CARD
        ↓
UPDATE MATCH STATE
```

The system is intentionally unpredictable but must always remain:

- physical-card accurate;
- server authoritative;
- deterministic for replay;
- globally fair;
- non-player-targeted;
- compatible with existing immediate-interaction and FIFO resolution rules.

The purpose of the adaptive model is not to decide who wins. Its purpose is to make every match develop its own evolving rhythm of probability while preserving fairness, scarcity, surprise, and the identity of Cribbit CHAOS.

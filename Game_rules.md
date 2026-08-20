# Cribbit CHAOS — Living Game Rules

> **Status:** Living canonical gameplay rulebook.
>
> This file must be updated whenever a gameplay rule is approved, changed, superseded, or clarified. `PLAN.md` tracks implementation work. `docs/LIVING_STATUS.md` tracks current progress and verification. **`Game_rules.md` defines what the game is supposed to do.**
>
> Runtime bugs do not redefine these rules. If the app behaves differently, the implementation must be fixed or the rule must be explicitly changed here.

---

## 1. Game identity

Cribbit CHAOS is a fast social hand-shedding card game built around classic color/value play plus disruptive social and interaction cards.

The core goal is simple:

**Be the first player to legally reach zero cards after every required effect, penalty, reaction, and social resolution has completed.**

Social interactions, Duel wins, votes, confessions, prompt answers, and special effects may create pressure or recap stats, but they do not replace the zero-card win condition unless a future rule explicitly says otherwise.

---

## 2. Authority and fairness

The authoritative game engine/server owns:

- the physical deck and card instance IDs;
- shuffle/deal/draw randomness;
- hands;
- drawable pool;
- discard pile;
- exhausted/permanently removed cards;
- adaptive probability state;
- current player and turn direction;
- legal plays;
- pending effects;
- reaction windows;
- social flows;
- penalties;
- timers/timeouts;
- win checks;
- generated runtime cards created by explicitly approved mechanics.

The UI only displays state and collects explicit player input. It must not invent outcomes, duplicate effects, or resolve authoritative rules locally.

The adaptive card system is allowed to react to **shared match history and remaining physical cards**, but it may never target a specific player because they are winning, losing, skilled, weak, or about to draw.

---

## 3. Canonical physical deck — CHAOS-133-V1

Every normal game starts from exactly **133 physical card instances**.

| Family | Count |
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
| **Total** | **133** |

### Physical deck vs runtime-created cards

The physical starting deck remains 133 cards.

Machiavelli may create approved runtime card instances after the game begins. Those generated cards can increase the active card count above 133 without changing the physical starting deck definition.

No other mechanic may create cards from nothing unless it is explicitly approved and documented here.

---

## 4. Card groupings

Rarity and runtime behavior are separate properties.

### 4.1 Number / baseline

- Number x76

### 4.2 Common action families

- Skip x6
- Reverse x6
- Draw x6

These are the three 6-copy tactical families.

### 4.3 Three-copy families

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

### 4.4 One-copy rare families

- Machiavelli x1
- Ghost x1
- DIG ME x1

### 4.5 Immediate interaction families

These families create an immediate social, targeting, confession, group, challenge, or rule-changing interaction when drawn after the opening deal:

- Truth x3
- Dare x3
- Paranoia x3
- Chaos x3
- Duel x3
- TAG x3
- Truth or Chaos x3
- Hijack x3
- Taboo x3
- Machiavelli x1
- Reverse Confession x3
- DIG ME x1

Total immediate-interaction physical cards: **32**.

### 4.6 Other special/tactical cards

- Nope x3 — reaction/defense card.
- Ghost x1 — delayed/persistent threat.
- Wild x3 — unrestricted classic color-change action.

If these are included with the immediate-interaction families as the broader **high-impact/special** category, the deck contains **39 special cards**.

---

## 5. Initial deal vs later draws

This distinction is a locked Cribbit CHAOS rule.

### 5.1 Opening-hand exception

Cards dealt during the **initial starting hand** do not auto-trigger merely because they are interaction cards.

An interaction card received in the opening hand stays in that player's hand and can be played later when legal.

```text
INITIAL DEAL
-> interaction card enters starting hand
-> no automatic interaction
-> player may voluntarily play it later
```

### 5.2 Post-start interaction draw rule

After the initial deal is complete, an immediate-interaction card drawn from the authoritative drawable pool must be played/resolved immediately.

It cannot be saved for a later turn.

```text
POST-START DRAW
-> select one real physical card from adaptive drawable pool
-> normal/tactical hand card -> keep in hand
-> immediate-interaction card -> auto-play / enter authoritative family flow immediately
```

This applies to post-start draws caused by:

- a normal Draw action;
- a Draw-card penalty;
- Truth/Dare refusal penalty;
- Paranoia penalty;
- any other approved mechanic that explicitly draws physical cards.

Cards generated or granted **directly into a hand** are not automatically treated as draws unless the generating mechanic explicitly says they are drawn.

### 5.3 Chained interaction draws

If one effect draws multiple cards and more than one drawn card is an immediate-interaction card, those interactions resolve one at a time in physical draw order.

```text
Draw multiple cards
-> select each physical card sequentially from current adaptive state
-> keep normal cards in hand
-> queue drawn interaction cards FIFO
-> resolve first interaction completely
-> resolve next interaction
-> continue only when queue is empty
```

No overlapping social modals, no parallel unresolved effects, and no silently storing a drawn interaction card for later.

### 5.4 Opening-hand balance — LOCKED FOUNDATION

Every player starts with exactly **7 physical cards**.

Every opening hand must contain:

- **minimum 1 high-impact/special card**;
- **maximum 2 high-impact/special cards**.

The dealer must not use a fixed recipe for every player and must not use the old QA/demo hand that intentionally served many specials together.

The probability of receiving 1 versus 2 specials is adaptive to the real remaining physical inventory and player count. It is not permanently hard-coded to one fixed percentage such as 60/40.

Opening-hand dealing must:

- operate on the real CHAOS-133-V1 physical instances;
- never duplicate or destroy cards;
- preserve the 1–2 special bound for every player;
- preserve rarity by real physical availability;
- keep opening-hand interaction cards dormant until voluntarily played;
- produce varied legal hand shapes across new matches;
- use a fresh authoritative server seed for each new match.

---

## 6. Adaptive card distribution — CHAOS Pulse

Cribbit CHAOS uses an **adaptive probability system** for authoritative card selection instead of a permanently fixed post-start deck order or a rigid `2 specials per N cards` pattern.

Detailed implementation authority lives in `docs/adaptive-card-distribution-rule.md`.

### 6.1 Family base availability

For each drawable family `f`:

```text
BaseAvailability(f) = 10 x drawablePhysicalCopies(f)
```

Examples:

```text
6 drawable copies -> weight 60
5 drawable copies -> weight 50
4 drawable copies -> weight 40
3 drawable copies -> weight 30
2 drawable copies -> weight 20
1 drawable copy   -> weight 10
0 drawable copies -> weight 0
```

These are **weights**, not literal probabilities.

Actual draw probability is normalized against all eligible drawable families.

### 6.2 Family freshness

When a family has just appeared or resolved, its short-term weight is reduced. Its weight gradually returns toward natural availability as unrelated draws/events occur.

This makes repetition less likely without making it impossible.

Example concept:

```text
Skip just appeared
-> Skip freshness decreases

subsequent unrelated draws
-> Skip freshness recovers
```

This applies globally to the shared match, not only to the player who played that card.

### 6.3 Interaction pressure

Immediate-interaction families share a global pacing multiplier.

```text
several quiet/non-interaction draws
-> interaction pressure rises

interaction resolves
-> interaction pressure falls
```

This reduces extreme droughts and extreme clustering without fixed windows or exact countdowns.

### 6.4 Tier/lifecycle state

Explicit lifecycle changes can modify availability/weight where required by a locked rule.

Examples:

- exhausted one-use cards cannot be selected again when no drawable instance remains;
- discard recycling can restore reusable physical cards to drawable availability;
- Machiavelli effects immediately recalculate affected physical/generated pools.

---

## 7. CHAOS Variance — bounded unpredictability

The adaptive equation intentionally includes a bounded random variance on every authoritative draw evaluation.

This is the game's controlled **room for error**.

It exists so that the same visible match history does not mechanically imply the same next card.

Conceptually:

```text
FinalWeight(f)
=
BaseAvailability(f)
x Freshness(f)
x InteractionPressure(f)
x TierLifecycle(f)
x ChaosVariance(f)
```

Then:

```text
P(f) = FinalWeight(f) / sum(FinalWeight(all eligible families))
```

Initial simulation target for normal CHAOS variance:

```text
approximately 0.85 to 1.15 around the calculated weight
```

That exact range is a tuning value and must be simulation-tested before production lock.

### 7.1 Meaning of CHAOS Variance

```text
high probability != guaranteed
low probability  != impossible
```

unless physical availability or an explicit game rule makes the result impossible.

Therefore:

- back-to-back interactions remain possible but less likely after an interaction;
- the same family may repeat but is temporarily suppressed by freshness;
- a quiet stretch remains possible but global interaction pressure increasingly resists extreme droughts;
- a rare card may appear surprisingly early, but its low physical availability keeps it rare.

### 7.2 Variance cannot break hard rules

CHAOS Variance may never:

- select a family with zero drawable physical instances;
- clone or erase a physical card;
- bypass exhaustion/permanent removal;
- violate the opening-hand 1–2 special bound;
- bypass immediate-interaction resolution;
- target a player because of their identity or game position;
- change an already committed draw result.

---

## 8. Shared-match fairness rule

Allowed adaptive inputs:

- remaining physical family counts;
- recently drawn/played/resolved families;
- recent global interaction density;
- explicitly approved lifecycle changes;
- server RNG/variance state.

Forbidden adaptive inputs:

- identity of the player about to draw;
- who is winning or losing;
- who has fewer cards;
- skill/MMR/account history;
- desire to punish or rescue a particular player.

The probability system controls the **shared match rhythm**, never the fate of a chosen player.

---

## 9. New-match variety and replay

Every production match uses a fresh authoritative server seed.

```text
same seed + same authoritative commands
-> reproducible match for debugging

new match
-> new seed
-> new opening hands
-> new probability evolution
```

The authoritative server stores enough RNG/adaptive state to reproduce draw decisions during replay/debugging.

---

## 10. CHAOS Meter

The UI may expose global interaction pressure through a non-exact meter:

```text
CALM
STIRRING
RISING
HOT
DANGER
```

The meter indicates changing risk, not an exact next-card promise.

Even at `DANGER`, a normal card may still be drawn.

The exact internal family weights and RNG result must remain hidden until the authoritative draw is committed.

---

## 11. Turn and play principles

A normal turn allows the current player to play a legal card or draw under the configured authoritative rules.

Core requirements:

- ownership is validated server-side;
- only the current player can make a normal turn play;
- unresolved effects block unrelated normal play;
- a card effect completes before normal turn progression resumes;
- win checks occur at the correct resolution boundary, not simply when the visible hand temporarily reaches zero.

---

## 12. Winning

The primary victory condition is:

**First player to legally empty their hand.**

However, a player cannot win while their final card still has an unresolved required effect.

Examples:

- Final Truth/Dare card is played, then the player chooses Pass -> Draw 2 occurs first -> the player no longer has zero cards -> no win.
- Final Paranoia card -> required Paranoia resolution completes -> then win check.
- Any queued forced interaction generated by a draw must resolve before the originating turn/effect can complete its final win/advance boundary.

One authoritative win check must occur at the proper completion boundary. A UI Continue button must not cause duplicate win checks or duplicate turn advancement.

---

## 13. Truth and Dare

Truth and Dare use the same prompt-source architecture.

### 13.1 Prompt source

```text
Play Truth or Dare
-> choose Manual or Roulette
-> establish one prompt
-> resolve prompt
```

Manual prompts:

- 10–280 characters;
- one-off for the current interaction;
- not automatically persisted to a permanent deck.

Roulette:

- the authoritative prompt is selected first;
- the wheel is visual presentation only;
- spinning does not decide or replace the selected prompt.

### 13.2 Pass / Not for Me

Locked rule:

**Passing/refusing a Truth or Dare causes that player to draw exactly 2 real cards before the effect resolves and before any win check.**

```text
Truth/Dare
-> Pass / Not for Me
-> draw exactly 2
-> process any immediate-interaction cards drawn under the post-start draw rule
-> finish the Truth/Dare resolution boundary
-> win check / turn continuation only after required interactions are clear
```

Normal successful completion of Truth/Dare does not apply the refusal Draw 2 penalty.

---

## 14. Paranoia

Paranoia first establishes the question, then selects an initial target, then branches to Classic or Stranger.

```text
Play Paranoia
-> Manual or Roulette
-> question established
-> select initial target
-> choose Classic or Stranger
```

### 14.1 Classic

```text
paranoia-choice
-> paranoia-phase
-> paranoia-classic-answer-player
-> paranoia-classic-decision
-> resolved
-> Continue / win check
```

Rules:

- the initial target chooses another player as the answer player;
- the answer player cannot be the initial target;
- the named answer player decides Reveal or Keep Secret;
- choosing Classic does not itself resolve the card;
- the initial target and named answer player remain distinct authoritative fields.

### 14.2 Stranger

```text
paranoia-choice
-> paranoia-phase
-> paranoia-target-answer
-> paranoia-stranger-vote
-> resolved
-> Continue / win check
```

Rules:

- the selected target answers first;
- eligible voters are everyone except the target;
- voters choose Believe or the combined Lying / Holding Back side;
- strict Lying / Holding Back majority -> target draws 2;
- tie -> no penalty;
- Believe majority -> no penalty.

Any cards drawn by the Stranger penalty follow the post-start interaction-draw rule.

---

## 15. Duel

Canonical Duel flow:

```text
Play Duel
-> choose opponent
-> choose Manual or Duel Roulette
-> establish ONE shared question
-> challenger chooses timer
-> challenger answers
-> opponent answers the SAME question
-> determine Duel result
-> resolve
-> Continue / win check
```

### 15.1 Current judging mode

Current manual/textual/app Duel questions are resolved by **GROUP_VOTE** unless structured objective evaluation data explicitly exists.

Do not use AI free-text judging as a substitute for objective authority.

### 15.2 Group vote

Candidates:

- challenger;
- opponent.

Eligible voters:

- every session player except the challenger and opponent.

Rules:

- Duel participants cannot vote on their own Duel;
- each eligible voter votes once;
- unique top vote wins the Duel;
- tie -> no Duel winner;
- zero eligible votes -> no Duel winner;
- two-player Duel therefore resolves with no Duel winner and must not hang.

Duel-result metadata does not replace the primary empty-hand victory condition.

### 15.3 Nope and Duel

**Duel is not Nope-eligible.**

---

## 16. Nope

Nope is a visible tactical reaction card held in the player's hand. It is not a safety control and is separate from Pass, Rewind, and Flag.

A permitted Nope reaction window must always have exactly one terminal outcome:

```text
Play Nope
OR
Allow effect
OR
reaction timeout
```

A reaction timeout is a deterministic decline/allow outcome. It must never leave the game frozen at zero seconds.

Current confirmed Nope behavior includes eligible Draw effects and the currently implemented targeted Chaos hand-swap contract. The final complete eligibility matrix for all future special cards remains to be locked here.

When Nope is used:

- the real Nope card is consumed from the reacting player's hand;
- it follows its canonical exhausted/discard lifecycle;
- the eligible effect is blocked according to that effect contract;
- the game must continue after resolution.

When Nope is declined or times out:

- the eligible effect resolves normally;
- the game must continue after resolution.

---

## 17. Chaos

Chaos is an immediate-interaction special family and auto-triggers when drawn after the opening deal.

The exact production deterministic Chaos effect catalogue is still being completed.

Implementation principle:

- one authoritative effect is selected;
- it resolves exactly once;
- any targeted reaction window follows the authoritative Nope eligibility rule;
- generated nested Truth/Dare or other social flows reuse their existing authoritative mechanics.

---

## 18. Taboo

Taboo is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current registry intent: choose one player and ask a question; the target answers YES or receives the defined draw consequence.

**Exact production flow/penalty details still require final implementation confirmation and must be updated here when locked.**

---

## 19. Reverse Confession

Reverse Confession is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current canonical card intent:

**Confess something about yourself. It can be real or made up — do not say which one it is.**

The exact group-response/resolution mechanics are still being completed and must be documented here once locked.

---

## 20. TAG

TAG is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current registry intent: attack + relocate rotation.

Exact production targeting and turn-relocation semantics remain to be completed and locked here.

---

## 21. Truth or Chaos

Truth or Chaos is an immediate-interaction family and auto-triggers when drawn after the opening deal.

The final family-specific choice/resolution contract is still being completed. It must reuse established prompt and social-flow infrastructure rather than create a duplicate system.

---

## 22. Hijack

Hijack is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current registry intent: sacrifice/redirect the current turn and relocate rotation.

Exact production semantics remain to be locked here.

---

## 23. DIG ME

DIG ME is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current canonical card intent:

**Choose a player. They must answer a question about you.**

Exact answer/prompt resolution semantics remain to be completed and documented here.

---

## 24. Ghost

Ghost does **not** auto-trigger merely because it is drawn.

It is the explicit delayed/persistent exception among the high-impact special cards.

Current identity: face-down delayed threat / timed interruption.

Final lifecycle and trigger timing remain to be completed and locked here.

---

## 25. Machiavelli

Machiavelli is a one-use rule-changing card.

It is **not free-text rule authoring**.

When resolved, the player privately chooses exactly one of six fixed server-enforced options:

1. Convert the Weak
2. Taboo for All
3. No Mercy
4. Paranoia Spreads
5. Double the Pressure
6. Reverse Confession

The server applies the selection immediately. The selected rule name and quote are then broadcast to the table.

### 25.1 Convert the Weak

Convert every Skip card currently in hands, drawable pool, and discard into Draw +2 cards.

### 25.2 Taboo for All

Add one newly generated Taboo card to each player's hand.

### 25.3 No Mercy

Permanently remove all Nope cards from hands, drawable pool, and discard.

### 25.4 Paranoia Spreads

Add one newly generated DIG ME / Paranoia-family card to each player's hand.

The exact family-selection semantics are still pending if not otherwise explicitly locked.

### 25.5 Double the Pressure

Duplicate every remaining Truth and Dare currently in the drawable pool and add the generated duplicates to authoritative drawable availability.

### 25.6 Reverse Confession

Add one newly generated Reverse Confession to each player's hand.

### 25.7 Lifecycle

Machiavelli is one-use and moves to Exhausted after its effect resolves.

Generated cards are backend-created runtime instances. They do not modify the definition of the physical 133-card starting deck.

---

## 26. Draw ordering and effect queues

All authoritative draw paths must preserve physical selection order.

If a multi-card penalty produces interaction cards:

1. each physical card is selected sequentially from the current adaptive state;
2. ordinary/tactical cards remain in the target's hand;
3. drawn immediate-interaction cards enter the forced-interaction queue;
4. interactions resolve FIFO;
5. the originating effect cannot fully finish/advance the turn until required queued interactions are resolved.

The queue must be authoritative, replay-safe, and shared by humans and bots.

---

## 27. Timeouts

Timeouts are gameplay outcomes, not dead ends.

Every timed state must define a deterministic server-side terminal action.

Examples:

- Nope timeout -> decline/allow the effect;
- Duel vote timeout -> resolve using submitted eligible votes or no winner under the locked voting rules;
- Paranoia timeout -> follow the branch-specific deterministic fallback;
- prompt/social timeout -> resolve to the documented safe continuation state.

A timer reaching zero must never leave an unresolved modal with no legal way to progress.

---

## 28. Safety and prompt controls

Pass / Not for Me, Rewind, and Flag are controls, not physical card families.

### Pass / Not for Me

A player may refuse eligible prompt interactions. Truth/Dare refusal carries the locked Draw 2 penalty.

### Rewind

Rewind is a private prompt-replacement control for eligible Roulette Truth/Dare flows before public reveal, subject to the current once-per-session contract.

### Flag

Flag reports/moderates a prompt. It does not automatically delete the prompt and is not a tactical veto like Nope.

---

## 29. Card lifecycle principles

Cards must follow their canonical lifecycle:

- reusable classic cards normally move through discard/recycle;
- one-use social/special cards may move to Exhausted after resolution where defined;
- persistent cards remain active until their own resolution condition;
- permanently removed cards do not return through discard recycling;
- generated runtime cards have unique authoritative instance IDs.

No UI action may silently clone, resurrect, discard, or destroy a physical card outside an approved rule.

---

## 30. Adaptive-distribution tuning still pending

The **adaptive model itself is locked**, but exact tuning constants are not yet production-final.

Simulation/playtesting must choose:

- exact one-vs-two opening-special distribution curve;
- freshness drop after a family appears;
- freshness recovery speed;
- interaction-pressure rise per quiet draw;
- interaction-pressure reset after an interaction;
- rare-tier spacing strength;
- exact CHAOS variance range;
- soft minimum/maximum multipliers;
- CHAOS Meter thresholds.

These values must be tuned without changing the fairness rule, physical-card integrity, or 1–2 opening-special bound.

Other unresolved family decisions remain:

- exact complete Chaos effect catalogue;
- final Taboo mechanics;
- final Reverse Confession mechanics;
- final TAG mechanics;
- final Truth or Chaos mechanics;
- final Hijack mechanics;
- final DIG ME mechanics;
- final Ghost lifecycle;
- final Nope eligibility matrix outside already locked exclusions/contracts;
- exact Machiavelli Paranoia Spreads generated-family semantics;
- any future structured objective Duel judging modes.

---

## 31. Rule-change protocol

Whenever a gameplay decision changes:

1. update **`Game_rules.md` first or in the same controlled change**;
2. update detailed rule docs such as `docs/adaptive-card-distribution-rule.md` where applicable;
3. update `PLAN.md` if implementation work changes;
4. update `docs/LIVING_STATUS.md` with implementation/verification state;
5. update rule-decision docs/contracts/tests as needed;
6. implement one authoritative rule path;
7. validate source;
8. browser-verify runtime behavior before marking the rule accepted.

If documentation conflicts:

- `Game_rules.md` is the consolidated product-rule reference;
- specific newer explicit rule decisions supersede older text until `Game_rules.md` is brought back into sync;
- runtime behavior is never automatically considered correct merely because it currently behaves that way.

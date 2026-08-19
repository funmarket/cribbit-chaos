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
- shuffle order;
- hands;
- draw pile;
- discard pile;
- exhausted/permanently removed cards;
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

### 4.1 Number cards

Number cards are normal color/value hand-management cards.

Count: **76**.

### 4.2 Classic tactical/action cards

- Skip x6
- Reverse x6
- Draw x6
- Wild x3

These affect turn flow, pressure, or active color but do not automatically become social interactions merely because they are drawn.

### 4.3 Immediate interaction families

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

### 4.4 Other special/tactical cards

- Nope x3 — reaction/defense card.
- Ghost x1 — delayed/persistent threat.
- Wild x3 — unrestricted classic color-change action.

If these are included with the immediate-interaction families as the broader **restricted/high-impact special** category, the deck contains **39 special cards**.

### 4.5 All non-number cards

All cards other than Number cards total **57**.

That count includes Skip, Reverse, Draw, Wild, every social/special family, Nope, and Ghost.

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

After the initial deal is complete, an immediate-interaction card drawn from the authoritative draw pile must be played/resolved immediately.

It cannot be saved for a later turn.

```text
POST-START DRAW
-> inspect card family
-> normal/tactical hand card -> keep in hand
-> immediate-interaction card -> auto-play / enter authoritative family flow immediately
```

This applies to post-start draws caused by:

- a normal Draw action;
- a Draw-card penalty;
- Truth/Dare refusal penalty;
- Paranoia penalty;
- any other approved mechanic that explicitly draws physical cards from the draw pile.

Cards generated or granted **directly into a hand** are not automatically treated as draws unless the generating mechanic explicitly says they are drawn.

### 5.3 Chained interaction draws

If one effect draws multiple cards and more than one drawn card is an immediate-interaction card, those interactions resolve one at a time in physical draw order.

```text
Draw multiple cards
-> keep normal cards in hand
-> queue drawn interaction cards FIFO
-> resolve first interaction completely
-> resolve next interaction
-> continue only when queue is empty
```

No overlapping social modals, no parallel unresolved effects, and no silently storing a drawn interaction card for later.

### 5.4 Opening-hand balance

**Pending final product decision.**

The normal game must not use the QA/demo hand that intentionally serves Truth, Dare, Paranoia, Chaos, Duel, Nope, and Wild.

The exact production opening-hand distribution rule — including how many special/high-impact cards may appear in an opening hand — is still being decided and must be added here before implementation is considered final.

Whatever rule is chosen must:

- operate on the real CHAOS-133-V1 physical instances;
- never duplicate or destroy cards;
- preserve one authoritative deck;
- apply only to the initial deal;
- leave post-start draws genuinely based on the shuffled remaining deck.

---

## 6. Turn and play principles

A normal turn allows the current player to play a legal card or draw under the configured authoritative rules.

Core requirements:

- ownership is validated server-side;
- only the current player can make a normal turn play;
- unresolved effects block unrelated normal play;
- a card effect completes before normal turn progression resumes;
- win checks occur at the correct resolution boundary, not simply when the visible hand temporarily reaches zero.

---

## 7. Winning

The primary victory condition is:

**First player to legally empty their hand.**

However, a player cannot win while their final card still has an unresolved required effect.

Examples:

- Final Truth/Dare card is played, then the player chooses Pass -> Draw 2 occurs first -> the player no longer has zero cards -> no win.
- Final Paranoia card -> required Paranoia resolution completes -> then win check.
- Any queued forced interaction generated by a draw must resolve before the originating turn/effect can complete its final win/advance boundary.

One authoritative win check must occur at the proper completion boundary. A UI Continue button must not cause duplicate win checks or duplicate turn advancement.

---

## 8. Truth and Dare

Truth and Dare use the same prompt-source architecture.

### 8.1 Prompt source

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

### 8.2 Pass / Not for Me

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

## 9. Paranoia

Paranoia first establishes the question, then selects an initial target, then branches to Classic or Stranger.

```text
Play Paranoia
-> Manual or Roulette
-> question established
-> select initial target
-> choose Classic or Stranger
```

### 9.1 Classic

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

### 9.2 Stranger

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

## 10. Duel

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

### 10.1 Current judging mode

Current manual/textual/app Duel questions are resolved by **GROUP_VOTE** unless structured objective evaluation data explicitly exists.

Do not use AI free-text judging as a substitute for objective authority.

### 10.2 Group vote

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

### 10.3 Nope and Duel

**Duel is not Nope-eligible.**

---

## 11. Nope

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

## 12. Chaos

Chaos is an immediate-interaction special family and auto-triggers when drawn after the opening deal.

The exact production deterministic Chaos effect catalogue is still being completed.

Implementation principle:

- one authoritative effect is selected;
- it resolves exactly once;
- any targeted reaction window follows the authoritative Nope eligibility rule;
- generated nested Truth/Dare or other social flows reuse their existing authoritative mechanics.

---

## 13. Taboo

Taboo is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current registry intent: choose one player and ask a question; the target answers YES or receives the defined draw consequence.

**Exact production flow/penalty details still require final implementation confirmation and must be updated here when locked.**

---

## 14. Reverse Confession

Reverse Confession is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current canonical card intent:

**Confess something about yourself. It can be real or made up — do not say which one it is.**

The exact group-response/resolution mechanics are still being completed and must be documented here once locked.

---

## 15. TAG

TAG is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current registry intent: attack + relocate rotation.

Exact production targeting and turn-relocation semantics remain to be completed and locked here.

---

## 16. Truth or Chaos

Truth or Chaos is an immediate-interaction family and auto-triggers when drawn after the opening deal.

The final family-specific choice/resolution contract is still being completed. It must reuse established prompt and social-flow infrastructure rather than create a duplicate system.

---

## 17. Hijack

Hijack is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current registry intent: sacrifice/redirect the current turn and relocate rotation.

Exact production semantics remain to be locked here.

---

## 18. DIG ME

DIG ME is an immediate-interaction family and auto-triggers when drawn after the opening deal.

Current canonical card intent:

**Choose a player. They must answer a question about you.**

Exact answer/prompt resolution semantics remain to be completed and documented here.

---

## 19. Ghost

Ghost does **not** auto-trigger merely because it is drawn.

It is the explicit delayed/persistent exception among the high-impact special cards.

Current identity: face-down delayed threat / timed interruption.

Final lifecycle and trigger timing remain to be completed and locked here.

---

## 20. Machiavelli

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

### 20.1 Convert the Weak

Convert every Skip card currently in hands, draw pile, and discard into Draw +2 cards.

### 20.2 Taboo for All

Add one newly generated Taboo card to each player's hand.

### 20.3 No Mercy

Permanently remove all Nope cards from hands, draw pile, and discard.

### 20.4 Paranoia Spreads

Add one newly generated DIG ME / Paranoia-family card to each player's hand.

The exact family-selection semantics are still pending if not otherwise explicitly locked.

### 20.5 Double the Pressure

Duplicate every remaining Truth and Dare currently in the draw pile and shuffle those duplicates into that draw pile.

### 20.6 Reverse Confession

Add one newly generated Reverse Confession to each player's hand.

### 20.7 Lifecycle

Machiavelli is one-use and moves to Exhausted after its effect resolves.

Generated cards are backend-created runtime instances. They do not modify the definition of the physical 133-card starting deck.

---

## 21. Draw ordering and effect queues

All authoritative draw paths must preserve physical draw order.

If a multi-card penalty produces interaction cards:

1. the cards are physically drawn from the deck;
2. ordinary/tactical cards remain in the target's hand;
3. drawn immediate-interaction cards enter the forced-interaction queue;
4. interactions resolve FIFO;
5. the originating effect cannot fully finish/advance the turn until required queued interactions are resolved.

The queue must be authoritative, replay-safe, and shared by humans and bots.

---

## 22. Timeouts

Timeouts are gameplay outcomes, not dead ends.

Every timed state must define a deterministic server-side terminal action.

Examples:

- Nope timeout -> decline/allow the effect;
- Duel vote timeout -> resolve using submitted eligible votes or no winner under the locked voting rules;
- Paranoia timeout -> follow the branch-specific deterministic fallback;
- prompt/social timeout -> resolve to the documented safe continuation state.

A timer reaching zero must never leave an unresolved modal with no legal way to progress.

---

## 23. Safety and prompt controls

Pass / Not for Me, Rewind, and Flag are controls, not physical card families.

### Pass / Not for Me

A player may refuse eligible prompt interactions. Truth/Dare refusal carries the locked Draw 2 penalty.

### Rewind

Rewind is a private prompt-replacement control for eligible Roulette Truth/Dare flows before public reveal, subject to the current once-per-session contract.

### Flag

Flag reports/moderates a prompt. It does not automatically delete the prompt and is not a tactical veto like Nope.

---

## 24. Card lifecycle principles

Cards must follow their canonical lifecycle:

- reusable classic cards normally move through discard/recycle;
- one-use social/special cards may move to Exhausted after resolution where defined;
- persistent cards remain active until their own resolution condition;
- permanently removed cards do not return through discard recycling;
- generated runtime cards have unique authoritative instance IDs.

No UI action may silently clone, resurrect, discard, or destroy a physical card outside an approved rule.

---

## 25. Current unresolved rule decisions

These are not permission for the implementation to improvise. They must be explicitly decided and then updated in this file.

- exact production opening-hand special-card distribution;
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

## 26. Rule-change protocol

Whenever a gameplay decision changes:

1. update **`Game_rules.md` first or in the same controlled change**;
2. update `PLAN.md` if implementation work changes;
3. update `docs/LIVING_STATUS.md` with implementation/verification state;
4. update rule-decision docs/contracts/tests as needed;
5. implement one authoritative rule path;
6. validate source;
7. browser-verify runtime behavior before marking the rule accepted.

If documentation conflicts:

- `Game_rules.md` is the consolidated product-rule reference;
- specific newer explicit rule decisions supersede older text until `Game_rules.md` is brought back into sync;
- runtime behavior is never automatically considered correct merely because it currently behaves that way.

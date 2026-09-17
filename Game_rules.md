# Canonical rule provenance and IDs

P0 documentary annotation only. The supplied rule wording below is preserved verbatim, including all LOCKED and UNRESOLVED distinctions. IDs identify source clauses; assigning an ID never approves an unresolved recommendation, example, or future rule.

Authority: explicit approved owner decisions, then this supplied canonical specification. The Foundation Report and existing runtimes are not rule authorities. No gameplay wording was changed. The source snapshot remains external to the old repository.

Source: `021a30d8-bad8-40d0-9289-26e765ba2e85.md`, SHA-256: **2fdbe99c64b6c4a910ea57c1887b0d2db9327d616feafe476bf0a41073f235c0**.

IDs are permanent once assigned: never regenerate/resequence them after an edit. Add new IDs for approved additions, retain retired IDs with supersession records, and keep exact source/version provenance. Tests cite clause IDs plus applicable approved decision IDs; not foundation prose. Mixed sections retain unresolved clauses explicitly.

A CI traceability gate must require rule IDs for every claimed LOCKED behavior/test, resolve IDs against the register, reject missing/retired/unresolved-only references for executable assertions, and require an explicit decision for changed wording. Examples are not independent rule authority.

<!-- BEGIN VERBATIM SOURCE WITH ID ANNOTATIONS -->
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

<!-- RULE-OBJECTIVE-001 | supplied source lines 19-19 -->
Cribbit CHAOS is a social hand-shedding party card game.

<!-- RULE-OBJECTIVE-002 | supplied source lines 21-21 -->
The objective is:

<!-- RULE-OBJECTIVE-003 | supplied source lines 23-23 -->
> **Be the first player to legally empty your hand.**

<!-- RULE-OBJECTIVE-004 | supplied source lines 25-25 -->
A player does **not** win merely because their visible hand temporarily reaches zero.

<!-- RULE-OBJECTIVE-005 | supplied source lines 27-27 -->
A win is valid only after:

<!-- RULE-OBJECTIVE-006 | supplied source lines 29-34 -->
1. the final card was legally played;
2. the card's required effect has fully resolved;
3. all targets, answers, reactions, votes, reveals and decisions are complete;
4. all mandatory penalties and draws are complete;
5. all forced-on-draw interaction cards created by those draws have resolved;
6. the authoritative win check confirms that the player's hand is empty.

<!-- RULE-OBJECTIVE-007 | supplied source lines 36-36 -->
No card-specific victory, Duel result, vote result, confession or social result replaces the normal zero-card victory condition unless a future rule explicitly says so.

---

# 2. Canonical Physical Deck — CHAOS-133-V1 — LOCKED

<!-- RULE-DECK-001 | supplied source lines 42-42 -->
Every normal game starts with exactly **133 physical card instances**.

<!-- RULE-DECK-002 | supplied source lines 44-65 -->
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

<!-- RULE-DECK-003 | supplied source lines 67-67 -->
The physical starting deck remains 133 cards even if an approved effect later generates runtime cards.

<!-- RULE-DECK-004 | supplied source lines 69-69 -->
Generated runtime cards must have unique authoritative IDs.

<!-- RULE-DECK-005 | supplied source lines 71-71 -->
No mechanic may create cards from nothing unless that mechanic is explicitly approved in these rules.

---

# 3. Starting Hand — LOCKED

<!-- RULE-OPENING-001 | supplied source lines 77-77 -->
Every player starts with exactly **7 physical cards**.

<!-- RULE-OPENING-002 | supplied source lines 79-79 -->
Every opening hand contains:

<!-- RULE-OPENING-003 | supplied source lines 81-82 -->
- minimum **1 high-impact/special card**;
- maximum **2 high-impact/special cards**.

<!-- RULE-OPENING-004 | supplied source lines 84-84 -->
The opening dealer must not use the old QA/demo hand that intentionally loads a player with many special cards.

<!-- RULE-OPENING-005 | supplied source lines 86-86 -->
Opening hands use the real physical `CHAOS-133-V1` inventory.

<!-- RULE-OPENING-006 | supplied source lines 88-88 -->
Opening-hand interaction cards remain **dormant in the hand**.

<!-- RULE-OPENING-007 | supplied source lines 90-90 -->
They do **not** automatically trigger simply because they were dealt during setup.

---

# 4. CHAOS Pulse — Internal Draw/Deal System — LOCKED ARCHITECTURE

<!-- RULE-PULSE-001 | supplied source lines 96-96 -->
CHAOS Pulse is the internal dealing and post-start draw-selection mechanic of the normal Cribbit CHAOS game.

<!-- RULE-PULSE-002 | supplied source lines 98-98 -->
It is **not**:

<!-- RULE-PULSE-003 | supplied source lines 100-103 -->
- a separate mode;
- an optional game;
- a player toggle;
- a separate lab mechanic.

<!-- RULE-PULSE-004 | supplied source lines 105-105 -->
Allowed adaptive inputs include:

<!-- RULE-PULSE-005 | supplied source lines 107-111 -->
- real remaining physical-card counts;
- family freshness;
- global recent interaction density;
- lifecycle state;
- authoritative RNG state.

<!-- RULE-PULSE-006 | supplied source lines 113-113 -->
Forbidden adaptive inputs include:

<!-- RULE-PULSE-007 | supplied source lines 115-119 -->
- player identity;
- who is winning or losing;
- who has the fewest cards;
- skill/MMR/account history;
- a desire to punish or rescue a specific player.

<!-- RULE-PULSE-008 | supplied source lines 121-121 -->
Conceptual pipeline:

<!-- RULE-PULSE-009 | supplied source lines 123-145 -->
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

<!-- RULE-PULSE-010 | supplied source lines 147-147 -->
Base family availability concept:

<!-- RULE-PULSE-011 | supplied source lines 149-151 -->
```text
BaseAvailability(f) = 10 × remaining drawable physical copies of family f
```

<!-- RULE-PULSE-012 | supplied source lines 153-153 -->
Exact tuning constants are **UNRESOLVED** and must be playtested without changing the fairness rules above.

---

# 5. Opening Deal vs Post-Start Draws — LOCKED

## 5.1 Opening deal

<!-- RULE-ACQUISITION-001 | supplied source lines 161-161 -->
Immediate-interaction cards dealt into the initial seven-card hand do not trigger automatically.

<!-- RULE-ACQUISITION-002 | supplied source lines 163-163 -->
They remain in hand until legally played.

## 5.2 Forced-on-draw families

<!-- RULE-ACQUISITION-003 | supplied source lines 167-167 -->
After setup is complete, these card families immediately enter their card flow when physically drawn:

<!-- RULE-ACQUISITION-004 | supplied source lines 169-180 -->
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

<!-- RULE-ACQUISITION-005 | supplied source lines 182-182 -->
They cannot be saved in hand when physically drawn after game start.

## 5.3 Not forced-on-draw

<!-- RULE-ACQUISITION-006 | supplied source lines 186-186 -->
These cards normally remain in hand when drawn:

<!-- RULE-ACQUISITION-007 | supplied source lines 188-194 -->
- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

## 5.4 Direct grants are not draws

<!-- RULE-ACQUISITION-008 | supplied source lines 198-198 -->
Cards generated or transferred directly into a player's hand are not automatically treated as physical draws.

<!-- RULE-ACQUISITION-009 | supplied source lines 200-200 -->
Therefore they do not auto-trigger unless the generating/transferring rule explicitly says otherwise.

## 5.5 Multiple forced interactions

<!-- RULE-ACQUISITION-010 | supplied source lines 204-204 -->
If a player draws multiple cards and more than one is an immediate-interaction card:

<!-- RULE-ACQUISITION-011 | supplied source lines 206-213 -->
```text
draw/select cards sequentially
→ ordinary cards stay in hand
→ immediate interactions enter FIFO queue
→ resolve first interaction completely
→ resolve next interaction
→ continue only after queue is empty
```

<!-- RULE-ACQUISITION-012 | supplied source lines 215-215 -->
No overlapping social modals.

---

# 6. Normal Turn Structure — LOCKED

<!-- RULE-TURN-001 | supplied source lines 221-221 -->
A normal turn follows this authority order:

<!-- RULE-TURN-002 | supplied source lines 223-230 -->
1. current player makes one legal play/draw decision;
2. the selected card/effect starts;
3. required target/prompt/reaction/social flow resolves;
4. mandatory penalties resolve;
5. any forced-on-draw interactions resolve FIFO;
6. the played card enters its correct lifecycle zone;
7. authoritative win check runs;
8. if there is no winner, play advances/resumes.

<!-- RULE-TURN-003 | supplied source lines 232-232 -->
A UI Continue button may not run duplicate win checks or duplicate turn advancement.

---

# 7. Number — LOCKED

<!-- RULE-NUMBER-001 | supplied source lines 238-238 -->
A Number card is a normal hand-shedding card.

<!-- RULE-NUMBER-002 | supplied source lines 240-240 -->
It may be legally played when it matches the active play condition by color or number/value.

<!-- RULE-NUMBER-003 | supplied source lines 242-248 -->
```text
Play Number
→ no special effect
→ resolve turn
→ win check
→ advance
```

---

# 8. Skip — LOCKED

<!-- RULE-SKIP-001 | supplied source lines 254-254 -->
> **Skip the next eligible player.**

<!-- RULE-SKIP-002 | supplied source lines 256-260 -->
```text
Play SKIP
→ next eligible player loses that turn
→ rotation continues
```

---

# 9. Reverse — LOCKED

<!-- RULE-REVERSE-001 | supplied source lines 266-266 -->
> **Reverse the current direction of play.**

<!-- RULE-REVERSE-002 | supplied source lines 268-272 -->
```text
clockwise
→ REVERSE
→ counter-clockwise
```

<!-- RULE-REVERSE-003 | supplied source lines 274-274 -->
In a two-player game, Reverse behaves as a turn-return effect.

---

# 10. Draw — PARTLY LOCKED

<!-- RULE-DRAW-001 | supplied source lines 280-280 -->
The approved core rule is:

<!-- RULE-DRAW-002 | supplied source lines 282-282 -->
> **Playing Draw ends the actor's action/turn and the next eligible player draws exactly 2 real cards.**

<!-- RULE-DRAW-003 | supplied source lines 284-289 -->
```text
Player A plays DRAW
→ A's action ends
→ next eligible Player B draws exactly 2 real cards
→ any forced-on-draw cards resolve FIFO
```

<!-- RULE-DRAW-004 | supplied source lines 291-291 -->
**UNRESOLVED:** It has not yet been explicitly locked whether Player B then takes their normal turn after the Draw 2 or whether the Draw card also removes that turn.

<!-- RULE-DRAW-005 | supplied source lines 293-293 -->
Do not silently add a Skip effect until this is explicitly decided.

---

# 11. Wild — LOCKED

<!-- RULE-WILD-001 | supplied source lines 299-299 -->
> **Choose the active color.**

<!-- RULE-WILD-002 | supplied source lines 301-306 -->
```text
Play WILD
→ choose active color
→ chosen color becomes authoritative
→ resolve turn
```

---

# 12. Prompt Architecture — LOCKED

<!-- RULE-PROMPTS-001 | supplied source lines 312-312 -->
Prompt-driven families reuse shared prompt infrastructure, but their ordering is family-specific.

<!-- RULE-PROMPTS-002 | supplied source lines 314-314 -->
Current locked ordering:

<!-- RULE-PROMPTS-003 | supplied source lines 316-340 -->
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
prompt source
→ question
→ initial target
→ Classic or Stranger

DUEL:
opponent
→ prompt source
→ one shared question
→ timer
→ answers
```

<!-- RULE-PROMPTS-004 | supplied source lines 342-342 -->
Manual prompts are one-off prompts for that interaction.

<!-- RULE-PROMPTS-005 | supplied source lines 344-344 -->
Current manual text validation:

<!-- RULE-PROMPTS-006 | supplied source lines 346-348 -->
```text
10–280 characters
```

<!-- RULE-PROMPTS-007 | supplied source lines 350-350 -->
Manual one-off prompts are not automatically saved to the permanent prompt library.

<!-- RULE-PROMPTS-008 | supplied source lines 352-352 -->
Roulette results are selected authoritatively **before** the animation begins.

<!-- RULE-PROMPTS-009 | supplied source lines 354-354 -->
The Roulette wheel is presentation only.

---

# 13. Pre-Game Player Content — LOCKED

<!-- RULE-PREGAME-001 | supplied source lines 360-360 -->
Supported social-question/challenge families may accept player-contributed room/session content before the game.

<!-- RULE-PREGAME-002 | supplied source lines 362-362 -->
Players may contribute supported questions, dares, Paranoia prompts and other approved family content.

<!-- RULE-PREGAME-003 | supplied source lines 364-364 -->
Pregame player content uses the shared authoritative prompt/content system.

<!-- RULE-PREGAME-004 | supplied source lines 366-366 -->
The physical social card represents a mechanic/family; gameplay must not depend on one permanently hardcoded prompt printed into runtime logic.

---

# 14. Truth — LOCKED

<!-- RULE-TRUTH-001 | supplied source lines 372-372 -->
Canonical flow:

<!-- RULE-TRUTH-002 | supplied source lines 374-384 -->
```text
Play / auto-trigger TRUTH
→ choose Manual or Roulette
→ establish one Truth question
→ affected player answers
   OR
   chooses Pass / Not for Me
→ resolve penalties/forced interactions
→ Truth resolves
→ win check
```

<!-- RULE-TRUTH-003 | supplied source lines 386-386 -->
Supported answer modes may include:

<!-- RULE-TRUTH-004 | supplied source lines 388-391 -->
- Speak;
- Type;
- Choose, if authoritative options exist;
- Answered Live / completion-only.

## Truth refusal

<!-- RULE-TRUTH-005 | supplied source lines 395-395 -->
If the affected Truth player chooses Pass / Not for Me:

<!-- RULE-TRUTH-006 | supplied source lines 397-402 -->
```text
affected player draws exactly 2 real cards
→ process forced-on-draw interactions FIFO
→ Truth resolves
→ win check
```

<!-- RULE-TRUTH-007 | supplied source lines 404-404 -->
The Draw 2 occurs before the win check.

<!-- RULE-TRUTH-008 | supplied source lines 406-406 -->
A player cannot win by playing their final Truth and then refusing the Truth.

---

# 15. Dare — LOCKED TARGET-FIRST RULE

<!-- RULE-DARE-001 | supplied source lines 412-412 -->
Dare is not self-targeted.

<!-- RULE-DARE-002 | supplied source lines 414-414 -->
The player who plays or auto-triggers Dare chooses **one other eligible player**.

<!-- RULE-DARE-003 | supplied source lines 416-416 -->
Canonical flow:

<!-- RULE-DARE-004 | supplied source lines 418-429 -->
```text
Player A plays / draws DARE
→ A chooses another eligible Player B
→ choose Manual or Roulette
→ establish Dare for B
→ B completes Dare
   OR
   B chooses Pass / Not for Me
→ resolve penalties / forced interactions
→ Dare resolves
→ win check
```

<!-- RULE-DARE-005 | supplied source lines 431-431 -->
Rules:

<!-- RULE-DARE-006 | supplied source lines 433-440 -->
- actor and target are different identities;
- actor chooses the Dare target;
- target selection happens before prompt establishment;
- Manual Dare is written by the Dare actor for the selected target;
- Roulette Dare selects an eligible Dare for that selected target;
- selected target owns completion, Pass and relevant safety controls;
- bots use the same target-selection rule;
- runtime must never silently set `target = actor`.

## Dare refusal

<!-- RULE-DARE-007 | supplied source lines 444-444 -->
If selected Dare target B refuses:

<!-- RULE-DARE-008 | supplied source lines 446-451 -->
```text
B draws exactly 2 real cards
→ forced-on-draw interactions resolve FIFO
→ Dare resolves
→ win check
```

<!-- RULE-DARE-009 | supplied source lines 453-453 -->
The Dare actor does not take this refusal penalty.

---

# 16. Paranoia — LOCKED CORE IDENTITY

<!-- RULE-PARANOIA-ENTRY-001 | supplied source lines 459-459 -->
Paranoia questions are not neutral trivia.

<!-- RULE-PARANOIA-ENTRY-002 | supplied source lines 461-461 -->
Paranoia prompts should be:

<!-- RULE-PARANOIA-ENTRY-003 | supplied source lines 463-468 -->
- personal;
- awkward;
- provocative;
- revealing;
- annoyingly truthful;
- teasing or socially uncomfortable.

<!-- RULE-PARANOIA-ENTRY-004 | supplied source lines 470-470 -->
The purpose is to create a real reason that somebody may want the question kept secret.

<!-- RULE-PARANOIA-ENTRY-005 | supplied source lines 472-472 -->
Paranoia should not require genuinely dangerous disclosures, but it should feel much more personal than an ordinary Truth question.

<!-- RULE-PARANOIA-ENTRY-006 | supplied source lines 474-474 -->
Canonical entry flow:

<!-- RULE-PARANOIA-ENTRY-007 | supplied source lines 476-482 -->
```text
Play / auto-trigger PARANOIA
→ choose Manual or Roulette
→ establish personal Paranoia question
→ actor chooses initial target
→ choose CLASSIC or STRANGER
```

---

# 17. Paranoia Classic — LOCKED

<!-- RULE-PARANOIA-CLASSIC-001 | supplied source lines 488-488 -->
Classic uses three distinct roles:

<!-- RULE-PARANOIA-CLASSIC-002 | supplied source lines 490-492 -->
1. Paranoia actor;
2. initial target;
3. named answer player.

<!-- RULE-PARANOIA-CLASSIC-003 | supplied source lines 494-494 -->
Flow:

<!-- RULE-PARANOIA-CLASSIC-004 | supplied source lines 496-506 -->
```text
question established
→ actor chooses initial target B
→ Classic selected
→ B chooses another eligible player C
→ C becomes named Answer Player
→ C chooses:
   REVEAL
   OR
   KEEP SECRET
```

<!-- RULE-PARANOIA-CLASSIC-005 | supplied source lines 508-508 -->
The answer player cannot be the initial target.

<!-- RULE-PARANOIA-CLASSIC-006 | supplied source lines 510-510 -->
The initial target and answer player must never overwrite each other in authoritative state.

## Reveal

<!-- RULE-PARANOIA-CLASSIC-007 | supplied source lines 514-519 -->
```text
REVEAL
→ reveal the question according to privacy rules
→ no Keep Secret penalty
→ resolve Paranoia
```

## Keep Secret

<!-- RULE-PARANOIA-CLASSIC-008 | supplied source lines 523-530 -->
```text
KEEP SECRET
→ question remains hidden
→ named Answer Player draws exactly 1 real card
→ forced-on-draw interaction resolves if necessary
→ Paranoia resolves
→ win check
```

<!-- RULE-PARANOIA-CLASSIC-009 | supplied source lines 532-532 -->
The Draw 1 is the **price of secrecy**.

## Classic timeout

<!-- RULE-PARANOIA-CLASSIC-010 | supplied source lines 536-536 -->
Current safe timeout rule:

<!-- RULE-PARANOIA-CLASSIC-011 | supplied source lines 538-542 -->
```text
Classic decision timeout
→ Keep Secret privacy outcome
→ do not reveal question
```

<!-- RULE-PARANOIA-CLASSIC-012 | supplied source lines 544-544 -->
The voluntary Draw 1 penalty applies when the named answer player explicitly chooses Keep Secret.

<!-- RULE-PARANOIA-CLASSIC-013 | supplied source lines 546-546 -->
A timeout fallback is not treated as a voluntary Keep Secret choice and therefore does not add Draw 1 unless a future rule explicitly changes this.

---

# 18. Paranoia Stranger / Online — LOCKED

<!-- RULE-PARANOIA-STRANGER-001 | supplied source lines 552-552 -->
Canonical flow:

<!-- RULE-PARANOIA-STRANGER-002 | supplied source lines 554-564 -->
```text
question established
→ target selected
→ Stranger selected
→ target answers
→ everyone except target votes:
   BELIEVE
   OR
   LYING / HOLDING BACK
→ authoritative tally
```

<!-- RULE-PARANOIA-STRANGER-003 | supplied source lines 566-566 -->
Voting:

<!-- RULE-PARANOIA-STRANGER-004 | supplied source lines 568-573 -->
- target does not vote;
- actor may vote if actor is not target;
- one vote per eligible player;
- duplicate votes are rejected;
- no random tiebreaker;
- no automatic revote.

<!-- RULE-PARANOIA-STRANGER-005 | supplied source lines 575-575 -->
Result:

<!-- RULE-PARANOIA-STRANGER-006 | supplied source lines 577-586 -->
```text
strict LYING / HOLDING BACK majority
→ target draws exactly 2 real cards

tie
→ no penalty

BELIEVE majority
→ no target penalty
```

<!-- RULE-PARANOIA-STRANGER-007 | supplied source lines 588-588 -->
Any Draw 2 follows normal forced-on-draw rules.

<!-- RULE-PARANOIA-STRANGER-008 | supplied source lines 590-590 -->
The previously suggested **False Alarm** penalty is **NOT LOCKED** and is not part of the current canonical rule.

---

# 19. Duel — LOCKED

<!-- RULE-DUEL-001 | supplied source lines 596-596 -->
Canonical flow:

<!-- RULE-DUEL-002 | supplied source lines 598-609 -->
```text
Play / auto-trigger DUEL
→ challenger chooses opponent
→ choose Manual or Duel Roulette
→ establish ONE shared question
→ challenger chooses timer
→ challenger answers
→ opponent answers SAME question
→ authoritative result method
→ resolve
→ win check
```

<!-- RULE-DUEL-003 | supplied source lines 611-611 -->
The Duel timer is selected by the challenger and is not random.

## Judging authority

<!-- RULE-DUEL-004 | supplied source lines 615-615 -->
Prompt source and judging mode are separate.

<!-- RULE-DUEL-005 | supplied source lines 617-617 -->
Subjective/manual/player-authored/free-text questions use:

<!-- RULE-DUEL-006 | supplied source lines 619-621 -->
```text
GROUP VOTE
```

<!-- RULE-DUEL-007 | supplied source lines 623-623 -->
Game-provided questions also use group vote unless the content includes real structured objective evaluation data.

<!-- RULE-DUEL-008 | supplied source lines 625-625 -->
Backend automatic judging is allowed only with deterministic structured evaluation data.

<!-- RULE-DUEL-009 | supplied source lines 627-627 -->
Roulette does not automatically mean objective judging.

<!-- RULE-DUEL-010 | supplied source lines 629-629 -->
AI free-text judging is not the authoritative Duel judge.

## Group vote

<!-- RULE-DUEL-011 | supplied source lines 633-633 -->
Eligible voters are all session players except:

<!-- RULE-DUEL-012 | supplied source lines 635-636 -->
- challenger;
- opponent.

<!-- RULE-DUEL-013 | supplied source lines 638-638 -->
Rules:

<!-- RULE-DUEL-014 | supplied source lines 640-646 -->
- participants cannot vote;
- participants cannot directly choose their own Duel winner;
- each eligible voter votes once;
- unique top candidate wins Duel recap;
- tie = no Duel winner;
- no eligible votes = no Duel winner;
- two-player Duel resolves with no Duel winner rather than hanging.

<!-- RULE-DUEL-015 | supplied source lines 648-648 -->
Duel outcome does not replace zero-card game victory.

---

# 20. Taboo — LOCKED

<!-- RULE-TABOO-001 | supplied source lines 654-654 -->
> **Choose another player and ask them one question. The target must answer YES or draw exactly 2 cards.**

<!-- RULE-TABOO-002 | supplied source lines 656-656 -->
Canonical flow:

<!-- RULE-TABOO-003 | supplied source lines 658-673 -->
```text
Play / auto-trigger TABOO
→ choose another eligible target
→ establish one question
→ target must respond

YES
→ no penalty
→ Taboo resolves

anything other than YES / refusal
→ target draws exactly 2
→ forced-on-draw interactions resolve FIFO
→ Taboo resolves
→ win check
```

<!-- RULE-TABOO-004 | supplied source lines 675-675 -->
The point of Taboo is **forced agreement inside the game**.

<!-- RULE-TABOO-005 | supplied source lines 677-677 -->
The target does not need to prove that the YES is truthful.

<!-- RULE-TABOO-006 | supplied source lines 679-679 -->
A Taboo YES is only the card response. It does not represent real-world consent, permission, a contract or an external promise.

<!-- RULE-TABOO-007 | supplied source lines 681-681 -->
**UNRESOLVED:** timeout treatment should be explicitly locked. Current recommendation is timeout = refusal = Draw 2, but this has not yet been explicitly approved.

---

# 21. Hijack — LOCKED

<!-- RULE-HIJACK-001 | supplied source lines 687-687 -->
Hijack owns the permanent rotation-position swap mechanic.

<!-- RULE-HIJACK-002 | supplied source lines 689-689 -->
> **Choose another player. You and that player permanently swap positions in the turn order for the remainder of the game. The targeted player draws 1 card, then immediately takes over your current position and gets an action.**

<!-- RULE-HIJACK-003 | supplied source lines 691-691 -->
Canonical flow:

<!-- RULE-HIJACK-004 | supplied source lines 693-702 -->
```text
Player A plays / auto-triggers HIJACK
→ A chooses Player B
→ A and B permanently swap authoritative rotation positions
→ B draws exactly 1 real card
→ forced interaction from that draw resolves if necessary
→ B occupies A's former current position
→ B receives one immediate normal Play-or-Draw action
→ normal rotation continues using the NEW permanent order
```

<!-- RULE-HIJACK-005 | supplied source lines 704-704 -->
Example:

<!-- RULE-HIJACK-006 | supplied source lines 706-714 -->
```text
Before:
Anna → Ben → Carla → Diego

Anna HIJACKS Carla

After:
Carla → Ben → Anna → Diego
```

<!-- RULE-HIJACK-007 | supplied source lines 716-716 -->
This is a real authoritative position swap.

<!-- RULE-HIJACK-008 | supplied source lines 718-718 -->
It is not merely a temporary `currentPlayerId` change.

<!-- RULE-HIJACK-009 | supplied source lines 720-720 -->
Reverse, Skip, reconnect, bots, replay and future Hijacks use the new order.

<!-- RULE-HIJACK-010 | supplied source lines 722-722 -->
**UNRESOLVED edge case:** exact final-card/win-check timing around the target's immediate takeover action should be encoded so no player wins in the middle of unresolved Hijack flow.

---

# 22. TAG / TAG ALONG — LOCKED CORE

<!-- RULE-TAG-001 | supplied source lines 728-728 -->
TAG does **not** permanently move anyone.

<!-- RULE-TAG-002 | supplied source lines 730-730 -->
> **Choose another player. That player tags along on your current turn and receives one bonus Play-or-Draw action. The target still keeps their own regular scheduled turn.**

<!-- RULE-TAG-003 | supplied source lines 732-732 -->
Canonical flow:

<!-- RULE-TAG-004 | supplied source lines 734-743 -->
```text
Player A plays / auto-triggers TAG
→ A chooses Player B
→ B becomes TAGGED ALONG
→ B immediately receives one bonus Play-or-Draw action
→ resolve that bonus action and any forced interactions completely
→ TAG resolves
→ normal rotation continues
→ B still receives B's regular scheduled turn later
```

<!-- RULE-TAG-005 | supplied source lines 745-745 -->
Example:

<!-- RULE-TAG-006 | supplied source lines 747-758 -->
```text
Normal order:
Anna → Ben → Carla → Diego

Anna TAGS Carla

Anna plays TAG
→ Carla immediately gets one bonus Play-or-Draw action
→ Ben later takes normal turn
→ Carla still receives Carla's normal turn
→ Diego
```

<!-- RULE-TAG-007 | supplied source lines 760-760 -->
The target may therefore act twice in the same rotation:

<!-- RULE-TAG-008 | supplied source lines 762-763 -->
1. TAG bonus action;
2. normal scheduled turn.

<!-- RULE-TAG-009 | supplied source lines 765-765 -->
If the target chooses Draw during the bonus action, that is a normal physical draw and forced-on-draw rules apply.

<!-- RULE-TAG-010 | supplied source lines 767-767 -->
TAG does not automatically force a Draw 2.

<!-- RULE-TAG-011 | supplied source lines 769-769 -->
TAG does not consume the target's normal turn.

<!-- RULE-TAG-012 | supplied source lines 771-771 -->
**UNRESOLVED:** whether a TAG bonus action may play another TAG and create a nested TAG chain has not yet been explicitly locked.

---

# 23. Truth or Chaos — LOCKED CORE / SOME DETAILS UNRESOLVED

<!-- RULE-TRUTH-OR-CHAOS-001 | supplied source lines 777-777 -->
Truth or Chaos is **not** Truth or Dare.

<!-- RULE-TRUTH-OR-CHAOS-002 | supplied source lines 779-779 -->
Its identity is a **group consensus challenge**.

<!-- RULE-TRUTH-OR-CHAOS-003 | supplied source lines 781-781 -->
The instigator asks the group one question designed to have **one comparable answer**.

<!-- RULE-TRUTH-OR-CHAOS-004 | supplied source lines 783-783 -->
Canonical concept:

<!-- RULE-TRUTH-OR-CHAOS-005 | supplied source lines 785-791 -->
```text
Play / auto-trigger TRUTH OR CHAOS
→ instigator asks one group question
→ affected group answers privately / independently
→ all answers lock
→ reveal/compare together
```

<!-- RULE-TRUTH-OR-CHAOS-006 | supplied source lines 793-793 -->
The question must support objective comparison between answers.

<!-- RULE-TRUTH-OR-CHAOS-007 | supplied source lines 795-795 -->
Good formats include:

<!-- RULE-TRUTH-OR-CHAOS-008 | supplied source lines 797-800 -->
- YES / NO;
- A / B / C;
- choose one player;
- choose one option.

<!-- RULE-TRUTH-OR-CHAOS-009 | supplied source lines 802-802 -->
Free-text equivalence should not be used to decide whether answers match.

## Matching result

<!-- RULE-TRUTH-OR-CHAOS-010 | supplied source lines 806-811 -->
```text
ALL affected answers match
→ TRUTH outcome
→ no group punishment
→ card resolves
```

## Mismatch result

<!-- RULE-TRUTH-OR-CHAOS-011 | supplied source lines 815-819 -->
```text
ANY affected answer differs
→ CHAOS outcome
→ instigator orders one GROUP DARE / GROUP PUNISHMENT
```

<!-- RULE-TRUTH-OR-CHAOS-012 | supplied source lines 821-821 -->
The group punishment should involve the group as a group, for example:

<!-- RULE-TRUTH-OR-CHAOS-013 | supplied source lines 823-827 -->
- group dance;
- group singing;
- synchronized pose;
- whole-group activity;
- another approved group challenge.

<!-- RULE-TRUTH-OR-CHAOS-014 | supplied source lines 829-829 -->
The group Dare is not simply a normal single-target Dare.

<!-- RULE-TRUTH-OR-CHAOS-015 | supplied source lines 831-831 -->
**UNRESOLVED:** exact refusal/Pass penalty for a player who refuses the group Dare is not yet explicitly locked. The current recommendation is individual Draw 2, but do not treat that as canonical until approved.

<!-- RULE-TRUTH-OR-CHAOS-016 | supplied source lines 833-833 -->
**UNRESOLVED:** whether the instigator also answers the consensus question has not been explicitly locked. Current design language treats the instigator as asking the group, which suggests the other players are the affected answering group.

---

# 24. Chaos — LOCKED IDENTITY / CURRENT EFFECT CATALOGUE

<!-- RULE-CHAOS-001 | supplied source lines 839-839 -->
Chaos is a whole-table disruption card.

<!-- RULE-CHAOS-002 | supplied source lines 841-841 -->
When Chaos resolves, the authoritative game selects one effect from the approved Chaos catalogue.

<!-- RULE-CHAOS-003 | supplied source lines 843-843 -->
Current approved catalogue contains:

<!-- RULE-CHAOS-004 | supplied source lines 845-846 -->
1. **Blind Swap**
2. **Reverse Order**

<!-- RULE-CHAOS-005 | supplied source lines 848-848 -->
The exact selection weighting between Chaos effects is **UNRESOLVED**.

---

# 25. Chaos Effect: Blind Swap — LOCKED CORE

<!-- RULE-BLIND-SWAP-001 | supplied source lines 854-854 -->
> **Everyone simultaneously gives 3 random cards face-down to the player on their left. The transfer goes full circle and involves the whole table.**

<!-- RULE-BLIND-SWAP-002 | supplied source lines 856-856 -->
Canonical flow:

<!-- RULE-BLIND-SWAP-003 | supplied source lines 858-868 -->
```text
CHAOS → BLIND SWAP
→ server randomly selects 3 cards from each player's current hand
→ selections remain hidden
→ all transfers commit simultaneously
→ every player passes selected cards to player on their left
→ every player receives cards from player on their right
→ update all hands together
→ Blind Swap resolves
→ win check
```

<!-- RULE-BLIND-SWAP-004 | supplied source lines 870-870 -->
Rules:

<!-- RULE-BLIND-SWAP-005 | supplied source lines 872-879 -->
- the server/app selects the transferred cards randomly;
- players do not choose which cards to give;
- the whole table participates, including the Chaos actor;
- all transfers are simultaneous;
- received cards are **transfers, not draws**;
- therefore transferred Truth/Dare/Paranoia/etc. do not auto-trigger;
- no player may win halfway through the transfer;
- win check occurs only after the complete full-circle swap finishes.

<!-- RULE-BLIND-SWAP-006 | supplied source lines 881-881 -->
**UNRESOLVED:** if a player has fewer than 3 cards at Blind Swap start, the current recommendation is to transfer all cards they hold, but this needs explicit final approval.

<!-- RULE-BLIND-SWAP-007 | supplied source lines 883-883 -->
**UNRESOLVED:** "player on the left" should be locked as either physical/seat left or current directional next/left. Current recommendation is physical seat-left so Reverse effects do not change Blind Swap routing.

---

# 26. Chaos Effect: Reverse Order — LOCKED

<!-- RULE-CHAOS-REVERSE-001 | supplied source lines 889-889 -->
> **Reverse the current direction of play. The Chaos reversal remains in effect until the next Chaos card begins.**

<!-- RULE-CHAOS-REVERSE-002 | supplied source lines 891-891 -->
Example:

<!-- RULE-CHAOS-REVERSE-003 | supplied source lines 893-901 -->
```text
Current:
Anna → Ben → Carla → Diego

CHAOS: REVERSE ORDER

Becomes:
Anna ← Ben ← Carla ← Diego
```

<!-- RULE-CHAOS-REVERSE-004 | supplied source lines 903-903 -->
The reversal begins from the **opposite rotation of the current game direction**, just like a Reverse effect.

<!-- RULE-CHAOS-REVERSE-005 | supplied source lines 905-905 -->
It persists across later turns until the next Chaos card begins.

<!-- RULE-CHAOS-REVERSE-006 | supplied source lines 907-907 -->
When the next Chaos begins:

<!-- RULE-CHAOS-REVERSE-007 | supplied source lines 909-912 -->
```text
remove previous persistent Chaos Reverse Order state
→ resolve the new Chaos effect
```

<!-- RULE-CHAOS-REVERSE-008 | supplied source lines 914-914 -->
Normal Reverse cards remain allowed while Chaos Reverse Order exists.

<!-- RULE-CHAOS-REVERSE-009 | supplied source lines 916-916 -->
Implementation should track the Chaos reversal as authoritative persistent state rather than faking it with a temporary current-player jump.

---

# 27. Machiavelli — LOCKED SIX-CHOICE MODEL

<!-- RULE-MACHIAVELLI-001 | supplied source lines 922-922 -->
Machiavelli is not free-text rule creation.

<!-- RULE-MACHIAVELLI-002 | supplied source lines 924-924 -->
When played or auto-triggered:

<!-- RULE-MACHIAVELLI-003 | supplied source lines 926-933 -->
```text
MACHIAVELLI
→ actor privately sees exactly 6 choices
→ actor chooses exactly 1
→ server immediately applies chosen effect
→ chosen effect name / table-facing message is broadcast
→ Machiavelli moves to EXHAUSTED
```

<!-- RULE-MACHIAVELLI-004 | supplied source lines 935-935 -->
Machiavelli is one-use.

<!-- RULE-MACHIAVELLI-005 | supplied source lines 937-937 -->
The six choices are:

<!-- RULE-MACHIAVELLI-006 | supplied source lines 939-944 -->
1. Convert the Weak
2. Taboo for All
3. No Mercy
4. Paranoia Spreads
5. Double the Pressure
6. Reverse Confession

---

# 28. Machiavelli: Convert the Weak — LOCKED

<!-- RULE-MACHIAVELLI-CONVERT-001 | supplied source lines 950-950 -->
> **All Skip cards become Draw +2 cards for the active game.**

<!-- RULE-MACHIAVELLI-CONVERT-002 | supplied source lines 952-952 -->
Affected Skip instances include cards in:

<!-- RULE-MACHIAVELLI-CONVERT-003 | supplied source lines 954-956 -->
- player hands;
- drawable pool;
- discard.

<!-- RULE-MACHIAVELLI-CONVERT-004 | supplied source lines 958-961 -->
```text
all SKIP instances in active game zones
→ transform into DRAW +2
```

<!-- RULE-MACHIAVELLI-CONVERT-005 | supplied source lines 963-963 -->
The actual existing instances are transformed; they are not duplicated.

<!-- RULE-MACHIAVELLI-CONVERT-006 | supplied source lines 965-965 -->
If recycled later, they remain transformed for that game.

<!-- RULE-MACHIAVELLI-CONVERT-007 | supplied source lines 967-967 -->
CHAOS Pulse recalculates the changed pool.

---

# 29. Machiavelli: Taboo for All — LOCKED

<!-- RULE-MACHIAVELLI-TABOO-001 | supplied source lines 973-973 -->
> **Generate one Taboo directly into every player's hand.**

<!-- RULE-MACHIAVELLI-TABOO-002 | supplied source lines 975-978 -->
```text
each player
→ +1 generated TABOO
```

<!-- RULE-MACHIAVELLI-TABOO-003 | supplied source lines 980-980 -->
These are direct grants, not physical draws.

<!-- RULE-MACHIAVELLI-TABOO-004 | supplied source lines 982-982 -->
They do not auto-trigger immediately.

<!-- RULE-MACHIAVELLI-TABOO-005 | supplied source lines 984-984 -->
Each generated card receives a unique runtime ID.

---

# 30. Machiavelli: No Mercy — LOCKED

<!-- RULE-MACHIAVELLI-NO-MERCY-001 | supplied source lines 990-990 -->
> **Permanently remove every Nope from the active game.**

<!-- RULE-MACHIAVELLI-NO-MERCY-002 | supplied source lines 992-992 -->
Affected Nope cards include those in:

<!-- RULE-MACHIAVELLI-NO-MERCY-003 | supplied source lines 994-996 -->
- player hands;
- drawable pool;
- discard.

<!-- RULE-MACHIAVELLI-NO-MERCY-004 | supplied source lines 998-1001 -->
```text
all NOPE in active zones
→ PERMANENTLY REMOVED
```

<!-- RULE-MACHIAVELLI-NO-MERCY-005 | supplied source lines 1003-1003 -->
Players can lose a Nope they were already holding.

<!-- RULE-MACHIAVELLI-NO-MERCY-006 | supplied source lines 1005-1005 -->
Removed Nope cards cannot return through recycling.

<!-- RULE-MACHIAVELLI-NO-MERCY-007 | supplied source lines 1007-1007 -->
CHAOS Pulse recalculates availability immediately.

---

# 31. Machiavelli: Paranoia Spreads — LOCKED

<!-- RULE-MACHIAVELLI-PARANOIA-001 | supplied source lines 1013-1013 -->
Each player receives exactly **one newly generated card**.

<!-- RULE-MACHIAVELLI-PARANOIA-002 | supplied source lines 1015-1015 -->
For each recipient independently, the authoritative app/server randomly chooses:

<!-- RULE-MACHIAVELLI-PARANOIA-003 | supplied source lines 1017-1021 -->
```text
DIG ME
OR
PARANOIA
```

<!-- RULE-MACHIAVELLI-PARANOIA-004 | supplied source lines 1023-1023 -->
Different players may receive different results.

<!-- RULE-MACHIAVELLI-PARANOIA-005 | supplied source lines 1025-1025 -->
Each generated card:

<!-- RULE-MACHIAVELLI-PARANOIA-006 | supplied source lines 1027-1031 -->
- receives a unique runtime ID;
- uses authoritative replayable RNG;
- enters the hand directly;
- is a grant, not a draw;
- therefore does not auto-trigger immediately.

<!-- RULE-MACHIAVELLI-PARANOIA-007 | supplied source lines 1033-1033 -->
**UNRESOLVED:** the random split has not been explicitly locked to 50/50. Do not assume exact probability unless approved.

---

# 32. Machiavelli: Double the Pressure — LOCKED

<!-- RULE-MACHIAVELLI-PRESSURE-001 | supplied source lines 1039-1039 -->
> **Duplicate every remaining Truth and Dare currently in drawable availability.**

<!-- RULE-MACHIAVELLI-PRESSURE-002 | supplied source lines 1041-1047 -->
```text
remaining drawable Truth
+
remaining drawable Dare
→ create one generated duplicate of each
→ add/shuffle generated duplicates into drawable availability
```

<!-- RULE-MACHIAVELLI-PRESSURE-003 | supplied source lines 1049-1049 -->
Truth/Dare already in:

<!-- RULE-MACHIAVELLI-PRESSURE-004 | supplied source lines 1051-1053 -->
- hands;
- discard;
- Exhausted

<!-- RULE-MACHIAVELLI-PRESSURE-005 | supplied source lines 1055-1055 -->
are not duplicated.

<!-- RULE-MACHIAVELLI-PRESSURE-006 | supplied source lines 1057-1057 -->
Generated copies use unique runtime IDs.

<!-- RULE-MACHIAVELLI-PRESSURE-007 | supplied source lines 1059-1059 -->
CHAOS Pulse immediately uses the enlarged actual pool.

---

# 33. Machiavelli: Reverse Confession — LOCKED

<!-- RULE-MACHIAVELLI-CONFESSION-001 | supplied source lines 1065-1065 -->
> **Generate one Reverse Confession directly into every player's hand.**

<!-- RULE-MACHIAVELLI-CONFESSION-002 | supplied source lines 1067-1067 -->
These are direct grants, not draws.

<!-- RULE-MACHIAVELLI-CONFESSION-003 | supplied source lines 1069-1069 -->
They do not auto-trigger immediately.

---

# 34. Ghost — NEW LOCKED CORE / SOME DETAILS UNRESOLVED

<!-- RULE-GHOST-001 | supplied source lines 1075-1075 -->
Ghost is not forced-on-draw.

<!-- RULE-GHOST-002 | supplied source lines 1077-1077 -->
Its current identity is:

<!-- RULE-GHOST-003 | supplied source lines 1079-1079 -->
> **A player becomes a Ghost for two of their own turns. During those Ghost turns, they do not take the normal draw and may only play a legal card already in their hand.**

<!-- RULE-GHOST-004 | supplied source lines 1081-1081 -->
The card's face-down delayed identity remains:

<!-- RULE-GHOST-005 | supplied source lines 1083-1088 -->
```text
play GHOST face-down
→ ARM
→ later FLIP / ACTIVATE
→ owner enters GHOST state
```

<!-- RULE-GHOST-006 | supplied source lines 1090-1090 -->
Ghost state:

<!-- RULE-GHOST-007 | supplied source lines 1092-1094 -->
```text
GhostTurnsRemaining = 2
```

<!-- RULE-GHOST-008 | supplied source lines 1096-1096 -->
For each of those two personal turns:

<!-- RULE-GHOST-009 | supplied source lines 1098-1106 -->
```text
if Ghost player has a legal card
→ may play one legal card
→ special cards are allowed if legal

if Ghost player has no legal card
→ no normal draw
→ turn ends
```

<!-- RULE-GHOST-010 | supplied source lines 1108-1108 -->
After two of that player's Ghost turns are consumed:

<!-- RULE-GHOST-011 | supplied source lines 1110-1112 -->
```text
Ghost state ends
```

<!-- RULE-GHOST-012 | supplied source lines 1114-1114 -->
This replaces the vague older idea of an undefined "owner benefit."

<!-- RULE-GHOST-013 | supplied source lines 1116-1116 -->
**UNRESOLVED:** whether Ghost protects the player from mandatory penalty draws has not been explicitly approved. Current recommendation is that Ghost suppresses only the normal voluntary turn draw and does NOT cancel Draw 2 penalties, Truth/Dare refusal draws, Taboo penalties, Paranoia penalties, etc.

<!-- RULE-GHOST-014 | supplied source lines 1118-1118 -->
**UNRESOLVED:** whether the older separate "target Draw 2 + Skip" Ghost attack still exists is not part of the new approved Ghost description and should not be reintroduced without explicit confirmation.

---

# 35. DIG ME — LOCKED CORE

<!-- RULE-DIG-ME-001 | supplied source lines 1124-1124 -->
> **Choose another player and ask that target a question about yourself.**

<!-- RULE-DIG-ME-002 | supplied source lines 1126-1126 -->
DIG ME does **not** use Roulette.

<!-- RULE-DIG-ME-003 | supplied source lines 1128-1128 -->
DIG ME does **not** offer app-generated question suggestions.

<!-- RULE-DIG-ME-004 | supplied source lines 1130-1130 -->
The actor must personally supply the question through one of these methods:

<!-- RULE-DIG-ME-005 | supplied source lines 1132-1133 -->
- written/typed by the actor;
- spoken/asked live by the actor.

<!-- RULE-DIG-ME-006 | supplied source lines 1135-1135 -->
Canonical flow:

<!-- RULE-DIG-ME-007 | supplied source lines 1137-1143 -->
```text
Play / auto-trigger DIG ME
→ actor chooses another eligible target
→ actor writes or asks live one question ABOUT THE ACTOR
→ target answers
→ resolve DIG ME
```

<!-- RULE-DIG-ME-008 | supplied source lines 1145-1145 -->
**UNRESOLVED:** exact Pass/refusal consequence and any answer-mode completion UI beyond written/live question ownership remain to be finalized.

---

# 36. Reverse Confession — LOCKED CORE / RESOLUTION UNRESOLVED

<!-- RULE-REVERSE-CONFESSION-001 | supplied source lines 1151-1151 -->
Core card identity:

<!-- RULE-REVERSE-CONFESSION-002 | supplied source lines 1153-1153 -->
> **Confess something about yourself. It may be real or made up. Do not say which one it is.**

<!-- RULE-REVERSE-CONFESSION-003 | supplied source lines 1155-1159 -->
```text
Play / auto-trigger REVERSE CONFESSION
→ player gives one confession
→ player does NOT reveal whether it is true or fabricated
```

<!-- RULE-REVERSE-CONFESSION-004 | supplied source lines 1161-1161 -->
The exact group-response/resolution mechanic is **UNRESOLVED**.

<!-- RULE-REVERSE-CONFESSION-005 | supplied source lines 1163-1163 -->
Do not invent a truth/lie vote unless explicitly approved later.

---

# 37. Nope — NEW NARROW ROLE

<!-- RULE-NOPE-001 | supplied source lines 1169-1169 -->
Nope is a physical challenge-escape card.

<!-- RULE-NOPE-002 | supplied source lines 1171-1171 -->
When an eligible player uses Nope:

<!-- RULE-NOPE-003 | supplied source lines 1173-1180 -->
```text
eligible social challenge applies to player
→ player plays NOPE
→ real Nope card is consumed
→ that player's challenge is cancelled
→ player takes no normal refusal Draw 2 for that cancelled challenge
→ continue as though that challenge did not happen to that player
```

## Confirmed eligible families

<!-- RULE-NOPE-004 | supplied source lines 1184-1184 -->
Current explicit wording confirms Nope for:

<!-- RULE-NOPE-005 | supplied source lines 1186-1187 -->
- Truth;
- Dare.

## Ambiguous wording requiring confirmation

<!-- RULE-NOPE-006 | supplied source lines 1191-1191 -->
The game owner also stated:

<!-- RULE-NOPE-007 | supplied source lines 1193-1193 -->
> "nope can only stop: truth or dare, truth, dare"

<!-- RULE-NOPE-008 | supplied source lines 1195-1195 -->
The canonical physical family is **Truth or Chaos**, not a separate current card called Truth or Dare.

<!-- RULE-NOPE-009 | supplied source lines 1197-1197 -->
Therefore:

<!-- RULE-NOPE-010 | supplied source lines 1199-1201 -->
- Truth = confirmed;
- Dare = confirmed;
- whether **Truth or Chaos** is also Nope-eligible is **UNRESOLVED** until explicitly confirmed.

<!-- RULE-NOPE-011 | supplied source lines 1203-1203 -->
Do not silently add Paranoia, Duel, Chaos, Hijack, TAG, Taboo, Ghost, Machiavelli, DIG ME, Reverse Confession, Draw, Skip, Reverse or Wild to the Nope matrix.

<!-- RULE-NOPE-012 | supplied source lines 1205-1205 -->
This newer narrow Nope role supersedes older broader recovered Nope matrices unless the owner explicitly restores an eligibility.

---

# 38. Pass / Not for Me — LOCKED WHERE SPECIFIED

<!-- RULE-PASS-001 | supplied source lines 1211-1211 -->
Pass is a player safety/refusal control, not a physical card.

<!-- RULE-PASS-002 | supplied source lines 1213-1213 -->
Confirmed penalties:

<!-- RULE-PASS-003 | supplied source lines 1215-1221 -->
```text
Truth Pass
→ affected player Draw 2

Dare Pass
→ selected Dare target Draw 2
```

<!-- RULE-PASS-004 | supplied source lines 1223-1223 -->
Truth/Dare penalties occur before effect completion and before win check.

<!-- RULE-PASS-005 | supplied source lines 1225-1225 -->
Other family-specific Pass consequences must not be invented unless explicitly locked.

---

# 39. Rewind — LOCKED

<!-- RULE-REWIND-001 | supplied source lines 1231-1231 -->
Rewind is a private prompt-replacement control for eligible Roulette Truth/Dare interactions before public commitment.

<!-- RULE-REWIND-002 | supplied source lines 1233-1233 -->
Rules:

<!-- RULE-REWIND-003 | supplied source lines 1235-1239 -->
- once per player per session;
- only before public Roulette prompt commit/reveal;
- selects another eligible prompt;
- rejected prompt remains private;
- does not apply to a manually authored prompt.

---

# 40. Flag — LOCKED

<!-- RULE-FLAG-001 | supplied source lines 1245-1245 -->
Flag is a private moderation/reporting control.

<!-- RULE-FLAG-002 | supplied source lines 1247-1247 -->
It is not a tactical Nope.

<!-- RULE-FLAG-003 | supplied source lines 1249-1249 -->
Flag:

<!-- RULE-FLAG-004 | supplied source lines 1251-1255 -->
- reports the active authoritative prompt;
- does not automatically cancel gameplay;
- does not silently change resolution;
- does not reveal private moderation data publicly;
- does not reset the timer unless a future rule explicitly says so.

---

# 41. Answer Modes and Privacy — LOCKED

<!-- RULE-ANSWER-PRIVACY-001 | supplied source lines 1261-1261 -->
Supported response concepts include:

<!-- RULE-ANSWER-PRIVACY-002 | supplied source lines 1263-1266 -->
- Speak;
- Type;
- Choose when authoritative options exist;
- Answered Live / completion-only.

<!-- RULE-ANSWER-PRIVACY-003 | supplied source lines 1268-1268 -->
Rules:

<!-- RULE-ANSWER-PRIVACY-004 | supplied source lines 1270-1276 -->
- the engine must not fabricate speech or answers;
- Answered Live records completion, not invented transcript content;
- private typed/choice answers are not automatically public;
- public events may say a player answered/completed without inventing what was said;
- hidden Paranoia questions remain hidden when Keep Secret applies;
- sealed Roulette results remain private until reveal boundary;
- private votes/answers/author information must follow the appropriate visibility rule.

---

# 42. Bots — LOCKED

<!-- RULE-BOTS-001 | supplied source lines 1282-1282 -->
Bots use the same authoritative gameplay command paths as humans.

<!-- RULE-BOTS-002 | supplied source lines 1284-1284 -->
Bots must not directly mutate state to bypass required commands.

<!-- RULE-BOTS-003 | supplied source lines 1286-1286 -->
Bots must not stall unresolved gameplay.

---

# 43. Public Social Visibility — LOCKED

<!-- RULE-PUBLIC-SOCIAL-001 | supplied source lines 1292-1292 -->
Human observers must understand public social interactions even when bots resolve quickly.

<!-- RULE-PUBLIC-SOCIAL-002 | supplied source lines 1294-1294 -->
Once information is public, the table should be able to see where appropriate:

<!-- RULE-PUBLIC-SOCIAL-003 | supplied source lines 1296-1300 -->
- actor;
- target;
- card family;
- public prompt/challenge/question;
- public completion/pass/result.

<!-- RULE-PUBLIC-SOCIAL-004 | supplied source lines 1302-1302 -->
Do not fabricate bot spoken/typed answers.

---

# 44. Timeouts — LOCKED ARCHITECTURE

<!-- RULE-TIMEOUT-001 | supplied source lines 1308-1308 -->
Every timed player-dependent state must have a deterministic authoritative terminal outcome.

<!-- RULE-TIMEOUT-002 | supplied source lines 1310-1310 -->
A timer reaching zero must never freeze the game.

<!-- RULE-TIMEOUT-003 | supplied source lines 1312-1312 -->
Timeouts must not:

<!-- RULE-TIMEOUT-004 | supplied source lines 1314-1317 -->
- invent hidden answers;
- invent Duel winners;
- reveal private content;
- create duplicate resolution.

<!-- RULE-TIMEOUT-005 | supplied source lines 1319-1319 -->
Confirmed example:

<!-- RULE-TIMEOUT-006 | supplied source lines 1321-1325 -->
```text
Classic Paranoia timeout
→ Keep Secret privacy outcome
→ no voluntary Keep Secret Draw 1
```

<!-- RULE-TIMEOUT-007 | supplied source lines 1327-1327 -->
Family-specific timeout penalties not explicitly locked remain unresolved.

---

# 45. Active Modal Close Rule — LOCKED

<!-- RULE-MODAL-001 | supplied source lines 1333-1333 -->
An unresolved authoritative gameplay effect cannot be dismissed with an X/Close button to skip the rule.

<!-- RULE-MODAL-002 | supplied source lines 1335-1335 -->
Fixture Preview/testing UI is not authoritative gameplay and may be closed normally.

---

# 46. Resolved Discard vs Active Effect — LOCKED

<!-- RULE-DISCARD-001 | supplied source lines 1341-1341 -->
A resolved special card may remain physically visible as the top discard across later draw-only turns.

<!-- RULE-DISCARD-002 | supplied source lines 1343-1343 -->
That does **not** mean its effect is still active.

<!-- RULE-DISCARD-003 | supplied source lines 1345-1345 -->
UI/state must distinguish:

<!-- RULE-DISCARD-004 | supplied source lines 1347-1349 -->
- current player;
- active unresolved effect;
- resolved card remaining on top of discard.

---

# 47. Continue / Win Boundary — LOCKED

<!-- RULE-CONTINUATION-001 | supplied source lines 1355-1363 -->
```text
effect complete
→ penalties complete
→ forced-interaction queue empty
→ authoritative win check ONCE
→ winner flow
   OR
   resume/advance ONCE
```

<!-- RULE-CONTINUATION-002 | supplied source lines 1365-1365 -->
No duplicate win checks.

<!-- RULE-CONTINUATION-003 | supplied source lines 1367-1367 -->
No duplicate turn advancement.

<!-- RULE-CONTINUATION-004 | supplied source lines 1369-1369 -->
No premature win while a required effect remains unresolved.

---

# 48. Current Explicitly Unresolved Rules

<!-- RULE-UNRESOLVED-001 | supplied source lines 1375-1375 -->
These are intentionally unresolved and must not be guessed:

<!-- RULE-UNRESOLVED-002 | supplied source lines 1377-1393 -->
1. whether normal Draw 2 also removes the penalized player's normal turn;
2. Taboo timeout consequence;
3. Hijack final-card/takeover win-boundary detail;
4. TAG chaining/nested TAG actions;
5. Truth or Chaos group-Dare refusal consequence;
6. whether Truth or Chaos instigator also answers;
7. Chaos effect-selection weighting;
8. Blind Swap with fewer than 3 cards;
9. whether Blind Swap "left" means permanent physical seat-left;
10. Machiavelli Paranoia Spreads exact probability split;
11. Ghost interaction with mandatory penalty draws;
12. confirmation that the old Ghost target Draw 2 + Skip attack is removed;
13. DIG ME Pass/refusal consequence;
14. Reverse Confession final group-response mechanic;
15. whether Nope also cancels Truth or Chaos;
16. additional Chaos effects beyond Blind Swap and Reverse Order;
17. final CHAOS Pulse tuning constants.

---

# 49. Rule Preservation Protocol

<!-- RULE-PROVENANCE-001 | supplied source lines 1399-1399 -->
To prevent another synchronization reversal:

<!-- RULE-PROVENANCE-002 | supplied source lines 1401-1410 -->
```text
OWNER-APPROVED GAME RULE
→ GameRules.md
→ detailed rule/decision docs
→ implementation plan/status
→ contracts/engine/runtime
→ UI
→ tests
→ browser verification
```

<!-- RULE-PROVENANCE-003 | supplied source lines 1412-1412 -->
Never reverse that authority chain.

<!-- RULE-PROVENANCE-004 | supplied source lines 1414-1414 -->
Do not rewrite gameplay rules merely because:

<!-- RULE-PROVENANCE-005 | supplied source lines 1416-1420 -->
- current code behaves differently;
- legacy runtime implements an older rule;
- a registry string is stale;
- a card image contains old copy;
- an unfinished handler lacks the new mechanic.

<!-- RULE-PROVENANCE-006 | supplied source lines 1422-1422 -->
If implementation conflicts with this file, implementation is wrong until the rule itself is explicitly changed.

---

# 50. Local Snapshot Warning

<!-- RULE-RULE-CHANGES-001 | supplied source lines 1428-1428 -->
This file is intended to be kept locally as a stable gameplay-design snapshot.

<!-- RULE-RULE-CHANGES-002 | supplied source lines 1430-1430 -->
When future rule changes are approved:

<!-- RULE-RULE-CHANGES-003 | supplied source lines 1432-1436 -->
1. show the proposed changed wording first;
2. identify exactly which old rule is superseded;
3. receive approval;
4. update the canonical rule file;
5. only then synchronize implementation.

<!-- RULE-RULE-CHANGES-004 | supplied source lines 1438-1438 -->
Do not silently reconcile this file against runtime behavior.

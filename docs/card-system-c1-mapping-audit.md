# Cribbit CHAOS — C1 Card Package Mapping Audit

## Scope

This is the C1 audit for the supplied card package at:

```text
C:\Users\GrowB\Downloads\cribbitgame\cool card
```

It follows the architecture locked in `docs/CARD_SYSTEM_IMPLEMENTATION_PLAN.md`:

- keep the supplied HTML/CSS/JSON design-generation source intact
- keep the supplied PNG fronts as canonical visual assets
- add TypeScript only later for the shared runtime registry/resolver
- do not change backend, PostgreSQL, game rules, Web layout, Telegram layout, or Phase 4 multiplayer scope during C1

## Package validation

| Check | Result |
| --- | --- |
| Manifest records | 112 |
| Master front PNGs | 112 |
| Card backs | 3 |
| Front dimensions | all checked as 1080×1512 |
| Back dimensions | all checked as 1080×1512 |
| Missing manifest IDs | none |
| Missing master PNGs | none |
| Extra master PNGs | none |
| Filename/type mismatches | none |

Back files verified:

```text
back_classic.png
back_chaos_tier.png
back_house_deck.png
```

## Canonical source comparison

The mapping was compared against current repository contracts and action registry:

- `CardKind`: `number`, `skip`, `reverse`, `draw`, `wild`, `truth`, `dare`, `paranoia`, `chaos`, `duel`, `nope`
- `AnswerMode`: `SPEAK`, `TYPE`, `CHOOSE`, `ANSWERED_LIVE`
- `AuthorshipMode`: `SIGNED`, `REVEAL_AFTER`, `TABOO`
- supported safety/social commands include `PASS_PROMPT`, `REWIND_PROMPT`, `FLAG_PROMPT`, `PLAY_NOPE`, `SELECT_ANSWER_MODE`, `MARK_ANSWERED_LIVE`

## Mapping output

The complete 112-row machine-checkable audit is stored in:

```text
docs/card-system-c1-mapping-audit.csv
```

CSV columns:

```text
id, filename, type, family, variant, runtimeRole, engineKind, actionId,
responseMode, authorshipMode, frontAsset, backCategory, ambiguity
```

## Unambiguous mappings

### Playable social cards

- `001`–`010`: `truth`
- `011`–`019`: `dare`
- `020`–`026`: `paranoia`
- `027`–`033`: `chaos`
- `034`–`038`: `duel`

These map directly to existing social `CardKind` values.

### Core/reaction cards

- `039`–`043`: `nope`, `PLAY_NOPE`
- `044`–`047`: `wild`, `PLAY_CARD / SELECT_WILD_COLOR`

### Safety actions

- `048`–`051`: `PASS_PROMPT`
- `052`–`055`: `REWIND_PROMPT`
- `063`: `FLAG_PROMPT`

### Answer modes

- `065`–`067`: `SELECT_ANSWER_MODE`, `SPEAK`
- `068`–`070`: `SELECT_ANSWER_MODE`, `TYPE`
- `071`–`073`: `SELECT_ANSWER_MODE`, `CHOOSE`
- `074`–`076`: `SELECT_ANSWER_MODE / MARK_ANSWERED_LIVE`, `ANSWERED_LIVE`

### Authorship modes

- `081`–`082`: `SIGNED`
- `083`–`084`: `REVEAL_AFTER`
- `085`–`086`: `TABOO`

## Ambiguous / verification-needed mappings

These cards should not be wired as gameplay commands without explicit rule-source confirmation:

- `056`–`057` Roulette: presentation metadata exists, but the card itself is not a `GameCommand`.
- `058`–`059` Spice Dial: no current engine/action command; verify prompt-profile/intensity relationship.
- `060`–`062` Nope Card: proposed as `nope`/`PLAY_NOPE`, but the type label differs from `Nope`.
- `064` Key Rule: rules-reference metadata; no current engine/action command.
- `077`–`080` Voice Only / No Voice: answer constraints are not current `GameCommand` values.
- `087`–`100` stage cards: prompt/profile metadata, not current `GameCommand` cards.
- `101`–`112` intensity cards: prompt/profile metadata, not current `GameCommand` cards.

## Back-category proposal

- `classic`: normal gameplay, reaction, safety, answer, and authorship cards
- `chaos_tier`: roulette, spice, key-rule, stage, and intensity metadata cards
- `house_deck`: not assigned during C1 because no supplied manifest record clearly represents a House Deck runtime card

This back-category assignment is a runtime proposal, not a rule change.

## C1 conclusion

C1 is complete as a package/mapping audit artifact. The supplied package is internally consistent and ready for the next controlled slice, C2, where a shared `packages/cards` TypeScript registry/resolver can be added without replacing the supplied design-generation source or changing gameplay authority.

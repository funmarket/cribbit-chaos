# `@cribbit/cards` — Cribbit CHAOS Card Master

Canonical shared card catalogue, artwork package, and digital reference for the physical Cribbit CHAOS deck.

## Canonical Specification

- **Deck ID:** `CHAOS-133-V1`
- **Playable cards:** **133**
- **Canonical card back:** **1**
- **Colors:** Lime, Orange, Cyan, Purple
- **Consumers:** Web + Telegram + game engine/tests
- **Authority:** this package defines card identity, quantity, assets, and lifecycle metadata — **not gameplay rules**

---

## Source-of-Truth Rule

The card package remains split into separate concerns:

### `design-source/`

Preserves the original design-generation material:

- card templates
- card-back templates
- design tokens
- manifests
- HTML/CSS generation sources
- other source material used to reproduce consistent card artwork

Do **not** delete or convert this material into runtime gameplay code.

It exists so artwork can be regenerated consistently.

### `assets/`

Stores canonical rendered card artwork and any approved deterministic runtime derivatives.

### `src/`

Stores the typed digital card registry used by the application.

### Game Bible / Game Engine

Owns actual gameplay behavior.

The artwork package must never become a second rules engine.

---

## Recommended Repository Layout

```text
packages/cards/
├── assets/
│   └── CHAOS-133-V1/
│       ├── backs/
│       │   └── card_back.jpg
│       └── cards/
│           ├── numbers/
│           │   ├── lime/
│           │   ├── orange/
│           │   ├── cyan/
│           │   └── purple/
│           ├── skip/
│           ├── reverse/
│           ├── draw/
│           ├── wild/
│           ├── truth/
│           ├── dare/
│           ├── paranoia/
│           ├── chaos/
│           ├── duel/
│           ├── nope/
│           ├── tag/
│           ├── truth_or_chaos/
│           ├── hijack/
│           ├── taboo/
│           ├── machiavelli/
│           ├── ghost/
│           ├── reverse_confession/
│           └── Dig_Me/
├── design-source/
├── src/
│   ├── index.ts            # keep/export if already used by package consumers
│   ├── cards.ts
│   └── types.ts
├── test/
├── deck-manifest.json
├── verify-deck.mjs
├── package.json
└── README.md
```

Existing `test/`, `design-source/`, `package.json`, and useful package exports should be preserved and updated rather than discarded.

---

## Canonical Deck Distribution

| Family | Copies |
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

### Number Cards

There are four colors:

- Lime
- Orange
- Cyan
- Purple

Each color contains:

- one `0`
- two copies each of `1–9`

That equals:

- 19 cards per color
- 76 total Number cards

---

## Shared Web + Telegram Rule

Do **not** maintain independent card registries inside:

```text
apps/web
apps/telegram
```

Both frontends must consume the same `@cribbit/cards` package.

This prevents:

- different card counts between platforms
- different artwork paths
- different family names
- Web-only or Telegram-only cards
- duplicated card metadata
- frontend drift

Functional card identity must be shared even when Web and Telegram use different layouts.

---

## Card Registry Responsibility

`src/cards.ts` owns stable digital/physical card metadata such as:

- card master IDs
- card instance IDs
- family
- color
- number/value
- physical copy count
- artwork path
- stable display name
- lifecycle classification

Examples of lifecycle metadata:

- reusable
- exhausted after resolution
- persistent until resolution

Lifecycle metadata describes the card's destination class but does **not** implement turn logic.

---

## What `@cribbit/cards` Must NOT Own

The package must not decide:

- whether a card is legally playable
- whose turn is next
- turn direction changes
- Draw-card penalty size
- targeting legality
- TAG rotation behavior
- Hijack rotation behavior
- Nope compatibility
- Roulette prompt selection
- Truth/Dare resolution
- Duel winner logic
- Chaos effect selection
- Ghost activation behavior
- Machiavelli rule enforcement
- pending interaction state
- timers
- disconnect behavior
- final-card resolution
- winner determination

Those belong to the **Game Bible**, contracts, and server-authoritative game engine.

This boundary prevents card artwork/metadata from becoming a competing gameplay rules source.

---

## Current Special-Card Lifecycle Direction

The current canonical architecture distinguishes:

### Reusable gameplay cards

Return to the normal Discard/recycle system after use:

- Number
- Skip
- Reverse
- Draw
- Wild

### One-use / exhausted cards

Move to the Exhausted Pile after their effect resolves:

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
- Machiavelli
- Reverse Confession
- DIG ME

### Persistent card

- Ghost — moves to its armed/persistent area until its effect resolves

**Exhausted cards are never recycled during the current game.**

The final Game Bible remains authoritative if a lifecycle rule is later intentionally changed.

---

## Artwork Rule

Frontend renderers should display the canonical artwork from this package.

Do **not** recreate card faces independently with Web or Telegram CSS.

CSS may control:

- sizing
- layout
- animation
- shadows
- selection state
- responsiveness

but should not redraw the actual canonical card artwork.

---

## Runtime Derivatives

If performance-specific versions are required, approved derivatives may be generated from the canonical masters.

Examples:

```text
web-medium/
mobile/
thumbnail/
```

Generated derivatives must:

1. come from the canonical `CHAOS-133-V1` artwork;
2. preserve aspect ratio and visual content;
3. use deterministic generation;
4. never become a separate design authority;
5. be reproducible from source.

The exact derivative sizes should be documented by the generation script/tests rather than copied from the obsolete 112-card package.

---

## Digital API Direction

Package consumers should use semantic helpers rather than manually constructing asset paths where possible.

Examples:

```ts
getCardMaster("tag");
getCardsByFamily("truth");
buildDeck();
```

If existing package APIs such as these are still useful:

```ts
getCardDefinition(...)
getCardFrontAsset(...)
getCardBackAsset(...)
getCardGameMapping(...)
```

they may be retained or adapted, but they must resolve against `CHAOS-133-V1` and must not preserve the obsolete 112-card registry.

---

## Manifest

`deck-manifest.json` records the canonical physical artwork inventory.

It should contain enough information to verify:

- expected playable count
- physical asset path
- family
- file size
- file integrity/hash
- invalid or empty files

The manifest is an integrity reference, not a gameplay rule file.

---

## Verification

Run:

```bash
node packages/cards/verify-deck.mjs
```

The verifier should fail when:

- a canonical card file is missing
- a card file is empty
- a known artwork hash unexpectedly changes
- the playable-card count is not 133

It should report a successful deck only when all **133 playable cards are valid**.

---

## Current Artwork Issue

At the time this master was prepared, the supplied archive contained:

- **133 playable file entries**
- **1 card-back file**

but this card artwork was empty (`0 bytes`):

```text
cards/numbers/lime/number_lime_1_02.jpg
```

Replace that artwork before production verification.

After replacing an intentional image, update/regenerate the manifest so its checksum matches the approved replacement.

Do not disable checksum verification merely to make the test pass.

---

## Obsolete Registry Warning

Older versions of `cards.ts` / `types.ts` must not be restored as the canonical registry.

The obsolete version:

- omitted Ghost
- omitted Reverse Confession
- omitted DIG ME from `CardFamily`
- used old action-card quantities
- contained outdated card-role descriptions
- represented an earlier deck rather than `CHAOS-133-V1`

Any useful helper APIs from the old package should be migrated onto the new registry instead of restoring the old counts.

---

## Design Source vs Runtime Source

The package intentionally maintains two legitimate source layers:

```text
DESIGN GENERATION SOURCE
design-source/
        ↓
canonical rendered artwork

RUNTIME CARD REGISTRY
src/cards.ts + src/types.ts
        ↓
Web / Telegram / engine references
```

They serve different responsibilities.

Do not convert the entire design package into TypeScript.

TypeScript is used for runtime card identity and integration. The design-generation sources remain design-generation sources.

---

## Package Integration Principle

The intended relationship is:

```text
@cribbit/cards
      │
      ├── Web frontend
      ├── Telegram frontend
      ├── contracts
      ├── game engine
      └── tests
```

There should be **one canonical deck**, not platform-specific copies.

---

## Authority Order

When sources disagree, use this order:

1. **Final Game Bible** — gameplay rules and mechanics
2. **`CHAOS-133-V1` registry/manifest** — card identities, quantities, artwork
3. **contracts/game engine** — executable implementation of the Bible
4. **frontend presentation**
5. older/legacy code — reference only

Legacy runtime behavior must never override the current Game Bible or canonical deck.

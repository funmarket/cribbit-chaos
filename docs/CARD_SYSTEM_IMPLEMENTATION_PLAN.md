# Cribbit CHAOS — Shared 112-Card System Implementation Blueprint

## Status

- Phase: 3.5 — visual integration / staging
- Active branch: `feature/visual-integration-checkpoint`
- Active PR: #8
- Scope: shared card asset/data architecture for Web + Telegram
- This document does **not** authorize Phase 4 multiplayer implementation.

This is a living implementation blueprint for integrating the supplied 112-card production package into Cribbit CHAOS without changing gameplay rules, backend authority, account architecture, or PostgreSQL schema during the current visual/staging slice.

---

## 1. Source package audit

The supplied package already contains the core ingredients required for a production card system:

```text
01_Card_Masters_1080x1512/
  112 individual front PNGs

02_Card_Backs/
  back_classic.png
  back_chaos_tier.png
  back_house_deck.png

04_Design_Tokens/
  design-tokens.css
  design-tokens.json
  card_manifest.json
  card_template_source.html
  card_back_template_source.html

06_Previews/
  full_deck_grid_preview.html

README.txt
```

Verified package properties:

- exactly 112 card-front PNGs
- every front is exactly `1080 x 1512`
- all 3 card backs are exactly `1080 x 1512`
- `card_manifest.json` contains exactly 112 card records
- `card_template_source.html` is a code-driven renderer for the visual template
- `design-tokens.css/json` define reusable colors, type and layout tokens
- the package is intended to be regenerated from one template + one manifest rather than hand-edited card-by-card

The package README explicitly describes the 112 PNGs as ready to print or import into Telegram/mobile assets.

---

## 2. Template rule — preserve the supplied visual system

The uploaded template is the visual source of truth for the deck unless deliberately revised.

Do not redraw the cards independently in Telegram or Web CSS.

Do not create a second card design system.

Do not replace the supplied fronts with generic HTML/CSS approximations.

The supplied template establishes these visual rules:

- native/mobile utility + cyberpunk aesthetic
- near-black base surface
- subtle grain
- rounded portrait card
- neon family-colored outer frame
- compact Cribbit brand mark
- geometric central family icon
- bold uppercase title
- clear instruction copy
- divider
- optional example/flavor copy
- card ID/footer
- consistent layout across all 112 cards

The correct rule is:

> **Use the supplied rendered card art as the production face asset. Use TypeScript only to select, display, animate and bind those assets to game state.**

The HTML/CSS renderer remains a design-generation artifact. It does not need to be rewritten into TypeScript simply because the app is TypeScript + Vite.

---

## 3. Why the package should not be converted wholesale to TypeScript

The package contains two different concerns:

### Design-generation concern

```text
card_template_source.html
card_back_template_source.html
design-tokens.css
design-tokens.json
card_manifest.json
```

These exist to regenerate art consistently.

They should remain available as source/design tooling.

### Runtime application concern

The application needs to know:

```text
which card definition this is
which image belongs to it
which back should be shown
whether the face is visible
which existing game-engine card/action it maps to
where the card is in game state
```

That runtime layer **should** be TypeScript.

Therefore:

```text
DESIGN TOOLING
HTML/CSS/JSON package
      |
      v
rendered 1080x1512 master PNGs

RUNTIME
TypeScript card registry/resolver
      |
      v
WebCardView / TelegramCardView
```

No benefit comes from recreating the full visual template in TypeScript/CSS at runtime when exact rendered production assets already exist.

---

## 4. Canonical shared card architecture

The desired architecture is:

```text
                   CARD PACKAGE
        manifest + masters + card backs
                         |
                         v
               shared card registry
                         |
              +----------+----------+
              |                     |
              v                     v
        apps/web                 apps/telegram
        WebCardView              TelegramCardView
              |                     |
              +----------+----------+
                         |
                         v
                    Game state
                         |
                         v
                  Railway API later
                         |
                         v
                Railway PostgreSQL
```

Shared card definitions and assets must never fork between Web and Telegram.

Only presentation size/interaction may differ.

---

## 5. Recommended repository layout

Preferred structure:

```text
packages/cards/
  src/
    types.ts
    manifest.ts
    registry.ts
    assetResolver.ts
    deckBacks.ts
    mappings.ts
    index.ts

  assets/
    masters/
      001_truth.png
      002_truth.png
      ...
      112_3.png

    backs/
      back_classic.png
      back_chaos_tier.png
      back_house_deck.png

    generated/
      mobile/
      thumbnail/

  design-source/
    card_manifest.json
    design-tokens.json
    design-tokens.css
    card_template_source.html
    card_back_template_source.html

  README.md
```

If repository-size limits make storing all master PNGs inappropriate, the same logical structure should still be preserved with an asset build/storage strategy. Do not silently invent a CDN or storage system during Phase 3.5.

---

## 6. Canonical runtime types

Use two levels of data.

### CardDefinition

A static definition of one of the 112 catalogue records.

```ts
export interface CardDefinition {
  id: string;
  type: string;
  family: CardFamily;
  title: string;
  instruction: string;
  example?: string;
  variant: number;
  frontAsset: string;
  defaultBack: CardBackKind;
  gameMapping?: GameCardMapping;
}
```

### CardInstance

A live game copy/state reference.

```ts
export interface CardInstance {
  instanceId: string;
  definitionId: string;
  ownerPlayerId?: string;
  zone: 'draw_pile' | 'discard' | 'hand' | 'table' | 'resolved';
  faceUp: boolean;
}
```

The image file is not the gameplay state.

The gameplay state references the definition.

---

## 7. Card families verified in the package

The 112 manifest entries are grouped as follows:

```text
truth        10
Dare          9
paranoia      7
chaos         7
duel          5
nope          8 total
  - Nope      5
  - Nope Card 3
wild          4
pass          4
rewind        4
roulette      2
spice         2
flag          1
keyrule       1
answer       12
voice         4
authorship    6
stage        14
intensity    12
----------------
TOTAL       112
```

More specific manifest type counts:

```text
Truth            10
Dare              9
Paranoia          7
Chaos             7
Duel              5
Nope              5
Wild              4
Pass              4
Rewind            4
Roulette           2
Spice Dial         2
Nope Card          3
Flag (Report)      1
Key Rule           1
Speak              3
Type               3
Choose             3
Answered Live      3
Voice Only         2
No Voice           2
Signed             2
Reveal After       2
Taboo              2
Warm Up            3
Personal           3
Bold               3
Chaos Tier         3
Endgame            2
0                  3
1                  3
2                  3
3                  3
---------------------
TOTAL            112
```

Do not infer additional gameplay behavior from artwork counts alone. The canonical game engine/Bible remains authoritative for what each category actually does.

---

## 8. Game-rule mapping strategy

The manifest currently provides art/content fields such as:

```text
id
type
family
title
instruction
example
variant
image_prompt
```

Do **not** rewrite these values merely to fit the engine.

Instead add a separate mapping layer owned by code:

```ts
export interface GameCardMapping {
  engineKind?: CardKind;
  actionId?: string;
  responseMode?: string;
  ruleRole?: 'playable-card' | 'safety-action' | 'answer-mode' | 'metadata' | 'stage' | 'intensity';
}
```

Example conceptually:

```ts
'001' -> { engineKind: 'truth', ruleRole: 'playable-card' }
'011' -> { engineKind: 'dare', ruleRole: 'playable-card' }
'020' -> { engineKind: 'paranoia', ruleRole: 'playable-card' }
'027' -> { engineKind: 'chaos', ruleRole: 'playable-card' }
'034' -> { engineKind: 'duel', ruleRole: 'playable-card' }
'039' -> { engineKind: 'nope', ruleRole: 'playable-card' }
'048' -> { actionId: 'PASS_PROMPT', ruleRole: 'safety-action' }
'052' -> { actionId: 'REWIND_PROMPT', ruleRole: 'safety-action' }
'063' -> { actionId: 'FLAG_PROMPT', ruleRole: 'safety-action' }
```

Exact mapping must be validated against current `packages/game-engine`, action registry, contracts and canonical Game Bible before implementation.

Never make the manifest itself authoritative over game rules.

---

## 9. Front/back behavior

Each card needs a definition-level back category and an instance-level visibility state.

Back categories supplied:

```text
classic
chaos_tier
house_deck
```

Recommended rendering rule:

```text
own hand           -> front
opponent hand      -> back
hidden draw pile   -> back
active discard     -> front
revealed challenge -> front
unrevealed secret  -> back
```

Never store or send a hidden opponent card face to the client merely to render its back if the authoritative multiplayer model later considers that information secret.

The server should eventually send only information the client is allowed to know.

---

## 10. Asset sizing strategy for Web + Telegram

Keep the master source untouched:

```text
master: 1080 x 1512
```

Generate deterministic derivatives from the exact same master art.

Recommended starting sizes:

```text
master      1080 x 1512   archive / zoom / high DPI
web-medium   540 x 756    board / enlarged card
mobile       360 x 504    Telegram board/detail
thumbnail    216 x 302    hand/card rail
```

Prefer WebP/AVIF derivatives for runtime delivery if visual QA confirms the output is faithful.

Keep PNG masters as canonical art.

Do not independently re-render the template for each app.

Both applications should resolve the same card definition into the most appropriate derivative.

---

## 11. Shared TypeScript asset resolver

Use one resolver in `packages/cards`.

Conceptual API:

```ts
getCardDefinition(id)
getCardFrontAsset(id, size)
getCardBackAsset(backKind, size)
getCardGameMapping(id)
getCardsByFamily(family)
```

Both frontends import the same resolver.

Telegram does not maintain its own card-path table.

Web does not maintain its own card-path table.

---

## 12. Telegram renderer

Telegram should render the **actual supplied card face asset**, not recreate its content in CSS.

Conceptual structure:

```ts
<CardImage
  definitionId="001"
  size="thumbnail"
  face="front"
/>
```

Telegram-specific responsibilities:

- choose `thumbnail` or `mobile` asset size
- horizontal hand rail
- selected-card lift/glow
- lazy loading
- touch interactions
- full-card inspect modal/sheet if needed
- show correct back when face is hidden

Telegram must not own card rules.

---

## 13. Web renderer

Web uses the exact same definitions/assets.

Web-specific responsibilities may include:

- larger card dimensions
- hover/focus preview
- fan/spread layout
- card flip animation
- larger inspect modal

It still resolves assets through `packages/cards`.

---

## 14. Backend/API rule

No new card-art API is required for Phase 3.5.

The frontend may bundle or statically serve the runtime card assets.

Long-term authoritative gameplay should reference stable definition IDs, not image file names as rule semantics.

Correct direction:

```text
Game state / command
  definitionId: "001"
        |
        +--> engine mapping
        |
        +--> frontend asset resolver
```

Do not send rule decisions from the image manifest to the server dynamically.

Do not make PNG filenames the source of gameplay truth.

---

## 15. Database rule

No PostgreSQL migration is required merely to introduce these assets.

If future persistent game records need a card identifier, use the stable definition ID/reference already carried in authoritative game state/contracts rather than storing the binary image or presentation metadata in PostgreSQL.

The current Phase 3.5 card integration must not add database tables just for artwork.

---

## 16. Package source preservation

Preserve these files exactly as supplied inside a design-source/archive location:

```text
card_manifest.json
design-tokens.css
design-tokens.json
card_template_source.html
card_back_template_source.html
```

They are valuable because the package is already code-driven.

If the deck later needs a global visual change, regenerate all 112 cards from the same design template instead of manually altering PNGs.

---

## 17. Required validation before runtime integration

Before adding the 112 assets to app source, perform these controlled checks:

1. verify filenames 001–112 are complete with no gaps
2. verify every manifest ID has exactly one front PNG
3. verify every PNG is 1080x1512
4. verify all three backs are 1080x1512
5. verify title/type/family/variant match filename and manifest entry
6. compare manifest semantics with canonical Game Bible
7. compare playable families with `packages/game-engine` `CardKind`
8. compare safety/answer actions with `packages/action-registry`
9. classify every one of the 112 entries as gameplay card, safety UI card, answer mode, authorship mode, stage card, intensity card, or presentation/metadata card
10. produce a machine-checkable audit report before changing the frontend renderer

Do not guess mappings for ambiguous entries.

---

## 18. Controlled implementation slices

### C1 — Package audit and mapping report

- ingest the 112 manifest records
- validate filenames/dimensions
- classify every entry
- map only clearly supported entries to existing engine/actions
- list ambiguous entries for explicit rule-source verification
- no UI change

### C2 — Shared `packages/cards` foundation

- add runtime types
- add normalized manifest import/data
- add registry/resolver
- add back definitions
- add tests for all 112 records
- no Telegram/Web visual replacement yet

### C3 — Asset ingestion / optimization

- add canonical masters or approved asset storage arrangement
- generate deterministic mobile/web/thumbnail derivatives
- verify visual parity against masters
- preserve exact supplied visual design

### C4 — Telegram integration

Replace the temporary CSS-generated card renderer with actual card assets selected by shared definition IDs.

Preserve:

- existing card action hooks
- horizontal hand behavior
- board layout
- contextual rule UI
- demo fixture semantics

### C5 — Web integration

Replace any non-canonical card approximation with the same shared asset/definition system while preserving Web composition.

### C6 — Cross-client validation

Prove:

```text
same definition ID
 -> same card face
 -> same game mapping
 -> same backend semantics
```

while Telegram and Web retain different layouts.

---

## 19. Current T6 relationship

This card-system work is a correction inside T6 because the real-device Telegram test exposed the wrong card presentation.

Do not mark T6 complete until Telegram is rendering the supplied canonical cards correctly on a real device.

The first implementation step from this blueprint was **C1 — package audit and mapping report**.

C1 happened before importing/replacing runtime card assets because the 112 catalogue contains multiple categories beyond directly playable hand cards.

The completed C1 artifacts are:

```text
docs/card-system-c1-mapping-audit.md
docs/card-system-c1-mapping-audit.csv
```

The completed C2 runtime foundation added:

```text
packages/cards/src/types.ts
packages/cards/src/manifest.ts
packages/cards/src/registry.ts
packages/cards/src/assetResolver.ts
packages/cards/src/deckBacks.ts
packages/cards/src/mappings.ts
packages/cards/test/card-registry.test.ts
```

The completed C3 asset ingestion added:

```text
packages/cards/assets/masters/
packages/cards/assets/backs/
packages/cards/assets/generated/web-medium/
packages/cards/assets/generated/mobile/
packages/cards/assets/generated/thumbnail/
packages/cards/design-source/
packages/cards/test/card-assets.test.ts
docs/card-system-c3-asset-ingestion.md
```

---

## 20. Non-negotiable guardrails

1. GitHub remains canonical source of truth.
2. Preserve the supplied template/design; do not redesign it in code.
3. Do not convert the HTML/CSS art generator to TypeScript without a concrete engineering reason.
4. Runtime registry/resolver should be TypeScript.
5. One shared 112-card definition system for Web + Telegram.
6. Different frontend layouts, same card definitions/assets.
7. Game Bible / engine / action contracts override concept-art wording if conflict exists.
8. No gameplay logic inside image renderer code.
9. No direct PostgreSQL access from clients.
10. No database migration for artwork-only integration.
11. No Phase 4 multiplayer implementation during this card visual correction.
12. Do not guess ambiguous card-to-rule mappings; verify them.
13. Preserve all 112 master fronts and all supplied backs.
14. Use stable definition IDs rather than filenames as gameplay semantics.
15. Complete machine-checkable package audit before frontend replacement.

---

## Completed Card Tasks

**C1 — Audit all 112 supplied card definitions and map them to the existing canonical game-rule/action taxonomy.**

The audit report contains every manifest ID, filename, type, family, variant, proposed runtime role, proposed engine/action mapping where unambiguous, card-back category, and any ambiguity requiring canonical rule verification. It did not alter backend, database, game rules, Web layout, Telegram layout, or Phase 4 multiplayer scope.

**C2 — Shared `packages/cards` foundation.**

The shared runtime package now exposes typed card definitions, normalized 112-record catalogue data, registry/resolver helpers, game-rule/action mappings, card-back definitions, and tests that cover all 112 records. It does not ingest master PNG assets into the repo and does not replace Web or Telegram rendering yet.

**C3 — Asset ingestion / optimization.**

The supplied canonical `1080×1512` PNG fronts and backs are now preserved in `packages/cards/assets`, the design-generation source is preserved in `packages/cards/design-source`, and deterministic PNG derivatives exist for `web-medium`, `mobile`, and `thumbnail`. Asset tests verify counts and dimensions. Web/Telegram rendering is not replaced yet.

---

## Current Next Card Task

**C4 — Telegram integration.**

Replace the temporary CSS-generated Telegram card faces with actual supplied card assets selected through the shared `packages/cards` registry/resolver. Preserve existing card action hooks, horizontal hand behavior, board layout, contextual rule UI, demo fixture semantics, and Telegram mobile/safe-area constraints. Do not start Phase 4 multiplayer.

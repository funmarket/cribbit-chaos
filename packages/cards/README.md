# `@cribbit/cards`

Shared card catalogue, mapping, and asset package for Cribbit CHAOS Web and Telegram.

## Source-of-truth rule

The supplied card package remains split into two concerns:

- `design-source/` preserves the original manifest, design tokens, and HTML/CSS generation templates.
- `assets/` stores the canonical rendered PNG card art and deterministic runtime derivatives.

Do not recreate the card faces in Web or Telegram CSS. Frontend renderers should resolve card definitions and image paths from this package.

## Asset layout

```text
assets/
  masters/                  112 PNG fronts, 1080×1512
  backs/                    3 PNG backs, 1080×1512
  generated/
    web-medium/fronts/      112 PNG fronts, 540×756
    web-medium/backs/       3 PNG backs, 540×756
    mobile/fronts/          112 PNG fronts, 360×504
    mobile/backs/           3 PNG backs, 360×504
    thumbnail/fronts/       112 PNG fronts, 216×302
    thumbnail/backs/        3 PNG backs, 216×302
```

## Runtime API

```ts
getCardDefinition('001');
getCardFrontAsset('001', 'mobile');
getCardBackAsset('classic', 'thumbnail');
getCardGameMapping('001');
getCardsByFamily('truth');
```

The returned paths are package-local logical paths. C4/C5 will decide how Web and Telegram import or serve them in each frontend bundle.

## Generation note

C3 derivatives were generated from the supplied PNG masters with deterministic `ffmpeg` Lanczos scaling:

```text
web-medium: 540×756
mobile:     360×504
thumbnail:  216×302
```

The C3 tests verify asset counts and PNG dimensions. They do not approve a new visual design; the canonical masters remain the supplied `1080×1512` art.

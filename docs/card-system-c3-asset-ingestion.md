# Cribbit CHAOS — C3 Card Asset Ingestion / Optimization

## Scope

C3 ingested the supplied canonical card package into `packages/cards` and generated deterministic runtime derivatives.

No renderer replacement happened in C3. Telegram and Web still need C4/C5 to actually display these images.

No backend, database, game-rule, Railway, Vercel, Cloudflare, auth, or Phase 4 multiplayer work happened in C3.

## Source package

```text
C:\Users\GrowB\Downloads\cribbitgame\cool card
```

## Repository destination

```text
packages/cards/
  assets/
    masters/
    backs/
    generated/
      web-medium/
      mobile/
      thumbnail/
  design-source/
```

## Preserved design-generation source

Copied into `packages/cards/design-source/`:

```text
card_manifest.json
design-tokens.json
design-tokens.css
card_template_source.html
card_back_template_source.html
```

These remain design-generation source. They were not converted wholesale to TypeScript.

## Canonical masters

Copied into `packages/cards/assets/masters/`:

- 112 card front PNGs
- all verified as `1080×1512`

Copied into `packages/cards/assets/backs/`:

- `back_classic.png`
- `back_chaos_tier.png`
- `back_house_deck.png`
- all verified as `1080×1512`

## Generated runtime derivatives

Generated from the canonical masters/backs:

| Size | Fronts | Backs | Dimensions |
| --- | ---: | ---: | --- |
| `web-medium` | 112 | 3 | `540×756` |
| `mobile` | 112 | 3 | `360×504` |
| `thumbnail` | 112 | 3 | `216×302` |

Generation method:

```text
ffmpeg scale=<width>:<height>:flags=lanczos
```

The generated files are PNG derivatives. The supplied `1080×1512` PNG masters remain canonical.

## Verification

Added `packages/cards/test/card-assets.test.ts`.

The test verifies:

- 112 canonical master fronts exist
- 3 canonical backs exist
- every master front is `1080×1512`
- every canonical back is `1080×1512`
- every generated derivative set has 112 fronts and 3 backs
- every `web-medium` derivative is `540×756`
- every `mobile` derivative is `360×504`
- every `thumbnail` derivative is `216×302`
- all design-source files required for future regeneration are preserved

## C3 conclusion

C3 is complete as an asset ingestion and deterministic derivative-generation slice.

The next controlled card task is C4: Telegram integration, replacing the temporary CSS-generated Telegram card faces with these supplied canonical assets through the shared `packages/cards` registry/resolver while preserving existing Telegram layout and action hooks.

# Cribbit CHAOS — Card System Implementation Plan

## Status

This document is **retired as a current implementation blueprint**.

It previously described an obsolete visual-card package and must not be used as deck, rule, asset, or runtime authority for current Cribbit CHAOS work.

## Current canonical deck authority

The current canonical physical deck is `CHAOS-133-V1`.

The game starts from exactly **133 playable physical card instances**.

Current source-of-truth files:

- `packages/cards/src/cards.ts` — canonical physical card registry and family counts.
- `packages/cards/deck-manifest.json` — canonical asset manifest bound to `CHAOS-133-V1`.
- `packages/game-engine/src/deck.ts` — engine deck builder importing the canonical card registry.
- `packages/cards/test/card-registry.test.ts` — registry/count guard.
- `packages/cards/test/card-assets.test.ts` — asset manifest/integrity guard.
- `packages/game-engine/test/deck-composition.test.ts` — engine deck composition guard.
- `packages/cards/test/deck-docs-consistency.test.ts` — live-doc consistency guard.

## Current implementation rule

Use `packages/cards` and `packages/game-engine` as the shared card/deck authority for Web and Telegram.

Client-local deck builders and historical visual-package records are transitional debt unless they resolve to the canonical `CHAOS-133-V1` registry.

## Replacement references

Use these current project-control documents instead:

- `README.md`
- `PLAN.md`
- `docs/LIVING_STATUS.md`
- `chaosfixplan.md`
- `packages/cards/README.md`

# Cribbit CHAOS Living Status

Last verified source branch: `feature/visual-integration-checkpoint`

This file is the concise runtime/project status companion to `README.md`, `PLAN.md`, and `AGENTS.md`. All four must remain synchronized with verified reality.

## Source of truth

GitHub is canonical for deployable source, game rules, documentation, and implementation status.

## Current product state

- Web and Telegram are two clients of one Cribbit CHAOS game.
- Railway API/PostgreSQL remain the authoritative backend/data boundary.
- Web contains the most complete playable visual/mechanical prototype and remains the temporary card-visual baseline while mechanics are stabilized.
- Final card-art polish is intentionally deferred until the mechanics are coherent and verified.
- Telegram's PNG-based card renderer has been replaced in source with the Web-style HTML/CSS card presentation. Telegram no longer needs the PNG card assets for its card renderer.
- The PNG asset package has not yet been deleted because the replacement must pass CI/build verification first under the mandatory workflow.

## Canonical playable deck

The production target is exactly 112 playable cards:

- 92 colored engine cards
  - per color: 0 x1, 1-9 x2, Skip x1, Reverse x1, Draw x2
- Wild x4
- Truth x3
- Dare x3
- Paranoia x3
- Chaos x3
- Duel x2
- Nope x2

Pass, Rewind, Flag, Spice Dial, Speak, Type, Choose, and Answered Live are controls/systems, not hand-card inventory.

The shared `packages/game-engine/src/deck.ts` now builds this 112-card composition and exposes canonical count constants.

## Verification state

Latest inspected CI result after the shared-deck change and Telegram renderer change:

- TypeScript typecheck: PASS
- Test suite: FAIL because three pre-existing assertions in `packages/game-engine/test/core-engine.test.ts` still expect the previous 104-card core deck and two Skip/Reverse copies per color
- Web/Telegram/API builds: skipped by CI after the failing test step

The failure is stale-test debt, not evidence that the new deck generated the wrong size: CI reports actual deck size 112 against old expected 104.

## Active migration order

1. Repair stale core-engine deck assertions to the canonical 112 composition while preserving the rest of the engine test coverage.
2. Run full typecheck/tests/build:web/build:telegram/build:api.
3. Correct the temporary Web legacy runtime's local 128-card builder so the Web runtime uses the same canonical 112 distribution.
4. Verify Web gameplay with the canonical deck.
5. Verify Telegram's Web-style card presentation and shared mechanics boundary.
6. Remove obsolete PNG card assets, PNG resolver/registry pieces, asset integrity tests, and superseded card-system documentation only after reference checks prove nothing live depends on them.
7. Remove any remaining duplicate client-local deck/rule implementations.
8. Tune gameplay rules, buttons, contextual display, pacing, timers, Chaos/Duel/Nope behavior.
9. Add audio comments/effects after stable semantic game events exist.
10. Polish/finalize card art after mechanics are proven.

## Current next task

**M1.1b — Remove stale 104-card test assumptions and green the canonical 112 shared engine.**

Do not delete the PNG package until the replacement path has passed the relevant builds. The no-stale-debt rule requires deletion in the same completed migration slice, but only after verified replacement rather than before it.

## No-stale-debt reminder

Each completed slice must remove temporary, duplicate, dead, conflicting, recovery, debug, or superseded resources whenever technically possible. Anything intentionally retained must have a live dependency or documented removal path.

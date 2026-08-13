# Cribbit CHAOS Living Status

Last verified source branch: `feature/visual-integration-checkpoint`

This file is a concise runtime/project status companion to `README.md`, `PLAN.md`, and `AGENTS.md`. All four must remain synchronized.

## Source of truth

GitHub is canonical for deployable source, game rules, documentation, and implementation status.

## Current product state

- Web and Telegram are two clients of one Cribbit CHAOS game.
- Railway API/PostgreSQL remain the authoritative backend/data boundary.
- Web currently contains the most complete playable visual/mechanical prototype.
- Telegram currently has a separate card-art presentation that is temporary and may be removed after Telegram migrates to the shared canonical game/card system.
- Final card-art polish is intentionally deferred until the mechanics are coherent and verified.

## Current mechanics finding

The old Web runtime has the correct card families but currently generates a 128-card playable deck because of duplicated Skip/Reverse cards and excess social cards.

The canonical production target is 112 playable cards:

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

## Active migration order

1. Correct Web/shared deck composition to canonical 112 and add deterministic composition tests.
2. Verify Web game behavior with the corrected deck.
3. Remove or document superseded Web deck/rule duplication.
4. Migrate Telegram to consume the exact same shared card IDs/rules/state.
5. Remove obsolete Telegram-only card-art/runtime resources after reference checks prove them unused.
6. Tune gameplay rules, buttons, contextual display, pacing, timers, Chaos/Duel/Nope behavior.
7. Add audio comments/effects after stable semantic game events exist.
8. Polish/finalize card art after mechanics are proven.

## Current next task

**M1.1 — Canonical 112-card Web/shared deck correction.**

Correct the shared engine and temporary Web runtime to the 112-card production distribution, add a regression test for total and per-family counts, then run/verify the relevant test/build checks before starting Telegram migration.

## No-stale-debt reminder

Each completed slice must remove temporary, duplicate, dead, conflicting, recovery, debug, or superseded resources whenever technically possible. Anything intentionally retained must have a live dependency or documented removal path.

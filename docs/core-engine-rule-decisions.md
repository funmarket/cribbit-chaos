# Core engine rule decisions

This note records the Phase 1 gameplay choices that were implemented while translating the approved reference behavior into the authoritative TypeScript reducer.

## Canonical setup

- Starting hand size is 7 cards.
- The starter discard is chosen as the first numbered card found in the shuffled deck, with a fallback to the last card if the deck ever contains no numbered card.
- The core deck is the standard colored action deck for this slice: per color, one 0, two each of 1 through 9, two each of Skip / Reverse / Draw, plus 4 Wild cards.

## Turn and card behavior

- Number cards are legal when either the color or the symbol matches the current discard state.
- Skip advances past the next player.
- Reverse flips direction, and in a two-player game it effectively returns the turn to the same player.
- Draw gives the next player the configured penalty amount.
- Wild pauses the turn until a color is selected.
- Selecting a Wild color clears the pending effect and then completes the turn.
- A player who empties their hand wins immediately once the play or Wild-color selection is resolved.

## Engine knobs

- Draw penalty defaults to 2 cards, but it remains a configuration value so the rule can be tuned without changing the reducer shape.
- Voluntary drawing is disabled by default in this slice.

## Determinism and idempotency

- Deck generation, shuffling, and starter-card selection are deterministic from the seed.
- Successful commands are cached by command id so a replayed command does not mutate state a second time.
- Draw recycling preserves the top discard card and reshuffles only the recyclable portion of the discard pile.

## Test runner decision

- The test script uses `tsx --test` instead of `node --experimental-strip-types`.
- GitHub Actions in this repo runs Node 20, so the native strip-types path is not a reliable CI choice here.
- `tsx` is already declared in the workspace devDependencies and runs the TypeScript test file directly without changing the supported CI runtime.

## Deferred by design

Social cards, safety cards, multiplayer transport, and API wiring are intentionally out of scope for this slice.

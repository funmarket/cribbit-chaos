# Visual integration checkpoint

This checkpoint makes the approved Cribbit CHAOS V4 look visible again inside the shared UI while keeping gameplay authority out of the client.

## What changed

- The shared UI now accepts a visual fixture name from the web query string or Telegram start parameter.
- The legacy runtime can seed deterministic fixture states for preview purposes without introducing new gameplay authority.
- Legacy preview runtime reuse is preview/demo compatibility only.
- No authoritative gameplay logic was migrated into `packages/legacy-runtime`.
- The fixture layer exists only to make the approved V4 interface inspectable now.
- Web and Telegram both render the same shared UI surfaces for:
  - board
  - hand
  - draw pile
  - discard pile
  - social interaction modals
  - private/public control affordances
- A dev-only fixture cycle control is available in local preview so the shared fixtures can be reviewed quickly.

## Fixture set

- `standard`
- `social`
- `paranoia`
- `duel`
- `chaos`
- `mobile`

## Verified preview surfaces

- Desktop web preview
- Mobile web preview
- Telegram Mini App preview
- Telegram safe-area preview with mocked insets

## Verified visual coverage

- approved V4 visual migration into shared UI
- fixture-state renderer
- board / hand / draw / discard visual verification
- social modal / control visual verification
- mobile visual QA
- desktop visual QA
- Telegram safe-area QA
- shared Web ↔ Telegram visual parity
- no client gameplay authority
- no fake multiplayer state
- no production auth

## Animation QA results

- hand/card hover lift is present on the live board
- playing a legal card animates into the normal board transition flow
- social answer tiles animate on hover and keep the modal presentation readable
- roulette result selection is sealed before the wheel spins
- roulette spin is visual-only and resolves to the preselected prompt afterward
- board transitions remain present only as presentation; they do not decide state

## Visual proof notes

- Local web preview was verified against `http://127.0.0.1:5173`
- Standard fixture showed legal-card hover and board play transition
- Social fixture showed the prompt modal and answer tiles
- Roulette was verified by playing Truth, observing `PROMPT PRESELECTED`, starting the wheel spin, and confirming the prompt reveal followed the sealed selection

## Still open

- development Telegram bot / Mini App staging configuration
- Vercel web staging
- Vercel Telegram staging
- production deployment proof for the dedicated Vercel staging projects

## Fixture / legacy-runtime boundary

- `packages/game-engine` remains the authoritative rules source.
- `packages/legacy-runtime` is only a preview compatibility layer for fixture rendering while Phase 3.5 is in progress.
- The fixture layer is not multiplayer simulation.
- The fixture layer is not the future client runtime.
- The fixture layer will be replaced when Phase 7 connects clients to the server engine.
- No new game logic should be moved into the legacy runtime as part of this checkpoint.

## Notes

- The fixture renderer is for preview and QA only; it does not replace server-authoritative gameplay.
- The approved V4 design language remains the baseline. This checkpoint migrates it into the shared UI without redesigning it.
- Legacy preview runtime reuse is compatibility infrastructure, not authoritative gameplay migration.

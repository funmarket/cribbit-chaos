# Visual integration checkpoint

This checkpoint makes the approved Cribbit CHAOS V4 look visible again inside the shared UI while keeping gameplay authority out of the client.

## What changed

- The shared UI now accepts a visual fixture name from the web query string or Telegram start parameter.
- The legacy runtime can seed deterministic fixture states for preview purposes without introducing new gameplay authority.
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

## Still open

- development Telegram bot / Mini App staging configuration
- Vercel web staging
- Vercel Telegram staging

## Notes

- The fixture renderer is for preview and QA only; it does not replace server-authoritative gameplay.
- The approved V4 design language remains the baseline. This checkpoint migrates it into the shared UI without redesigning it.

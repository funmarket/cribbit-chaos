# Visual integration checkpoint


> **HISTORICAL / COMPATIBILITY REFERENCE — NOT CURRENT EXECUTION AUTHORITY.** This document preserves the Phase 3.5 visual-integration checkpoint. Current recovery branch/task/status live in `HANDOFF.md`, `docs/LIVING_STATUS.md`, and `PLAN.md`.

This was the living Phase 3.5 control document at the time of the checkpoint; it is now historical evidence.

This checkpoint makes the approved Cribbit CHAOS V4 look visible inside the shared UI while keeping gameplay authority out of the client.

## What changed

- The shared UI accepts a visual fixture name from the Web query string or Telegram start parameter.
- The legacy runtime can seed deterministic fixture states for preview purposes without introducing new gameplay authority.
- Legacy preview runtime reuse is preview/demo compatibility only.
- No authoritative gameplay logic was migrated into `packages/legacy-runtime`.
- The fixture layer exists only to make the approved V4 interface inspectable during Phase 3.5.
- Web and Telegram both render the same shared UI surfaces for board, hand, draw pile, discard pile, social interaction modals, and private/public control affordances.
- A dev-only fixture cycle control is available in local preview so the shared fixtures can be reviewed quickly.

## Fixture set

- `standard`
- `social`
- `paranoia`
- `duel`
- `chaos`
- `mobile`

## Verified preview surfaces

- Desktop Web preview
- Mobile Web preview
- Telegram Mini App preview
- Telegram safe-area preview with mocked insets

## Historical primary staging evidence

GitHub branch:

- `feature/visual-integration-checkpoint`

Primary Cloudflare Web:

- project: `cribbit-chaos-web`
- URL: `https://cribbit-chaos-web.pages.dev`
- Git integration: `funmarket/cribbit-chaos`
- build command: `npm run build:web`
- output: `apps/web/dist`
- checkpoint production deployment: successful

Primary Cloudflare Telegram:

- project: `cribbit-chaos-telegram`
- URL: `https://cribbit-chaos-telegram.pages.dev`
- Git integration: `funmarket/cribbit-chaos`
- build command: `npm run build:telegram`
- output: `apps/telegram/dist`
- checkpoint production deployment: successful

Both primary clients are configured with the shared Railway API/WS URL:

- `https://api-production-2556.up.railway.app`

Railway accepts the exact two Cloudflare production origins.

At this checkpoint, non-Cloudflare deployments were not the Phase 3.5 staging source and did not block progress.

## Telegram launch status

- Bot username: `@CribbitChaos_bot`
- Main Mini App configured to the checkpoint Cloudflare URL? `no`
- live Mini App auth verified? `no`
- remaining step: configure a regenerated Railway-only bot token, point BotFather Main Mini App to `https://cribbit-chaos-telegram.pages.dev`, then perform live auth proof

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
- production guest auth fail-closed

## Animation QA results

- hand/card hover lift is present in the preview board
- playing a legal fixture card animates through the normal board transition flow
- social answer tiles animate on hover and keep the modal presentation readable
- roulette result selection is sealed before the wheel spins
- roulette spin is visual-only and resolves to the preselected prompt afterward
- board transitions remain presentation only; they do not decide authoritative state

## Historical live-proof status

Local and prior staging visual QA has passed. After PR #8 merged to `main`, the Cloudflare production URLs returned HTTP `200` and their top-level HTML loaded without the old direct `canonical-game-runtime` bootstrap strings. Full browser visual/runtime click-through is still pending because HTTP/readback is not the same as rendered interaction proof.

Historical next visual task at this checkpoint:

- open `https://cribbit-chaos-web.pages.dev`
- confirm the approved V4 interface renders
- confirm HTML/JS/CSS load correctly
- confirm the client can reach the Railway API without CORS/runtime failure
- record the exact visible/runtime result
- fix only defects discovered by that test

Then repeat the equivalent visual smoke test for `https://cribbit-chaos-telegram.pages.dev` before closing Phase 3.5 visual staging.

## Fixture / legacy-runtime boundary

- `packages/game-engine` remains the authoritative rules source.
- `packages/legacy-runtime` is only a preview compatibility layer for fixture rendering while Phase 3.5 is in progress.
- the fixture layer is not multiplayer simulation
- the fixture layer is not the future client runtime
- the fixture layer will be replaced when Phase 7 connects clients to the server engine
- no new game logic should be moved into the legacy runtime as part of this checkpoint

## Notes

The approved V4 design language remains the baseline. This checkpoint migrates it into the shared UI without redesigning it.

Do not update this historical checkpoint as current execution state. Record new visual/runtime evidence in the living recovery documents and any newly authorized implementation record.

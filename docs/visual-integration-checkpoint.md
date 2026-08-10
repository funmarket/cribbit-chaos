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

## Staging evidence

### Vercel Web

- Project: `cribbit-chaos-web`
- Project ID: `prj_K6SAnoJOLLkGcrHslIfQ7l6buqXH`
- Deployment ID: `dpl_Ai6ZZRDPVM6d6FhYdxDv7J43FKxo`
- Staging URL: `https://cribbit-chaos-1wucz1c70-wise2030.vercel.app`
- Source branch: `feature/visual-integration-checkpoint`
- Source commit: `048314a2996582c8cd44acfbe0e7a885007c5e91`
- Verification result: deployed successfully; live HTML fetch returned the app shell. Headless browser access in this environment still hits the Vercel login wall, so the browser proof is limited here.

### Vercel Telegram

- Project: `cribbit-chaos-telegram`
- Project ID: `prj_zuoFsp76d0jEUFNHbFxCAbxB57D9`
- Deployment ID: `dpl_DfV2M6fc8aQLkk2vXD8g2yamg2V6`
- Staging URL: `https://cribbit-chaos-telegram-qw4guoi0r-wise2030.vercel.app`
- Source branch: `feature/visual-integration-checkpoint`
- Source commit: `048314a2996582c8cd44acfbe0e7a885007c5e91`
- Verification result: deployed successfully; live browser verification of the deployed Telegram bundle passed in the browser session used for this checkpoint, and the current deployment uses the same commit-built artifact.

### Telegram launch status

- Bot username: `@CribbitChaos_bot`
- Main Mini App configured? `no`
- Launch verified? `no`
- Exact manual step remaining: connect `@CribbitChaos_bot` in BotFather / Mini App settings to the Telegram staging URL above.

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
- Live Telegram preview screenshot verified the deployed mobile layout and fixture badge on the staging URL
- Live web deployment HTML was fetched successfully for the staging URL, but browser access remained blocked by the Vercel auth wall in this environment

## Still open

- Telegram BotFather / Main Mini App linking

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

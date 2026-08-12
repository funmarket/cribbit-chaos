# Cribbit CHAOS Implementation Plan

## Project control rules

This file is a living project-control document. It must describe the current verified project state, not historical assumptions.

1. GitHub is the canonical source of truth for deployable source and project documentation.
2. After every implementation slice, update `PLAN.md` and every affected architecture, deployment, auth, database, testing, or environment document in the same controlled slice.
3. If the active PR scope or status changed, update the PR description before starting the next implementation slice.
4. Remove resolved blockers and obsolete instructions immediately. Never leave a completed task as `Current Next Task`.
5. At the end of each phase, preserve a concise completion summary, collapse unnecessary completed detail, and move active focus to the next unfinished phase.
6. Runtime/deployment claims must be based on verified GitHub/platform state, not assumptions.
7. If documentation and verified runtime state disagree, correct documentation before further implementation.
8. Do not start the next phase while required blockers for the active phase remain.
9. Do not redesign Cribbit CHAOS without explicit authorization. The approved visual language remains the baseline; Telegram now has an explicitly approved mobile-specific composition target documented in `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`.
10. Never use or mutate the separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) for Cribbit CHAOS.

## Canonical architecture

```text
GitHub
source of truth
    |
    +--> Cloudflare Pages Web
    |      desktop / large-screen Web presentation
    |
    +--> Cloudflare Pages Telegram
           Telegram/mobile presentation
                 \
                  Railway API
                      |
               Railway PostgreSQL

Vercel Web + Telegram = secondary/fallback deployments only
```

Current verified deployment targets:

- Web primary: `https://cribbit-chaos-web.pages.dev`
- Telegram primary: `https://cribbit-chaos-telegram.pages.dev`
- API: `https://api-production-2556.up.railway.app`
- Railway project: `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`)
- Railway production environment: `60d848a2-a7df-4145-a2ec-757a5ec4dc31`
- Railway API service: `c255714c-95a2-4194-8bb0-e1846a5e4cf1`
- Railway PostgreSQL service: `951b9c62-7cd3-404b-b9f0-c93e2c2a51d7`

Both primary clients use the same Railway API and the same Railway PostgreSQL database. There is one canonical internal `users.id` UUID per Cribbit account.

Presentation rule:

- Web and Telegram may use different page/layout composition.
- Web and Telegram must keep shared identity, backend, database, game rules, contracts, and persistent state semantics.

## Phase 0 — Repository foundation — COMPLETE

Completed: private GitHub repo, monorepo, Vite Web and Telegram builds, Railway API scaffold, PostgreSQL schema foundation, button/action audit, CI, and repository cleanup.

## Phase 1 — Authoritative core game engine — COMPLETE

Completed: canonical state/card/player/command/event models, deterministic setup, legal-play validation, classic actions, wild flow, turn progression, zero-card win, idempotency, and transition tests.

## Phase 2 — Social card engine — COMPLETE

Completed: Truth, Dare, Paranoia, Duel, Chaos, Nope reaction, prompt eligibility, sealed prompt selection, roulette presentation contract, and authorship modes.

## Phase 3 — Safety & answers — COMPLETE

Completed: Pass, Rewind, Flag, Speak, Type, Choose, Answered Live, timers, and timeout resolution.

## Phase 3.5 — Visual integration + shared staging — IN PROGRESS

Completed and verified:

- [x] approved V4 visual migration into shared UI
- [x] fixture-state renderer
- [x] Web visual preview
- [x] Telegram Mini App launches inside Telegram
- [x] Telegram platform adapter and safe-area plumbing
- [x] mobile/desktop preview QA for the previous shared layout
- [x] board / hand / draw / discard visual verification for the previous shared layout
- [x] social modal/control visual verification for the previous shared layout
- [x] animation verification
- [x] no client gameplay authority
- [x] no fake multiplayer state
- [x] production guest auth fail-closed
- [x] repository shared-auth hardening
- [x] dedicated `Cribbit Chaos` Railway API live
- [x] dedicated `Cribbit Chaos` Railway PostgreSQL live with persistent storage
- [x] migrations run before Railway API deploy
- [x] Railway `/health` previously verified HTTP 200
- [x] Cloudflare Web project created with GitHub integration
- [x] Cloudflare Telegram project created with GitHub integration
- [x] Cloudflare Web current-head production deployment successful
- [x] Cloudflare Telegram current-head production deployment successful
- [x] Cloudflare Web and Telegram both target the same Railway API through `VITE_API_URL` and `VITE_WS_URL`
- [x] Railway `FRONTEND_ORIGINS` configured for the two exact Cloudflare production origins
- [x] Railway API redeployed successfully from the same current GitHub head after CORS configuration
- [x] real-device Telegram smoke test proved that shared Web/Telegram layout parity is not the desired product outcome
- [x] dedicated Telegram mobile room/game visual direction approved
- [x] detailed Telegram mobile implementation-control plan committed at `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`

Still required before Phase 3.5 can close:

### Telegram mobile composition

- [ ] T1 Telegram presentation boundary: stop using the desktop/shared page composition as Telegram's primary layout
- [ ] T2 Telegram room-creation screen
- [ ] `CREATE GAME | DEMO GAME` same-row CTA with Create Game dominant
- [ ] T3 Telegram full-width mobile game board
- [ ] compact room/turn/timer bar
- [ ] compact player strip
- [ ] horizontal touch-friendly hand rail
- [ ] contextual active-state host instead of permanent desktop instruction column
- [ ] persistent compact Pass / Rewind / Nope / Flag bar
- [ ] T4 contextual rule UI for Wild, Truth, Dare, Paranoia, Duel, Chaos, Nope, answer modes and safety actions
- [ ] T5 small-device/safe-area hardening at 320–430 px widths
- [ ] T6 live Telegram real-device signoff against the approved references

### Shared staging/auth proof

- [ ] live Web visual smoke test from `https://cribbit-chaos-web.pages.dev`
- [ ] regenerated `TELEGRAM_BOT_TOKEN` configured in Railway only
- [ ] BotFather Main Mini App pointed to the Cloudflare Telegram production URL
- [ ] Mini App live authentication proof using raw `initData`
- [ ] browser Telegram OIDC implementation and live proof
- [ ] same real Telegram account resolves to the same internal Cribbit UUID from Web and Telegram
- [ ] cross-client shared profile update/read proof through the same Railway PostgreSQL database
- [ ] final Phase 3.5 staging signoff

Vercel is not a Phase 3.5 blocker. Existing Vercel projects remain secondary/fallback deployments and may be brought current later without blocking Cloudflare-based staging progress.

### Telegram implementation authority

The detailed ordered execution plan and guardrails for T1–T6 live in:

`docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`

That file must be followed and kept synchronized after every Telegram implementation slice.

## Phase 4 — Multiplayer server — BLOCKED UNTIL PHASE 3.5 COMPLETES

- [ ] room creation
- [ ] room joining
- [ ] player ready
- [ ] game start
- [ ] command endpoint
- [ ] Socket.IO room sync
- [ ] snapshots
- [ ] reconnect
- [ ] disconnect grace
- [ ] server event stream

Do not implement Phase 4 room/game persistence as part of the Telegram visual conversion. The Telegram UI should bind to existing action/API contracts and honest staging states so Phase 4 can activate the same controls later without another redesign.

## Phase 5 — Authentication completion

- [ ] finalize Telegram `initData` production validation proof
- [ ] finalize browser Telegram login/session flow
- [ ] prove shared identity linking
- [ ] finalize auth middleware coverage

## Phase 6 — Persistent ecosystem

- [ ] Saved Deck
- [ ] House Deck
- [ ] CHAOS Board
- [ ] prompt submissions
- [ ] moderation
- [ ] flags
- [ ] recaps
- [ ] Save That

## Phase 7 — Client migration

- [ ] replace legacy local gameplay authority
- [ ] connect Web to server engine
- [ ] connect Telegram to server engine
- [ ] remove remaining legacy runtime
- [ ] ensure all mapped buttons use the real owner

## Phase 8 — Deployment hardening

Current foundation already live: Railway PostgreSQL, Railway API, Cloudflare Web, Cloudflare Telegram.

Remaining:

- [ ] Telegram Bot configuration
- [ ] staging signoff
- [ ] production environment hardening
- [ ] optional Vercel fallback sync

## Phase 9 — Multiplayer QA

- [ ] Web ↔ Web
- [ ] Telegram ↔ Telegram
- [ ] Telegram ↔ Web
- [ ] reconnect
- [ ] refresh
- [ ] duplicate commands
- [ ] timeout
- [ ] mobile
- [ ] desktop
- [ ] Telegram safe areas
- [ ] all-button verification

## Phase 10 — Launch readiness

- [ ] moderation review
- [ ] security review
- [ ] load test
- [ ] DB backup/recovery
- [ ] logs/monitoring
- [ ] analytics
- [ ] production smoke test

## Current Next Task

**T1 — Telegram presentation boundary.**

Follow `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`.

Create the Telegram-specific TypeScript/Vite bootstrap and presentation layer so `apps/telegram` no longer uses the desktop/shared page composition as its primary layout, while preserving `TelegramPlatform`, the existing API client/auth initialization, fixture/demo access, shared game contracts/action semantics, Web appearance, Railway API, and PostgreSQL schema.

Do not begin room persistence or Phase 4 multiplayer work.

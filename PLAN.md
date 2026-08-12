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
- [x] no client gameplay authority
- [x] no fake multiplayer state
- [x] production guest auth fail-closed
- [x] repository shared-auth hardening
- [x] dedicated `Cribbit Chaos` Railway API live
- [x] dedicated `Cribbit Chaos` Railway PostgreSQL live with persistent storage
- [x] migrations run before Railway API deploy
- [x] Railway `/health` previously verified HTTP 200
- [x] Cloudflare Web and Telegram Git-integrated deployments live
- [x] both Cloudflare clients target the same Railway API through `VITE_API_URL` and `VITE_WS_URL`
- [x] Railway CORS configured for the exact two Cloudflare production origins
- [x] real-device Telegram smoke test proved shared Web/Telegram layout parity is not the desired product outcome
- [x] dedicated Telegram mobile room/game direction approved
- [x] detailed Telegram implementation-control plan committed at `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`
- [x] T1 Telegram presentation boundary implemented and CI-verified
- [x] T2 Telegram Room Creation screen implemented with Profile Name, Room Name, canonical world/ceiling/modes/player counts, prompt sources, QA toggle, Join Room, and same-row `CREATE GAME | DEMO GAME`
- [x] T2 preserves existing API/auth semantics and does not fake room persistence
- [x] T2 implementation/deployment head `e88f141d83e6b21100a461969d670230109bdc6d` passed CI and Cloudflare Telegram deployment
- [x] T3 Telegram core mobile Game screen implemented with full-width board, discard/draw areas, compact turn header, player strip, contextual state strip, horizontal hand rail, and Pass/Rewind/Nope/Flag bar
- [x] T3 Demo Game routes to the Telegram mobile board while explicit `compat=1` fixtures retain legacy compatibility QA
- [x] T3 implementation/deployment head `561f9056c73a279cdf2ddb8207f875bcc4414398` passed CI and Cloudflare Telegram deployment
- [x] T1–T3 did not change Web source, game engine, API routes/contracts, Railway architecture, or PostgreSQL schema

Still required before Phase 3.5 can close:

### Telegram mobile composition

- [x] T1 Telegram presentation boundary
- [x] T2 Telegram room-creation screen
- [x] `CREATE GAME | DEMO GAME` same-row CTA with Create Game dominant
- [x] T3 Telegram full-width mobile game board
- [x] compact room/turn/timer bar
- [x] compact player strip
- [x] horizontal touch-friendly hand rail
- [x] contextual active-state host instead of permanent desktop instruction column
- [x] persistent compact Pass / Rewind / Nope / Flag bar
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

Vercel is not a Phase 3.5 blocker. Existing Vercel projects remain secondary/fallback deployments.

### Telegram implementation authority

The ordered execution plan and guardrails for T1–T6 live in `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`. That file must be followed and synchronized after every Telegram implementation slice.

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

**T4 — Telegram contextual rule UI.**

Follow `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md` exactly.

Implement Telegram-specific state-triggered panels/sheets for the already-existing Wild, Truth, Dare, Paranoia, Duel, Chaos, Nope, answer-mode, Pass, Rewind and Flag mechanics. Reuse existing shared contract/action terminology and keep all gameplay authority outside Telegram view code.

Do not alter Web appearance, game mechanics, API contracts, Railway architecture, PostgreSQL schema, or begin Phase 4 multiplayer work.
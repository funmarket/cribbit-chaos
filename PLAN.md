# Cribbit CHAOS Implementation Plan

## Project control rules

This file is a living project-control document. It must describe the current verified project state, not historical assumptions.

1. GitHub is the canonical source of truth for deployable source and project documentation.
2. After every implementation slice, update `PLAN.md`, `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`, affected technical/operational docs, and the active PR before starting the next slice.
3. Remove resolved blockers and obsolete instructions immediately. Never leave a completed task as `Current Next Task`.
4. Runtime/deployment claims must be based on verified GitHub/platform state.
5. Do not start the next phase while required blockers for the active phase remain.
6. Telegram has an approved mobile-specific composition target and is not required to preserve the Web layout.
7. Never use or mutate the separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) for Cribbit CHAOS.

## Canonical architecture

```text
GitHub = source of truth
    |
    +--> Cloudflare Pages Web
    |      desktop / large-screen presentation
    |
    +--> Cloudflare Pages Telegram
           Telegram/mobile presentation
                 |
                 v
              Railway API
                 |
                 v
          Railway PostgreSQL

Vercel = secondary/fallback only
```

Primary endpoints:
- Web: `https://cribbit-chaos-web.pages.dev`
- Telegram: `https://cribbit-chaos-telegram.pages.dev`
- API: `https://api-production-2556.up.railway.app`

Both clients use the same Railway API and PostgreSQL database and must resolve the same human to one canonical `users.id`.

## Phase 0 — Repository foundation — COMPLETE

Private GitHub repo, monorepo, Vite Web/Telegram builds, Railway API scaffold, PostgreSQL schema foundation, CI, and repository cleanup complete.

## Phase 1 — Authoritative core game engine — COMPLETE

Canonical state/card/player/command/event models, deterministic setup, legal play, classic actions, wild flow, turn progression, win handling, idempotency, and tests complete.

## Phase 2 — Social card engine — COMPLETE

Truth, Dare, Paranoia, Duel, Chaos, Nope reaction, prompt eligibility, sealed prompt selection, roulette presentation, and authorship modes complete.

## Phase 3 — Safety & answers — COMPLETE

Pass, Rewind, Flag, Speak, Type, Choose, Answered Live, timers, and timeout resolution complete.

## Phase 3.5 — Visual integration + shared staging — IN PROGRESS

Completed and verified:
- [x] approved V4 Web visual baseline and deterministic fixtures
- [x] Telegram platform/safe-area foundation
- [x] dedicated Railway API + PostgreSQL live
- [x] Cloudflare Web + Telegram Git-integrated deployments live
- [x] both clients target the same Railway API/database architecture
- [x] real-device Telegram smoke test established need for mobile-specific composition
- [x] detailed Telegram execution plan in `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`
- [x] T1 Telegram presentation boundary
- [x] T2 Telegram Room Creation screen
- [x] same-row `CREATE GAME | DEMO GAME`
- [x] T3 Telegram core mobile Game screen
- [x] full-width board/discard/draw hierarchy
- [x] compact room/turn/timer and player strip
- [x] horizontal hand rail
- [x] Pass / Rewind / Nope / Flag bar
- [x] T4 contextual rule UI for Wild, Truth, Dare, Paranoia, Duel, Chaos, Nope, answer modes and safety actions
- [x] T5 mobile hardening for 320–430 px, Telegram safe areas, keyboard/short-height fallback, overflow containment, long names, 7+ card hands, touch targets and contextual-sheet bounds
- [x] T5 exact implementation head `df581a56accbf6f128e7e460317508f26cdd366e` passed GitHub CI and Cloudflare Telegram deployment
- [x] T6 first real-device screenshots received and reviewed
- [x] T6 verified card-visual defect: Telegram cards were generic placeholders rather than the approved Cribbit card family
- [x] dedicated Telegram Cribbit card renderer added in `apps/telegram/src/cardRenderer.ts`
- [x] dedicated card visual system added in `apps/telegram/src/styles/cards.css`
- [x] game board and hand now render from the shared `Card` contract through the new Cribbit renderer
- [x] Truth, Dare, Paranoia, Chaos, Duel, Nope, Wild, Number, Skip, Reverse and Draw visual treatments implemented
- [x] card-correction code head `2094e1464d3a8d0b0ed67e23b275e254341bb0da` passed typecheck, tests, Web build, Telegram build and API build
- [x] Cloudflare Telegram deployment for card-correction code head `2094e1464d3a8d0b0ed67e23b275e254341bb0da` succeeded
- [x] T1–T6 corrections have not changed Web presentation, game engine, API routes/contracts, Railway architecture, or PostgreSQL schema

Still required before Phase 3.5 can close:

### Telegram mobile composition
- [x] T1 presentation boundary
- [x] T2 room creation
- [x] T3 core mobile game board
- [x] T4 contextual rule UI
- [x] T5 mobile hardening
- [ ] T6 real-device recheck/signoff of corrected Cribbit cards and remaining layout behavior

### Shared staging/auth proof
- [ ] live Web visual smoke test
- [ ] regenerated `TELEGRAM_BOT_TOKEN` configured Railway-only
- [ ] BotFather Main Mini App points to Cloudflare Telegram URL
- [ ] Mini App live raw-`initData` auth proof
- [ ] browser Telegram OIDC implementation/live proof
- [ ] same real Telegram account resolves to same internal UUID on Web and Telegram
- [ ] shared profile write/read proof through same Railway PostgreSQL
- [ ] final Phase 3.5 staging signoff

Vercel is not a Phase 3.5 blocker.

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

Do not implement Phase 4 during Telegram visual/staging work.

## Later phases

Phase 5 auth completion, Phase 6 persistent ecosystem, Phase 7 client migration, Phase 8 deployment hardening, Phase 9 multiplayer QA, and Phase 10 launch readiness remain pending.

## Current Next Task

**T6 — Real-device recheck of corrected Cribbit cards.**

Open `https://cribbit-chaos-telegram.pages.dev` inside the actual Telegram Mini App/WebView, enter Demo Game, and compare the discard card plus Truth/Dare/Paranoia/Chaos/Duel/Nope/Wild hand cards against the approved Cribbit references. Verify hand scrolling, card tap/selection, contextual-sheet triggers, board layout, safe areas and body overflow. Record screenshots and fix only verified defects.

Do not alter Web appearance, game mechanics, API contracts, Railway architecture, PostgreSQL schema, or begin Phase 4 multiplayer work.
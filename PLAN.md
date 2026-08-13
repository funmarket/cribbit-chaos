# Cribbit CHAOS Implementation Plan

## Project control rules

This file is a living project-control document. It must describe the current verified project state, not historical assumptions.

1. GitHub is the canonical source of truth for deployable source and project documentation.
2. After every implementation slice, update `PLAN.md`, `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`, `docs/CARD_SYSTEM_IMPLEMENTATION_PLAN.md`, affected technical/operational docs, and the active PR before starting the next slice.
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
- [x] uploaded 112-card production package audited at package level: exactly 112 fronts, all 1080x1512; exactly 3 backs, all 1080x1512; 112 manifest records; code-driven HTML/CSS design source present
- [x] shared card-system blueprint created in `docs/CARD_SYSTEM_IMPLEMENTATION_PLAN.md`
- [x] blueprint locks supplied rendered cards as canonical visual assets; TypeScript is used for runtime registry/resolution/bindings rather than re-creating the deck design
- [x] blueprint defines one shared card system for Web + Telegram, with separate presentation layers only
- [x] no backend, database, game-rule, Web-layout, Railway or Phase 4 change made by the blueprint slice
- [x] C1 complete audit/mapping of all 112 supplied cards in `docs/card-system-c1-mapping-audit.md` and `docs/card-system-c1-mapping-audit.csv`
- [x] C2 shared `packages/cards` TypeScript foundation with normalized 112-card catalogue, registry/resolver helpers, back definitions, mappings and tests
- [x] C2 preserved supplied design-generation source and did not ingest/replace runtime card art yet
- [x] C3 canonical card masters and backs ingested into `packages/cards/assets`
- [x] C3 preserved supplied design-source files in `packages/cards/design-source`
- [x] C3 generated deterministic PNG derivatives for `web-medium`, `mobile`, and `thumbnail`
- [x] C3 added asset integrity tests for counts, dimensions and design-source preservation

Still required before Phase 3.5 can close:

### Telegram mobile composition
- [x] T1 presentation boundary
- [x] T2 room creation
- [x] T3 core mobile game board
- [x] T4 contextual rule UI
- [x] T5 mobile hardening
- [x] C1 complete audit/mapping of all 112 supplied cards to existing canonical engine/action taxonomy
- [x] C2 shared `packages/cards` foundation
- [x] C3 asset ingestion / optimization of canonical masters and deterministic runtime derivatives
- [ ] C4 Telegram integration: replace temporary CSS-generated Telegram card faces with supplied canonical card assets through shared card registry/resolver
- [ ] T6 real-device recheck/signoff of canonical cards and remaining layout behavior

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

**C4 — Telegram integration.**

Replace the temporary CSS-generated Telegram card faces with actual supplied canonical card assets selected through the shared `packages/cards` registry/resolver. Preserve existing card action hooks, horizontal hand behavior, board layout, contextual rule UI, demo fixture semantics, and Telegram mobile/safe-area constraints. Do not alter game mechanics, API contracts, Railway architecture, PostgreSQL schema, Web rendering, or begin Phase 4 multiplayer work during C4.

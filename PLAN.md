# Cribbit CHAOS Implementation Plan

## Project control rules

This file is a living project-control document. It must describe the current verified project state, not historical assumptions.

1. GitHub is the canonical source of truth for deployable source and project documentation.
2. After every implementation slice, update `PLAN.md` and every affected architecture, deployment, auth, database, testing, or environment document in the same controlled slice.
3. If the active PR scope or status changed, update the PR description before starting the next implementation slice.
4. Remove resolved blockers and obsolete instructions immediately. Never leave a completed task as `Current Next Task`.
5. Runtime/deployment claims must be based on verified GitHub/platform state, not assumptions.
6. Do not start the next phase while required blockers for the active phase remain.
7. Do not redesign Cribbit CHAOS without explicit authorization. Telegram has an approved mobile-specific composition target in `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`.
8. Never use or mutate the separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) for Cribbit CHAOS.

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

Completed: private GitHub repo, monorepo, Vite Web and Telegram builds, Railway API scaffold, PostgreSQL schema foundation, CI, and repository cleanup.

## Phase 1 — Authoritative core game engine — COMPLETE

Completed: canonical state/card/player/command/event models, deterministic setup, legal-play validation, classic actions, wild flow, turn progression, zero-card win, idempotency, and transition tests.

## Phase 2 — Social card engine — COMPLETE

Completed: Truth, Dare, Paranoia, Duel, Chaos, Nope reaction, prompt eligibility, sealed prompt selection, roulette presentation contract, and authorship modes.

## Phase 3 — Safety & answers — COMPLETE

Completed: Pass, Rewind, Flag, Speak, Type, Choose, Answered Live, timers, and timeout resolution.

## Phase 3.5 — Visual integration + shared staging — IN PROGRESS

Completed and verified:

- [x] approved V4 Web visual baseline and deterministic fixtures
- [x] Telegram Mini App platform/safe-area foundation
- [x] dedicated Railway API + PostgreSQL live
- [x] Cloudflare Web + Telegram Git-integrated deployments live
- [x] both clients target the same Railway API / database architecture
- [x] real-device Telegram smoke test established that Telegram needs its own mobile composition
- [x] detailed Telegram execution plan committed at `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md`
- [x] T1 Telegram presentation boundary
- [x] T2 Telegram Room Creation screen with Profile, Room Name, canonical world/ceiling/modes/player counts, prompt sources, QA toggle, Join Room, and same-row `CREATE GAME | DEMO GAME`
- [x] T3 Telegram core mobile Game screen with full-width board, discard/draw, compact room/turn/timer, players strip, contextual state host, horizontal hand rail, and Pass/Rewind/Nope/Flag bar
- [x] T4 Telegram contextual rule UI implemented for Wild, Truth, Dare, Paranoia, Duel, Chaos, Nope, answer modes, Pass, Rewind and Flag
- [x] T4 uses state-triggered bottom sheets/panels and does not duplicate gameplay authority
- [x] T4 exact implementation head `76cbdaff1ff4ff64e81a0914f7fe1318eb00337d` passed GitHub CI: typecheck, tests, Web build, Telegram build, API build
- [x] Cloudflare Telegram deployment for exact T4 head `76cbdaff1ff4ff64e81a0914f7fe1318eb00337d` succeeded
- [x] T1–T4 did not change Web presentation, API routes/contracts, game engine, Railway architecture, or PostgreSQL schema

Still required before Phase 3.5 can close:

### Telegram mobile composition

- [x] T1 presentation boundary
- [x] T2 room creation
- [x] T3 core mobile game board
- [x] T4 contextual rule UI
- [ ] T5 mobile hardening at 320–430 px, safe areas, keyboard, overflow, long names, large hands, contextual-sheet overflow, touch targets
- [ ] T6 live Telegram real-device signoff against approved references

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

Do not implement Phase 4 during Telegram visual work.

## Later phases

Phase 5 auth completion, Phase 6 persistent ecosystem, Phase 7 client migration, Phase 8 deployment hardening, Phase 9 multiplayer QA, and Phase 10 launch readiness remain pending.

## Current Next Task

**T5 — Telegram mobile hardening.**

Follow `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md` exactly. Verify and fix the Telegram-owned room, game, and contextual-rule presentation at 320, 360, 375, 390, 412, and 430 px widths; safe-area behavior; keyboard-open layout; long names; 7+ card hands; contextual sheet overflow; touch target sizing; body overflow; and hand-only horizontal scrolling.

Do not alter Web appearance, game mechanics, API contracts, Railway architecture, PostgreSQL schema, or begin Phase 4 multiplayer work.
# Cribbit CHAOS Implementation Plan

## Phase 0 — Repository foundation

- [x] Git repository
- [x] GitHub private repo
- [x] monorepo
- [x] Vite web build
- [x] Vite Telegram build
- [x] Railway API scaffold
- [x] PostgreSQL schema foundation
- [x] button/action audit
- [x] CI
- [x] repository cleanup completed

## Phase 1 — Authoritative core game engine

- [x] define canonical `GameState`
- [x] define `Card` model
- [x] define `Player` model
- [x] define command model
- [x] define event model
- [x] deterministic shuffle/deal
- [x] starting discard
- [x] legal-play validator
- [x] draw
- [x] normal/value card
- [x] Skip
- [x] Reverse
- [x] Draw effect
- [x] Wild
- [x] Wild color selection
- [x] next turn
- [x] zero-card win
- [x] command idempotency
- [x] transition tests

## Phase 2 — Social card engine

- [x] Truth
- [x] Dare
- [x] Paranoia
- [x] Duel
- [x] Chaos
- [x] Nope reaction
- [x] prompt eligibility
- [x] sealed prompt selection
- [x] roulette presentation contract
- [x] authorship modes

## Phase 3 — Safety & answers

- [x] Pass
- [x] Rewind
- [x] Flag
- [x] Speak
- [x] Type
- [x] Choose
- [x] Answered Live
- [x] timers
- [x] timeout resolution

## Phase 3.5 — Visual integration checkpoint

- [x] approved V4 visual migration into shared UI
- [x] fixture-state renderer
- [x] web visual preview
- [x] Telegram Mini App visual preview
- [ ] development Telegram bot / Mini App staging configuration
- [ ] Vercel web staging
- [ ] Vercel Telegram staging
- [x] mobile visual QA
- [x] desktop visual QA
- [x] Telegram safe-area QA
- [x] board / hand / draw / discard visual verification
- [x] social modal/control visual verification
- [ ] animation verification
- [x] shared Web ↔ Telegram visual parity
- [x] no client gameplay authority
- [x] no fake multiplayer state
- [x] no production auth

Do not redesign Cribbit CHAOS. Treat the approved V4 HTML as a visual specification. Migrate it faithfully, then improve only defects—not the design language.

## Phase 4 — Multiplayer server

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

## Phase 5 — Authentication

- [ ] Telegram `initData` production validation
- [ ] web login/session
- [ ] user identity linking
- [ ] auth middleware

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
- [ ] connect web to server engine
- [ ] connect Telegram to server engine
- [ ] remove remaining legacy runtime
- [ ] ensure all mapped buttons use real owner

## Phase 8 — Deployment

- [ ] Railway Postgres
- [ ] Railway API
- [ ] Vercel Web
- [ ] Vercel Telegram
- [ ] Telegram Bot configuration
- [ ] staging environment
- [ ] production environment

## Phase 9 — Multiplayer QA

- [ ] web ↔ web
- [ ] Telegram ↔ Telegram
- [ ] Telegram ↔ web
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

Phase 3.5 — Visual integration checkpoint is in progress. The shared UI migration, fixture renderer, local previews, and visual QA are complete. The remaining work is staging configuration and deployment proof for the approved preview flow. Phase 3C timers and timeout resolution is complete. Phase 3B Answer modes is complete. Phase 3A Safety Controls is complete.

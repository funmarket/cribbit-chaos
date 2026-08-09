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

- [ ] define canonical `GameState`
- [ ] define `Card` model
- [ ] define `Player` model
- [ ] define command model
- [ ] define event model
- [ ] deterministic shuffle/deal
- [ ] starting discard
- [ ] legal-play validator
- [ ] draw
- [ ] normal/value card
- [ ] Skip
- [ ] Reverse
- [ ] Draw effect
- [ ] Wild
- [ ] Wild color selection
- [ ] next turn
- [ ] zero-card win
- [ ] command idempotency
- [ ] transition tests

## Phase 2 — Social card engine

- [ ] Truth
- [ ] Dare
- [ ] Paranoia
- [ ] Duel
- [ ] Chaos
- [ ] Nope reaction
- [ ] prompt eligibility
- [ ] sealed prompt selection
- [ ] roulette presentation contract
- [ ] authorship modes

## Phase 3 — Safety & answers

- [ ] Pass
- [ ] Rewind
- [ ] Flag
- [ ] Speak
- [ ] Type
- [ ] Choose
- [ ] Answered Live
- [ ] timers
- [ ] timeout resolution

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

Authoritative TypeScript core game reducer.

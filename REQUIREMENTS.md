# Cribbit CHAOS Requirements

## R1 — Platform

Cribbit CHAOS must support:

- Web application
- Telegram Mini App

Both use the same backend, database, and game state.

## R2 — Technology

Frontend:

- Vite
- TypeScript

Backend:

- TypeScript
- Node
- Fastify

Realtime:

- Socket.IO unless deliberately changed through an architecture decision

Database:

- PostgreSQL

Hosting:

- Web: Vercel
- Telegram Mini App: Vercel
- API: Railway
- PostgreSQL: Railway

Source control:

- GitHub

## R3 — Multiplayer authority

The server owns:

- current player
- player hands
- draw pile
- discard pile
- legal plays
- active color
- active symbol
- turn direction
- card effects
- prompt selection
- winner
- timers and deadlines
- reconnect snapshot
- command idempotency

Clients may provide UI hints but are not authoritative.

## R4 — Shared account

One Cribbit account may have multiple identities:

- WEB
- TELEGRAM

Use the internal UUID as the canonical user ID.

## R5 — Game core

Support:

- 2–10 players
- configurable default starting hand
- central draw pile
- central discard pile
- play/draw turn engine
- legal match rules
- first legal zero-card hand wins

Card families:

- classic/value
- Skip
- Reverse
- Draw
- Wild
- Truth
- Dare
- Paranoia
- Chaos
- Duel
- Nope

## R6 — Safety controls

Pass, Rewind, Nope, and Flag must remain separate systems.

Nope is a card.

Pass, Rewind, and Flag are controls.

## R7 — Social answer modes

Support:

- Speak
- Type
- Choose
- Answered Live

Answered Live stores completion metadata only.

No passive background conversation capture.

## R8 — Telegram authentication

Raw Telegram `initData` must be validated server-side.

`initDataUnsafe` cannot establish authenticated identity.

## R9 — Database

One shared PostgreSQL database.

Core domains include:

- users
- user_identities
- rooms
- room_members
- game_sessions
- game_players
- game_commands
- game_events
- session_snapshots
- prompts
- answers
- saved decks
- house decks
- moderation
- recaps

## R10 — Persistence

Saved Deck, House Deck, CHAOS Board, prompt submissions, user identity, history, and recaps must persist across Web and Telegram clients.

## R11 — Realtime

Players using Telegram and players using Web must be able to participate in the same room/session.

## R12 — Reconnect

Reconnect must restore an authoritative server snapshot.

## R13 — Idempotency

Duplicate or retried gameplay commands must not apply game effects twice.

## R14 — Security

Never expose server secrets in Vite.

Validate incoming commands server-side.

Validate Telegram login server-side.

Use database constraints where appropriate.

## R15 — UI

Both clients must preserve the approved Cribbit CHAOS design language.

Telegram must respect safe area, content safe area, and viewport behavior.

## R16 — Quality gates

Production tasks should maintain:

- passing TypeScript checks
- passing tests
- successful web build
- successful Telegram build
- successful API build

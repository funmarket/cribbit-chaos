# Cribbit CHAOS — Vite + TypeScript Platform Migration

This repository is the Phase-1 production migration of the approved `cribbit-chaos-v4-fixed (2).html` prototype.

## Two clients, one product

- `apps/web` — standalone Vercel web app.
- `apps/telegram` — Telegram Mini App entrypoint.
- Both consume the same UI, rules/contracts, future Railway API/WebSocket server, and PostgreSQL database.

## Current migration status

The V4 visual system and runtime are preserved exactly in shared packages so the approved UX does not regress during the architecture change. The legacy runtime is intentionally isolated under `packages/legacy-runtime` with `@ts-nocheck`. New production logic should move command-by-command into `packages/game-engine` and `packages/contracts`; do not add new game logic to the compatibility runtime.

## Local development

```bash
npm install
npm run dev:web
npm run dev:telegram
```

The Telegram entry includes Telegram's official `telegram-web-app.js` bridge. Outside Telegram it will still render, but Telegram-specific methods are unavailable.

## Vercel deployment

Recommended: create two Vercel Projects from the same GitHub repository.

### Web project
- Build command: `npm run build:web`
- Output directory: `apps/web/dist`

### Telegram project
- Build command: `npm run build:telegram`
- Output directory: `apps/telegram/dist`

Both are SPAs and need the catch-all rewrite included in each app's `vercel.json`. If project root remains repository root, mirror that rewrite in the project-level Vercel configuration or set the app directory appropriately.

Only expose non-secret client configuration with `VITE_` variables. Never place bot tokens, database credentials, Telegram validation secrets, or Railway secrets in a `VITE_` variable because Vite exposes those values to client code.

## Telegram Mini App requirements already accounted for

- `viewport-fit=cover`.
- Official Telegram Web App bridge loaded before the Vite module.
- `WebApp.ready()` and `expand()` on bootstrap.
- Dark header/background/bottom-bar integration.
- Back-button adapter.
- Closing-confirmation adapter.
- Haptics adapter.
- Raw `initData` is exposed to the future backend authentication call.
- `initDataUnsafe` is preview-only and explicitly marked untrusted.

### Authentication rule

Never authenticate a Telegram player using `initDataUnsafe`. Send `Telegram.WebApp.initData` to the Railway backend and validate its signature there before issuing a Cribbit session/token.

## Backend target

The next phase adds:

- `apps/api` — Fastify + TypeScript on Railway.
- WebSocket/realtime session transport.
- shared `packages/game-engine` authority.
- Railway PostgreSQL.
- Telegram Bot service for launch/deep-link integration.

Both clients will connect to the exact same backend and database, allowing Telegram and browser players in the same room.

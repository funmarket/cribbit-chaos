# Cribbit CHAOS

Cribbit CHAOS is one multiplayer platform with a Vite web client and a Telegram Mini App. Both clients share the same contracts, platform adapters, UI, API, realtime transport, and PostgreSQL foundation.

## Local development

```sh
npm install
npm run dev:web
npm run dev:telegram
npm run dev:api
```

Build and verification commands are `npm run typecheck`, `npm test`, `npm run build:web`, `npm run build:telegram`, `npm run build:api`, and `npm run build`.

## Repository layout

- `apps/web` — Vercel web client
- `apps/telegram` — Vercel Telegram Mini App
- `apps/api` — Railway Fastify/Socket.IO API
- `packages` — shared contracts, engine boundary, cards, prompts, platform, UI, and clients
- `db` — PostgreSQL migrations/schema/seeds
- `reference/legacy-migration` — reserved for preserved historical material
- `typescript` — original source/reference archive, intentionally preserved

See `docs/` for architecture, environment, deployment, Telegram, Railway, database, and button-audit details.

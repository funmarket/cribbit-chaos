# Cribbit CHAOS Platform — Phase 2 backend-ready audit

One shared product, two first-class clients:

- `apps/web` — Vercel standalone web app
- `apps/telegram` — Telegram Mini App, also hosted on Vercel
- `apps/server` — Railway Fastify + Socket.IO authoritative API/realtime boundary
- Railway PostgreSQL — one database for both clients

The approved V4 HTML remains frozen as `reference-v4-approved.html`. Shared UI lives in `packages/ui`; the existing simulated gameplay is isolated in `packages/legacy-runtime` while it is migrated into the DOM-free `packages/game-engine`.

## Commands

```bash
npm install
npm run dev:web
npm run dev:telegram
npm run dev:server
npm run check
npm run build:web
npm run build:telegram
```

## Important status

Phase 2 does **not** pretend the backend game reducer is finished. All UI controls now have explicit production ownership in `packages/action-registry` and `BUTTON_BACKEND_MAP.md`. Railway routes, Telegram auth validation, realtime transport, database schema and deployment boundaries are scaffolded. Game snapshot/command endpoints intentionally return `ENGINE_NOT_MIGRATED` until the full V4 rule engine is extracted and deterministic tests pass.

Read:

- `QA_REPORT.md`
- `BUTTON_BACKEND_MAP.md`
- `PLATFORM_RESEARCH.md`
- `DEPLOYMENT.md`
- `ARCHITECTURE.md`

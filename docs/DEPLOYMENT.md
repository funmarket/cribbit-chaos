# Deployment

This is a living operational document and must be updated whenever deployment targets, verified deployment state, or staging blockers change.

GitHub is the canonical source of truth for deployable source.

## Current primary deployment surfaces

- Web: Cloudflare Pages — `https://cribbit-chaos-web.pages.dev`
- Telegram Mini App: Cloudflare Pages — `https://cribbit-chaos-telegram.pages.dev`
- API: Railway — `https://api-production-2556.up.railway.app`
- PostgreSQL: Railway, shared by both clients through the API

Vercel Web and Telegram projects remain secondary/fallback deployments only. They do not block current staging progress and must not become an alternate application source.

## Canonical flow

```text
GitHub
  |
  +--> Cloudflare Pages Web
  |
  +--> Cloudflare Pages Telegram
              \
               Railway API
                   |
            Railway PostgreSQL
```

Both Cloudflare clients use:

- `VITE_API_URL=https://api-production-2556.up.railway.app`
- `VITE_WS_URL=https://api-production-2556.up.railway.app`

Railway `FRONTEND_ORIGINS` is configured for the exact two primary Cloudflare production origins.

## Railway safety boundary

Cribbit CHAOS uses only Railway project `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`).

Do not use or mutate the separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`).

## Build commands

Before deploying or claiming a build is healthy, run the relevant checks:

```sh
npm run build:web
npm run build:telegram
npm run build:api
```

Cloudflare monorepo build configuration:

- Web root: `/`
- Web command: `npm run build:web`
- Web output: `apps/web/dist`
- Telegram root: `/`
- Telegram command: `npm run build:telegram`
- Telegram output: `apps/telegram/dist`

## Current staging rule

Cloudflare Pages is the active primary frontend staging path. Vercel may be synchronized later as a fallback, but Vercel status must not block Phase 3.5 while current-head Cloudflare deployments are healthy.

After every deployment-related implementation slice, update this file, `PLAN.md`, and the active PR description if deployment state or blockers changed.

Use the root `README.md`, `docs/ENVIRONMENT.md`, `docs/TELEGRAM.md`, `docs/shared-auth-staging.md`, and `docs/TESTING.md` for related operational details.

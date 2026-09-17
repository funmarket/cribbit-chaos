# Deployment

This is a living operational document and must be updated whenever deployment targets, verified deployment state, or staging blockers change.

GitHub is the canonical source of truth for deployable source.

## Current primary deployment surface

- API / live backend: Railway project `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`), service `api` (`c255714c-95a2-4194-8bb0-e1846a5e4cf1`)
- API public domain: `https://api-production-2556.up.railway.app`
- PostgreSQL: Railway service `Postgres` in the same project

Railway is the active production deployment target for the authoritative backend/database path. Do not treat Cloudflare Pages or obsolete preview providers as proof that the live Cribbit CHAOS app has the latest rules.

## Canonical flow

```text
GitHub main
  |
  +--> Railway project Cribbit Chaos
          |
          +--> api service
                  |
                  +--> Railway PostgreSQL
```

The `api` service is connected to:

- repo: `funmarket/cribbit-chaos`
- branch: `main`
- service domain: `https://api-production-2556.up.railway.app`

## Railway safety boundary

Cribbit CHAOS uses only Railway project `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`).

Do not use or mutate the separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`).

## Build commands

Before deploying or claiming a build is healthy, run the relevant checks:

```sh
npm run typecheck
npm test
npm run build
```

Railway API service build/deploy settings observed on 2026-09-17:

- Build command: `npm ci && npm run build:api`
- Pre-deploy command: `npm run migrate:db`
- Start command: `npm run start:api`
- Health check path: `/health`
- Runtime: Railway V2 / Railpack

## Verified corrected-rules deployment

After correcting `Game_rules.md` and shared engine behavior, source commit `c1cfbe3e8177208054f41b7b2fc353ce60001868` was deployed to Railway API deployment `23406abb-8b97-4ea8-8a1b-cca3ff2c6d13` from branch `main`.

Readback:

```text
GET https://api-production-2556.up.railway.app/health
HTTP 200
{"ok":true,"service":"cribbit-chaos-api","database":true,...}
```

## Operational rule

A source commit, GitHub CI pass, or stale frontend bundle check is not live production proof. For Railway, verify all of the following before claiming production updated:

1. `railway deployment list --project e2b0a674-43d9-4aac-ad8d-3e72b3ff486f --environment production --service api --json` shows the expected `main` commit in `SUCCESS`.
2. `/health` on `https://api-production-2556.up.railway.app` returns `200` with `database:true`.
3. The exact gameplay/API behavior under investigation is read back through the Railway API or through the real client that calls that API.

After every deployment-related implementation slice, update this file, `PLAN.md`, and the active proof section in `chaosfixplan.md` if deployment state or blockers changed.

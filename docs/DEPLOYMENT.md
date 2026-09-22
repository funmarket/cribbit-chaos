# Deployment

This is the current operational deployment document. Update it whenever deployment targets, source branches, verified live versions, or deployment blockers change.

GitHub is the canonical source of deployable source. **Recovery source state and deployed production state are intentionally separate until the owner authorizes deployment.**

## Current recovery source

```text
repo                         funmarket/cribbit-chaos
recovery branch              recovery/single-engine-authority
accepted recovery baseline    a7e984bc6bb4bd22bf23d471550d677a4cba5500
recovery deployed            NO
```

Do not infer production deployment from recovery CI or branch publication.

## Current deployed backend

Railway project: `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`)

- production environment: `60d848a2-a7df-4145-a2ec-757a5ec4dc31`
- API service: `api` (`c255714c-95a2-4194-8bb0-e1846a5e4cf1`)
- PostgreSQL service: `Postgres` (`951b9c62-7cd3-404b-b9f0-c93e2c2a51d7`)
- API domain: `https://api-production-2556.up.railway.app`
- API GitHub source: `funmarket/cribbit-chaos`
- API source branch: `main`
- latest fresh-verified successful API deployment: `f33285fc-14f7-4299-b5ab-793e5c512879`
- deployed commit: `b48493dbd5eebf5a0bc82755c1e739117d8f713a`
- build: `npm ci && npm run build:api`
- pre-deploy: `npm run migrate:db`
- start: `npm run start:api`
- healthcheck: `/health`

Recent later `main` pushes were SKIPPED by Railway watch-pattern selection; therefore `main` HEAD is not the same thing as the latest deployed API commit.

The separate Railway project named `Cribbit` belongs to another product and must never be mutated for Cribbit CHAOS.

## Current deployed frontends

Original Cloudflare Pages projects:

```text
cribbit-chaos-web       production branch feature/visual-integration-checkpoint
cribbit-chaos-telegram  production branch feature/visual-integration-checkpoint
```

Both point to `https://api-production-2556.up.railway.app` for API/WS configuration.

Recovery-branch pushes currently do **not** create previews on these original projects because preview deployments are disabled. A recovery-branch GitHub push therefore does not mean either frontend was deployed.

## Deployment gate

Before claiming recovery is deployed:

1. verify the exact recovery candidate SHA;
2. receive explicit owner deployment authorization;
3. verify the exact Railway/Cloudflare target and source branch configuration;
4. run required CI/build/migration gates on that exact candidate;
5. deploy;
6. verify the live API version/health and rendered Web/Telegram behavior.

No recovery deployment is authorized merely by this document.

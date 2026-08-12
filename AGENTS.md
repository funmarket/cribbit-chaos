# Cribbit CHAOS Codex Rules

## Project control rule — mandatory

The repository documentation is a set of living project-control documents, not passive notes.

GitHub is the canonical source of truth for deployable source and project documentation.

After every completed implementation slice:

1. update `PLAN.md` to match the verified current state
2. update every affected architecture, deployment, auth, database, environment, testing, or operational document
3. update the active PR description when scope, blockers, deployment state, or next task changed
4. remove resolved blockers and obsolete instructions
5. replace `Current Next Task` with the next real unfinished task
6. never leave a completed task presented as pending
7. never leave stale hosting/backend/database instructions in repository documentation
8. if runtime state and documentation disagree, correct documentation before starting further implementation

At phase completion, preserve a concise completion summary, collapse unnecessary completed detail, and move active focus to the next unfinished phase. Do not erase useful evidence, but do remove stale instructions that could send implementation in the wrong direction.

No implementation slice is considered fully complete until its project-control documentation is synchronized.

## Product model

Cribbit CHAOS is one multiplayer platform with two clients:

- `apps/web` — standalone browser application; primary live host is Cloudflare Pages
- `apps/telegram` — Telegram Mini App; primary live host is Cloudflare Pages

Both clients use:

- one shared game engine
- one shared contracts package
- one Railway backend
- one Railway PostgreSQL database
- one account system
- one room/session system

Never implement Telegram and Web as separate games.

Vercel Web and Telegram projects are secondary/fallback deployments only and are not allowed to become an alternate source of truth.

## Canonical deployment architecture

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

Primary live endpoints:

- Web: `https://cribbit-chaos-web.pages.dev`
- Telegram: `https://cribbit-chaos-telegram.pages.dev`
- API: `https://api-production-2556.up.railway.app`

Cribbit CHAOS Railway resources belong only to project `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`).

Never use or mutate the separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`).

## Production architecture

- `apps/web`
- `apps/telegram`
- `apps/api`
- `packages/contracts`
- `packages/game-engine`
- `packages/cards`
- `packages/prompts`
- `packages/platform`
- `packages/ui`
- `db/`

## Authority rules

The frontend is not authoritative for multiplayer gameplay.

Gameplay-changing operations must eventually execute through the authoritative server/game engine.

Never implement production gameplay mutations only in browser state.

## Shared-code rule

Never duplicate:

- game rules
- card definitions
- `GameCommand` definitions
- `GameEvent` definitions
- API contracts
- prompt domain models

between `apps/web` and `apps/telegram`.

Move shared logic into `packages/`.

## UI rule

The approved Cribbit CHAOS V4 visual design is the visual baseline.

Do not redesign UI unless explicitly requested.

Fixing responsive defects or accessibility defects is allowed when required.

## Telegram security

Never authenticate with `initDataUnsafe`.

Raw Telegram `initData` must be validated by `apps/api`.

Never expose:

- `TELEGRAM_BOT_TOKEN`
- `DATABASE_URL`
- Telegram OIDC client secrets
- JWT secrets
- session secrets

inside client bundles.

## Database rule

There is one shared Railway PostgreSQL database for Cribbit CHAOS.

Never create separate Telegram and Web databases.

Never put `DATABASE_URL` in Cloudflare Pages, Vercel, or any Vite client environment.

Clients access persistent data only through the Railway API.

Internal Cribbit UUIDs are the user primary identity.

Telegram IDs are provider identities, not primary user IDs.

## File organization

Before creating a new file:

1. check whether an existing module owns that concern
2. place shared logic in `packages/`
3. place platform-specific logic in its app or platform adapter
4. do not create duplicate utilities
5. do not add files to root without a clear repository-level purpose

## Cleanup

Do not leave:

- temporary files
- duplicate project copies
- generated build output
- obsolete migration artifacts
- unused source files

after completing a task.

Do not delete uncertain data silently.

## Testing

After changes, run the relevant subset of:

- `npm run typecheck`
- `npm run test`
- `npm run build:web`
- `npm run build:telegram`
- `npm run build:api`

For changes touching shared packages, run all of them.

Do not claim a check passed unless it actually ran.

## Git

Do not make large unrelated changes in one task.

Prefer focused commits.

Do not commit secrets.

Do not force-push `main`.

Do not rewrite history unless explicitly requested.

New implementation must continue on the active controlled branch/PR unless explicitly directed otherwise.

## Documentation ownership

`README.md` explains the repository and current deployment model.

`REQUIREMENTS.md` defines what the product must satisfy.

`PLAN.md` defines implementation sequence, verified current status, blockers, and the single current next task.

`docs/` contains deeper technical and operational detail.

All of these must remain synchronized with verified project reality after each implementation slice.

# Cribbit CHAOS Codex Rules

## Product model

Cribbit CHAOS is one multiplayer platform with two clients:

- `apps/web` — standalone browser application deployed on Vercel
- `apps/telegram` — Telegram Mini App deployed on Vercel

Both clients use:

- one shared game engine
- one shared contracts package
- one Railway backend
- one PostgreSQL database
- one account system
- one room/session system

Never implement Telegram and Web as separate games.

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
- JWT secrets
- session secrets

inside client bundles.

## Database rule

There is one shared PostgreSQL database.

Never create separate Telegram and Web databases.

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

## Documentation

If architecture, contracts, deployment, database, or game rules change,
update the corresponding documentation.

`README.md` explains how to use the repository.

`REQUIREMENTS.md` defines what the product must satisfy.

`PLAN.md` defines implementation sequence/status.

`docs/` contains deeper technical detail.

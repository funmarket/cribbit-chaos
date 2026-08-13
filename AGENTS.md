# Cribbit CHAOS Agent Rules

## Mandatory operating workflow

Every implementation slice must follow this sequence, in order:

1. **Inspect living status** — verify the current GitHub branch, relevant source, tests, docs, deployment/runtime state, and known blockers before changing code.
2. **Make the change** — keep the slice focused and use shared packages for shared behavior.
3. **Test / verify** — run the relevant checks and verify the behavior that actually changed. Never claim a check passed unless it ran and passed.
4. **Remove superseded / stale artifacts** — delete or retire temporary, duplicate, dead, conflicting, recovery, debug, compatibility, or superseded resources made obsolete by the slice whenever technically possible.
5. **Update living docs** — synchronize `README.md`, `PLAN.md`, `AGENTS.md`, `docs/LIVING_STATUS.md`, and every affected technical/operational document with verified reality.
6. **Merge / publish the completed slice** — use focused commits and the active controlled branch/PR. Do not merge unrelated unfinished work.
7. **Verify actual runtime state** — after merge/deploy, verify the real runtime/deployment state rather than assuming CI or source changes imply success.

A slice is not complete if code, tests, documentation, or runtime reality disagree.

## GitHub source-of-truth rule

GitHub is the canonical source of truth for deployable source, shared game rules, project documentation, and implementation status.

Local files, generated output, deployment dashboards, screenshots, temporary recovery copies, and client-specific prototypes are evidence or working material only. They must not become an alternate source of truth.

Changes intended for the product must be committed to GitHub before they are considered part of the canonical project state.

## Living-document synchronization rule

The following four files are mandatory synchronized project-control documents:

- `README.md` — what the repository is and the current architecture/runtime model
- `PLAN.md` — implementation sequence, blockers, completed slices, and the single current next task
- `AGENTS.md` — mandatory engineering/workflow rules
- `docs/LIVING_STATUS.md` — concise verified current state, active branch/head, runtime status, known blockers, and immediate focus

Whenever a completed slice changes architecture, current status, runtime ownership, blockers, next task, or engineering rules, update all affected members of this set in the same work.

Do not allow one of these documents to describe a different project state from the others.

If runtime state and documentation disagree, correct the living documents before starting unrelated implementation.

## No-stale-debt rule — mandatory

Do not knowingly leave stale debt behind after a completed slice when it can be removed safely in the same work.

Stale debt includes:

- temporary files
- duplicate implementations
- duplicate card/deck/rule sources
- dead source files
- dead functions
- stale imports/exports
- obsolete CSS selectors or conflicting style systems
- superseded assets
- superseded manifests or mappings
- recovery copies
- debug-only code, fixtures, switches, logs, or controls no longer required
- compatibility shims whose callers have been migrated
- generated build output committed accidentally
- obsolete migration artifacts
- resolved blocker notes presented as current
- documentation describing completed work as pending

Before leaving any such resource in place, confirm that a live caller, migration dependency, recovery requirement, or deliberate compatibility boundary still needs it. If it is still required, document why and what will remove it later.

Do not delete uncertain data silently. Verify references and ownership first.

## Product model

Cribbit CHAOS is one multiplayer platform with two clients:

- `apps/web` — standalone browser client
- `apps/telegram` — Telegram Mini App

Both clients use one shared game model, one shared rule system, one shared card/deck definition, one shared contracts layer, one Railway backend, one Railway PostgreSQL database, one account model, and one room/session model.

Never implement Web and Telegram as separate games.

## Current implementation priority

Until the mechanics migration is complete, prioritize functional gameplay over final card-art polish.

The current Web game is the temporary visual/mechanical baseline. Final card artwork may be redesigned later without changing canonical card IDs or game behavior.

The controlled migration order is:

1. make the Web game use the canonical playable deck and coherent rules
2. verify Web mechanics and remove obsolete Web deck/rule debt
3. make Telegram consume the exact same canonical cards, IDs, rules, and authoritative game state
4. verify both clients against the same mechanics
5. tune rule UX, buttons, contextual displays, pacing, timers, and player feedback
6. add audio comments/sound effects only after gameplay events are stable
7. polish/finalize card art after mechanics are proven

Do not preserve inferior Telegram-only card artwork merely because it exists. Remove it once Telegram has migrated and reference checks prove it is unused.

## Canonical deck/rule ownership

Playable hand inventory and gameplay behavior must come from shared canonical code, not client-local deck builders.

The intended playable families are:

- number/color cards
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

Pass, Rewind, Flag, Spice Dial, Speak, Type, Choose, and Answered Live are controls/systems, not hand-card inventory.

Never duplicate deck composition, legal-play rules, card behavior, `GameCommand`, `GameEvent`, prompt rules, or win logic between Web and Telegram.

## Authority rules

The frontend is not authoritative for multiplayer gameplay.

Gameplay-changing operations must execute through the authoritative shared game/server boundary as the migration reaches production state.

Clients may render legal-state hints, but they do not decide card ownership, legal plays, prompt eligibility, effects, timers, or winner state.

## Shared-code rule

Never duplicate between `apps/web` and `apps/telegram`:

- game rules
- deck composition
- card definitions
- card behavior
- `GameCommand` definitions
- `GameEvent` definitions
- API contracts
- prompt domain models

Move shared logic into `packages/`.

## UI rule

Do not spend mechanics-phase work redesigning final card art unless a visual defect blocks gameplay or usability.

Web and Telegram may use different responsive layout composition, but game semantics, card identity, controls, and state must remain shared.

## Deployment architecture

Primary product architecture is GitHub source -> client deployments -> Railway API -> Railway PostgreSQL.

Vercel deployments are secondary/fallback only and must not become an alternate source of truth.

Cribbit CHAOS Railway resources belong only to the dedicated Cribbit CHAOS project. Never use or mutate unrelated Railway projects.

## Telegram security

Never authenticate with `initDataUnsafe`.

Raw Telegram `initData` must be validated server-side.

Never expose secrets such as:

- `TELEGRAM_BOT_TOKEN`
- `DATABASE_URL`
- Telegram OIDC client secrets
- JWT/session secrets

inside client bundles or public documentation.

## Database rule

There is one shared Railway PostgreSQL database for Cribbit CHAOS.

Never create separate Telegram and Web databases.

Clients access persistent data only through the authoritative API.

Internal Cribbit UUIDs are primary identities; provider IDs are external identities.

## File-organization rule

Before creating a new file:

1. check whether an existing module already owns the concern
2. place shared logic in `packages/`
3. place platform-specific logic in the relevant app/adapter
4. do not create duplicate utilities
5. do not add root files without a repository-level purpose

Before creating a replacement implementation, identify and plan removal of the implementation it supersedes.

## Testing rule

After changes, run the relevant subset of:

- `npm run typecheck`
- `npm run test`
- `npm run build:web`
- `npm run build:telegram`
- `npm run build:api`
- `npm run audit:ui`

For changes touching shared packages or shared mechanics, run all relevant client/server checks.

Mechanics changes must include deterministic tests for deck composition and affected rule behavior.

## Git rule

Keep commits focused.

Do not commit secrets.

Do not force-push `main`.

Do not rewrite history unless explicitly requested.

Continue on the active controlled branch/PR unless explicitly directed otherwise.

Merge only after the implementation slice, tests, cleanup, and living docs are synchronized.

## Definition of done

A task is complete only when all applicable items are true:

- source change is complete
- required tests/builds pass
- duplicate/stale artifacts introduced or superseded by the change are removed or explicitly justified
- `README.md`, `PLAN.md`, `AGENTS.md`, and `docs/LIVING_STATUS.md` agree with verified reality
- affected technical docs are current
- the change is committed/published through GitHub
- actual runtime/deployment behavior is verified when the slice affects runtime
- `PLAN.md` names the next real unfinished task, not the task just completed

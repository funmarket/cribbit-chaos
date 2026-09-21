# Cribbit CHAOS Agent Rules

This file is the mandatory operating contract and the entry point for any agent resuming the repository.

## Resume order — mandatory

Read in this order before touching anything:

```text
AGENTS.md                     (this operating contract)
HANDOFF.md                    (concise operational resume point: branch, SHA, task, blockers)
docs/LIVING_STATUS.md         (the single execution ledger: CURRENT TASK, blockers, next task)
PLAN.md                       (detailed roadmap; the authorized phase/task)
relevant rule/domain docs     (Game_rules.md and the docs/ rule-decision records)
source                        (the code that actually implements the claim)
```

Documentation set and ownership:

| Document | Owns |
|---|---|
| `AGENTS.md` | Operating contract, reading order, engineering rules |
| `HANDOFF.md` | Concise operational handoff (branch/SHA, last task, current task, next task, blockers, publication state, resume steps) |
| `docs/LIVING_STATUS.md` | Central execution ledger: verified state, completed slices, whole-product status, one CURRENT TASK, checks, unknowns, publication state |
| `PLAN.md` | Detailed roadmap truth, phase sequence, blockers |
| `README.md` | What the repository is, architecture/runtime model, layout, how to run/build/test |
| `Game_rules.md` | Canonical gameplay meaning and permanent rule IDs |
| `docs/PRODUCT_SCOPE.md` | Whole-product scope and preservation classifications |
| `docs/CHANGE_GOVERNANCE.md` | Authority chain, rule-ID governance, preservation classes, future Authority Guard direction |
| `docs/ARCHITECTURE.md` | Verified ownership and dependency direction |
| `docs/DATABASE.md` | Canonical persistence model and its prohibitions |
| `docs/BUTTON_MAP.md` | UI/action ownership and surface classification |
| `docs/ADMIN_CONTROL_ROOM.md` | Operator control-plane scope and boundary |
| `docs/HISTORICAL_PRODUCT_EVIDENCE.md` | Preservation/product-history evidence that is never rule authority |

Gameplay meaning is owned by `Game_rules.md` alone. Other documents may cite rule IDs and explain ownership; they must never restate gameplay semantics as competing rule truth.

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

The mandatory synchronized project-control documents are:

- `README.md` — what the repository is and the current architecture/runtime model
- `PLAN.md` — implementation sequence, blockers, completed slices, and the single current next task
- `AGENTS.md` — mandatory engineering/workflow rules
- `HANDOFF.md` — concise operational resume point for the next agent
- `docs/LIVING_STATUS.md` — the single execution ledger with exactly one CURRENT TASK

Whenever a completed slice changes architecture, current status, runtime ownership, blockers, next task, or engineering rules, update all affected members of this set in the same work, plus every affected technical/operational document (`docs/PRODUCT_SCOPE.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/BUTTON_MAP.md`, `docs/CHANGE_GOVERNANCE.md`).

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

### Account / identity rule — locked

> Cribbit has one canonical account identifier: `users.id`. Telegram and Web are optional authentication methods attached to that account. Telegram authenticates directly from server-verified Telegram numeric identity; Web authenticates with username/password. Telegram username is provider metadata and may be used only as a convenient suggested Web login username when available. Username equality never links accounts. Linking requires explicit proof and attaches the second authentication method to the existing `users.id`. Telegram-only and Web-only accounts are both valid.

- A canonical account is always `users.id`; `user_identities`, `web_credentials` and `auth_sessions` attach to it. Never create a platform-specific user, room or session table, and never infer identity from matching usernames, display names, emails, IPs, browsers or devices.
- Unknown Telegram authentication is lookup-only: it returns an explicit unlinked/onboarding state and must never silently create a user during normal authentication. Telegram-only account creation is an explicit action that creates exactly one user, and no Web password may be required for a Telegram-only account.
- Linking is explicit and attaches the second authentication method to the existing `users.id`: a foreign Telegram identity yields a deterministic `409` with zero movement and one account may not attach two different Telegram identities.
- Provider authentication refreshes provider metadata only. It must never rewrite the canonical display name, profile presentation or Web login username.
- Identity-link challenges are a separate security artifact from login sessions: dedicated storage, short TTL, explicit purpose, atomic one-time consumption. A challenge value must never authenticate a session, and session revocation must never mean challenge consumption.
- The dormant Telegram Web Login/OIDC callback fails closed: a browser cookie alone is never authority to attach a Telegram identity.
- Linked Web and Telegram access must resolve the same room membership, game seat, private hand and authoritative revision; there is one server-authoritative game, never a Web game synchronized with a Telegram game.

### Live rooms vs Simulation (verified)

- A Live room is a real multiplayer room: real authenticated members only, a waiting room before the game starts, and exactly one authoritative session created by the host's Start.
- Live rooms must never contain fabricated bot players (`bot:<sessionId>:*`).
- Simulation is the separate local/bot mode. Do not let Simulation behavior define Live-room behavior, and do not restore a duplicate gameplay runtime to make either mode work.

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

Canonical playable inventory and composition are owned by `Game_rules.md` (deck `CHAOS-133-V1`) and implemented by `packages/cards` + `packages/game-engine`. Do not restate the deck or its gameplay meaning in this file, in the clients, or in client-local deck builders.

Pass, Rewind, Flag, Spice Dial, Speak, Type, Choose, and Answered Live are controls/systems, not hand-card inventory (see `docs/BUTTON_MAP.md`).

Rule-ID governance, supersession rules and preservation classifications are defined in `docs/CHANGE_GOVERNANCE.md`.

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

Cloudflare Pages is the current frontend deployment target and must not become an alternate source of truth; GitHub source remains authoritative.

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
- `README.md`, `PLAN.md`, `AGENTS.md`, `HANDOFF.md`, and `docs/LIVING_STATUS.md` agree with verified reality, with exactly one `CURRENT TASK` and no competing current-state narrative
- gameplay meaning is not restated as competing truth outside `Game_rules.md`
- affected technical docs are current
- the change is committed/published through GitHub
- actual runtime/deployment behavior is verified when the slice affects runtime
- `PLAN.md` names the next real unfinished task, not the task just completed

# Handoff — Cribbit CHAOS recovery

Concise operational handoff for an agent resuming this repository without chat history.
Read order: `AGENTS.md` -> this file -> `docs/LIVING_STATUS.md` -> the `CURRENT TASK` in `PLAN.md` -> relevant rule/domain docs -> source.

## Mission

Recover `funmarket/cribbit-chaos` as ONE Cribbit CHAOS application with TWO frontend delivery surfaces (Web browser client and Telegram Mini App) over one authoritative backend: one Railway API, one Railway PostgreSQL database, one canonical identity model (`users.id`), one shared game engine, and one persistent domain model. The original damage was split gameplay authority (duplicate client runtimes); the recovery removes duplicate authority instead of inventing new product behaviour.

## Mandatory whole-project preservation gate

Before any task, apply the **Whole-Project Scope and Preservation Rule** in `AGENTS.md`. Cribbit CHAOS is a full application, not a board-only project. A narrow task limits what may be changed; it does **not** limit dependency investigation or whole-product impact analysis. “Not currently wired,” “zero importers,” or “not used by the board” is never sufficient evidence that code or a feature is irrelevant. When ownership, purpose, dependency, or migration/replacement status is not proven, classify it **`UNKNOWN — PRESERVE`** and stop before removal.

## Verified shared repository state

Freshly verified state after this ROOM-CONFIG-1 reconciliation:

```text
repository                                  funmarket/cribbit-chaos
branch                                      recovery/single-engine-authority
ROOM-CONFIG-1 client wiring                 fc7691c3784dc5e26e9bad4b10105e2befda2a4f
APP-SHELL-1 RED contract commit             8210d9271d4d4d3762d9b10ef45cd1182489e626
APP-SHELL-1 shell commit                    2ea497ee731195b9adcee3fe6b7e907a3c724bc8
APP-SHELL-1 responsive commit               036a36c2d52e3b240376552b7ebea36a11d953b4
ROOM-CONFIG-1 exact-SHA CI                  see "Publication / deployment state" below
main                                        964a9162d7d9e1a12acfccc61f0fb88430a8f4ff   (unchanged)
recovery/single-engine-authority-ci         f384c824a0553d1adceb05ef55612e177967bb1a   (unchanged)
recovery branch deployed                    NO
```

Production Web boots `runtimeMode: 'none'` in `apps/web/src/main.ts`. The `legacy-compatibility` runtime is fixture/compatibility only (Telegram `?compat=1&fixture=1`), and `apps/web/src/canonical-game-runtime.ts` remains `UNKNOWN — PRESERVE`.

Current accepted recovery sequence:

```text
95e4d846   RECOVERY-HARDEN-1 — room concurrency
3b1da012 + 812acce   RECOVERY-HARDEN-2 — server-projected Live capabilities
67dbff10 + 3fd53f77   RECOVERY-HARDEN-3/3B — command identity/collision/concurrency
b5df941 + cb3126c + a7e984b   RECOVERY-HARDEN-4 — one REST gameplay mutation transport
81bd195 + b848327 + 5be19e7 + fc7691c   ROOM-CONFIG-1 — canonical room setup state
8210d92 + 2ea497e + 036a36c   APP-SHELL-1 — one canonical product shell (Web top bar, navigation, appearance)
```

RECOVERY-HARDEN-4 exact-SHA CI run `35674013904` succeeded for typecheck, PostgreSQL-backed tests, build-web, build-telegram, and build-api. Hermes's local recovery worktree and the remote recovery branch were aligned at `a7e984b...` after publication. The superseded local documentation commit remains preserved only on local branch `preserve/recovery-harden1-docs-reconcile`.

Deployment remains separate from recovery source state. Railway API production is still sourced from `main`; original Cloudflare Web/Telegram production branches remain `feature/visual-integration-checkpoint`. Recovery publication is not production deployment proof.

## Last completed task

**APP-SHELL-1 — global Web shell / top bar / navigation / page reachability — IMPLEMENTATION + RESPONSIVE CORRECTIONS + DOC CLOSEOUT COMPLETE.**

Published locally on the controlled branch as RED `8210d92` -> shell `2ea497e` -> responsive `036a36c` + this documentation commit.

What one canonical product shell now guarantees:

1. `packages/ui/src/template.html` owns exactly one `header.app-header` with three zones: `header-left` (mobile trigger plus desktop navigation), `header-center` (the approved Cribbit wordmark, centred by a real grid), `header-right` (product utilities). No view declares a second product header.
2. `packages/ui/src/styles.css` owns the single composition for the product bar: `height: var(--header-h)` with a `minmax(0, 1fr) auto minmax(0, 1fr)` grid, so the bar keeps one canonical height per breakpoint and never varies per view. The Web-specific stylesheets no longer re-compose the header.
3. Compact desktop and tablet widths (<=1199px) hand navigation to the existing `#mobileNavDialog` drawer opened by the top-left trigger; desktop keeps the inline product navigation (all seven clusters at >=1360px, the two trailing clusters folding into the drawer below that).
4. A top-right appearance control (`data-action="toggle-appearance"`, `aria-label` + `aria-pressed`) switches dark/light, persists locally under `cribbit.appearance`, survives page navigation and reload, and never touches gameplay or server state.
5. QA/diagnostic presentation (connection, revision, fixture pills, reconnect test, reset) moved out of the product bar into a hidden `[data-diagnostics]` surface shown only with `?diagnostics=1`; every element is preserved and cannot resize or restructure the product bar.
6. `packages/ui/src/bootstrap.ts` installs the appearance controller and the diagnostic gate alongside `installSharedNavigation`, so production Web keeps exactly one navigation owner (`runtimeMode: 'none'`).

Rendered evidence (headless Chrome on the built bundle): bar height 57px at 1440/1280/1200/1100, 53px at 1024, brand centred within 0.1px, symmetric zones, no overlap, no overflow at 1440/1280/1200/1100/1024; CSS-only shell harness verified at 768/430/360 (bar 55/53/53, brand centred, trigger at x=12, no overflow at 430/360).

## Previous completed task — ROOM-CONFIG-1

**ROOM-CONFIG-1 — canonical room configuration — COMPLETE / PUBLISHED / EXACT-SHA CI GREEN.**

Published chain:

```text
81bd19518204109dde39503084f2fe95da04292a
  test(room-config): require canonical room setup persistence and freeze at start

b848327b95944d5c44a10a452e59e9e8f6a05617
  test(room-config): assert the stated race invariant and use a real non-member

5be19e7ad6c74232be1322ec640dace3b379ebc3
  feat(api): make room setup canonical server state frozen at start

fc7691c3784dc5e26e9bad4b10105e2befda2a4f
  feat(clients): wire room setup to the canonical room config transport
```

Resulting room-config contract:

1. `packages/contracts` owns the single room setup vocabulary (`RoomConfig`, `ROOM_MODE_BOUNDS`, `ROOM_CEILING_VALUES`, `ROOM_PROMPT_SOURCE_KEYS`); the server is the validation authority and clients may only render from it.
2. `PATCH /v1/rooms/:roomId/config` is the only room-config mutation route; it is host-only and emits the `room-updated` invalidation. Realtime carries no config mutation command.
3. `apps/api/src/game-service.ts` validates the merged partial update against the persisted config, refuses a `playerCount` below the current member count, refuses any change once the room has started, and persists canonical state in `rooms.config`.
4. `startRoom` and the config PATCH lock the same room row `for update`, so a config update either commits before the session is created or fails as frozen.
5. The persisted config feeds session creation: `world` -> `contentWorld`, real room-member count -> `playerCount`, `ceiling` -> prompt-profile intensity, `sources` -> `promptPoolForSources`. No client prompt-eligibility authority exists.
6. Telegram publishes host-owned setup changes through `packages/api-client` and repaints from authoritative state; joiners publish nothing. Web consumes the shared contract at its approved creation controls.
7. Local QA Simulation keeps its own draft and persists nothing.

Local evidence (real PostgreSQL 18.4, disposable `127.0.0.1:55433/cribbit_r5`): focused room-config suite 25 tests / 25 pass; regression suites 58 tests / 58 pass; `npm run typecheck`, `npm run lint`, `npm run audit:ui`, `build:api`, `build:web`, `build:telegram` all green; `git diff --check` clean.

Historical RECOVERY-HARDEN-4 background (still binding as the gameplay transport authority): gameplay mutation has exactly one REST route, `POST /v1/games/:sessionId/commands`; realtime is subscription/invalidation only. Historical command-identity/concurrency proof from RECOVERY-HARDEN-3/3B remains valid background evidence; it is no longer the last completed task.

## Current task

**None in flight.** APP-SHELL-1 is complete on the controlled branch (implementation, responsive corrections, living-doc closeout); publication and exact-SHA CI for this slice are recorded in the slice report and under "Publication / deployment state" below. Room setup is canonical server state and the next implementation slice requires explicit owner authorization.

## Next task / authorization state

**No implementation task is currently authorized after this slice.**

Remaining hardening candidates (gameplay transport metadata is completed by RECOVERY-HARDEN-4; canonical room setup is completed by ROOM-CONFIG-1):

1. resolve the Truth-or-Chaos owner decisions, then repair its pending group-punishment completion path;
2. migrate the unmigrated product verticals (Rooms, CHAOS Board, Library/Create, Recap/History, Notifications, Moderation);
3. Roulette SVG presentation and retirement of the preserved legacy/canonical client runtimes;
4. fold the ROOM-CONFIG-1 parity gaps into a later authorized slice: no Web post-create room-setup control (not restored, not replaced), and Telegram does not role-disable setup controls for a joiner.

**AUTHORITY-GUARD-1 remains unauthorized and not started.** Its precondition list still includes the unresolved Truth-or-Chaos owner decisions; the transport-authority contradiction is reconciled by RECOVERY-HARDEN-4.

## Blockers and known unknowns

- **Gameplay transport metadata — RESOLVED by RECOVERY-HARDEN-4:** gameplay mutation has exactly one transport (`POST /v1/games/:sessionId/commands`); `CribbitRealtimeClient` no longer exposes a gameplay command sender and the action registry no longer claims `method:'WS'` outside genuinely realtime actions.
- **Truth or Chaos:** the current flow can reach `groupPunishmentPending` without a proven completion path. Whether the instigator also answers and the exact refusal/Pass rule remain unresolved owner decisions; do not invent them.
- **Whole-product recovery:** prompt library/create/save, room prompt pool, notifications, moderation, answers, recap/history and other retained verticals remain UNMIGRATED. Not wired does not mean dead.
- Real Telegram Mini App runtime remains NOT VERIFIED in this environment (no genuine Telegram-generated `initData`).
- `apps/web/src/canonical-game-runtime.ts` remains `UNKNOWN — PRESERVE`; zero importers is not removal proof.
- ROOM-CONFIG-1 parity gaps: Web has no post-create room-setup control (the retired setup panel was not restored), and Telegram joiner setup controls are not role-disabled; both are recorded gaps, not silent stubs.
- Local Simulation can stall on a special-card interaction expecting human input; Pass / Rewind / Nope / Flag remain Live-path-only observations.

## Publication / deployment state

The accepted RECOVERY-HARDEN-4 engineering baseline is `a7e984bc6bb4bd22bf23d471550d677a4cba5500`. ROOM-CONFIG-1 follows it with canonical room setup, published through the controlled recovery branch; this documentation reconciliation does not alter runtime behavior.

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a
RECOVERY-HARDEN-4 engineering baseline        a7e984bc6bb4bd22bf23d471550d677a4cba5500
ROOM-CONFIG-1 RED                             81bd19518204109dde39503084f2fe95da04292a
ROOM-CONFIG-1 RED correction                  b848327b95944d5c44a10a452e59e9e8f6a05617
ROOM-CONFIG-1 server implementation           5be19e7ad6c74232be1322ec640dace3b379ebc3
ROOM-CONFIG-1 client wiring                   fc7691c3784dc5e26e9bad4b10105e2befda2a4f
Railway API source branch                     main
Railway latest successful API commit          b48493dbd5eebf5a0bc82755c1e739117d8f713a
Cloudflare Web production branch              feature/visual-integration-checkpoint
Cloudflare Telegram production branch         feature/visual-integration-checkpoint
```

No recovery-branch merge or production deployment has occurred. Production mutation requires a separate explicit owner gate.

## Resume instructions

1. Freshly verify the branch, HEAD, worktree and remote before any local mutation.
2. Read `docs/LIVING_STATUS.md`, `PLAN.md`, the whole-product preservation rule in `AGENTS.md`, and relevant rule/domain docs.
3. Read the single current roadmap in `PLAN.md`; `AUTHORITY-GUARD-1` is explicitly deferred and must not be started without owner authorization.
4. Follow `AGENTS.md` mandatory workflow (inspect -> change -> verify -> remove only proven-superseded artifacts -> update living docs -> publish -> verify runtime).
5. Use deterministic NoDrift / Literal Command Executor discipline for consequential mutations.
6. Never push, deploy, merge or mutate production resources without explicit authorization.

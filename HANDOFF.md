# Handoff — Cribbit CHAOS recovery

Concise operational handoff for an agent resuming this repository without chat history.
Read order: `AGENTS.md` -> this file -> `docs/LIVING_STATUS.md` -> the `CURRENT TASK` in `PLAN.md` -> relevant rule/domain docs -> source.

## Mission

Recover `funmarket/cribbit-chaos` as ONE Cribbit CHAOS application with TWO frontend delivery surfaces (Web browser client and Telegram Mini App) over one authoritative backend: one Railway API, one Railway PostgreSQL database, one canonical identity model (`users.id`), one shared game engine, and one persistent domain model. The original damage was split gameplay authority (duplicate client runtimes); the recovery removes duplicate authority instead of inventing new product behaviour.

## Mandatory whole-project preservation gate

Before any task, apply the **Whole-Project Scope and Preservation Rule** in `AGENTS.md`. Cribbit CHAOS is a full application, not a board-only project. A narrow task limits what may be changed; it does **not** limit dependency investigation or whole-product impact analysis. “Not currently wired,” “zero importers,” or “not used by the board” is never sufficient evidence that code or a feature is irrelevant. When ownership, purpose, dependency, or migration/replacement status is not proven, classify it **`UNKNOWN — PRESERVE`** and stop before removal.

## Verified shared repository state

Fresh accepted state before this documentation-only reconciliation:

```text
repository                                  funmarket/cribbit-chaos
branch                                      recovery/single-engine-authority
accepted HARDEN-4 baseline                  a7e984bc6bb4bd22bf23d471550d677a4cba5500
exact HARDEN-4 CI                           35674013904  SUCCESS
main                                        964a9162d7d9e1a12acfccc61f0fb88430a8f4ff   (unchanged)
recovery/single-engine-authority-ci         f384c824a0553d1adceb05ef55612e177967bb1a   (unchanged)
recovery branch deployed                    NO
```

Current accepted recovery sequence:

```text
95e4d846   RECOVERY-HARDEN-1 — room concurrency
3b1da012 + 812acce   RECOVERY-HARDEN-2 — server-projected Live capabilities
67dbff10 + 3fd53f77   RECOVERY-HARDEN-3/3B — command identity/collision/concurrency
b5df941 + cb3126c + a7e984b   RECOVERY-HARDEN-4 — one REST gameplay mutation transport
```

RECOVERY-HARDEN-4 exact-SHA CI run `35674013904` succeeded for typecheck, PostgreSQL-backed tests, build-web, build-telegram, and build-api. Hermes's local recovery worktree and the remote recovery branch were aligned at `a7e984b...` after publication. The superseded local documentation commit remains preserved only on local branch `preserve/recovery-harden1-docs-reconcile`.

Deployment remains separate from recovery source state. Railway API production is still sourced from `main`; original Cloudflare Web/Telegram production branches remain `feature/visual-integration-checkpoint`. Recovery publication is not production deployment proof.

## Last completed task

**RECOVERY-HARDEN-4 — gameplay mutation transport authority — COMPLETE / PUBLISHED / EXACT-SHA CI GREEN.**

Published chain:

```text
b5df94103455569a2dc12b1627aab0818d5e3bbf
  test(transport): require one REST gameplay mutation authority

cb3126c96c58db68f9401304cc23cd2fde5911d4
  fix(transport): retire realtime gameplay command authority

a7e984bc6bb4bd22bf23d471550d677a4cba5500
  docs: reconcile recovery state and gameplay transport authority
```

Resulting transport contract:

1. Web and Telegram submit gameplay mutations through `packages/api-client`.
2. The single authoritative gameplay mutation route is `POST /v1/games/:sessionId/commands`.
3. `CribbitRealtimeClient` no longer exposes or emits a gameplay `sendCommand`.
4. The server has no socket `game-command` gameplay mutation handler.
5. Realtime remains subscription/invalidation/update transport only.
6. `packages/action-registry` marks gameplay actions as `POST`; the only remaining `method:'WS'` entry is genuinely realtime.
7. Simulation remains local/shared-engine QA and was not converted to network REST.

Exact GitHub Actions evidence:

```text
run 35674013904
head a7e984bc6bb4bd22bf23d471550d677a4cba5500
typecheck        SUCCESS
test             SUCCESS
build-web        SUCCESS
build-telegram   SUCCESS
build-api        SUCCESS
```

Historical command-identity/concurrency proof from RECOVERY-HARDEN-3/3B remains valid background evidence; it is no longer the last completed task.

## Current task

**None in flight after RECOVERY-HARDEN-4 documentation reconciliation.** The owner must authorize the next implementation slice.

## Next task / authorization state

**No implementation task is currently authorized after this slice.**

Remaining hardening candidates (the former REST-vs-socket `game-command` metadata item is completed by RECOVERY-HARDEN-4):

1. resolve the Truth-or-Chaos owner decisions, then repair its pending group-punishment completion path;
2. complete the whole-product ownership/dependency audit before broad deletion or migration work;
3. Roulette SVG presentation, migration of unmigrated product verticals, and retirement of the preserved legacy/canonical client runtimes remain separately unauthorized.

**AUTHORITY-GUARD-1 remains unauthorized and not started.** Its precondition list still includes the unresolved Truth-or-Chaos owner decisions; the transport-authority contradiction is reconciled by RECOVERY-HARDEN-4.

## Blockers and known unknowns

- **Gameplay transport metadata — RESOLVED by RECOVERY-HARDEN-4:** gameplay mutation has exactly one transport (`POST /v1/games/:sessionId/commands`); `CribbitRealtimeClient` no longer exposes a gameplay command sender and the action registry no longer claims `method:'WS'` outside genuinely realtime actions.
- **Truth or Chaos:** the current flow can reach `groupPunishmentPending` without a proven completion path. Whether the instigator also answers and the exact refusal/Pass rule remain unresolved owner decisions; do not invent them.
- **Whole-product recovery:** prompt library/create/save, room prompt pool, notifications, moderation, answers, recap/history and other retained verticals remain UNMIGRATED. Not wired does not mean dead.
- Real Telegram Mini App runtime remains NOT VERIFIED in this environment (no genuine Telegram-generated `initData`).
- `apps/web/src/canonical-game-runtime.ts` remains `UNKNOWN — PRESERVE`; zero importers is not removal proof.
- Local Simulation can stall on a special-card interaction expecting human input; Pass / Rewind / Nope / Flag remain Live-path-only observations.

## Publication / deployment state

The accepted RECOVERY-HARDEN-4 engineering/documentation baseline is `a7e984bc6bb4bd22bf23d471550d677a4cba5500`. This documentation-only reconciliation follows that baseline and does not alter runtime behavior.

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a
RECOVERY-HARDEN-4 RED                         b5df94103455569a2dc12b1627aab0818d5e3bbf
RECOVERY-HARDEN-4 implementation              cb3126c96c58db68f9401304cc23cd2fde5911d4
RECOVERY-HARDEN-4 closeout                    a7e984bc6bb4bd22bf23d471550d677a4cba5500
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

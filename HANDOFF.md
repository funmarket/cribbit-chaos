# Handoff — Cribbit CHAOS recovery

Concise operational handoff for an agent resuming this repository without chat history.
Read order: `AGENTS.md` -> this file -> `docs/LIVING_STATUS.md` -> the `CURRENT TASK` in `PLAN.md` -> relevant rule/domain docs -> source.

## Mission

Recover `funmarket/cribbit-chaos` as ONE Cribbit CHAOS application with TWO frontend delivery surfaces (Web browser client and Telegram Mini App) over one authoritative backend: one Railway API, one Railway PostgreSQL database, one canonical identity model (`users.id`), one shared game engine, and one persistent domain model. The original damage was split gameplay authority (duplicate client runtimes); the recovery removes duplicate authority instead of inventing new product behaviour.

## Mandatory whole-project preservation gate

Before any task, apply the **Whole-Project Scope and Preservation Rule** in `AGENTS.md`. Cribbit CHAOS is a full application, not a board-only project. A narrow task limits what may be changed; it does **not** limit dependency investigation or whole-product impact analysis. “Not currently wired,” “zero importers,” or “not used by the board” is never sufficient evidence that code or a feature is irrelevant. When ownership, purpose, dependency, or migration/replacement status is not proven, classify it **`UNKNOWN — PRESERVE`** and stop before removal.

## Verified shared repository state

Fresh shared-state verification before this reconciliation:

```text
repository                                  funmarket/cribbit-chaos
branch                                      recovery/single-engine-authority
published tip before this reconciliation    187d0c25b971d00f474a7ffea4ef8a230e7bf793
RECOVERY-HARDEN-1                           95e4d846d99ad55a6b7181c3b23ebf626a54109b   (published / accepted)
main                                        964a9162d7d9e1a12acfccc61f0fb88430a8f4ff   (unchanged)
recovery/single-engine-authority-ci         f384c824a0553d1adceb05ef55612e177967bb1a   (unchanged)
deployed from recovery branch               NO
```

Published recovery ancestry immediately before this reconciliation:

```text
e56936cb1d98344f87f3ca9ee6202cf018e58c27
-> 95e4d846d99ad55a6b7181c3b23ebf626a54109b   RECOVERY-HARDEN-1
-> 187d0c25b971d00f474a7ffea4ef8a230e7bf793   whole-project preservation rule
```

GitHub CI evidence: run `35636741098` succeeded on `95e4d846`; run `35640701568` succeeded on `187d0c25` (typecheck, test, build-web, build-telegram, build-api). The Windows Hermes worktree is not shared-state authority and must be freshly inspected before local mutation; do not infer its HEAD or cleanliness from this document.

## Last completed task

**RECOVERY-HARDEN-3 — persisted command-ID replay/collision reconciliation — IMPLEMENTED / PUBLISHED.**

The slice used test-first recovery:

- RED test commit `cbe8c6fd0fee710e2f0e892d201168798a8bde0b` changed only `apps/api/test/command-id-boundary.test.ts`. Exact CI run `35663801731` failed for the intended missing contract: no shared `fingerprintGameCommand` export and no persisted fingerprint/global-command-id reconciliation in `game-service.ts`.
- GREEN implementation commit `67dbff10ee60e38957d0d969ee4a20669d74e0bf` introduced one shared semantic fingerprint owner at `packages/game-engine/src/command-identity.ts`, reused it in the reducer and PLAY_NOPE router, and reconciled PostgreSQL duplicate handling in `apps/api/src/game-service.ts`.
- Exact CI run `35663953597` succeeded on `67dbff10...` (typecheck, test, build-web, build-telegram, build-api).

The persisted command contract is now:

1. `game_commands.command_id` remains the global UUID idempotency key; no schema/migration change was required.
2. `expectedRevision` is an execution precondition, not semantic command identity.
3. Same command UUID + same session/player/type/payload fingerprint replays the stored result without a second transition.
4. Same command UUID reused with a different session, player, type or semantic payload returns controlled `COMMAND_ID_COLLISION` and does not insert another command row or mutate gameplay state.
5. The shared engine and persisted API path use the same fingerprint function rather than maintaining divergent identity rules.

Important evidence boundary: GitHub CI has no `DATABASE_URL`, so its DB-backed command-ID integration rows are skipped. This slice is source-verified and exact-SHA CI green, but the new cross-session PostgreSQL assertion has **not** been rerun against a disposable PostgreSQL instance in this environment. Do not describe that unrun database integration as verified runtime evidence.

Before RECOVERY-HARDEN-3: RECOVERY-HARDEN-2 removed Live client-side gameplay decision authority; RECOVERY-HARDEN-1 serialized Live room joins/starts; the whole-project preservation rule remains mandatory.

## Current task

**None in flight after RECOVERY-HARDEN-3 documentation reconciliation.** The owner must authorize the next implementation slice.

## Next task / authorization state

**No implementation task is currently authorized after this slice.**

Remaining hardening candidates:

1. reconcile authoritative REST gameplay commands with the stale socket `game-command` client/action-registry metadata;
2. resolve the Truth-or-Chaos owner decisions, then repair its pending group-punishment completion path;
3. complete the whole-product ownership/dependency audit before broad deletion or migration work.

**AUTHORITY-GUARD-1 remains deferred** until the known authority contradictions above are reconciled.

## Blockers and known unknowns

- **Gameplay transport metadata:** active gameplay mutation is REST, while stale realtime/action-registry metadata still describes a socket `game-command` path. Caller/ownership archaeology is required before removal or rewriting.
- **Truth or Chaos:** the current flow can reach `groupPunishmentPending` without a proven completion path. Whether the instigator also answers and the exact refusal/Pass rule remain unresolved owner decisions; do not invent them.
- **Command-ID database evidence boundary:** the source contract is reconciled and exact-SHA CI is green, but GitHub CI skips `DATABASE_URL` tests. The new cross-session collision behavior still needs a disposable-PostgreSQL run before calling that integration path runtime-verified.
- **Whole-product recovery:** prompt library/create/save, room prompt pool, notifications, moderation, answers, recap/history and other retained verticals remain UNMIGRATED. Not wired does not mean dead.
- Real Telegram Mini App runtime remains NOT VERIFIED in this environment (no genuine Telegram-generated `initData`).
- `apps/web/src/canonical-game-runtime.ts` remains `UNKNOWN — PRESERVE`; zero importers is not removal proof.
- Local Simulation can stall on a special-card interaction expecting human input; Pass / Rewind / Nope / Flag remain Live-path-only observations.

## Publication / deployment state

The recovery branch is published through RECOVERY-HARDEN-3. The implementation candidate `67dbff10ee60e38957d0d969ee4a20669d74e0bf` is green in GitHub Actions run `35663953597`; this documentation reconciliation is the next documentation-only commit.

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff   (unchanged)
origin/feature/visual-integration-checkpoint  95febd07e4d739c96843fcc4a02f070eb3c623c0   (deployed production source)
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a   (CI anchor)
origin/recovery/single-engine-authority       this documentation reconciliation; parent 67dbff10ee60e38957d0d969ee4a20669d74e0bf
```

No recovery-branch merge or deployment has occurred. Production must not be mutated without an explicit owner gate.

## Resume instructions

1. Freshly verify the branch, HEAD, worktree and remote before any local mutation.
2. Read `docs/LIVING_STATUS.md`, `PLAN.md`, the whole-product preservation rule in `AGENTS.md`, and relevant rule/domain docs.
3. Treat the earlier `PLAN.md` wording that places `AUTHORITY-GUARD-1` immediately next as stale sequencing, not implementation authorization; owner authorization is required and the guard is deferred pending known hardening contradictions.
4. Follow `AGENTS.md` mandatory workflow (inspect -> change -> verify -> remove only proven-superseded artifacts -> update living docs -> publish -> verify runtime).
5. Use deterministic NoDrift / Literal Command Executor discipline for consequential mutations.
6. Never push, deploy, merge or mutate production resources without explicit authorization.

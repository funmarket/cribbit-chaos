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

**RECOVERY-HARDEN-3B — command identity completeness, concurrency and PostgreSQL CI proof — COMPLETE / PUBLISHED.**

This follow-up closed the remaining quality gaps found in the second review of RECOVERY-HARDEN-3.

TDD evidence:

- RED test commit `d24264e40e33bcfa2f8f66087301df460a449c3f` added regressions for payload completeness, global command-id serialization, PostgreSQL 16 CI, and concurrent duplicate UUID behavior. Exact CI run `35667283036` failed for the intended missing behavior:
  - `ACTIVATE_GHOST.cardId` was not part of semantic identity;
  - no global command-id advisory lock existed before duplicate lookup;
  - CI had no PostgreSQL service/database-backed test execution.
- GREEN implementation commit `3fd53f7748f28ddc10883278ce1f1b57fdb60434` fixed all three gaps.
- Exact CI run `35667385029` succeeded with PostgreSQL 16, migrations applied, and DB-backed tests enabled.

The final command-ID contract is:

1. `game_commands.command_id` is the global UUID idempotency key.
2. `expectedRevision` and `commandId` are envelope metadata, not semantic command identity.
3. Every current `GameCommand` variant is handled explicitly by `fingerprintGameCommand`; payload-bearing commands cannot silently fall through because the switch is exhaustively type-checked.
4. `ACTIVATE_GHOST.cardId`, `NOPE_REACTION.useNope`, timeout revision identity and all other current semantic payload fields are included.
5. Same UUID + same semantic command replays one stored result.
6. Same UUID + different semantic command returns controlled `COMMAND_ID_COLLISION`.
7. A transaction-scoped PostgreSQL advisory lock keyed by command UUID is acquired before duplicate lookup, so simultaneous identical retries and cross-session collisions cannot race into a raw primary-key failure.
8. GitHub CI now starts PostgreSQL 16, runs `npm run migrate:db`, and executes the database-backed tests.

Exact CI evidence on `3fd53f...`:

```text
run 35667385029  SUCCESS
typecheck        PASS
test             PASS
build-web        PASS
build-telegram   PASS
build-api        PASS

PostgreSQL migrations:
001_initial.sql                   applied
002_dual_web_auth.sql             applied
003_identity_link_challenges.sql  applied

tests     252
passed    246
failed    0
skipped   6
```

The command-ID DB evidence gap is therefore CLOSED for the tested PostgreSQL 16 CI environment.

Before this follow-up: RECOVERY-HARDEN-3 established one shared command fingerprint owner; RECOVERY-HARDEN-2 removed Live client-side gameplay decision authority; RECOVERY-HARDEN-1 serialized Live room joins/starts.

## Current task

**None in flight after RECOVERY-HARDEN-3B documentation reconciliation.** The owner must authorize the next implementation slice.

## Next task / authorization state

**No implementation task is currently authorized after this slice.**

Remaining hardening candidates:

1. reconcile authoritative REST gameplay commands with stale socket `game-command` client/action-registry metadata;
2. resolve the Truth-or-Chaos owner decisions, then repair its pending group-punishment completion path;
3. complete the whole-product ownership/dependency audit before broad deletion or migration work.

**AUTHORITY-GUARD-1 remains deferred** until the known authority contradictions above are reconciled.

## Blockers and known unknowns

- **Gameplay transport metadata:** active gameplay mutation is REST, while stale realtime/action-registry metadata still describes a socket `game-command` path. Caller/ownership archaeology is required before removal or rewriting.
- **Truth or Chaos:** the current flow can reach `groupPunishmentPending` without a proven completion path. Whether the instigator also answers and the exact refusal/Pass rule remain unresolved owner decisions; do not invent them.
- **Whole-product recovery:** prompt library/create/save, room prompt pool, notifications, moderation, answers, recap/history and other retained verticals remain UNMIGRATED. Not wired does not mean dead.
- Real Telegram Mini App runtime remains NOT VERIFIED in this environment (no genuine Telegram-generated `initData`).
- `apps/web/src/canonical-game-runtime.ts` remains `UNKNOWN — PRESERVE`; zero importers is not removal proof.
- Local Simulation can stall on a special-card interaction expecting human input; Pass / Rewind / Nope / Flag remain Live-path-only observations.

## Publication / deployment state

The recovery branch is published through RECOVERY-HARDEN-3B. Implementation candidate `3fd53f7748f28ddc10883278ce1f1b57fdb60434` is green in GitHub Actions run `35667385029`; this documentation reconciliation is the next documentation-only commit.

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff   (unchanged)
origin/feature/visual-integration-checkpoint  95febd07e4d739c96843fcc4a02f070eb3c623c0   (deployed production source)
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a   (CI anchor)
origin/recovery/single-engine-authority       this documentation reconciliation; parent 3fd53f7748f28ddc10883278ce1f1b57fdb60434
```

No recovery-branch merge or deployment has occurred. Production must not be mutated without an explicit owner gate.

## Resume instructions

1. Freshly verify the branch, HEAD, worktree and remote before any local mutation.
2. Read `docs/LIVING_STATUS.md`, `PLAN.md`, the whole-product preservation rule in `AGENTS.md`, and relevant rule/domain docs.
3. Treat the earlier `PLAN.md` wording that places `AUTHORITY-GUARD-1` immediately next as stale sequencing, not implementation authorization; owner authorization is required and the guard is deferred pending known hardening contradictions.
4. Follow `AGENTS.md` mandatory workflow (inspect -> change -> verify -> remove only proven-superseded artifacts -> update living docs -> publish -> verify runtime).
5. Use deterministic NoDrift / Literal Command Executor discipline for consequential mutations.
6. Never push, deploy, merge or mutate production resources without explicit authorization.

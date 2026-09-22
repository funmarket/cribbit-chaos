# Handoff — Cribbit CHAOS recovery

Concise operational handoff for an agent resuming this repository without chat history.
Read order: `AGENTS.md` -> this file -> `docs/LIVING_STATUS.md` -> the `CURRENT TASK` in `PLAN.md` -> relevant rule/domain docs -> source.

## Mission

Recover `funmarket/cribbit-chaos` as ONE Cribbit CHAOS application with TWO frontend delivery surfaces (Web browser client and Telegram Mini App) over one authoritative backend: one Railway API, one Railway PostgreSQL database, one canonical identity model (`users.id`), one shared game engine, and one persistent domain model. The original damage was split gameplay authority (duplicate client runtimes); the recovery removes duplicate authority instead of inventing new product behaviour.

## Mandatory whole-project preservation gate

Before any task, apply the **Whole-Project Scope and Preservation Rule** in `AGENTS.md`. Cribbit CHAOS is a full application, not a board-only project. A narrow task limits what may be changed; it does **not** limit dependency investigation or whole-product impact analysis. “Not currently wired,” “zero importers,” or “not used by the board” is never sufficient evidence that code or a feature is irrelevant. When ownership, purpose, dependency, or migration/replacement status is not proven, classify it **`UNKNOWN — PRESERVE`** and stop before removal.

## Verified shared repository state

Fresh shared-state verification for this documentation rebaseline:

```text
repository                                  funmarket/cribbit-chaos
branch                                      recovery/single-engine-authority
published parent before this rebaseline     625f0ade6889a97a8577eebe3682879f1819ee8a
main                                        964a9162d7d9e1a12acfccc61f0fb88430a8f4ff   (unchanged)
recovery/single-engine-authority-ci         f384c824a0553d1adceb05ef55612e177967bb1a   (unchanged)
recovery branch deployed                    NO
```

Current accepted recovery sequence includes:

```text
95e4d846   RECOVERY-HARDEN-1 — room concurrency
3b1da012 + 812acce   RECOVERY-HARDEN-2 — server-projected Live capabilities
67dbff10 + 3fd53f77   RECOVERY-HARDEN-3/3B — command identity/collision/concurrency
625f0ade   documentation closeout for HARDEN-3 quality gaps
```

Exact GitHub CI on `625f0ade...`: run `35667604453` SUCCESS (typecheck, PostgreSQL-backed test job, build-web, build-telegram, build-api). Hermes's Windows recovery worktree was subsequently aligned to the same SHA with a clean 0/0 ahead/behind state; its superseded local docs commit is preserved only on local branch `preserve/recovery-harden1-docs-reconcile`.

Deployment is intentionally separate from recovery source state. Fresh provider inspection shows Railway API source branch `main` with latest successful deployment commit `b48493dbd5eebf5a0bc82755c1e739117d8f713a`; original Cloudflare Web/Telegram production branches remain `feature/visual-integration-checkpoint`. Recovery pushes are not production deployment proof.

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

RECOVERY-HARDEN-4 established one gameplay mutation transport: gameplay commands reach the authoritative engine only through `POST /v1/games/:sessionId/commands`. The stale `CribbitRealtimeClient.sendCommand` socket gameplay emit was removed and `packages/action-registry` no longer claims `method:'WS'` outside genuinely realtime actions.

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

The recovery source line is published through the RECOVERY-HARDEN-4 chain, whose tip is this documentation commit: RED contract `b5df94103455569a2dc12b1627aab0818d5e3bbf` -> implementation `cb3126c96c58db68f9401304cc23cd2fde5911d4` -> this documentation commit. Its parent is the implementation commit; the previously published tip was `adc947cd8d1f8fd3737396a39445485ceff46cf8`.

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a
origin/recovery/single-engine-authority       RECOVERY-HARDEN-4 documentation commit; parent cb3126c96c58db68f9401304cc23cd2fde5911d4
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

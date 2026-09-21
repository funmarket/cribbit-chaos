# Handoff — Cribbit CHAOS recovery

Concise operational handoff for an agent resuming this repository without chat history.
Read order: `AGENTS.md` -> this file -> `docs/LIVING_STATUS.md` -> the `CURRENT TASK` in `PLAN.md` -> relevant rule/domain docs -> source.

## Mission

Recover `funmarket/cribbit-chaos` as ONE Cribbit CHAOS application with TWO frontend delivery surfaces (Web browser client and Telegram Mini App) over one authoritative backend: one Railway API, one Railway PostgreSQL database, one canonical identity model (`users.id`), one shared game engine, and one persistent domain model. The original damage was split gameplay authority (duplicate client runtimes); the recovery removes duplicate authority instead of inventing new product behaviour.

## Exact verified local state

```text
repository   funmarket/cribbit-chaos
worktree     C:\Users\GrowB\cribbit-chaos-recovery
branch       recovery/single-engine-authority
HEAD         e56936cb1d98344f87f3ca9ee6202cf018e58c27   (published preservation baseline)
worktree     clean            (verified by `git status --short` and `git diff --check`)
pushed       YES              (recovery/single-engine-authority published on origin for preservation)
deployed     no
```

`e56936c` is the published baseline this document was reconciled against (DOC-REBASELINE-1 plus its preservation-classification correction). The RECOVERY-HARDEN-1 commit (live room concurrency) is the local commit after it and is deliberately **not** pushed. Always re-confirm with:

```sh
git rev-parse HEAD
git status --short
git ls-remote origin refs/heads/recovery/single-engine-authority
```

## Last completed task

**RECOVERY-HARDEN-1 — live room concurrency hardening.** Two PostgreSQL races found by review of the published branch are fixed with database-level serialization (a room-row lock taken inside the transaction): concurrent joins can no longer push a waiting room past its configured `playerCount`, and concurrent host Start requests can no longer create two ACTIVE sessions (the loser fails with `SESSION_ALREADY_CREATED`). New real-PostgreSQL coverage: `apps/api/test/live-room-concurrency.test.ts`. This commit is local only and unpushed. Before it: the documentation rebaseline (DOC-REBASELINE-1 `2f23997` plus its correction `e56936c`), and before that:

**Special-card play from hand + Voluntary Draw (canonical gameplay-rule reconciliation).**
`Game_rules.md` sections 51 and 52 (`RULE-SPECIAL-PLAY-001`..`008`, `RULE-VOLUNTARY-DRAW-001`..`007`) with supersession/clarification register entries; implemented in `packages/game-engine/src/validation.ts` (hand legality decided by the actual top Play Pile card), `packages/game-engine/src/reducer.ts` (retired voluntary-draw gate removed, Ghost-turn exception kept), and the retired `allowVoluntaryDraw` production knob removed from `GameConfig`, engine defaults, Live config and Simulation config. Local commit `cb1b1b9289458ddde9709498caf25d4073f60cd3`.

## Current task

None in flight. The branch tip (RECOVERY-HARDEN-1, live room concurrency) is the verified state awaiting owner review; read the exact SHA with `git rev-parse HEAD`. The published baseline is `e56936c`.

## Next authorized task

**AUTHORITY-GUARD-1** — a machine-enforced rule-ID / change-governance gate (direction recorded in `docs/CHANGE_GOVERNANCE.md`). Then the whole-product ownership/dependency audit. Do not start either from this handoff; they require explicit owner authorization. Pushing the RECOVERY-HARDEN-1 commit also requires explicit authorization.

## Blockers and known unknowns

- Real Telegram Mini App runtime is NOT VERIFIED in this environment (no genuine Telegram-generated `initData`); server-side validation is proven only with locally minted spec-correct signed `initData`.
- Whole-product verticals are UNMIGRATED: prompt library/create/save, room prompt pool, notifications, moderation advancement answer and recap persistence (see `docs/LIVING_STATUS.md`).
- Deferred implementation observations (recorded, NOT authorized work): `apps/web/src/canonical-game-runtime.ts` has zero importers and is not part of the active authoritative runtime path — preservation classification `UNKNOWN — PRESERVE`, removal not authorized until ownership, historical product purpose and migration/replacement status are proven; the Live client emits a `game-command` socket event with no server handler; the Truth-or-Chaos flow can deadlock; local Simulation can stall on a special-card interaction expecting human input.
- Local Simulation safety controls (Pass / Rewind / Nope / Flag) are live-path only.

## Publication / deployment state

The recovery branch is published on origin for preservation at `e56936c` (authorized non-force push; GitHub Actions run 35627085061 green 5/5). The RECOVERY-HARDEN-1 commit above is **not** pushed and no push of it is authorized yet. No merge and no deployment happened. Remote state:

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/feature/visual-integration-checkpoint  95febd07e4d739c96843fcc4a02f070eb3c623c0   (deployed production source)
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a   (CI anchor)
origin/recovery/single-engine-authority       e56936cb1d98344f87f3ca9ee6202cf018e58c27   (published for preservation)
```

Deployment targets remain Cloudflare Pages (Web, Telegram) and Railway (API, PostgreSQL). Production must not be mutated without an explicit owner gate.

## Resume instructions

1. `git status --short` and `git diff --check` must both be clean; confirm the branch and `git rev-parse HEAD`.
2. Read `docs/LIVING_STATUS.md` for the single `CURRENT TASK`, current blocker and next authorized task.
3. Read the `PLAN.md` roadmap section for the authorized sequence; do not start a later phase early.
4. Follow `AGENTS.md` mandatory workflow (inspect -> change -> verify -> remove superseded artifacts -> update living docs -> publish -> verify runtime).
5. Use the deterministic NoDrift / Literal Command Executor discipline for consequential mutations: fresh state -> preflight -> one-time token -> begin -> exactly one logical mutation -> immediate postcheck.
6. Never push, deploy, merge or mutate remote resources without explicit authorization.

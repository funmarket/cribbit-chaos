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
HEAD         cb1b1b9289458ddde9709498caf25d4073f60cd3
worktree     clean            (verified by `git status --short` and `git diff --check`)
pushed       no               (origin has no ref for this branch)
deployed     no
```

`cb1b1b9` is the tip this document was reconciled against (the canonical Special-card play and Voluntary Draw slice). The DOC-REBASELINE-1 commit is documentation-only and advances the tip by exactly one commit — always re-confirm with:

```sh
git rev-parse HEAD
git status --short
git ls-remote origin refs/heads/recovery/single-engine-authority
```

## Last completed task

**Special-card play from hand + Voluntary Draw (canonical gameplay-rule reconciliation).**
`Game_rules.md` sections 51 and 52 (`RULE-SPECIAL-PLAY-001`..`008`, `RULE-VOLUNTARY-DRAW-001`..`007`) with supersession/clarification register entries; implemented in `packages/game-engine/src/validation.ts` (hand legality decided by the actual top Play Pile card), `packages/game-engine/src/reducer.ts` (retired voluntary-draw gate removed, Ghost-turn exception kept), and the retired `allowVoluntaryDraw` production knob removed from `GameConfig`, engine defaults, Live config and Simulation config. Local commit `cb1b1b9289458ddde9709498caf25d4073f60cd3`.

## Current task

**DOC-REBASELINE-1** — documentation rebaseline only (this slice). It creates/updates the twelve-document set so the repository itself is the resume point. No source, test, schema, dependency or `Game_rules.md` change is authorized in it.

## Next authorized task

**AUTHORITY-GUARD-1** — a machine-enforced rule-ID / change-governance gate (direction recorded in `docs/CHANGE_GOVERNANCE.md`). Then the whole-product ownership/dependency audit. Do not start either from this handoff; they require explicit owner authorization.

## Blockers and known unknowns

- Real Telegram Mini App runtime is NOT VERIFIED in this environment (no genuine Telegram-generated `initData`); server-side validation is proven only with locally minted spec-correct signed `initData`.
- Whole-product verticals are UNMIGRATED: prompt library/create/save, room prompt pool, notifications, moderation advancement answer and recap persistence (see `docs/LIVING_STATUS.md`).
- Deferred implementation observations (recorded, NOT authorized work): `apps/web/src/canonical-game-runtime.ts` has zero importers; the Live client emits a `game-command` socket event with no server handler; the Truth-or-Chaos flow can deadlock; local Simulation can stall on a special-card interaction expecting human input.
- Local Simulation safety controls (Pass / Rewind / Nope / Flag) are live-path only.

## Publication / deployment state

Nothing is pushed, deployed or merged from this recovery branch. Remote state, unchanged by this work:

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/feature/visual-integration-checkpoint  95febd07e4d739c96843fcc4a02f070eb3c623c0   (deployed production source)
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a   (CI anchor)
origin/recovery/single-engine-authority       (absent)
```

Deployment targets remain Cloudflare Pages (Web, Telegram) and Railway (API, PostgreSQL). Production must not be mutated without an explicit owner gate.

## Resume instructions

1. `git status --short` and `git diff --check` must both be clean; confirm the branch and `git rev-parse HEAD`.
2. Read `docs/LIVING_STATUS.md` for the single `CURRENT TASK`, current blocker and next authorized task.
3. Read the `PLAN.md` roadmap section for the authorized sequence; do not start a later phase early.
4. Follow `AGENTS.md` mandatory workflow (inspect -> change -> verify -> remove superseded artifacts -> update living docs -> publish -> verify runtime).
5. Use the deterministic NoDrift / Literal Command Executor discipline for consequential mutations: fresh state -> preflight -> one-time token -> begin -> exactly one logical mutation -> immediate postcheck.
6. Never push, deploy, merge or mutate remote resources without explicit authorization.

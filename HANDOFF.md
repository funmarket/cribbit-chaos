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

**RECOVERY-HARDEN-2 — server-projected Live gameplay capabilities — COMPLETE / PUBLISHED.**

Source commit `3b1da012792ba2a21682cdb3d3b70f781cc58a05` moved Live legality/action-capability projection to the authoritative server/API boundary:

- `apps/api/src/game-service.ts` now projects `PlayerDecisionCapabilities` with each viewer snapshot and successful command response;
- `packages/api-client` carries those typed capabilities to both clients;
- Web Live no longer imports `isLegalPlay` or `projectDecisionCapabilities` from `packages/game-engine`;
- Telegram Live no longer imports those gameplay decision helpers either;
- playability, Draw availability and capability buttons are rendered from the server-projected capability set;
- Local QA Simulation keeps its legitimate in-memory engine ownership through `packages/simulation`, whose adapters expose `getCapabilities()` without giving Live presentation direct engine authority.

The first exact-SHA CI run on `3b1da012...` failed only because `apps/api/test/bot-authority-contract.test.ts` still asserted the superseded client-side helper calls. The narrow test-only follow-up `812acce7356c22336bb41e0e77f02893a3d4c771` replaced those stale assertions with the stronger server-projection invariant. Exact GitHub CI run `35661725013` succeeded on `812acce...` (typecheck, test, build-web, build-telegram, build-api).

Before RECOVERY-HARDEN-2: RECOVERY-HARDEN-1 `95e4d846...` fixed Live room concurrency; `187d0c25...` added the whole-project preservation rule; `2e621715...` reconciled publication state.

## Current task

**None in flight after RECOVERY-HARDEN-2 documentation reconciliation.** The owner must authorize the next implementation slice.

## Next task / authorization state

**No implementation task is currently authorized after this slice.**

Remaining hardening candidates, to be selected by the owner:

1. reconcile the persistent command-ID replay/collision contract;
2. reconcile REST gameplay-command authority with stale socket/action-registry metadata;
3. resolve the Truth-or-Chaos owner decisions, then repair its pending group-punishment completion path;
4. complete the whole-product ownership/dependency audit before broad deletion or migration work.

**AUTHORITY-GUARD-1 remains deferred** until the known authority contradictions above are reconciled.

## Blockers and known unknowns

- **Command-ID persistence contract:** persistent idempotency and engine collision semantics remain to be reconciled for reused command IDs, differing fingerprints and session scope.
- **Gameplay transport metadata:** active gameplay mutation is REST, while stale realtime/action-registry metadata still describes a socket `game-command` path. Caller/ownership archaeology is required before removal or rewriting.
- **Truth or Chaos:** the current flow can reach `groupPunishmentPending` without a proven completion path. Whether the instigator also answers and the exact refusal/Pass rule remain unresolved owner decisions; do not invent them.
- **Whole-product recovery:** prompt library/create/save, room prompt pool, notifications, moderation, answers, recap/history and other retained verticals remain UNMIGRATED. Not wired does not mean dead.
- Real Telegram Mini App runtime remains NOT VERIFIED in this environment (no genuine Telegram-generated `initData`); server validation is proven only with locally minted spec-correct signed data.
- `apps/web/src/canonical-game-runtime.ts` remains `UNKNOWN — PRESERVE`; zero importers is not removal proof.
- Local Simulation can stall on a special-card interaction expecting human input; Pass / Rewind / Nope / Flag remain Live-path-only observations.

## Publication / deployment state

The recovery branch is published through RECOVERY-HARDEN-2. The implementation/test candidate `812acce7356c22336bb41e0e77f02893a3d4c771` is green in GitHub Actions run `35661725013`; this documentation reconciliation is the next documentation-only commit on top of that candidate.

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff   (unchanged)
origin/feature/visual-integration-checkpoint  95febd07e4d739c96843fcc4a02f070eb3c623c0   (deployed production source)
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a   (CI anchor)
origin/recovery/single-engine-authority       this documentation reconciliation; parent 812acce7356c22336bb41e0e77f02893a3d4c771
```

No recovery-branch merge or deployment has occurred. Deployment targets remain Cloudflare Pages (Web, Telegram) and Railway (API, PostgreSQL). Production must not be mutated without an explicit owner gate.

## Resume instructions

1. Freshly verify the branch, HEAD, worktree and remote before any local mutation.
2. Read `docs/LIVING_STATUS.md`, `PLAN.md`, the whole-product preservation rule in `AGENTS.md`, and relevant rule/domain docs.
3. Treat the earlier `PLAN.md` wording that places `AUTHORITY-GUARD-1` immediately next as stale sequencing, not implementation authorization; owner authorization is required and the guard is deferred pending known hardening contradictions.
4. Follow `AGENTS.md` mandatory workflow (inspect -> change -> verify -> remove only proven-superseded artifacts -> update living docs -> publish -> verify runtime).
5. Use deterministic NoDrift / Literal Command Executor discipline for consequential mutations.
6. Never push, deploy, merge or mutate production resources without explicit authorization.

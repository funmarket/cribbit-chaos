# Cribbit CHAOS Living Status

Central execution ledger: verified current state, completed slices, whole-product status, exactly one current task, blockers, and publication state.
This file mirrors status only; the detailed roadmap is owned by `PLAN.md`, and game rules are owned by `Game_rules.md`.
Superseded narratives are not kept here: this file describes one current state only.

## Project end goal

Recover `funmarket/cribbit-chaos` as ONE Cribbit CHAOS application with TWO frontend delivery surfaces (Web browser client and Telegram Mini App) over one authoritative backend:

```text
Web client / Telegram client
-> packages/api-client
-> apps/api (Node API, routes, domain services)
-> packages/game-engine (gameplay authority)
-> Railway PostgreSQL (one database, one schema)
```

The original damage was split gameplay authority (duplicate client runtimes). The recovery removes duplicate authority, restores real multiplayer, and keeps one canonical identity model (`users.id`). Whole-product scope (accounts, rooms, prompts, answers, recaps, moderation, control room) is preserved even where unmigrated — see `docs/PRODUCT_SCOPE.md`.

## Mandatory whole-project preservation gate

All work is governed by the **Whole-Project Scope and Preservation Rule** in `AGENTS.md`. Cribbit CHAOS must be evaluated as the complete product — Identity/Accounts, Rooms, Gameplay, Prompts, Libraries, Creation/Moderation, Call/Answers, Recap/History, Search/Notifications/Profile, Admin/Control Room, QA/Simulation, Web, Telegram, API, Realtime, and Database. A narrow task limits mutation scope, never investigation or dependency awareness. Unwired/unimported/unmigrated code is not dead by default; uncertainty means **`UNKNOWN — PRESERVE`** until whole-project ownership, purpose, dependencies, and migration/replacement state are proven.

## Verified shared repository state

Fresh shared-state verification for this documentation rebaseline:

```text
repository                                  funmarket/cribbit-chaos
branch                                      recovery/single-engine-authority
published parent before this rebaseline     625f0ade6889a97a8577eebe3682879f1819ee8a
main                                        964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
recovery/single-engine-authority-ci         f384c824a0553d1adceb05ef55612e177967bb1a
recovery branch deployed                    NO
```

Exact GitHub CI on `625f0ade...`: run `35667604453` SUCCESS. The test job runs PostgreSQL 16, canonical migrations and the DB-backed suite.

Hermes local recovery worktree was aligned to the same SHA with a clean worktree, no stash and 0/0 ahead/behind. Its superseded local-only documentation commit remains preserved on local branch `preserve/recovery-harden1-docs-reconcile`; it is not part of the recovery branch.

Fresh deployment separation:

```text
Railway API source branch              main
Railway latest successful API commit   b48493dbd5eebf5a0bc82755c1e739117d8f713a
Cloudflare Web production branch       feature/visual-integration-checkpoint
Cloudflare Telegram production branch  feature/visual-integration-checkpoint
```

Those deployed sources are older than the recovery branch and are not evidence that recovery work is live in production.

## Completed recovery slices (all local, all in this branch's ancestry)

| Slice | Commit | What it established |
|---|---|---|
| R1 cutover — engine/API as the only Web gameplay owner | `f384c82` | Shared engine + API command path own Web gameplay; the CI anchor commit |
| Recovery scope contract | `9e2f2e3` | Pinned allowed paths, stop conditions, failure ownership |
| CRLF reclassification | `7f934ad` | Two local test failures reclassified as CRLF fragility, not product failures |
| Live multiplayer lifecycle (Create -> Join -> Start) | `88e7f881` | Real members only, no fabricated bots, one authoritative session per Start |
| NAV-1 — shared page navigation | `efb7240` | Presentation-only navigation restored through the shared UI controller |
| SIM-1 — Local QA Simulation on the shared engine | `b083784` | `#startGameButton` = local QA Simulation (locked decision), no Live room, no persistence |
| LINK-1 — explicit cross-transport identity linking | `a91ee8b` | Explicit linking attaches a second method to an existing `users.id`; no merges |
| IDENTITY-2 — canonical identity convergence (API, UI, docs) | `beb2b2a`, `0730e64`, `5f2b4cfe` | Unknown Telegram auth is lookup-only; explicit creation makes exactly one user; no profile rewrite by authentication |
| LOGIN-A — identity-link challenge security boundary | `11eadf4` | Challenges moved to `identity_link_challenges`; atomic single use; the session-cookie alias exploit closed; the dormant OIDC callback fails closed |
| LOGIN-B — account lifecycle | `6e99205` | Telegram-only, Web-only and linked accounts all valid; backend-owned Web-login suggestion |
| LOGIN-C — minimum account UI | `6970960` | Account panel states both transports, issues one-time link codes, never renders the canonical user id |
| LOGIN-D — cross-client acceptance (read-only) | — | One authoritative game observed from both transports |
| LOGIN documentation | `2c7f1f9` | Locked account model recorded in the living documents |
| SIMSHARE-1 — one shared Simulation orchestrator | `7dae3e2` | `packages/simulation` owns client-independent QA orchestration; both clients are thin adapters |
| ROULETTE-PRIVACY-1 — sealed selection boundary | `59829d6` | Sealed Roulette selection is masked at the authoritative projection; viewers no longer receive it early |
| COMMAND-ID-1 — canonical Live command identity | `3a574ff` | Live `commandId` must be an RFC 4122 UUID; malformed ids fail with `400 INVALID_COMMAND_ENVELOPE` before persistence; idempotency preserved |
| Special-card play from hand + Voluntary Draw | `cb1b1b9` | `Game_rules.md` sections 51/52 implemented in the shared engine; the retired `allowVoluntaryDraw` production knob removed |
| DOC-REBASELINE-1 — documentation rebaseline | `2f23997` | Twelve-document set reconciled to verified reality (`AGENTS.md` reading order, `HANDOFF.md`, single execution ledger, roadmap order) |
| DOC-REBASELINE-1 correction — preservation classification | `e56936c` | `apps/web/src/canonical-game-runtime.ts` reclassified `DEAD / SAFE TO REMOVE` -> `UNKNOWN — PRESERVE` (published baseline) |
| RECOVERY-HARDEN-1 — live room concurrency | `95e4d84` | Published/accepted room-row-lock serialization: a waiting room can never exceed `playerCount` and one room can never hold two ACTIVE sessions |
| Whole-project preservation rule | `187d0c25` | Makes full-app dependency/preservation analysis mandatory; uncertain code is `UNKNOWN — PRESERVE` |
| Publication-state reconciliation | `2e621715` | Corrected the recovery branch/publication ledger and deferred Authority Guard until known hardening contradictions are reconciled |
| RECOVERY-HARDEN-2 — server-projected Live capabilities | `3b1da012`, `812acce` | Server/API projects each viewer's gameplay capabilities; Web/Telegram Live consume them without direct game-engine decision imports; stale architecture assertions were updated and exact candidate CI is green |
| RECOVERY-HARDEN-3 — persisted command-ID collision contract | `cbe8c6fd`, `67dbff10`, `31f8b3a8` | One shared semantic command fingerprint; persisted replay/collision behavior aligned across engine/API; documentation recorded |
| RECOVERY-HARDEN-3B — command identity completeness + concurrency | `d24264e4`, `3fd53f77`, `625f0ade` | Exhaustive payload-aware fingerprinting, advisory-lock serialization of global command IDs, PostgreSQL 16 CI with DB-backed concurrency proof, documentation closeout |

## Current canonical gameplay rules (this slice's authority)

`Game_rules.md` (canonical) records in sections 51/52:

- `RULE-SPECIAL-PLAY-001`..`008` — Special = every non-Number family; a Special may be played from hand while the top Play Pile card is not a Special, regardless of colour/number/value/symbol; Specials never stack onto a Special top (the player must play a legal Number or Draw); opening-deal Specials stay dormant in hand; post-start forced-on-draw behaviour is unchanged; classification never overrides card-specific timing (Nope stays reaction-only; Ghost keeps its own timing); the test uses the actual top Play Pile card.
- `RULE-VOLUNTARY-DRAW-001`..`007` — a player is never forced to play because a legal card exists; a voluntary draw is always available on a normal turn and ends that turn's hand-play opportunity; an ordinary drawn card is added and the turn advances; a drawn forced-on-draw card enters its flow immediately and restores no hand play; the Ghost-turn restriction (`RULE-GHOST-003`, `RULE-GHOST-009`) is the only approved normal-turn draw restriction.

Implementation owners: `packages/game-engine/src/validation.ts`, `packages/game-engine/src/reducer.ts`, `packages/game-engine/src/setup.ts`, `packages/contracts/src/index.ts`, `apps/api/src/game-service.ts`, `packages/simulation/src/index.ts`. Gameplay meaning is not restated elsewhere; see `docs/CHANGE_GOVERNANCE.md`.

## Whole-product status

| Capability | Classification | Verified state |
|---|---|---|
| Live multiplayer lifecycle + authoritative engine | ACTIVE | VERIFIED LOCALLY (real 5-user lifecycle; one authoritative session) |
| Web Live commands, snapshots, privacy projection | ACTIVE | VERIFIED LOCALLY (private hands; sealed Roulette masked; command id contract enforced) |
| Realtime transport (invalidations only) | ACTIVE | VERIFIED LOCALLY (`room-updated`, `room-started`, `session-updated`) |
| Accounts, identity linking, Web login, Telegram auth | ACTIVE | VERIFIED LOCALLY (spec-signed `initData`); real Mini App runtime NOT VERIFIED |
| Local QA Simulation (Web; Telegram adapter) | ACTIVE (QA) | VERIFIED LOCALLY; special-card human-input stall known |
| Shared navigation + UI shell | ACTIVE | BROWSER-VERIFIED |
| Gameplay mutation transport | ACTIVE | VERIFIED — one REST transport (`POST /v1/games/:sessionId/commands`) for both clients; realtime is subscription/invalidation only (RECOVERY-HARDEN-4) |
| Card/deck canonical registry (`CHAOS-133-V1`) | ACTIVE | Deck-composition tests green |
| Card art / board presentation | ACTIVE (provisional) | Final art deliberately deferred by product priority |
| Prompt library, prompt pool, saved prompts | UNMIGRATED | Routes reply `501` |
| Answers, recaps/history | UNMIGRATED | No persistence SQL in the API yet |
| Notifications | UNMIGRATED | Route replies `501` |
| Moderation | UNMIGRATED | Route replies `501`; no operator tables |
| Admin Control Room | UNMIGRATED | `docs/ADMIN_CONTROL_ROOM.md` |
| Browser Telegram OIDC login | UNMIGRATED | Fails closed (`503`/`501`) |
| `packages/legacy-runtime` board | COMPATIBILITY REFERENCE | Reachable only via the fixture-preview `legacy-compatibility` branch |
| `apps/web/src/canonical-game-runtime.ts` | UNKNOWN — PRESERVE | Zero importers and not part of the active authoritative runtime path; removal is not authorized until ownership, historical product purpose and migration/replacement status are proven |
| Old Bible / flyers / V4 template / old UI assets | COMPATIBILITY REFERENCE | Product-history evidence (`docs/HISTORICAL_PRODUCT_EVIDENCE.md`) |

## Current phase

**Recovery consolidation / authority hardening.** RECOVERY-HARDEN-1, RECOVERY-HARDEN-2 and RECOVERY-HARDEN-3/3B are implemented and published. Live clients consume authoritative server-projected gameplay capabilities. Persisted command-ID replay/collision semantics now have exhaustive semantic identity, global concurrency serialization and real PostgreSQL 16 CI coverage. RECOVERY-HARDEN-4 retires the stale realtime gameplay-command surface so gameplay mutation has exactly one REST transport and the action registry describes only genuinely realtime actions as socket actions. Whole-product scope remains preserved.

## CURRENT TASK

**None in flight after RECOVERY-HARDEN-4 documentation reconciliation.** The next implementation slice requires explicit owner authorization.

## Current blockers / hardening queue

- Gameplay transport metadata is reconciled (RECOVERY-HARDEN-4): one REST gameplay transport, realtime subscription/invalidation only. No open item remains here.
- Truth-or-Chaos can enter `groupPunishmentPending` without a proven completion path; instigator participation and refusal behavior remain unresolved owner decisions.
- Real Telegram Mini App runtime is not verified with genuine Telegram-generated `initData`.
- Whole-product verticals listed above remain UNMIGRATED and must be preserved.

## Next task / authorization state

**No implementation task is currently authorized after this slice.**

Owner-selectable hardening candidates are Truth-or-Chaos completion hardening (only after the missing owner rule decisions are resolved), the Roulette SVG presentation slice, migration of the unmigrated product verticals, or retirement of the preserved legacy/canonical client runtimes. The whole-product ownership/dependency audit remains mandatory before broad deletion/migration decisions.

**AUTHORITY-GUARD-1 remains unauthorized and not started.** Its precondition list still includes the unresolved Truth-or-Chaos owner decisions; the transport contradiction is reconciled by RECOVERY-HARDEN-4.

## Checks and evidence

RECOVERY-HARDEN-3/3B:

```text
initial RED contract commit
cbe8c6fd0fee710e2f0e892d201168798a8bde0b
  established persisted replay/collision expectations

initial GREEN implementation
67dbff10ee60e38957d0d969ee4a20669d74e0bf
  one shared fingerprint owner
  global persisted command lookup
  exact CI 35663953597 SUCCESS

second-review RED hardening
d24264e40e33bcfa2f8f66087301df460a449c3f
  CI 35667283036 FAILED as intended:
    ACTIVATE_GHOST semantic payload omission
    missing global UUID serialization
    no PostgreSQL CI service

final GREEN hardening
3fd53f7748f28ddc10883278ce1f1b57fdb60434
  exhaustive type-checked GameCommand semantic fingerprint
  pg_advisory_xact_lock(hashtextextended(commandId, 0)) before duplicate lookup
  PostgreSQL 16 CI service + canonical migrations + DB-backed tests

GitHub CI 35667385029 on 3fd53f77   SUCCESS
  typecheck       PASS
  test            PASS
  build-web       PASS
  build-telegram  PASS
  build-api       PASS

PostgreSQL 16 migration proof
  001_initial.sql                    applied
  002_dual_web_auth.sql              applied
  003_identity_link_challenges.sql   applied

test summary
  252 tests
  246 pass
  0 fail
  6 skipped

command-ID DB regressions explicitly PASS:
  cross-session UUID reuse -> controlled COMMAND_ID_COLLISION
  concurrent identical retry -> one transition / one command row
  concurrent cross-session UUID race -> one success / one controlled collision / one global row
```

Current GitHub CI now runs the normal suite against PostgreSQL 16 after canonical migrations, in addition to typecheck and all three builds. `npm run architecture:check` does not exist in this repository. No schema, migration, `Game_rules.md`, deployment or production mutation occurred in RECOVERY-HARDEN-3B.

RECOVERY-HARDEN-4 (gameplay mutation transport authority):

```text
RED contract commit
b5df94103455569a2dc12b1627aab0818d5e3bbf
  test(transport): require one REST gameplay mutation authority
  observed RED: 7 tests / 4 pass / 3 fail
    2 sendCommand definitions in packages/api-client (expected exactly 1)
    CribbitRealtimeClient still exposed the gameplay command sender
    registry transport contract could not load (missing canonical transport export)
  premise probe: 35 registry entries claimed method:'WS' (28 game-command, 5 dev-only, 2 realtime)

GREEN implementation commit
cb3126c96c58db68f9401304cc23cd2fde5911d4
  removed CribbitRealtimeClient.sendCommand - the only emit('game-command') in the repository, zero callers
  exported GAMEPLAY_COMMAND_TRANSPORT = 'POST /v1/games/:sessionId/commands'
  method:'WS' claims 35 -> 1 (only reconnect-now, backendClass realtime)
  gameplay command entries now declare method:'POST'

verification
  focused transport contract tests            11 / 11 PASS
  typecheck (tsconfig.check.json)             PASS
  full suite, local PostgreSQL 18.4           261 tests / 254 pass / 1 fail / 6 skipped
  lint, build:api, build:web, build:telegram, audit:ui   PASS
```

The single local full-suite failure is the pre-existing Windows CRLF source-shape assertion in `apps/web/test/runtime-single-owner.test.ts` (worktree `w/crlf` versus blob `i/lf`; the same assertion is green on Linux CI at `adc947cd`, run `35670806884`). The intermittent PostgreSQL-backed command-identity failure seen locally is pre-existing cross-test flakiness: it passes in isolation and had already failed remote CI runs before this slice. No schema, migration, `Game_rules.md`, deployment or production mutation occurred in RECOVERY-HARDEN-4.


## Known unknowns

- Real Telegram Mini App runtime behaviour (identity, viewport, back button, native lifecycle).
- Browser Telegram OIDC login behaviour (endpoints fail closed by design).
- Behaviour of unmigrated verticals: prompts, prompt pool, answers, recaps, notifications, moderation, control room.
- Which fixture-preview controls in `packages/legacy-runtime` still correspond to approved product intent (`UNKNOWN — PRESERVE`).
- Long-run multi-hour session behaviour (timers, reconnect, timeouts) is only partially exercised.

Historical/reference documents that previously carried stale "current branch", "current task", Phase 3.5 or PR #8 language are reconciled in this documentation rebaseline. Historical plans remain preserved as `COMPATIBILITY REFERENCE` evidence, but they are explicitly labeled historical and cannot compete with this ledger or the current roadmap in `PLAN.md`.

## Remote / publication state

Shared source state immediately before the RECOVERY-HARDEN-4 chain (`origin/recovery/single-engine-authority` was `adc947cd8d1f8fd3737396a39445485ceff46cf8`, CI run `35670806884` SUCCESS):

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a
origin/recovery/single-engine-authority       adc947cd8d1f8fd3737396a39445485ceff46cf8  (published tip before this chain)
RECOVERY-HARDEN-4 RED                         b5df94103455569a2dc12b1627aab0818d5e3bbf
RECOVERY-HARDEN-4 implementation              cb3126c96c58db68f9401304cc23cd2fde5911d4
RECOVERY-HARDEN-4 documentation               this commit (published tip of the branch)
```

The RECOVERY-HARDEN-4 chain advances only `recovery/single-engine-authority`. It does not merge, deploy, mutate `main`, change the CI anchor, modify gameplay rules, or alter production resources.

Current deployed production remains older than recovery source: Railway API is sourced from `main` and its latest successful deployment is commit `b48493dbd5eebf5a0bc82755c1e739117d8f713a`; the original Cloudflare Pages Web and Telegram projects still use `feature/visual-integration-checkpoint` as their production branch.

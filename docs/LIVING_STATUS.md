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

Published ancestry immediately before this reconciliation:

```text
e56936cb1d98344f87f3ca9ee6202cf018e58c27
-> 95e4d846d99ad55a6b7181c3b23ebf626a54109b   RECOVERY-HARDEN-1
-> 187d0c25b971d00f474a7ffea4ef8a230e7bf793   whole-project preservation rule
```

Exact GitHub CI: `95e4d846` -> run `35636741098` SUCCESS; `187d0c25` -> run `35640701568` SUCCESS. Local Windows worktree state must always be freshly verified before local mutation.

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

**Recovery consolidation / authority hardening.** RECOVERY-HARDEN-1 is accepted and published. Known authority contradictions must be reconciled before `AUTHORITY-GUARD-1`. Whole-product scope remains preserved while hardening proceeds.

## CURRENT TASK

**None in flight after this publication-state reconciliation.** The next implementation slice requires explicit owner authorization.

## Current blockers / hardening queue

- Live Web/Telegram clients still calculate gameplay legality/capabilities from game-engine helpers instead of receiving the complete authoritative capability projection from the server/API.
- Truth-or-Chaos can enter `groupPunishmentPending` without a proven completion path; instigator participation and refusal behavior remain unresolved owner decisions.
- Persistent command-ID replay/collision behavior is not fully aligned with engine collision semantics.
- Active gameplay mutation is REST, while stale realtime/action-registry metadata still describes socket `game-command` behavior.
- Real Telegram Mini App runtime is not verified with genuine Telegram-generated `initData`.
- Whole-product verticals listed above remain UNMIGRATED and must be preserved.

## Next task / authorization state

**No implementation task is currently authorized.**

Recommended candidate: **RECOVERY-HARDEN-2 — move Live legality/action-capability projection to the authoritative server/API boundary and remove Live client gameplay-decision authority.** This recommendation does not authorize implementation.

**AUTHORITY-GUARD-1 is deferred** until known authority contradictions are reconciled. The whole-product ownership/dependency audit remains mandatory before broad deletion/migration decisions. `PLAN.md` still contains earlier sequencing text naming Authority Guard next; that wording must not be interpreted as current authorization.

## Checks and evidence

RECOVERY-HARDEN-1 evidence:

```text
apps/api/test/live-room-concurrency.test.ts (DATABASE_URL set)   5/5 pass, 3 consecutive runs
  - RED before fix: 6 members in a playerCount=2 room; 5 ACTIVE sessions for one room
  - GREEN after fix: 2 members; exactly 1 ACTIVE session; 4x SESSION_ALREADY_CREATED
npm test (DATABASE_URL set)              243 tests, 237 passed, 6 skipped, 0 failed  (run twice)
npm test (no DATABASE_URL)               243 tests, 218 passed, 25 skipped, 0 failed
npm run typecheck                        exit 0
npm run lint                             exit 0
npm run audit:ui                         0 unclassified buttons, 0 duplicate ids, 0 inline handlers
npm run build:web / build:telegram / build:api   exit 0
git diff --check                         clean
GitHub CI 95e4d846                       run 35636741098 SUCCESS
```

Whole-project preservation-rule evidence:

```text
GitHub CI 187d0c25                       run 35640701568 SUCCESS
changed paths                            AGENTS.md, HANDOFF.md, docs/LIVING_STATUS.md only
```

Current GitHub CI runs typecheck, test, build-web, build-telegram and build-api. The real-PostgreSQL evidence above is separate local integration evidence and must not be attributed to GitHub CI.

`npm run architecture:check` does not exist in this repository (reported, not invented).

## Known unknowns

- Real Telegram Mini App runtime behaviour (identity, viewport, back button, native lifecycle).
- Browser Telegram OIDC login behaviour (endpoints fail closed by design).
- Behaviour of unmigrated verticals: prompts, prompt pool, answers, recaps, notifications, moderation, control room.
- Which fixture-preview controls in `packages/legacy-runtime` still correspond to approved product intent (`UNKNOWN — PRESERVE`).
- Long-run multi-hour session behaviour (timers, reconnect, timeouts) is only partially exercised.

Documentation conflicts deferred to a future authorized slice (they are NOT in the DOC-REBASELINE-1 document set, so this slice recorded rather than rewrote them):

- `docs/TELEGRAM_MOBILE_IMPLEMENTATION_PLAN.md` still declares a `## Current Next Task` (T6 real-device card recheck) and a `Phase 3.5 / Active branch feature/visual-integration-checkpoint / Active PR #8` status. That describes the pre-recovery visual-integration line, not the current recovery state.
- `chaosfixplan.md`, `docs/RECOVERY_SCOPE.md`, `docs/visual-integration-checkpoint.md`, `docs/DEPLOYMENT.md`, `docs/DEVELOPMENT.md`, `docs/ENVIRONMENT.md`, `docs/TELEGRAM.md`, `docs/browser-auth-handoff.md`, `docs/shared-auth-staging.md` and `REQUIREMENTS.md` contain phase/branch/"current" language from earlier lines of work. They are classified as `COMPATIBILITY REFERENCE` evidence in `docs/HISTORICAL_PRODUCT_EVIDENCE.md`.
- Until those are reconciled, the single current-state authority is this file plus the `PLAN.md` roadmap; ignore any other document's claim about the active branch, phase or next task.

## Remote / publication state

Shared state immediately before this reconciliation:

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/feature/visual-integration-checkpoint  95febd07e4d739c96843fcc4a02f070eb3c623c0   (deployed production source)
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a   (CI anchor)
origin/recovery/single-engine-authority       187d0c25b971d00f474a7ffea4ef8a230e7bf793   (published whole-project preservation rule)
```

RECOVERY-HARDEN-1 `95e4d846...` is already published and accepted. This reconciliation commit advances only the recovery branch documentation; it does not merge, deploy, mutate `main`, change the CI anchor, or modify production. Deployment targets remain Cloudflare Pages (Web, Telegram) and Railway (API, PostgreSQL). Production remains on the previous source until explicitly authorized.

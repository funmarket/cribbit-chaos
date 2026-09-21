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

## Verified local state

```text
repository   funmarket/cribbit-chaos
worktree     C:\Users\GrowB\cribbit-chaos-recovery
branch       recovery/single-engine-authority
HEAD         e56936cb1d98344f87f3ca9ee6202cf018e58c27   (published preservation baseline)
worktree     clean    (`git status --short` empty, `git diff --check` clean)
pushed       YES      (recovery/single-engine-authority published on origin for preservation)
deployed     NO
```

The RECOVERY-HARDEN-1 commit is the local commit after this published baseline; always re-verify the tip with `git rev-parse HEAD` instead of trusting this line. DOC-REBASELINE-1 (`2f23997`) and its preservation-classification correction (`e56936c`) are the last published commits.

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
| RECOVERY-HARDEN-1 — live room concurrency | local commit of this file | Room-row-lock serialization: a waiting room can never exceed `playerCount` and one room can never hold two ACTIVE sessions |

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

**Recovery consolidation.** Gameplay mechanics are converging on the shared engine; the documentation pack is being made self-sufficient so a future agent can resume from the repository alone. After this slice the authorized sequence is governance, then a whole-product ownership/dependency audit, then further owner-approved phases (`PLAN.md`).

## CURRENT TASK

**RECOVERY-HARDEN-1 — live room concurrency only.** Two correctness races found by review of the published recovery branch are repaired at the authoritative PostgreSQL boundary:

- **join capacity race** — `joinWaitingRoom()` read the member count, compared it with `playerCount` and then inserted, with no atomicity, so concurrent joins could exceed capacity. The capacity decision and the insert now run in one transaction that locks the room row (`select ... from rooms where ... for update`).
- **double Start race** — `startRoom()` checked the active session outside the transaction and re-checked it inside without locking, so two concurrent Start requests could both create a session. The Start transaction now takes the same room-row lock first, re-checks under it, and re-verifies membership before inserting; the losing request fails with `SESSION_ALREADY_CREATED`.

Both invariants are enforced by database-level serialization (room-row lock), so they hold with more than one Node process; no in-process mutex and no schema migration were needed, and no parallel room/session model was introduced. New real-PostgreSQL integration coverage lives in `apps/api/test/live-room-concurrency.test.ts` (skipped without `DATABASE_URL`, run against local PostgreSQL for this slice). One disclosed companion edit: `apps/api/test/web-login-suggestion.test.ts` counted ALL `users` rows before/after an operation, which is not deterministic while other DB-backed test files run in parallel; those counts are now scoped to the test's own identity with the same assertion intents.

## Current blocker

None for the documentation slice. Delivery-wide blockers and unverified areas:

- real Telegram Mini App runtime cannot be exercised here (no genuine `initData`) — server validation is proven with locally minted spec-correct signed data;
- the unmigrated product verticals above are the main functional gap between "a working card table" and the whole product;
- the Truth-or-Chaos flow can deadlock and local Simulation can stall on a special-card interaction (recorded observations, not authorized work).

## Next authorized task

**AUTHORITY-GUARD-1** — machine-enforced rule-ID / change-governance gate (direction recorded in `docs/CHANGE_GOVERNANCE.md`, not implemented). It must not be started until the owner authorizes it. This hardening slice does not authorize a push of its own commit.

## Checks and evidence

Last verified on the RECOVERY-HARDEN-1 candidate (local tip after the published baseline `e56936c`):

```text
apps/api/test/live-room-concurrency.test.ts (DATABASE_URL set)   5/5 pass, 3 consecutive runs
  - RED before the fix: 6 members in a playerCount=2 room; 5 ACTIVE sessions for one room
  - GREEN after the fix: 2 members; exactly 1 ACTIVE session; 4x SESSION_ALREADY_CREATED
npm test (DATABASE_URL set)              243 tests, 237 passed, 6 skipped, 0 failed  (run twice)
npm test (no DATABASE_URL)               243 tests, 218 passed, 25 skipped, 0 failed
npm run typecheck                        exit 0
npm run lint                             exit 0
npm run audit:ui                         0 unclassified buttons, 0 duplicate ids, 0 inline handlers
npm run build:web / build:telegram / build:api   exit 0
git diff --check                         clean
git ls-remote origin refs/heads/recovery/single-engine-authority   e56936c (published; local tip ahead by this slice)
```

`npm run architecture:check` does not exist in this repository (reported, not invented). Documentation-only slices additionally run the repository-provided rule/deck documentation checks: `packages/cards/test/game-rules-authority.test.ts` (canonical rule file SHA-256 + required rule IDs) and `packages/cards/test/deck-docs-consistency.test.ts`.

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

```text
origin/main                                   964a9162d7d9e1a12acfccc61f0fb88430a8f4ff
origin/feature/visual-integration-checkpoint  95febd07e4d739c96843fcc4a02f070eb3c623c0   (deployed production source)
origin/recovery/single-engine-authority-ci    f384c824a0553d1adceb05ef55612e177967bb1a   (CI anchor: 5/5 jobs green)
origin/recovery/single-engine-authority       e56936cb1d98344f87f3ca9ee6202cf018e58c27   (published for preservation; local tip ahead by the RECOVERY-HARDEN-1 commit, not pushed)
```

The only remote mutation from this line of work was the authorized non-force publication of `recovery/single-engine-authority` at `e56936c` (GitHub Actions run 35627085061: 5/5 jobs green). No merge, no deployment, no `main` mutation, no other ref changed, and the RECOVERY-HARDEN-1 commit is deliberately unpushed. Deployment targets remain Cloudflare Pages (Web, Telegram) and Railway (API, PostgreSQL). Production remains on the previous source until the owner authorizes publication.

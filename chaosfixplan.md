# Cribbit CHAOS Live Fix Plan

> **Purpose:** This is the live no-drift repair plan for the real app. It uses the forensic audit findings and Superpowers-style workflow gates so implementation does not drift, guess, or switch targets.

## 0. Absolute target boundary

**Only app/repo:** `https://github.com/funmarket/cribbit-chaos`

**Safe worktree for fixes:** `C:\Users\GrowB\cribbit-chaos-app`

**Protected local project:** `C:\Users\GrowB\Desktop\Cribbitchaos`

The protected local project is evidence/user work only. Do not edit it unless the user explicitly authorizes it.

**Cloudflare target:** `cribbit-chaos` only.

Do not use any other repo, scaffold, trunk, branch family, clean-room copy, or replacement project.

## 1. Verified current app state

Last verified in the safe clone:

```text
repo=https://github.com/funmarket/cribbit-chaos.git
branch=feature/visual-integration-checkpoint
head=77c455901516205633eb15e96f51a84206eb8174
PR=https://github.com/funmarket/cribbit-chaos/pull/8
PR state=open draft
base=main
```

Current product/deployment model from repo docs:

```text
Web client      -> Cloudflare Pages Web
Telegram client -> Cloudflare Pages Telegram
API             -> Railway API
Database        -> Railway PostgreSQL
```

Current source model from repo docs:

- Web is the temporary visual/mechanical baseline.
- Telegram must converge on the same shared game model.
- Server/shared game boundary must own authoritative multiplayer state.
- Clients render UI and submit commands; they must not own final card legality, effects, timers, prompt eligibility, or winner state.

## 2. Forensic audit findings that matter

### Finding A — main blocker: double/conflicting display and runtime ownership

The current Web app has more than one gameplay/display runtime path trying to own the same UI controls.

Verified source evidence in the safe clone:

```text
apps/web/index.html:13 imports initializeCanonicalGameRuntime from /src/canonical-game-runtime.ts
apps/web/src/main.ts:374 boots shared UI with runtimeMode: 'legacy-compatibility'
packages/ui/src/bootstrap.ts:89 dynamically imports legacy runtime for legacy-compatibility
apps/web/src/canonical-game-runtime.ts:252 installs a capture click handler and calls stopImmediatePropagation()
apps/web/src/live-session.ts:338,353,399 also call stopImmediatePropagation()
apps/telegram/src/main.ts:160,183,191 uses capture interception and legacy-compatibility
```

Why this breaks the app:

- `canonical-game-runtime.ts` is a browser gameplay/display runtime.
- `legacy-runtime` is another gameplay/display runtime.
- `live-session.ts` is another bridge/interceptor path.
- They can all intercept clicks or mutate display state.
- `stopImmediatePropagation()` means whichever handler wins can block the other.
- Result: buttons, Roulette, prompts, card flow, and board display can behave differently depending on load order/runtime ownership.

This is the first issue to fix. Until Web has one display/runtime owner, fixing card details, prompts, or Roulette presentation can create new regressions.

### Finding B — browser-local gameplay authority still exists

The audit found `canonical-game-runtime.ts` owns browser-local versions of session state, hands, deck, discard/exhausted cards, RNG, legality, effects, turns, winners, bots, timers, prompts, and family behavior.

Why this is dangerous:

- multiplayer truth can be produced in the browser;
- server/shared engine can disagree with the UI;
- regressions look like display bugs but are actually authority bugs;
- Web and Telegram can diverge.

Fix rule:

```text
Browser runtime may render and collect input only. It must not be the long-term gameplay authority.
```

### Finding C — high-risk runtime files bypass or weaken checks

Audit risk points:

- large runtime files use or used `@ts-nocheck` style escape hatches;
- browser runtime logic is too large and too stateful for an unchecked transitional path;
- global capture handlers hide errors by preventing normal event flow.

Fix rule:

```text
Do not add more unchecked runtime code. Every new rule/bridge must be typed and tested.
```

### Finding D — backend/API is not yet the complete gameplay owner

Audit/source evidence on main/default and migration slices showed many API routes returning `*_NOT_MIGRATED` or `ENGINE_NOT_MIGRATED`.

In the current feature branch, this must be re-verified before changing API behavior.

Known risk:

- claiming “server authoritative” is false if Web still resolves gameplay locally;
- claiming “playable production backend” is false if command wiring is incomplete;
- frontend fixes must not fake backend readiness.

Fix rule:

```text
Gameplay API routes must either be real and tested, or fail closed honestly. No fake success path.
```

### Finding E — card/deck/rule source drift

The project docs mention active deck-rule transitions and multiple deck/card counts across living files and historical states.

Observed from current docs:

- `PLAN.md` says canonical physical deck `CHAOS-133-V1` has 133 physical playable card instances.
- `README.md` previously described an obsolete smaller production target; Slice 8 replaced it with `CHAOS-133-V1` / 133 playable physical card instances.
- `docs/LIVING_STATUS.md` says `CHAOS-133-V1 = 133 playable physical card instances`.

Why this matters:

- conflicting deck authority can cause wrong hand inventory, wrong card art, wrong tests, and Web/Telegram divergence;
- this must be reconciled during the deck/rule slice, not hidden.

Fix rule:

```text
Before card/deck fixes, choose and document one canonical current deck state with source evidence.
```

### Finding F — deployment/readback is not proof of gameplay correctness

Cloudflare/Railway status must be read back when deployment is part of a claim.

Known audit concern:

- dashboard objects or builds existing do not prove the app is playable;
- zero traffic/no bindings/no route/no env/no observability states are blockers or non-proof;
- build success is not runtime gameplay proof.

Fix rule:

```text
Every deploy-related claim needs live readback and a smoke test against the actual target.
```

## 3. Main repair strategy

Do **not** rebuild the app elsewhere.

Fix the real app in place through controlled slices:

1. Stop Web double-runtime/display conflict.
2. Preserve V4 visual baseline while making one runtime owner explicit.
3. Move gameplay authority toward shared/server-owned code without faking missing backend pieces.
4. Reconcile card/deck authority after runtime ownership is stable.
5. Verify Web first, then ensure Telegram uses the same shared model.
6. Only then claim deployment/runtime readiness.

## 4. Superpowers/no-drift gates

### Gate 1 — literal target control

Use `literal-command-executor` discipline:

- one target repo;
- one current branch;
- one mutation at a time;
- fresh status before each mutation;
- stop on dirty unexpected state;
- no inferred permission.

### Gate 2 — systematic debugging

Use `systematic-debugging` before every fix:

1. Read source/error completely.
2. Reproduce or prove the defect from source/runtime evidence.
3. Trace the failing flow.
4. State one root-cause hypothesis.
5. Test the hypothesis before patching.

### Gate 3 — TDD for behavior changes

Use `test-driven-development`:

1. Add/extend a failing regression test.
2. Observe RED for the expected reason.
3. Patch minimally.
4. Observe GREEN.
5. Run broader checks.

### Gate 4 — review before commit

Use `requesting-code-review`:

- inspect diff;
- scan for secrets/dangerous code;
- run targeted and broad checks;
- independent review for spec/quality;
- fix only blocking findings.

### Gate 5 — subagent use only where bounded

Use `subagent-driven-development` only for bounded review or isolated implementation tasks after the slice is fixed. Do not let subagents choose a new target or broaden scope.

## 5. Step-by-step fix plan

## Phase 1 — lock baseline and reproduce double-runtime conflict

**Objective:** Prove exactly how the Web app currently boots competing display/gameplay runtimes.

**Files to read:**

- `apps/web/index.html`
- `apps/web/src/main.ts`
- `apps/web/src/canonical-game-runtime.ts`
- `apps/web/src/live-entry.ts`
- `apps/web/src/live-session.ts`
- `packages/ui/src/bootstrap.ts`
- `packages/legacy-runtime/src/runtime.ts`
- `apps/telegram/src/main.ts`
- current Web/runtime tests

**Commands:**

```sh
cd C:/Users/GrowB/cribbit-chaos-app
git status --short --branch
git rev-parse HEAD
rg "canonical-game-runtime|initializeCanonicalGameRuntime|legacy-compatibility|runtimeMode|stopImmediatePropagation|document\.addEventListener|live-session" apps packages tests
npm run typecheck
npm run test
npm run build:web
npm run audit:ui
```

**Runtime check:**

```sh
npm run dev:web -- --host 127.0.0.1 --port 37140
```

Use browser verification to inspect whether both runtimes register and fight for controls.

**Exit criteria:**

- written root-cause statement with file/line evidence;
- chosen regression test target;
- no source edits yet.

## Phase 2 — add single-owner regression test

**Objective:** Create a test that fails while the Web app has competing gameplay/display owners.

**Likely test shape:**

A source-level Web architecture test that asserts:

```text
The production Web shell must not boot more than one independent gameplay runtime owner.
```

Possible test assertions:

- `apps/web/index.html` must not import `canonical-game-runtime.ts` while `apps/web/src/main.ts` boots `legacy-compatibility`.
- only one of these is allowed as active owner:
  - canonical runtime bootstrap;
  - legacy runtime bootstrap;
  - live-session bridge owner.
- capture-phase `stopImmediatePropagation()` handlers must not exist in multiple active Web gameplay owner paths.

**RED condition:** test fails on current HEAD for the known duplicate-runtime source.

**Exit criteria:**

- failing regression test observed;
- failure reason matches audit finding, not a typo.

## Phase 3 — fix Web double display/runtime owner

**Objective:** Make Web have one active gameplay/display owner without redesigning UI.

**Decision must be evidence-based from Phase 1.** Do not guess.

Possible narrow fixes:

### Option 3A — remove canonical runtime bootstrap from Web shell

Use this if shared UI + legacy/live-session path is the actual current accepted owner.

Likely edit:

- `apps/web/index.html`

Expected effect:

- no second inline canonical runtime bootstrap;
- shared UI remains entrypoint;
- V4 visuals preserved through existing path.

### Option 3B — disable legacy compatibility from Web main

Use this if `canonical-game-runtime.ts` is the accepted temporary owner and shared UI should not also load legacy runtime.

Likely edit:

- `apps/web/src/main.ts`
- possibly `packages/ui/src/bootstrap.ts` call options

Expected effect:

- no dynamic import of `legacy-runtime` for Web gameplay;
- one canonical owner remains.

### Option 3C — explicit runtime-owner guard

Use only if both source paths must remain present temporarily but only one may activate.

Likely edit:

- `apps/web/src/main.ts`
- `apps/web/src/canonical-game-runtime.ts`
- possibly `apps/web/index.html`

Expected effect:

- one owner is selected deterministically;
- inactive owner cannot register capture click handlers or mutate gameplay display.

**Exit criteria:**

- regression test passes;
- Web build passes;
- browser smoke shows one owner handles relevant controls.

## Phase 4 — verify Roulette/prompt regression path

**Objective:** Confirm the main visible symptom of runtime conflict is fixed.

Audit symptom:

- Roulette could disappear/bypass wheel presentation because canonical runtime selected prompt and jumped to preview while older/display path was blocked by capture handlers.

**Manual/browser checks:**

- start Web flow;
- reach Truth/Dare or other Roulette prompt flow;
- choose Roulette;
- verify wheel/presentation path is not bypassed by another runtime owner;
- verify selected prompt survives spin;
- verify Continue/resolution path still works or fails only on a documented backend blocker.

**Exit criteria:**

- runtime owner conflict no longer reproduced;
- no new visual regression in the checked flow.

## Phase 5 — remove or quarantine stale runtime debt

**Objective:** After single owner is verified, remove stale/conflicting resources only when safe.

Candidates to classify, not blindly delete:

- `apps/web/src/canonical-game-runtime.ts`
- `packages/legacy-runtime/src/runtime.ts`
- `apps/web/src/live-entry.ts`
- `apps/web/src/live-session.ts`
- capture listeners in Web/Telegram

Each file/function must be classified:

```text
ACTIVE OWNER / RENDER-ONLY / REFERENCE ONLY / DEAD / BLOCKED FROM REMOVAL
```

**Exit criteria:**

- stale active conflict removed;
- required transitional files documented;
- no uncertain deletion.

## Phase 6 — reconcile live docs for runtime ownership

**Objective:** Make docs match verified reality after the fix.

Update only affected docs:

- `PLAN.md`
- `docs/LIVING_STATUS.md`
- possibly `README.md`
- possibly `docs/ARCHITECTURE.md`

Docs must say:

- what runtime owner Web currently uses;
- what was removed/disabled;
- what remains transitional debt;
- what checks/browser evidence passed;
- what is still not production-ready.

**Do not claim:**

- full multiplayer production readiness;
- backend gameplay completion;
- Telegram final parity;
- deployment readiness without live readback.

## Phase 7 — backend command boundary slice

Start only after Phase 1–6 are complete.

**Objective:** Replace fake/client gameplay authority with tested server/shared command path incrementally.

Audit problem:

- API routes have `ENGINE_NOT_MIGRATED` / `*_NOT_MIGRATED` blockers;
- Web runtime can still own results locally.

Step plan:

1. Read `apps/api/src/index.ts`, `packages/contracts`, `packages/game-engine` tests.
2. Choose one narrow command path already supported by shared engine.
3. Add API/service regression test first.
4. Wire route to shared engine or keep fail-closed if prerequisites missing.
5. Verify database/session boundary if persistence is involved.
6. Browser smoke that client submits command instead of resolving locally.

Exit criteria:

- one command path is truly server/shared-owned;
- unsupported commands still fail closed honestly.

## Phase 8 — canonical deck/rule reconciliation slice

Start only after runtime owner is stable.

**Objective:** Resolve deck/card authority conflicts.

Resolved conflict from Slice 8:

```text
PLAN.md / docs/LIVING_STATUS.md: CHAOS-133-V1 = 133 physical cards
README.md: previously named an obsolete smaller playable-card target; Slice 8 replaced this with `CHAOS-133-V1` / 133 playable physical card instances and added a docs consistency guard.
```

Step plan:

1. Read current canonical card assets/manifests/tests.
2. Decide current canonical deck state from source evidence.
3. Add/repair tests for exact physical card count and family count.
4. Update docs to one current truth.
5. Remove duplicate/stale deck definitions only after reference checks.

Exit criteria:

- one canonical deck definition;
- Web and Telegram cannot define different decks;
- docs agree.

## Phase 9 — Telegram convergence slice

Start only after Web runtime/deck authority is stable.

**Objective:** Telegram consumes same canonical game model and does not own a separate runtime.

Known audit risk:

- Telegram has capture interceptors and `legacy-compatibility` bootstrap.

Step plan:

1. Read `apps/telegram/src/main.ts` and shared UI/platform boundary.
2. Add test that Telegram cannot own separate deck/rule/gameplay runtime.
3. Patch only shared/platform boundary needed for parity.
4. Verify Telegram build and Mini App smoke where possible.

Exit criteria:

- Telegram is render/input-only for shared model;
- no separate Telegram gameplay authority.

## Phase 10 — deployment/readback slice

Start only after source behavior is verified locally.

**Objective:** Verify actual app surfaces, not just builds.

Targets:

- Cloudflare Pages Web
- Cloudflare Pages Telegram
- Railway API
- Railway PostgreSQL
- Cloudflare Worker/Page surfaces named `cribbit-chaos` only when relevant

Step plan:

1. Read deployment docs and current dashboard/API state.
2. Verify build source and exact commit.
3. Verify env vars exist by presence only; never print secrets.
4. Deploy only through repo-controlled path.
5. Smoke live endpoints.
6. Update living docs.

Exit criteria:

- exact deployed commit known;
- live URL smoke checks passed;
- no dashboard-only source of truth.

## 6. Active next action

Run Phase 1 only.

Do not edit production source until:

- current runtime conflict is reproduced or disproven;
- root cause is stated with file/line evidence;
- regression test target is selected.

## 6A. Live update and scoring rule

After every fix slice, update this file with:

- exact branch and commit/head;
- files changed;
- proof commands and outputs;
- browser/runtime proof where UI behavior is involved;
- known remaining gaps;
- fix score from 1 to 10.

Scoring threshold:

```text
If score < 8.5, the fix is not acceptable. Re-open inspection, find the gap, and revise before moving to the next slice.
```

Score meanings:

- `10`: source, tests, browser/runtime proof, docs, and PR/CI/readback all align.
- `8.5-9.5`: fix is acceptable for the slice with explicitly documented non-blocking gaps.
- `<8.5`: revisit required.

## 6B. Live proof ledger

### Slice 1 — Phase 1 baseline/reproduction evidence

- Status: baseline inspected; runtime conflict reproduced from source evidence; implementation not started yet.
- Safe worktree: `C:\Users\GrowB\cribbit-chaos-app`.
- Branch at evidence capture: `feature/visual-integration-checkpoint` -> working branch created as `fix/web-runtime-single-owner`.
- Verified target remote: `https://github.com/funmarket/cribbit-chaos.git`.
- Verified head: `77c455901516205633eb15e96f51a84206eb8174`.
- PR under repair: `https://github.com/funmarket/cribbit-chaos/pull/8`.

Evidence commands run:

```sh
git remote get-url origin
git status --short --branch
git rev-parse HEAD
gh pr view 8 --repo funmarket/cribbit-chaos --json number,title,state,isDraft,headRefName,baseRefName,headRefOid,url
rg -n "canonical-game-runtime|initializeCanonicalGameRuntime|legacy-compatibility|runtimeMode|stopImmediatePropagation|document\.addEventListener|live-session" apps packages PLAN.md docs/LIVING_STATUS.md
npm run typecheck
npm run test
npm run build:web
npm run audit:ui
node -v
npm -v
```

Proof results:

- `npm run typecheck`: passed.
- `npm run build:web`: passed.
- `npm run audit:ui`: passed with `actionsDiscovered: 64`, `actionsAssigned: 66`, `missingAssignments: []`, `unclassifiedButtons: 0`, `inlineHandlers: 0`.
- `npm run test`: 111 pass / 1 fail. Failure is environment/toolchain blocker: `apps/api/test/web-password.test.ts` requires Node.js 24.7.0+ built-in Argon2id, but active `node -v` is `v22.23.2`. This is not caused by runtime-owner changes because no product source was edited before the run.
- Runtime conflict source evidence:
  - `apps/web/index.html:13-14` imports and initializes `canonical-game-runtime.ts`.
  - `apps/web/src/main.ts:373-375` boots shared UI with `runtimeMode: 'legacy-compatibility'`.
  - `packages/ui/src/bootstrap.ts:89-90` imports `packages/legacy-runtime/src/runtime.ts` for legacy compatibility.
  - `apps/web/src/canonical-game-runtime.ts:252,254` installs a capture click handler and uses `stopImmediatePropagation()`.
  - `apps/web/src/live-session.ts:331-394` installs another capture click handler and uses `stopImmediatePropagation()`.

Root-cause statement:

```text
The Web shell boots at least two independent gameplay/display owners at page load: canonical-game-runtime directly from index.html, and legacy-runtime through main.ts -> bootstrap(runtimeMode: legacy-compatibility). A third live-session bridge can also register capture handlers. Because these owners use capture-phase handlers and stopImmediatePropagation(), UI/gameplay behavior can depend on registration order rather than one explicit authority.
```

Phase 1 score: `8.7/10`.

Reason for score: source-level reproduction and baseline checks are strong; full `npm run test` is blocked by local Node 22 instead of required Node 24.7+, so Phase 1 is acceptable but the environment blocker must remain visible until checks run under Node 24+.

### Slice 2 — Phase 2 RED regression test

- Status: regression test added and observed failing before production fix.
- Test file: `apps/web/test/runtime-single-owner.test.ts`.
- Test command:

```sh
npx tsx --test apps/web/test/runtime-single-owner.test.ts
```

RED proof:

- `Web shell boots only one gameplay/display runtime owner`: failed because `apps/web/index.html` boots `canonical-game-runtime` while `apps/web/src/main.ts` boots `legacy-compatibility`.
- `Web production shell does not register competing capture click owners`: failed because active canonical runtime and live-session both register capture click handlers.
- Result: `0 pass / 2 fail`, expected RED.

Phase 2 score: `9.0/10`.

Reason for score: regression directly encodes the audit finding and fails for the expected reason. Browser runtime proof is still pending for the implementation slice.

### Slice 3 — Phase 3 GREEN single runtime/display owner fix

- Status: minimal fix implemented in safe clone; independent review pending.
- Production source changed: `apps/web/index.html`.
- Regression source changed: `apps/web/test/runtime-single-owner.test.ts`.
- Test runner source changed: `package.json` now includes the new regression in `npm run test`.

Implemented fix:

- Removed the direct Web shell bootstrap of `canonical-game-runtime.ts` from `apps/web/index.html`.
- Kept `apps/web/src/main.ts` as the single Web app entrypoint.
- Left room deep-link, live entry, and safety rail scripts intact.
- Did not touch the protected local project at `C:\Users\GrowB\Desktop\Cribbitchaos`.
- Did not touch Cloudflare dashboard/settings.

GREEN proof commands/results:

```sh
npx tsx --test apps/web/test/runtime-single-owner.test.ts
```

Result: `2 pass / 0 fail`.

```sh
npm run typecheck
```

Result: passed.

```sh
npm run build:web
```

Result: passed; Vite built 212 modules.

```sh
npm run audit:ui
```

Result: passed with `actionsDiscovered: 64`, `actionsAssigned: 66`, `missingAssignments: []`, `unclassifiedButtons: 0`, `inlineHandlers: 0`.

```sh
npm run test
```

Result: `113 pass / 1 fail`. The failing test is still the environment/toolchain blocker: `apps/api/test/web-password.test.ts` requires Node.js 24.7.0+ built-in Argon2id. The new runtime-owner regression passed inside the full suite as tests 30 and 31.

Runtime readback proof:

```sh
curl -sS http://127.0.0.1:37134/
```

Result: served Web HTML contains `/src/main.ts`, `/src/live-entry.ts`, and `/src/web-safety-rail.ts`, and reports `False False` for `canonical-game-runtime` and `initializeCanonicalGameRuntime`.

```sh
rg "canonical-game-runtime|initializeCanonicalGameRuntime" apps/web/dist
```

Result: zero matches in built Web dist.

Diff/scope proof:

```sh
git diff --check
git diff --stat
```

Result: no whitespace errors; production source diff is limited to removing the four-line canonical runtime bootstrap from `apps/web/index.html`, plus the new regression test and package test registration.

Phase 3 score: `8.8/10`.

Reason for score: the exact conflict is removed, focused regression is green, typecheck/build/UI audit are green, and runtime HTML/build readback prove the direct canonical runtime is no longer booted. Score is not higher because full `npm run test` still has the unrelated Node/Argon2id environment failure, and desktop browser preview did not provide reliable interactive proof.

### Slice 4 — Phase 4 Roulette/prompt/display verification

- Status: verified as far as current local tooling allows; browser automation/desktop preview could not provide reliable interactive proof in this session.

Verification proof:

```sh
npx tsx --test packages/game-engine/test/core-engine.test.ts --test-name-pattern "roulette presentation metadata|explicit selected prompts"
```

Result: `57 pass / 0 fail`. This run includes:

- `roulette presentation metadata is authoritative, deterministic, and selected before presentation` — passed.
- `explicit selected prompts use the full eligible pool for authoritative roulette candidates` — passed.
- supporting social/prompt flow tests in the same file — passed.

Runtime/display conflict proof reused for this gate:

- local Vite-served HTML no longer contains `canonical-game-runtime` or `initializeCanonicalGameRuntime`;
- built Web dist has zero matches for `canonical-game-runtime` or `initializeCanonicalGameRuntime`;
- new single-owner regression passes in focused and full-suite runs.

Phase 4 score: `8.6/10`.

Reason for score: Roulette/prompt authority tests pass and the conflicting browser owner is removed from served and built Web output. Score is limited because desktop/browser interactive verification was blocked by tool instability, so this is source/runtime-readback plus automated test proof, not a full visual click-through.

### Slice 5 — Phase 5 runtime debt classification

- Status: classified; no deletion performed.
- Evidence commands/files:
  - searched `canonical-game-runtime|initializeCanonicalGameRuntime|legacy-compatibility|live-entry|live-session|stopImmediatePropagation` across repo;
  - read `apps/web/src/live-entry.ts`;
  - read `apps/web/src/main.ts:364-384`;
  - read `packages/ui/src/bootstrap.ts:89-91`;
  - read `apps/web/src/live-session.ts:331-410`.

Classification:

| Target | Classification | Evidence | Action now |
| --- | --- | --- | --- |
| `apps/web/src/canonical-game-runtime.ts` | `REFERENCE ONLY / DEAD FOR WEB BOOT` | `apps/web/index.html` no longer imports it; served Cloudflare Pages Web HTML and built Web dist do not contain `canonical-game-runtime` or `initializeCanonicalGameRuntime`. File still contains the old browser runtime and capture owner, so deleting it needs a separate stale-file deletion gate. | Do not boot; do not delete in this slice. |
| `packages/legacy-runtime/src/runtime.ts` | `ACTIVE TRANSITIONAL OWNER` | `apps/web/src/main.ts:373-375` calls `bootstrap(... runtimeMode: 'legacy-compatibility')`; `packages/ui/src/bootstrap.ts:89-91` imports legacy runtime for that mode. | Keep for now; it is the current Web display/runtime bridge after direct canonical bootstrap removal. |
| `apps/web/src/live-entry.ts` | `ACTIVE BRIDGE` | imports `startWebAuthUI` and `startWebLiveRooms`; waits for `window.__CRIBBIT_API__`, `#app`, and `#joinCode`; starts auth/live rooms once. | Keep. |
| `apps/web/src/live-session.ts` | `ACTIVE COMMAND BRIDGE` | capture handler sends API/realtime commands for create/join/play/draw/prompt actions and unsubscribes on teardown. It still uses capture and `stopImmediatePropagation()`, but after canonical bootstrap removal it no longer competes with the direct canonical runtime owner. | Keep; later backend-authority slice must continue reducing client authority. |
| Web capture listeners | `ACTIVE BUT SINGLE CURRENT OWNER PATH` | canonical capture owner is no longer booted; live-session capture remains active for command submission. | Keep and monitor with regression. |
| Telegram capture listeners | `BLOCKED FROM THIS WEB SLICE` | `apps/telegram/src/main.ts` still has capture interception and `legacy-compatibility`; Phase 9 covers Telegram convergence. | Do not edit in this slice. |

Phase 5 score: `8.8/10`.

Reason for score: every candidate in Phase 5 has a concrete classification and no uncertain deletion was made. Score is not higher because stale file deletion and Telegram convergence are intentionally deferred to later authorized slices.

### Slice 6 — Phase 6 live docs reconciliation

- Status: implemented in source docs; CI/readback pending after commit.
- Docs updated:
  - `README.md`
  - `PLAN.md`
  - `docs/LIVING_STATUS.md`
  - `chaosfixplan.md`

Changes made:

- `README.md` now keeps the deployment section focused on Cloudflare Pages and Railway only.
- `PLAN.md` now records that PR #9 removes the extra direct `canonical-game-runtime.ts` bootstrap from `apps/web/index.html` and classifies the current runtime files.
- `docs/LIVING_STATUS.md` now records the same one-boot-path state and runtime classification.
- Removed non-Cloudflare provider mentions from the active live plan and affected current-status docs touched by this slice.

Verification:

```sh
rg "non-Cloudflare provider marker" README.md PLAN.md docs/LIVING_STATUS.md chaosfixplan.md
```

Result: no disallowed provider references remain in the affected current-status docs.

```sh
npx tsx --test apps/web/test/runtime-single-owner.test.ts
```

Result: `2 pass / 0 fail`.

Phase 6 score: `8.8/10`.

Reason for score: live project-control docs now match the verified runtime ownership and Cloudflare-only direction for this repair path. Score is not higher because full exact-head CI and PR readback must be refreshed after this doc commit.

### Slice 7 — Phase 7 API command-boundary fail-closed proof

- Status: implemented as focused API boundary coverage; no production gameplay command behavior changed in this slice.
- Files updated:
  - `apps/api/test/game-command-boundary.test.ts`
  - `package.json`
  - `chaosfixplan.md`

Source inspection:

- `apps/api/src/app.ts:398-408` owns `POST /v1/games/:sessionId/commands` and authenticates before calling the game service.
- `apps/api/src/game-service.ts:413-427` rejects route/session mismatch and authenticated-player mismatch before applying `applyCommand` or loading mutable game state.
- `apps/api/src/game-service.ts:427-456` applies shared engine commands, persists resulting state/events, and records command results inside the service transaction when the command boundary is valid.

Regression coverage added:

- unauthenticated game commands fail closed with `AUTH_REQUIRED`;
- commands whose body `sessionId` does not match the route fail closed with `SESSION_MISMATCH` before DB mutation;
- commands whose `playerId` does not match the authenticated user fail closed with `PLAYER_MISMATCH` before DB mutation.

Verification executed immediately after this edit:

```sh
npx tsx --test apps/api/test/game-command-boundary.test.ts
```

Result: `3 pass / 0 fail`.

```sh
npx tsx --test apps/web/test/runtime-single-owner.test.ts
```

Result: `2 pass / 0 fail`.

```sh
npm run typecheck
git diff --check
```

Result: exit `0`.

Phase 7 score: `8.7/10`.

Reason for score: this slice proves the route/auth/session/player boundary fails closed before command mutation and registers the coverage in the repo test script. Score is not higher because it intentionally does not claim the full gameplay API is production-authoritative end-to-end; DB-backed valid-command runtime smoke remains a separate later slice.

### Slice 8 — Phase 8 canonical deck/rule reconciliation

- Status: implemented as a documentation/source-truth reconciliation and regression guard; no card runtime behavior changed in this slice.
- Files updated:
  - `README.md`
  - `packages/cards/test/deck-docs-consistency.test.ts`
  - `package.json`
  - `chaosfixplan.md`

Source evidence:

- `packages/cards/src/cards.ts` exports `DECK_SPEC_ID = "CHAOS-133-V1"` and `CANONICAL_DECK_SIZE = 133`.
- `packages/game-engine/src/deck.ts` imports the cards registry and exports the same deck spec/count into the engine boundary.
- `packages/cards/test/card-registry.test.ts` verifies the registry exposes 133 unique physical card instances and exact family counts.
- `packages/cards/test/card-assets.test.ts` verifies the asset manifest is bound to `CHAOS-133-V1` and has 133 playable entries.
- `packages/game-engine/test/deck-composition.test.ts` verifies `buildCoreDeck()` is exactly `CHAOS-133-V1` with 133 cards and matching family counts.

Regression coverage added:

- `packages/cards/test/deck-docs-consistency.test.ts` guards project-control docs against preserving obsolete deck-count authority.
- RED was observed before the README patch: the new test failed because `README.md` still named obsolete smaller-deck authority.

Verification after the README patch:

```sh
npx tsx --test packages/cards/test/deck-docs-consistency.test.ts
npx tsx --test packages/cards/test/card-registry.test.ts packages/cards/test/card-assets.test.ts packages/game-engine/test/deck-composition.test.ts
npm run typecheck
git diff --check
```

Result: focused Phase 8 verification passed.

- `packages/cards/test/deck-docs-consistency.test.ts`: `1 pass / 0 fail`.
- `packages/cards/test/card-registry.test.ts`, `packages/cards/test/card-assets.test.ts`, `packages/game-engine/test/deck-composition.test.ts`: `10 pass / 0 fail`.
- `npm run typecheck`: pass.
- `git diff --check`: pass.

Full local `npm run test` result after adding the docs consistency test: `117 pass / 1 fail`; the remaining local failure is the known `apps/api/test/web-password.test.ts` Node.js Argon2id runtime blocker, not introduced by Phase 8.

Phase 8 score: `8.9/10`.

Reason for score: the active project-control README now matches the canonical card registry, asset manifest, and game-engine deck tests, and a regression test prevents reintroducing obsolete 112/104-card authority into the living docs. Score is not higher because legacy client-local deck seams remain to be removed in later runtime convergence slices.

### Independent review — Phase 3/4

- Status: passed.
- Reviewer verdict: no security concerns, no logic errors, no scope drift.
- Reviewer summary: the diff is focused on removing the direct Web canonical runtime bootstrap, registering a regression test, and recording evidence.
- Reviewer suggestion carried forward: add a later browser/runtime smoke test for Roulette/prompt flow before claiming full visual interaction is fixed end-to-end.
- Known blocker remains: full `npm run test` still has the unrelated local Node/Argon2id failure requiring Node.js 24.7.0+.

Stop and report if any of these happen:

- target repo is not `funmarket/cribbit-chaos`;
- worktree is not `C:\Users\GrowB\cribbit-chaos-app`;
- unexpected dirty files appear;
- branch/head changes unexpectedly;
- evidence contradicts the audit;
- fix requires dashboard mutation;
- fix requires protected local project edits;
- three attempted fixes fail;
- docs/source/runtime disagree and the current slice does not authorize resolving that disagreement.

## 8. PR / CI / Cloudflare ledger

### PR #9 — Web runtime single owner

- URL: `https://github.com/funmarket/cribbit-chaos/pull/9`
- Branch: `fix/web-runtime-single-owner`
- Base: `feature/visual-integration-checkpoint`
- Phase 8 deck-authority commit: `eaf21b0be0aa9deb1e1cc960f03aa2c6b7bea72f`.
- Ready for review: yes, marked ready after exact-head source checks passed.

GitHub source checks at exact-head readback for Phase 8 review-fix commit `52f600105739ea343c5b6110b72450ef8f0a1fe3`:

- `build-api`: pass.
- `build-web`: pass.
- `build-telegram`: pass.
- `test`: pass.
- `typecheck`: pass.
Deployment-status correction:

- User corrected that the app is in Cloudflare.
- Primary frontend hosts are Cloudflare Pages:
  - Web: `https://cribbit-chaos-web.pages.dev`
  - Telegram Mini App: `https://cribbit-chaos-telegram.pages.dev`
  - API: Railway
- Non-Cloudflare deployment checks are outside this repair path and must not be chased for Cribbit unless the user explicitly requests that separate cleanup.

Cloudflare readback:

```sh
curl -L -sS -o "$LOCALAPPDATA/Temp/cf_probe.tmp" -w '%{http_code} %{url_effective}\n' https://cribbit-chaos-web.pages.dev
curl -L -sS -o "$LOCALAPPDATA/Temp/cf_probe.tmp" -w '%{http_code} %{url_effective}\n' https://cribbit-chaos-telegram.pages.dev
curl -L -sS -o "$LOCALAPPDATA/Temp/cf_probe.tmp" -w '%{http_code} %{url_effective}\n' https://cribbit-chaos.bashahookahwholesale.workers.dev
```

Result:

- `https://cribbit-chaos-web.pages.dev` -> `200`.
- `https://cribbit-chaos-telegram.pages.dev` -> `200`.
- `https://cribbit-chaos.bashahookahwholesale.workers.dev` -> `404`.

Cloudflare dashboard readback for Worker `cribbit-chaos`:

- No URLs enabled.
- `workers.dev` disabled.
- No custom domains/routes.
- Invocations: `0`.
- CPU time: `0 ms`.
- Errors: `0`.
- Bindings: `0`.
- Workers Logs/Traces: disabled.
- Versions are manual dashboard uploads.

Live Cloudflare Pages HTML probe:

```text
https://cribbit-chaos-web.pages.dev
canonical-game-runtime: False
initializeCanonicalGameRuntime: False

https://cribbit-chaos-telegram.pages.dev
canonical-game-runtime: False
initializeCanonicalGameRuntime: False
```

Current interpretation:

- Source/build/test proof for PR #9 is good.
- Current public Cloudflare Pages endpoints respond `200` and do not expose the old `canonical-game-runtime` bootstrap in top-level HTML.
- The Cloudflare Worker URL provided by the user is present in dashboard but currently has no enabled route/URL and returns `404`; it is not serving the app from that workers.dev URL right now.
- No Cloudflare dashboard settings were mutated.
- Do not chase non-Cloudflare deployment providers in this repair flow unless the user explicitly asks for separate cleanup.

### PR #8 — integration checkpoint cleanup

PR #8 remains the integration PR from `feature/visual-integration-checkpoint` into `main`; it now includes merged PR #9 through merge commit `002df9bea60510c2785685b04b561eadf2380093`.

Cleanup slice started after user asked to resume work on PR #8:

- removed obsolete frontend-provider config files from `apps/web` and `apps/telegram`;
- removed stale non-Cloudflare-provider references from living project-control docs;
- kept current hosting authority as GitHub source -> Cloudflare Pages clients -> Railway API -> Railway PostgreSQL;
- did not change gameplay rules, backend contracts, Cloudflare dashboard settings, Railway settings, or the protected local project.

Proof commands:

```sh
python -m json.tool docs/cleanup-manifest.json >/dev/null
npx tsx --test packages/cards/test/deck-docs-consistency.test.ts
npm run typecheck
git diff --check
```

Proof:

- JSON cleanup manifest parses.
- `packages/cards/test/deck-docs-consistency.test.ts`: `1 pass / 0 fail`.
- `npm run typecheck`: pass.
- `git diff --check`: pass.
- Visible tracked-source search for obsolete provider names: zero matches.

Score: `8.9/10`.

Reason for score: PR #8 now has a cleaner source/control-document path toward the real Cloudflare/Railway app and removes stale provider config from the branch, with docs consistency and typecheck passing locally. Score is not higher until PR #8 body is updated, exact-head CI passes, and final PR readback confirms the remaining blockers.

### Post-merge drift correction — PR #8 / fix-plan realignment

After PR #8 was squash-merged into `main`, the living plan still pointed at the removed **Try CHAOS Pulse** panel as the current next task. Fresh source inspection showed:

- current branch/head: `main` at `4371a6a3256eb30388368297a940c97a64049b89`;
- no open PRs in `funmarket/cribbit-chaos`;
- `apps/web/src/chaos-pulse-lab.ts` and `apps/web/src/chaos-pulse-lab.css` are absent from the current tree;
- `apps/web/src/main.ts` still boots `runtimeMode: 'legacy-compatibility'`;
- `apps/web/src/canonical-game-runtime.ts` imports the shared adaptive helpers but is not imported by the Web boot path.

Correction:

- `PLAN.md` and `docs/LIVING_STATUS.md` now identify the removed panel as removed, not pending.
- Current next task is restored to the real convergence fix: migrate the main compatibility board deck/deal/draw seam to the shared CHAOS Pulse engine and route post-start interaction draws through the FIFO resolver.
- `docs/visual-integration-checkpoint.md` distinguishes HTTP/HTML Cloudflare readback from still-pending browser/runtime click-through.

Proof commands:

```sh
git status --short --branch
git rev-parse HEAD
git ls-tree -r --name-only HEAD | grep 'chaos-pulse-lab' || true
```

Score: `9.0/10`.

Reason for score: the plan now points at the real app path instead of a removed trial UI and explicitly blocks copying CHAOS Pulse into a second runtime. Score is not higher because the actual runtime seam migration and browser/live-Web proof remain unfinished.

### Phase 9 — main Web compatibility board CHAOS Pulse seam

Branch: `fix/shared-chaos-pulse-board`.

Scope:

- Keep the actual app surface on `apps/web/src/main.ts` / `packages/legacy-runtime/src/runtime.ts`.
- Do not revive `apps/web/src/chaos-pulse-lab.ts` or any removed trial panel.
- Move main-board start/deal/draw ownership onto the shared `@cribbit/game-engine` CHAOS Pulse deck path.

Change:

- Added `packages/legacy-runtime/test/shared-chaos-pulse-board.test.ts` as the RED/GREEN guard.
- `packages/legacy-runtime/src/runtime.ts` now imports `createGame` and `drawCards` from `@cribbit/game-engine`.
- Removed the local `buildDeck()` physical deck constructor from the compatibility runtime.
- `commandStartGame()` now creates the session from shared `createGame()` state, including canonical opening hands, starter discard, draw pile, and adaptive probability state.
- `drawFromDeck()` now delegates to shared `drawCards()` and syncs the legacy session view back from the engine state.

Proof commands:

```sh
npx tsx --test packages/legacy-runtime/test/shared-chaos-pulse-board.test.ts
npx tsx --test packages/game-engine/test/adaptive-distribution.test.ts
npm run typecheck
npm run build:web
git diff --check
```

Proof:

- New legacy-runtime guard: `2 pass / 0 fail`.
- Existing adaptive-distribution suite: `12 pass / 0 fail`.
- `npm run typecheck`: pass.
- `npm run build:web`: pass; Vite transformed 212 modules and produced `dist/` assets.
- `npm run build`: pass for Web, Telegram, and API.
- Full `npm run test`: `119 pass / 1 fail`; the only failure is the known local Node Argon2id blocker in `apps/api/test/web-password.test.ts`, not this runtime seam.
- GitHub PR source CI at head `6623c611237febc667e703227524672bf002cd6d`: `test`, `build-api`, `build-telegram`, `build-web`, and `typecheck` passed in run `35199427927`.
- PR opened: `https://github.com/funmarket/cribbit-chaos/pull/11`.
- `git diff --check`: pass.
- Local visual/browser automation remains blocked by local browser harness startup failure and desktop preview non-response; no live browser click-through proof claimed yet.

Score: `8.6/10`.

Reason for score: the real main-board deck/deal/draw seam now points at shared CHAOS Pulse with tests, typecheck, and Web build proof. Score is not higher until a live browser click-through confirms start-game rendering and the next slice routes post-start interaction draws through FIFO forced interaction resolution.

### Phase 10 — live-runtime canonical GameRules enforcement

User reported the live game still was not enforcing `C:\Users\GrowB\Downloads\p0-preservation\p0-preservation\gamerules.md`.

Rules enforced in this slice:

- `RULE-ACQUISITION-003` / `RULE-ACQUISITION-004`: post-setup drawn immediate-interaction cards enter their card flow immediately instead of being saved in hand.
- `RULE-ACQUISITION-010` / `RULE-ACQUISITION-011`: multiple forced-on-draw interaction cards resolve through FIFO before play continues.
- Dare target-first behavior: Dare now opens an explicit target selection step and rejects self-targeting before prompt source/roulette selection.

Change:

- Added `packages/legacy-runtime/test/gamerules-live-runtime.test.ts` to bind the live Web compatibility runtime to the canonical local GameRules file.
- Added `FORCED_ON_DRAW_KINDS`, `enqueueForcedInteractions()`, `queueForcedInteractionResolution()`, and `beginNextForcedInteraction()` to `packages/legacy-runtime/src/runtime.ts`.
- Updated normal draw and Draw-effect penalty paths so ordinary drawn cards stay in hand, forced interaction cards are queued/discarded into active resolution, and turn advancement waits for the forced queue to empty.
- Added `SOCIAL_TARGET` command/UI handling for Dare and bot auto-targeting for non-human Dare flows.
- Duel target selection now stores the selected opponent instead of incorrectly self-targeting the actor.
- Added the GameRules guard to `npm run test`.

Proof commands:

```sh
npx tsx --test packages/legacy-runtime/test/gamerules-live-runtime.test.ts packages/legacy-runtime/test/shared-chaos-pulse-board.test.ts
npm run typecheck
npm run build
npx tsx --test packages/cards/test/card-assets.test.ts packages/cards/test/card-registry.test.ts packages/game-engine/test/deck-composition.test.ts packages/game-engine/test/validation-matching.test.ts packages/game-engine/test/adaptive-distribution.test.ts packages/game-engine/test/core-engine.test.ts packages/game-engine/test/nope-routing.test.ts apps/api/test/auth.test.ts apps/api/test/guest-auth.test.ts apps/api/test/game-command-boundary.test.ts packages/cards/test/deck-docs-consistency.test.ts packages/legacy-runtime/test/shared-chaos-pulse-board.test.ts packages/legacy-runtime/test/gamerules-live-runtime.test.ts apps/web/test/room-creation-deeplink.test.ts apps/web/test/runtime-single-owner.test.ts
git diff --check
```

Proof:

- GameRules/live-runtime focused guard: `5 pass / 0 fail`.
- `npm run typecheck`: pass.
- `npm run build`: pass for Web, Telegram, and API.
- Local source suite excluding known Node Argon2id blocker: `121 pass / 0 fail`.
- `git diff --check`: pass.

Score: `8.7/10`.

Reason for score: the live Web compatibility runtime now enforces the canonical forced-on-draw FIFO path and Dare target-first guard, with source/build/test proof. Score is not higher until this PR is pushed, exact-head CI passes, and a browser/live Cloudflare readback confirms the updated runtime is deployed.

### Phase 1 — shared backend bot authority contract

Branch: `fix/shared-bot-policy-phase1`.

Scope:

- Confirm the bot issue is a shared backend/API/game-engine authority issue, not separate Web-vs-Telegram gameplay logic.
- Keep Web and Telegram as frontend adapters that submit commands and render returned state.
- Establish the Phase 2 target as one deterministic shared BotPolicy / legal-action enumerator.

Change:

- Added `apps/api/test/bot-authority-contract.test.ts` to lock the live-room authority contract:
  - API command processing imports shared `applyCommand()` / `createGame()` from `packages/game-engine`.
  - API applies a human command through the shared reducer before running `advanceBots()`.
  - API persists state through `game_sessions`.
  - Web live rooms use `packages/api-client` `createRoom()`, `getSnapshot()`, and `sendCommand()` instead of owning bot advancement.
  - Telegram live rooms use the same API adapter; local simulation remains fallback QA only.
- Added the new contract test to `npm run test`.
- Updated `PLAN.md` and `docs/LIVING_STATUS.md` so the active next task is Phase 2 shared BotPolicy, not separate Web/Telegram fixes.

Proof commands:

```sh
npx tsx --test apps/api/test/bot-authority-contract.test.ts
npx tsx --test apps/api/test/bot-authority-contract.test.ts apps/api/test/game-command-boundary.test.ts apps/web/test/room-creation-deeplink.test.ts
npm run typecheck
npm test
git diff --check
```

Proof:

- New bot authority contract guard: `3 pass / 0 fail`.
- Focused API/Web adapter guard set: `9 pass / 0 fail`.
- `npm run typecheck`: pass.
- `git diff --check`: pass.
- Full `npm test`: `125 pass / 1 fail`; the only failure is the known local Node Argon2id blocker in `apps/api/test/web-password.test.ts`, not introduced by Phase 1.

Score: `9.0/10`.

Reason for score: Phase 1 now has source-backed and test-backed proof that live Web and Telegram route through the same API/shared-engine authority boundary, and the next phase is constrained to one shared BotPolicy rather than frontend-specific fixes. Score is not higher because Phase 1 did not yet extract/implement the BotPolicy itself; that is Phase 2.

### Local Argon2id test blocker fix

Branch: `fix/shared-bot-policy-phase1`.

Root cause:

- Local Node is `v22.23.2`, but `apps/api/src/web-password.ts` only used Node's built-in `crypto.argon2Sync`, which exists in newer Node 24 runtimes.
- The production password hash contract is still Argon2id; the failure was a runtime implementation availability issue, not a test-only issue.

Change:

- Added `@node-rs/argon2` as a pinned dependency.
- Kept Node 24 `crypto.argon2Sync` as the first path when available.
- Added `@node-rs/argon2` `hashRawSync()` fallback using the same Argon2id parameters, salt, memory cost, time cost, parallelism, and output length.
- Preserved the existing stored hash format and verification behavior.

Proof commands:

```sh
node -v
npx tsx --test apps/api/test/web-password.test.ts
npm run typecheck
npm run build:api
npm test
git diff --check
```

Proof:

- `node -v`: `v22.23.2`.
- Focused Web password test: `2 pass / 0 fail`.
- `npm run typecheck`: pass.
- `npm run build:api`: pass.
- Full `npm test`: `126 pass / 0 fail`.
- `git diff --check`: pass.

Score: `9.2/10`.

Reason for score: the local Argon2id blocker is removed without downgrading the password hash contract or faking a non-Argon2 fallback, and the full suite now passes. Score is not higher only because this has not yet gone through remote CI/readback.


### Phase 2A — server-derived legal-action enumerator

Branch: `fix/shared-bot-policy-phase1`.

Scope:

- Return to the safe plan after reviewing the parked Python bot-driver proposal.
- Do not start Python, LangGraph, or deployment work.
- Add the authoritative TypeScript legal-action enumerator first, so bots can later choose only server-derived commands.

Change:

- Added `packages/contracts/src/capabilities.ts` with `RequiredActionKind`, `LegalCommandOption`, and `PlayerDecisionCapabilities` transport types.
- Added `packages/game-engine/src/capabilities.ts` with `projectDecisionCapabilities(state, playerId)`.
- Exported capability types/functions from the shared contracts and game-engine indexes.
- Added `packages/game-engine/test/bot-capabilities.test.ts` and included it in `npm test`.
- Updated `PLAN.md` and `docs/LIVING_STATUS.md` to keep Phase 2 split into legal-action enumeration first, then shared BotPolicy wiring.

Proof commands:

```sh
npx tsx --test packages/game-engine/test/bot-capabilities.test.ts
npm run typecheck
npm test
git diff --check
```

Proof:

- Focused bot capability test: `5 pass / 0 fail`.
- Full `npm test`: `131 pass / 0 fail`.
- `npm run typecheck`: pass.
- `git diff --check`: pass.
- Advertised options are reducer-accepted for active play/draw, Wild color, Truth completion-only flow, and Duel target/response/vote flow.
- Unresolved special families (`tag`, `truth_or_chaos`, `hijack`, `taboo`, `machiavelli`, `reverse_confession`, `dig_me`) are not advertised as playable bot options, so this phase fails closed rather than inventing rules.

Score: `8.8/10`.

Reason for score: Phase 2A establishes the key safe boundary: server-derived legal commands exist in the shared engine and are verified against `applyCommand()`. Score is not higher because API bot advancement still needs to be rewired from hardcoded `apps/api/src/game-service.ts` branches to choose from `projectDecisionCapabilities()` in the next Phase 2 sub-step.

### Phase 2B — shared deterministic BotPolicy and special-family no-stall coverage

Branch: `fix/shared-bot-policy-phase1`.

Scope:

- Move API bot advancement to a shared deterministic policy that chooses only server-projected legal commands.
- Keep Web and Telegram as frontend adapters; no separate frontend bot brains.
- Cover the card families that previously left bots stuck: `tag`, `truth_or_chaos`, `hijack`, `taboo`, `machiavelli`, `reverse_confession`, and `dig_me`.
- Preserve the locked rule boundary that bots must not fabricate spoken/typed answers; bot completions use Answered Live / completion-only where rules allow premade/live questions.
- Prefer human players as targets when target-card legal options include humans; otherwise choose deterministically among legal bot targets.

Change:

- Added shared `packages/game-engine/src/bot-policy.ts` with `chooseBotOption()`.
- Rewired `apps/api/src/game-service.ts` `advanceBots()` to select from `projectDecisionCapabilities()` and run the chosen command through `applyCommand()`.
- Extended shared social/capability contracts for Phase 2B special-family commands.
- Added premade prompt definitions for Truth or Chaos, Taboo, DIG ME, and Reverse Confession so question-required cards do not stall.
- Enabled reducer/capability handling for TAG, Truth or Chaos, Hijack, Taboo, Machiavelli, Reverse Confession, and DIG ME.
- Added focused tests in `packages/game-engine/test/bot-policy.test.ts` for legal-command-only bot choices, human-target preference, and all listed special families settling without unresolved bot social state.
- Updated capability and validation tests from fail-closed special-family behavior to Phase 2B playable/supported behavior.

Proof commands:

```sh
npx tsx --test packages/game-engine/test/bot-policy.test.ts
npx tsx --test packages/game-engine/test/bot-policy.test.ts packages/game-engine/test/bot-capabilities.test.ts packages/game-engine/test/validation-matching.test.ts
npm run typecheck
npm test
npm run build:api
npm run build
git diff --check
gh pr view 12 --repo funmarket/cribbit-chaos --json number,state,mergedAt,mergeCommit,url,headRefOid
gh run watch 35238603450 --repo funmarket/cribbit-chaos --exit-status
curl -L -sS -o "$LOCALAPPDATA/Temp/cribbit-web-phase2b-after-merge.html" -w 'web %{http_code} %{url_effective}\n' https://cribbit-chaos-web.pages.dev/
curl -L -sS -o "$LOCALAPPDATA/Temp/cribbit-telegram-phase2b-after-merge.html" -w 'telegram %{http_code} %{url_effective}\n' https://cribbit-chaos-telegram.pages.dev/
```

Proof:

- Focused BotPolicy test: `4 pass / 0 fail`.
- Focused BotPolicy/capabilities/validation set: `12 pass / 0 fail`.
- Full `npm test`: `135 pass / 0 fail`.
- `npm run typecheck`: pass.
- `npm run build:api`: pass.
- Full `npm run build`: pass for Web, Telegram, and API.
- `git diff --check`: pass.
- PR `#12` merged at `2026-09-17T15:11:32Z` with merge commit `f03028be7e20a9610f56e9ae62512a43b7b6262b`.
- Post-merge main CI run `35238603450` completed successfully at exact head `f03028be7e20a9610f56e9ae62512a43b7b6262b`.
- Cloudflare Web endpoint readback: `web 200 https://cribbit-chaos-web.pages.dev/`.
- Cloudflare Telegram endpoint readback: `telegram 200 https://cribbit-chaos-telegram.pages.dev/`.
- The no-stall regression exercises `truth`, `dare`, `chaos`, `paranoia`, `duel`, `tag`, `truth_or_chaos`, `hijack`, `taboo`, `machiavelli`, `reverse_confession`, and `dig_me` through reducer-accepted bot commands until no unresolved bot social/pending effect remains.

Score: `9.2/10`.

Reason for score: Phase 2B now has shared backend BotPolicy implementation proof, full local verification, exact-head PR/main CI, merge readback, and Cloudflare endpoint readback. Score is not higher because browser automation and desktop preview could not complete a live click-through game/simulation smoke, so deployed UI behavior is endpoint-proven but not visually/click-through proven in this session.

### Phase 2C — canonical rules source and frontend rule-adapter alignment

User reported that local `http://127.0.0.1:37134/` showed the correct rules but deployed Telegram/Web did not.

Diagnosis:

- `Game_rules.md` in the repo was not the full attached owner-approved annotated snapshot from `C:\Users\GrowB\Downloads\cibchaosrules\gamerules.md`; it stopped before the later locked/unresolved rules.
- Telegram's fallback simulation still had hardcoded local bot/social branches instead of choosing from shared engine `BotPolicy`/capabilities.
- Web and Telegram human decision controls did not render all shared engine projected legal options, so the backend could be correct while frontend surfaces looked like different rules.

Change:

- Replaced repo `Game_rules.md` with the attached canonical annotated owner-approved rules snapshot.
- Added `packages/cards/test/game-rules-authority.test.ts` to pin the normalized canonical rules hash and required provenance/rule IDs.
- Rewired Telegram fallback simulation bot advancement to use shared `chooseBotOption()` instead of hardcoded per-card-family logic.
- Added shared `projectDecisionCapabilities()` action controls to Web live rooms and Telegram live view so frontend decisions come from the same reducer/legal-command projection.
- Expanded the existing bot authority contract test to guard these adapter paths.

Proof commands:

```sh
npx tsx --test packages/cards/test/game-rules-authority.test.ts apps/api/test/bot-authority-contract.test.ts packages/game-engine/test/bot-policy.test.ts
npm run typecheck
npm test
npm run build
python - <<'PY'
from pathlib import Path
root=Path('.')
for term in ['Source: `021a30d8-bad8-40d0-9289-26e765ba2e85.md`','RULE-PROVENANCE-006','Canonical local rule snapshot']:
    hits=[]
    for p in root.rglob('*'):
        if '.git' in p.parts or 'node_modules' in p.parts or 'dist' in p.parts or not p.is_file():
            continue
        try:
            text=p.read_text(encoding='utf-8')
        except Exception:
            continue
        if term in text:
            hits.append(p.as_posix())
    print(term, hits)
PY
git diff --check
```

Proof:

- Canonical rules authority focused test: `5 pass / 0 fail`.
- BotPolicy focused inclusion: `8 pass / 0 fail` when run with rules/API contract tests.
- `npm run typecheck`: pass.
- Full `npm test`: `137 pass / 0 fail`.
- `npm run build`: Web, Telegram, and API builds pass.
- Canonical rule-source scan found owner-approved provenance markers only in `Game_rules.md`.
- `git diff --check`: pass.
- Commit pushed to `main`: `491680be1ebdaa065b4da688b207b788036e4c8b`.
- GitHub main CI run `35244038712`: passed `test`, `build-web`, `build-telegram`, `build-api`, and `typecheck`.
- Cloudflare endpoint readbacks returned `200`, but the asset hashes were still the previous deployed bundles during readback (`web /assets/index-Dt7LGRda.js`, `telegram /assets/index-Bf9_jV9o.js`), so deployment propagation/live client proof is not yet complete.

Score: `8.9/10`.

Reason for score: the attached rule file is now the repo's single canonical rules document, and Web/Telegram adapters now ask the same shared engine capability projection for legal human/bot decisions instead of maintaining separate frontend rule controls. Score is not higher because Cloudflare readback still showed stale deployed bundles; next step is Cloudflare deployment/readback plus live click-through.

### Phase 2D — corrected owner GameRules synchronization and stale-rule behavior cleanup

User supplied `Downloads/GameRules_CORRECTED.md` as the only active game rules authority and requested implementation cleanup anywhere card behavior could remain stale.

Change:

- Replaced `Game_rules.md` with the corrected owner-approved canonical specification, including the supersession register and new active rule IDs for Truth target-first behavior, TAG draw-along behavior, Reverse Confession target-first behavior, and Truth or Chaos consensus clarification.
- Updated `packages/cards/test/game-rules-authority.test.ts` to pin the corrected normalized rules SHA (`ed909b9228ff3f2c5a74de0bac8ec5cd5d6554212e477e29c8603e7941529b62`) and require corrected-rule markers.
- Updated shared reducer behavior so Truth, Dare, and Reverse Confession select another eligible target before prompt/answer flow; the selected target, not the actor, owns completion/pass where applicable.
- Updated TAG so the selected target draws exactly one real card and does not receive the retired bonus Play-or-Draw action.
- Updated shared capability projection and prompt targeting so Web, Telegram, API bots, and tests derive these decisions from the same engine path.
- Added `packages/game-engine/test/corrected-rules-behavior.test.ts` covering Truth target-first, Reverse Confession target-first, and TAG draw-along behavior.
- Updated stale core/capability tests that still encoded the retired self-target/current-prompt and TAG bonus-action assumptions.

Proof commands:

```sh
npm run typecheck
npm test
npm run build
git diff --check
```

Proof:

- `npm run typecheck`: pass.
- Full `npm test`: `140 pass / 0 fail / 6 skipped`.
- Full `npm run build`: Web, Telegram, and API builds pass.
- `git diff --check`: pass.
- Source commit pushed to `main`: `1c5b4f0f45675d531b375cb52ded0abaa83709cf`.
- GitHub main CI run `35250710312`: passed at exact head `1c5b4f0f45675d531b375cb52ded0abaa83709cf`.
- Build produced new local bundles: Web `dist/assets/index-LFRIS5Pn.js`; Telegram `dist/assets/index-kEj17VmA.js`.
- Cloudflare endpoint readbacks returned `200`, but Pages still served stale bundles during readback: Web `/assets/index-Dt7LGRda.js`, Telegram `/assets/index-Bf9_jV9o.js`.

Score: `9.0/10`.

Reason for score: the corrected attached rules are now the repo rule authority and the most important superseded gameplay behaviors are enforced in shared engine/capability paths with regression coverage, pushed source, and exact-head main CI proof. Score is not higher because Cloudflare still served stale Web/Telegram bundles after the push, so deployed-client click-through/readback remains blocked until Pages refreshes.

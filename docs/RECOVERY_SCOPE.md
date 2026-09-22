# Recovery scope contract — `recovery/single-engine-authority`


> **HISTORICAL RECOVERY-SCOPE CHECKPOINT.** The branch name remains relevant, but this file does not own current task sequencing or current verified state. Use `AGENTS.md`, `HANDOFF.md`, `docs/LIVING_STATUS.md`, and `PLAN.md` for current recovery authority.

Purpose: keep this recovery experiment mechanically bounded. Any action that is not listed as IN SCOPE is out of
scope and must be raised before it happens, not after.

## Objective (one sentence)

Prove whether the existing `packages/game-engine/**` → `apps/api` → `live-entry`/`live-session` path can run a
complete game once the competing browser runtime stops being booted.

## Baseline and current state

| Item | Value |
|---|---|
| Base | `funmarket/cribbit-chaos@95febd07e4d739c96843fcc4a02f070eb3c623c0` |
| Branch | `recovery/single-engine-authority` |
| Cutover commit | `f384c82` |
| Before | typecheck 0 · test 151 pass / 2 fail · build:web 0 · build:telegram 0 · build:api 0 |
| After cutover | typecheck 0 · test 152 pass / 2 fail (same 2 pre-existing) · build:web 0 · web JS 236.11 kB → 182.89 kB, CSS hash unchanged |
| Local test failures | `runtime-single-owner.test.ts` tests 42 and 43 — **NOT main failures**. Authoritative CI at `95febd0` passes on Node 24.7.0; these are **Windows CRLF test fragility** (see R2.5 below) |

Node 22.23.2 results are **environment compatibility signal only**. Authoritative toolchain evidence is Node
24.7.0, which `.github/workflows/ci.yml` already pins for all five jobs.

## R2.5 — CRLF classification (read-only, verified)

| Check | Result |
|---|---|
| `core.autocrlf` (local) | `true` |
| `.gitattributes` | **absent** (no EOL normalisation) |
| `apps/web/src/live-session.ts` on this box | 23,379 bytes · **395 CRLF · 0 bare LF** (pure CRLF) |
| Literal `\n` escapes in `runtime-single-owner.test.ts` | 5 |
| Failing assertions depend on LF | yes — e.g. `/const projected = decisionControls\(session,userId\);\n  if \(projected\) return projected;/` cannot match `;\r\n  if` |
| `f384c82` parent | **exactly `95febd07e4d739c96843fcc4a02f070eb3c623c0`** |
| `f384c82` scope | 2 files — `main.ts` −3, test +50/−6 |
| Added guard test CRLF-safe | yes — no literal `\n`, uses `\s*` |

Therefore tests 42/43 are **local-platform fragility, not a source defect**, and the cutover has no local
regression (152 pass / 2 CRLF-artifact failures, identical before and after). A repo-level fix (`.gitattributes`
with `* text=auto eol=lf`) is a separate, unapproved change and must not be bundled into this experiment.

## IN SCOPE

1. `apps/web/src/main.ts` — boot ownership only (already done: duplicate runtime boot removed, `runtimeMode: 'none'` kept).
2. `apps/web/test/runtime-single-owner.test.ts` — ownership invariants and anti-regression guards (already done).
3. `apps/api/**`, `packages/game-engine/**` — **only** to fix a mechanic that R5 proves is broken, one at a time,
   in the file that already owns it.
4. `docs/RECOVERY_SCOPE.md`, `PLAN.md`, `docs/LIVING_STATUS.md` — scope/status documentation.
5. Tests that cite the active RULE-* clause for any mechanic changed.

## OUT OF SCOPE — requires explicit approval first

- `Game_rules.md` (any edit)
- UI/UX: `packages/ui/**`, `apps/web/index.html`, all CSS, card art, templates, layout
- `packages/cards/**`, card assets, deck manifests
- `db/**`, migrations, schema, any database mutation
- `apps/telegram/**`
- `apps/web/src/canonical-game-runtime.ts` and `packages/legacy-runtime/**` (contents must not change; they are
  not deleted during the experiment)
- Renames, bulk deletes, bulk file operations, refactors, "while I'm here" cleanups
- Push, PR, merge, deploy, Railway/Cloudflare, production database
- Installing Node/Postgres/Docker system-wide without approval

## STOP conditions

Stop immediately and report when any of these occurs:

1. Any gate regresses versus the after-cutover numbers above.
2. A change would touch an OUT OF SCOPE path.
3. R5 hits the first genuine gameplay failure — report the failure and its owning layer
   (`game-service` → `bot-policy`/`capabilities` → `reducer` → `contracts`), then wait.
4. A fix appears to require changing more than one mechanic at a time.
5. Evidence would be drawn from Node 22 for a Node-24 claim.

## Failure ownership rule (never violate)

| Failure class | Owning layer |
|---|---|
| Rule / state transition wrong | `packages/game-engine/**` |
| Command, persistence or realtime wrong | `apps/api/**` |
| Projection or API boundary wrong | API + `packages/contracts/**` |
| Rendering or input binding wrong | Web/Telegram client |

Never fix a rule problem in `apps/web`. Never fix a stuck bot with a browser timer. Never fix turn advancement
with a UI click handler.

## Next steps, in order, each gated

**R3 — Node 24.7 evidence.** Two routes: (a) throwaway push of this branch so CI produces the evidence, or
(b) a portable Node 24.7 without system install. Route (a) needs push authorization. No source change in R3.

**R4 — isolated recovery database.** A dedicated Postgres for this experiment only: local, Docker, or a
disposable remote. Never production, never the clean app's database.

**R5 — run the game.** create → 7 cards → play/draw → turn advance → bots → Skip/Reverse/Draw/Wild →
forced-on-draw → Roulette → Truth/Dare → timers → winner → persistence → reconnect. Stop at the first genuine
failure, classify it by the table above, and fix only that owner.

## Standing prohibition

A gameplay change modifies the canonical rule and the single authoritative engine. It never creates another
runtime, another engine file, or a second implementation beside an existing one.

## R3 — Node 24.7 CI evidence (COMPLETE, green)

Pushed a temporary evidence branch pointing at the exact cutover commit; no PR, no merge, no `main` change.

| Item | Value |
|---|---|
| Remote evidence ref | `recovery/single-engine-authority-ci` |
| Tested SHA | `f384c824a0553d1adceb05ef55612e177967bb1a` (exact cutover commit) |
| Parent | `95febd07e4d739c96843fcc4a02f070eb3c623c0` (remote `main`, unchanged) |
| Diff scope | exactly `apps/web/src/main.ts` (−3) and `apps/web/test/runtime-single-owner.test.ts` (+50/−6) |
| CI run | **35476372150** — conclusion **success** |
| Jobs | typecheck ✅ · test ✅ · build-web ✅ · build-telegram ✅ · build-api ✅ |
| Run URL | https://github.com/funmarket/cribbit-chaos/actions/runs/35476372150 |
| Deployment created? | **No** — latest GitHub deployment is still `2026-09-18T14:03:56Z` @ `95febd0` (production) |
| Production check | `https://cribbit-chaos-web.pages.dev/` still serves `/assets/index-A3T819rq.css` + `/assets/index-BhtR9COZ.js` — unchanged |

Comparison: baseline `95febd0` green in this same workflow; cutover `f384c82` green in the same workflow; two files
differ. The local Node 22 "2 failures" are absent here, confirming they were CRLF artifacts, not source defects.

Note: CI pins Node 24.7.0 but does not install npm 10.9.2, so this is **Node-24 CI evidence**, not npm-version proof.

**STOPPED here.** PostgreSQL provisioning and R4/R5 require separate authorization.

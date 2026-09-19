# Recovery scope contract — `recovery/single-engine-authority`

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
| Pre-existing failures | `runtime-single-owner.test.ts` tests 42 and 43 (source-shape asserts on `live-session.ts`), failing **before** this branch |

Node 22.23.2 results are **environment compatibility signal only**. Authoritative toolchain evidence is Node
24.7.0, which `.github/workflows/ci.yml` already pins for all five jobs.

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

# Cribbit CHAOS — FIX.md

## Source-Level Frontend Recovery & Normalization Protocol

**Status:** IN PROGRESS  
**Branch:** `feature/visual-integration-checkpoint`  
**Rule:** Fix every problem at the authoritative source. Never patch around it.

---

# 1. NON-NEGOTIABLE RULES

Before editing any bug, display issue, interaction issue, or architectural conflict, trace the complete path first:

- data / state
- trigger / open / close / lifecycle logic
- component / modal / panel / popover / container that renders it
- parent layout / container hierarchy
- positioning / portal / stacking-context logic
- CSS / Tailwind / style definitions
- responsive / mobile / viewport behavior
- empty / single / many / long-content / loading / error / active / inactive / open / closed / repeated-open / reconnect states
- list and item rendering
- imports and usages recursively
- shared components, hooks, stores, contexts, providers, design tokens, layout primitives and utilities
- legacy runtime involvement
- deployment branch/version whenever live behavior is involved

If any relevant source is unknown, the task is **BLOCKED** until it is found.

## Never do this

- no patching / workaround layers
- no arbitrary z-index escalation
- no hardcoded offsets or dimensions solely to match one screenshot
- no duplicate components, handlers, state, route logic, IDs, `data-action`, or `data-nav`
- no second CSS rule whose purpose is to override a broken first rule
- no `!important`
- no fake/mocked production data
- no hiding/clipping broken overflow to conceal a layout problem
- no unrelated redesign
- no inline-style compensation for a broken source layout
- no post-render DOM replacement as permanent ownership

If a shared source is wrong, fix the shared source and remove the downstream conflict.

## Preserve correct behavior

Do not change unrelated colors, typography, icons, radius, shadows, navigation, scrolling, containment, focus, keyboard behavior, animation, responsive behavior, or interaction patterns unless the root bug specifically requires it.

Long content must remain contained and scroll inside the intended container.

---

# 2. REQUIRED FIX TRACE BEFORE EVERY EDIT

Every source edit requires this trace first.

## Issue
Exact observed problem.

## Acceptance reference
Screenshot, URL, user description, accepted prior UI, design reference, or explicit criteria.

## Reproduction
Exact steps.

## Render source
Exact template/component/route/panel/list/item renderer.

## State source
Exact local state/store/context/server snapshot/API response/derived/fixture state.

## Trigger/lifecycle
Exact click/event/open/close/mount/unmount/effect/subscription/router/reconnect path.

## Parent hierarchy
Trace the DOM/component path to the app shell.

## Layout/positioning
Trace flex/grid, width/height, sticky/fixed/absolute, overflow, transform, stacking context, and portals.

## Styling
List every selector, stylesheet, token, inline style, and media query affecting the surface. Flag duplicates/conflicts.

## Responsive behavior
List all breakpoints and alternate layouts.

## Related states
Default, empty, one item, many items, long text, loading, error, open, closed, repeated open, desktop, tablet/narrow, mobile, zoom, refresh/reconnect as applicable.

## Import/use graph
Trace imports recursively until the authoritative owner is proven.

## Root cause
One precise sentence.

## Authoritative fix location
Exact files and why they own the behavior.

## Files that must NOT change
Downstream files that would only introduce another patch.

No edit is allowed until the trace is complete.

---

# 3. SOURCE-OF-TRUTH ORDER

1. canonical game/product specification
2. authoritative engine/server state
3. contracts/domain model
4. shared controller/hook/store/provider
5. shared component/layout primitive
6. platform composition layer
7. platform-specific component style
8. route presentation
9. legacy compatibility code
10. one-off override files

A lower layer must never conceal a defect in a higher layer.

---

# 4. ROOT-FIX EXECUTION CYCLE

## A — Inspect
No code changes. Reproduce and trace state, lifecycle, rendering, hierarchy, styles, responsive behavior, dependencies, legacy involvement, and deployment identity.

## B — Diagnose
Record the root cause, authoritative owner, conflicting sources, obsolete sources, and intended ownership after the fix.

## C — Plan
List only the minimum authoritative files required.

## D — Implement
Edit the broken source. Remove obsolete conflicting code. Do not create parallel ownership.

## E — Validate
Run all available relevant checks:

- typecheck
- build
- lint
- unit tests
- integration tests
- browser/visual checks
- responsive checks
- edge states
- duplicate DOM/source inspection

## F — Record
Only a successfully validated root fix enters **Completed Fixes Log**.

If a regression occurs, revert the failed change. Do not stack another correction on top.

---

# 5. VALIDATION RULE

A fix cannot be called complete without truthful evidence.

| Check | Requirement |
|---|---|
| Typecheck | required when TS affected |
| Build | required |
| Lint | required if configured/relevant |
| Unit tests | required when relevant |
| Integration tests | required when relevant |
| Browser render | required for visual fixes when tooling exists |
| Desktop/narrow/mobile | required for visual fixes |
| Long content / containment | required where content can grow |
| Empty/single/many | required where applicable |
| Open/close/repeated-open/outside-click | required for overlays |
| Loading/error/reconnect | required for async/stateful surfaces |
| Duplicate DOM/source check | required |
| No new override layer | required |

A pre-existing failing check must be proven against a known earlier commit and recorded as a blocker. It must never be silently treated as a pass.

---

# 6. ARCHITECTURAL TARGET

Current problem:

> An old complete prototype still participates in the Web render/runtime path beneath the newer Web frontend, creating duplicate DOM ownership, compatibility-runtime ownership, duplicate CSS authority, and downstream override layers.

Target:

```text
canonical contracts / game engine
        ↓
shared feature/controller layer
        ↓
Web composition
        ↓
Web components
        ↓
component-owned Web styles
```

Not:

```text
old complete prototype
        ↓
legacy runtime
        ↓
shared old stylesheet
        ↓
Web post-mount DOM replacement
        ↓
Web stylesheet overrides
        ↓
corrective stylesheet overrides
```

---

# 7. VERIFIED CURRENT SOURCE TRACE

## Web startup

```text
apps/web/index.html
→ apps/web/src/main.ts
→ packages/ui/src/bootstrap.ts
→ packages/ui/src/template.html
→ main.ts beforeRuntime DOM mutation
→ packages/legacy-runtime/src/runtime.ts
→ styles.css + web-game.css + web-compact.css
```

## Proven conflicts

1. `packages/ui/src/bootstrap.ts` injects the full shared application template into `#app`.
2. Web `main.ts` replaces `.lobby-hero`, assigns `#roomCreation`, moves the existing `#startGameButton`, and adds header scroll behavior.
3. `packages/legacy-runtime/src/runtime.ts` owns setup state, navigation, rendering, event delegation, direct form bindings, demo prompts, fixture state, and compatibility gameplay behavior.
4. `packages/ui/src/styles.css`, `apps/web/src/web-game.css`, and `apps/web/src/web-compact.css` all own overlapping header and Room Creation layout.
5. `web-game.css` contains `!important` for the mode grid, proving existing override debt.
6. Normal Telegram uses `bootstrapTelegram`; shared legacy bootstrap is used by Telegram only for explicit compatibility fixtures.

---

# 8. DEPLOYMENT TRACE

Repository evidence currently says:

- Web: Cloudflare Pages project `cribbit-chaos-web`
- Web build: `npm run build:web`
- Web output: `apps/web/dist`
- staging branch evidence: `feature/visual-integration-checkpoint`
- API: Railway

Repository inspection found:

- only `.github/workflows/ci.yml`
- no repository Cloudflare deploy workflow
- no root `wrangler.toml`
- no `.cloudflare/` directory

**Blocked:** current connected Cloudflare tool does not expose Pages project settings, so the external production branch cannot yet be independently proven from the Cloudflare control plane.

---

# 9. NORMALIZATION WORKSTREAMS

## N0 — Deployment authority
- [x] CI workflow inspected
- [x] repo-owned Cloudflare workflow/config absence confirmed
- [x] documented build command/output identified
- [ ] Cloudflare production branch independently confirmed
- [ ] live Pages deployment matched to exact Git SHA

## N1 — Bootstrap ownership
- [x] startup chain traced
- [x] post-template Web hero mutation identified
- [x] implicit legacy runtime load identified
- [x] shared DOM ownership with legacy runtime identified
- [x] legacy runtime now requires an explicit bootstrap runtime mode at every known caller
- [ ] beforeRuntime post-mount composition removed from migrated Web surfaces
- [ ] migrated Web surfaces have one DOM owner
- [ ] legacy runtime ownership reduced to explicit compatibility responsibilities

## N2 — Template decomposition
- [x] template proven to contain full application surfaces
- [ ] every section classified KEEP / MOVE / REWIRE / DEV-ONLY / LEGACY / REMOVE
- [ ] migrated surfaces receive one owner

## N3 — Header normalization
- [x] shared header DOM source identified
- [x] duplicate CSS authorities identified
- [x] prior home/brand disappearance traced to downstream override history
- [ ] one header DOM owner
- [ ] one header layout authority
- [ ] duplicate rules removed
- [ ] diagnostics separated without patch layer
- [ ] visual/regression verification complete

## N4 — Room Creator normalization
- [x] shared DOM source identified
- [x] legacy runtime direct setup bindings identified
- [x] duplicate CSS authorities identified
- [ ] production state/handlers separated from fixtures/demo
- [ ] one component owns production Room Creator
- [ ] no `!important`
- [ ] responsive verification complete

## N5 — CSS normalization
- [x] `styles.css` / `web-game.css` / `web-compact.css` conflict confirmed
- [ ] every `web-compact.css` rule triaged
- [ ] wrong authoritative rules corrected in place
- [ ] valid component rules moved to owning source
- [ ] redundant rules removed
- [ ] `web-compact.css` deleted
- [ ] import removed

## N6 — Legacy runtime isolation
- [x] compatibility purpose confirmed
- [x] runtime current ownership confirmed
- [x] stale gameplay/fixture authority identified
- [x] bootstrap can no longer load legacy runtime implicitly
- [ ] useful UI utilities classified for extraction
- [ ] production game authority replaced by server feature/API path
- [ ] compatibility runtime restricted to explicit compatibility mode only

## N7 — Action wiring
- [ ] visible control → handler → controller → API → engine audit
- [ ] duplicate/local gameplay mutation removed
- [ ] dead actions removed

## N8 — Roulette
- [ ] frontend prompt authority traced
- [ ] Write Your Own traced
- [ ] server Roulette commit traced
- [ ] frontend result-selection authority removed

## N9 — Responsive/containment
- [ ] desktop
- [ ] narrow/tablet
- [ ] mobile
- [ ] zoom
- [ ] long content
- [ ] many items
- [ ] empty states
- [ ] modal/panel repeated-open and scroll containment

---

# 10. LIVE PROGRESS

## Current phase
**N1 — Bootstrap ownership / composition boundary**

## Implemented but NOT yet marked complete

### N1-A — Explicit legacy compatibility runtime boundary

**Root cause:** shared `bootstrap()` imported `packages/legacy-runtime/src/runtime.ts` unconditionally, so callers could enter legacy compatibility ownership without explicitly declaring that dependency.

**Changed:**
- `packages/ui/src/bootstrap.ts`
- `apps/web/src/main.ts`
- `apps/telegram/src/main.ts`

**Source-level change:**
- added required `runtimeMode: 'none' | 'legacy-compatibility'`
- legacy runtime imports only when the caller explicitly selects `legacy-compatibility`
- Web explicitly declares its current temporary compatibility dependency
- Telegram compatibility-fixture path explicitly declares it
- normal Telegram path remains on `bootstrapTelegram`

**No patch layer added. No duplicate runtime added.**

**Validation evidence:**
- current head TypeScript typecheck: PASS
- current CI reaches the same pre-existing game-engine test failures as the previous head
- previous head `65c6a298...` already failed the exact same 3 tests
- current failures are `128 !== 104` assertions in `packages/game-engine/test/core-engine.test.ts`
- current `packages/game-engine/src/deck.ts` declares `CANONICAL_DECK_SIZE = 128`
- current higher product authority is `CHAOS-133-V1`, so changing the tests from 104 to 128 would be another stale-authority patch and is forbidden
- build steps are skipped by the current CI because tests run before builds

**Status:** IMPLEMENTED / VALIDATION BLOCKED. Not in Completed Fixes Log yet.

## Completed Fixes Log

None yet under this protocol.

## Active blockers

### BLOCKER B1 — Canonical deck/test authority conflict

The current validation suite expects 104 cards while the current engine constructs 128. Both are stale relative to the locked physical deck authority `CHAOS-133-V1` at 133 cards.

Do **not** change `104 → 128` just to make CI green.

This requires its own source-authority trace across contracts, engine card kinds, canonical card package, setup, tests, and current locked gameplay families.

### BLOCKER B2 — CI build steps hidden behind pre-existing test failure

`.github/workflows/ci.yml` runs tests before `build:web`, `build:telegram`, and `build:api`; therefore the existing deck-test failure prevents build validation from executing.

Do not weaken or bypass tests. Build verification must be obtained without concealing B1.

### BLOCKER B3 — Cloudflare control-plane branch not independently visible

Repository docs record the intended branch/project/build settings, but connected Cloudflare tooling currently exposes documentation rather than Pages project management.

### BLOCKER B4 — Browser visual verification

A visual fix cannot be called complete until the affected route can be visually inspected after deployment or in supported browser test tooling.

---

# 11. NEXT AUTHORIZED ACTION

Continue N1 source tracing before the next edit:

1. trace the exact `.lobby-hero` and `.setup-panel` blocks in `template.html`
2. trace every legacy-runtime selector/handler that depends on descendants of those blocks
3. determine which markup must remain stable for runtime compatibility
4. move only a proven surface from post-mount mutation to a single authoritative source
5. remove the corresponding mutation code rather than overriding it
6. validate against typecheck and available build/browser evidence
7. update this file only when evidence changes

Do not disable the whole legacy runtime yet; it still owns working surfaces that have not been extracted.

---

# 12. REQUIRED COMPLETION REPORT

```text
FIX COMPLETE — [issue]

Root cause:
[one precise sentence]

Authoritative source files changed:
- [file]

Why these were the correct sources:
[explanation]

Conflicting/obsolete code removed:
- [file / selector / handler]

Validation:
- typecheck: PASS
- build: PASS
- lint: PASS / N/A
- tests: PASS / known pre-existing blocker proven separately
- visual/browser: PASS
- responsive: PASS
- edge states: PASS / N/A

Patch/workaround introduced: NO
Duplicate ownership introduced: NO
Unrelated redesign: NO
```

Do not report completion if these fields cannot be truthfully filled in.

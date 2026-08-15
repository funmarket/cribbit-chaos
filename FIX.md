# Cribbit CHAOS — FIX.md

## Source-Level Frontend Recovery & Normalization Protocol

**Status:** IN PROGRESS  
**Branch:** `feature/visual-integration-checkpoint`  
**Working rule:** Fix every problem at the authoritative source. Do not patch around it.

---

## Non-negotiable rules

Before editing any bug, display issue, interaction issue, or architectural conflict, trace the complete path first:

- data / state
- trigger / open / close / lifecycle logic
- component / modal / panel / popover / container that renders it
- parent layout / container hierarchy
- positioning / portal / stacking-context logic
- CSS / Tailwind / style definitions
- responsive / mobile / viewport behavior
- related states: empty, single, many, long content, loading, error, open/closed, repeated opening, reconnect/refreshed state
- list / item rendering
- imports and usages recursively, including shared components, hooks, stores, contexts, providers, design tokens, layout primitives, utilities, and legacy runtime participation

If any relevant source is unknown, stop and record a blocker. Do not guess.

### Never do this

- no patching / workaround layers
- no arbitrary z-index escalation
- no hardcoded offsets or dimensions solely to make one screenshot look correct
- no duplicate components, handlers, stores, route logic, IDs, `data-action`, or `data-nav`
- no second CSS rule whose purpose is to override a broken first rule
- no `!important`
- no fake or mocked production data
- no hiding overflow or broken content to conceal a layout problem
- no unrelated redesign
- no inline style compensation for a broken layout source
- no post-render replacement as a permanent ownership model

If a shared source is wrong, fix the shared source and remove the downstream conflict.

### Preserve working behavior

Do not change unrelated colors, typography, icons, radius, shadows, navigation, scrolling, containment, focus, keyboard behavior, animation, or interaction patterns unless the root bug requires it.

Long or overflowing content must remain contained and scroll in the correct container.

---

## Required Fix Trace before every source edit

### Issue
Describe exactly what is wrong.

### Acceptance reference
Screenshot, live URL, user description, accepted prior UI, design reference, or explicit criteria.

### Reproduction
Exact steps.

### Render source
Exact component/template/route/panel/list/item renderer.

### State source
Exact local state/store/context/server snapshot/API response/derived state/fixture state.

### Trigger and lifecycle
Exact click/event/open/close/mount/unmount/effect/subscription/router/reconnect path.

### Parent hierarchy
Trace the component/DOM path up to the app shell.

### Layout and positioning
Identify flex/grid, width/height constraints, sticky/fixed/absolute, overflow, transforms, stacking contexts, and portal target where applicable.

### Styling sources
List every selector/style/token/media query affecting the surface and flag conflicts.

### Responsive sources
List every breakpoint and alternate layout affecting it.

### Related states
Check default, empty, one item, many items, long text, loading, error, open, closed, repeated open/close, desktop, narrow desktop/tablet, mobile, browser zoom, and reconnect/refresh where relevant.

### Import/use graph
Trace recursively until the authoritative owner is proven.

### Root cause
One precise sentence.

### Authoritative fix location
Exact files and why they are correct.

### Files that must NOT change
Downstream files that would only create another patch.

No product source edit is allowed until this trace is complete.

---

## Source-of-truth order

1. canonical game/product specification
2. authoritative engine / server state
3. contracts / domain model
4. shared controller / hook / store / provider
5. shared component / layout primitive
6. platform composition layer
7. platform-specific component styling
8. route presentation
9. legacy compatibility code
10. one-off override files

A lower layer must never be used to hide a defect in a higher layer.

---

## Root-fix workflow

### A — Inspect
No code changes. Reproduce, trace DOM/component hierarchy, state, lifecycle, styling, responsive rules, shared dependencies, legacy involvement, and deployment version.

### B — Diagnose
Record root cause, authoritative owner, conflicting sources, obsolete sources, and intended ownership after the fix.

### C — Plan
List the minimum authoritative files to change and the obsolete conflict that will be removed.

### D — Implement
Edit the broken source in place. Remove obsolete conflicting code. Do not create parallel ownership.

### E — Validate
Run available typecheck, build, lint, tests, integration/browser checks, responsive checks, and inspect the final source for duplicate/conflicting definitions.

### F — Record
Only after successful validation update the Completed Fixes Log below.

If validation fails, revert the failed change. Do not stack another correction on top of it.

---

## Required validation matrix

| Check | Requirement |
|---|---|
| TypeScript typecheck | required when TS affected |
| Build | required |
| Lint | required if configured |
| Unit tests | required when relevant |
| Integration tests | required when relevant |
| Browser render | required for visual fixes when browser tooling is available |
| Desktop viewport | required for visual fixes |
| Narrow/tablet viewport | required for visual fixes |
| Mobile viewport | required for visual fixes |
| Long content | required where text/content can grow |
| Empty/single/many states | required where applicable |
| Open/close/outside-click/repeated-open | required for overlays/popovers/dialogs |
| Loading/error/reconnect | required for async/stateful surfaces |
| Duplicate DOM check | required |
| No new override layer | required |

A fix cannot be called complete if a required check was not performed. Unavailable visual tooling must be recorded as a blocker/pending verification, not silently treated as a pass.

---

# Architectural normalization target

Current known problem:

> An old complete prototype still participates in the Web render/runtime path beneath the newer Web frontend, creating duplicate DOM ownership, duplicate style authority, compatibility runtime authority, and downstream override layers.

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

# Current verified source trace

## Web bootstrap/render chain

```text
apps/web/index.html
→ apps/web/src/main.ts
→ packages/ui/src/bootstrap.ts
→ packages/ui/src/template.html
→ main.ts `beforeRuntime` Web DOM mutation
→ packages/legacy-runtime/src/runtime.ts
→ shared + Web CSS cascade
```

### Verified ownership conflicts

1. `packages/ui/src/bootstrap.ts` injects the full shared template into `#app` and then unconditionally imports the legacy runtime.
2. `apps/web/src/main.ts` mutates that mounted template by replacing `.lobby-hero`, assigning `#roomCreation`, moving `#startGameButton`, and adding Web-only header scroll state.
3. `packages/legacy-runtime/src/runtime.ts` still owns setup state, navigation, render functions, event delegation, direct form bindings, simulated game state, prompts, and compatibility gameplay behavior.
4. `packages/ui/src/styles.css`, `apps/web/src/web-game.css`, and `apps/web/src/web-compact.css` all define overlapping header and Room Creation layout responsibilities.
5. `web-game.css` contains at least one `!important` on `.mode-grid`; this is confirmed override debt and must be removed through source normalization, not counter-overridden.
6. Normal Telegram uses its own composition path. It enters the shared legacy bootstrap only in explicit compatibility-fixture mode.

## Deployment evidence

Repository documentation currently states:

- Cloudflare Pages Web project: `cribbit-chaos-web`
- build: `npm run build:web`
- output: `apps/web/dist`
- current staging branch evidence: `feature/visual-integration-checkpoint`
- API: Railway

Repository workflow audit found only `.github/workflows/ci.yml`; no repo-owned Cloudflare deployment workflow, `wrangler.toml`, or `.cloudflare/` configuration was found.

**Deployment blocker:** external Cloudflare Pages project settings are not directly inspectable with the currently connected Cloudflare tool, so branch/project Git settings must not be claimed as independently verified unless external evidence becomes available.

---

# Normalization workstreams

## N0 — Deployment authority
- [x] repository CI workflow inspected
- [x] repository Cloudflare workflow/config absence confirmed
- [x] documented Web build command/output found
- [ ] external Cloudflare production branch independently verified
- [ ] exact live Pages build matched to a Git commit

## N1 — Bootstrap ownership
- [x] current Web bootstrap chain traced
- [x] Web post-mount hero mutation identified
- [x] unconditional legacy runtime import identified
- [x] shared DOM ownership with legacy runtime identified
- [ ] authoritative Web composition boundary implemented
- [ ] post-mount replacement removed from migrated surfaces
- [ ] legacy runtime ownership explicitly bounded

## N2 — Template decomposition
- [x] template confirmed to contain full application surfaces, not primitives only
- [ ] sections classified KEEP / MOVE / REWIRE / DEV-ONLY / LEGACY / REMOVE
- [ ] migrated surfaces receive one owner

## N3 — Header normalization
- [x] shared header source identified
- [x] duplicate Web header style authorities identified
- [x] home/brand disappearance traced to downstream override history
- [ ] one header DOM owner
- [ ] one header layout authority
- [ ] duplicate rules removed at source
- [ ] diagnostics separated from primary player navigation without patch layer
- [ ] visual/regression verification complete

## N4 — Room Creator normalization
- [x] shared template Room Creator identified
- [x] legacy runtime direct setup bindings identified
- [x] duplicate Web Room Creator CSS authorities identified
- [ ] production state/handlers separated from fixture/demo behavior
- [ ] one component/source owns production Room Creator
- [ ] source grid/mode grid normalized without `!important`
- [ ] responsive verification complete

## N5 — CSS normalization
- [x] `styles.css`, `web-game.css`, `web-compact.css` conflict confirmed
- [ ] every rule in `web-compact.css` triaged
- [ ] wrong authoritative rules fixed in place
- [ ] valid component rules moved to owning source
- [ ] redundant overrides removed
- [ ] `web-compact.css` deleted and import removed

## N6 — Legacy runtime isolation
- [x] runtime confirmed as Phase-1 compatibility runtime
- [x] runtime confirmed to own current Web event/render/setup behavior
- [x] stale gameplay/fixture authority identified
- [ ] useful UI utilities classified for extraction
- [ ] production game authority replaced by real feature/API path
- [ ] compatibility runtime available only where explicitly requested

## N7 — Action wiring
- [ ] Button → component handler → semantic controller → API → engine audit completed
- [ ] duplicate/local gameplay mutation removed
- [ ] dead actions removed

## N8 — Roulette
- [ ] frontend prompt authority traced
- [ ] Write Your Own path traced
- [ ] server Roulette commit path traced
- [ ] frontend result-selection authority removed

## N9 — Responsive/containment
- [ ] desktop
- [ ] narrow desktop/tablet
- [ ] mobile
- [ ] browser zoom
- [ ] long content
- [ ] many items
- [ ] empty states
- [ ] modal/panel repeated-open and scrolling

---

# Live progress

## Overall status
IN PROGRESS

## Current phase
**N1 — Bootstrap ownership / composition boundary**

## Completed Fixes Log

No product fix is recorded as complete yet under this protocol. Earlier commits must be re-audited and re-validated before they can be accepted as normalized source fixes.

## Active blockers

1. External Cloudflare production branch/project configuration has not been independently inspected through a Pages management connector.
2. Browser-level visual verification is required before a visual fix can be marked complete. If unavailable in the active environment, it remains pending rather than being guessed.

## Current next action

Trace the exact ownership boundary required to stop Web from permanently relying on `beforeRuntime` post-template mutation while preserving all still-working runtime bindings. Implement only after the migration boundary is proven safe.

---

# Completion report required for every fix

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
- tests: PASS / N/A
- visual/browser: PASS / PENDING WITH BLOCKER
- responsive: PASS / PENDING WITH BLOCKER
- edge states: PASS / N/A

Patch/workaround introduced: NO
Duplicate ownership introduced: NO
Unrelated redesign: NO
```

Do not report completion if these fields cannot be truthfully filled in.

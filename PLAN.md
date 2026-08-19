# Cribbit CHAOS Implementation Plan

## Mandatory project-control workflow

Every implementation slice must follow:

**inspect living status → make change → test/verify → remove superseded/stale artifacts → update living docs → merge/publish → verify actual runtime state**

GitHub is the canonical source of truth. `README.md`, `PLAN.md`, `AGENTS.md`, and `docs/LIVING_STATUS.md` must stay synchronized with verified reality.

The no-stale-debt rule in `AGENTS.md` is mandatory: temporary, duplicate, dead, conflicting, recovery, debug, compatibility, or superseded resources must be removed in the same completed migration whenever technically safe.

## Canonical architecture

```text
GitHub = source of truth
    |
    +--> Cloudflare Pages Web
    |
    +--> Cloudflare Pages Telegram
                 |
                 v
              Railway API
                 |
                 v
          Railway PostgreSQL
```

Web and Telegram are two clients of one game. They may use different responsive layouts, but may not own separate deck composition, card behavior, rules, commands, or authoritative state.

## Locked mechanics direction

The mechanics phase takes priority over final art polish.

The existing Web card appearance is the temporary visual baseline. Final card art can be redesigned later without changing canonical card IDs or behavior.

### Canonical playable deck — 112 cards

- 92 colored engine cards
  - each color: 0 x1, 1–9 x2, Skip x1, Reverse x1, Draw x2
- Wild x4
- Truth x3
- Dare x3
- Paranoia x3
- Chaos x3
- Duel x2
- Nope x2

Pass, Rewind, Flag, Spice Dial, Speak, Type, Choose, and Answered Live are controls/systems, not hand-card inventory.

## Completed foundation

### Phase 0 — Repository foundation — COMPLETE

Private GitHub monorepo, Vite Web/Telegram apps, Railway API scaffold, PostgreSQL foundation, CI, and repository cleanup established.

### Phase 1 — Core game engine foundation — COMPLETE

State/card/player/command/event models, deterministic setup, legal play, classic actions, Wild flow, turn progression, win handling, idempotency, and tests exist.

### Phase 2 — Social engine foundation — COMPLETE

Truth, Dare, Paranoia, Duel, Chaos, Nope reaction, prompt eligibility, roulette presentation, and authorship logic exist.

### Phase 3 — Safety/answer foundation — COMPLETE

Pass, Rewind, Flag, Speak, Type, Choose, Answered Live, timer, timeout, and privacy boundaries exist.

## Active mechanics/card migration — IN PROGRESS

### M1 — Canonical deck and Web baseline

- [x] lock canonical production deck at 112 playable cards
- [x] update shared `packages/game-engine/src/deck.ts` to build 112
- [x] expose canonical deck count/size constants
- [x] add dedicated canonical composition regression test file
- [ ] remove stale 104-card assumptions from the existing large core-engine test without dropping its other coverage
- [ ] run full shared verification successfully
- [ ] change the temporary Web legacy runtime's local 128-card builder to the same 112 composition
- [ ] verify Web game flow with the canonical deck
- [ ] remove/document any Web-local deck/rule implementation made obsolete by shared ownership

### M2 — Telegram convergence

Started early at user direction, but cannot be called complete until M1 verification is green.

- [x] remove Telegram renderer dependency on the PNG card registry/assets in source
- [x] switch Telegram card rendering toward the Web-style HTML/CSS presentation
- [x] preserve Telegram `data-action="play-card"` and card identity hooks
- [ ] verify Telegram typecheck/test/build with the replacement renderer
- [ ] correct any shared-style/mobile conflicts found by verification
- [ ] connect Telegram demo/runtime to the same canonical shared card IDs/state rather than a parallel local deck
- [ ] verify Web and Telegram show equivalent card semantics for the same state
- [ ] after references reach zero and builds pass, delete obsolete PNG card masters/derivatives, PNG resolver/registry pieces, asset tests, and superseded PNG-specific docs

### M3 — Rules and game feel

After M1/M2 pass:

- [ ] lock draw-after-draw rule
- [ ] lock Draw 2 skip/penalty rule
- [ ] lock social-card legality relative to active color/symbol
- [ ] formalize Nope eligibility matrix
- [ ] formalize Chaos deterministic effect catalogue
- [x] formalize subjective Duel shared-question/group-vote resolver policy
- [ ] add structured objective Duel answer/evaluation content and backend evaluator
- [ ] verify Truth/Dare/Paranoia complete flows
- [ ] verify Pass/Rewind/Flag privacy and behavior
- [ ] make every visible button map to one implemented authoritative command
- [ ] remove duplicate command aliases and stale command variants
- [ ] add deterministic complete-turn tests for every family

### M4 — Client mechanics UX

- [ ] derive enabled/disabled controls from authoritative legal state
- [ ] replace preview-only button behavior with real command submission/snapshot updates
- [ ] align Web and Telegram contextual panels with the same state machine
- [ ] tune timers, pacing, anti-downtime behavior, and player-count profiles
- [ ] verify reconnect/timeout UX against authoritative state

### M5 — Audio after stable events

Only after mechanics are stable:

- [ ] define semantic sound-event mapping
- [ ] create/generate sound effects and optional voice comments
- [ ] attach audio to semantic game events, not raw button clicks
- [ ] provide mute/volume/accessibility controls

### M6 — Final visual polish

Only after the game works:

- [ ] decide final card art direction
- [ ] replace temporary Web-style card visuals if desired
- [ ] keep canonical card IDs/mechanics unchanged
- [ ] verify both clients against the same final visual source

## Verification status at latest inspected head

The shared deck now generates 112 cards and TypeScript typecheck passes.

Current CI is **red** because three existing assertions in `packages/game-engine/test/core-engine.test.ts` still expect the previous 104-card core-only deck and two Skip/Reverse copies per color. CI therefore skips Web/Telegram/API build steps after test failure.

This stale-test debt must be removed before the PNG package is deleted. Deleting assets before the replacement build is verified would violate the mandatory workflow.

## Staging/auth work

Existing staging/auth items remain separate from the mechanics migration and must not be silently marked complete:

- live Web smoke proof
- Telegram raw-`initData` live proof
- browser Telegram OIDC live proof
- same Telegram human resolves to same internal UUID across both clients
- shared profile write/read proof through the same Railway PostgreSQL

## Current Next Task

**M1.1b — Green the canonical 112-card shared engine.**

Update the stale 104-card expectations in the existing core-engine test while preserving its full coverage, run the full test/build suite, then correct and verify the Web legacy runtime's 128-card local builder. Once the replacement paths pass, complete Telegram verification and delete the obsolete PNG card assets and PNG-specific support code in the same migration slice.

# Cribbit CHAOS Implementation Plan

## Mandatory project-control workflow

Every implementation slice must follow:

**inspect living status -> make one controlled change -> validate source -> verify runtime when applicable -> remove superseded/stale artifacts -> update living docs -> publish -> verify deployed behavior**

GitHub is the canonical source of truth for deployable source, game rules, documentation, and implementation status.

`README.md`, `PLAN.md`, `AGENTS.md`, `HANDOFF.md`, and `docs/LIVING_STATUS.md` must not contradict verified reality, and gameplay meaning must not be restated as competing truth outside `Game_rules.md` (see `docs/CHANGE_GOVERNANCE.md`).

Resume order: `AGENTS.md` -> `HANDOFF.md` -> `docs/LIVING_STATUS.md` -> this file's current phase/task -> relevant rule/domain docs -> source.

Temporary planning/recovery artifacts such as `FIX.md`, scratch files, recovery notes, generated diffs, diagnostics, and debug logs must never be committed.

## Working mode

- Web-first until gameplay is stable.
- Telegram UI work is deferred unless a Web change requires shared-contract compatibility.
- Backend/server/runtime owns authoritative gameplay state and rule enforcement.
- UI is presentation/input only.
- Do not create duplicate card engines, duplicate Roulette systems, duplicate refusal paths, or family-specific copies of shared mechanics when one authoritative dispatcher/handler can own the rule.
- Do not claim runtime acceptance from static tests alone.

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

Web and Telegram are two clients of one game. They may use different responsive layouts, but may not own separate deck composition, card behavior, commands, or authoritative rules.

## Canonical physical deck — CHAOS-133-V1

The game starts from exactly 133 physical playable card instances.

Current family counts:

- Number x76
- Skip x6
- Reverse x6
- Draw x6
- Wild x3
- Truth x3
- Dare x3
- Paranoia x3
- Chaos x3
- Duel x3
- Nope x3
- TAG x3
- Truth or Chaos x3
- Hijack x3
- Taboo x3
- Machiavelli x1
- Ghost x1
- Reverse Confession x3
- DIG ME x1

Pass, Rewind, Flag, Roulette, answer-mode controls, and other UI controls are systems, not physical hand-card families.

Machiavelli may create approved runtime card instances after game start. That can increase the active game card count above 133, but it does not change the physical starting deck authority.

### Card asset authority

- Canonical card package: `CHAOS-133-V1`.
- Reverse Confession canonical assets use JPEG:
  - `cards/reverse_confession/fIYGR_01.jpg`
  - `cards/reverse_confession/fIYGR_02.jpg`
  - `cards/reverse_confession/fIYGR_03.jpg`
- Do not retain duplicate PNG/JPEG versions of the same canonical physical card.
- Known separate production QA issue: `cards/numbers/lime/number_lime_1_02.jpg` is zero-byte. This is an artwork/integrity issue, not a gameplay-rule change.

## Completed/accepted gameplay slices

### Recovery slices (local only, in branch ancestry)

| Slice | Commit | Established |
|---|---|---|
| R1 cutover — engine/API as the only Web gameplay owner | `f384c82` | Shared engine + API command path own Web gameplay (CI anchor) |
| SIM-1 — Local QA Simulation on the shared engine | `b083784` | `#startGameButton` = local QA Simulation (locked decision) |
| LINK-1 — explicit cross-transport identity linking | `a91ee8b` | Explicit linking attaches to an existing `users.id`; no merges |
| IDENTITY-2 — canonical identity convergence | `beb2b2a`, `0730e64`, `5f2b4cfe` | Unknown Telegram auth is lookup-only; explicit creation makes exactly one user |
| LOGIN-A — identity-link challenge boundary | `11eadf4` | Dedicated challenge storage, atomic single use, OIDC callback fails closed |
| LOGIN-B / LOGIN-C / LOGIN docs | `6e99205`, `6970960`, `2c7f1f9` | Account lifecycle, minimum account UI, locked account model |
| SIMSHARE-1 — one shared Simulation orchestrator | `7dae3e2` | `packages/simulation` owns client-independent QA orchestration |
| ROULETTE-PRIVACY-1 — sealed selection boundary | `59829d6` | Sealed Roulette selection masked at the authoritative projection |
| COMMAND-ID-1 — canonical Live command identity | `3a574ff` | Live `commandId` must be an RFC 4122 UUID; invalid ids fail before persistence |
| Special-card play + Voluntary Draw | `cb1b1b9` | `Game_rules.md` sections 51/52 implemented in the shared engine; retired `allowVoluntaryDraw` knob removed |
| DOC-REBASELINE-1 | local commit of this file | Documentation set reconciled to verified reality |

### Live multiplayer lifecycle (Create -> Join -> Start) — ACCEPTED (verified locally)

- `POST /v1/rooms` creates a waiting room with real owner membership only: no fabricated bots, no game session, no deal.
- `POST /v1/rooms/join` adds real membership only; rejects joins to a started game and joins past configured capacity.
- `POST /v1/rooms/:roomId/start` is owner-only, requires the configured real-player count, and creates exactly one authoritative session with seven cards each.
- Waiting-room realtime uses `room:<roomId>` (`room-updated` / `room-started`); PostgreSQL remains authoritative.
- Client realtime root cause: `CribbitRealtimeClient.connect()` created a second socket while the first was still connecting, so listeners and room membership landed on different sockets. Fix: `if (this.socket) return this.socket`.
- Web five-real-user lifecycle, five-client convergence after one ordinary command, and private-hand scoping: VERIFIED LOCALLY.
- Telegram live runtime: NOT VERIFIED (no way to mint Telegram Mini App `initData` in the verification environment).
- Simulation stays separate: production Web is CORE WORKING with a SPECIAL-FLOW BLOCKER where a bot reaches a special-card interaction expecting human-style input.

### Shared page navigation (NAV-1) — ACCEPTED (browser-verified)

- `packages/ui/src/navigation-controller.ts` owns presentation-only page switching for the shared template: `[data-nav]` activates the matching existing `[data-view]`, sets `aria-current`, closes the mobile navigation dialog, honours `data-room-anchor`, and opens `#mobileNavDialog` from the existing trigger control.
- Installed from `bootstrap()` only when `runtimeMode` is `'none'`, so no client ever has two navigation owners while Telegram still runs the compatibility runtime.
- Browser-verified: all seven destinations switch through their real controls (game and recap exist only as popover items, proven with real hover plus real clicks), the mobile path uses the same delegated handler, and the desktop Play popover reveals on hover/focus (`:hover` / `:focus-within` CSS already worked, so no navigation source change was required for the popover).
- Commit: `efb72401ed23f007f8db4c95137a0769cca9ff63`.

### Web Local QA Simulation (SIM-1) — ACCEPTED (browser-verified)

- `#startGameButton` means Local QA Simulation, per the locked product decision: it is not Live host Start and does not reuse the Live flow.
- Architecture: Web Simulation UI -> `apps/web/src/simulation-mode.ts` -> `apps/web/src/simulation-session.ts` -> shared `packages/game-engine` (`createGame`, `applyCommand`, `chooseBotOption`) against ephemeral local state.
- No PostgreSQL persistence, no `/v1` room creation, no fabricated Live users, no duplicated deck/rule logic, and no boot of `packages/legacy-runtime` or `canonical-game-runtime.ts`.
- Board presentation reuses the shared renderer (`renderLiveSession(..., mode: 'LOCAL')`); the duplicate private view switcher in `live-session.ts` was retired in favour of the shared navigation controller.
- Browser-verified: a real click starts the simulation (game view, five players, seven cards each, engine deal/discard), ordinary human play and draw update the board, bots complete ordinary turns, zero `/v1` requests and zero database rows during the whole simulation, and Live Create still creates a waiting room with no session before host Start.
- `packages/action-registry` corrected: `#startGameButton` now records `local game-engine simulation` instead of the Live start endpoint.

### Canonical identity convergence (IDENTITY-2) — ACCEPTED (verified locally)

One human uses Web and Telegram as the same canonical `users.id`. `users` plus `user_identities` remain the only account model; `auth_sessions` and `web_credentials` attach to it.

- Telegram authentication is lookup-only: an unknown Telegram identity returns `409 TELEGRAM_IDENTITY_UNLINKED` and never provisions a canonical user.
- Explicit creation is a separate action: `POST /v1/auth/telegram/register` creates exactly one user for the validated identity.
- Linking an existing account is explicit: `POST /v1/auth/telegram/link` (proves the Web credential) or `POST /v1/auth/telegram/link-with-code` (consumes a short-lived single-use code from `POST /v1/me/identities/telegram/link-code`). Codes live in the dedicated `identity_link_challenges` table, never in `auth_sessions` (see LOGIN-A): the earlier namespaced-hash approach did allow the challenge string to authenticate, and that is fixed.
- The reciprocal direction exists: `POST /v1/me/identities/web-credential` attaches a Web login to the current canonical user without creating a user.
- Preserved LINK-1 semantics: ATTACH, IDEMPOTENT, `409 IDENTITY_ALREADY_LINKED` for a foreign Telegram identity, `409 IDENTITY_PROVIDER_ALREADY_LINKED` for a second Telegram identity on one account. No merges, no product-data movement.
- Profile ownership: authentication refreshes provider metadata only. Telegram re-authentication no longer overwrites the canonical display name (regression-tested).
- Minimum account UI: the Web profile panel shows linked transports and issues link codes; the Telegram client renders an explicit onboarding panel (create / link existing / use a link code) and an "Add a Web login" panel. No account logic lives in the frontends.
- Real API + PostgreSQL proof: unknown identity provisions nothing, explicit creation creates exactly one user, Web-first and Telegram-first converge on one `users.id`, the code issued by the real Web UI linked a spec-signed Telegram identity to the same user and could not be replayed, foreign identities conflict without movement, and invalid or stale proof is rejected.
- A real Telegram Mini App runtime still cannot mint `initData` in this environment: server validation is proven with locally minted, algorithm-correct `initData`, and the Mini App client path remains NOT VERIFIED.

### LOGIN-A — identity-link challenge security boundary — ACCEPTED (verified locally)

`auth_sessions` now means authenticated login sessions only. Identity-link challenges live in the additive `db/migrations/003_identity_link_challenges.sql` table (`user_id -> users.id`, `code_hash` unique, `purpose` check, `expires_at`, `consumed_at`) and are consumed by a single atomic `UPDATE` bound to hash + purpose + unconsumed + unexpired that returns the canonical user, so concurrent consumers cannot both succeed and a challenge value can never resolve as a session. Previously `identity-link:<code>` presented as the Web session cookie returned `200` on `/v1/me`; it now returns `401`, while the intended link endpoint still consumes the code exactly once (`200 LINKED`, replay `401 LINK_CODE_INVALID`). The dormant Telegram Web Login/OIDC callback fails closed and no longer attaches an identity from whichever browser cookie accompanies it. Commit `11eadf4`.

### LOGIN-B — account lifecycle — ACCEPTED (verified locally)

Unknown Telegram is lookup-only (`409 TELEGRAM_IDENTITY_UNLINKED`, zero provisioning), explicit creation creates exactly one canonical user, Web-only registration/login needs no Telegram, Web-first and Telegram-first linking converge on one `users.id`, foreign and provider conflicts move nothing, and provider authentication refreshes provider metadata only. The Telegram username may be offered as a convenient Web login username through the backend-owned `GET /v1/me/web-login-suggestion` (`AVAILABLE` / `NO_TELEGRAM_USERNAME` / `INVALID_TELEGRAM_USERNAME` / `LOGIN_TAKEN`); it claims nothing and never links accounts. Commit `6e99205`.

### LOGIN-C — minimum account UI — ACCEPTED (browser-verified)

Both clients reach identity only through `packages/api-client` (no frontend HTTP, no frontend identity decision). The Web account panel states the canonical model ("Web login: Connected", "Telegram: Not connected|Connected"), issues the short-lived single-use link code and shows when it expires, and never renders the canonical user id. The Telegram "Add Web login" form pre-fills the backend suggestion only when the backend reports it available. Commit `6970960`.

### LOGIN-D — cross-client acceptance — ACCEPTED (runtime + database verified)

One server-authoritative game across both transports: the same human reading a session through the Web cookie and through the Telegram bearer gets the identical session id, seat, private hand, revision and current player, with exactly one room membership per canonical user and no fabricated bots; an independent Web user and Telegram user share one session with each other's hands masked, and each client observed the other's authoritative revision (0 -> 1 from Web, then 1 -> 2 from Telegram). Database proof: `users` 24 -> 26 for exactly two intentional accounts, one credential and one Telegram identity per user, zero challenge rows left behind.

### Locked account model

> Cribbit has one canonical account identifier: `users.id`. Telegram and Web are optional authentication methods attached to that account. Telegram authenticates directly from server-verified Telegram numeric identity; Web authenticates with username/password. Telegram username is provider metadata and may be used only as a convenient suggested Web login username when available. Username equality never links accounts. Linking requires explicit proof and attaches the second authentication method to the existing `users.id`. Telegram-only and Web-only accounts are both valid.

Next task: `SIMSHARE-1` — replace the two duplicated simulation harnesses (`apps/web/src/simulation-session.ts`, `apps/telegram/src/simulation.ts`) with one shared engine-backed harness both clients consume.

### Roulette presentation — ACCEPTED

- One authoritative prompt is selected before animation.
- Roulette is presentation only.
- Selected prompt survives the spin.
- SVG-based wheel rendering removed the old rotating-HTML flicker.

### Fixture Preview close behavior — ACCEPTED

Fixture Preview is visual-only and dismissible. Closing it clears fixture-preview state without touching authoritative gameplay.

### Active unresolved-flow close behavior — ACCEPTED

Unresolved gameplay effects cannot be dismissed. Close attempts keep the modal open and show the guard message telling the player to finish the action first.

### Hybrid Paranoia — ACCEPTED

Canonical entry:

```text
Play Paranoia
-> choose prompt source
-> Manual or Roulette
-> prompt established
-> choose initial target
-> choose Classic or Stranger
```

Classic:

```text
paranoia-choice
-> paranoia-phase
-> paranoia-classic-answer-player
-> paranoia-classic-decision
-> resolved
-> Continue / win check
```

- Initial target is preserved separately from the later answer player.
- Initial target names the Classic answer player.
- Named answer player alone chooses Reveal or Keep Secret.
- Classic phase selection itself must not resolve the card.

Stranger:

```text
paranoia-choice
-> paranoia-phase
-> paranoia-target-answer
-> paranoia-stranger-vote
-> resolved
-> Continue / win check
```

- Eligible voters are everyone except the target.
- Tie means no penalty.
- Strict `LYING` / `HOLDING_BACK` majority makes the target draw 2.

Manual browser checks passed for Classic no-winner, Stranger no-winner, last-card Paranoia winner, and Truth/Dare Continue regression.

### Truth / Dare Manual + Roulette — ACCEPTED

Canonical flow:

```text
Play Truth/Dare
-> choose prompt source
-> Manual or Roulette
-> prompt established
-> preview/reveal/answer
```

Manual prompt validation: 10-280 characters. Manual prompts are one-off runtime prompts and are not automatically saved permanently.

### Truth / Dare Pass / Not for Me — ACCEPTED

Locked rule:

```text
Pass / Not for Me
-> draw exactly 2 real cards
-> authoritative hand mutates
-> social effect resolves
-> Continue / turn resolution
-> win check
```

This applies equally to Truth and Dare, Manual and Roulette.

Critical ordering:

```text
play last Truth/Dare
-> hand reaches 0 temporarily
-> Pass / Not for Me
-> Draw 2 happens first
-> player cannot win from that play
```

Browser acceptance confirmed Truth Manual, Truth Roulette, Dare Manual, Dare Roulette, normal no-penalty completion, last-card non-win behavior, and normal Continue/turn resolution.

### Duel — ACCEPTED

Canonical model:

```text
Play Duel
-> choose opponent
-> choose Duel question source
-> Manual or Duel Roulette
-> establish ONE shared question
-> challenger selects timer
-> challenger answers
-> opponent answers the SAME question
-> resolve winner
-> Continue / win check
```

Current subjective/manual/team/app text Duel questions use `GROUP_VOTE`.

Group-vote rules:

- Candidates: challenger and opponent only.
- Eligible voters: every session player except challenger and opponent.
- Participants cannot vote on their own Duel.
- Each eligible voter votes once.
- Unique top vote wins.
- Tie = no Duel winner.
- No eligible submitted votes = no winner.
- Two-player Duel therefore resolves with no Duel winner and must not hang.

Duel cannot be Noped.

Human voter identity is derived from the actual local human player. Bot/internal votes can pass explicit voter identity only through the internal non-human path.

Bot-vote lifecycle is accepted in the browser: entering `duel-vote` wakes the existing bot social resolver, mixed human/bot voter groups wait only for eligible humans, all-bot eligible voter groups complete, and two-player no-voter Duels resolve without a frozen voting screen.

Objective automatic judging remains future work and must require structured objective evaluation metadata. Do not infer Roulette = automatic judging and do not use AI free-text judging as a substitute.

## Machiavelli — LOCKED PRODUCT RULE

Machiavelli is not free-text rule authoring.

Private chooser contains exactly six server-enforced options:

1. Convert the Weak
2. Taboo for All
3. No Mercy
4. Paranoia Spreads
5. Double the Pressure
6. Reverse Confession

Effects:

- Convert the Weak: convert all Skip cards in hands, draw pile, and discard into Draw +2 cards.
- Taboo for All: add one generated Taboo to each player's hand.
- No Mercy: permanently remove all Nope cards from hands, draw pile, and discard.
- Paranoia Spreads: add one generated DIG ME / Paranoia-family card to each player's hand; exact family-selection semantics remain to be locked if still unspecified.
- Double the Pressure: duplicate every remaining Truth and Dare currently in the draw pile and shuffle the duplicates into that draw pile.
- Reverse Confession: add one generated Reverse Confession to each player's hand.

Machiavelli is one-use and moves to Exhausted after resolution.

## CHAOS Pulse adaptive distribution — SOURCE IMPLEMENTED / BOARD INTEGRATION PENDING

The product rule is locked in `Game_rules.md` and detailed in `docs/adaptive-card-distribution-rule.md`.

Canonical pipeline:

```text
ADAPTIVE WEIGHTS
-> PRIMARY CHAOS VARIANCE
-> ADAPTIVE REBALANCER
-> SECONDARY CHAOS VARIANCE
-> HARD SAFETY GUARD
-> NORMALIZE
-> SELECT ONE REAL PHYSICAL CARD
```

### Shared-engine source now implemented

- `packages/contracts/src/index.ts` carries authoritative adaptive probability state.
- `packages/game-engine/src/adaptive-distribution.ts` owns one shared implementation of opening dealing, family classification, freshness, interaction pressure, two-stage variance, category rebalancing, and real physical-card selection.
- `packages/game-engine/src/setup.ts` deals adaptive 7-card opening hands with exactly 1–2 high-impact/special cards per player and reserves the existing deterministic starter-card strategy without consuming the starter during the adaptive deal.
- `packages/game-engine/src/deck.ts` routes authoritative `drawCards()` through the adaptive selector.
- `packages/game-engine/src/index.ts` exports the shared helpers; no second adaptive algorithm is allowed in the UI or compatibility runtime.

### Current source tuning candidates

These are trial values, not production-final constants:

- family freshness: `0.55 -> 0.66 -> 0.77 -> 0.86 -> 0.94 -> 1.0`
- interaction after interaction: `pressure x 0.62`, bounded to `0.55..1.9`
- quiet/non-interaction draw: `pressure x 1.08 + 0.02`, same bounds
- primary CHAOS variance: `0.85..1.15`
- secondary CHAOS jitter: `0.97..1.03`
- one-copy rare tier currently receives a mild `0.9` trial multiplier after physical availability

These constants must be tuned from browser experience and larger simulations rather than treated as permanent product rules.

### Deterministic tests

`packages/game-engine/test/adaptive-distribution.test.ts` covers:

- 2–10 player opening deals;
- every opening hand exactly 7 cards;
- every opening hand exactly 1–2 high-impact specials;
- all 133 physical IDs conserved and unique;
- same seed replay determinism;
- different-seed opening variety;
- 6/3/1-copy physical weighting;
- freshness suppression without hard bans;
- primary variance;
- category rebalancing;
- secondary jitter;
- zero-availability protection;
- real-card removal;
- sequential multi-card recalculation;
- interaction-pressure rise/reset.

CI for the merged `main` integration checkpoint commit `4371a6a3256eb30388368297a940c97a64049b89` is **GREEN**: typecheck, Web build, Telegram build, API build, and tests pass.

### Web trial surface status

The earlier separate **Try CHAOS Pulse** lobby panel was removed before PR #8 merged. It is not present in the current `main` tree, and the source files below are intentionally absent:

- `apps/web/src/chaos-pulse-lab.ts`
- `apps/web/src/chaos-pulse-lab.css`

Do not resume by trying to test that removed panel. The current app-facing path is the main Web board, which still boots through `runtimeMode: 'legacy-compatibility'` in `apps/web/src/main.ts`.

Status: **SHARED ENGINE BUILDS — MAIN BOARD DECK SEAM STILL NEEDS MIGRATION.**

### Compatibility-runtime migration boundary

The main visible gameplay board currently boots through `apps/web/src/main.ts` and still uses:

```text
runtimeMode: legacy-compatibility
```

PR #9 removed the extra direct `canonical-game-runtime.ts` bootstrap from `apps/web/index.html`, so the Web shell no longer starts both the canonical browser runtime and the compatibility path at the same time.

Current runtime classification after PR #9:

- `apps/web/src/canonical-game-runtime.ts` is reference/dead for Web boot and must not be imported by `apps/web/index.html`. Preservation classification: `UNKNOWN — PRESERVE` (see `docs/LIVING_STATUS.md`) — removal is not authorized until ownership, historical product purpose and migration/replacement status are proven.
- `packages/legacy-runtime/src/runtime.ts` remains the active transitional board runtime through `bootstrap(... runtimeMode: 'legacy-compatibility')`.
- `apps/web/src/live-entry.ts` and `apps/web/src/live-session.ts` remain active auth/live-room command bridges.

That legacy runtime still owns an obsolete local deck/deal/draw implementation. Do **not** copy CHAOS Pulse into it as a second algorithm.

The next convergence step is to bridge/remove the legacy deck/deal/draw seam so the main board consumes the shared authoritative CHAOS Pulse engine. Until that migration is browser-verified, the main board remains the app-facing verification target.

## Locked game-feel rule — opening hand is free, later interaction draws auto-play

Cribbit CHAOS should become more active and less passive whenever the deck produces a social/player-interaction card after play has begun.

### Opening-hand exception

Interaction cards dealt as part of the player's **initial starting hand** are normal hand cards. They remain in hand and may be voluntarily played later whenever normal play legality allows.

They do **not** auto-trigger merely because they were part of the opening deal.

### Post-start draw rule

After the initial deal is complete, any immediate-interaction card drawn from the authoritative draw source must auto-play immediately and cannot be stored for later voluntary play.

Immediate interaction families:

- Truth
- Dare
- Paranoia
- Duel
- Taboo
- Reverse Confession
- TAG
- Truth or Chaos
- Hijack
- DIG ME
- Chaos
- Machiavelli

Hand-resident families:

- Number
- Skip
- Reverse
- Draw
- Wild
- Nope
- Ghost

### Chained draw behavior

If a draw effect yields several immediate interactions, they resolve FIFO in physical selection order, with no overlapping social flows.

## Active gameplay slice — convergence of adaptive draw + interaction-on-draw

The shared engine now owns adaptive physical-card selection. The remaining gameplay integration is to connect selected post-start interaction cards to the one authoritative forced-interaction dispatcher/queue and migrate the current Web compatibility board away from its duplicate local deck seam.

Architecture requirement:

```text
INITIAL DEAL
-> shared adaptive dealer
-> opening interactions remain in hand

POST-START AUTHORITATIVE DRAW
-> shared CHAOS Pulse selects one real physical card
-> hand-resident family: add/keep in hand
-> immediate-interaction family: commit/enqueue immediate play
-> resolve queued interactions FIFO
-> resume original effect/turn only when queue is empty
```

Implementation requirements:

- one central family classification and adaptive selector only;
- one forced-interaction queue only;
- no copy of CHAOS Pulse in `legacy-runtime`;
- migrate/bridge the legacy board to shared deck/deal/draw authority;
- initial deal explicitly bypasses auto-play;
- applies to normal draws and every penalty/effect draw path;
- real physical card identity remains authoritative;
- replay/idempotency cannot select or trigger the same card twice;
- bots use the same shared path;
- turn advancement and win checks wait for queued interactions.

### First dispatcher verification set

Begin with already-accepted family flows:

1. Truth
2. Dare
3. Paranoia
4. Duel

Then connect remaining families as their shared authoritative flows are completed/verified.

## Corrected special-card mechanics source status

The shared engine now has source-verified coverage for the previously incomplete corrected-rules slices:

- Chaos approved catalogue slices: Blind Swap and Reverse Order;
- Truth or Chaos consensus-match success and mismatch group-punishment state;
- Hijack authoritative player-order swap;
- Machiavelli six-option path, including Paranoia Spreads generated-card restriction;
- Paranoia Classic Keep Secret Draw 1;
- Ghost arm/activate/two-own-turn normal-draw suppression lifecycle;
- narrow Truth/Dare Nope, including selected-target Nope;
- Web/Telegram live clients submit Ghost/Nope through shared `projectDecisionCapabilities()` option IDs.

Still unresolved by `Game_rules.md` and therefore not invented:

- additional Chaos effects beyond Blind Swap and Reverse Order;
- whether Truth or Chaos or any non-Truth/Dare family can be Noped;
- whether Ghost suppresses mandatory penalty draws.

## Cleanup / convergence after mechanics are stable

- remove the obsolete legacy local deck authority once the board consumes shared CHAOS Pulse;
- make every visible gameplay button map to one implemented command;
- remove duplicate command aliases and stale variants;
- derive enabled/disabled controls from authoritative legal state;
- remove client-local rule implementations made obsolete by shared ownership;
- add deterministic complete-turn tests for every family;
- verify reconnect/timeout behavior against authoritative state;
- keep Telegram synchronized at the contract/state level without diverting from Web-first stabilization.

## Validation rules

For source changes, run where available:

```text
git diff --check
npm run typecheck
npm run build:web
npm test
```

Known asset failures must be kept separate from gameplay regressions.

Runtime-affecting work is not accepted until manually verified in the browser/live Web app.

## Staging/auth work — separate track

Do not silently mark these complete while working on gameplay:

- live Web smoke proof
- Telegram raw-`initData` live proof
- browser Telegram OIDC live proof
- same Telegram human -> same internal UUID across both clients
- shared profile write/read proof through Railway PostgreSQL

## Current roadmap

Current recovery order after the completed documentation and authority-hardening slices:

1. **DOC-REBASELINE-1 + preservation correction** — COMPLETE.
2. **RECOVERY-HARDEN-1 — Live room concurrency** — COMPLETE / PUBLISHED.
3. **Whole-project preservation rule + publication-state reconciliation** — COMPLETE / PUBLISHED.
4. **RECOVERY-HARDEN-2 — authoritative server-projected Live gameplay capabilities** — COMPLETE / PUBLISHED; exact implementation/test candidate `812acce7356c22336bb41e0e77f02893a3d4c771` is green in CI run `35661725013`.
5. **Next hardening slice — OWNER SELECTION REQUIRED.** Remaining candidates are:
   - command-ID persistence replay/collision reconciliation;
   - REST gameplay-command authority vs stale socket/action-registry metadata;
   - Truth-or-Chaos completion hardening, but only after the unresolved owner rule decisions are explicitly settled.
6. **Whole-product ownership/dependency audit** — mandatory before broad deletion/migration decisions across apps/packages/unmigrated verticals.
7. **AUTHORITY-GUARD-1** — deferred until the currently known authority contradictions are reconciled; direction remains recorded in `docs/CHANGE_GOVERNANCE.md`.
8. **Subsequent owner-approved product phases** — restore/migrate the complete product verticals, verify real Telegram Mini App runtime, tune mechanics/pacing, then finalize art and deployment/release work.

Every phase must preserve the existing contract: one complete application, two delivery surfaces, gameplay authority in the server/shared engine boundary, one PostgreSQL database, and `Game_rules.md` as the only gameplay meaning.

## Current Next Task

**No implementation task is currently authorized after RECOVERY-HARDEN-2.** The owner must choose the next hardening slice. Do not start `AUTHORITY-GUARD-1` automatically.

## Historical note — superseded roadmap text

The previous "Phase 7 — full local verification is active / Phase 8 — live Railway deployment after approval" wording described the state before the recovery slices above and is superseded. Deployment and readback still require explicit owner approval, and the current authorized sequence is the roadmap above, not Phase 7/8.

# Product Scope

Cribbit CHAOS is one product with two client surfaces, not a card table with a chat app bolted on.
This document preserves the whole-product scope so unmigrated capabilities are never mistaken for dead ones.

Authority order: explicit current owner decisions, then `Game_rules.md` for gameplay meaning.
This document describes scope and ownership only; it never defines gameplay behaviour.

## Product surfaces

```text
Cribbit CHAOS
  Web browser client (apps/web)            Telegram Mini App (apps/telegram)       -> one API -> one PostgreSQL -> one shared engine
  Node API + realtime (apps/api)
  Admin Control Room (planned control plane, see docs/ADMIN_CONTROL_ROOM.md)
```

## Capability map with preservation classification

| Capability | Where it lives | Classification | Notes |
|---|---|---|---|
| Live multiplayer room lifecycle (create, join, start) | `apps/api/src/app.ts`, `apps/api/src/game-service.ts` | ACTIVE | Verified locally end to end; started rooms reject new members; no fabricated bots |
| Authoritative gameplay (commands, legality, effects, timers, winner) | `packages/game-engine`, `packages/contracts` | ACTIVE | Sole gameplay authority; rule meaning owned by `Game_rules.md` |
| Persistent session/command/event storage | `db/migrations`, `apps/api/src/db.ts` | ACTIVE | `game_sessions`, `game_commands`, `game_events` |
| Realtime transport | `apps/api/src/app.ts` (Socket.IO), `packages/api-client` | ACTIVE | Invalidation channel only: `room-updated`, `room-started`, `session-updated` |
| Accounts, identity linking, Web login, Telegram auth | `apps/api/src/db.ts`, `apps/api/src/identity-linking.ts`, `web-auth.ts`, `identity-link-ui.ts` | ACTIVE | One canonical `users.id`; Telegram-only and Web-only accounts are both valid |
| Local QA Simulation | `packages/simulation`, `apps/web/src/simulation-mode.ts`, `apps/telegram/src/simulation.ts` | ACTIVE (QA surface) | `#startGameButton` on Web is QA Simulation, not Live host Start |
| Page navigation and shared UI shell | `packages/ui/src/navigation-controller.ts`, `packages/ui/src/template.html`, `packages/ui/src/styles.css`, `packages/ui/src/bootstrap.ts` | ACTIVE | Presentation only: one structural product bar (three zones, per-breakpoint canonical height), page switching, mobile drawer navigation, locally persisted dark/light appearance, and a `?diagnostics=1` QA surface kept outside the bar |
| Live safety controls (Pass / Rewind / Nope / Flag) | Web live rail, engine command path | ACTIVE (Live only) | Not wired into local Simulation |
| Card art, card back, board presentation | `packages/cards`, `apps/web/src/*.css`, `apps/telegram/src/cardRenderer.ts` | ACTIVE (provisional) | Final art polish is deliberately deferred by product priority |
| Prompt library, prompt creation/save, room prompt pool | intended API + `prompts`, `saved_prompts`, `room_prompt_pool`, `prompt_flags` | UNMIGRATED | Routes reply `501` (`PROMPTS_NOT_MIGRATED`, `SAVED_PROMPTS_NOT_MIGRATED`, `PROMPT_POOL_NOT_MIGRATED`) |
| Answers and recaps/history | intended API + `answers`, `recaps` tables | UNMIGRATED | No persistence SQL in `apps/api/src` yet; in-memory social flow only |
| Notifications | intended API | UNMIGRATED | `GET /v1/me/notifications` replies `501 NOTIFICATIONS_NOT_MIGRATED` |
| Moderation queue | intended API | UNMIGRATED | `POST /v1/moderation/submissions/:id/advance` replies `501 MODERATION_NOT_MIGRATED` |
| Admin Control Room | not implemented | UNMIGRATED | Future control plane; never a gameplay authority |
| Telegram Mini App Live gameplay | `apps/telegram/src/backendGame.ts` | UNMIGRATED / NOT VERIFIED | Contract- and state-compatible; no verified Mini App runtime in this environment |
| Room configuration (room setup) | `packages/contracts`, `apps/api/src/game-service.ts`, `rooms.config` | ACTIVE | Canonical server state; host-only `PATCH /v1/rooms/:roomId/config`; frozen at Start (ROOM-CONFIG-1) |
| Browser Telegram Web Login / OIDC | `GET /v1/auth/telegram/web/*` | UNMIGRATED (fails closed) | Endpoints reply `503`/`501`; a browser cookie alone is never authority |
| Legacy canonical Web board runtime | `packages/legacy-runtime`, `reference/approved-v4-template.html` | COMPATIBILITY REFERENCE | Reachable only through the fixture-preview `runtimeMode: 'legacy-compatibility'` branch |
| `apps/web/src/canonical-game-runtime.ts` | `apps/web/src` | UNKNOWN — PRESERVE | Zero importers and not part of the active authoritative runtime path. Removal is not authorized until ownership, historical product purpose, and migration/replacement status are proven. |
| Card-system migration tooling and mapping audits | `docs/card-system-*`, `docs/cleanup-manifest.*` | COMPATIBILITY REFERENCE | Historical migration evidence |
| Old Bible / flyers / approved V4 template / old UI assets | `reference/approved-v4-template.html`, product history | COMPATIBILITY REFERENCE | Product-history evidence only, never gameplay authority |
| Audio comments / sound effects | not implemented | UNMIGRATED | Product priority: only after gameplay events are stable |

## Product invariants

- One account model: canonical `users.id`; providers attach to it; unrelated accounts are never merged.
- One room/session model; never a Web game synchronized with a Telegram game.
- Live rooms contain real authenticated members only.
- Simulation is a separate local/bot QA mode and never defines Live behaviour.
- The card table is one capability of the product, not the whole product: accounts, rooms, prompts, answers, recaps/history, moderation and the future control plane are all in scope and remain in scope while unmigrated.
- Unmigrated is not dead: nothing may be deleted or reclassified as dead merely because it is not wired yet. See the preservation classifications in `docs/CHANGE_GOVERNANCE.md`.

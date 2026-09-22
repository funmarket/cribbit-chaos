# Button Map

Ownership of every UI control: which controls mutate gameplay, which call the API, which are client-local, and which are QA/dev-only. This file records wiring that has actually been verified in source; it must not describe wiring nobody has implemented.

## Machine-readable source

- `docs/button-audit.json` — output of `npm run audit:ui`.
- `packages/action-registry/src/index.ts` — the action -> backend-class assignment table.

Current audit result:

```text
production source          packages/ui/src/template.html + active client sources (apps/web/src, apps/telegram/src)
compatibility source       packages/legacy-runtime/src/runtime.ts (fixture preview only)
static buttons             103
actions discovered         56
actions assigned           57
missing assignments        0
unclassified buttons       0
buttons without type       0
duplicate ids              0
inline handlers            0
```

Re-run `npm run audit:ui` after any shared-UI change; the audit is a gate, not decoration.

## Backend classes (`packages/action-registry`)

| Class | Meaning |
|---|---|
| `game-command` | Mutates gameplay. Must reach the authoritative engine through the API command path (`POST /v1/games/:sessionId/commands`). |
| `rest` | Mutates or reads domain data through a REST route (rooms, prompts, moderation, identity). |
| `realtime` | Uses the realtime channel. In Cribbit CHAOS realtime is a change-intent channel; authoritative state is refetched. |
| `client-only` | Presentation only: tabs, dialogs, layout, local drafts, display of already-authorized state. Never gameplay authority. |
| `dev-only` | QA/dev surfaces: fixture cycling, local QA log reset. Never part of product behaviour. |

Mapping policy (also recorded in `docs/button-audit.json`):

- gameplay mutations map to the authoritative `game-command` class (REST `POST /v1/games/:sessionId/commands`); `realtime` carries change intent/invalidation only and never a gameplay mutation;
- navigation, tabs, dialogs, filters and display-only controls map to `client-only`;
- backend-reserved actions stay registered so no control is mistaken for a missing route;
- gameplay transport is verified single and REST-only (RECOVERY-HARDEN-4): `packages/api-client` exposes exactly one gameplay command sender and `packages/action-registry` marks only `backendClass:'realtime'` entries as `method:'WS'`.

## Surface classification

### ACTIVE product surfaces (Web Live and account flows)

| Surface | Control | Backend class | Notes |
|---|---|---|---|
| Room lifecycle | create room, join by code, host start | `rest` | `POST /v1/rooms`, `POST /v1/rooms/join`, `POST /v1/rooms/:roomId/start` |
| Gameplay | play card, draw, choose Wild colour, answer-mode, complete flow, Nope reaction, Ghost activation, social targets/votes | `game-command` | Authoritative engine path only |
| Live safety controls | Pass / Rewind / Nope / Flag | `game-command` | Live only; not wired into local Simulation |
| Account | register, login, logout, profile update, Telegram onboarding, link code, Web credential attach | `rest` | One canonical `users.id`; linking is explicit |
| Navigation and layout | page navigation, dialogs, drawers, filters | `client-only` | `packages/ui/src/navigation-controller.ts` |

### QA/local surfaces (not product behaviour)

| Surface | Control | Class | Notes |
|---|---|---|---|
| Web local QA Simulation | `#startGameButton` | `client-only` | Locked product decision: local QA Simulation, **not** Live host Start; runs `packages/simulation` in memory |
| Visual fixture preview | fixture cycling, QA log reset | `dev-only` | `?compat=1&fixture=1` on Telegram boots the fixture preview through `runtimeMode: 'legacy-compatibility'` |

### UNMIGRATED surfaces (registered, backend answers 501 or is absent)

| Surface | Expected route | Current state |
|---|---|---|
| Prompt library create/read | `POST /v1/prompts`, `GET /v1/prompts/:promptId` | `501 PROMPTS_NOT_MIGRATED` |
| Save prompt | `POST /v1/prompts/:promptId/save` | `501 SAVED_PROMPTS_NOT_MIGRATED` |
| Room prompt pool add/remove | `POST`/`DELETE /v1/rooms/:roomId/prompt-pool/:promptId` | `501 PROMPT_POOL_NOT_MIGRATED` |
| Moderation advance | `POST /v1/moderation/submissions/:submissionId/advance` | `501 MODERATION_NOT_MIGRATED` |
| Notifications | `GET /v1/me/notifications` | `501 NOTIFICATIONS_NOT_MIGRATED` |
| Admin Control Room | not implemented | See `docs/ADMIN_CONTROL_ROOM.md` |

### UNKNOWN — PRESERVE

- Controls that exist only inside `packages/legacy-runtime/src/runtime.ts` and are reachable only through the fixture-preview branch have not been individually re-verified against current product intent. Preserve; do not delete; do not document them as product behaviour.

## Production wiring authority vs legacy fixture controls

Production control authority belongs to the active product surfaces and their shared tables:

- `packages/action-registry/src/index.ts` — the action -> backend-class assignment table used by production controls;
- active client/runtime source — `apps/web/src/{main,live-entry,live-session,simulation-mode}.ts`, `apps/telegram/src/{bootstrapTelegram,backendGame,gameView,simulation}.ts`;
- `packages/ui/src/template.html` — the shared UI template those clients boot.

`packages/legacy-runtime/src/runtime.ts` is **fixture compatibility only**: it is reachable through the Telegram fixture preview (`?compat=1&fixture=1`, `runtimeMode: 'legacy-compatibility'`) and is not production Web boot — production Web boots `runtimeMode: 'none'` in `apps/web/src/main.ts`. Controls that exist only there stay `UNKNOWN — PRESERVE` and must never be documented as production behaviour.

Room setup controls are production controls: they are host-only and publish to the canonical room-config route `PATCH /v1/rooms/:roomId/config` through `packages/api-client`; the server validates and the room projection is refetched (`room-updated`). A non-host has no authoritative config mutation, and local Simulation keeps its own draft without persisting anything (ROOM-CONFIG-1).

## Rules for UI work

1. Every visible gameplay control must map to one implemented, authoritative command; never implement gameplay locally in a client.
2. Disabled/enabled state must derive from the authoritative projection, not from client-side rule reimplementation.
3. New controls require an action-registry entry and a re-run of `npm run audit:ui`.
4. Do not invent wiring in this document: if a surface has not been verified in source or runtime, list it as `UNKNOWN — PRESERVE`.

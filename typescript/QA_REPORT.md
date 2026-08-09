# Cribbit CHAOS Phase 2 — QA / backend ownership audit

Audit date: 2026-08-09

## Static UI coverage

- 103 static buttons inspected.
- 103/103 buttons have explicit `type` attributes.
- 0 duplicate HTML IDs.
- 0 inline `onclick`/similar event handlers.
- 0 unclassified static buttons.
- 56 runtime action names discovered from the V4 template/runtime including dynamic target actions.
- 0 discovered runtime actions without an explicit production ownership assignment.
- Every action is classified as `game-command`, `rest`, `realtime`, `client-only`, or `dev-only` in `packages/action-registry`.
- Full mapping is in `BUTTON_BACKEND_MAP.md`.

## Type / source checks

- Shared/client/server TypeScript source passes `tsc -p tsconfig.check.json --noEmit` in this environment using dependency shims because the container registry does not provide all npm packages.
- `node scripts/audit-ui.mjs` passes.
- The V4 compatibility game engine now fails closed if accidentally called as the production reducer (`ENGINE_NOT_MIGRATED`) rather than returning fake success.

## Telegram hardening

- Telegram JS bridge is loaded only by the Telegram client.
- Raw `Telegram.WebApp.initData` is sent to the backend for validation; `initDataUnsafe` remains display-only.
- Railway-side validator implements Telegram's HMAC-SHA-256 validation and checks `auth_date` age.
- Telegram user identity maps into an internal Cribbit UUID via PostgreSQL `user_identities`.
- Telegram safe-area/content-safe-area and changing viewport height are reflected into CSS variables.
- BackButton, closing confirmation, haptics, `start_param`, and Telegram fullscreen are separated behind the platform adapter.
- Fullscreen button now uses the platform adapter, so Telegram does not incorrectly rely on the browser Fullscreen API.

## Vercel / monorepo hardening

- Two deployable Vite clients remain separate: `apps/web` and `apps/telegram`.
- Both share the same TypeScript packages and the same Railway API/database contracts.
- Vite configs no longer rely on ESM-unsafe `__dirname`; they use `import.meta.url`.
- Vite dev server explicitly allows the shared monorepo source root.
- Each Vercel app has SPA rewrites and a deterministic build command.
- Root npm workspaces and uniquely named packages are present for monorepo dependency tracking.

## Railway / PostgreSQL hardening

- Railway server scaffold uses Fastify + Socket.IO.
- Socket.IO client scaffold exists in `packages/api-client` and uses the same realtime path.
- Railway PostgreSQL schema includes users, identities, auth sessions, rooms, room members, game sessions, idempotent commands, game events, prompts, room pools, flags, answers and recaps.
- Telegram and web guest identities both create internal users in the same PostgreSQL database.
- Browser clients never receive `DATABASE_URL` or `TELEGRAM_BOT_TOKEN`.
- `railway.toml` includes server start command and `/health` health check.

## Layout / banner hardening

The approved V4 responsive layout remains the visual source of truth. Additive Telegram-only CSS now accounts for safe-area/content-safe-area margins and Telegram viewport height, reduces mobile header/game spacing, and avoids putting controls beneath Telegram/system UI.

The current execution container's Chromium binary does not successfully complete even a trivial headless screenshot, so a fresh rendered screenshot matrix could not be produced here. No broad redesign was made during this audit; the already-approved V4 responsive CSS was preserved and only platform-safe overrides were added.

## Production blocker still intentionally open

The 2,700-line V4 compatibility runtime still performs simulated game rules locally. Routes, database ownership, transport, authentication and every button's backend destination are now defined, but the authoritative Railway game reducer is **not** enabled yet. `/v1/games/:sessionId/commands`, snapshots, start and rematch fail closed with `ENGINE_NOT_MIGRATED` until Phase 3 extracts the rules into `packages/game-engine` and deterministic transition tests pass.

This is intentional. An incomplete server must never claim a play/draw/Nope/Truth/Dare mutation succeeded.

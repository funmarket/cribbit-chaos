# Telegram

The Telegram Mini App is a Vercel-hosted client that shares the same backend, realtime channel, and PostgreSQL database as the web client.

Security boundary:

- `initDataUnsafe` is display-only
- raw Telegram `initData` must be validated by `apps/api`
- authentication must not be established inside the client bundle

The adapter already covers the Telegram WebApp lifecycle pieces used by this repo, including ready state, viewport tracking, safe-area handling, fullscreen, BackButton, close confirmation, haptics, start parameters, and raw `initData` access.

When building Telegram UI, keep the approved V4 visual language and respect safe-area/content-safe-area constraints.

# Telegram

This is a living Telegram integration document. Update it whenever the Mini App host, BotFather configuration, authentication flow, safe-area behavior, or staging proof changes.

The Telegram Mini App primary live client is hosted on Cloudflare Pages:

- `https://cribbit-chaos-telegram.pages.dev`

It shares the same Railway API, realtime channel, PostgreSQL database, internal account model, design system, and shared packages as the Web client.

Cloudflare Pages is the only current Telegram Mini App frontend host documented for staging.

## Security boundary

- `initDataUnsafe` is display-only
- raw Telegram `initData` must be validated by `apps/api`
- authentication must not be established inside the client bundle
- `TELEGRAM_BOT_TOKEN` must live only in Railway server configuration
- browser Web authentication uses Telegram OIDC and is a separate flow from Mini App `initData`

## Current primary flow

```text
Telegram Mini App on Cloudflare Pages
-> raw Telegram.WebApp.initData
-> Railway API
-> server-side validation
-> lookup Telegram identity in user_identities
-> existing canonical users.id OR explicit unlinked/onboarding response
-> explicit register/link action when needed
-> Railway PostgreSQL
```

The adapter already covers the Telegram WebApp lifecycle pieces used by this repo, including ready state, viewport tracking, safe-area handling, fullscreen, BackButton, close confirmation, haptics, start parameters, and raw `initData` access.

When building Telegram UI, keep the approved V4 visual language and respect safe-area/content-safe-area constraints.

## Current staging state

Completed:

- original Cloudflare Telegram production project remains live on production branch `feature/visual-integration-checkpoint`; recovery branch is NOT deployed
- client points to the shared Railway API/WS URL
- Railway accepts the exact Cloudflare Telegram origin
- shared identity/database foundation exists server-side

Still pending:

- configure a regenerated `TELEGRAM_BOT_TOKEN` in Railway only
- set BotFather Main Mini App URL to `https://cribbit-chaos-telegram.pages.dev`
- perform live Telegram Mini App visual smoke test
- perform live raw-`initData` authentication proof
- prove the same Telegram account resolves to the same internal UUID as browser Web

After each Telegram-related implementation slice, synchronize this file, `HANDOFF.md`, `docs/LIVING_STATUS.md`, `PLAN.md`, `docs/shared-auth-staging.md`, and `docs/DEPLOYMENT.md`. Update a PR description only if an active PR exists.

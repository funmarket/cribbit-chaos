# Architecture lock

```text
Telegram Mini App ----\
                       > Shared UI + typed contracts ---> Railway authoritative game server ---> PostgreSQL
Vercel Web App -------/
```

## Trust boundaries

- UI is never authoritative for game state.
- Telegram `initData` is validated server-side.
- `initDataUnsafe` is presentation-only.
- Vite `VITE_*` variables are public client configuration only.
- PostgreSQL is never accessed directly from either browser client.
- Mutating game commands require command IDs and expected revisions for idempotency.

## Runtime migration rule

The approved V4 HTML is the visual reference. The isolated compatibility runtime must shrink over time. New backend-ready features belong in typed packages, not in the legacy runtime.

# Deployment

Cribbit CHAOS has three live deployment surfaces:

- `apps/web` on Vercel
- `apps/telegram` on Vercel
- `apps/api` on Railway

The database lives on Railway PostgreSQL and is shared by both clients.

Before deploying, run the relevant build checks:

```sh
npm run build:web
npm run build:telegram
npm run build:api
```

Use the root `README.md`, `docs/ENVIRONMENT.md`, `docs/TELEGRAM.md`, and `docs/TESTING.md` for the operational details that used to live in the older setup pages.

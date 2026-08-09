# Railway setup

Deploy `apps/api` from the repository root. Validate with `npm run build:api`; start with `npm run dev:api` (the existing Fastify/tsx entrypoint). Provide `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, session/JWT secrets, allowed frontend origins, and `PORT`. The service binds to `0.0.0.0` and exposes `/health`. A bundled JavaScript API artifact is intentionally deferred until the `.ts`-extension ESM imports are migrated as a separate backend build task.

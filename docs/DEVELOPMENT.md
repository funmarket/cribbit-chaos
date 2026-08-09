# Development

Install dependencies with `npm install`.

Run the local surfaces with:

```sh
npm run dev:web
npm run dev:telegram
npm run dev:api
```

Run the shared checks before committing:

```sh
npm run typecheck
npm run test
npm run build
npm run audit:ui
```

Do not place server secrets in Vite environment variables.

If you are changing shared packages, rerun the full build matrix from `docs/TESTING.md`.

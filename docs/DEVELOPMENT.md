# Development


Current recovery work is controlled on `recovery/single-engine-authority`. The verified parent before the current documentation rebaseline is `625f0ade6889a97a8577eebe3682879f1819ee8a`. Do not assume an old PR or historical branch is the active work surface.

This is a living development-control document. Development work is not complete until affected project-control documentation is synchronized with the verified implementation/runtime state.

Install dependencies with:

```sh
npm install
```

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

## Controlled implementation slice

For every implementation slice:

1. verify the active controlled GitHub branch head before writing
2. make only the scoped implementation changes
3. run the relevant checks and do not overstate results
4. verify affected deployment/runtime state when the task changes deployment behavior
5. update `PLAN.md` and every affected `.md` reference
6. remove resolved blockers and obsolete instructions
7. update any active PR description if a PR actually exists and its scope/status/blockers changed
8. keep `HANDOFF.md`, `docs/LIVING_STATUS.md`, and `PLAN.md` synchronized to exactly one current task / authorization state

If documentation and verified reality disagree, documentation must be corrected before starting another implementation slice.

Current frontend staging is Cloudflare Pages; Railway owns API/PostgreSQL; GitHub is the source of truth.

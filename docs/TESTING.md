# Testing

Run the repository checks in this order when validating shared changes:

```sh
npm run typecheck
npm run test
npm run build:web
npm run build:telegram
npm run build:api
```

`npm run build` wraps the three build commands.

`npm run audit:ui` verifies the shared button/action registry.

The current test runner includes substantive gameplay coverage and shared visual checkpoint coverage. Run the full suite before changing shared packages.

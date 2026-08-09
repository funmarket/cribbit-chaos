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

The current test runner succeeds, but substantive game tests are not implemented yet. That is the next milestone after the authoritative reducer lands.

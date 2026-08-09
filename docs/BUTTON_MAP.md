# Button Map

The shared UI audit found 103 static buttons, 56 literal actions, and 57 registry assignments. There are no missing assignments, unclassified buttons, buttons without an explicit type, duplicate IDs, or inline event handlers.

Mapping policy:

- gameplay mutations map to `SERVER_COMMAND` or `REALTIME`
- navigation, tabs, dialogs, filters, and display-only controls map to `CLIENT_UI`
- backend-reserved actions remain registered and are not treated as local gameplay authority

`button-audit.json` is the machine-readable audit output. Re-run `npm run audit:ui` after changing the shared UI.

# Button and action audit

Audited sources: `packages/ui/src/template.html`, `packages/legacy-runtime/src/runtime.ts`, and `packages/action-registry/src/index.ts`.

The audit found 103 static buttons, 56 literal actions, and 57 registry assignments. There are no missing assignments, unclassified buttons, buttons without an explicit type, duplicate IDs, or inline event handlers.

Mapping policy:

- gameplay mutations map to `SERVER_COMMAND` or `REALTIME`; the API explicitly returns `ENGINE_NOT_MIGRATED` until the authoritative reducer is migrated
- navigation, tabs, dialogs, filters, and display-only controls map to `CLIENT_UI`
- backend-reserved actions remain registered and are not treated as local gameplay authority

Machine-readable results are in `button-audit.json`. Re-run `npm run audit:ui` after changing the shared UI.

# Admin Control Room

Scope and boundary of the operator surface. It is **not** a gameplay authority and **not** a domain authority.

## What it is

The Control Room is the planned operator/administrator control plane for the product: moderation, content management, account support, room/session observability and operational health. It is a *client of the API*, exactly like Web and Telegram.

## What it is not

- Not a game engine and not a legality authority. It never decides plays, effects, timers, prompt eligibility or winners.
- Not a second backend. It must not introduce a platform-specific service, a second database, or direct PostgreSQL access.
- Not a bypass. Administrative mutations must go through authorized API routes with role gating and an audit trail; never raw SQL against production.
- Not rule authority. Gameplay meaning stays in `Game_rules.md`.

## Intended boundary

```text
Control Room (operator client)
        |
        v
authorized API routes (role-gated, audited)
        |
        v
domain services -> PostgreSQL        gameplay routes -> shared engine
```

## Current verified state: UNMIGRATED

- No Control Room UI exists in `apps/`.
- The only moderation-adjacent API route, `POST /v1/moderation/submissions/:submissionId/advance`, replies `501 MODERATION_NOT_MIGRATED`.
- The schema has no administrative-role, submission or audit tables; `db/migrations/` defines user, session, room, game, prompt and identity tables only.
- `GET /v1/me/notifications` replies `501 NOTIFICATIONS_NOT_MIGRATED`.

Planning notes (not implementation):

- role/permission model for operators, stored with the canonical `users.id` identity — never a parallel account table;
- audit trail for every administrative mutation state change;
- prompt-library and room prompt-pool management on top of the unmigrated prompt verticals;
- live room/session observability read-only first, mutations only after the governance model exists;
- no secrets or player private data in operator surfaces beyond what the product rules permit.

Implementation requires explicit owner authorization and must not begin from this document.

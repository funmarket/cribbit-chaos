# Cribbit Chaos Dual-Authentication Verification

Date: 2026-08-21

## Source head validated

Authentication implementation was validated on branch `feature/visual-integration-checkpoint`.

The source-level verification head before this report was:

`f6b87dd4a1f1ffbf4e39da99bb8726eed2555117`

GitHub Actions CI run `32505680189` / run number `627` completed successfully.

## Executed checks

The actual CI jobs executed with Node 24.7.0 and all passed:

- `npm ci` — passed in every CI job
- `npm run typecheck` — passed
- `npm test` — passed
- `npm run build:web` — passed
- `npm run build:telegram` — passed
- `npm run build:api` — passed

The root test command includes the new Web password/authentication tests as well as the existing card/game/API tests.

## Authentication tests covered

Automated tests prove:

- repeated Telegram identity resolves to one canonical user
- valid Telegram Mini App fixture resolves through the canonical identity service
- invalid Telegram initData is rejected
- server session tokens are stored/compared by hash in the tested session contract
- valid Telegram bearer resolves `/v1/me`
- missing, malformed and expired auth are rejected
- Web registration returns a canonical user and HttpOnly session cookie
- Web registration does not return password or access token
- duplicate Web login username is rejected
- correct Web credentials sign in
- wrong password fails safely
- nonexistent username fails safely
- Web session cookie resolves the canonical user
- Web logout revokes the Web session
- matching-looking Telegram and Web usernames do not auto-link
- different simultaneous Telegram/Web users produce `AUTH_CONFLICT`
- both credentials for the same canonical user are accepted
- Web-cookie profile mutation writes through the canonical user ID
- Argon2id password encoding verifies the correct password and rejects a wrong password
- password policy rejects weak passwords
- migration source contains the Web credential uniqueness/canonical-user constraints

## Railway production API

Railway production API deployment:

`3c7f3241-9dd4-47da-910a-240db0df02db`

completed with `SUCCESS` from commit:

`b9e03f11a0c91a8b3cc873df714d017fb8009fcb`

Railway build evidence verifies:

- Railpack selected Node `24.19.0` from `package.json > engines > node (>=24.7.0)`
- npm `10.9.2`
- `npm ci && npm run build:api` passed
- dependency audit during the build reported `0 vulnerabilities`
- API container started successfully
- Railway `/health` healthcheck returned HTTP 200

The production API service is configured with:

```text
preDeployCommand: npm run migrate:db
buildCommand: npm ci && npm run build:api
startCommand: npm run start:api
healthcheckPath: /health
```

and its watch patterns include `db/migrations/**`.

### Migration truth label

`002_dual_web_auth.sql` was included in the successful API deployment source, and Railway is configured to run the migration runner before deploy. The Railway connector did not expose a pre-deploy log line showing the individual `002_dual_web_auth.sql` application, and it does not provide a SQL console in this environment.

Therefore:

**Production schema application is deployment-config supported but NOT independently SQL-query verified from this session.**

Do not reinterpret the successful API healthcheck as direct proof that every new authentication table was queried successfully.

## Cross-platform room source verification

Source inspection verifies that both authenticated frontend paths now target the same platform-neutral API:

```text
POST /v1/rooms
POST /v1/rooms/join
GET /v1/games/:sessionId/snapshot
POST /v1/games/:sessionId/commands
Socket.IO game:<sessionId>
```

The Web live-room bridge no longer treats the existing room-code control as a simulated join when joining a live room. Local Web gameplay remains available through the explicit `Start Simulation` path.

Telegram live commands now use a plain `crypto.randomUUID()` for `game_commands.command_id`, matching the PostgreSQL UUID column and removing the previously observed prefixed-command-ID persistence failure.

## Security properties verified in source

- one canonical `users.id`
- Telegram identities use existing `user_identities`
- Web credentials are stored separately in `web_credentials`
- no automatic Telegram/Web account merging
- Web password hashing uses Argon2id
- Web raw session token is sent only as an HttpOnly cookie
- Web API client does not store the Web session token in JavaScript/localStorage/sessionStorage
- Telegram continues using its verified bearer-session path
- cookie-authenticated mutations enforce configured origin checks
- credentialed CORS uses explicit configured origins rather than wildcard credentials
- simultaneous differing Web/Telegram principals are rejected with `AUTH_CONFLICT`

## Not yet runtime verified

The following are still manual/live verification items and are **not** claimed as passed:

1. Register a real Web user in the deployed Cloudflare Web build.
2. Close/reopen the browser and prove the HttpOnly Web session restores.
3. Create a live room from Web and join it from a real Telegram Mini App account.
4. Create a live room from Telegram and join it using an independently registered Web account.
5. Confirm both clients receive the same session revisions through realtime updates.
6. Play/draw from both clients and prove the command is persisted and reflected on the opposite frontend.
7. Confirm production PostgreSQL contains migration `002_dual_web_auth.sql` through a direct schema/migration query when database-console access is available.
8. Confirm the current feature-branch frontend bundles are deployed to the intended Cloudflare Pages Web and Telegram environments.

These are deployment/runtime signoff items, not reasons to duplicate or bypass the implemented authentication architecture.

## Known separate game-engine parity boundary

Dual authentication does not claim to solve the already-known shared-engine migration gap for every newer special-card family. Web live rooms and Telegram live rooms deliberately use the shared authoritative backend engine. The richer local Web compatibility simulation remains separate until those rule handlers are migrated centrally.

# Browser Telegram auth handoff

Cribbit CHAOS browser login must never place the Cribbit bearer session token in a redirect URL.

The production browser flow is:

1. Web asks the Railway API to start Telegram login.
2. Railway creates the Telegram authorization request and preserves the login-flow state server-side.
3. Telegram redirects to the Railway callback.
4. Railway validates the Telegram response and resolves the canonical Cribbit user through `resolveOrCreateTelegramIdentity()`.
5. Railway creates a short-lived, single-use opaque handoff code. This code is not a Cribbit API session token.
6. Railway redirects to the approved Web Vercel return URL with only the opaque handoff code.
7. Web sends the handoff code back to Railway over HTTPS.
8. Railway atomically consumes the handoff code and returns the Cribbit bearer session token in the response body.
9. Web stores the bearer session token in `sessionStorage` and calls `/v1/me`.

The handoff code must be short-lived, single-use, bound to the login flow, and rejected after redemption or expiry. If persisted, only a hash of the handoff code should be stored. It must never be accepted as a normal bearer token.

Until this flow is implemented and live-verified, Web Telegram login remains incomplete and must fail closed.

## Railway boundary

All Cribbit CHAOS auth/backend resources belong only to Railway project `Cribbit Chaos` (`e2b0a674-43d9-4aac-ad8d-3e72b3ff486f`). The separate Railway project `Cribbit` (`1440dc2c-e7fd-4bee-8ef7-57e663b8c735`) belongs to another product and must not be modified for this project.

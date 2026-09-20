-- Purpose-separated identity-link challenge persistence.
--
-- auth_sessions represents authenticated login sessions only. An identity-link
-- challenge is a different security artifact: short-lived, single-use, purpose
-- tagged, bound to the canonical user that requested the link, and never
-- resolvable by the login-session reader.
--
-- The challenge secret is stored only as a cryptographic hash.

CREATE TABLE IF NOT EXISTS identity_link_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text UNIQUE NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('telegram-link','telegram-web-link')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identity_link_challenges_user_idx
  ON identity_link_challenges(user_id, expires_at);

CREATE INDEX IF NOT EXISTS identity_link_challenges_pending_idx
  ON identity_link_challenges(purpose, expires_at)
  WHERE consumed_at IS NULL;

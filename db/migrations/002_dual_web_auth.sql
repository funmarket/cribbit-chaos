-- Dual authentication foundation for Cribbit Chaos.
-- Keeps users.id as the single application identity and adds Web credentials
-- without changing existing Telegram identity ownership.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_username text,
  ADD COLUMN IF NOT EXISTS display_username_normalized text;

CREATE UNIQUE INDEX IF NOT EXISTS users_display_username_normalized_uq
  ON users(display_username_normalized)
  WHERE display_username_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS web_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  login_username text NOT NULL,
  login_username_normalized text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  password_changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_credentials_email_idx
  ON web_credentials(lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE TABLE IF NOT EXISTS web_login_throttle (
  login_username_normalized text NOT NULL,
  ip_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(login_username_normalized, ip_hash)
);

CREATE INDEX IF NOT EXISTS web_login_throttle_blocked_idx
  ON web_login_throttle(blocked_until)
  WHERE blocked_until IS NOT NULL;

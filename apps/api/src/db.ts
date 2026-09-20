import pg from 'pg';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthIdentitySummary, AuthUser } from '../../../packages/contracts/src/index.ts';
import { hashWebPassword, validateWebPassword, verifyAgainstCredentialOrDummy } from './web-password.ts';
import { decideTelegramIdentityLink, type IdentityLinkOutcome } from './identity-linking.ts';

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PGPOOL_MAX || 10) })
  : null;

export async function dbHealth(): Promise<boolean> {
  if (!pool) return false;
  try { await pool.query('select 1'); return true; } catch { return false; }
}

export async function withTransaction<T>(fn: (client:any)=>Promise<T>): Promise<T> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function hashSessionToken(token:string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createServerSession(userId:string, provider:'telegram'|'web'): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  await pool.query(
    `insert into auth_sessions (user_id, token_hash, provider, expires_at, last_used_at)
     values ($1,$2,$3,now() + interval '30 days',now())`,
    [userId, tokenHash, provider]
  );
  return token;
}

export async function revokeServerSession(token:string): Promise<void> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  await pool.query(
    `update auth_sessions set revoked_at=coalesce(revoked_at,now()) where token_hash=$1`,
    [hashSessionToken(token)]
  );
}

/**
 * Resolve a validated Telegram provider identity to its canonical user.
 * Read-only: it never provisions a user and never rewrites canonical profile presentation.
 * Only provider metadata (the Telegram username) is refreshed.
 */
export async function findTelegramIdentityUser(telegramId:string, providerUsername?:string): Promise<AuthUser | null> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return withTransaction(async client => {
    const existing = await client.query(
      `select u.id from user_identities i
       join users u on u.id=i.user_id
       where i.provider='telegram' and i.provider_user_id=$1
       for update`,
      [telegramId]
    );
    if (!existing.rowCount) return null;
    const userId = String(existing.rows[0].id);
    await client.query(
      `update user_identities set provider_username=$2 where provider='telegram' and provider_user_id=$1`,
      [telegramId, providerUsername || null]
    );
    // Canonical display name is intentionally untouched: provider metadata is not profile authority.
    const user = await client.query(`select id,display_name,display_username from users where id=$1`, [userId]);
    const identities = await client.query(
      `select provider,provider_username from user_identities where user_id=$1 order by provider,created_at`,
      [userId]
    );
    return {
      id:String(user.rows[0].id),
      displayName:String(user.rows[0].display_name),
      ...(user.rows[0].display_username ? { displayUsername:String(user.rows[0].display_username) } : {}),
      identities:identities.rows.map((row:any): AuthIdentitySummary => ({
        provider:row.provider,
        username:row.provider_username || undefined
      }))
    };
  });
}

/**
 * Explicit Telegram account creation: only call this from a deliberate create-account action.
 * It creates exactly one canonical user and attaches the validated Telegram identity to it.
 */
export async function createTelegramCanonicalUser(input:{ telegramId:string; displayName:string; username?:string }): Promise<AuthUser> {
  return withTransaction(async client => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`telegram:${input.telegramId}`]);

    const existing = await client.query(
      `select user_id from user_identities where provider='telegram' and provider_user_id=$1 for update`,
      [input.telegramId]
    );
    if (existing.rowCount) {
      throw Object.assign(new Error('That Telegram account is already linked to a Cribbit account.'), { code:'IDENTITY_ALREADY_LINKED', statusCode:409 });
    }

    const user = await client.query(
      `insert into users(display_name) values($1) returning id,display_name`,
      [input.displayName]
    );
    await client.query(
      `insert into user_identities(user_id,provider,provider_user_id,provider_username)
       values($1,'telegram',$2,$3)`,
      [user.rows[0].id, input.telegramId, input.username || null]
    );
    return {
      id:String(user.rows[0].id),
      displayName:String(user.rows[0].display_name),
      identities:[{ provider:'telegram', username:input.username }]
    };
  });
}

/**
 * Attach a Web credential to the caller's existing canonical user.
 * Never creates a users row and never rewrites canonical display presentation.
 */
export async function attachWebCredential(userId:string, input:{ loginUsername:unknown; password:unknown; displayUsername:unknown; email?:unknown }): Promise<AuthUser> {
  const loginUsernameNormalized = normalizeWebLoginUsername(input.loginUsername);
  const display = normalizeDisplayUsername(input.displayUsername);
  const email = normalizeOptionalEmail(input.email);
  const passwordHash = hashWebPassword(validateWebPassword(input.password));

  return withTransaction(async client => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`web-login:${loginUsernameNormalized}`]);
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`web-display:${display.normalized}`]);

    const owner = await client.query(`select id from users where id=$1 for update`, [userId]);
    if (!owner.rowCount) throw Object.assign(new Error('Canonical user not found.'), { code:'USER_NOT_FOUND', statusCode:404 });

    const alreadyAttached = await client.query(
      `select 1 from web_credentials where user_id=$1 limit 1`,
      [userId]
    );
    if (alreadyAttached.rowCount) {
      throw Object.assign(new Error('This Cribbit account already has a Web credential.'), { code:'IDENTITY_PROVIDER_ALREADY_LINKED', statusCode:409 });
    }

    const loginExists = await client.query(
      `select 1 from web_credentials where login_username_normalized=$1`,
      [loginUsernameNormalized]
    );
    if (loginExists.rowCount) {
      throw Object.assign(new Error('That login username is already registered.'), { code:'LOGIN_USERNAME_TAKEN', statusCode:409 });
    }

    const displayExists = await client.query(
      `select 1 from users where display_username_normalized=$1 and id<>$2`,
      [display.normalized, userId]
    );
    if (displayExists.rowCount) {
      throw Object.assign(new Error('That display username is already in use.'), { code:'DISPLAY_USERNAME_TAKEN', statusCode:409 });
    }

    await client.query(`update users set display_username=$2, display_username_normalized=$3, updated_at=now() where id=$1 and display_username is null`, [
      userId, display.value, display.normalized
    ]);

    const credential = await client.query(
      `insert into web_credentials(user_id,login_username,login_username_normalized,password_hash,email)
       values($1,$2,$3,$4,$5) returning id`,
      [userId, String(input.loginUsername).trim(), loginUsernameNormalized, passwordHash, email]
    );
    await client.query(
      `insert into user_identities(user_id,provider,provider_user_id,provider_username)
       values($1,'web',$2,$3)`,
      [userId, `credential:${String(credential.rows[0].id)}`, display.value]
    );
  }).then(() => loadAuthUser(userId));
}

/** Short-lived, single-use link challenge bound to one canonical user (stored in auth_sessions). */
export async function createIdentityLinkChallenge(userId:string, ttlSeconds = 600): Promise<{ code:string; expiresAt:string }> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const code = randomBytes(24).toString('base64url');
  const ttl = Math.max(60, Math.min(3600, Math.round(ttlSeconds)));
  const result = await pool.query(
    `insert into auth_sessions (user_id, token_hash, provider, expires_at, last_used_at)
     values ($1,$2,'web',now() + ($3 || ' seconds')::interval,now())
     returning expires_at`,
    [userId, hashSessionToken(identityLinkChallengeToken(code)), String(ttl)]
  );
  return { code, expiresAt:new Date(result.rows[0].expires_at).toISOString() };
}

/**
 * Consume a link challenge exactly once. Returns the canonical user it is bound to,
 * or null when the code is unknown, expired or already used.
 */
export async function consumeIdentityLinkChallenge(code:string): Promise<string | null> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return withTransaction(async client => {
    const row = await client.query(
      `select user_id from auth_sessions
       where token_hash=$1 and revoked_at is null and expires_at > now()
       for update`,
      [hashSessionToken(identityLinkChallengeToken(code))]
    );
    if (!row.rowCount) return null;
    await client.query(
      `update auth_sessions set revoked_at=now() where token_hash=$1`,
      [hashSessionToken(identityLinkChallengeToken(code))]
    );
    return String(row.rows[0].user_id);
  });
}

function identityLinkChallengeToken(code:string): string {
  // Namespaced so a link code can never be replayed as a server session token.
  return `identity-link:${code}`;
}


export async function createGuestIdentity(displayName='Web Player'): Promise<{id:string; displayName:string}> {
  return withTransaction(async client => {
    const user = await client.query(`insert into users(display_name) values($1) returning id,display_name`, [displayName]);
    const providerUserId = `guest_${randomBytes(16).toString('hex')}`;
    await client.query(
      `insert into user_identities(user_id,provider,provider_user_id) values($1,'web',$2)`,
      [user.rows[0].id,providerUserId]
    );
    return { id:String(user.rows[0].id), displayName:String(user.rows[0].display_name) };
  });
}

export function normalizeWebLoginUsername(value:unknown): string {
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Login username is required.'), { code:'INVALID_LOGIN_USERNAME', statusCode:400 });
  }
  const username = value.trim();
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
    throw Object.assign(new Error('Login username must be 3 to 32 letters, numbers, dots, underscores or hyphens.'), { code:'INVALID_LOGIN_USERNAME', statusCode:400 });
  }
  return username.toLowerCase();
}

export function normalizeDisplayUsername(value:unknown): { value:string; normalized:string } {
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Display username is required.'), { code:'INVALID_DISPLAY_USERNAME', statusCode:400 });
  }
  const displayUsername = value.trim();
  if (!/^[A-Za-z0-9_]{2,24}$/.test(displayUsername)) {
    throw Object.assign(new Error('Display username must be 2 to 24 letters, numbers or underscores.'), { code:'INVALID_DISPLAY_USERNAME', statusCode:400 });
  }
  return { value:displayUsername, normalized:displayUsername.toLowerCase() };
}

function normalizeOptionalEmail(value:unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Email must be a string.'), { code:'INVALID_EMAIL', statusCode:400 });
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Email address is not valid.'), { code:'INVALID_EMAIL', statusCode:400 });
  }
  return email;
}

function normalizeDisplayName(value:unknown, fallback:string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Display name must be a string.'), { code:'INVALID_DISPLAY_NAME', statusCode:400 });
  }
  const displayName = value.trim();
  if (!displayName || displayName.length > 40) {
    throw Object.assign(new Error('Display name must be 1 to 40 characters.'), { code:'INVALID_DISPLAY_NAME', statusCode:400 });
  }
  return displayName;
}

export interface WebRegistrationInput {
  loginUsername: unknown;
  password: unknown;
  displayUsername: unknown;
  displayName?: unknown;
  email?: unknown;
}

export async function registerWebUser(input:WebRegistrationInput): Promise<AuthUser> {
  const loginUsernameNormalized = normalizeWebLoginUsername(input.loginUsername);
  const display = normalizeDisplayUsername(input.displayUsername);
  const displayName = normalizeDisplayName(input.displayName, display.value);
  const email = normalizeOptionalEmail(input.email);
  const password = validateWebPassword(input.password);
  const passwordHash = hashWebPassword(password);

  return withTransaction(async client => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`web-login:${loginUsernameNormalized}`]);
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`web-display:${display.normalized}`]);

    const loginExists = await client.query(
      `select 1 from web_credentials where login_username_normalized=$1`,
      [loginUsernameNormalized]
    );
    if (loginExists.rowCount) {
      throw Object.assign(new Error('That login username is already registered.'), { code:'LOGIN_USERNAME_TAKEN', statusCode:409 });
    }

    const displayExists = await client.query(
      `select 1 from users where display_username_normalized=$1`,
      [display.normalized]
    );
    if (displayExists.rowCount) {
      throw Object.assign(new Error('That display username is already in use.'), { code:'DISPLAY_USERNAME_TAKEN', statusCode:409 });
    }

    const user = await client.query(
      `insert into users(display_name,display_username,display_username_normalized)
       values($1,$2,$3) returning id,display_name,display_username`,
      [displayName, display.value, display.normalized]
    );
    const userId = String(user.rows[0].id);
    const credential = await client.query(
      `insert into web_credentials(user_id,login_username,login_username_normalized,password_hash,email)
       values($1,$2,$3,$4,$5) returning id`,
      [userId, String(input.loginUsername).trim(), loginUsernameNormalized, passwordHash, email]
    );
    await client.query(
      `insert into user_identities(user_id,provider,provider_user_id,provider_username)
       values($1,'web',$2,$3)`,
      [userId, `credential:${String(credential.rows[0].id)}`, display.value]
    );

    return {
      id:userId,
      displayName:String(user.rows[0].display_name),
      displayUsername:String(user.rows[0].display_username),
      identities:[{ provider:'web', username:display.value }]
    };
  });
}

async function assertWebLoginAllowed(loginUsernameNormalized:string, ipHash:string): Promise<void> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const result = await pool.query(
    `select blocked_until from web_login_throttle
     where login_username_normalized=$1 and ip_hash=$2`,
    [loginUsernameNormalized, ipHash]
  );
  const blockedUntil = result.rows[0]?.blocked_until ? new Date(result.rows[0].blocked_until).getTime() : 0;
  if (blockedUntil > Date.now()) {
    throw Object.assign(new Error('Too many failed sign-in attempts. Try again later.'), { code:'AUTH_RATE_LIMITED', statusCode:429 });
  }
}

async function recordWebLoginFailure(loginUsernameNormalized:string, ipHash:string): Promise<void> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  await pool.query(
    `insert into web_login_throttle(login_username_normalized,ip_hash,window_started_at,failure_count,blocked_until,updated_at)
     values($1,$2,now(),1,null,now())
     on conflict(login_username_normalized,ip_hash) do update set
       failure_count = case
         when web_login_throttle.window_started_at < now() - interval '15 minutes' then 1
         else web_login_throttle.failure_count + 1
       end,
       window_started_at = case
         when web_login_throttle.window_started_at < now() - interval '15 minutes' then now()
         else web_login_throttle.window_started_at
       end,
       blocked_until = case
         when (case when web_login_throttle.window_started_at < now() - interval '15 minutes' then 1 else web_login_throttle.failure_count + 1 end) >= 5
           then now() + interval '15 minutes'
         else web_login_throttle.blocked_until
       end,
       updated_at=now()`,
    [loginUsernameNormalized, ipHash]
  );
}

async function clearWebLoginFailures(loginUsernameNormalized:string, ipHash:string): Promise<void> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  await pool.query(
    `delete from web_login_throttle where login_username_normalized=$1 and ip_hash=$2`,
    [loginUsernameNormalized, ipHash]
  );
}

export async function authenticateWebUser(input:{loginUsername:unknown; password:unknown; ipHash:string}): Promise<AuthUser | null> {
  const loginUsernameNormalized = normalizeWebLoginUsername(input.loginUsername);
  if (typeof input.password !== 'string') {
    throw Object.assign(new Error('Invalid username or password.'), { code:'INVALID_CREDENTIALS', statusCode:401 });
  }
  await assertWebLoginAllowed(loginUsernameNormalized, input.ipHash);
  if (!pool) throw new Error('DATABASE_URL is not configured.');

  const credential = await pool.query(
    `select user_id,password_hash from web_credentials where login_username_normalized=$1`,
    [loginUsernameNormalized]
  );
  const passwordHash = credential.rows[0]?.password_hash ? String(credential.rows[0].password_hash) : null;
  const valid = verifyAgainstCredentialOrDummy(input.password, passwordHash);
  if (!credential.rowCount || !valid) {
    await recordWebLoginFailure(loginUsernameNormalized, input.ipHash);
    return null;
  }

  await clearWebLoginFailures(loginUsernameNormalized, input.ipHash);
  return loadAuthUser(String(credential.rows[0].user_id));
}

export async function authenticateSessionToken(token:string): Promise<AuthUser | null> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const tokenHash = hashSessionToken(token);
  const result = await pool.query(
    `select u.id,u.display_name from auth_sessions s
     join users u on u.id=s.user_id
     where s.token_hash=$1 and s.revoked_at is null and s.expires_at > now()`,
    [tokenHash]
  );
  if (!result.rowCount) return null;
  await pool.query(`update auth_sessions set last_used_at=now() where token_hash=$1`, [tokenHash]);
  return loadAuthUser(String(result.rows[0].id));
}

/**
 * Attach a server-validated Telegram identity to an already-authenticated canonical user.
 * Never merges users and never moves rooms, games, saved data, history or memberships.
 */
export async function linkTelegramIdentity(
  userId:string,
  input:{ telegramId:string; username?:string }
): Promise<{ outcome:IdentityLinkOutcome; user:AuthUser }> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');

  const outcome = await withTransaction(async client => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`telegram:${input.telegramId}`]);

    const identityOwner = await client.query(
      `select user_id from user_identities where provider='telegram' and provider_user_id=$1 for update`,
      [input.telegramId]
    );
    const callerTelegram = await client.query(
      `select provider_user_id from user_identities where user_id=$1 and provider='telegram' limit 1 for update`,
      [userId]
    );

    const decision = decideTelegramIdentityLink({
      requestedUserId:userId,
      identityOwnerUserId:identityOwner.rowCount ? String(identityOwner.rows[0].user_id) : null,
      callerTelegramIdentityId:callerTelegram.rowCount ? String(callerTelegram.rows[0].provider_user_id) : null,
    });

    if (decision.kind === 'CONFLICT') {
      throw Object.assign(new Error(decision.message), { code:decision.code, statusCode:decision.statusCode });
    }

    if (decision.kind === 'IDEMPOTENT') {
      await client.query(
        `update user_identities set provider_username=$3 where user_id=$1 and provider='telegram' and provider_user_id=$2`,
        [userId, input.telegramId, input.username || null]
      );
      return 'ALREADY_LINKED' as IdentityLinkOutcome;
    }

    await client.query(
      `insert into user_identities(user_id,provider,provider_user_id,provider_username)
       values($1,'telegram',$2,$3)`,
      [userId, input.telegramId, input.username || null]
    );
    return 'LINKED' as IdentityLinkOutcome;
  });

  return { outcome, user:await loadAuthUser(userId) };
}

export async function loadAuthUser(userId:string): Promise<AuthUser> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const user = await pool.query(`select id,display_name,display_username from users where id=$1`, [userId]);
  if (!user.rowCount) throw new Error('User not found.');
  const identities = await pool.query(
    `select provider,provider_username from user_identities where user_id=$1 order by provider,created_at`,
    [userId]
  );
  return {
    id:String(user.rows[0].id),
    displayName:String(user.rows[0].display_name),
    ...(user.rows[0].display_username ? { displayUsername:String(user.rows[0].display_username) } : {}),
    identities:identities.rows.map((row:any): AuthIdentitySummary => ({
      provider:row.provider,
      username:row.provider_username || undefined
    }))
  };
}

export async function updateUserProfile(userId:string, input:{displayName:string}): Promise<AuthUser> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  await pool.query(`update users set display_name=$2, updated_at=now() where id=$1`, [userId, input.displayName]);
  return loadAuthUser(userId);
}

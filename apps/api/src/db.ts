import pg from 'pg';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthIdentitySummary, AuthUser } from '../../../packages/contracts/src/index.ts';

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
    `insert into auth_sessions (user_id, token_hash, provider, expires_at)
     values ($1,$2,$3,now() + interval '30 days')`,
    [userId, tokenHash, provider]
  );
  return token;
}

export async function upsertTelegramIdentity(input:{telegramId:string; displayName:string; username?:string}): Promise<{id:string; displayName:string}> {
  return resolveOrCreateTelegramIdentity(input);
}

export async function resolveOrCreateTelegramIdentity(input:{telegramId:string; displayName:string; username?:string}): Promise<AuthUser> {
  return withTransaction(async client => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`telegram:${input.telegramId}`]);
    const existing = await client.query(
      `select u.id, u.display_name from user_identities i
       join users u on u.id=i.user_id
       where i.provider='telegram' and i.provider_user_id=$1
       for update`, [input.telegramId]
    );
    if (existing.rowCount) {
      await client.query(
        `update users set display_name=$2, updated_at=now() where id=$1`,
        [existing.rows[0].id, input.displayName]
      );
      await client.query(
        `update user_identities set provider_username=$2 where provider='telegram' and provider_user_id=$1`,
        [input.telegramId, input.username || null]
      );
      return {
        id:String(existing.rows[0].id),
        displayName:input.displayName,
        identities:[{ provider:'telegram', username:input.username }]
      };
    }
    const user = await client.query(
      `insert into users(display_name) values($1) returning id,display_name`, [input.displayName]
    );
    await client.query(
      `insert into user_identities(user_id,provider,provider_user_id,provider_username)
       values($1,'telegram',$2,$3)`, [user.rows[0].id,input.telegramId,input.username || null]
    );
    return {
      id:String(user.rows[0].id),
      displayName:String(user.rows[0].display_name),
      identities:[{ provider:'telegram', username:input.username }]
    };
  });
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

export async function authenticateSessionToken(token:string): Promise<AuthUser | null> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const result = await pool.query(
    `select u.id,u.display_name from auth_sessions s
     join users u on u.id=s.user_id
     where s.token_hash=$1 and s.revoked_at is null and s.expires_at > now()`,
    [hashSessionToken(token)]
  );
  if (!result.rowCount) return null;
  return loadAuthUser(String(result.rows[0].id));
}

export async function loadAuthUser(userId:string): Promise<AuthUser> {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  const user = await pool.query(`select id,display_name from users where id=$1`, [userId]);
  if (!user.rowCount) throw new Error('User not found.');
  const identities = await pool.query(
    `select provider,provider_username from user_identities where user_id=$1 order by provider,created_at`,
    [userId]
  );
  return {
    id:String(user.rows[0].id),
    displayName:String(user.rows[0].display_name),
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

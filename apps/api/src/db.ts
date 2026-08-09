import pg from 'pg';
import { createHash, randomBytes } from 'node:crypto';

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
  return withTransaction(async client => {
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
      return { id:String(existing.rows[0].id), displayName:input.displayName };
    }
    const user = await client.query(
      `insert into users(display_name) values($1) returning id,display_name`, [input.displayName]
    );
    await client.query(
      `insert into user_identities(user_id,provider,provider_user_id,provider_username)
       values($1,'telegram',$2,$3)`, [user.rows[0].id,input.telegramId,input.username || null]
    );
    return { id:String(user.rows[0].id), displayName:String(user.rows[0].display_name) };
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

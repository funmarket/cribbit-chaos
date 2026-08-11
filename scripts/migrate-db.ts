import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to run database migrations.');

const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
const pool = new Pool({ connectionString:databaseUrl, max:1 });

function checksum(sql:string): string {
  return createHash('sha256').update(sql).digest('hex');
}

async function main(): Promise<void> {
  const files = (await readdir(migrationsDir))
    .filter(file => /^\d+.*\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b, 'en'));

  if (!files.length) throw new Error(`No SQL migrations found in ${migrationsDir}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const filename of files) {
    const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
    const digest = checksum(sql);
    const existing = await pool.query(
      'select checksum from schema_migrations where filename=$1',
      [filename]
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== digest) {
        throw new Error(`Migration checksum mismatch for ${filename}. Applied migrations must never be edited in place.`);
      }
      console.log(`[migrate] already applied: ${filename}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'insert into schema_migrations(filename,checksum) values($1,$2)',
        [filename, digest]
      );
      await client.query('COMMIT');
      console.log(`[migrate] applied: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

try {
  await main();
} finally {
  await pool.end();
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import {
  IDENTITY_LINK_CHALLENGE_PURPOSES,
  authenticateSessionToken,
  consumeIdentityLinkChallenge,
  createGuestIdentity,
  createIdentityLinkChallenge,
  hashSessionToken,
  pool,
} from '../src/db.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

test('identity-link challenges are stored outside auth_sessions', () => {
  const dbSource = readRepoFile('apps/api/src/db.ts');
  const start = dbSource.indexOf('/** Challenge purposes.');
  const end = dbSource.indexOf('export async function createGuestIdentity');
  assert.ok(start > 0 && end > start, 'challenge helpers must exist in db.ts');
  const challengeRegion = dbSource.slice(start, end);

  assert.match(challengeRegion, /insert into identity_link_challenges/);
  assert.match(challengeRegion, /update identity_link_challenges/);
  assert.doesNotMatch(
    challengeRegion,
    /(insert into|update|from|join)\s+auth_sessions/,
    'challenge SQL must never be written to or read from auth_sessions'
  );
  assert.doesNotMatch(challengeRegion, /identity-link:/, 'the namespaced session-alias shim must be gone');
});

test('challenge consumption is a single atomic purpose-bound claim', () => {
  const dbSource = readRepoFile('apps/api/src/db.ts');
  const region = dbSource.slice(dbSource.indexOf('export async function consumeIdentityLinkChallenge'));
  const statement = region.slice(0, region.indexOf('returning user_id') + 'returning user_id'.length);

  assert.match(statement, /where code_hash=\$1 and purpose=\$2 and consumed_at is null and expires_at > now\(\)/);
  assert.match(statement, /set consumed_at=now\(\)/);
  assert.doesNotMatch(statement, /revoked_at/, 'session revocation must not represent challenge consumption');
});

test('migration defines purpose-separated challenge persistence', () => {
  const migration = readRepoFile('db/migrations/003_identity_link_challenges.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS identity_link_challenges/);
  assert.match(migration, /user_id uuid NOT NULL REFERENCES users\(id\)/);
  assert.match(migration, /code_hash text UNIQUE NOT NULL/);
  assert.match(migration, /purpose text NOT NULL CHECK \(purpose IN \('telegram-link','telegram-web-link'\)\)/);
  assert.match(migration, /consumed_at timestamptz/);
  assert.doesNotMatch(migration, /(insert into|update|from|join)\s+auth_sessions/);
});

const databaseUrl = process.env.DATABASE_URL;
const dbTest = databaseUrl ? test : test.skip;
const purposes = IDENTITY_LINK_CHALLENGE_PURPOSES;

async function withChallengeUser(
  run: (user: { id: string }, code: string) => Promise<void>,
  purpose: (typeof purposes)[number] = 'telegram-link'
): Promise<void> {
  const guest = await createGuestIdentity('Link Challenge Test');
  const challenge = await createIdentityLinkChallenge(guest.id, 600, purpose);
  try {
    await run(guest, challenge.code);
  } finally {
    if (pool) await pool.query('delete from users where id=$1', [guest.id]);
  }
}

dbTest('a challenge is consumed exactly once for its bound canonical user', async () => {
  await withChallengeUser(async (user, code) => {
    assert.equal(await consumeIdentityLinkChallenge(code), user.id);
    assert.equal(await consumeIdentityLinkChallenge(code), null, 'a consumed challenge must be rejected');
  });
});

dbTest('an expired challenge is rejected', async () => {
  const guest = await createGuestIdentity('Link Challenge Expired');
  const code = 'expired-challenge-code';
  try {
    assert.ok(pool);
    await pool.query(
      `insert into identity_link_challenges (user_id, code_hash, purpose, expires_at)
       values ($1,$2,'telegram-link', now() - interval '1 second')`,
      [guest.id, createHash('sha256').update(code).digest('hex')]
    );
    assert.equal(await consumeIdentityLinkChallenge(code), null);
  } finally {
    if (pool) await pool.query('delete from users where id=$1', [guest.id]);
  }
});

dbTest('a wrong-purpose challenge is rejected for the link purpose', async () => {
  await withChallengeUser(async (user, code) => {
    assert.equal(await consumeIdentityLinkChallenge(code, 'telegram-web-link'), null, 'wrong purpose must not consume');
    assert.equal(await consumeIdentityLinkChallenge(code), user.id, 'the matching purpose still consumes once');
  });
});

dbTest('an unknown challenge code is rejected', async () => {
  assert.equal(await consumeIdentityLinkChallenge('no-such-challenge-code'), null);
});

dbTest('a challenge value can never authenticate as a login session', async () => {
  await withChallengeUser(async (user, code) => {
    assert.ok(pool);
    const sessionsForUser = await pool.query('select count(*)::int as total from auth_sessions where user_id=$1', [user.id]);
    assert.equal(sessionsForUser.rows[0].total, 0, 'creating a challenge must not create a session row');

    assert.equal(await authenticateSessionToken(code), null);
    assert.equal(await authenticateSessionToken(`identity-link:${code}`), null);
    assert.equal(await authenticateSessionToken(hashSessionToken(code)), null);

    for (const candidate of [code, `identity-link:${code}`]) {
      const alias = await pool.query('select 1 from auth_sessions where token_hash=$1', [hashSessionToken(candidate)]);
      assert.equal(alias.rowCount, 0, 'auth_sessions must never contain a challenge-derived credential');
    }
  });
});

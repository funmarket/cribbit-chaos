import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiApp } from '../src/app.ts';
import { decideWebLoginUsernameSuggestion } from '../src/identity-linking.ts';
import {
  attachWebCredential,
  authenticateWebUser,
  createTelegramCanonicalUser,
  findTelegramIdentityUser,
  linkTelegramIdentity,
  loadAuthUser,
  pool,
  registerWebUser,
  suggestWebLoginUsername,
} from '../src/db.ts';

// LOGIN-B: the Telegram username is provider metadata. It may be suggested as a convenient
// Web login username, but it never proves identity, never claims a username and never links.
// Identity decisions stay backend-owned.

const stamp = () => String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');

test('a provider username that exists, is valid and is free is suggested', () => {
  assert.deepEqual(
    decideWebLoginUsernameSuggestion({ telegramUsername: 'alice', normalizedCandidate: 'alice', loginTakenByOtherUser: false }),
    { loginUsername: 'alice', reason: 'AVAILABLE' }
  );
});

test('a missing provider username yields no suggestion', () => {
  assert.deepEqual(
    decideWebLoginUsernameSuggestion({ telegramUsername: null, normalizedCandidate: null, loginTakenByOtherUser: false }),
    { loginUsername: null, reason: 'NO_TELEGRAM_USERNAME' }
  );
});

test('a provider username that fails canonical login validation yields no suggestion', () => {
  assert.deepEqual(
    decideWebLoginUsernameSuggestion({ telegramUsername: 'not a login', normalizedCandidate: null, loginTakenByOtherUser: false }),
    { loginUsername: null, reason: 'INVALID_TELEGRAM_USERNAME' }
  );
});

test('a provider username owned by another canonical user yields no suggestion', () => {
  assert.deepEqual(
    decideWebLoginUsernameSuggestion({ telegramUsername: 'alice', normalizedCandidate: 'alice', loginTakenByOtherUser: true }),
    { loginUsername: null, reason: 'LOGIN_TAKEN' }
  );
});

test('the suggestion endpoint answers the authenticated caller from backend-owned state', async () => {
  const user = { id: 'u1', displayName: 'U', identities: [{ provider: 'telegram' as const, username: 'alice' }] };
  const app = await createApiApp({
    authenticateSessionToken: async (token: string) => (token === 'session-token' ? user : null),
    suggestWebLoginUsername: async (userId: string) => (
      userId === 'u1'
        ? { loginUsername: 'alice', reason: 'AVAILABLE' as const }
        : { loginUsername: null, reason: 'NO_TELEGRAM_USERNAME' as const }
    ),
  } as never);
  try {
    const anonymous = await app.inject({ method: 'GET', url: '/v1/me/web-login-suggestion' });
    assert.equal(anonymous.statusCode, 401);

    const authenticated = await app.inject({ method: 'GET', url: '/v1/me/web-login-suggestion', headers: { authorization: 'Bearer session-token' } });
    assert.equal(authenticated.statusCode, 200);
    assert.deepEqual(authenticated.json(), { loginUsername: 'alice', reason: 'AVAILABLE' });
  } finally {
    await app.close();
  }
});

const dbTest = process.env.DATABASE_URL ? test : test.skip;

dbTest('a Telegram account without a username stays fully valid and suggests nothing', async () => {
  const telegramId = `9400${stamp()}`;
  const user = await createTelegramCanonicalUser({ telegramId, displayName: 'No Username' });
  try {
    assert.deepEqual(await suggestWebLoginUsername(user.id), { loginUsername: null, reason: 'NO_TELEGRAM_USERNAME' });
    const resolved = await findTelegramIdentityUser(telegramId);
    assert.equal(resolved?.id, user.id, 'the stable numeric Telegram id remains the provider key');
  } finally {
    if (pool) await pool.query('delete from users where id=$1', [user.id]);
  }
});

dbTest('the suggestion is metadata-driven, never claims the login and never links', async () => {
  const tag = stamp();
  const telegramId = `9500${tag}`;
  const telegramUser = await createTelegramCanonicalUser({ telegramId, displayName: `Tg ${tag}`, username: `Alice${tag}` });
  try {
    assert.deepEqual(await suggestWebLoginUsername(telegramUser.id), { loginUsername: `alice${tag}`.toLowerCase(), reason: 'AVAILABLE' });

    const other = await registerWebUser({ loginUsername: `alice${tag}`, password: 'Password1234', displayUsername: `Owner${tag}` });
    try {
      assert.deepEqual(await suggestWebLoginUsername(telegramUser.id), { loginUsername: null, reason: 'LOGIN_TAKEN' });
      const after = await loadAuthUser(telegramUser.id);
      assert.deepEqual(after.identities.filter(identity => identity.provider === 'web'), [], 'a suggestion must never attach a Web credential');
      assert.equal(after.id, telegramUser.id);
    } finally {
      if (pool) await pool.query('delete from users where id=$1', [other.id]);
    }
  } finally {
    if (pool) await pool.query('delete from users where id=$1', [telegramUser.id]);
  }
});

dbTest('unknown Telegram creates nothing, explicit creation creates exactly one user, Telegram-first attach converges on Web login', async () => {
  const tag = stamp();
  const telegramId = `9600${tag}`;
  assert.ok(pool);
  const before = (await pool.query('select count(*)::int as total from users')).rows[0].total;

  const unknown = await findTelegramIdentityUser(telegramId);
  assert.equal(unknown, null);
  assert.equal((await pool.query('select count(*)::int as total from users')).rows[0].total, before, 'an unknown Telegram identity must never provision a user');

  const telegramUser = await createTelegramCanonicalUser({ telegramId, displayName: `Lifecycle ${tag}`, username: `Cycle${tag}` });
  assert.equal((await pool.query('select count(*)::int as total from users')).rows[0].total, before + 1, 'explicit creation creates exactly one canonical user');

  const login = `cycle${tag}`;
  await attachWebCredential(telegramUser.id, { loginUsername: login, password: 'Password1234', displayUsername: `Cycle${tag}` });
  const webLogin = await authenticateWebUser({ loginUsername: login, password: 'Password1234', ipHash: 'test-ip' });
  assert.equal(webLogin?.id, telegramUser.id, 'the attached Web login resolves the same canonical user');
  assert.equal((await pool.query('select count(*)::int as total from users')).rows[0].total, before + 1, 'attaching a Web credential never creates a user');

  await pool.query('delete from users where id=$1', [telegramUser.id]);
});

dbTest('a changed Telegram username refreshes provider metadata only', async () => {
  const tag = stamp();
  const telegramId = `9700${tag}`;
  const login = `rename${tag}`;
  const telegramUser = await createTelegramCanonicalUser({ telegramId, displayName: `Canonical ${tag}`, username: `Before${tag}` });
  try {
    await attachWebCredential(telegramUser.id, { loginUsername: login, password: 'Password1234', displayUsername: `Rename${tag}` });
    const before = await loadAuthUser(telegramUser.id);

    const renamed = await findTelegramIdentityUser(telegramId, `After${tag}`);
    assert.equal(renamed?.id, telegramUser.id, 'the stable numeric id keeps the same canonical user');

    const after = await loadAuthUser(telegramUser.id);
    assert.equal(after.displayName, before.displayName, 'provider authentication must not rewrite the canonical display name');
    assert.equal(after.identities.find(identity => identity.provider === 'telegram')?.username, `After${tag}`, 'provider metadata is refreshed');
    assert.ok(after.identities.some(identity => identity.provider === 'web'), 'the Web credential is unchanged');
    assert.equal((await authenticateWebUser({ loginUsername: login, password: 'Password1234', ipHash: 'test-ip' }))?.id, telegramUser.id);
  } finally {
    if (pool) await pool.query('delete from users where id=$1', [telegramUser.id]);
  }
});

dbTest('web-first linking keeps one canonical user', async () => {
  const tag = stamp();
  const telegramId = `9800${tag}`;
  const webUser = await registerWebUser({ loginUsername: `webfirst${tag}`, password: 'Password1234', displayUsername: `Webfirst${tag}` });
  try {
    const linked = await linkTelegramIdentity(webUser.id, { telegramId, username: `Webfirst${tag}` });
    assert.equal(linked.outcome, 'LINKED');
    assert.equal(linked.user.id, webUser.id);
    assert.equal((await findTelegramIdentityUser(telegramId))?.id, webUser.id);
  } finally {
    if (pool) await pool.query('delete from users where id=$1', [webUser.id]);
  }
});

import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import test from 'node:test';
import type { AuthUser } from '../../../packages/contracts/src/index.ts';
import { createApiApp, type ApiDependencies } from '../src/app.ts';
import { decideTelegramIdentityLink } from '../src/identity-linking.ts';
import { validateTelegramInitData } from '../src/telegram-auth.ts';

// LINK-1: one human must be able to use Web and Telegram as the same canonical user.
// Linking is explicit, never merges users, and never moves product data. These tests use
// the production Telegram validator with spec-signed initData plus the production link
// decision function, so the semantics under test are the real ones.

const TEST_BOT_TOKEN = 'link-1-test-bot-token';
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

function telegramUser(id: string, username?: string): string {
  return JSON.stringify({ id, first_name: 'Linktester', ...(username ? { username } : {}) });
}

/** Sign initData exactly like Telegram Mini Apps does, so the real validator accepts it. */
function signInitData(fields: Record<string, string>, botToken = TEST_BOT_TOKEN): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

function freshInitData(telegramId: string, username?: string, authDate = Math.floor(Date.now() / 1000)): string {
  return signInitData({ auth_date: String(authDate), query_id: 'AAH', user: telegramUser(telegramId, username) });
}

async function withBotToken<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
}

function makeUser(id: string, displayName: string, provider: 'web' | 'telegram'): AuthUser {
  return { id, displayName, identities: [{ provider }] };
}

function makeStore() {
  const users = new Map<string, AuthUser>([[U1, makeUser(U1, 'Web First', 'web')], [U2, makeUser(U2, 'Telegram First', 'telegram')]]);
  const telegramIdentities = new Map<string, string>([['998877', U2]]);
  const sessions = new Map<string, { userId: string; provider: 'web' | 'telegram' }>();
  const webIdentityUsers = new Set<string>([U1]);
  const calls = { link: 0 };

  function identitiesOf(userId: string): AuthUser['identities'] {
    // Mirrors loadAuthUser(): every provider identity attached to the canonical user.
    const webIdentity = webIdentityUsers.has(userId) ? [{ provider: 'web' as const }] : [];
    const telegramIdentity = [...telegramIdentities.entries()]
      .filter(([, owner]) => owner === userId)
      .map(([telegramId]) => ({ provider: 'telegram' as const, username: telegramId === '998877' ? 'telly' : 'linked' }));
    return [...webIdentity, ...telegramIdentity];
  }

  const deps: ApiDependencies = {
    dbHealth: async () => true,
    validateTelegramInitData,
    findTelegramIdentityUser: async (telegramId:string) => {
      const existingId = telegramIdentities.get(telegramId);
      if (!existingId) return null;
      const existing = users.get(existingId);
      assert.ok(existing, 'identity points to a missing user');
      return existing;
    },
    createTelegramCanonicalUser: async input => {
      const created = makeUser(randomBytes(16).toString('hex'), input.displayName, 'telegram');
      users.set(created.id, created);
      telegramIdentities.set(input.telegramId, created.id);
      return created;
    },
    attachWebCredential: async () => { throw new Error('not used'); },
    createIdentityLinkChallenge: async () => ({ code:'code', expiresAt:new Date().toISOString() }),
    consumeIdentityLinkChallenge: async () => null,
    registerWebUser: async input => {
      const created = makeUser(U1, input.displayName || input.displayUsername, 'web');
      users.set(created.id, created);
      webIdentityUsers.add(created.id);
      return created;
    },
    authenticateWebUser: async () => users.get(U1) ?? null,
    createServerSession: async (userId, provider) => {
      const token = randomBytes(24).toString('base64url');
      sessions.set(token, { userId, provider });
      return token;
    },
    revokeServerSession: async () => undefined,
    createGuestIdentity: async () => ({ id: U1, displayName: 'Guest' }),
    authenticateSessionToken: async token => {
      const session = sessions.get(token);
      return session ? users.get(session.userId) ?? null : null;
    },
    updateUserProfile: async (userId, input) => {
      const user = users.get(userId);
      assert.ok(user, 'missing user');
      user.displayName = input.displayName;
      return user;
    },
    verifyTelegramWebLoginCallback: async () => { throw new Error('not used'); },
    linkTelegramIdentity: async (userId, input) => {
      calls.link += 1;
      const owner = telegramIdentities.get(input.telegramId) ?? null;
      const callerTelegram = [...telegramIdentities.entries()].find(([, value]) => value === userId)?.[0] ?? null;
      const decision = decideTelegramIdentityLink({
        requestedUserId: userId,
        identityOwnerUserId: owner,
        callerTelegramIdentityId: callerTelegram,
      });
      if (decision.kind === 'CONFLICT') {
        throw Object.assign(new Error(decision.message), { code: decision.code, statusCode: decision.statusCode });
      }
      if (decision.kind === 'ATTACH') telegramIdentities.set(input.telegramId, userId);
      const user = users.get(userId);
      assert.ok(user, 'missing user');
      user.identities = [...identitiesOf(userId)];
      return { outcome: decision.kind === 'ATTACH' ? 'LINKED' as const : 'ALREADY_LINKED' as const, user };
    },
  };

  return { deps, users, telegramIdentities, sessions, calls };
}

async function withApp<T>(store: ReturnType<typeof makeStore>, fn: (app: Awaited<ReturnType<typeof createApiApp>>) => Promise<T>): Promise<T> {
  const app = await createApiApp(store.deps);
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

function linkRequest(app: Awaited<ReturnType<typeof createApiApp>>, token: string | null, initData: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/me/identities/telegram',
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    payload: { initData },
  });
}

test('link decision matrix: attach, idempotent, and both conflict cases', () => {
  assert.deepEqual(
    decideTelegramIdentityLink({ requestedUserId: U1, identityOwnerUserId: null, callerTelegramIdentityId: null }),
    { kind: 'ATTACH' },
  );
  assert.deepEqual(
    decideTelegramIdentityLink({ requestedUserId: U1, identityOwnerUserId: U1, callerTelegramIdentityId: '998877' }),
    { kind: 'IDEMPOTENT' },
  );
  const otherOwner = decideTelegramIdentityLink({ requestedUserId: U1, identityOwnerUserId: U2, callerTelegramIdentityId: null });
  assert.equal(otherOwner.kind, 'CONFLICT');
  assert.equal(otherOwner.kind === 'CONFLICT' ? otherOwner.code : null, 'IDENTITY_ALREADY_LINKED');
  const secondTelegram = decideTelegramIdentityLink({ requestedUserId: U1, identityOwnerUserId: null, callerTelegramIdentityId: '998877' });
  assert.equal(secondTelegram.kind, 'CONFLICT');
  assert.equal(secondTelegram.kind === 'CONFLICT' ? secondTelegram.code : null, 'IDENTITY_PROVIDER_ALREADY_LINKED');
});

test('new Telegram link attaches the identity to the authenticated canonical user', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const token = await store.deps.createServerSession(U1, 'web');
    const response = await linkRequest(app, token, freshInitData('555000111', 'newtelly'));

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().outcome, 'LINKED');
    assert.equal(response.json().user.id, U1);
    assert.equal(store.telegramIdentities.get('555000111'), U1);
    assert.equal(store.users.size, 2, 'linking must never create or merge users');
  }));
});

test('linking the same Telegram identity twice is idempotent', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const token = await store.deps.createServerSession(U1, 'web');
    const initData = freshInitData('555000222', 'twice');

    const first = await linkRequest(app, token, initData);
    const second = await linkRequest(app, token, initData);

    assert.equal(first.json().outcome, 'LINKED');
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().outcome, 'ALREADY_LINKED');
    assert.equal(second.json().user.id, U1);
    assert.equal([...store.telegramIdentities.entries()].filter(([telegramId]) => telegramId === '555000222').length, 1);
    assert.equal(store.users.size, 2);
  }));
});

test('linking a Telegram identity owned by another user conflicts without moving anything', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const token = await store.deps.createServerSession(U1, 'web');
    const response = await linkRequest(app, token, freshInitData('998877', 'telly'));

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, 'IDENTITY_ALREADY_LINKED');
    assert.equal(store.telegramIdentities.get('998877'), U2, 'identity must not move');
    assert.equal(store.users.get(U1)?.displayName, 'Web First', 'no user merge');
    assert.equal(store.users.get(U2)?.displayName, 'Telegram First', 'no user merge');
    assert.equal(store.users.size, 2);
  }));
});

test('invalid or expired Telegram authentication is rejected without mutation', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const token = await store.deps.createServerSession(U1, 'web');

    const tampered = freshInitData('555000333', 'tampered').replace(/hash=[a-f0-9]+/, 'hash=' + 'a'.repeat(64));
    const tamperedResponse = await linkRequest(app, token, tampered);
    assert.equal(tamperedResponse.statusCode, 401);
    assert.equal(store.telegramIdentities.has('555000333'), false);

    const stale = freshInitData('555000444', 'stale', Math.floor(Date.now() / 1000) - 7200);
    const staleResponse = await linkRequest(app, token, stale);
    assert.equal(staleResponse.statusCode, 401);
    assert.equal(store.telegramIdentities.has('555000444'), false);
    assert.equal(store.users.size, 2);
  }));
});

test('linking requires an authenticated canonical caller', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const response = await linkRequest(app, null, freshInitData('555000555', 'anonymous'));

    assert.equal(response.statusCode, 401);
    assert.equal(store.calls.link, 0, 'unauthenticated callers must never reach identity linking');
    assert.equal(store.telegramIdentities.has('555000555'), false);
  }));
});

test('web and telegram authentication resolve to the same canonical user after linking', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const token = await store.deps.createServerSession(U1, 'web');
    assert.equal((await linkRequest(app, token, freshInitData('555000666', 'linked'))).json().outcome, 'LINKED');

    const webUser = await store.deps.authenticateWebUser({ loginUsername: 'web', password: 'x', ipHash: 'h' });
    const telegramUser_ = await store.deps.findTelegramIdentityUser('555000666');
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });

    assert.equal(webUser?.id, U1);
    assert.equal(telegramUser_?.id, U1);
    assert.equal(me.json().user.id, U1);
    const providers = me.json().user.identities.map((identity: { provider: string }) => identity.provider).sort();
    assert.deepEqual(providers, ['telegram', 'web']);
    assert.equal(store.users.size, 2);
  }));
});

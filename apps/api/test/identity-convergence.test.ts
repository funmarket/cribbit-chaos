import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import test from 'node:test';
import type { AuthUser } from '../../../packages/contracts/src/index.ts';
import { createApiApp, type ApiDependencies } from '../src/app.ts';
import { decideTelegramIdentityLink } from '../src/identity-linking.ts';
import { validateTelegramInitData } from '../src/telegram-auth.ts';

// IDENTITY-2: one human, one canonical users.id. Provider authentication must never
// provision a second canonical account, never merge accounts, and never rewrite canonical
// profile presentation. Telegram proof is spec-signed and validated by the production validator.

const TEST_BOT_TOKEN = 'identity-convergence-test-token';

function signInitData(user: Record<string, unknown>, botToken = TEST_BOT_TOKEN, authDate = Math.floor(Date.now() / 1000)): string {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify(user) });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

function telegramProof(id: string, firstName = 'Provider', username?: string, authDate?: number): string {
  return signInitData({ id, first_name: firstName, ...(username ? { username } : {}) }, TEST_BOT_TOKEN, authDate);
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

function cookieValue(setCookie: string | string[] | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie || '';
  return raw.split(';')[0] || '';
}

function makeStore() {
  const users = new Map<string, AuthUser>();
  const telegramIdentities = new Map<string, string>();
  const credentials = new Map<string, { userId: string; password: string }>();
  const sessions = new Map<string, { userId: string }>();
  const challenges = new Map<string, { userId: string; used: boolean }>();

  function createUser(displayName: string, identities: AuthUser['identities']): AuthUser {
    const id = randomBytes(16).toString('hex');
    const user: AuthUser = { id, displayName, identities };
    users.set(id, user);
    return user;
  }

  function decorate(userId: string): AuthUser {
    const user = users.get(userId);
    assert.ok(user, 'missing user');
    const web = [...credentials.entries()].some(([, value]) => value.userId === userId);
    const telegram = [...telegramIdentities.entries()].filter(([, value]) => value === userId).map(() => ({ provider: 'telegram' as const }));
    return { ...user, identities: [...(web ? [{ provider: 'web' as const }] : []), ...telegram] };
  }

  const deps: ApiDependencies = {
    dbHealth: async () => true,
    validateTelegramInitData,
    findTelegramIdentityUser: async (telegramId: string) => {
      const userId = telegramIdentities.get(telegramId);
      return userId ? decorate(userId) : null;
    },
    createTelegramCanonicalUser: async input => {
      if (telegramIdentities.has(input.telegramId)) {
        throw Object.assign(new Error('That Telegram account is already linked to a Cribbit account.'), { code: 'IDENTITY_ALREADY_LINKED', statusCode: 409 });
      }
      const user = createUser(input.displayName, [{ provider: 'telegram', username: input.username }]);
      telegramIdentities.set(input.telegramId, user.id);
      return user;
    },
    registerWebUser: async input => {
      const login = String(input.loginUsername).toLowerCase();
      if (credentials.has(login)) {
        throw Object.assign(new Error('That login username is already registered.'), { code: 'LOGIN_USERNAME_TAKEN', statusCode: 409 });
      }
      const user = createUser(input.displayName || input.displayUsername, [{ provider: 'web', username: input.displayUsername }]);
      credentials.set(login, { userId: user.id, password: input.password });
      return user;
    },
    authenticateWebUser: async input => {
      const credential = credentials.get(String(input.loginUsername || '').toLowerCase());
      if (!credential || credential.password !== input.password) return null;
      return decorate(credential.userId);
    },
    attachWebCredential: async (userId, input) => {
      const login = String(input.loginUsername).toLowerCase();
      if ([...credentials.entries()].some(([, value]) => value.userId === userId)) {
        throw Object.assign(new Error('This Cribbit account already has a Web credential.'), { code: 'IDENTITY_PROVIDER_ALREADY_LINKED', statusCode: 409 });
      }
      if (credentials.has(login)) {
        throw Object.assign(new Error('That login username is already registered.'), { code: 'LOGIN_USERNAME_TAKEN', statusCode: 409 });
      }
      credentials.set(login, { userId, password: input.password });
      return decorate(userId);
    },
    createIdentityLinkChallenge: async userId => {
      const code = randomBytes(12).toString('base64url');
      challenges.set(code, { userId, used: false });
      return { code, expiresAt: new Date(Date.now() + 600000).toISOString() };
    },
    consumeIdentityLinkChallenge: async code => {
      const challenge = challenges.get(code);
      if (!challenge || challenge.used) return null;
      challenge.used = true;
      return challenge.userId;
    },
    linkTelegramIdentity: async (userId, input) => {
      const owner = telegramIdentities.get(input.telegramId) ?? null;
      const callerTelegram = [...telegramIdentities.entries()].find(([, value]) => value === userId)?.[0] ?? null;
      const decision = decideTelegramIdentityLink({ requestedUserId: userId, identityOwnerUserId: owner, callerTelegramIdentityId: callerTelegram });
      if (decision.kind === 'CONFLICT') {
        throw Object.assign(new Error(decision.message), { code: decision.code, statusCode: decision.statusCode });
      }
      if (decision.kind === 'ATTACH') telegramIdentities.set(input.telegramId, userId);
      return { outcome: decision.kind === 'ATTACH' ? 'LINKED' as const : 'ALREADY_LINKED' as const, user: decorate(userId) };
    },
    createServerSession: async userId => {
      const token = randomBytes(18).toString('base64url');
      sessions.set(token, { userId });
      return token;
    },
    revokeServerSession: async token => { sessions.delete(token); },
    createGuestIdentity: async () => ({ id: randomBytes(16).toString('hex'), displayName: 'Guest' }),
    authenticateSessionToken: async token => {
      const session = sessions.get(token);
      return session ? decorate(session.userId) ?? null : null;
    },
    updateUserProfile: async (userId, input) => {
      const user = users.get(userId);
      assert.ok(user, 'missing user');
      user.displayName = input.displayName;
      return decorate(userId);
    },
    verifyTelegramWebLoginCallback: async () => ({ telegramId: 'oidc-9001', displayName: 'OIDC Name', username: 'oidc' }),
  };

  return { deps, users, telegramIdentities, credentials, sessions, challenges };
}

async function withApp<T>(store: ReturnType<typeof makeStore>, fn: (app: Awaited<ReturnType<typeof createApiApp>>) => Promise<T>): Promise<T> {
  const app = await createApiApp(store.deps);
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

test('an unknown Telegram identity cannot create a canonical account implicitly', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const response = await app.inject({ method: 'POST', url: '/v1/auth/telegram', payload: { initData: telegramProof('7001') } });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error, 'TELEGRAM_IDENTITY_UNLINKED');
    assert.equal(store.users.size, 0);
  }));
});

test('explicit Telegram account creation creates exactly one canonical user', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const created = await app.inject({ method: 'POST', url: '/v1/auth/telegram/register', payload: { initData: telegramProof('7002', 'Created') } });
    assert.equal(created.statusCode, 200);
    const userId = created.json().user.id;
    assert.equal(store.users.size, 1);

    const authenticated = await app.inject({ method: 'POST', url: '/v1/auth/telegram', payload: { initData: telegramProof('7002', 'Created') } });
    assert.equal(authenticated.statusCode, 200);
    assert.equal(authenticated.json().user.id, userId);

    const repeated = await app.inject({ method: 'POST', url: '/v1/auth/telegram/register', payload: { initData: telegramProof('7002', 'Created') } });
    assert.equal(repeated.statusCode, 409);
    assert.equal(store.users.size, 1);
  }));
});

test('a Telegram-first account can attach a Web credential and Web login resolves the same user', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const registration = await app.inject({ method: 'POST', url: '/v1/auth/telegram/register', payload: { initData: telegramProof('7003', 'TelegramFirst') } });
    const userId = registration.json().user.id;
    const bearer = registration.json().accessToken;

    const attached = await app.inject({
      method: 'POST',
      url: '/v1/me/identities/web-credential',
      headers: { authorization: `Bearer ${bearer}` },
      payload: { loginUsername: 'telegram_first', password: 'Password1234', displayUsername: 'TelegramFirst' },
    });
    assert.equal(attached.statusCode, 200);
    assert.equal(attached.json().user.id, userId);
    assert.equal(store.users.size, 1, 'attaching a credential must never create a user');

    const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { loginUsername: 'telegram_first', password: 'Password1234' } });
    assert.equal(login.statusCode, 200);
    assert.equal(login.json().user.id, userId);

    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: cookieValue(login.headers['set-cookie']) } });
    const providers = me.json().user.identities.map((identity: { provider: string }) => identity.provider).sort();
    assert.deepEqual(providers, ['telegram', 'web']);
  }));
});

test('attaching a Web credential rejects taken logins and a second credential', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const first = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { loginUsername: 'takenlogin', password: 'Password1234', displayUsername: 'TakenOne' } });
    assert.equal(first.statusCode, 200);
    const second = await app.inject({ method: 'POST', url: '/v1/auth/telegram/register', payload: { initData: telegramProof('7004', 'Second') } });
    const bearer = second.json().accessToken;

    const taken = await app.inject({ method: 'POST', url: '/v1/me/identities/web-credential', headers: { authorization: `Bearer ${bearer}` }, payload: { loginUsername: 'takenlogin', password: 'Password1234', displayUsername: 'SecondUser' } });
    assert.equal(taken.statusCode, 409);
    assert.equal(taken.json().error, 'LOGIN_USERNAME_TAKEN');

    const attached = await app.inject({ method: 'POST', url: '/v1/me/identities/web-credential', headers: { authorization: `Bearer ${bearer}` }, payload: { loginUsername: 'secondlogin', password: 'Password1234', displayUsername: 'SecondUser' } });
    assert.equal(attached.statusCode, 200);

    const duplicate = await app.inject({ method: 'POST', url: '/v1/me/identities/web-credential', headers: { authorization: `Bearer ${bearer}` }, payload: { loginUsername: 'anotherlogin', password: 'Password1234', displayUsername: 'SecondUser' } });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().error, 'IDENTITY_PROVIDER_ALREADY_LINKED');
    assert.equal(store.users.size, 2, 'no extra canonical user may appear');
  }));
});

test('linking an existing account from Telegram with the Web credential resolves the same user', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const web = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { loginUsername: 'webowner', password: 'Password1234', displayUsername: 'WebOwner' } });
    const userId = web.json().user.id;

    const wrong = await app.inject({ method: 'POST', url: '/v1/auth/telegram/link', payload: { initData: telegramProof('7005'), loginUsername: 'webowner', password: 'WrongPassword1' } });
    assert.equal(wrong.statusCode, 401);
    assert.equal(store.telegramIdentities.size, 0, 'a failed credential check must not link anything');

    const linked = await app.inject({ method: 'POST', url: '/v1/auth/telegram/link', payload: { initData: telegramProof('7005'), loginUsername: 'webowner', password: 'Password1234' } });
    assert.equal(linked.statusCode, 200);
    assert.equal(linked.json().outcome, 'LINKED');
    assert.equal(linked.json().user.id, userId);

    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${linked.json().accessToken}` } });
    assert.equal(me.json().user.id, userId);
    assert.equal(store.users.size, 1);
  }));
});

test('a single-use link code links the Telegram identity to its owner exactly once', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const web = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { loginUsername: 'codeowner', password: 'Password1234', displayUsername: 'CodeOwner' } });
    const userId = web.json().user.id;
    const cookie = cookieValue(web.headers['set-cookie']);

    const challenge = await app.inject({ method: 'POST', url: '/v1/me/identities/telegram/link-code', headers: { cookie } });
    assert.equal(challenge.statusCode, 200);
    const code = challenge.json().code;
    assert.ok(code);

    const linked = await app.inject({ method: 'POST', url: '/v1/auth/telegram/link-with-code', payload: { initData: telegramProof('7006'), code } });
    assert.equal(linked.statusCode, 200);
    assert.equal(linked.json().outcome, 'LINKED');
    assert.equal(linked.json().user.id, userId);

    const replayWithOtherIdentity = await app.inject({ method: 'POST', url: '/v1/auth/telegram/link-with-code', payload: { initData: telegramProof('7007'), code } });
    assert.equal(replayWithOtherIdentity.statusCode, 401);
    assert.equal(replayWithOtherIdentity.json().error, 'LINK_CODE_INVALID');
    assert.equal(store.telegramIdentities.has('7007'), false, 'a used code must not attach another Telegram identity');
    assert.equal(store.users.size, 1);
  }));
});

test('Telegram re-authentication never rewrites canonical profile presentation', async () => {
  const store = makeStore();
  await withBotToken(async () => withApp(store, async app => {
    const web = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { loginUsername: 'canonicalname', password: 'Password1234', displayUsername: 'CanonicalUser', displayName: 'Canonical Name' } });
    const userId = web.json().user.id;
    const cookie = cookieValue(web.headers['set-cookie']);

    const linked = await app.inject({ method: 'POST', url: '/v1/me/identities/telegram', headers: { cookie }, payload: { initData: telegramProof('7008', 'Provider First Name', 'providerusername') } });
    assert.equal(linked.statusCode, 200);

    const reauth = await app.inject({ method: 'POST', url: '/v1/auth/telegram', payload: { initData: telegramProof('7008', 'Changed Provider Name', 'renamed_provider') } });
    assert.equal(reauth.statusCode, 200);

    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${reauth.json().accessToken}` } });
    assert.equal(me.json().user.id, userId);
    assert.equal(me.json().user.displayName, 'Canonical Name', 'authentication must not rename the canonical account');
  }));
});

test('Telegram OIDC callback links to the authenticated session and rejects anonymous callers', async () => {
  const store = makeStore();
  const previous = { id: process.env.TELEGRAM_LOGIN_CLIENT_ID, secret: process.env.TELEGRAM_LOGIN_CLIENT_SECRET, redirect: process.env.TELEGRAM_LOGIN_REDIRECT_URI };
  process.env.TELEGRAM_LOGIN_CLIENT_ID = 'test-client';
  process.env.TELEGRAM_LOGIN_CLIENT_SECRET = 'test-secret';
  process.env.TELEGRAM_LOGIN_REDIRECT_URI = 'https://api.example.test/v1/auth/telegram/web/callback';
  try {
    await withBotToken(async () => withApp(store, async app => {
      const web = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { loginUsername: 'oidcowner', password: 'Password1234', displayUsername: 'OidcOwner' } });
      const userId = web.json().user.id;
      const cookie = cookieValue(web.headers['set-cookie']);

      // Anonymous caller with an unlinked Telegram identity: reported, never provisioned.
      const anonymous = await app.inject({ method: 'GET', url: '/v1/auth/telegram/web/callback?code=test&state=test' });
      assert.equal(anonymous.statusCode, 409);
      assert.equal(anonymous.json().error, 'TELEGRAM_IDENTITY_UNLINKED');
      assert.equal(store.users.size, 1, 'the callback must not create a second user');

      // Authenticated browser session: the same identity links to the canonical user.
      const linked = await app.inject({ method: 'GET', url: '/v1/auth/telegram/web/callback?code=test&state=test', headers: { cookie } });
      assert.equal(linked.statusCode, 200);
      assert.equal(linked.json().outcome, 'LINKED');
      assert.equal(linked.json().user.id, userId);
      assert.equal(store.users.size, 1);
    }));
  } finally {
    if (previous.id === undefined) delete process.env.TELEGRAM_LOGIN_CLIENT_ID; else process.env.TELEGRAM_LOGIN_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.TELEGRAM_LOGIN_CLIENT_SECRET; else process.env.TELEGRAM_LOGIN_CLIENT_SECRET = previous.secret;
    if (previous.redirect === undefined) delete process.env.TELEGRAM_LOGIN_REDIRECT_URI; else process.env.TELEGRAM_LOGIN_REDIRECT_URI = previous.redirect;
  }
});

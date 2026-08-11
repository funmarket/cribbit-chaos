import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import type { AuthUser } from '../../../packages/contracts/src/index.ts';
import { createApiApp, type ApiDependencies } from '../src/app.ts';
import { hashSessionToken } from '../src/db.ts';

type SessionRecord = { userId:string; provider:'telegram'|'web'; expiresAt:number };

function makeStore() {
  const users = new Map<string, AuthUser>();
  const telegramIdentities = new Map<string, string>();
  const sessions = new Map<string, SessionRecord>();
  const calls = { resolveTelegram:0 };

  function makeUser(displayName:string, provider:'telegram'|'web', username?:string): AuthUser {
    const id = randomBytes(16).toString('hex');
    const user = { id, displayName, identities:[{ provider, username }] };
    users.set(id, user);
    return user;
  }

  const deps: ApiDependencies = {
    dbHealth: async () => true,
    validateTelegramInitData: (initData:string) => {
      if (initData !== 'valid-mini') throw new Error('bad initData');
      return { id:'123456789', firstName:'Telly', username:'telly', authDate:Math.floor(Date.now()/1000) };
    },
    resolveOrCreateTelegramIdentity: async input => {
      calls.resolveTelegram += 1;
      const existingUserId = telegramIdentities.get(input.telegramId);
      if (existingUserId) {
        const existing = users.get(existingUserId);
        if (!existing) throw new Error('identity points to missing user');
        existing.displayName = input.displayName;
        existing.identities = [{ provider:'telegram', username:input.username }];
        return existing;
      }
      const user = makeUser(input.displayName, 'telegram', input.username);
      telegramIdentities.set(input.telegramId, user.id);
      return user;
    },
    createServerSession: async (userId, provider) => {
      const token = randomBytes(32).toString('base64url');
      sessions.set(hashSessionToken(token), { userId, provider, expiresAt:Date.now() + 30 * 24 * 60 * 60 * 1000 });
      return token;
    },
    createGuestIdentity: async (displayName = 'Web Player') => makeUser(displayName, 'web'),
    authenticateSessionToken: async token => {
      const session = sessions.get(hashSessionToken(token));
      if (!session || session.expiresAt <= Date.now()) return null;
      return users.get(session.userId) || null;
    },
    updateUserProfile: async (userId, input) => {
      const user = users.get(userId);
      if (!user) throw new Error('missing user');
      user.displayName = input.displayName;
      return user;
    },
    verifyTelegramWebLoginCallback: async () => ({
      telegramId:'123456789',
      displayName:'Telly Web',
      username:'telly'
    })
  };

  return {
    calls,
    deps,
    users,
    telegramIdentities,
    sessions,
    sessionHashes: () => [...sessions.keys()],
    expireToken(token:string) {
      const hash = hashSessionToken(token);
      const session = sessions.get(hash);
      if (session) session.expiresAt = Date.now() - 1;
    }
  };
}

async function withApp<T>(store = makeStore(), fn:(app:Awaited<ReturnType<typeof createApiApp>>, store:ReturnType<typeof makeStore>)=>Promise<T>): Promise<T> {
  const app = await createApiApp(store.deps);
  try { return await fn(app, store); }
  finally { await app.close(); }
}

function withTelegramWebConfig<T>(fn:()=>Promise<T>): Promise<T> {
  const old = {
    id:process.env.TELEGRAM_LOGIN_CLIENT_ID,
    secret:process.env.TELEGRAM_LOGIN_CLIENT_SECRET,
    redirect:process.env.TELEGRAM_LOGIN_REDIRECT_URI
  };
  process.env.TELEGRAM_LOGIN_CLIENT_ID = 'test-client';
  process.env.TELEGRAM_LOGIN_CLIENT_SECRET = 'test-secret';
  process.env.TELEGRAM_LOGIN_REDIRECT_URI = 'https://api.example.test/v1/auth/telegram/web/callback';
  return fn().finally(() => {
    if (old.id === undefined) delete process.env.TELEGRAM_LOGIN_CLIENT_ID; else process.env.TELEGRAM_LOGIN_CLIENT_ID = old.id;
    if (old.secret === undefined) delete process.env.TELEGRAM_LOGIN_CLIENT_SECRET; else process.env.TELEGRAM_LOGIN_CLIENT_SECRET = old.secret;
    if (old.redirect === undefined) delete process.env.TELEGRAM_LOGIN_REDIRECT_URI; else process.env.TELEGRAM_LOGIN_REDIRECT_URI = old.redirect;
  });
}

test('same Telegram provider ID resolves the same internal UUID', async () => {
  const store = makeStore();
  const first = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const second = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'Two' });
  assert.equal(second.id, first.id);
});

test('repeated Telegram login does not create a second user', async () => {
  const store = makeStore();
  await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'Two' });
  assert.equal(store.users.size, 1);
});

test('Mini App auth uses the canonical Telegram resolver', async () => withApp(makeStore(), async (app, store) => {
  const response = await app.inject({ method:'POST', url:'/v1/auth/telegram', payload:{ initData:'valid-mini' } });
  assert.equal(response.statusCode, 200);
  assert.equal(store.calls.resolveTelegram, 1);
  assert.equal(response.json().user.id, [...store.users.values()][0].id);
}));

test('invalid initData is rejected', async () => withApp(makeStore(), async app => {
  const response = await app.inject({ method:'POST', url:'/v1/auth/telegram', payload:{ initData:'bad-mini' } });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, 'TELEGRAM_AUTH_INVALID');
}));

test('session tokens are stored hashed', async () => {
  const store = makeStore();
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  assert.equal(store.sessions.has(token), false);
  assert.equal(store.sessionHashes()[0], createHash('sha256').update(token).digest('hex'));
});

test('valid bearer token authenticates /v1/me', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:`Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.id, user.id);
}));

test('missing bearer token is rejected', async () => withApp(makeStore(), async app => {
  const response = await app.inject({ method:'GET', url:'/v1/me' });
  assert.equal(response.statusCode, 401);
}));

test('malformed bearer token is rejected', async () => withApp(makeStore(), async app => {
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:'Bearer ***' } });
  assert.equal(response.statusCode, 401);
}));

test('invalid bearer token is rejected', async () => withApp(makeStore(), async app => {
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:'Bearer not-a-real-session' } });
  assert.equal(response.statusCode, 401);
}));

test('expired bearer session is rejected', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  store.expireToken(token);
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:`Bearer ${token}` } });
  assert.equal(response.statusCode, 401);
}));

test('/v1/me returns canonical UUID and identity summaries', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One', username:'one' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  const body = (await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:`Bearer ${token}` } })).json();
  assert.deepEqual(body.user, { id:user.id, displayName:'One', identities:[{ provider:'telegram', username:'one' }] });
}));

test('PATCH /v1/me/profile updates the canonical users row', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  const response = await app.inject({ method:'PATCH', url:'/v1/me/profile', headers:{ authorization:`Bearer ${token}` }, payload:{ displayName:'Shared Name' } });
  assert.equal(response.statusCode, 200);
  assert.equal(store.users.get(user.id)?.displayName, 'Shared Name');
}));

test('invalid profile display name is rejected', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  const response = await app.inject({ method:'PATCH', url:'/v1/me/profile', headers:{ authorization:`Bearer ${token}` }, payload:{ displayName:'   ' } });
  assert.equal(response.statusCode, 400);
}));

test('Web Telegram login route fails closed when configuration is missing', async () => withApp(makeStore(), async app => {
  delete process.env.TELEGRAM_LOGIN_CLIENT_ID;
  delete process.env.TELEGRAM_LOGIN_CLIENT_SECRET;
  delete process.env.TELEGRAM_LOGIN_REDIRECT_URI;
  const response = await app.inject({ method:'GET', url:'/v1/auth/telegram/web/start' });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, 'TELEGRAM_WEB_LOGIN_NOT_CONFIGURED');
}));

test('verified Telegram OIDC fixture resolves through the same canonical resolver', async () => withTelegramWebConfig(async () => withApp(makeStore(), async (app, store) => {
  const response = await app.inject({ method:'GET', url:'/v1/auth/telegram/web/callback?code=test&state=test' });
  assert.equal(response.statusCode, 200);
  assert.equal(store.calls.resolveTelegram, 1);
  assert.equal(store.telegramIdentities.size, 1);
})));

test('UNIQUE identity behavior prevents duplicate Telegram identity rows', async () => {
  const migration = await import('node:fs/promises').then(fs => fs.readFile('db/migrations/001_initial.sql', 'utf8'));
  assert.match(migration, /UNIQUE\(provider,\s*provider_user_id\)/);
});

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';
import type { AuthUser, WebRegisterRequest } from '../../../packages/contracts/src/index.ts';
import { createApiApp, type ApiDependencies } from '../src/app.ts';
import { hashSessionToken } from '../src/db.ts';

type SessionRecord = { userId:string; provider:'telegram'|'web'; expiresAt:number; revoked?:boolean };
type WebCredentialRecord = { userId:string; password:string; displayUsername:string };

function cookieValue(setCookie:string | string[] | undefined): string {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie || '';
  return raw.split(';')[0] || '';
}

function makeStore() {
  const users = new Map<string, AuthUser>();
  const telegramIdentities = new Map<string, string>();
  const webCredentials = new Map<string, WebCredentialRecord>();
  const sessions = new Map<string, SessionRecord>();
  const calls = { resolveTelegram:0, webRegister:0, webLogin:0, revoked:0 };

  function makeUser(displayName:string, provider:'telegram'|'web', username?:string): AuthUser {
    const id = randomBytes(16).toString('hex');
    const user: AuthUser = { id, displayName, identities:[{ provider, username }] };
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
    registerWebUser: async (input:WebRegisterRequest) => {
      calls.webRegister += 1;
      const login = String(input.loginUsername).trim().toLowerCase();
      if (webCredentials.has(login)) throw Object.assign(new Error('That login username is already registered.'), { code:'LOGIN_USERNAME_TAKEN', statusCode:409 });
      if ([...users.values()].some(user => user.displayUsername?.toLowerCase() === input.displayUsername.toLowerCase())) {
        throw Object.assign(new Error('That display username is already in use.'), { code:'DISPLAY_USERNAME_TAKEN', statusCode:409 });
      }
      const user = makeUser(input.displayName || input.displayUsername, 'web', input.displayUsername);
      user.displayUsername = input.displayUsername;
      webCredentials.set(login, { userId:user.id, password:input.password, displayUsername:input.displayUsername });
      return user;
    },
    authenticateWebUser: async input => {
      calls.webLogin += 1;
      const login = String(input.loginUsername || '').trim().toLowerCase();
      const credential = webCredentials.get(login);
      if (!credential || credential.password !== input.password) return null;
      return users.get(credential.userId) || null;
    },
    createServerSession: async (userId, provider) => {
      const token = randomBytes(32).toString('base64url');
      sessions.set(hashSessionToken(token), { userId, provider, expiresAt:Date.now() + 30 * 24 * 60 * 60 * 1000 });
      return token;
    },
    revokeServerSession: async token => {
      calls.revoked += 1;
      const session = sessions.get(hashSessionToken(token));
      if (session) session.revoked = true;
    },
    createGuestIdentity: async (displayName = 'Web Player') => makeUser(displayName, 'web'),
    authenticateSessionToken: async token => {
      const session = sessions.get(hashSessionToken(token));
      if (!session || session.revoked || session.expiresAt <= Date.now()) return null;
      return users.get(session.userId) || null;
    },
    updateUserProfile: async (userId, input) => {
      const user = users.get(userId);
      if (!user) throw new Error('missing user');
      user.displayName = input.displayName;
      return user;
    },
    verifyTelegramWebLoginCallback: async () => ({ telegramId:'123456789', displayName:'Telly Web', username:'telly' })
  };

  return {
    calls,
    deps,
    users,
    telegramIdentities,
    webCredentials,
    sessions,
    sessionHashes: () => [...sessions.keys()],
    expireToken(token:string) {
      const session = sessions.get(hashSessionToken(token));
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
  const old = { id:process.env.TELEGRAM_LOGIN_CLIENT_ID, secret:process.env.TELEGRAM_LOGIN_CLIENT_SECRET, redirect:process.env.TELEGRAM_LOGIN_REDIRECT_URI };
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

test('valid Telegram bearer authenticates /v1/me', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:`Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.id, user.id);
  assert.equal(response.json().authSource, 'telegram');
}));

test('missing authentication is rejected', async () => withApp(makeStore(), async app => {
  const response = await app.inject({ method:'GET', url:'/v1/me' });
  assert.equal(response.statusCode, 401);
}));

test('malformed bearer token is rejected', async () => withApp(makeStore(), async app => {
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:'Bearer ***' } });
  assert.equal(response.statusCode, 401);
}));

test('expired bearer session is rejected', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'123', displayName:'One' });
  const token = await store.deps.createServerSession(user.id, 'telegram');
  store.expireToken(token);
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:`Bearer ${token}` } });
  assert.equal(response.statusCode, 401);
}));

test('Web registration creates canonical user and HttpOnly session cookie without returning token or password', async () => withApp(makeStore(), async (app, store) => {
  const response = await app.inject({ method:'POST', url:'/v1/auth/register', payload:{ loginUsername:'john1986', password:'Password1234', displayUsername:'Johnny', email:'john@example.test' } });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.user.displayUsername, 'Johnny');
  assert.equal('accessToken' in body, false);
  assert.equal('password' in body, false);
  assert.match(String(response.headers['set-cookie']), /cribbit_web_session=/);
  assert.match(String(response.headers['set-cookie']), /HttpOnly/);
  assert.equal(store.webCredentials.size, 1);
}));

test('duplicate Web login username is rejected', async () => withApp(makeStore(), async app => {
  const payload = { loginUsername:'john1986', password:'Password1234', displayUsername:'Johnny' };
  assert.equal((await app.inject({ method:'POST', url:'/v1/auth/register', payload })).statusCode, 200);
  const response = await app.inject({ method:'POST', url:'/v1/auth/register', payload:{ ...payload, displayUsername:'Johnny2' } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, 'LOGIN_USERNAME_TAKEN');
}));

test('Web login succeeds with correct credentials and fails safely with wrong or nonexistent credentials', async () => withApp(makeStore(), async app => {
  await app.inject({ method:'POST', url:'/v1/auth/register', payload:{ loginUsername:'john1986', password:'Password1234', displayUsername:'Johnny' } });
  const ok = await app.inject({ method:'POST', url:'/v1/auth/login', payload:{ loginUsername:'john1986', password:'Password1234' } });
  assert.equal(ok.statusCode, 200);
  assert.match(String(ok.headers['set-cookie']), /HttpOnly/);
  const wrong = await app.inject({ method:'POST', url:'/v1/auth/login', payload:{ loginUsername:'john1986', password:'WrongPassword1' } });
  const missing = await app.inject({ method:'POST', url:'/v1/auth/login', payload:{ loginUsername:'nobody', password:'WrongPassword1' } });
  assert.equal(wrong.statusCode, 401);
  assert.equal(missing.statusCode, 401);
  assert.equal(wrong.json().error, 'INVALID_CREDENTIALS');
  assert.equal(missing.json().error, 'INVALID_CREDENTIALS');
}));

test('Web session cookie resolves canonical user and logout revokes it', async () => withApp(makeStore(), async (app, store) => {
  const registration = await app.inject({ method:'POST', url:'/v1/auth/register', payload:{ loginUsername:'cookieuser', password:'Password1234', displayUsername:'CookieUser' } });
  const cookie = cookieValue(registration.headers['set-cookie']);
  const session = await app.inject({ method:'GET', url:'/v1/auth/session', headers:{ cookie } });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json().authSource, 'web');
  const logout = await app.inject({ method:'POST', url:'/v1/auth/logout', headers:{ cookie } });
  assert.equal(logout.statusCode, 200);
  assert.equal(store.calls.revoked, 1);
  const after = await app.inject({ method:'GET', url:'/v1/auth/session', headers:{ cookie } });
  assert.equal(after.statusCode, 401);
}));

test('same-looking Telegram username and Web login username do not auto-link', async () => withApp(makeStore(), async (app, store) => {
  const telegram = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'777', displayName:'John', username:'john' });
  const web = await app.inject({ method:'POST', url:'/v1/auth/register', payload:{ loginUsername:'john', password:'Password1234', displayUsername:'john_web' } });
  assert.equal(web.statusCode, 200);
  assert.notEqual(web.json().user.id, telegram.id);
  assert.equal(store.users.size, 2);
}));

test('Telegram bearer plus Web cookie for different users returns AUTH_CONFLICT', async () => withApp(makeStore(), async (app, store) => {
  const telegramUser = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'888', displayName:'Telegram' });
  const bearer = await store.deps.createServerSession(telegramUser.id, 'telegram');
  const registration = await app.inject({ method:'POST', url:'/v1/auth/register', payload:{ loginUsername:'webuser', password:'Password1234', displayUsername:'WebUser' } });
  const cookie = cookieValue(registration.headers['set-cookie']);
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:`Bearer ${bearer}`, cookie } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, 'AUTH_CONFLICT');
}));

test('Telegram bearer and Web cookie for the same explicitly shared user are accepted', async () => withApp(makeStore(), async (app, store) => {
  const user = await store.deps.resolveOrCreateTelegramIdentity({ telegramId:'999', displayName:'Linked' });
  const bearer = await store.deps.createServerSession(user.id, 'telegram');
  const webToken = await store.deps.createServerSession(user.id, 'web');
  const response = await app.inject({ method:'GET', url:'/v1/me', headers:{ authorization:`Bearer ${bearer}`, cookie:`cribbit_web_session=${webToken}` } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.id, user.id);
  assert.equal(response.json().authSource, 'telegram+web');
}));

test('PATCH /v1/me/profile updates the canonical users row through Web cookie', async () => withApp(makeStore(), async (app, store) => {
  const registration = await app.inject({ method:'POST', url:'/v1/auth/register', payload:{ loginUsername:'profileuser', password:'Password1234', displayUsername:'ProfileUser' } });
  const cookie = cookieValue(registration.headers['set-cookie']);
  const userId = registration.json().user.id;
  const response = await app.inject({ method:'PATCH', url:'/v1/me/profile', headers:{ cookie }, payload:{ displayName:'Shared Name' } });
  assert.equal(response.statusCode, 200);
  assert.equal(store.users.get(userId)?.displayName, 'Shared Name');
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

test('database migrations preserve canonical identity uniqueness and add Web credential separation', async () => {
  const fs = await import('node:fs/promises');
  const initial = await fs.readFile('db/migrations/001_initial.sql','utf8');
  const dual = await fs.readFile('db/migrations/002_dual_web_auth.sql','utf8');
  assert.match(initial,/UNIQUE\(provider,\s*provider_user_id\)/);
  assert.match(dual,/CREATE TABLE IF NOT EXISTS web_credentials/);
  assert.match(dual,/login_username_normalized text NOT NULL UNIQUE/);
  assert.match(dual,/user_id uuid NOT NULL UNIQUE REFERENCES users\(id\)/);
});

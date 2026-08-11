import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiApp, guestAuthEnabled, type ApiDependencies } from '../src/app.ts';
import type { AuthUser } from '../../../packages/contracts/src/index.ts';

function deps(): ApiDependencies {
  const user: AuthUser = { id:'00000000-0000-4000-8000-000000000001', displayName:'Web Player', identities:[{ provider:'web' }] };
  return {
    dbHealth: async () => true,
    validateTelegramInitData: () => { throw new Error('not used'); },
    resolveOrCreateTelegramIdentity: async () => user,
    createServerSession: async () => 'guest-session-token',
    createGuestIdentity: async () => ({ id:user.id, displayName:user.displayName }),
    authenticateSessionToken: async () => null,
    updateUserProfile: async () => user,
    verifyTelegramWebLoginCallback: async () => { throw new Error('not used'); }
  };
}

test('guest auth is disabled by default', () => {
  assert.equal(guestAuthEnabled({}), false);
});

test('guest auth requires explicit opt-in outside production', () => {
  assert.equal(guestAuthEnabled({ APP_ENV:'development', ALLOW_GUEST_AUTH:'true' }), true);
  assert.equal(guestAuthEnabled({ APP_ENV:'preview', ALLOW_GUEST_AUTH:'true' }), true);
  assert.equal(guestAuthEnabled({ APP_ENV:'development', ALLOW_GUEST_AUTH:'false' }), false);
});

test('guest auth can never be enabled in production', () => {
  assert.equal(guestAuthEnabled({ APP_ENV:'production', ALLOW_GUEST_AUTH:'true' }), false);
  assert.equal(guestAuthEnabled({ NODE_ENV:'production', ALLOW_GUEST_AUTH:'true' }), false);
});

test('guest auth endpoint fails closed when disabled', async () => {
  const oldAppEnv = process.env.APP_ENV;
  const oldAllow = process.env.ALLOW_GUEST_AUTH;
  process.env.APP_ENV = 'production';
  process.env.ALLOW_GUEST_AUTH = 'true';
  const app = await createApiApp(deps());
  try {
    const response = await app.inject({ method:'POST', url:'/v1/auth/guest' });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, 'GUEST_AUTH_DISABLED');
  } finally {
    await app.close();
    if (oldAppEnv === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = oldAppEnv;
    if (oldAllow === undefined) delete process.env.ALLOW_GUEST_AUTH; else process.env.ALLOW_GUEST_AUTH = oldAllow;
  }
});

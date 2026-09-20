import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiApp, type ApiDependencies } from '../src/app.ts';
import type { AuthUser, GameCommand } from '../../../packages/contracts/src/index.ts';

const user: AuthUser = {
  id:'user-command-boundary',
  displayName:'Command Boundary',
  identities:[{ provider:'web' }],
};

function deps(): ApiDependencies {
  return {
    dbHealth: async () => true,
    validateTelegramInitData: () => { throw new Error('not used'); },
    resolveOrCreateTelegramIdentity: async () => user,
    registerWebUser: async () => user,
    authenticateWebUser: async () => user,
    createServerSession: async () => 'test-session-token',
    revokeServerSession: async () => undefined,
    createGuestIdentity: async () => ({ id:user.id, displayName:user.displayName }),
    authenticateSessionToken: async token => token === 'valid-command-token' ? user : null,
    updateUserProfile: async () => user,
    linkTelegramIdentity: async () => { throw new Error('not used'); },
    verifyTelegramWebLoginCallback: async () => { throw new Error('not used'); },
  };
}

async function withApp<T>(fn:(app:Awaited<ReturnType<typeof createApiApp>>)=>Promise<T>): Promise<T> {
  const app = await createApiApp(deps());
  try { return await fn(app); }
  finally { await app.close(); }
}

function command(overrides:Partial<GameCommand> = {}): GameCommand {
  return {
    type:'DRAW_CARD',
    commandId:'cmd-boundary-1',
    playerId:user.id,
    expectedRevision:0,
    sessionId:'session-a',
    ...overrides,
  } as GameCommand;
}

test('game command route requires authentication before accepting commands', async () => withApp(async app => {
  const response = await app.inject({
    method:'POST',
    url:'/v1/games/session-a/commands',
    payload:command(),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, 'AUTH_REQUIRED');
}));

test('game command route rejects session mismatch before database mutation', async () => withApp(async app => {
  const response = await app.inject({
    method:'POST',
    url:'/v1/games/session-a/commands',
    headers:{ authorization:'Bearer valid-command-token' },
    payload:command({ sessionId:'session-b' }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'SESSION_MISMATCH');
}));

test('game command route rejects commands for a different player before database mutation', async () => withApp(async app => {
  const response = await app.inject({
    method:'POST',
    url:'/v1/games/session-a/commands',
    headers:{ authorization:'Bearer valid-command-token' },
    payload:command({ playerId:'other-player' }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, 'PLAYER_MISMATCH');
}));
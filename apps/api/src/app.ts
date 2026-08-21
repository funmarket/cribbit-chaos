import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import type { AuthUser, GameCommand, WebLoginRequest, WebRegisterRequest } from '../../../packages/contracts/src/index.ts';
import { ACTION_ASSIGNMENTS } from '../../../packages/action-registry/src/index.ts';
import {
  authenticateSessionToken,
  authenticateWebUser,
  createGuestIdentity,
  createServerSession,
  dbHealth,
  registerWebUser,
  resolveOrCreateTelegramIdentity,
  revokeServerSession,
  updateUserProfile
} from './db.ts';
import {
  createRoomAndSession,
  getSessionSnapshot,
  joinRoomByCode,
  processSessionCommand,
  type RoomCreateInput,
} from './game-service.ts';
import { validateTelegramInitData } from './telegram-auth.ts';

type TelegramIdentityInput = { telegramId:string; displayName:string; username?:string };
type SessionProvider = 'telegram' | 'web';
type SessionBroadcaster = { to(room:string): { emit(event:string, payload:unknown): void } };
type AuthSource = 'telegram' | 'web' | 'telegram+web';
export type CurrentPrincipal = { user:AuthUser; userId:string; authSource:AuthSource; bearerToken?:string; webSessionToken?:string };

const WEB_SESSION_COOKIE = 'cribbit_web_session';
const WEB_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface ApiDependencies {
  dbHealth: () => Promise<boolean>;
  validateTelegramInitData: typeof validateTelegramInitData;
  resolveOrCreateTelegramIdentity: (input:TelegramIdentityInput) => Promise<AuthUser>;
  registerWebUser: (input:WebRegisterRequest) => Promise<AuthUser>;
  authenticateWebUser: (input:{loginUsername:unknown; password:unknown; ipHash:string}) => Promise<AuthUser | null>;
  createServerSession: (userId:string, provider:SessionProvider) => Promise<string>;
  revokeServerSession: (token:string) => Promise<void>;
  createGuestIdentity: (displayName?:string) => Promise<{ id:string; displayName:string }>;
  authenticateSessionToken: (token:string) => Promise<AuthUser | null>;
  updateUserProfile: (userId:string, input:{ displayName:string }) => Promise<AuthUser>;
  verifyTelegramWebLoginCallback: (query:Record<string, unknown>) => Promise<TelegramIdentityInput>;
}

export const defaultDependencies: ApiDependencies = {
  dbHealth,
  validateTelegramInitData,
  resolveOrCreateTelegramIdentity,
  registerWebUser,
  authenticateWebUser,
  createServerSession,
  revokeServerSession,
  createGuestIdentity,
  authenticateSessionToken,
  updateUserProfile,
  verifyTelegramWebLoginCallback: async () => {
    throw Object.assign(new Error('Telegram Web Login OIDC verification is not configured.'), {
      code:'TELEGRAM_WEB_LOGIN_NOT_CONFIGURED',
      statusCode:503
    });
  }
};

function displayNameFromTelegram(tg:{ firstName?:string; lastName?:string; username?:string }): string {
  return [tg.firstName, tg.lastName].filter(Boolean).join(' ') || tg.username || 'Telegram Player';
}

function telegramWebLoginConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_LOGIN_CLIENT_ID &&
    process.env.TELEGRAM_LOGIN_CLIENT_SECRET &&
    process.env.TELEGRAM_LOGIN_REDIRECT_URI
  );
}

export function guestAuthEnabled(env:NodeJS.ProcessEnv = process.env): boolean {
  const runtime = String(env.APP_ENV || env.NODE_ENV || 'development').trim().toLowerCase();
  return runtime !== 'production' && env.ALLOW_GUEST_AUTH === 'true';
}

function readBearerToken(request:any): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(header.trim());
  return match?.[1] || null;
}

function parseCookies(header:unknown): Record<string,string> {
  if (typeof header !== 'string' || !header.trim()) return {};
  const result: Record<string,string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try { result[key] = decodeURIComponent(value); }
    catch { result[key] = value; }
  }
  return result;
}

function readWebSessionToken(request:any): string | null {
  return parseCookies(request.headers.cookie)[WEB_SESSION_COOKIE] || null;
}

function productionRuntime(): boolean {
  return String(process.env.APP_ENV || process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function webSessionCookie(token:string): string {
  const attributes = [
    `${WEB_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${WEB_SESSION_MAX_AGE_SECONDS}`,
    productionRuntime() ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (productionRuntime()) attributes.push('Secure');
  return attributes.join('; ');
}

function clearWebSessionCookie(): string {
  const attributes = [
    `${WEB_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    productionRuntime() ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (productionRuntime()) attributes.push('Secure');
  return attributes.join('; ');
}

function requestIpHash(request:any): string {
  const value = String(request.ip || request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  return createHash('sha256').update(value).digest('hex');
}

function assertAllowedMutationOrigin(request:any, allowedOrigins:string[]): void {
  if (!allowedOrigins.length) return;
  const origin = typeof request.headers.origin === 'string' ? request.headers.origin : '';
  if (!allowedOrigins.includes(origin)) {
    throw Object.assign(new Error('Request origin is not allowed for cookie-authenticated mutation.'), { code:'CSRF_ORIGIN_REJECTED', statusCode:403 });
  }
}

export async function authenticatePrincipal(request:any, deps:ApiDependencies): Promise<CurrentPrincipal> {
  const bearerToken = readBearerToken(request);
  const webSessionToken = readWebSessionToken(request);
  if (!bearerToken && !webSessionToken) {
    throw Object.assign(new Error('Authentication is required.'), { code:'AUTH_REQUIRED', statusCode:401 });
  }

  const bearerUser = bearerToken ? await deps.authenticateSessionToken(bearerToken) : null;
  const webUser = webSessionToken ? await deps.authenticateSessionToken(webSessionToken) : null;

  if (bearerToken && !bearerUser) {
    throw Object.assign(new Error('Invalid or expired bearer token.'), { code:'AUTH_INVALID', statusCode:401 });
  }
  if (webSessionToken && !webUser) {
    throw Object.assign(new Error('Invalid or expired Web session.'), { code:'AUTH_INVALID', statusCode:401 });
  }
  if (bearerUser && webUser && bearerUser.id !== webUser.id) {
    throw Object.assign(new Error('Telegram and Web credentials resolve to different Cribbit users.'), { code:'AUTH_CONFLICT', statusCode:409 });
  }

  const user = bearerUser || webUser;
  if (!user) throw Object.assign(new Error('Authentication is required.'), { code:'AUTH_REQUIRED', statusCode:401 });
  const authSource: AuthSource = bearerUser && webUser ? 'telegram+web' : bearerUser ? 'telegram' : 'web';
  return {
    user,
    userId:user.id,
    authSource,
    ...(bearerToken ? { bearerToken } : {}),
    ...(webSessionToken ? { webSessionToken } : {}),
  };
}

// Backward-compatible exported name for existing tests/callers. It now resolves
// either authentication adapter rather than assuming a Telegram bearer token.
export async function authenticateBearer(request:any, deps:ApiDependencies): Promise<AuthUser> {
  return (await authenticatePrincipal(request, deps)).user;
}

function profileDisplayName(value:unknown): string {
  if (typeof value !== 'string') throw Object.assign(new Error('displayName must be a string.'), { code:'INVALID_PROFILE_DISPLAY_NAME', statusCode:400 });
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 40) throw Object.assign(new Error('displayName must be 1 to 40 characters.'), { code:'INVALID_PROFILE_DISPLAY_NAME', statusCode:400 });
  return trimmed;
}

function authError(reply:any, error:unknown) {
  const err = error as { code?:string; statusCode?:number; message?:string };
  return reply.code(err.statusCode || 401).send({ error:err.code || 'AUTH_INVALID', message:err.message || 'Authentication failed.' });
}

function routeError(reply:any, error:unknown) {
  const err = error as { code?:string; statusCode?:number; message?:string };
  return reply.code(err.statusCode || 500).send({ ok:false, error:err.code || 'SERVER_ERROR', message:err.message || 'Request failed.' });
}

export async function createApiApp(deps:ApiDependencies = defaultDependencies) {
  const app = Fastify({ logger:true, trustProxy:true });
  const allowedOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map((v:string)=>v.trim()).filter(Boolean);
  await app.register(cors, {
    credentials:true,
    origin(origin:any, cb:any) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'), false);
    }
  });

  const io = new SocketIOServer(app.server, {
    path:'/v1/realtime',
    cors:{ origin:allowedOrigins.length ? allowedOrigins : true, credentials:true },
    transports:['polling','websocket']
  });
  const sessions = io as unknown as SessionBroadcaster;

  const principal = async (request:any): Promise<CurrentPrincipal> => {
    const resolved = await authenticatePrincipal(request, deps);
    if (resolved.webSessionToken && !resolved.bearerToken && !['GET','HEAD','OPTIONS'].includes(request.method)) {
      assertAllowedMutationOrigin(request, allowedOrigins);
    }
    return resolved;
  };

  app.get('/health', async () => ({ ok:true, service:'cribbit-chaos-api', database:await deps.dbHealth(), time:new Date().toISOString() }));
  app.get('/v1/meta/action-map', async () => ({ actions:ACTION_ASSIGNMENTS }));

  app.post('/v1/auth/telegram', async (request:any, reply:any) => {
    const body = request.body as { initData?:string };
    try {
      const tg = deps.validateTelegramInitData(body?.initData || '', process.env.TELEGRAM_BOT_TOKEN || '', Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS || 3600));
      const user = await deps.resolveOrCreateTelegramIdentity({
        telegramId:tg.id,
        displayName:displayNameFromTelegram(tg),
        username:tg.username
      });
      const accessToken = await deps.createServerSession(user.id, 'telegram');
      return { accessToken, user };
    } catch (error) {
      return authError(reply, Object.assign(error instanceof Error ? error : new Error('Invalid Telegram authentication.'), { code:'TELEGRAM_AUTH_INVALID', statusCode:401 }));
    }
  });

  app.post('/v1/auth/register', async (request:any, reply:any) => {
    try {
      assertAllowedMutationOrigin(request, allowedOrigins);
      const user = await deps.registerWebUser((request.body ?? {}) as WebRegisterRequest);
      const sessionToken = await deps.createServerSession(user.id, 'web');
      reply.header('set-cookie', webSessionCookie(sessionToken));
      return { user };
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.post('/v1/auth/login', async (request:any, reply:any) => {
    try {
      assertAllowedMutationOrigin(request, allowedOrigins);
      const body = (request.body ?? {}) as WebLoginRequest;
      const user = await deps.authenticateWebUser({
        loginUsername:body.loginUsername,
        password:body.password,
        ipHash:requestIpHash(request),
      });
      if (!user) {
        throw Object.assign(new Error('Invalid username or password.'), { code:'INVALID_CREDENTIALS', statusCode:401 });
      }
      const sessionToken = await deps.createServerSession(user.id, 'web');
      reply.header('set-cookie', webSessionCookie(sessionToken));
      return { user };
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.post('/v1/auth/logout', async (request:any, reply:any) => {
    try {
      assertAllowedMutationOrigin(request, allowedOrigins);
      const token = readWebSessionToken(request);
      if (token) await deps.revokeServerSession(token);
      reply.header('set-cookie', clearWebSessionCookie());
      return { ok:true };
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.get('/v1/auth/session', async (request:any, reply:any) => {
    try {
      const current = await authenticatePrincipal(request, deps);
      return { user:current.user, authSource:current.authSource };
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.post('/v1/auth/guest', async (_request:any, reply:any) => {
    if (!guestAuthEnabled()) {
      return reply.code(403).send({ error:'GUEST_AUTH_DISABLED', message:'Guest authentication is disabled. Use Telegram or Web authentication.' });
    }
    try {
      const user = await deps.createGuestIdentity('Web Player');
      const accessToken = await deps.createServerSession(user.id, 'web');
      return { accessToken, user:{ id:user.id, displayName:user.displayName, identities:[{ provider:'web' }] } };
    } catch (error) {
      return reply.code(503).send({ error:'DATABASE_UNAVAILABLE', message:error instanceof Error ? error.message : 'Database unavailable.' });
    }
  });

  app.get('/v1/auth/telegram/web/configuration', async () => (
    telegramWebLoginConfigured() ? { configured:true } : { configured:false, error:'TELEGRAM_WEB_LOGIN_NOT_CONFIGURED' }
  ));
  app.get('/v1/auth/telegram/web/start', async (_request:any, reply:any) => {
    if (!telegramWebLoginConfigured()) return reply.code(503).send({ error:'TELEGRAM_WEB_LOGIN_NOT_CONFIGURED' });
    return reply.code(501).send({ error:'TELEGRAM_WEB_LOGIN_NOT_IMPLEMENTED' });
  });
  app.get('/v1/auth/telegram/web/callback', async (request:any, reply:any) => {
    if (!telegramWebLoginConfigured()) return reply.code(503).send({ error:'TELEGRAM_WEB_LOGIN_NOT_CONFIGURED' });
    try {
      const identity = await deps.verifyTelegramWebLoginCallback(request.query as Record<string, unknown>);
      const user = await deps.resolveOrCreateTelegramIdentity(identity);
      const accessToken = await deps.createServerSession(user.id, 'telegram');
      return { accessToken, user };
    } catch (error) {
      return authError(reply, error);
    }
  });

  app.get('/v1/me', async (request:any, reply:any) => {
    try {
      const auth = await principal(request);
      return { user:auth.user, authSource:auth.authSource };
    } catch (error) {
      return authError(reply, error);
    }
  });
  app.patch('/v1/me/profile', async (request:any, reply:any) => {
    try {
      const auth = await principal(request);
      const body = request.body as { displayName?:unknown };
      const user = await deps.updateUserProfile(auth.userId, { displayName:profileDisplayName(body?.displayName) });
      return { user };
    } catch (error) {
      return authError(reply, error);
    }
  });
  app.get('/v1/me/notifications', async (_request:any, reply:any) => reply.code(501).send({ error:'NOTIFICATIONS_NOT_MIGRATED' }));

  app.post('/v1/rooms', async (request:any, reply:any) => {
    try {
      const auth = await principal(request);
      return await createRoomAndSession(auth.user, (request.body ?? {}) as RoomCreateInput);
    } catch (error) {
      return routeError(reply, error);
    }
  });

  app.post('/v1/rooms/join', async (request:any, reply:any) => {
    try {
      const auth = await principal(request);
      const { code } = request.body as { code?:string };
      if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) return reply.code(400).send({ ok:false, error:'INVALID_ROOM_CODE' });
      return await joinRoomByCode(auth.user, code);
    } catch (error) {
      return routeError(reply, error);
    }
  });

  app.patch('/v1/rooms/:roomId/config', async (_request:any, reply:any) => reply.code(501).send({ error:'ROOM_CONFIG_NOT_IMPLEMENTED' }));
  app.post('/v1/rooms/:roomId/start', async (_request:any, reply:any) => reply.code(409).send({ error:'SESSION_ALREADY_CREATED', message:'Room creation currently creates the authoritative session immediately.' }));
  app.post('/v1/rooms/:roomId/prompt-pool/:promptId', async (_request:any, reply:any) => reply.code(501).send({ error:'PROMPT_POOL_NOT_MIGRATED' }));
  app.delete('/v1/rooms/:roomId/prompt-pool/:promptId', async (_request:any, reply:any) => reply.code(501).send({ error:'PROMPT_POOL_NOT_MIGRATED' }));

  app.post('/v1/prompts', async (_request:any, reply:any) => reply.code(501).send({ error:'PROMPTS_NOT_MIGRATED' }));
  app.get('/v1/prompts/:promptId', async (_request:any, reply:any) => reply.code(501).send({ error:'PROMPTS_NOT_MIGRATED' }));
  app.post('/v1/prompts/:promptId/save', async (_request:any, reply:any) => reply.code(501).send({ error:'SAVED_PROMPTS_NOT_MIGRATED' }));
  app.post('/v1/moderation/submissions/:submissionId/advance', async (_request:any, reply:any) => reply.code(501).send({ error:'MODERATION_NOT_MIGRATED' }));

  app.get('/v1/games/:sessionId/snapshot', async (request:any, reply:any) => {
    try {
      const auth = await principal(request);
      const { sessionId } = request.params as { sessionId:string };
      return await getSessionSnapshot(auth.user, sessionId);
    } catch (error) {
      return routeError(reply, error);
    }
  });

  app.post('/v1/games/:sessionId/commands', async (request:any, reply:any) => {
    try {
      const auth = await principal(request);
      const { sessionId } = request.params as { sessionId:string };
      const body = request.body as GameCommand;
      if (!body?.type || !body.commandId || !body.playerId || !Number.isInteger(body.expectedRevision)) {
        return reply.code(400).send({ error:'INVALID_COMMAND_ENVELOPE' });
      }
      const response = await processSessionCommand(auth.user, sessionId, body);
      sessions.to(`game:${sessionId}`).emit('session-updated', { sessionId, revision:response.revision });
      return response;
    } catch (error) {
      return routeError(reply, error);
    }
  });
  app.post('/v1/games/:sessionId/rematch', async (_request:any, reply:any) => reply.code(501).send({ error:'REMATCH_NOT_IMPLEMENTED' }));

  io.on('connection', (socket:any) => {
    socket.on('join-session', (payload:{sessionId?:string}) => {
      if (!payload?.sessionId) return socket.emit('server-error',{code:'SESSION_REQUIRED'});
      void socket.join(`game:${payload.sessionId}`);
      socket.emit('joined-session',{sessionId:payload.sessionId});
    });
  });

  return app;
}

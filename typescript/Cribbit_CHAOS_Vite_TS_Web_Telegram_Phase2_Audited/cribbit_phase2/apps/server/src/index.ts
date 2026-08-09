import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { createGuestIdentity, createServerSession, dbHealth, upsertTelegramIdentity } from './db.ts';
import { validateTelegramInitData } from './telegram-auth.ts';
import { ACTION_ASSIGNMENTS } from '../../../packages/action-registry/src/index.ts';

const app = Fastify({ logger:true, trustProxy:true });
const allowedOrigins = (process.env.FRONTEND_ORIGINS || '').split(',').map((v:string)=>v.trim()).filter(Boolean);
await app.register(cors, {
  origin(origin:any, cb:any) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed'), false);
  },
  credentials:true
});

const io = new SocketIOServer(app.server, {
  path:'/v1/realtime',
  cors:{ origin: allowedOrigins.length ? allowedOrigins : true, credentials:true },
  transports:['polling','websocket']
});

app.get('/health', async () => ({ ok:true, service:'cribbit-chaos-api', database:await dbHealth(), time:new Date().toISOString() }));
app.get('/v1/meta/action-map', async () => ({ actions:ACTION_ASSIGNMENTS }));

app.post('/v1/auth/telegram', async (request:any, reply:any) => {
  const body = request.body as { initData?:string };
  try {
    const tg = validateTelegramInitData(body?.initData || '', process.env.TELEGRAM_BOT_TOKEN || '', Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS || 3600));
    const displayName = [tg.firstName,tg.lastName].filter(Boolean).join(' ') || tg.username || 'Telegram Player';
    const user = await upsertTelegramIdentity({ telegramId:tg.id, displayName, username:tg.username });
    const accessToken = await createServerSession(user.id, 'telegram');
    return { accessToken, user:{ id:user.id, displayName:user.displayName, provider:'telegram', telegramUserId:tg.id } };
  } catch (error) {
    return reply.code(401).send({ error:'TELEGRAM_AUTH_INVALID', message:error instanceof Error ? error.message : 'Invalid Telegram authentication.' });
  }
});

app.post('/v1/auth/guest', async (_request:any, reply:any) => {
  try {
    const user = await createGuestIdentity('Web Player');
    const accessToken = await createServerSession(user.id, 'web');
    return { accessToken, user:{ id:user.id, displayName:user.displayName, provider:'web' } };
  } catch (error) {
    return reply.code(503).send({ error:'DATABASE_UNAVAILABLE', message:error instanceof Error ? error.message : 'Database unavailable.' });
  }
});
app.get('/v1/me', async () => ({ id:'DEV_USER', displayName:'Development Player', provider:'web' }));
app.patch('/v1/me/profile', async (request:any) => ({ id:'DEV_USER', ...(request.body as object) }));
app.get('/v1/me/notifications', async () => ({ items:[] }));

app.post('/v1/rooms/join', async (request:any) => {
  const { code } = request.body as { code?:string };
  if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) return { ok:false, error:'INVALID_ROOM_CODE' };
  return { ok:true, roomId:`room_${code.toUpperCase()}` };
});
app.patch('/v1/rooms/:roomId/config', async (request:any) => ({ ok:true, roomId:(request.params as {roomId:string}).roomId, config:request.body }));
app.post('/v1/rooms/:roomId/start', async (request:any, reply:any) => reply.code(501).send({ error:'ENGINE_NOT_MIGRATED', roomId:(request.params as {roomId:string}).roomId, message:'Route is reserved for authoritative shuffle/deal/start after the reducer migration.' }));
app.post('/v1/rooms/:roomId/prompt-pool/:promptId', async (request:any) => ({ ok:true, ...request.params as object }));
app.delete('/v1/rooms/:roomId/prompt-pool/:promptId', async (request:any) => ({ ok:true, ...request.params as object }));

app.post('/v1/prompts', async (request:any) => ({ ok:true, status:'contract-only', prompt:request.body }));
app.get('/v1/prompts/:promptId', async (request:any) => ({ id:(request.params as {promptId:string}).promptId }));
app.post('/v1/prompts/:promptId/save', async (request:any) => ({ ok:true, promptId:(request.params as {promptId:string}).promptId, ...(request.body as object || {}) }));
app.post('/v1/moderation/submissions/:submissionId/advance', async (request:any) => ({ ok:true, submissionId:(request.params as {submissionId:string}).submissionId }));

app.get('/v1/games/:sessionId/snapshot', async (request:any, reply:any) => {
  // Contract is wired; Phase 3 replaces this guard with PostgreSQL-backed session snapshots.
  return reply.code(501).send({ error:'ENGINE_NOT_MIGRATED', message:'Authoritative game-state reducer has not yet been migrated from the V4 compatibility runtime.' });
});
app.post('/v1/games/:sessionId/commands', async (request:any, reply:any) => {
  const body = request.body as { type?:string; commandId?:string; expectedRevision?:number };
  if (!body?.type || !body.commandId || !Number.isInteger(body.expectedRevision)) return reply.code(400).send({ error:'INVALID_COMMAND_ENVELOPE' });
  return reply.code(501).send({ error:'ENGINE_NOT_MIGRATED', commandId:body.commandId, message:`${body.type} has a production backend assignment, but the authoritative reducer is intentionally not enabled until rule-state migration/tests pass.` });
});
app.post('/v1/games/:sessionId/rematch', async (request:any, reply:any) => reply.code(501).send({ error:'ENGINE_NOT_MIGRATED' }));

io.on('connection', (socket:any) => {
  socket.on('join-session', (payload:{sessionId?:string}) => {
    if (!payload?.sessionId) return socket.emit('server-error',{code:'SESSION_REQUIRED'});
    void socket.join(`game:${payload.sessionId}`);
    socket.emit('joined-session',{sessionId:payload.sessionId});
  });
  socket.on('game-command', (payload:{sessionId?:string; type?:string; commandId?:string}) => {
    socket.emit('command-rejected',{ commandId:payload?.commandId, code:'ENGINE_NOT_MIGRATED', message:'Realtime transport is ready; authoritative reducer is not enabled yet.' });
  });
});

const port = Number(process.env.PORT || 3000);
await app.listen({ host:'0.0.0.0', port });

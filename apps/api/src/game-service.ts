import { randomBytes, randomUUID } from 'node:crypto';
import type { AuthUser, CommandResponse, GameCommand, GameEvent, GameState, SessionSnapshot, WaitingRoomResult } from '../../../packages/contracts/src/index.ts';
import { applyCommand, chooseBotOption, createGame, projectDecisionCapabilities, projectRoulettePresentation } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';
import { pool, withTransaction } from './db.ts';

const BOT_NAMES = ['Maya', 'Leo', 'Nina', 'Jordan', 'Sam', 'Alex', 'Zoe', 'Arjun', 'Dev'] as const;
const BOT_PREFIX = 'bot:';

export interface RoomCreateInput {
  roomName?: string;
  mode?: string;
  playerCount?: number;
  world?: 'clean' | 'adult';
  ceiling?: number;
  sources?: Record<string, boolean>;
}

export interface SessionPlayerView {
  id: string;
  name: string;
  isHuman: boolean;
}

export interface RoomSessionResult {
  ok: true;
  roomId: string;
  sessionId: string;
  joinCode: string;
  players: SessionPlayerView[];
}

export interface ProjectedSessionSnapshot extends SessionSnapshot<GameState> {
  players: SessionPlayerView[];
}

type StoredRoomConfig = RoomCreateInput & {
  playerNames?: Record<string, string>;
};

function requirePool() {
  if (!pool) throw Object.assign(new Error('DATABASE_URL is not configured.'), { code: 'DATABASE_UNAVAILABLE', statusCode: 503 });
  return pool;
}

function normalizePlayerCount(value: unknown): number {
  const count = Number(value ?? 5);
  if (!Number.isInteger(count) || count < 2 || count > 10) {
    throw Object.assign(new Error('playerCount must be between 2 and 10.'), { code: 'INVALID_PLAYER_COUNT', statusCode: 400 });
  }
  return count;
}

function normalizeRoomName(value: unknown): string {
  const roomName = String(value ?? 'Night Squad').trim();
  if (!roomName || roomName.length > 40) {
    throw Object.assign(new Error('roomName must be 1 to 40 characters.'), { code: 'INVALID_ROOM_NAME', statusCode: 400 });
  }
  return roomName;
}

function makeJoinCode(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
}

function isBotPlayerId(playerId: string): boolean {
  return playerId.startsWith(BOT_PREFIX);
}

function playerViewsFromState(state: GameState, config: StoredRoomConfig, viewerId: string): SessionPlayerView[] {
  const names = config.playerNames ?? {};
  return state.players.map((player, index) => ({
    id: player.id,
    name: names[player.id] ?? (isBotPlayerId(player.id) ? BOT_NAMES[Math.max(0, index - 1)] ?? `Player ${index + 1}` : player.id),
    isHuman: player.id === viewerId,
  }));
}

function projectStateForPlayer(state: GameState, viewerId: string): GameState {
  const projected = structuredClone(state);
  projected.players = projected.players.map(player => {
    if (player.id === viewerId) return player;
    return {
      ...player,
      hand: player.hand.map((_, index) => ({ id: `hidden:${player.id}:${index}`, kind: 'number' as const })),
    };
  });
  projected.processedCommands = {};
  if (projected.social) projected.social = projectSocialForViewer(projected.social);
  return projected;
}

/**
 * Viewer-aware social projection. Every outbound viewer receives the shared engine's Roulette
 * view, so a SEALED presentation can never carry selectedResultId or candidateResultIds to any
 * client -- the authoritative selection stays in the engine state. A REVEALED presentation is
 * unchanged: once the result is public every viewer still receives it exactly as before.
 *
 * This decides visibility only: it is deterministic, side-effect free, never mutates the
 * authoritative state and never changes which prompt or candidate the engine selected.
 */
function projectSocialForViewer(social: NonNullable<GameState['social']>): NonNullable<GameState['social']> {
  const projected = structuredClone(social);
  if (projected.roulettePresentation) {
    // Viewers receive the masked view, which is the contract's own sealed/revealed boundary.
    projected.roulettePresentation = projectRoulettePresentation(projected.roulettePresentation) as typeof projected.roulettePresentation;
  }
  return projected;
}

function visibleEvents(events: readonly GameEvent[], viewerId: string): GameEvent[] {
  return events.filter(event =>
    event.visibility !== 'PLAYER_PRIVATE' || !event.recipientPlayerIds?.length || event.recipientPlayerIds.includes(viewerId),
  );
}

async function persistEvents(client: any, sessionId: string, events: readonly GameEvent[]): Promise<void> {
  for (const event of events) {
    await client.query(
      `insert into game_events(session_id,revision,event_type,payload) values($1,$2,$3,$4::jsonb)`,
      [sessionId, event.revision, event.type, JSON.stringify(event.payload ?? {})],
    );
  }
}

function engineCommand<T extends GameCommand>(state: GameState, playerId: string, body: Omit<T, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>): T {
  return {
    ...body,
    commandId: randomUUID(),
    playerId,
    expectedRevision: state.revision,
    sessionId: state.id,
  } as T;
}

function engineContext(config?: StoredRoomConfig, now = Date.now()) {
  return {
    now,
    promptPool: promptPoolForSources(config?.sources),
    promptProfile: {
      stage: Number.MAX_SAFE_INTEGER,
      intensity: Number.isFinite(Number(config?.ceiling)) ? Number(config?.ceiling) : Number.MAX_SAFE_INTEGER,
      language: '*',
      callSuitability: '*',
    },
  };
}

function botActorIds(state: GameState): string[] {
  if (state.pendingEffect?.type === 'WILD_COLOR') return [state.pendingEffect.playerId].filter(isBotPlayerId);
  if (state.social?.resolutionComplete) return [state.social.actorId].filter(isBotPlayerId);
  if (state.social && !state.social.resolutionComplete) {
    return state.players
      .map(player => player.id)
      .filter(playerId => isBotPlayerId(playerId) && projectDecisionCapabilities(state, playerId).options.length > 0);
  }
  return isBotPlayerId(state.currentPlayerId) ? [state.currentPlayerId] : [];
}

function advanceBots(initialState: GameState, config?: StoredRoomConfig, now = Date.now()): { state: GameState; events: GameEvent[] } {
  let state = initialState;
  const events: GameEvent[] = [];
  let steps = 0;

  const applyBot = (command: GameCommand) => {
    const result = applyCommand(state, command, engineContext(config, now));
    state = result.state;
    events.push(...result.events);
    return result.ok;
  };

  while (state.status === 'ACTIVE' && steps < 100) {
    steps += 1;
    const actorId = botActorIds(state)[0];
    if (!actorId) break;

    const capabilities = projectDecisionCapabilities(state, actorId);
    const decision = chooseBotOption(state, actorId, capabilities, { isBotPlayerId });
    if (decision.kind !== 'command') break;
    if (!applyBot(decision.option.command)) break;
  }

  return { state, events };
}

interface RoomRow { id: string; join_code: string; owner_user_id: string; config: StoredRoomConfig }
interface RoomMemberRow { user_id: string; role: string; joined_at: Date | string; display_name: string | null }

function orderedMembers(members: RoomMemberRow[]): RoomMemberRow[] {
  return [...members].sort((left, right) => {
    if (left.role !== right.role) return left.role === 'owner' ? -1 : 1;
    return new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime();
  });
}

function roomProjection(room: RoomRow, members: RoomMemberRow[], sessionId: string | null): WaitingRoomResult {
  const ordered = orderedMembers(members);
  return {
    ok: true,
    roomId: room.id,
    joinCode: room.join_code,
    ownerUserId: room.owner_user_id,
    playerCount: normalizePlayerCount((room.config ?? {}).playerCount),
    memberCount: ordered.length,
    members: ordered.map((member, index) => ({
      userId: member.user_id,
      name: member.display_name ?? member.user_id,
      role: member.role === 'owner' ? 'owner' : 'player',
      seat: index,
      joinedAt: new Date(member.joined_at).toISOString(),
    })),
    status: sessionId ? 'STARTED' : 'WAITING',
    sessionId,
  };
}

async function loadRoomRow(roomId: string, client: any = requirePool()): Promise<RoomRow> {
  const result = await client.query(`select id,join_code,owner_user_id,config from rooms where id=$1`, [roomId]);
  if (!result.rowCount) throw Object.assign(new Error('Room not found.'), { code: 'ROOM_NOT_FOUND', statusCode: 404 });
  return result.rows[0] as RoomRow;
}

async function loadRoomMembers(roomId: string, client: any = requirePool()): Promise<RoomMemberRow[]> {
  const result = await client.query(
    `select rm.user_id,rm.role,rm.joined_at,u.display_name
       from room_members rm
       join users u on u.id = rm.user_id
      where rm.room_id=$1
      order by case when rm.role='owner' then 0 else 1 end, rm.joined_at asc`,
    [roomId],
  );
  return result.rows as RoomMemberRow[];
}

async function activeSessionId(roomId: string, client: any = requirePool()): Promise<string | null> {
  const result = await client.query(`select id from game_sessions where room_id=$1 and status='ACTIVE' order by created_at desc limit 1`, [roomId]);
  return result.rowCount ? String(result.rows[0].id) : null;
}

async function requireRoomMembership(roomId: string, userId: string): Promise<void> {
  const result = await requirePool().query(`select 1 from room_members where room_id=$1 and user_id=$2`, [roomId, userId]);
  if (!result.rowCount) throw Object.assign(new Error('Authenticated user is not a member of this room.'), { code: 'ROOM_MEMBERSHIP_REQUIRED', statusCode: 403 });
}

export async function createWaitingRoom(user: AuthUser, input: RoomCreateInput): Promise<WaitingRoomResult> {
  const playerCount = normalizePlayerCount(input.playerCount);
  const roomName = normalizeRoomName(input.roomName);
  const world = input.world === 'adult' ? 'adult' : 'clean';
  const joinCode = makeJoinCode();
  const config: StoredRoomConfig = { ...input, roomName, playerCount, world, playerNames: {} };

  const roomId = await withTransaction(async client => {
    const room = await client.query(
      `insert into rooms(join_code,owner_user_id,config) values($1,$2,$3::jsonb) returning id`,
      [joinCode, user.id, JSON.stringify(config)],
    );
    const id = String(room.rows[0].id);
    await client.query(
      `insert into room_members(room_id,user_id,role) values($1,$2,'owner') on conflict(room_id,user_id) do nothing`,
      [id, user.id],
    );
    return id;
  });

  const room = await loadRoomRow(roomId);
  return roomProjection(room, await loadRoomMembers(roomId), null);
}

export async function joinWaitingRoom(user: AuthUser, code: string): Promise<WaitingRoomResult> {
  const db = requirePool();
  const normalized = code.trim().toUpperCase();
  const roomResult = await db.query(`select id,join_code,owner_user_id,config from rooms where upper(join_code)=upper($1)`, [normalized]);
  if (!roomResult.rowCount) throw Object.assign(new Error('Room not found.'), { code: 'ROOM_NOT_FOUND', statusCode: 404 });
  const room = roomResult.rows[0] as RoomRow;

  const started = await activeSessionId(room.id);
  const existing = await db.query(`select role from room_members where room_id=$1 and user_id=$2`, [room.id, user.id]);
  if (started) {
    if (!existing.rowCount) throw Object.assign(new Error('This game already started.'), { code: 'GAME_ALREADY_STARTED', statusCode: 409 });
    return roomProjection(room, await loadRoomMembers(room.id), started);
  }

  if (!existing.rowCount) {
    const members = await loadRoomMembers(room.id);
    if (members.length >= normalizePlayerCount((room.config ?? {}).playerCount)) {
      throw Object.assign(new Error('This room is already full.'), { code: 'ROOM_FULL', statusCode: 409 });
    }
    await db.query(
      `insert into room_members(room_id,user_id,role) values($1,$2,'player') on conflict(room_id,user_id) do nothing`,
      [room.id, user.id],
    );
  }

  return roomProjection(room, await loadRoomMembers(room.id), null);
}

export async function getWaitingRoom(user: AuthUser, roomId: string): Promise<WaitingRoomResult> {
  await requireRoomMembership(roomId, user.id);
  const room = await loadRoomRow(roomId);
  return roomProjection(room, await loadRoomMembers(roomId), await activeSessionId(roomId));
}

export async function startRoom(user: AuthUser, roomId: string): Promise<RoomSessionResult> {
  const room = await loadRoomRow(roomId);
  if (room.owner_user_id !== user.id) {
    throw Object.assign(new Error('Only the room host can start this game.'), { code: 'NOT_ROOM_OWNER', statusCode: 403 });
  }
  if (await activeSessionId(roomId)) {
    throw Object.assign(new Error('This room already has an active game.'), { code: 'SESSION_ALREADY_CREATED', statusCode: 409 });
  }

  const config = (room.config ?? {}) as StoredRoomConfig;
  const playerCount = normalizePlayerCount(config.playerCount);
  const members = orderedMembers(await loadRoomMembers(roomId));
  if (members.length !== playerCount) {
    throw Object.assign(
      new Error(`This room needs exactly ${playerCount} real players before it can start.`),
      { code: 'PLAYER_COUNT_NOT_REACHED', statusCode: 409 },
    );
  }

  const sessionId = randomUUID();
  const playerNames: Record<string, string> = {};
  const seats = members.map((member, index) => {
    playerNames[member.user_id] = member.display_name ?? member.user_id;
    return { id: member.user_id, seat: index };
  });

  const created = createGame(
    {
      seed: sessionId,
      startingHandCount: 7,
      startingPlayerIndex: 0,
      allowVoluntaryDraw: true,
      contentWorld: config.world === 'adult' ? '18+_ADULT' : 'UNDER_18_CLEAN',
    },
    seats,
    undefined,
    { now: Date.now() },
  );
  if (!created.ok) throw Object.assign(new Error(created.error?.message ?? 'Unable to create game.'), { code: created.error?.code ?? 'INVALID_SETUP', statusCode: 400 });
  created.state.id = sessionId;
  created.events.forEach(event => { event.sessionId = sessionId; });

  const storedConfig: StoredRoomConfig = { ...config, playerCount, playerNames };
  await withTransaction(async client => {
    if (await activeSessionId(roomId, client)) {
      throw Object.assign(new Error('This room already has an active game.'), { code: 'SESSION_ALREADY_CREATED', statusCode: 409 });
    }
    await client.query(`update rooms set config=$2::jsonb where id=$1`, [roomId, JSON.stringify(storedConfig)]);
    await client.query(
      `insert into game_sessions(id,room_id,status,revision,state) values($1,$2,$3,$4,$5::jsonb)`,
      [sessionId, roomId, created.state.status, created.state.revision, JSON.stringify(created.state)],
    );
    await persistEvents(client, sessionId, created.events);
  });

  return {
    ok: true,
    roomId,
    sessionId,
    joinCode: room.join_code,
    players: playerViewsFromState(created.state, storedConfig, user.id),
  };
}

async function loadSessionRow(sessionId: string, userId: string, forUpdate = false, client: any = requirePool()) {
  const result = await client.query(
    `select gs.id,gs.state,gs.revision,gs.status,r.config
       from game_sessions gs
       join rooms r on r.id=gs.room_id
       join room_members rm on rm.room_id=r.id
      where gs.id=$1 and rm.user_id=$2${forUpdate ? ' for update of gs' : ''}`,
    [sessionId, userId],
  );
  if (!result.rowCount) throw Object.assign(new Error('Game session not found.'), { code: 'SESSION_NOT_FOUND', statusCode: 404 });
  return result.rows[0] as { id: string; state: GameState; revision: number; status: string; config: StoredRoomConfig };
}

export async function getSessionSnapshot(user: AuthUser, sessionId: string): Promise<ProjectedSessionSnapshot> {
  const row = await loadSessionRow(sessionId, user.id);
  return {
    sessionId,
    revision: Number(row.revision),
    state: projectStateForPlayer(row.state, user.id),
    players: playerViewsFromState(row.state, row.config ?? {}, user.id),
    serverTime: new Date().toISOString(),
  };
}

export async function processSessionCommand(user: AuthUser, sessionId: string, command: GameCommand): Promise<CommandResponse<GameState>> {
  if (command.sessionId !== sessionId) throw Object.assign(new Error('Command session does not match route.'), { code: 'SESSION_MISMATCH', statusCode: 400 });
  if (command.playerId !== user.id) throw Object.assign(new Error('Command player does not match authenticated user.'), { code: 'PLAYER_MISMATCH', statusCode: 403 });

  return withTransaction(async client => {
    const duplicate = await client.query(`select result from game_commands where command_id=$1 and session_id=$2`, [command.commandId, sessionId]);
    if (duplicate.rowCount && duplicate.rows[0].result) return duplicate.rows[0].result as CommandResponse<GameState>;

    const row = await loadSessionRow(sessionId, user.id, true, client);
    const originalState = row.state;
    if (!originalState.players.some(player => player.id === user.id)) {
      throw Object.assign(new Error('Authenticated user is not a player in this session.'), { code: 'PLAYER_NOT_IN_SESSION', statusCode: 403 });
    }

    const transition = applyCommand(originalState, command, engineContext(row.config, Date.now()));
    let finalState = transition.state;
    let allEvents = [...transition.events];

    if (transition.ok) {
      const bots = advanceBots(finalState, row.config);
      finalState = bots.state;
      allEvents = [...allEvents, ...bots.events];
      await client.query(
        `update game_sessions set status=$2,revision=$3,state=$4::jsonb,updated_at=now() where id=$1`,
        [sessionId, finalState.status, finalState.revision, JSON.stringify(finalState)],
      );
      await persistEvents(client, sessionId, allEvents);
    }

    const response: CommandResponse<GameState> = {
      ok: transition.ok,
      commandId: command.commandId,
      revision: finalState.revision,
      state: projectStateForPlayer(finalState, user.id),
      events: visibleEvents(allEvents, user.id),
      ...(transition.error ? { error: { code: transition.error.code, message: transition.error.message } } : {}),
      ...(transition.idempotentReplay ? { idempotentReplay: true } : {}),
    };

    await client.query(
      `insert into game_commands(command_id,session_id,actor_user_id,expected_revision,command_type,payload,result)
       values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [command.commandId, sessionId, user.id, command.expectedRevision, command.type, JSON.stringify(command), JSON.stringify(response)],
    );

    return response;
  });
}

import { randomBytes, randomUUID } from 'node:crypto';
import {
  ROOM_CEILING_VALUES,
  ROOM_MODE_BOUNDS,
  ROOM_PROMPT_SOURCE_KEYS,
  type AuthUser,
  type CommandResponse,
  type GameCommand,
  type GameEvent,
  type GameState,
  type PlayerDecisionCapabilities,
  type RoomConfig,
  type RoomConfigUpdateRequest,
  type RoomContentWorld,
  type RoomMode,
  type RoomPromptSourceKey,
  type RoomSessionResult,
  type SessionSnapshot,
  type WaitingRoomResult,
} from '../../../packages/contracts/src/index.ts';
import { applyCommand, chooseBotOption, createGame, fingerprintGameCommand, projectDecisionCapabilities, projectRoulettePresentation } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';
import { pool, withTransaction } from './db.ts';

const BOT_NAMES = ['Maya', 'Leo', 'Nina', 'Jordan', 'Sam', 'Alex', 'Zoe', 'Arjun', 'Dev'] as const;
const BOT_PREFIX = 'bot:';

export interface SessionPlayerView {
  id: string;
  name: string;
  isHuman: boolean;
}

export interface ProjectedSessionSnapshot extends SessionSnapshot<GameState> {
  players: SessionPlayerView[];
  capabilities: PlayerDecisionCapabilities;
}

/**
 * Stored room configuration. rooms.config is server-owned pre-game room state: the canonical
 * RoomConfig plus the internal seat-name map, which is never projected to clients.
 */
type StoredRoomConfig = RoomConfig & {
  playerNames?: Record<string, string>;
};

const DEFAULT_ROOM_CONFIG: RoomConfig = {
  roomName: 'Night Squad',
  mode: 'party',
  playerCount: 5,
  world: 'clean',
  ceiling: 3,
  sources: { original: true, community: true, house: true, live: true },
};

function requirePool() {
  if (!pool) throw Object.assign(new Error('DATABASE_URL is not configured.'), { code: 'DATABASE_UNAVAILABLE', statusCode: 503 });
  return pool;
}

function roomConfigError(code: string, message: string, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function normalizePlayerCount(value: unknown): number {
  const count = Number(value ?? DEFAULT_ROOM_CONFIG.playerCount);
  if (!Number.isInteger(count) || count < 2 || count > 10) {
    throw roomConfigError('INVALID_PLAYER_COUNT', 'playerCount must be between 2 and 10.');
  }
  return count;
}

/** Every valid playerCount belongs to exactly one mode; this is used only when no mode was ever chosen. */
function defaultModeForPlayerCount(playerCount: number): RoomMode {
  const modes = Object.keys(ROOM_MODE_BOUNDS) as RoomMode[];
  return modes.find(mode => playerCount >= ROOM_MODE_BOUNDS[mode].min && playerCount <= ROOM_MODE_BOUNDS[mode].max) ?? DEFAULT_ROOM_CONFIG.mode;
}

function readRoomName(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw roomConfigError('INVALID_ROOM_NAME', 'roomName must be a string.');
  const roomName = value.trim();
  if (!roomName || roomName.length > 40) throw roomConfigError('INVALID_ROOM_NAME', 'roomName must be 1 to 40 characters.');
  return roomName;
}

function readRoomMode(value: unknown): RoomMode {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(ROOM_MODE_BOUNDS, value)) {
    throw roomConfigError('INVALID_ROOM_MODE', `mode must be one of ${Object.keys(ROOM_MODE_BOUNDS).join(', ')}.`);
  }
  return value as RoomMode;
}

function readContentWorld(value: unknown): RoomContentWorld {
  if (value !== 'clean' && value !== 'adult') throw roomConfigError('INVALID_CONTENT_WORLD', 'world must be clean or adult.');
  return value;
}

function readContentCeiling(value: unknown, world: RoomContentWorld): number {
  const ceiling = Number(value);
  if (!ROOM_CEILING_VALUES[world].includes(ceiling)) {
    throw roomConfigError('INVALID_CONTENT_CEILING', `ceiling for ${world} must be one of ${ROOM_CEILING_VALUES[world].join(', ')}.`);
  }
  return ceiling;
}

function readPromptSources(value: unknown, fallback: Record<RoomPromptSourceKey, boolean>): Record<RoomPromptSourceKey, boolean> {
  if (value === undefined) return fallback;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw roomConfigError('INVALID_PROMPT_SOURCES', 'sources must be an object of known prompt source keys.');
  }
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!ROOM_PROMPT_SOURCE_KEYS.includes(key as RoomPromptSourceKey)) {
      throw roomConfigError('INVALID_PROMPT_SOURCES', `Unknown prompt source key: ${key}.`);
    }
    if (typeof raw[key] !== 'boolean') {
      throw roomConfigError('INVALID_PROMPT_SOURCES', `Prompt source ${key} must be a boolean.`);
    }
  }
  const sources = {} as Record<RoomPromptSourceKey, boolean>;
  for (const key of ROOM_PROMPT_SOURCE_KEYS) sources[key] = raw[key] === true ? true : raw[key] === false ? false : fallback[key];
  if (!ROOM_PROMPT_SOURCE_KEYS.some(key => sources[key])) {
    throw roomConfigError('NO_PROMPT_SOURCE_ENABLED', 'At least one prompt source must stay enabled.');
  }
  return sources;
}

/**
 * Canonical room configuration resolution and validation. The server owns validity: a malformed
 * product choice is rejected, never silently rewritten. Only an absent field falls back -- to the
 * persisted room value on update, or to the canonical default on creation. A mode is derived from
 * playerCount only when the room never had one.
 */
function resolveRoomConfig(current: Partial<RoomConfig> | undefined, patch: RoomConfigUpdateRequest): RoomConfig {
  const base: Partial<RoomConfig> = current ?? {};
  const roomName = readRoomName(patch.roomName, base.roomName ?? DEFAULT_ROOM_CONFIG.roomName);
  const world = readContentWorld(patch.world ?? base.world ?? DEFAULT_ROOM_CONFIG.world);
  const ceiling = readContentCeiling(patch.ceiling ?? base.ceiling ?? DEFAULT_ROOM_CONFIG.ceiling, world);
  const sources = readPromptSources(patch.sources, base.sources ?? DEFAULT_ROOM_CONFIG.sources);
  const playerCount = normalizePlayerCount(patch.playerCount ?? base.playerCount ?? DEFAULT_ROOM_CONFIG.playerCount);
  const mode = patch.mode === undefined && base.mode === undefined
    ? defaultModeForPlayerCount(playerCount)
    : readRoomMode(patch.mode ?? base.mode);
  const bounds = ROOM_MODE_BOUNDS[mode];
  if (playerCount < bounds.min || playerCount > bounds.max) {
    throw roomConfigError(
      'MODE_PLAYER_COUNT_MISMATCH',
      `${mode} supports ${bounds.min === bounds.max ? bounds.min : `${bounds.min} to ${bounds.max}`} players, received ${playerCount}.`,
    );
  }
  return { roomName, mode, playerCount, world, ceiling, sources };
}

/**
 * Read-side projection of persisted room state. It never mutates storage and never throws on a
 * historical row: it guarantees the client receives a complete, valid canonical config.
 */
function publicRoomConfig(config: Partial<StoredRoomConfig> | undefined): RoomConfig {
  const raw = config ?? {};
  const playerCount = Number.isInteger(Number(raw.playerCount)) && Number(raw.playerCount) >= 2 && Number(raw.playerCount) <= 10
    ? Number(raw.playerCount)
    : DEFAULT_ROOM_CONFIG.playerCount;
  const world = raw.world === 'adult' ? 'adult' : 'clean';
  const mode = typeof raw.mode === 'string' && Object.prototype.hasOwnProperty.call(ROOM_MODE_BOUNDS, raw.mode)
    ? raw.mode as RoomMode
    : defaultModeForPlayerCount(playerCount);
  return {
    roomName: typeof raw.roomName === 'string' && raw.roomName.trim() ? raw.roomName : DEFAULT_ROOM_CONFIG.roomName,
    mode,
    playerCount,
    world,
    ceiling: ROOM_CEILING_VALUES[world].includes(Number(raw.ceiling)) ? Number(raw.ceiling) : DEFAULT_ROOM_CONFIG.ceiling,
    sources: readPromptSources(raw.sources, DEFAULT_ROOM_CONFIG.sources),
  };
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
  const config = publicRoomConfig(room.config);
  return {
    ok: true,
    roomId: room.id,
    joinCode: room.join_code,
    ownerUserId: room.owner_user_id,
    config,
    playerCount: config.playerCount,
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

export async function createWaitingRoom(user: AuthUser, input: RoomConfigUpdateRequest): Promise<WaitingRoomResult> {
  // Creation uses the same canonical validation as an update: a malformed room choice is rejected
  // here, before a room row exists, and only absent fields fall back to the canonical defaults.
  const config = resolveRoomConfig(undefined, input ?? {});
  const joinCode = makeJoinCode();
  const stored: StoredRoomConfig = { ...config, playerNames: {} };

  const roomId = await withTransaction(async client => {
    const room = await client.query(
      `insert into rooms(join_code,owner_user_id,config) values($1,$2,$3::jsonb) returning id`,
      [joinCode, user.id, JSON.stringify(stored)],
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
  const normalized = code.trim().toUpperCase();
  // The capacity decision and the membership insert must be atomic: both run in one transaction
  // that first locks the room row (select ... for update), so concurrent joins serialize on the
  // room and a later joiner observes the earlier insert already committed. This is database-level
  // serialization, so it stays correct with more than one Node process.
  return withTransaction(async client => {
    const roomResult = await client.query(
      `select id,join_code,owner_user_id,config from rooms where upper(join_code)=upper($1) for update`,
      [normalized],
    );
    if (!roomResult.rowCount) throw Object.assign(new Error('Room not found.'), { code: 'ROOM_NOT_FOUND', statusCode: 404 });
    const room = roomResult.rows[0] as RoomRow;

    const started = await activeSessionId(room.id, client);
    const existing = await client.query(`select role from room_members where room_id=$1 and user_id=$2`, [room.id, user.id]);
    if (started) {
      if (!existing.rowCount) throw Object.assign(new Error('This game already started.'), { code: 'GAME_ALREADY_STARTED', statusCode: 409 });
      return roomProjection(room, await loadRoomMembers(room.id, client), started);
    }

    if (!existing.rowCount) {
      const members = await loadRoomMembers(room.id, client);
      if (members.length >= normalizePlayerCount((room.config ?? {}).playerCount)) {
        throw Object.assign(new Error('This room is already full.'), { code: 'ROOM_FULL', statusCode: 409 });
      }
      await client.query(
        `insert into room_members(room_id,user_id,role) values($1,$2,'player') on conflict(room_id,user_id) do nothing`,
        [room.id, user.id],
      );
    }

    return roomProjection(room, await loadRoomMembers(room.id, client), null);
  });
}

export async function getWaitingRoom(user: AuthUser, roomId: string): Promise<WaitingRoomResult> {
  await requireRoomMembership(roomId, user.id);
  const room = await loadRoomRow(roomId);
  return roomProjection(room, await loadRoomMembers(roomId), await activeSessionId(roomId));
}

/**
 * Canonical room configuration owner. Only the room host may change a waiting room's setup, and
 * the change is persisted in rooms.config. The locked room row is the single serialization point
 * shared with Start, so an update can never commit after the session created from the previous
 * configuration -- and Start can never create a session from a configuration read before the lock.
 */
export async function updateRoomConfig(user: AuthUser, roomId: string, patch: RoomConfigUpdateRequest): Promise<WaitingRoomResult> {
  return withTransaction(async client => {
    // Lock the room row first: Start locks the same row, so the two mutations serialize.
    const roomResult = await client.query(`select id,join_code,owner_user_id,config from rooms where id=$1 for update`, [roomId]);
    if (!roomResult.rowCount) throw roomConfigError('ROOM_NOT_FOUND', 'Room not found.', 404);
    const room = roomResult.rows[0] as RoomRow;

    const membership = await client.query(`select role from room_members where room_id=$1 and user_id=$2`, [room.id, user.id]);
    if (!membership.rowCount) throw roomConfigError('ROOM_MEMBERSHIP_REQUIRED', 'Authenticated user is not a member of this room.', 403);
    if (room.owner_user_id !== user.id) throw roomConfigError('NOT_ROOM_OWNER', 'Only the room host can change room setup.', 403);
    if (await activeSessionId(room.id, client)) {
      throw roomConfigError('ROOM_ALREADY_STARTED', 'Room configuration is frozen once the game has started.', 409);
    }

    const proposed = resolveRoomConfig(room.config, patch);
    const members = await loadRoomMembers(room.id, client);
    if (members.length > proposed.playerCount) {
      throw roomConfigError(
        'ROOM_CAPACITY_BELOW_MEMBERS',
        `This room already has ${members.length} members; playerCount cannot be lower than that.`,
        409,
      );
    }

    // The stored configuration keeps every canonical field plus the internal seat-name map.
    const stored: StoredRoomConfig = { ...(room.config ?? {}), ...proposed, playerNames: room.config?.playerNames ?? {} };
    await client.query(`update rooms set config=$2::jsonb where id=$1`, [room.id, JSON.stringify(stored)]);
    return roomProjection({ ...room, config: stored }, members, null);
  });
}

export async function startRoom(user: AuthUser, roomId: string): Promise<RoomSessionResult> {
  return withTransaction(async client => {
    // Every verification happens under the room-row lock, and the room configuration is read only
    // while holding it: a concurrent room config update either committed before this point -- and
    // is therefore the configuration the session is created from -- or it waits here and then
    // fails as frozen. Database-level serialization keeps this correct across multiple Node
    // processes, and two concurrent Start requests can no longer both observe "no active session".
    const lockedResult = await client.query(`select id,join_code,owner_user_id,config from rooms where id=$1 for update`, [roomId]);
    if (!lockedResult.rowCount) throw Object.assign(new Error('Room not found.'), { code: 'ROOM_NOT_FOUND', statusCode: 404 });
    const room = lockedResult.rows[0] as RoomRow;
    if (room.owner_user_id !== user.id) {
      throw Object.assign(new Error('Only the room host can start this game.'), { code: 'NOT_ROOM_OWNER', statusCode: 403 });
    }
    if (await activeSessionId(roomId, client)) {
      throw Object.assign(new Error('This room already has an active game.'), { code: 'SESSION_ALREADY_CREATED', statusCode: 409 });
    }

    // The frozen canonical configuration: Start creates the session from exactly these values.
    const config = resolveRoomConfig(room.config, {});
    const playerCount = config.playerCount;
    // Membership is re-checked under the same lock so the seat list the state was built from is
    // still authoritative at commit time.
    const members = await loadRoomMembers(roomId, client);
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
      contentWorld: config.world === 'adult' ? '18+_ADULT' : 'UNDER_18_CLEAN',
    },
    seats,
    undefined,
    { now: Date.now() },
  );
    if (!created.ok) throw Object.assign(new Error(created.error?.message ?? 'Unable to create game.'), { code: created.error?.code ?? 'INVALID_SETUP', statusCode: 400 });
    created.state.id = sessionId;
    created.events.forEach(event => { event.sessionId = sessionId; });

    // One transaction: the frozen configuration, the session row and its opening events commit
    // together, so a room can never end up with two ACTIVE sessions and never with a session
    // created from a configuration that a concurrent update replaced afterwards.
    const storedConfig: StoredRoomConfig = { ...(room.config ?? {}), ...config, playerNames };
    await client.query(`update rooms set config=$2::jsonb where id=$1`, [roomId, JSON.stringify(storedConfig)]);
    await client.query(
      `insert into game_sessions(id,room_id,status,revision,state) values($1,$2,$3,$4,$5::jsonb)`,
      [sessionId, roomId, created.state.status, created.state.revision, JSON.stringify(created.state)],
    );
    await persistEvents(client, sessionId, created.events);

    return {
      ok: true,
      roomId,
      sessionId,
      joinCode: room.join_code,
      players: playerViewsFromState(created.state, storedConfig, user.id),
    };
  });
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
    capabilities: projectDecisionCapabilities(row.state, user.id),
    serverTime: new Date().toISOString(),
  };
}

/**
 * Canonical Live command identity: game_commands.command_id is a PostgreSQL uuid column, so a
 * persisted Live command id must be an RFC 4122 UUID. Simulation builds its own deterministic
 * in-memory ids and never persists them, so this contract applies to Live commands only.
 */
const LIVE_COMMAND_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function assertLiveCommandId(commandId: unknown): asserts commandId is string {
  if (typeof commandId !== 'string' || !LIVE_COMMAND_ID_PATTERN.test(commandId)) {
    // Rejected here, before any persistence: PostgreSQL must never be the input validator and
    // its uuid parse error must never reach the client.
    throw Object.assign(
      new Error('commandId must be a UUID for a persisted Live command.'),
      { code: 'INVALID_COMMAND_ENVELOPE', statusCode: 400 },
    );
  }
}

export async function processSessionCommand(user: AuthUser, sessionId: string, command: GameCommand): Promise<CommandResponse<GameState> & { capabilities?: PlayerDecisionCapabilities }> {
  if (command.sessionId !== sessionId) throw Object.assign(new Error('Command session does not match route.'), { code: 'SESSION_MISMATCH', statusCode: 400 });
  if (command.playerId !== user.id) throw Object.assign(new Error('Command player does not match authenticated user.'), { code: 'PLAYER_MISMATCH', statusCode: 403 });
  // Authorized for this session and seat, so the payload identity format is checked here --
  // before any persistence, and never by PostgreSQL.
  assertLiveCommandId(command?.commandId);

  return withTransaction(async client => {
    // command_id is a global primary key. Serialize all requests sharing one UUID before
    // duplicate lookup so concurrent retries/collisions cannot race into a raw unique-key error.
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [command.commandId]);
    const duplicate = await client.query(`select session_id,payload,result from game_commands where command_id=$1`, [command.commandId]);
    if (duplicate.rowCount) {
      const persistedCommand = duplicate.rows[0].payload as GameCommand;
      if (persistedCommand && fingerprintGameCommand(persistedCommand) === fingerprintGameCommand(command) && duplicate.rows[0].result) {
        return duplicate.rows[0].result as CommandResponse<GameState> & { capabilities?: PlayerDecisionCapabilities };
      }

      const collisionRow = await loadSessionRow(sessionId, user.id, false, client);
      return {
        ok:false,
        commandId:command.commandId,
        revision:Number(collisionRow.revision),
        state:projectStateForPlayer(collisionRow.state, user.id),
        capabilities:projectDecisionCapabilities(collisionRow.state, user.id),
        events:[],
        error:{
          code:'COMMAND_ID_COLLISION',
          message:'This commandId was already used for a different command.',
        },
      };
    }

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

    const response: CommandResponse<GameState> & { capabilities: PlayerDecisionCapabilities } = {
      ok: transition.ok,
      commandId: command.commandId,
      revision: finalState.revision,
      state: projectStateForPlayer(finalState, user.id),
      capabilities: projectDecisionCapabilities(finalState, user.id),
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

import { io, type Socket } from 'socket.io-client';
import type {
  AuthSession,
  AuthUser,
  ClientConfig,
  CommandResponse,
  GameCommand,
  ProfileUpdateRequest,
  SessionSnapshot,
  WaitingRoomResult,
  TelegramAuthRequest,
  WebAuthResponse,
  WebLoginRequest,
  WebRegisterRequest,
  WebTelegramLoginConfiguration
} from '../../contracts/src/index.ts';
import { cribbitSessionTokenStore } from './session-token-store.ts';

export type { WaitingRoomMember, WaitingRoomResult } from '../../contracts/src/index.ts';

export interface RoomSessionResult {
  ok: true;
  roomId: string;
  sessionId: string;
  joinCode: string;
  players: Array<{ id:string; name:string; isHuman:boolean }>;
}

export interface RoomCreateRequest {
  roomName?: string;
  mode?: string;
  playerCount?: number;
  world?: 'clean' | 'adult';
  ceiling?: number;
  sources?: Record<string, boolean>;
}

export interface GameSessionSnapshot<TState = unknown> extends SessionSnapshot<TState> {
  players: Array<{ id:string; name:string; isHuman:boolean }>;
}

export interface CurrentAuthSession {
  user: AuthUser;
  authSource: 'telegram' | 'web' | 'telegram+web';
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export class CribbitApiClient {
  constructor(readonly config: ClientConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.config.platform === 'telegram' ? cribbitSessionTokenStore.get() : null;
    // Only declare a JSON body when one is actually sent: Fastify rejects an empty body
    // that claims to be application/json.
    const hasBody = init.body !== undefined && init.body !== null;
    const response = await fetch(`${this.config.apiUrl}${path}`, {
      ...init,
      credentials:'include',
      headers: {
        ...(hasBody ? { 'content-type':'application/json' } : {}),
        ...(token ? { authorization:`Bearer ${token}` } : {}),
        ...(init.headers || {})
      }
    });
    if (!response.ok) throw new ApiError(response.status, await response.text() || response.statusText);
    return response.json() as Promise<T>;
  }

  telegramAuth(payload: TelegramAuthRequest): Promise<AuthSession> {
    return this.request<AuthSession>('/v1/auth/telegram', { method:'POST', body:JSON.stringify(payload) }).then(session => {
      if (this.config.platform === 'telegram') cribbitSessionTokenStore.set(session.accessToken);
      return session;
    });
  }

  /** Explicit Telegram account creation (unknown identities never auto-provision). */
  telegramRegisterAccount(payload: TelegramAuthRequest): Promise<AuthSession> {
    return this.request<AuthSession>('/v1/auth/telegram/register', { method:'POST', body:JSON.stringify(payload) })
      .then(session => this.rememberTelegramSession(session));
  }

  /** Link the validated Telegram identity to an existing canonical account by proving its Web credential. */
  telegramLinkExistingAccount(payload: { initData:string; loginUsername:string; password:string }): Promise<AuthSession> {
    return this.request<AuthSession>('/v1/auth/telegram/link', { method:'POST', body:JSON.stringify(payload) })
      .then(session => this.rememberTelegramSession(session));
  }

  /** Link with a short-lived single-use code created from the authenticated Web session. */
  telegramLinkWithCode(payload: { initData:string; code:string }): Promise<AuthSession> {
    return this.request<AuthSession>('/v1/auth/telegram/link-with-code', { method:'POST', body:JSON.stringify(payload) })
      .then(session => this.rememberTelegramSession(session));
  }

  createTelegramLinkCode(): Promise<{ code:string; expiresAt:string; instructions:string }> {
    return this.request('/v1/me/identities/telegram/link-code', { method:'POST' });
  }

  /** Attach a Web login credential to the current canonical user (Telegram-origin accounts). */
  attachWebCredential(payload: { loginUsername:string; password:string; displayUsername:string; email?:string }): Promise<{ user: AuthUser }> {
    return this.request('/v1/me/identities/web-credential', { method:'POST', body:JSON.stringify(payload) });
  }

  private rememberTelegramSession(session: AuthSession): AuthSession {
    if (this.config.platform === 'telegram') cribbitSessionTokenStore.set(session.accessToken);
    return session;
  }

  webRegister(payload: WebRegisterRequest): Promise<WebAuthResponse> {
    return this.request('/v1/auth/register', { method:'POST', body:JSON.stringify(payload) });
  }

  webLogin(payload: WebLoginRequest): Promise<WebAuthResponse> {
    return this.request('/v1/auth/login', { method:'POST', body:JSON.stringify(payload) });
  }

  webLogout(): Promise<{ok:true}> {
    return this.request('/v1/auth/logout', { method:'POST', body:'{}' });
  }

  getAuthSession(): Promise<CurrentAuthSession> {
    return this.request('/v1/auth/session');
  }

  getMe(): Promise<{ user: AuthUser; authSource?: CurrentAuthSession['authSource'] }> { return this.request('/v1/me'); }
  updateProfile(payload: ProfileUpdateRequest): Promise<{ user: AuthUser }> {
    return this.request('/v1/me/profile', { method:'PATCH', body:JSON.stringify(payload) });
  }
  getWebTelegramLoginConfiguration(): Promise<WebTelegramLoginConfiguration> {
    return this.request('/v1/auth/telegram/web/configuration');
  }
  startWebTelegramLogin(): void {
    window.location.assign(`${this.config.apiUrl}/v1/auth/telegram/web/start`);
  }
  createRoom(payload: RoomCreateRequest): Promise<WaitingRoomResult> {
    return this.request('/v1/rooms', { method:'POST', body:JSON.stringify(payload) });
  }
  joinRoom(code: string): Promise<WaitingRoomResult> {
    return this.request('/v1/rooms/join', { method:'POST', body:JSON.stringify({ code }) });
  }
  getRoom(roomId: string): Promise<WaitingRoomResult> {
    return this.request(`/v1/rooms/${encodeURIComponent(roomId)}`);
  }
  startRoom(roomId: string): Promise<RoomSessionResult> {
    return this.request(`/v1/rooms/${encodeURIComponent(roomId)}/start`, { method:'POST', body:'{}' });
  }
  updateRoomConfig(roomId: string, config: unknown): Promise<unknown> {
    return this.request(`/v1/rooms/${encodeURIComponent(roomId)}/config`, { method:'PATCH', body:JSON.stringify(config) });
  }
  getSnapshot<TState>(sessionId: string): Promise<GameSessionSnapshot<TState>> {
    return this.request(`/v1/games/${encodeURIComponent(sessionId)}/snapshot`);
  }
  sendCommand<TState>(command: GameCommand): Promise<CommandResponse<TState>> {
    return this.request(`/v1/games/${encodeURIComponent(command.sessionId)}/commands`, { method:'POST', body:JSON.stringify(command) });
  }
}

export function clientConfig(platform: ClientConfig['platform']): ClientConfig {
  const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const wsUrl = (import.meta.env.VITE_WS_URL || '').replace(/\/$/, '');
  if (!apiUrl || !wsUrl) console.warn('[Cribbit] VITE_API_URL/VITE_WS_URL not configured; demo compatibility runtime remains local.');
  return {
    apiUrl,
    wsUrl,
    platform,
    appEnv: (import.meta.env.VITE_APP_ENV as ClientConfig['appEnv']) || 'development'
  };
}

export class CribbitRealtimeClient {
  private socket: Socket | null = null;
  constructor(private readonly config: ClientConfig) {}

  connect(accessToken = this.config.platform === 'telegram' ? cribbitSessionTokenStore.get() || undefined : undefined): Socket {
    if (this.socket) return this.socket;
    const origin = this.config.wsUrl.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/$/,'');
    this.socket = io(origin, {
      path:'/v1/realtime',
      transports:['polling','websocket'],
      withCredentials:true,
      auth: accessToken ? { accessToken } : undefined
    });
    return this.socket;
  }

  joinSession(sessionId:string): void { this.connect().emit('join-session',{sessionId}); }
  joinRoomChannel(roomId:string): void { this.connect().emit('join-room-channel',{roomId}); }
  sendCommand(command:GameCommand): void { this.connect().emit('game-command',command); }
  disconnect(): void { this.socket?.disconnect(); this.socket=null; }
}

/** True when Telegram authentication reported an unlinked identity instead of a session. */
export function isTelegramIdentityUnlinked(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.message.includes('TELEGRAM_IDENTITY_UNLINKED');
}

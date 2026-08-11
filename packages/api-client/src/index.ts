import { io, type Socket } from 'socket.io-client';
import type { AuthSession, AuthUser, ClientConfig, CommandResponse, GameCommand, ProfileUpdateRequest, SessionSnapshot, TelegramAuthRequest, WebTelegramLoginConfiguration } from '../../contracts/src/index.ts';
import { cribbitSessionTokenStore } from './session-token-store.ts';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export class CribbitApiClient {
  constructor(readonly config: ClientConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = cribbitSessionTokenStore.get();
    const response = await fetch(`${this.config.apiUrl}${path}`, {
      ...init,
      headers: {
        'content-type':'application/json',
        ...(token ? { authorization:`Bearer ${token}` } : {}),
        ...(init.headers || {})
      }
    });
    if (!response.ok) throw new ApiError(response.status, await response.text() || response.statusText);
    return response.json() as Promise<T>;
  }

  telegramAuth(payload: TelegramAuthRequest): Promise<AuthSession> {
    return this.request<AuthSession>('/v1/auth/telegram', { method:'POST', body:JSON.stringify(payload) }).then(session => {
      cribbitSessionTokenStore.set(session.accessToken);
      return session;
    });
  }

  getMe(): Promise<{ user: AuthUser }> { return this.request('/v1/me'); }
  updateProfile(payload: ProfileUpdateRequest): Promise<{ user: AuthUser }> {
    return this.request('/v1/me/profile', { method:'PATCH', body:JSON.stringify(payload) });
  }
  getWebTelegramLoginConfiguration(): Promise<WebTelegramLoginConfiguration> {
    return this.request('/v1/auth/telegram/web/configuration');
  }
  startWebTelegramLogin(): void {
    window.location.assign(`${this.config.apiUrl}/v1/auth/telegram/web/start`);
  }
  joinRoom(code: string): Promise<{ roomId:string; sessionId?:string }> {
    return this.request('/v1/rooms/join', { method:'POST', body:JSON.stringify({ code }) });
  }
  updateRoomConfig(roomId: string, config: unknown): Promise<unknown> {
    return this.request(`/v1/rooms/${encodeURIComponent(roomId)}/config`, { method:'PATCH', body:JSON.stringify(config) });
  }
  getSnapshot<TState>(sessionId: string): Promise<SessionSnapshot<TState>> {
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

  connect(accessToken = cribbitSessionTokenStore.get() || undefined): Socket {
    if (this.socket?.connected) return this.socket;
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
  sendCommand(command:GameCommand): void { this.connect().emit('game-command',command); }
  disconnect(): void { this.socket?.disconnect(); this.socket=null; }
}

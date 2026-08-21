import type { CardColor, GameCommand, GameState } from '../../../packages/contracts/src/index.ts';
import { CribbitApiClient, CribbitRealtimeClient, type GameSessionSnapshot, type RoomSessionResult } from '../../../packages/api-client/src/index.ts';

export interface TelegramBackendPlayer {
  readonly id: string;
  readonly name: string;
  readonly isHuman: boolean;
}

export interface TelegramBackendGame {
  readonly humanPlayerId: string;
  readonly players: readonly TelegramBackendPlayer[];
  readonly sessionId: string;
  readonly joinCode: string;
  getState(): GameState;
  refresh(): Promise<void>;
  playCard(cardId: string): Promise<{ ok:boolean; error?:{message:string} }>;
  drawCard(): Promise<{ ok:boolean; error?:{message:string} }>;
  selectWildColor(color: CardColor): Promise<{ ok:boolean; error?:{message:string} }>;
  passPrompt(): Promise<{ ok:boolean; error?:{message:string} }>;
  rewindPrompt(): Promise<{ ok:boolean; error?:{message:string} }>;
  flagPrompt(reasonCode?: string): Promise<{ ok:boolean; error?:{message:string} }>;
  send(command: Omit<GameCommand, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>): Promise<{ ok:boolean; error?:{message:string} }>;
  subscribe(onUpdate: () => void): () => void;
}

function commandId(sessionId: string, type: string): string {
  return `${sessionId}:${type}:${crypto.randomUUID()}`;
}

export async function createTelegramBackendGame(
  api: CribbitApiClient,
  room: RoomSessionResult,
  humanPlayerId: string,
): Promise<TelegramBackendGame> {
  let snapshot = await api.getSnapshot<GameState>(room.sessionId);
  let state = snapshot.state;
  let players: TelegramBackendPlayer[] = snapshot.players.length ? snapshot.players : room.players;
  const realtime = new CribbitRealtimeClient(api.config);

  const refresh = async (): Promise<void> => {
    snapshot = await api.getSnapshot<GameState>(room.sessionId);
    state = snapshot.state;
    players = snapshot.players.length ? snapshot.players : players;
  };

  const send = async (
    partial: Omit<GameCommand, 'commandId' | 'playerId' | 'expectedRevision' | 'sessionId'>,
  ): Promise<{ ok:boolean; error?:{message:string} }> => {
    const command = {
      ...partial,
      commandId: commandId(room.sessionId, partial.type),
      playerId: humanPlayerId,
      expectedRevision: state.revision,
      sessionId: room.sessionId,
    } as GameCommand;

    const response = await api.sendCommand<GameState>(command);
    if (response.state) state = response.state;
    else await refresh();
    return { ok: response.ok, ...(response.error ? { error: response.error } : {}) };
  };

  const subscribe = (onUpdate: () => void): (() => void) => {
    const socket = realtime.connect();
    const handler = async (payload: { sessionId?:string }) => {
      if (payload?.sessionId !== room.sessionId) return;
      try {
        await refresh();
        onUpdate();
      } catch (error) {
        console.warn('[Cribbit] Telegram realtime snapshot refresh failed.', error);
      }
    };
    socket.on('session-updated', handler);
    realtime.joinSession(room.sessionId);
    return () => {
      socket.off('session-updated', handler);
      realtime.disconnect();
    };
  };

  return {
    humanPlayerId,
    get players() { return players; },
    sessionId: room.sessionId,
    joinCode: room.joinCode,
    getState: () => state,
    refresh,
    playCard: cardId => send({ type:'PLAY_CARD', cardId }),
    drawCard: () => send({ type:'DRAW_CARD' }),
    selectWildColor: color => send({ type:'SELECT_WILD_COLOR', color }),
    passPrompt: () => send({ type:'PASS_PROMPT' }),
    rewindPrompt: () => send({ type:'REWIND_PROMPT' }),
    flagPrompt: reasonCode => send({
      type:'FLAG_PROMPT',
      promptId: state.social?.prompt?.id ?? '',
      ...(reasonCode ? { reasonCode } : {}),
    }),
    send,
    subscribe,
  };
}

import type { GameEvent, GameState } from '@cribbit/contracts';

export function makeEvent<TPayload>(
  state: GameState,
  type: GameEvent['type'],
  payload: TPayload,
  index = 0,
  visibility: GameEvent['visibility'] = 'PUBLIC',
  recipientPlayerIds: readonly string[] = []
): GameEvent<TPayload> {
  return {
    id: `${state.id}:r${state.revision}:${type}:${index}`,
    sessionId: state.id,
    revision: state.revision,
    type,
    visibility,
    recipientPlayerIds: recipientPlayerIds.length ? recipientPlayerIds : undefined,
    payload,
    createdAt: new Date((state.revision + 1) * 1000 + index).toISOString()
  };
}

import type { EngineError } from '@cribbit/contracts';

export function createEngineError(code: EngineError['code'], message: string, details?: Record<string, unknown>): EngineError {
  return { code, message, details };
}


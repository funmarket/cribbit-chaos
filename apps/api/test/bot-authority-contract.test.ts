import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('live room commands resolve through the API shared game boundary before bot advancement', () => {
  const gameService = source('apps/api/src/game-service.ts');

  assert.match(gameService, /import\s*\{[^}]*applyCommand[^}]*createGame[^}]*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/packages\/game-engine\/src\/index\.ts['"]/);
  assert.match(gameService, /function\s+advanceBots\s*\(initialState:\s*GameState/);
  assert.match(gameService, /const\s+transition\s*=\s*applyCommand\(originalState,\s*command,\s*engineContext\(row\.config,\s*Date\.now\(\)\)\)/);
  assert.match(gameService, /const\s+bots\s*=\s*advanceBots\(finalState,\s*row\.config\)/);
  assert.match(gameService, /update\s+game_sessions\s+set\s+status=\$2,revision=\$3,state=\$4::jsonb,updated_at=now\(\)\s+where\s+id=\$1/);
});

test('Web live rooms are API command adapters, not a second bot/game authority', () => {
  const liveSession = source('apps/web/src/live-session.ts');

  assert.match(liveSession, /api\.createRoom\(readRoomCreatePayload\(\)\)/);
  assert.match(liveSession, /api\.getSnapshot<GameState>\(room\.sessionId\)/);
  assert.match(liveSession, /api\.sendCommand<GameState>\(command\)/);
  assert.doesNotMatch(liveSession, /function\s+advanceBots\s*\(/);
  assert.doesNotMatch(liveSession, /function\s+botTakeTurn\s*\(/);
});

test('Telegram live rooms use the same API session adapter; local simulation remains fallback QA only', () => {
  const backendGame = source('apps/telegram/src/backendGame.ts');
  const bootstrapTelegram = source('apps/telegram/src/bootstrapTelegram.ts');
  const simulation = source('apps/telegram/src/simulation.ts');
  const gameView = source('apps/telegram/src/gameView.ts');

  assert.match(backendGame, /api\.getSnapshot<GameState>\(room\.sessionId\)/);
  assert.match(backendGame, /api\.sendCommand<GameState>\(command\)/);
  assert.doesNotMatch(backendGame, /function\s+advanceBots\s*\(/);
  assert.doesNotMatch(backendGame, /createGame\s*\(/);
  assert.match(bootstrapTelegram, /createTelegramBackendGame\(api,\s*room,\s*auth\.user\.id\)/);
  assert.match(bootstrapTelegram, /Railway API is not configured in this build\. Simulation remains available\./);
  assert.match(bootstrapTelegram, /live rooms require a valid Telegram launch/);
  assert.match(simulation, /chooseBotOption\(state,\s*playerId/);
  assert.doesNotMatch(simulation, /if\s*\(social\.cardKind\s*===\s*['"]truth['"]\s*\|\|\s*social\.cardKind\s*===\s*['"]dare['"]\)/);
  assert.match(gameView, /projectDecisionCapabilities\(state,\s*game\.humanPlayerId\)/);
});


test('Web live rooms render shared engine capabilities for human special-card decisions', () => {
  const liveSession = source('apps/web/src/live-session.ts');

  assert.match(liveSession, /projectDecisionCapabilities\(session\.state,\s*userId\)/);
  assert.match(liveSession, /data-live-option-id/);
  assert.match(liveSession, /projectDecisionCapabilities\(live\.state,\s*userId\)\.options\.find/);
});

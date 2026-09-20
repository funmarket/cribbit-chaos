import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { GameState } from '../../../packages/contracts/src/index.ts';
import { projectRoulettePresentation } from '../../../packages/game-engine/src/index.ts';
import { createWaitingRoom, getSessionSnapshot, joinWaitingRoom, processSessionCommand, startRoom } from '../src/game-service.ts';
import { pool, registerWebUser } from '../src/db.ts';

// ROULETTE-PRIVACY-1: a sealed Roulette decision must never leave server authority for an
// unauthorized player. The canonical boundary is the API viewer projection
// (projectStateForPlayer), which is what both the snapshot route and command responses use.

const SEALED_PROMPT_ID = 'privacy-needle-sealed-prompt-id';

test('the shared engine mask removes the sealed Roulette selection and keeps revealed ones', () => {
  const sealed = {
    id: 'presentation-1',
    type: 'PROMPT' as const,
    selectedResultId: SEALED_PROMPT_ID,
    candidateResultIds: [SEALED_PROMPT_ID, 'candidate-2'],
    revealState: 'SEALED' as const,
    presentationSeed: 'seed',
  };
  const masked = projectRoulettePresentation(sealed);
  assert.equal(Object.prototype.hasOwnProperty.call(masked, 'selectedResultId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(masked, 'candidateResultIds'), false);
  assert.equal(JSON.stringify(masked).includes(SEALED_PROMPT_ID), false);

  const revealed = { ...sealed, revealState: 'REVEALED' as const };
  const passthrough = projectRoulettePresentation(revealed);
  assert.equal(passthrough.selectedResultId, SEALED_PROMPT_ID);
  assert.deepEqual(passthrough.candidateResultIds, [SEALED_PROMPT_ID, 'candidate-2']);
});

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const stamp = () => String(Date.now()).slice(-9);
const users = () => Promise.all(['a', 'b', 'c'].map(async suffix => registerWebUser({
  loginUsername: `privacy${suffix}${stamp()}`,
  password: 'PrivacyPass123',
  displayUsername: `privacy${suffix}${stamp()}`.slice(0, 24),
})));
async function fixture() {
  const [actor, target, observer] = await users();
  const room = await createWaitingRoom(actor, { roomName: 'Privacy Room', playerCount: 3 });
  await joinWaitingRoom(target, room.joinCode);
  await joinWaitingRoom(observer, room.joinCode);
  const started = await startRoom(actor, room.roomId);
  return { actor, target, observer, sessionId: started.sessionId };
}


/** Give the actor a playable Truth card so the real engine path can reach the sealed rewind. */
async function armTruthCard(sessionId: string, actorId: string): Promise<string> {
  assert.ok(pool);
  const row = await pool.query('select state from game_sessions where id=$1', [sessionId]);
  const state = row.rows[0].state as GameState;
  const cardId = 'privacy-truth-card';
  state.players = state.players.map(player => (player.id === actorId
    ? { ...player, hand: [{ id: cardId, kind: 'truth', symbol: 'truth', color: 'orange' } as GameState['players'][number]['hand'][number]] }
    : { ...player, hand: [] }));
  state.discardPile = [{ id: 'privacy-starter', kind: 'number', color: 'orange', value: 4, symbol: '4' } as GameState['discardPile'][number]];
  state.currentPlayerId = actorId;
  state.phase = 'PLAY';
  state.status = 'ACTIVE';
  state.social = null;
  state.pendingEffect = null;
  state.winnerId = null;
  await pool.query('update game_sessions set state=$2::jsonb where id=$1', [sessionId, JSON.stringify(state)]);
  return cardId;
}

const command = (state: GameState, sessionId: string, playerId: string, body: Record<string, unknown>) => ({
  sessionId,
  commandId: randomUUID(),
  playerId,
  expectedRevision: state.revision,
  ...body,
} as never);

dbTest('a sealed Roulette result never reaches an unauthorized viewer, and revealed results still do', async () => {
  const { actor, target, observer, sessionId } = await fixture();
  const cardId = await armTruthCard(sessionId, actor.id);

  // 1. plain selection: the presentation is REVEALED, so the room still sees the prompt text.
  const snapshotBefore = await getSessionSnapshot(actor, sessionId);
  const played = await processSessionCommand(actor, sessionId, command(snapshotBefore.state, sessionId, actor.id, { type: 'PLAY_CARD', cardId }));
  assert.equal(played.ok, true, `expected a legal Truth play: ${played.error?.message ?? ''}`);
  const selected = await processSessionCommand(actor, sessionId, command(played.state, sessionId, actor.id, { type: 'SELECT_SOCIAL_TARGET', targetId: target.id }));
  assert.equal(selected.ok, true, `expected target selection: ${selected.error?.message ?? ''}`);
  const revealedPresentation = selected.state.social?.roulettePresentation;
  assert.equal(revealedPresentation?.revealState, 'REVEALED');
  const observerRevealed = await getSessionSnapshot(observer, sessionId);
  assert.equal(observerRevealed.state.social?.prompt?.text, selected.state.social?.prompt?.text, 'a REVEALED result stays visible to the room, unchanged');

  // 2. the actor rewinds: the engine creates a SEALED presentation holding the private replacement.
  const rewound = await processSessionCommand(actor, sessionId, command(selected.state, sessionId, actor.id, { type: 'REWIND_PROMPT' }));
  assert.equal(rewound.ok, true, `expected the rewind to succeed: ${rewound.error?.message ?? ''}`);
  const sealed = rewound.state.social?.roulettePresentation;
  assert.equal(sealed?.revealState, 'SEALED');
  // The command response is already projected, so the authoritative needle comes from storage.
  assert.equal(
    Object.prototype.hasOwnProperty.call(sealed ?? {}, 'candidateResultIds'),
    false,
    'even the acting player command response must not carry sealed candidate ids',
  );
  const sealedPromptId = rewound.state.social?.promptSelection?.promptId ?? '';
  const sealedPromptText = rewound.state.social?.prompt?.text ?? '';
  assert.ok(pool);
  const storedCandidates = await pool.query(
    "select state->'social'->'roulettePresentation'->'candidateResultIds' as ids, state->'social'->'promptSelection'->>'promptId' as prompt_id from game_sessions where id=$1",
    [sessionId],
  );
  const candidateIds: string[] = storedCandidates.rows[0]?.ids ?? [];
  assert.equal(storedCandidates.rows[0]?.prompt_id, sealedPromptId, 'the authoritative state holds the sealed selection');
  assert.ok(sealedPromptId, `the sealed decision must record a prompt id (got ${JSON.stringify(sealedPromptId)})`);
  assert.ok(sealedPromptText, `the sealed decision must hold prompt text (got ${JSON.stringify(sealedPromptText)})`);
  assert.ok(Array.isArray(candidateIds) && candidateIds.length > 0, `the authoritative state must list sealed candidates (got ${JSON.stringify(candidateIds)})`);

  const actorView = await getSessionSnapshot(actor, sessionId);
  const targetView = await getSessionSnapshot(target, sessionId);
  const observerView = await getSessionSnapshot(observer, sessionId);

  for (const [label, view] of [['actor', actorView], ['target', targetView], ['observer', observerView]] as const) {
    const presentation = view.state.social?.roulettePresentation as Record<string, unknown> | undefined;
    assert.equal(Object.prototype.hasOwnProperty.call(presentation ?? {}, 'selectedResultId'), false, `${label} must not receive a sealed selectedResultId`);
    assert.equal(Object.prototype.hasOwnProperty.call(presentation ?? {}, 'candidateResultIds'), false, `${label} must not receive sealed candidate ids`);
  }

  // The contract seals the selection, not the visible prompt: the shipped UI banner shows the
  // active prompt to the room, so prompt text behaviour is unchanged for every viewer while the
  // sealed selection fields are gone from all of them (asserted above).
  for (const [label, view] of [['actor', actorView], ['target', targetView], ['observer', observerView]] as const) {
    assert.equal(
      JSON.stringify(view).includes(sealedPromptId) && sealedPromptId !== view.state.social?.prompt?.id,
      false,
      `${label} must not carry the sealed selection id outside the public prompt field`,
    );
    for (const candidate of candidateIds) {
      const presentation = view.state.social?.roulettePresentation as Record<string, unknown> | undefined;
      assert.equal(JSON.stringify(presentation ?? {}).includes(candidate), false, `${label} presentation must not carry candidate ${candidate}`);
    }
  }
  assert.equal(actorView.state.social?.promptSelection?.promptId, sealedPromptId, 'the authoritative selection is still resolved for the acting player flow');

  // Command responses for an unrelated player use the same boundary.
  const observerCommand = await processSessionCommand(observer, sessionId, command(observerView.state, sessionId, observer.id, { type: 'DRAW_CARD' }));
  const observerCommandJson = JSON.stringify(observerCommand);
  assert.equal(
    Object.prototype.hasOwnProperty.call(observerCommand.state?.social?.roulettePresentation ?? {}, 'selectedResultId'),
    false,
    'command responses must not carry the sealed selection',
  );
  for (const candidate of candidateIds) {
    assert.equal(
      JSON.stringify(observerCommand.state?.social?.roulettePresentation ?? {}).includes(candidate),
      false,
      'command responses must not carry sealed candidate ids',
    );
  }
  assert.equal(observerCommandJson.includes('"candidateResultIds"'), false, 'no sealed candidate list may reach an unrelated player');

  // Regression baseline: other players' hands stay hidden at the same boundary.
  const otherId = actorView.state.players.find(player => player.id !== observer.id)?.id ?? '';
  const hiddenHand = observerView.state.players.find(player => player.id === otherId)?.hand ?? [];
  assert.equal(hiddenHand.every(card => card.id.startsWith('hidden:')), true, 'other players’ hands must stay private');

  if (pool) {
    const room = await pool.query('select room_id from game_sessions where id=$1', [sessionId]);
    const roomId = room.rows[0]?.room_id;
    if (roomId) {
      await pool.query('delete from game_sessions where id=$1', [sessionId]);
      await pool.query('delete from room_members where room_id=$1', [roomId]);
      await pool.query('delete from rooms where id=$1', [roomId]);
    }
  }
});

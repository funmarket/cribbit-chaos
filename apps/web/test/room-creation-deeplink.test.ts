import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isRoomCreationHash,
  normalizeTrailingDotHostname,
  ROOM_CREATION_ID,
  ROOM_CREATION_HASH,
  scrollRoomCreationTarget,
} from '../src/room-creation-deeplink.ts';

test('recognizes the canonical room creation hash', () => {
  assert.equal(ROOM_CREATION_ID, 'roomCreation');
  assert.equal(ROOM_CREATION_HASH, '#roomCreation');
  assert.equal(isRoomCreationHash('#roomCreation'), true);
  assert.equal(isRoomCreationHash('#room%43reation'), true);
  assert.equal(isRoomCreationHash('#create'), false);
  assert.equal(isRoomCreationHash('roomCreation'), false);
});

test('normalizes a trailing-dot hostname without changing a canonical hostname', () => {
  assert.equal(normalizeTrailingDotHostname('cribbit-chaos-web.pages.dev.'), 'cribbit-chaos-web.pages.dev');
  assert.equal(normalizeTrailingDotHostname('cribbit-chaos-web.pages.dev'), 'cribbit-chaos-web.pages.dev');
});

test('scrolls only when the room creation target exists', () => {
  let calls = 0;
  let options: ScrollIntoViewOptions | undefined;

  const found = scrollRoomCreationTarget('#roomCreation', id => {
    assert.equal(id, 'roomCreation');
    return {
      scrollIntoView(next) {
        calls += 1;
        options = next;
      },
    };
  });

  assert.equal(found, true);
  assert.equal(calls, 1);
  assert.deepEqual(options, { behavior: 'auto', block: 'start' });

  assert.equal(scrollRoomCreationTarget('#roomCreation', () => null), false);
  assert.equal(scrollRoomCreationTarget('#lobby', () => {
    throw new Error('unrelated hashes must not resolve a target');
  }), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CARD_BACKS,
  cardDefinitions,
  getCardBackAsset,
  getCardDefinition,
  getCardFrontAsset,
  getCardGameMapping,
  getCardsByFamily,
  getCardsByRuntimeRole,
  hasCardDefinition
} from '../src/index.ts';

test('card registry exposes exactly the audited 112 contiguous definitions', () => {
  assert.equal(cardDefinitions.length, 112);
  assert.equal(new Set(cardDefinitions.map((definition) => definition.id)).size, 112);
  assert.equal(cardDefinitions[0]?.id, '001');
  assert.equal(cardDefinitions.at(-1)?.id, '112');

  for (let id = 1; id <= 112; id += 1) {
    assert.equal(hasCardDefinition(String(id).padStart(3, '0')), true);
  }
});

test('card registry preserves audited family counts', () => {
  assert.equal(getCardsByFamily('truth').length, 10);
  assert.equal(getCardsByFamily('dare').length, 9);
  assert.equal(getCardsByFamily('paranoia').length, 7);
  assert.equal(getCardsByFamily('chaos').length, 7);
  assert.equal(getCardsByFamily('duel').length, 5);
  assert.equal(getCardsByFamily('nope').length, 8);
  assert.equal(getCardsByFamily('wild').length, 4);
  assert.equal(getCardsByFamily('pass').length, 4);
  assert.equal(getCardsByFamily('rewind').length, 4);
  assert.equal(getCardsByFamily('roulette').length, 2);
  assert.equal(getCardsByFamily('spice').length, 2);
  assert.equal(getCardsByFamily('flag').length, 1);
  assert.equal(getCardsByFamily('keyrule').length, 1);
  assert.equal(getCardsByFamily('answer').length, 12);
  assert.equal(getCardsByFamily('voice').length, 4);
  assert.equal(getCardsByFamily('authorship').length, 6);
  assert.equal(getCardsByFamily('stage').length, 14);
  assert.equal(getCardsByFamily('intensity').length, 12);
});

test('card mappings bind unambiguous records to existing engine and action taxonomy', () => {
  assert.deepEqual(getCardGameMapping('001'), { runtimeRole: 'playable-social-card', engineKind: 'truth' });
  assert.deepEqual(getCardGameMapping('011'), { runtimeRole: 'playable-social-card', engineKind: 'dare' });
  assert.deepEqual(getCardGameMapping('020'), { runtimeRole: 'playable-social-card', engineKind: 'paranoia' });
  assert.deepEqual(getCardGameMapping('027'), { runtimeRole: 'playable-social-card', engineKind: 'chaos' });
  assert.deepEqual(getCardGameMapping('034'), { runtimeRole: 'playable-social-card', engineKind: 'duel' });
  assert.equal(getCardGameMapping('039').actionId, 'PLAY_NOPE');
  assert.equal(getCardGameMapping('044').engineKind, 'wild');
  assert.equal(getCardGameMapping('044').secondaryActionId, 'SELECT_WILD_COLOR');
  assert.equal(getCardGameMapping('048').actionId, 'PASS_PROMPT');
  assert.equal(getCardGameMapping('052').actionId, 'REWIND_PROMPT');
  assert.equal(getCardGameMapping('063').actionId, 'FLAG_PROMPT');
  assert.equal(getCardGameMapping('065').responseMode, 'SPEAK');
  assert.equal(getCardGameMapping('068').responseMode, 'TYPE');
  assert.equal(getCardGameMapping('071').responseMode, 'CHOOSE');
  assert.equal(getCardGameMapping('074').responseMode, 'ANSWERED_LIVE');
  assert.equal(getCardGameMapping('081').authorshipMode, 'SIGNED');
  assert.equal(getCardGameMapping('083').authorshipMode, 'REVEAL_AFTER');
  assert.equal(getCardGameMapping('085').authorshipMode, 'TABOO');
});

test('card registry keeps ambiguous metadata out of command mappings', () => {
  const ambiguousDefinitions = cardDefinitions.filter((definition) => definition.gameMapping.ambiguity);
  assert.equal(ambiguousDefinitions.length, 38);

  for (const definition of ambiguousDefinitions) {
    if (definition.id === '060' || definition.id === '061' || definition.id === '062') continue;
    assert.equal(definition.gameMapping.actionId, undefined);
    assert.equal(definition.gameMapping.secondaryActionId, undefined);
  }

  assert.equal(getCardsByRuntimeRole('stage-card').length, 14);
  assert.equal(getCardsByRuntimeRole('intensity-card').length, 12);
  assert.equal(getCardGameMapping('056').runtimeRole, 'presentation-metadata');
  assert.equal(getCardGameMapping('064').runtimeRole, 'rules-reference');
});

test('card asset resolvers return shared logical paths without frontend-specific tables', () => {
  assert.equal(getCardDefinition('001').filename, '001_truth.png');
  assert.equal(getCardFrontAsset('001'), 'assets/masters/001_truth.png');
  assert.equal(getCardFrontAsset('001', 'thumbnail'), 'assets/generated/thumbnail/fronts/001_truth.png');

  assert.equal(CARD_BACKS.length, 3);
  assert.equal(getCardBackAsset('classic'), 'assets/backs/back_classic.png');
  assert.equal(getCardBackAsset('chaos_tier', 'mobile'), 'assets/generated/mobile/backs/back_chaos_tier.png');
  assert.equal(getCardBackAsset('house_deck', 'web-medium'), 'assets/generated/web-medium/backs/back_house_deck.png');
});

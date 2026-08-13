import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CARD_BACKS, cardDefinitions, getCardBackAsset, getCardFrontAsset } from '../src/index.ts';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0), 0x89504e47);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20)
  };
}

function listPngs(path: string): readonly string[] {
  return readdirSync(path)
    .filter((filename) => filename.endsWith('.png'))
    .sort();
}

test('canonical card masters and backs are present with audited dimensions', () => {
  const mastersPath = resolve(packageRoot, 'assets/masters');
  const backsPath = resolve(packageRoot, 'assets/backs');

  assert.equal(listPngs(mastersPath).length, 112);
  assert.equal(listPngs(backsPath).length, 3);

  for (const definition of cardDefinitions) {
    const assetPath = resolve(packageRoot, getCardFrontAsset(definition.id));
    assert.equal(existsSync(assetPath), true, `missing master ${definition.id}`);
    assert.deepEqual(pngSize(assetPath), { width: 1080, height: 1512 });
  }

  for (const back of CARD_BACKS) {
    const assetPath = resolve(packageRoot, getCardBackAsset(back.kind));
    assert.equal(existsSync(assetPath), true, `missing back ${back.kind}`);
    assert.deepEqual(pngSize(assetPath), { width: 1080, height: 1512 });
  }
});

test('generated card derivatives are complete and use deterministic dimensions', () => {
  const expectedSizes = {
    'web-medium': { width: 540, height: 756 },
    mobile: { width: 360, height: 504 },
    thumbnail: { width: 216, height: 302 }
  } as const;

  for (const [size, dimensions] of Object.entries(expectedSizes)) {
    const frontsPath = resolve(packageRoot, `assets/generated/${size}/fronts`);
    const backsPath = resolve(packageRoot, `assets/generated/${size}/backs`);
    assert.equal(listPngs(frontsPath).length, 112);
    assert.equal(listPngs(backsPath).length, 3);

    for (const definition of cardDefinitions) {
      const assetPath = resolve(packageRoot, getCardFrontAsset(definition.id, size as keyof typeof expectedSizes));
      assert.equal(existsSync(assetPath), true, `missing ${size} front ${definition.id}`);
      assert.deepEqual(pngSize(assetPath), dimensions);
    }

    for (const back of CARD_BACKS) {
      const assetPath = resolve(packageRoot, getCardBackAsset(back.kind, size as keyof typeof expectedSizes));
      assert.equal(existsSync(assetPath), true, `missing ${size} back ${back.kind}`);
      assert.deepEqual(pngSize(assetPath), dimensions);
    }
  }
});

test('supplied design-generation source is preserved for future full-deck regeneration', () => {
  const designSourcePath = resolve(packageRoot, 'design-source');
  const expectedFiles = [
    'card_back_template_source.html',
    'card_manifest.json',
    'card_template_source.html',
    'design-tokens.css',
    'design-tokens.json'
  ];

  assert.deepEqual(readdirSync(designSourcePath).sort(), expectedFiles);
});

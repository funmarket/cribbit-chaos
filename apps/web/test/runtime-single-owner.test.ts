import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
}

test('Web shell boots only one gameplay/display runtime owner', () => {
  const indexHtml = read('apps/web/index.html');
  const mainSource = read('apps/web/src/main.ts');

  const bootsCanonicalRuntime = indexHtml.includes('initializeCanonicalGameRuntime') || indexHtml.includes('canonical-game-runtime');
  const bootsLegacyCompatibility = /runtimeMode\s*:\s*['"]legacy-compatibility['"]/.test(mainSource);

  assert.equal(
    bootsCanonicalRuntime && bootsLegacyCompatibility,
    false,
    'Web must not boot canonical-game-runtime and legacy-compatibility at the same time because both own gameplay/display controls.'
  );
});

test('Web production shell does not register competing capture click owners', () => {
  const indexHtml = read('apps/web/index.html');
  const canonicalSource = read('apps/web/src/canonical-game-runtime.ts');
  const liveSessionSource = read('apps/web/src/live-session.ts');

  const canonicalRuntimeActive = indexHtml.includes('initializeCanonicalGameRuntime') || indexHtml.includes('canonical-game-runtime');
  const canonicalCapturesClicks = /document\.addEventListener\(\s*['"]click['"][\s\S]*?,\s*true\s*\)/.test(canonicalSource);
  const liveSessionCapturesClicks = /document\.addEventListener\(\s*['"]click['"][\s\S]*?,\s*true\s*\)/.test(liveSessionSource);

  assert.equal(
    canonicalRuntimeActive && canonicalCapturesClicks && liveSessionCapturesClicks,
    false,
    'Web must not keep canonical runtime and live-session capture click owners active together.'
  );
});

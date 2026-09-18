import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
}

test('Web shell boots only one gameplay/display runtime owner', () => {
  const indexHtml = read('apps/web/index.html');
  const mainSource = read('apps/web/src/main.ts');

  const bootsCanonicalRuntime = /initializeCanonicalGameRuntime/.test(mainSource) || indexHtml.includes('initializeCanonicalGameRuntime') || indexHtml.includes('canonical-game-runtime');
  const bootsLegacyCompatibility = /runtimeMode\s*:\s*['"]legacy-compatibility['"]/.test(mainSource);

  assert.equal(bootsCanonicalRuntime, true, 'Web local game must boot the Game_rules.md-aligned canonical runtime.');
  assert.equal(bootsLegacyCompatibility, false, 'Web local game must not boot the stale legacy-compatibility runtime.');
  assert.equal(
    bootsCanonicalRuntime && bootsLegacyCompatibility,
    false,
    'Web must not boot canonical-game-runtime and legacy-compatibility at the same time because both own gameplay/display controls.'
  );
});

test('Web production shell does not register competing capture click owners', () => {
  const indexHtml = read('apps/web/index.html');
  const mainSource = read('apps/web/src/main.ts');
  const canonicalSource = read('apps/web/src/canonical-game-runtime.ts');
  const liveSessionSource = read('apps/web/src/live-session.ts');

  const canonicalRuntimeActive = /initializeCanonicalGameRuntime/.test(mainSource) || indexHtml.includes('initializeCanonicalGameRuntime') || indexHtml.includes('canonical-game-runtime');
  const canonicalCapturesClicks = /document\.addEventListener\(\s*['"]click['"]\s*,\s*[^,\n]+,\s*true\s*\)/.test(canonicalSource);
  const liveSessionCapturesClicks = /document\.addEventListener\(\s*['"]click['"]\s*,\s*[^,\n]+,\s*true\s*\)/.test(liveSessionSource);

  assert.equal(
    canonicalRuntimeActive && canonicalCapturesClicks && liveSessionCapturesClicks,
    false,
    'Web must not keep canonical runtime and live-session capture click owners active together.'
  );
});

test('Web canonical runtime encodes the corrected Game_rules.md card behavior', () => {
  const source = read('apps/web/src/canonical-game-runtime.ts');

  assert.match(source, /kind:'truth',targetId:null,step:'target'/);
  assert.match(source, /function\s+selectTruthTarget/);
  assert.doesNotMatch(source, /kind:'truth',targetId:a\.id,step:'source'/);

  assert.match(source, /draws exactly 1 real card/);
  assert.doesNotMatch(source, /bonus Play-or-Draw action/);

  assert.match(source, /kind:'reverse_confession',step:'target',targetId:null/);
  assert.match(source, /gives one confession about themselves/);
  assert.doesNotMatch(source, /answers the card holder's question|You will ask the question/);
});

test('Web live room controls never invent stale social-card actions outside shared capabilities', () => {
  const liveSource = read('apps/web/src/live-session.ts');

  assert.match(liveSource, /const projected = decisionControls\(session,userId\);\n  if \(projected\) return projected;/);
  assert.doesNotMatch(liveSource, /social\.cardKind === 'truth' \|\| social\.cardKind === 'dare'/);
  assert.doesNotMatch(liveSource, /Answered Live','answer-live'\) \$\{button\('Type Answer','answer-type-open'/);
  assert.doesNotMatch(liveSource, /otherPlayers\.map\(player => button\(`Target/);
});

test('Web live room controls render and submit shared capability buttons', () => {
  const liveSource = read('apps/web/src/live-session.ts');

  assert.match(liveSource, /function decisionControls\(session:LiveSession, userId:string\): string \{\n  const capabilities = projectDecisionCapabilities\(session\.state,userId\);/);
  assert.match(liveSource, /capabilities\.options\.map\(option => `<button class="button button--sm" type="button" data-live-option-id="\$\{escapeHTML\(option\.optionId\)\}">/);
  assert.match(liveSource, /const liveOption = target\.closest<HTMLElement>\('\[data-live-option-id\]'\);/);
  assert.match(liveSource, /const selected = projectDecisionCapabilities\(live\.state,userId\)\.options\.find\(option => option\.optionId === liveOption\.dataset\.liveOptionId\);\n      if \(selected\) return void send\(selected\.command as CommandBody\);/);
  assert.doesNotMatch(liveSource, /return '<span class="tag" data-tone="cyan">Shared special-card flow in progress<\/span>';/);
});

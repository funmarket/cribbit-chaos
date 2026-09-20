import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
}

test('production Web shells the engine/API path as the only gameplay owner', () => {
  const indexHtml = read('apps/web/index.html');
  const mainSource = read('apps/web/src/main.ts');

  const bootsCanonicalRuntime = /initializeCanonicalGameRuntime/.test(mainSource) || indexHtml.includes('initializeCanonicalGameRuntime') || indexHtml.includes('canonical-game-runtime');
  const bootsLegacyCompatibility = /runtimeMode\s*:\s*['"]legacy-compatibility['"]/.test(mainSource);

  const bootsLivePath =
    indexHtml.includes('/src/live-entry.ts') && /runtimeMode\s*:\s*['"]none['"]/.test(mainSource);

  assert.equal(
    bootsCanonicalRuntime,
    false,
    'Production Web must not boot canonical-game-runtime: the shared engine/API path is the single gameplay authority.'
  );
  assert.equal(bootsLegacyCompatibility, false, 'Production Web must not boot the stale legacy-compatibility runtime.');
  assert.equal(
    bootsLivePath,
    true,
    'Production Web must boot the live/API path (live-entry plus runtimeMode none).'
  );
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

  assert.match(liveSource, /function decisionControls\(session:LiveSessionView, userId:string\): string \{\n  const capabilities = projectDecisionCapabilities\(session\.state,userId\);/);
  assert.match(liveSource, /capabilities\.options\.map\(option => `<button class="button button--sm" type="button" data-live-option-id="\$\{escapeHTML\(option\.optionId\)\}">/);
  assert.match(liveSource, /const liveOption = target\.closest<HTMLElement>\('\[data-live-option-id\]'\);/);
  assert.match(liveSource, /const selected = projectDecisionCapabilities\(live\.state,userId\)\.options\.find\(option => option\.optionId === liveOption\.dataset\.liveOptionId\);\n      if \(selected\) return void send\(selected\.command as CommandBody\);/);
  assert.doesNotMatch(liveSource, /return '<span class="tag" data-tone="cyan">Shared special-card flow in progress<\/span>';/);
});

test('production Web cannot re-acquire client gameplay authority', () => {
  const mainSource = read('apps/web/src/main.ts');
  const indexHtml = read('apps/web/index.html');

  // No boot of a duplicate runtime, now or later.
  assert.doesNotMatch(mainSource, /initializeCanonicalGameRuntime/);
  assert.doesNotMatch(mainSource, /from '\.\/canonical-game-runtime\.ts'/);
  assert.doesNotMatch(indexHtml, /canonical-game-runtime/);

  // The only scripts the production shell may load.
  const scripts = [...indexHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(scripts.includes('/src/live-entry.ts'), true, 'production Web must load the live/API entry');
  for (const script of scripts) {
    assert.equal(
      /canonical-game-runtime|legacy-runtime/.test(script),
      false,
      `production Web must not load another gameplay runtime (${script})`
    );
  }

  // Clients must not implement gameplay decisions: legality, turns, timers, bots, winner.
  const clientAuthorityPattern =
    /function\s+(legal|playCard|drawTurn|finishTurn|confirmWin|scheduleBot|autoBots)\s*\(/;
  for (const file of [
    'apps/web/src/live-session.ts',
    'apps/telegram/src/backendGame.ts',
    'apps/telegram/src/simulation.ts',
  ]) {
    assert.doesNotMatch(read(file), clientAuthorityPattern, `${file} must not implement gameplay authority`);
  }
});

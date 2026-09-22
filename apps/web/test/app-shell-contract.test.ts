import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * APP-SHELL-1 contract: the Web application is one product shell.
 *
 * These assertions are about the shell that every view shares, not about view
 * content: one structural header owner, one canonical bar height independent of
 * the active view, the mobile trigger on the left, the approved wordmark
 * visually centered, product utilities on the right, QA/diagnostic presentation
 * kept out of the product bar, and every [data-nav] destination resolving to a
 * real [data-view].
 */

const template = readFileSync(new URL('../../../packages/ui/src/template.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../packages/ui/src/styles.css', import.meta.url), 'utf8');
const webMain = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../../../packages/ui/src/bootstrap.ts', import.meta.url), 'utf8');

const ESTABLISHED_VIEWS = ['lobby', 'game', 'rooms', 'board', 'library', 'create', 'call', 'lab', 'recap'];

function attributeValues(source: string, attribute: string): string[] {
  return [...source.matchAll(new RegExp(`data-${attribute}="([a-z0-9-]+)"`, 'g'))].map(match => match[1]);
}

function headerRegion(): string {
  const start = template.indexOf('class="app-header"');
  const end = template.indexOf('</header>', start);
  assert.ok(start >= 0 && end > start, 'the shared template must contain one app-header region');
  return template.slice(start, end);
}

function firstIndexWithin(region: string, needle: string): number {
  const index = region.indexOf(needle);
  assert.ok(index >= 0, `the shell header must contain ${needle}`);
  return index;
}

test('the shell has exactly one structural header owner and no second product bar', () => {
  assert.equal((template.match(/class="app-header"/g) ?? []).length, 1, 'exactly one app-header');
  assert.equal((template.match(/<header class="app-header">/g) ?? []).length, 1, 'one header element');
  assert.equal((template.match(/class="game-header"|class="board-header"/g) ?? []).length, 0, 'no view-specific product header');
});

test('the canonical header is a three-zone shell: left trigger, centered wordmark, right utilities', () => {
  const header = headerRegion();
  const left = firstIndexWithin(header, 'class="header-left"');
  const center = firstIndexWithin(header, 'class="header-center"');
  const right = firstIndexWithin(header, 'class="header-right"');
  assert.ok(left < center && center < right, 'left, center and right zones must appear in that order');

  const leftZone = header.slice(left, center);
  const centerZone = header.slice(center, right);
  const rightZone = header.slice(right);

  assert.match(leftZone, /data-action="open-mobile-nav"/, 'the mobile navigation trigger belongs to the top-left zone');
  assert.match(centerZone, /class="brand-lockup"/, 'the approved Cribbit wordmark is the centered zone');
  assert.match(rightZone, /data-action="toggle-appearance"/, 'the appearance control belongs to the top-right utilities');
  assert.match(rightZone, /data-action="open-notifications"/, 'the notification utility belongs to the top-right utilities');
  assert.match(rightZone, /data-action="open-global-search"/, 'search stays with the top-right utilities');
  assert.match(rightZone, /data-action="open-profile"/, 'the profile control stays with the top-right utilities');
});

test('the appearance control is a top-right utility with an accessible label and pressed state', () => {
  const header = headerRegion();
  const appearance = /<button[^>]*data-action="toggle-appearance"[^>]*>/.exec(header)?.[0] ?? '';
  assert.ok(appearance, 'the shell must expose a dark/light appearance control');
  assert.match(appearance, /aria-label="[^"]+"/, 'the appearance control needs an accessible label');
  assert.match(appearance, /aria-pressed="(true|false)"/, 'the appearance control must expose its pressed state');
  assert.match(appearance, /type="button"/, 'shell utilities are real buttons');
});

test('QA and diagnostic presentation cannot occupy or resize the production product bar', () => {
  const header = headerRegion();
  for (const diagnostic of ['status-cluster', 'connectionPill', 'revisionLabel', 'fixturePill', 'simulate-disconnect', 'reset-demo']) {
    assert.ok(!header.includes(diagnostic), `${diagnostic} must not be part of the production product bar`);
  }
  const stripStart = template.indexOf('data-diagnostics');
  assert.ok(stripStart > template.indexOf('</header>'), 'diagnostics must live in a separate surface below the product bar');
  const strip = template.slice(stripStart);
  for (const kept of ['connectionPill', 'revisionLabel', 'fixturePill', 'simulate-disconnect', 'reset-demo']) {
    assert.ok(strip.includes(kept), `${kept} functionality must be preserved in the diagnostic surface`);
  }
  assert.match(strip, /data-diagnostics[^>]*hidden/, 'the diagnostic surface is hidden unless a dev/fixture context asks for it');
});

test('every [data-nav] target resolves to a real [data-view] and no menu item points at a missing page', () => {
  const views = new Set(attributeValues(template, 'view'));
  const navs = new Set(attributeValues(template, 'nav'));
  for (const view of ESTABLISHED_VIEWS) assert.ok(views.has(view), `the established view ${view} must exist`);
  for (const nav of navs) assert.ok(views.has(nav), `[data-nav="${nav}"] must resolve to a real view`);
});

test('the product bar keeps one canonical height per breakpoint, never per view', () => {
  assert.match(styles, /\.app-header\s*\{[^}]*min-height:\s*var\(--header-h\)/s, 'the product bar height comes from the shared token');
  assert.match(styles, /\.app-header__inner\s*\{[^}]*height:\s*var\(--header-h\)/s, 'the inner bar is a fixed canonical height');
  assert.match(styles, /\.app-header__inner\s*\{[^}]*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/s,
    'the bar uses a real centering layout with equal side zones');
  assert.ok(!/body\.is-game-view\s+\.app-header(?:__inner)?\s*\{[^}]*height:/s.test(styles),
    'no view may override the canonical product bar height');
  assert.ok(!/\.app-header__inner\s*\{[^}]*padding:\s*10px\s+0/s.test(styles),
    'the bar must not add padding that changes its composed height');
});

test('the shared stylesheet owns light and dark appearance surfaces', () => {
  assert.match(styles, /\[data-appearance="light"\]/, 'the shell must define a light appearance surface');
  assert.match(styles, /\[data-appearance="dark"\]|:root\s*\{[^}]*--text:/s, 'the shell must keep a dark appearance surface');
  assert.match(styles, /\.diagnostic-strip\s*\{/, 'the diagnostic surface needs its own presentation');
});

test('production Web keeps one navigation owner and never boots the compatibility runtime', () => {
  assert.match(webMain, /runtimeMode:\s*'none'/, 'production Web boots the shared shell only');
  assert.ok(!/legacy-compatibility/.test(webMain), 'production Web must not boot the compatibility runtime');
  assert.ok(!/canonical-game-runtime/.test(webMain), 'production Web must not boot a second client runtime');
  assert.match(bootstrap, /installSharedNavigation\(/, 'the shared navigation controller owns page switching');
  assert.match(bootstrap, /installAppearance\(/, 'the shared shell installs its appearance controller');
  assert.equal((bootstrap.match(/installSharedNavigation\(/g) ?? []).length, 1, 'one navigation owner per boot');
});

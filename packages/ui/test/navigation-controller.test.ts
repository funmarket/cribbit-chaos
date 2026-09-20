import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  activateSharedView,
  navigationViewFor,
  type SharedNavigationElement,
  type SharedNavigationRoot,
} from '../src/navigation-controller.ts';

// Regression guard for the Web navigation defect: the mounted template contains
// [data-nav] controls and [data-view] sections, but the page-switching handler
// lived only in the retired legacy runtime. The shared controller must map
// [data-nav] to the matching existing [data-view] without owning any game state.

type FakeElement = SharedNavigationElement & {
  attributes: Record<string, string>;
  classes: Set<string>;
  getAttribute(name: string): string | null;
};

function datasetFrom(attributes: Record<string, string>): Record<string, string | undefined> {
  const dataset: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(attributes)) {
    const match = /^data-([a-z0-9-]+)$/.exec(name);
    if (!match) continue;
    dataset[match[1].replace(/-([a-z0-9])/g, (_all, character: string) => character.toUpperCase())] = value;
  }
  return dataset;
}

function fakeElement(attributes: Record<string, string>): FakeElement {
  const element: FakeElement = {
    attributes: { ...attributes },
    classes: new Set<string>(),
    dataset: datasetFrom(attributes),
    classList: {
      toggle(token: string, force?: boolean): boolean {
        const next = force ?? !element.classes.has(token);
        if (next) element.classes.add(token);
        else element.classes.delete(token);
        return next;
      },
    },
    setAttribute(name: string, value: string): void {
      element.attributes[name] = value;
    },
    getAttribute(name: string): string | null {
      return element.attributes[name] ?? null;
    },
  };
  return element;
}

function fakeRoot(viewNames: readonly string[], navValues: readonly string[]) {
  const views = viewNames.map(name => fakeElement({ 'data-view': name }));
  const navs = navValues.map(value => fakeElement({ 'data-nav': value }));
  const body = fakeElement({});

  const root: SharedNavigationRoot = {
    querySelector(selector: string): SharedNavigationElement | null {
      if (selector === 'body') return body;
      const match = /^\.view\[data-view="([a-z0-9-]+)"\]$/.exec(selector);
      if (!match) return null;
      return views.find(view => view.dataset.view === match[1]) ?? null;
    },
    querySelectorAll(selector: string): ArrayLike<SharedNavigationElement> {
      if (selector === '.view') return views;
      if (selector === '[data-nav]') return navs;
      return [];
    },
  };

  return { root, views, navs, body };
}

const TEMPLATE_VIEWS = ['lobby', 'game', 'rooms', 'board', 'library', 'create', 'call', 'lab', 'recap'];

test('navigationViewFor resolves the destination view declared by [data-nav]', () => {
  assert.equal(navigationViewFor({ getAttribute: () => 'board' }), 'board');
  assert.equal(navigationViewFor({ getAttribute: () => ' lobby ' }), 'lobby');
  assert.equal(navigationViewFor({ getAttribute: () => null }), null);
  assert.equal(navigationViewFor({ getAttribute: () => '' }), null);
  assert.equal(navigationViewFor({ getAttribute: () => '   ' }), null);
  assert.equal(navigationViewFor({ getAttribute: () => 'not a view' }), null);
});

test('activateSharedView activates exactly the matching [data-view] section', () => {
  const { root, views, body } = fakeRoot(TEMPLATE_VIEWS, ['lobby', 'board']);

  assert.equal(activateSharedView('board', root), true);
  assert.equal(views.find(view => view.dataset.view === 'board')?.classes.has('is-active'), true);
  assert.equal(views.find(view => view.dataset.view === 'lobby')?.classes.has('is-active'), false);
  assert.equal(body.classes.has('is-game-view'), false);

  assert.equal(activateSharedView('game', root), true);
  assert.equal(views.find(view => view.dataset.view === 'game')?.classes.has('is-active'), true);
  assert.equal(views.find(view => view.dataset.view === 'board')?.classes.has('is-active'), false);
  assert.equal(body.classes.has('is-game-view'), true);

  assert.equal(activateSharedView('lobby', root), true);
  assert.equal(body.classes.has('is-game-view'), false);
});

test('activateSharedView marks aria-current on every [data-nav] control', () => {
  const { root, navs } = fakeRoot(TEMPLATE_VIEWS, ['lobby', 'board', 'game']);

  assert.equal(activateSharedView('board', root), true);
  assert.deepEqual(
    navs.map(nav => nav.attributes['aria-current']),
    ['false', 'page', 'false'],
  );

  activateSharedView('lobby', root);
  assert.deepEqual(
    navs.map(nav => nav.attributes['aria-current']),
    ['page', 'false', 'false'],
  );
});

test('activateSharedView refuses a view the template does not have', () => {
  const { root, views, navs } = fakeRoot(TEMPLATE_VIEWS, ['lobby']);

  assert.equal(activateSharedView('nowhere', root), false);
  assert.equal(views.every(view => !view.classes.has('is-active')), true);
  assert.equal(navs[0].attributes['aria-current'], undefined);
});

test('every [data-nav] control in the shared template has an existing view', () => {
  const template = readFileSync(new URL('../src/template.html', import.meta.url), 'utf8');
  const navValues = new Set(Array.from(template.matchAll(/data-nav="([a-z0-9-]+)"/g), match => match[1]));
  const viewValues = new Set(Array.from(template.matchAll(/data-view="([a-z0-9-]+)"/g), match => match[1]));

  assert.ok(navValues.size >= 7, 'expected the shared template to keep its navigation controls');
  for (const navValue of Array.from(navValues)) {
    assert.ok(viewValues.has(navValue), `[data-nav="${navValue}"] has no matching [data-view] section`);
  }
});

test('the navigation controller carries no gameplay or runtime authority', () => {
  const controller = readFileSync(new URL('../src/navigation-controller.ts', import.meta.url), 'utf8');

  for (const forbidden of ['legacy-runtime', 'canonical-game-runtime', 'game-engine', 'api-client']) {
    assert.equal(controller.includes(forbidden), false, `navigation controller must not reference ${forbidden}`);
  }
});

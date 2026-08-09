import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const template = fs.readFileSync(path.join(root,'packages/ui/src/template.html'),'utf8');
const runtime = fs.readFileSync(path.join(root,'packages/legacy-runtime/src/runtime.ts'),'utf8');
const registry = fs.readFileSync(path.join(root,'packages/action-registry/src/index.ts'),'utf8');

const literalActions = new Set();
for (const text of [template,runtime]) for (const m of text.matchAll(/data-action=(?:"|'|`)([^"'`$<>]+)(?:"|'|`)/g)) literalActions.add(m[1]);
['paranoia-choice','duel-target','chaos-target'].forEach(v=>literalActions.add(v));
const assigned = new Set([...registry.matchAll(/action:'([^']+)'/g)].map(m=>m[1]));
const missing = [...literalActions].filter(v=>!assigned.has(v)).sort();

const buttons = [...template.matchAll(/<button\b([^>]*)>/gi)];
const buttonsWithoutType = buttons.filter(m=>!/\btype\s*=\s*["'](?:button|submit|reset)["']/i.test(m[1]));
const ids = [...template.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicateIds = [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
const inlineHandlers = [...template.matchAll(/\son[a-z]+\s*=/gi)];

// Every static button must have a known interaction mechanism: action, nav, one
// of the documented data controls, or be the single prompt submit button.
const controlAttrs = ['data-nav','data-board-tab','data-library-tab','data-create-destination','data-room-category','data-mode','data-source','data-filter','data-close-dialog','data-call-mode'];
const unclassifiedButtons = buttons.filter(m => {
  const a=m[1];
  if (/data-action=/.test(a)) return false;
  if (controlAttrs.some(attr=>a.includes(attr+'='))) return false;
  if (/id=["']startGameButton["']/.test(a)) return false;
  if (/type=["']submit["']/.test(a)) return false;
  return true;
});

const report = {
  actionsDiscovered: literalActions.size,
  actionsAssigned: assigned.size,
  missingAssignments: missing,
  staticButtons: buttons.length,
  unclassifiedButtons: unclassifiedButtons.length,
  buttonsWithoutType: buttonsWithoutType.length,
  duplicateIds,
  inlineHandlers: inlineHandlers.length
};
console.log(JSON.stringify(report,null,2));
if (missing.length || unclassifiedButtons.length || buttonsWithoutType.length || duplicateIds.length || inlineHandlers.length) process.exitCode=1;

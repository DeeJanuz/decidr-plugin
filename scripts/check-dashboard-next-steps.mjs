import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const dashboard = read('renderers/dashboard.js');
const components = read('renderers/shared/02-components.js');
const slideouts = read('renderers/shared/03-slideouts.js');

assert.match(
  dashboard,
  /activeDecisionsVisible:\s*false/,
  'Active Decisions must start collapsed behind a toggle.'
);
assert.match(
  dashboard,
  /Show active decisions/,
  'Active Decisions must expose a show toggle.'
);
assert.match(
  dashboard,
  /nextStepsGroupExpanded\[groupType\]\s*!==\s*false/,
  'Next Steps groups must default expanded.'
);
assert.doesNotMatch(
  dashboard,
  /Inject open PRs/,
  'Dashboard must not inject all open PRs into Next Steps.'
);

assert.match(
  slideouts,
  /RESPONSIBILITIES/,
  'Decision slideout must render a responsibilities section.'
);
assert.match(
  slideouts,
  /No implementer assigned/,
  'Decision slideout must show a clear empty implementer state.'
);
assert.match(
  components,
  /API\.listMembers\(\)/,
  'Responsibilities editor must load active members through API.listMembers().'
);
assert.match(
  components,
  /API\.updateDecision\(id,\s*\{\s*ownerId:[\s\S]*implementerId:/,
  'Responsibilities editor must save ownerId and implementerId.'
);
assert.match(
  components,
  /UI\.SlideOut\._refetchAndRender\(\)/,
  'Responsibilities save must refetch the decision and trigger refresh callbacks.'
);

console.log('Dashboard Next Steps renderer checks passed.');

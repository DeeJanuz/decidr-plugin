import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const dashboard = read('renderers/dashboard.js');
const theme = read('renderers/shared/01-theme.js');
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
assert.match(
  components,
  /UI\.workflowNextStep\s*=\s*function/,
  'Shared components must expose workflowNextStep().'
);
assert.match(
  components,
  /UI\.workflowSummary\s*=\s*function/,
  'Shared components must expose workflowSummary().'
);
assert.match(
  components,
  /UI\.workflowPills\s*=\s*function/,
  'Shared components must expose workflowPills().'
);
assert.match(
  components,
  /UI\.workflowPeopleText\s*=\s*function/,
  'Shared components must expose workflowPeopleText().'
);
assert.match(
  components,
  /workflowPersonText\('Owner'/,
  'Workflow people text must render full owner names.'
);
assert.match(
  components,
  /workflowPersonText\('Implementor'/,
  'Workflow people text must render full implementor names.'
);
[
  'Needs approval',
  'Needs review/approval',
  'Start implementation',
  'Stage after build/test',
  'Add to implemented after production-equivalent release',
  'Move out of backlog when ready',
  'Move to To Do when ready',
  'Complete when done',
  'Review status'
].forEach((label) => {
  assert.match(components, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Missing next-step label: ${label}`);
});
assert.match(
  components,
  /Next:\s*'\s*\+\s*statusLabel\(transitions\[0\]\)/,
  'Unknown statuses with allowed transitions must render the first transition.'
);
assert.match(
  dashboard,
  /function enrichActionItem\(item\)/,
  'Dashboard must enrich action items from fetched decisions/tasks.'
);
assert.match(
  dashboard,
  /showWorkflow:\s*true/,
  'Dashboard cards must opt into workflow pills.'
);
assert.match(
  dashboard,
  /workflowEntity:\s*item/,
  'Next Steps must pass enriched action-item data to workflow pills.'
);
assert.match(
  components,
  /UI\.workflowPills\(workflowEntity,\s*entityType,\s*\{\s*className:\s*'decidr-workflow-pills-next-step',\s*fields:\s*\['stage',\s*'nextStep'\]/,
  'Next Steps must keep only Stage and Next step in the header pills.'
);
assert.match(
  components,
  /UI\.workflowPeopleText\(workflowEntity,\s*entityType/,
  'Next Steps must render Owner and Implementor as text on the activity line.'
);
assert.match(
  components,
  /workflowStatusClass\(entity\s*&&\s*entity\.status\)/,
  'Workflow stage pills must include status-specific color classes.'
);
assert.match(
  slideouts,
  /fields:\s*\['stage',\s*'nextStep'\]/,
  'Decision responsibilities card must include Stage and Next step workflow pills.'
);
assert.match(
  slideouts,
  /decidr-so-workflow-card/,
  'Task slideout must render compact workflow pills.'
);
assert.match(
  theme,
  /decidr-workflow-pill-action/,
  'Theme must include workflow pill styles.'
);
assert.match(
  theme,
  /decidr-workflow-pill-action \.decidr-workflow-pill-text[\s\S]*?overflow:\s*visible[\s\S]*?text-overflow:\s*clip/,
  'Next-step workflow pill text must not be truncated.'
);
assert.match(
  theme,
  /decidr-workflow-person-name-owner/,
  'Theme must include colored owner name styles.'
);
assert.match(
  theme,
  /decidr-workflow-person-name-implementor/,
  'Theme must include colored implementor name styles.'
);
assert.match(
  theme,
  /decidr-workflow-pill-status-draft/,
  'Theme must include colored status workflow pill styles.'
);
assert.match(
  theme,
  /decidr-next-step-header \.decidr-workflow-pills,[\s\S]*?margin-left:\s*2px/,
  'Workflow pills must start immediately after the type/action label, not right-align.'
);
assert.match(
  theme,
  /decidr-workflow-pills \+ \.decidr-copy-ref-btn[\s\S]*?margin-left:\s*auto/,
  'Copy buttons must keep the trailing whitespace after workflow pills.'
);
assert.doesNotMatch(
  dashboard,
  /'TODO task':\s*\{\s*badge:\s*'Tasks'/,
  'Task cards must not render the redundant TASKS action pill.'
);

console.log('Dashboard Next Steps renderer checks passed.');

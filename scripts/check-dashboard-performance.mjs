import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const dashboard = read('renderers/dashboard.js');
const api = read('renderers/shared/00-api-client.js');
const components = read('renderers/shared/02-components.js');

const failures = [];

function requireText(source, text, label) {
  if (!source.includes(text)) failures.push(`missing ${label}: ${text}`);
}

requireText(api, 'getDashboardSummary', 'summary API method');
requireText(api, 'getDashboardDrilldowns', 'drilldown API method');
requireText(api, 'getDashboardPreview', 'dashboard preview cache');
requireText(api, 'putDashboardPreview', 'dashboard preview write');
requireText(api, 'purgeDashboardPreview', 'dashboard preview purge');
requireText(api, 'DASHBOARD_CACHE_MAX_AGE_MS = 60000', '60-second cache age');
requireText(api, 'DASHBOARD_CACHE_MAX_ENTRIES = 4', 'four-entry cache cap');
requireText(api, 'DASHBOARD_CACHE_MAX_BYTES = 512 * 1024', 'cache byte cap');
requireText(api, '_currentOAuthClientId', 'OAuth client cache scope');
requireText(api, '_currentOAuthScopes.join', 'OAuth scope cache key');
requireText(api, 'options.signal', 'abort signal propagation');
requireText(api, 'evictDashboardEntity', '404 cache eviction');

requireText(dashboard, 'loadLegacyDashboard', 'temporary compatibility path');
requireText(dashboard, 'err.status === 404 || err.status === 501', '404/501-only fallback');
requireText(dashboard, 'API.getDashboardSummary', 'single summary startup');
requireText(dashboard, 'API.getDashboardDrilldowns', 'background drilldown preload');
requireText(dashboard, 'dashState.readOnlyPreview', 'locked preview state');
requireText(dashboard, 'API.putDashboardPreview', 'fresh preview cache write');
requireText(dashboard, 'API.purgeDashboardPreview', 'auth/mutation cache purge');
requireText(dashboard, 'new AbortController()', 'request cancellation');
requireText(dashboard, 'nextStepsFacets', 'stable authoritative filter facets');
requireText(
  dashboard,
  '{ preserveLoading: true, skipSession: true }',
  'explicit-org session-preflight bypass'
);

requireText(components, 'decisionCount', 'project count-only rendering');
requireText(components, 'taskDoneCount', 'project task progress summary');
requireText(components, 'err.status === 404', 'entity 404 eviction');

if ((dashboard.match(/API\.getDashboardSummary/g) || []).length !== 1) {
  failures.push('dashboard must contain exactly one authoritative summary call site');
}
if ((dashboard.match(/API\.getDashboardDrilldowns/g) || []).length !== 1) {
  failures.push('dashboard must contain exactly one background drilldown call site');
}
for (const forbidden of ['localStorage', 'sessionStorage', 'serviceWorker', 'caches.open']) {
  if (dashboard.includes(forbidden) || api.includes(forbidden)) {
    failures.push(`dashboard protected cache must not use ${forbidden}`);
  }
}

if (failures.length > 0) {
  console.error('Dashboard performance contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Dashboard performance contract passed.');

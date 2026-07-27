import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'renderers/shared/00-api-client.js'),
  'utf8'
);
const requests = [];
let nextResponse = {
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({ representation_version: 'dashboard.v1' }),
  text: async () => '',
};

const window = {
  __mcpviews_plugins: { decidr: { version: '0.1.67' } },
};
const context = {
  window,
  TextEncoder,
  AbortController,
  CustomEvent,
  URL,
  fetch: async (url, options) => {
    requests.push({ url, options });
    return nextResponse;
  },
};
vm.runInNewContext(source, context, {
  filename: 'renderers/shared/00-api-client.js',
});

const api = window.__decidrAPI;
const viewer = {
  id: 'user_1',
  membership_role: 'MEMBER',
  oauth_client_id: 'client_1',
  oauth_scopes: ['read:dashboard'],
};
const summary = {
  representation_version: 'dashboard.v1',
  organization: { id: 'org_1', name: 'Organization One' },
  viewer,
  next_steps: { data: [] },
};

api.init('https://staging.app.decidrmcp.com/api', 'token_1');
api.setActiveOrg('org_1');
api.setVerifiedPrincipal(viewer);
api.putDashboardPreview('org_1', summary, null);

const preview = api.getDashboardPreview('org_1');
assert.equal(preview.summary.organization.id, 'org_1');
preview.summary.organization.name = 'mutated';
assert.equal(
  api.getDashboardPreview('org_1').summary.organization.name,
  'Organization One',
  'cache reads must return detached DTOs'
);

api.setVerifiedPrincipal({ ...viewer, oauth_scopes: ['read:other'] });
assert.equal(
  api.getDashboardPreview('org_1'),
  null,
  'scope changes must not reuse a preview'
);
api.setVerifiedPrincipal(viewer);
assert.ok(api.getDashboardPreview('org_1'));

const controller = new AbortController();
await api.getDashboardSummary({ signal: controller.signal });
assert.equal(
  requests[0].url,
  'https://staging.app.decidrmcp.com/api/dashboard/summary'
);
assert.equal(requests[0].options.signal, controller.signal);
assert.equal(requests[0].options.headers.Authorization, 'Bearer token_1');

nextResponse = {
  ok: false,
  status: 403,
  statusText: 'Forbidden',
  json: async () => ({}),
  text: async () => JSON.stringify({ error: 'Forbidden' }),
};
await assert.rejects(
  api.getDashboardSummary(),
  error => error.status === 403
);
assert.equal(
  api.getDashboardPreview('org_1'),
  null,
  'authorization failure must purge protected previews'
);

api.setVerifiedPrincipal(viewer);
api.putDashboardPreview('org_1', summary, null);
api.setToken('token_2');
assert.equal(
  api.getDashboardPreview('org_1'),
  null,
  'token replacement must purge protected previews'
);

console.log('Dashboard API runtime checks passed.');

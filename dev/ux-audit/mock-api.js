(function() {
  'use strict';

  var payload = window.__decidrTimelineMockPayload || {};
  var people = payload.people || [];
  var initiatives = payload.initiatives || [];
  var projects = payload.projects || [];
  var decisions = payload.decisions || [];
  var tasks = payload.tasks || [];
  var timelineEvents = payload.timelineEvents || [];

  function byId(rows, id) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id) return rows[i];
    }
    return null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function withPeople(row) {
    var copy = clone(row);
    if (copy.createdById) copy.createdBy = byId(people, copy.createdById);
    if (copy.ownerId) copy.owner = byId(people, copy.ownerId);
    if (copy.assigneeId) copy.assignee = byId(people, copy.assigneeId);
    if (copy.projectId) copy.project = byId(projects, copy.projectId);
    if (copy.decisionId) copy.decision = byId(decisions, copy.decisionId);
    return copy;
  }

  var enrichedProjects = projects.map(function(project, index) {
    var p = withPeople(project);
    p.description = p.description || 'Governed workstream with decisions, tasks, proof, and release signals.';
    p.color = ['#2563eb', '#0d9488', '#10b981', '#f59e0b'][index % 4];
    return p;
  });

  var enrichedDecisions = decisions.map(function(decision, index) {
    var d = withPeople(decision);
    d.description = d.description || 'Decision record with lifecycle state, owner context, and implementation proof.';
    d.owner = d.owner || byId(people, d.createdById);
    d.implementor = people[(index + 1) % people.length];
    d.ownerId = d.owner && d.owner.id;
    d.implementorId = d.implementor && d.implementor.id;
    d.reviewers = ['u-daenon'];
    d.nextStep = index % 3 === 0 ? 'Review staged proof' : 'Capture implementation evidence';
    return d;
  });

  var enrichedTasks = tasks.map(function(task, index) {
    var t = withPeople(task);
    t.description = t.description || 'Execution follow-up tied to the governed project.';
    t.owner = t.assignee || byId(people, t.createdById);
    t.nextStep = index % 2 === 0 ? 'Finish task evidence' : 'Resolve blocker';
    return t;
  });

  var bridges = [{
    id: 'bridge-release-docs',
    name: 'Release proof to documentation',
    status: 'ACTIVE',
    fromProjectId: 'project-plugin-release',
    toProjectId: 'project-timeline-ux',
    description: 'Keeps plugin release proof tied to UX documentation updates.',
    createdAt: '2026-06-05T20:00:00.000Z'
  }];

  var issues = [{
    id: 'issue-density',
    githubIssueNumber: 184,
    githubIssueTitle: 'Reduce dashboard visual noise in governance workspace',
    githubState: 'open',
    source: 'GitHub',
    projectId: 'project-timeline-ux'
  }];

  var prs = [{
    id: 'pr-ui-overhaul',
    githubPrNumber: 231,
    branchName: 'ui-design-overhaul-decidr-plugin',
    status: 'OPEN',
    reviewer: byId(people, 'u-daenon'),
    projectId: 'project-plugin-release'
  }];

  var actionItems = [
    {
      entityType: 'DECISION',
      entityId: 'decision-filter-draft',
      title: 'Define dashboard filtering behavior for governed next steps',
      reason: 'Open decision needs attention',
      status: 'DRAFT',
      parentName: 'DecidR development',
      createdAt: '2026-06-06T15:10:00.000Z'
    },
    {
      entityType: 'DECISION',
      entityId: 'decision-project-grouping',
      title: 'Group timeline work by project inside initiative lanes',
      reason: 'Open decision needs attention',
      status: 'STAGED',
      parentName: 'Timeline UX and visibility',
      createdAt: '2026-06-05T21:40:00.000Z'
    },
    {
      entityType: 'DECISION',
      entityId: 'decision-open-span',
      title: 'Keep open decision bars visible through the current date',
      reason: 'Decision in progress',
      status: 'IN_PROGRESS',
      parentName: 'Timeline UX and visibility',
      createdAt: '2026-06-05T18:35:00.000Z'
    },
    {
      entityType: 'TASK',
      entityId: 'task-visual-review',
      title: 'Review grouped project bands with inline browser comments',
      reason: 'TODO task',
      status: 'TODO',
      parentName: 'Timeline UX and visibility',
      createdAt: '2026-06-05T21:28:00.000Z'
    },
    {
      entityType: 'TASK',
      entityId: 'task-dense-window',
      title: 'Stress dense activity in a narrow two-hour period',
      reason: 'Task is blocked',
      status: 'IN_PROGRESS',
      parentName: 'Timeline UX and visibility',
      createdAt: '2026-06-05T17:52:00.000Z'
    }
  ];

  function data(rows) {
    return Promise.resolve({ data: clone(rows) });
  }

  function entity(type, id) {
    var t = String(type || '').toLowerCase();
    if (t === 'project') return byId(enrichedProjects, id);
    if (t === 'decision') return byId(enrichedDecisions, id);
    if (t === 'task') return byId(enrichedTasks, id);
    if (t === 'initiative') return byId(initiatives, id);
    if (t === 'bridge') return byId(bridges, id);
    if (t === 'issue') return byId(issues, id);
    if (t === 'pull_request') return byId(prs, id);
    return null;
  }

  var api = window.__decidrAPI;
  api._initialized = true;
  api._currentUserId = 'u-daenon';
  api.setActiveOrg('mock-org');
  api.hasToken = function() { return false; };
  api.withReady = function(_container, _meta, renderFn) { renderFn(); };
  api.resolveAndBindTargetOrg = function() {
    api.setActiveOrg('mock-org');
    return Promise.resolve({
      organizations: [
        { id: 'mock-org', name: 'Mock DecidR Org', role: 'OWNER', tokenStatus: 'valid' },
        { id: 'staging-org', name: 'Staging Ops Org', role: 'MEMBER', tokenStatus: 'missing' }
      ],
      defaultOrgId: 'mock-org',
      activeOrgId: 'mock-org'
    });
  };
  api.switchOrg = function(orgId) {
    api.setActiveOrg(orgId);
    if (orgId === 'staging-org') return Promise.reject(new Error('Mock org token missing'));
    return Promise.resolve({ ok: true });
  };
  api.setDefaultOrg = function() { return Promise.resolve({ ok: true }); };
  api.clearDefaultOrg = function() { return Promise.resolve({ ok: true }); };
  api.openPluginAuth = function() { return Promise.resolve({ ok: true }); };
  api.listInitiatives = function() { return data(initiatives); };
  api.listProjects = function() { return data(enrichedProjects); };
  api.listDecisions = function(params) {
    var rows = enrichedDecisions;
    if (params && params.projectId) {
      rows = rows.filter(function(row) { return row.projectId === params.projectId || row.entityId === params.projectId; });
    }
    return data(rows);
  };
  api.listTasks = function(params) {
    var rows = enrichedTasks;
    if (params && params.projectId) rows = rows.filter(function(row) { return row.projectId === params.projectId; });
    if (params && params.decisionId) rows = rows.filter(function(row) { return row.decisionId === params.decisionId; });
    return data(rows);
  };
  api.listBridges = function() { return data(bridges); };
  api.listIssues = function() { return data(issues); };
  api.listPRs = function() { return data(prs); };
  api.listMembers = function() { return data(people); };
  api.getActionItems = function() { return data(actionItems); };
  api.getTimeline = function() { return data(timelineEvents); };
  api.getTimelineWindow = function(params) {
    var out = clone(payload);
    out.projects = clone(enrichedProjects);
    out.decisions = clone(enrichedDecisions);
    out.tasks = clone(enrichedTasks);
    out.bridges = clone(bridges);
    out.issues = clone(issues);
    out.prs = clone(prs);
    out.range = {
      from: params && params.from,
      to: params && params.to,
      bufferDays: params && params.bufferDays
    };
    return Promise.resolve({ data: out });
  };
  api.getEntityGithubCounts = function() {
    return Promise.resolve({
      'project-timeline-ux': { issues: 1, openPrs: 1, pendingReviewPrs: 1 },
      'project-plugin-release': { issues: 0, openPrs: 1, pendingReviewPrs: 1 }
    });
  };
  api.getProject = function(id) { return Promise.resolve(clone(byId(enrichedProjects, id))); };
  api.getDecision = function(id) { return Promise.resolve(clone(byId(enrichedDecisions, id))); };
  api.getTask = function(id) { return Promise.resolve(clone(byId(enrichedTasks, id))); };
  api.getBridge = function(id) { return Promise.resolve(clone(byId(bridges, id))); };
  api.getIssue = function(id) { return Promise.resolve(clone(byId(issues, id))); };
  api.getPR = function(id) { return Promise.resolve(clone(byId(prs, id))); };
  api.getPullRequest = api.getPR;
  api.getEntity = function(type, id) { return Promise.resolve(clone(entity(type, id))); };
  api.fetchEntities = function(refs) {
    return Promise.resolve(refs.map(function(ref, index) {
      return { index: index, ref: ref, entity: clone(entity(ref.type, ref.id)) };
    }));
  };
  api.listEntityDocuments = function() { return data([]); };
  api.listAuditEvents = function() { return data(timelineEvents.slice(0, 6)); };
  api.createInitiative = function() { return Promise.resolve({ id: 'mock-created-initiative' }); };
  api.createProject = function() { return Promise.resolve({ id: 'mock-created-project' }); };
  api.createDecision = function() { return Promise.resolve({ id: 'mock-created-decision' }); };
  api.createTask = function() { return Promise.resolve({ id: 'mock-created-task' }); };
  api.post = function() {
    var err = new Error('Mock DecidR session missing');
    err.status = 401;
    return Promise.reject(err);
  };

  window.__decidrAuditMock = {
    people: people,
    initiatives: initiatives,
    projects: enrichedProjects,
    decisions: enrichedDecisions,
    tasks: enrichedTasks,
    bridges: bridges,
    issues: issues,
    prs: prs,
    actionItems: actionItems
  };
})();

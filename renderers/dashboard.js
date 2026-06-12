(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_dashboard = function(container, data, meta, toolArgs, reviewRequired, onDecision) {
    container.innerHTML = '';

    var _orgId = (data && data.organization_id) ? data.organization_id : null;
    window.__decidrAPI.withReady(container, meta, function() {
    var UI = window.__decidrUI;
    var API = window.__decidrAPI;

    // ── State ──────────────────────────────────────────────

    var dashState = {
      collapsedInitiatives: {},
      showAllNextSteps: false,
      // Fetched data (populated after API calls)
      actionItems: data || [],
      initiatives: [],
      projectsByInitiative: {},  // { initId: [projects] }
      allDecisions: [],
      allIssues: [],
      allPRs: [],
      allTasks: [],
      allBridges: [],
      lastActivityByEntity: {},  // { entityId: { action, label, createdAt } }
      loaded: false,
      error: null,
      // New section state
      activeDecisionFilters: { BACKLOG: false, DRAFT: true, PROPOSED: true, IN_PROGRESS: true, STAGED: true, APPROVED: true, REJECTED: true },
      activeDecisionsVisible: false,
      nextStepsExpanded: false,
      nextStepsGroupExpanded: {},
      decisionsExpanded: false,
      createDialog: null,
      // Org picker
      organizations: [],
      activeOrgId: null,
      defaultOrgId: null
    };

    // ── Show loading ───────────────────────────────────────

    container.innerHTML = UI.loadingSpinner('Loading dashboard...');

    // ── Fetch all data ─────────────────────────────────────

    var fetches = {
      initiatives: null,
      decisions: null,
      tasks: null,
      bridges: null,
      actionItems: null
    };

    function unwrapList(resp) {
      if (resp && Array.isArray(resp.data)) return resp.data;
      if (Array.isArray(resp)) return resp;
      return [];
    }

    // Preflight: resolve the user's target org BEFORE firing the main data
    // fetches. Without this, data fetches run against whatever token withReady
    // picked first (usually the currently-connected org), and the user's
    // default-org preference is ignored on fresh mount.
    API.resolveAndBindTargetOrg({
      pushedOrgId: (data && data.organization_id) ? data.organization_id : null
    }).then(function(preflight) {
      fetches.organizations = preflight.organizations;
      fetches.defaultOrgId = preflight.defaultOrgId;
      // Phase 2: actual data fetches now run against the correct org token.
      return Promise.all([
        API.listInitiatives({ take: 200 }).then(function(resp) { fetches.initiatives = unwrapList(resp); }),
        API.listProjects({ take: 200 }).then(function(resp) { fetches.projects = unwrapList(resp); }),
        API.listDecisions({ take: 200 }).then(function(resp) { fetches.decisions = unwrapList(resp); }),
        API.listTasks({ take: 200 }).then(function(resp) { fetches.tasks = unwrapList(resp); }),
        API.listBridges({ take: 200 }).then(function(resp) { fetches.bridges = unwrapList(resp); }),
        API.listIssues({ take: 200 }).then(function(resp) { fetches.issues = unwrapList(resp); }).catch(function() { fetches.issues = []; }),
        API.listPRs({ take: 200 }).then(function(resp) { fetches.prs = unwrapList(resp); }).catch(function() { fetches.prs = []; }),
        API.getActionItems({ take: 200 }).then(function(resp) { fetches.actionItems = unwrapList(resp); }).catch(function() { fetches.actionItems = []; }),
        API.getTimeline({ take: 200 }).then(function(resp) { fetches.timeline = unwrapList(resp); }).catch(function() { fetches.timeline = []; })
      ]);
    }).then(function() {
      // Projects have direct initiativeId
      var projectToInit = {};
      var projects = fetches.projects || [];
      for (var p = 0; p < projects.length; p++) {
        var proj = projects[p];
        var initId = proj.initiativeId || proj.initiative_id;
        if (initId) {
          projectToInit[proj.id] = initId;
        }
      }

      var projectMap = {};
      for (var p = 0; p < projects.length; p++) {
        var proj = projects[p];
        var initId = projectToInit[proj.id] || '_ungrouped';
        if (!projectMap[initId]) projectMap[initId] = [];
        projectMap[initId].push(proj);
      }
      return projectMap;
    }).then(function(projectMap) {
      // Org list + tokenStatus + defaultOrgId come pre-annotated from the
      // API.resolveAndBindTargetOrg preflight — no local recomputation.
      var orgs = fetches.organizations || [];
      dashState.organizations = orgs;
      dashState.defaultOrgId = fetches.defaultOrgId || null;
      // Mirror the bound token's org onto local state. On fresh mount the
      // preflight already switched (if needed) to default or pushed; here we
      // just reflect that choice, falling back to the first org if nothing
      // resolved.
      var boundOrgId = API.getActiveOrgId();
      if (boundOrgId) {
        dashState.activeOrgId = boundOrgId;
      } else if (orgs.length > 0) {
        dashState.activeOrgId = orgs[0].id;
      }

      dashState.initiatives = fetches.initiatives;
      dashState.projectsByInitiative = projectMap;
      dashState.allDecisions = fetches.decisions;
      dashState.allTasks = fetches.tasks;
      dashState.allBridges = fetches.bridges;
      dashState.allIssues = fetches.issues || [];
      dashState.allPRs = fetches.prs || [];
      dashState.actionItems = fetches.actionItems || [];

      // Build last-activity-per-entity map from timeline events
      dashState.lastActivityByEntity = buildActivityMap(fetches.timeline || []);

      dashState.loaded = true;

      // Default all initiatives to collapsed
      for (var i = 0; i < dashState.initiatives.length; i++) {
        dashState.collapsedInitiatives[dashState.initiatives[i].id] = true;
      }

      // Fetch GitHub counts for all projects
      var allProjects = fetches.projects || [];
      var projectIds = [];
      for (var gi = 0; gi < allProjects.length; gi++) {
        projectIds.push(allProjects[gi].id);
      }
      if (projectIds.length) {
        API.getEntityGithubCounts('PROJECT', projectIds).then(function(result) {
          dashState.githubCounts = result;
          // Re-render if already displayed
          if (dashState.loaded) renderDashboard();
        }).catch(function() { dashState.githubCounts = {}; });
      }

      renderDashboard();
    }).catch(function(err) {
      dashState.error = err;
      container.innerHTML = UI.emptyState('Failed to load dashboard data. Please try again.');
    });

    function refreshDashboard() {
      var rf = {
        initiatives: null, projects: null, decisions: null, tasks: null,
        bridges: null, issues: null, prs: null, actionItems: null, timeline: null
      };
      return Promise.all([
        API.listInitiatives({ take: 200 }).then(function(resp) { rf.initiatives = unwrapList(resp); }),
        API.listProjects({ take: 200 }).then(function(resp) { rf.projects = unwrapList(resp); }),
        API.listDecisions({ take: 200 }).then(function(resp) { rf.decisions = unwrapList(resp); }),
        API.listTasks({ take: 200 }).then(function(resp) { rf.tasks = unwrapList(resp); }),
        API.listBridges({ take: 200 }).then(function(resp) { rf.bridges = unwrapList(resp); }),
        API.listIssues({ take: 200 }).then(function(resp) { rf.issues = unwrapList(resp); }).catch(function() { rf.issues = []; }),
        API.listPRs({ take: 200 }).then(function(resp) { rf.prs = unwrapList(resp); }).catch(function() { rf.prs = []; }),
        API.getActionItems({ take: 200 }).then(function(resp) { rf.actionItems = unwrapList(resp); }).catch(function() { rf.actionItems = []; }),
        API.getTimeline({ take: 200 }).then(function(resp) { rf.timeline = unwrapList(resp); }).catch(function() { rf.timeline = []; })
      ]).then(function() {
        var projects = rf.projects || [];
        var projectToInit = {};
        for (var p = 0; p < projects.length; p++) {
          var proj = projects[p];
          var initId = proj.initiativeId || proj.initiative_id;
          if (initId) { projectToInit[proj.id] = initId; }
        }
        var projectMap = {};
        for (var p = 0; p < projects.length; p++) {
          var proj = projects[p];
          var initId = projectToInit[proj.id] || '_ungrouped';
          if (!projectMap[initId]) projectMap[initId] = [];
          projectMap[initId].push(proj);
        }
        dashState.initiatives = rf.initiatives;
        dashState.projectsByInitiative = projectMap;
        dashState.allDecisions = rf.decisions;
        dashState.allTasks = rf.tasks;
        dashState.allBridges = rf.bridges;
        dashState.allIssues = rf.issues || [];
        dashState.allPRs = rf.prs || [];
        dashState.actionItems = rf.actionItems || [];

        dashState.lastActivityByEntity = buildActivityMap(rf.timeline || []);

        renderDashboard();
      }).catch(function(err) {
        console.error('[decidr] Dashboard refresh failed:', err);
      });
    }

    // ── Data Helpers ───────────────────────────────────────

    var ACTIVITY_LABELS = {
      CREATED: 'Created', UPDATED: 'Edited', STATUS_CHANGED: 'Status changed',
      COMMENTED: 'Comment', LINKED: 'Document linked', UNLINKED: 'Document unlinked',
      ARCHIVED: 'Archived', RESTORED: 'Restored'
    };

    function buildActivityMap(timeline) {
      var actMap = {};
      var ENTITY_KEYS = ['decisionId', 'taskId', 'projectId', 'bridgeId', 'initiativeId'];
      for (var ti = 0; ti < timeline.length; ti++) {
        var evt = timeline[ti];
        for (var k = 0; k < ENTITY_KEYS.length; k++) {
          var eid = evt[ENTITY_KEYS[k]];
          if (eid && !actMap[eid]) {
            actMap[eid] = {
              action: evt.action,
              label: ACTIVITY_LABELS[evt.action] || evt.action,
              createdAt: evt.createdAt
            };
          }
        }
      }
      return actMap;
    }

    function findEntityById(items, id) {
      if (!id || !items) return null;
      for (var i = 0; i < items.length; i++) {
        if (items[i] && items[i].id === id) return items[i];
      }
      return null;
    }

    function shallowMerge(left, right) {
      var out = {};
      var k;
      for (k in left) {
        if (left.hasOwnProperty(k)) out[k] = left[k];
      }
      for (k in right) {
        if (right.hasOwnProperty(k)) out[k] = right[k];
      }
      return out;
    }

    function enrichActionItem(item) {
      if (!item) return item;
      var type = String(item.entityType || item.entity_type || '').toUpperCase();
      var id = item.entityId || item.entity_id || item.id;
      var full = null;
      if (type === 'DECISION') {
        full = findEntityById(dashState.allDecisions, id);
      } else if (type === 'TASK') {
        full = findEntityById(dashState.allTasks, id);
      }
      if (!full) return item;
      var enriched = shallowMerge(full, item);
      enriched.entityType = item.entityType || item.entity_type || type;
      enriched.entityId = item.entityId || item.entity_id || full.id;
      return enriched;
    }

    function getAllProjects() {
      var projects = [];
      for (var initId in dashState.projectsByInitiative) {
        if (dashState.projectsByInitiative.hasOwnProperty(initId)) {
          var initProjects = dashState.projectsByInitiative[initId];
          for (var i = 0; i < initProjects.length; i++) {
            projects.push(initProjects[i]);
          }
        }
      }
      return projects;
    }

    function getDecisionsForProject(projectId) {
      var results = [];
      for (var i = 0; i < dashState.allDecisions.length; i++) {
        var dec = dashState.allDecisions[i];
        if (dec.projectId === projectId || (dec.entityType === 'project' && dec.entityId === projectId)) {
          results.push(dec);
        }
      }
      return results;
    }

    function getTasksForProject(projectId) {
      var results = [];
      for (var i = 0; i < dashState.allTasks.length; i++) {
        if (dashState.allTasks[i].projectId === projectId) {
          results.push(dashState.allTasks[i]);
        }
      }
      return results;
    }

    function getBridgesForProject(projectId) {
      var results = [];
      for (var i = 0; i < dashState.allBridges.length; i++) {
        var bridge = dashState.allBridges[i];
        var fromProjectId = UI.bridgeEndpointProjectId ? UI.bridgeEndpointProjectId(bridge, 'from') : bridge.fromProjectId;
        var toProjectId = UI.bridgeEndpointProjectId ? UI.bridgeEndpointProjectId(bridge, 'to') : bridge.toProjectId;
        if (fromProjectId === projectId || toProjectId === projectId) {
          results.push(bridge);
        }
      }
      return results;
    }

    function getDecisionsForInitiative(initiativeId) {
      var projects = dashState.projectsByInitiative[initiativeId] || [];
      var projectIds = {};
      for (var i = 0; i < projects.length; i++) {
        projectIds[projects[i].id] = true;
      }
      var results = [];
      for (var j = 0; j < dashState.allDecisions.length; j++) {
        var dec = dashState.allDecisions[j];
        var entityType = dec.entityType ? String(dec.entityType).toUpperCase() : '';
        if (dec.initiativeId === initiativeId ||
            (entityType === 'INITIATIVE' && (dec.entityId === initiativeId || dec.initiativeId === initiativeId)) ||
            projectIds[dec.projectId] ||
            (entityType === 'PROJECT' && projectIds[dec.entityId])) {
          results.push(dec);
        }
      }
      return results;
    }

    function groupDecisionsByStatus(decisions) {
      var groups = {};
      for (var i = 0; i < decisions.length; i++) {
        var status = decisions[i].status ? String(decisions[i].status).toLowerCase() : 'unknown';
        if (!groups[status]) groups[status] = 0;
        groups[status]++;
      }
      return groups;
    }

    function getNextStepsByCategory(items) {
      var categories = {};
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var cat = item.reason || item.category || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
      }
      return categories;
    }

    function normalizeStatus(dec) {
      return dec.status ? String(dec.status).toUpperCase() : '';
    }

    function sortByCreatedDesc(arr) {
      return arr.slice().sort(function(a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    }

    function getActiveDecisions() {
      var results = [];
      for (var i = 0; i < dashState.allDecisions.length; i++) {
        var dec = dashState.allDecisions[i];
        var status = normalizeStatus(dec);
        if (dashState.activeDecisionFilters[status]) results.push(dec);
      }
      return sortByCreatedDesc(results);
    }

    function getRecentDecisions(limit) {
      return sortByCreatedDesc(dashState.allDecisions).slice(0, limit || 5);
    }

    function getPendingDecisions() {
      var results = [];
      var allProjects = getAllProjects();
      var projectMap = {};
      for (var p = 0; p < allProjects.length; p++) {
        projectMap[allProjects[p].id] = allProjects[p].name;
      }
      for (var i = 0; i < dashState.allDecisions.length; i++) {
        var dec = dashState.allDecisions[i];
        var status = normalizeStatus(dec);
        if (status === 'PROPOSED' || status === 'IN_PROGRESS' || status === 'STAGED') {
          results.push({ decision: dec, projectName: projectMap[dec.projectId] || '' });
        }
      }
      return results;
    }

    function findDecisionById(id) {
      for (var i = 0; i < dashState.allDecisions.length; i++) {
        if (dashState.allDecisions[i].id === id) return dashState.allDecisions[i];
      }
      return null;
    }

    function createDialogError(err) {
      if (!err) return 'Failed to create item.';
      return err.bodyMessage || err.message || String(err);
    }

    function newEntityId(result) {
      if (!result) return null;
      if (result.id) return result.id;
      if (result.data && result.data.id) return result.data.id;
      return null;
    }

    function openCreateDialog(type, opts) {
      opts = opts || {};
      dashState.createDialog = {
        type: type,
        parentType: opts.parentType || null,
        parentId: opts.parentId || null,
        error: null,
        busy: false
      };
      renderDashboard();
    }

    function closeCreateDialog() {
      dashState.createDialog = null;
      renderDashboard();
    }

    function renderCreateDialog() {
      if (!dashState.createDialog) return '';
      var projects = getAllProjects();
      return UI.createEntityDialog({
        type: dashState.createDialog.type,
        initiatives: dashState.initiatives,
        projects: projects,
        decisions: dashState.allDecisions,
        parentType: dashState.createDialog.parentType,
        parentId: dashState.createDialog.parentId,
        error: dashState.createDialog.error,
        busy: dashState.createDialog.busy
      });
    }

    function submitCreateForm(form) {
      if (!form || !dashState.createDialog || dashState.createDialog.busy) return;
      var type = dashState.createDialog.type;
      var titleInput = form.querySelector('#decidr-create-title-input');
      var nameInput = form.querySelector('#decidr-create-name');
      var descInput = form.querySelector('#decidr-create-description');
      var title = titleInput ? titleInput.value.trim() : '';
      var name = nameInput ? nameInput.value.trim() : '';
      var description = descInput ? descInput.value.trim() : '';
      var payload = {};
      var createPromise = null;
      var openType = type;

      if (type === 'initiative') {
        if (!name) return;
        payload = { name: name };
        if (description) payload.description = description;
        createPromise = API.createInitiative(payload);
      } else if (type === 'project') {
        var initiativeSelect = form.querySelector('#decidr-create-initiative-id');
        var initiativeId = initiativeSelect ? initiativeSelect.value : '';
        if (!name || !initiativeId) return;
        payload = { name: name, initiativeId: initiativeId };
        if (description) payload.description = description;
        createPromise = API.createProject(payload);
      } else if (type === 'decision') {
        var parentTypeSelect = form.querySelector('#decidr-create-parent-type');
        var parentType = parentTypeSelect ? parentTypeSelect.value : 'PROJECT';
        var statusSelect = form.querySelector('#decidr-create-status');
        var status = statusSelect ? statusSelect.value : 'DRAFT';
        payload = {
          title: title,
          entityType: parentType,
          status: status || 'DRAFT'
        };
        if (description) payload.description = description;
        if (parentType === 'INITIATIVE') {
          var parentInitiative = form.querySelector('#decidr-create-parent-initiative-id');
          payload.initiativeId = parentInitiative ? parentInitiative.value : '';
          if (!title || !payload.initiativeId) return;
        } else {
          var parentProject = form.querySelector('#decidr-create-parent-project-id');
          payload.projectId = parentProject ? parentProject.value : '';
          if (!title || !payload.projectId) return;
        }
        createPromise = API.createDecision(payload);
      } else if (type === 'task') {
        var taskParentTypeSelect = form.querySelector('#decidr-create-task-parent-type');
        var taskParentType = taskParentTypeSelect ? taskParentTypeSelect.value : 'PROJECT';
        var taskStatusSelect = form.querySelector('#decidr-create-task-status');
        payload = {
          title: title,
          status: taskStatusSelect ? taskStatusSelect.value : 'TODO'
        };
        if (description) payload.description = description;
        if (taskParentType === 'DECISION') {
          var decisionSelect = form.querySelector('#decidr-create-task-decision-id');
          payload.decisionId = decisionSelect ? decisionSelect.value : '';
          var parentDecision = findDecisionById(payload.decisionId);
          if (parentDecision && parentDecision.projectId) payload.projectId = parentDecision.projectId;
          if (!title || !payload.decisionId) return;
        } else {
          var taskProjectSelect = form.querySelector('#decidr-create-task-project-id');
          payload.projectId = taskProjectSelect ? taskProjectSelect.value : '';
          if (!title || !payload.projectId) return;
        }
        createPromise = API.createTask(payload);
      }

      if (!createPromise) return;
      dashState.createDialog.busy = true;
      dashState.createDialog.error = null;
      var submitBtn = form.querySelector('#decidr-create-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
      }
      createPromise.then(function(result) {
        var createdId = newEntityId(result);
        dashState.createDialog = null;
        return refreshDashboard().then(function() {
          if (createdId) {
            UI.SlideOut.open(openType, createdId, {
              source: container,
              onMutate: function() { refreshDashboard(); }
            });
          }
        });
      }).catch(function(err) {
        dashState.createDialog.busy = false;
        dashState.createDialog.error = createDialogError(err);
        renderDashboard();
      });
    }

    // ── Section Renderers ──────────────────────────────────

    function renderStatsSection() {
      var allProjects = getAllProjects();
      var actionCount = dashState.actionItems.length;

      return UI.statsRow([
        { value: dashState.initiatives.length, label: 'Initiatives', opts: { animDelay: 0.05 } },
        { value: allProjects.length, label: 'Projects', opts: { animDelay: 0.10 } },
        { value: dashState.allDecisions.length, label: 'Decisions', opts: { animDelay: 0.15 } },
        { value: dashState.allTasks.length, label: 'Tasks', opts: { animDelay: 0.20 } },
        { value: actionCount, label: 'Needs Action', opts: { animDelay: 0.25 } }
      ]);
    }

    // Map API reason strings to action badge config
    var STEP_ACTION_CONFIG = {
      'Open decision needs attention':  { badge: 'Review',    cls: 'decidr-action-review' },
      'Decision in progress':           { badge: 'Follow Up', cls: 'decidr-action-followup' },
      'Task is blocked':                { badge: 'Blocked',   cls: 'decidr-action-blocked' },
      'TODO task':                       { badge: '',          cls: '' },
      'Deferred decision':              { badge: 'Deferred',  cls: 'decidr-action-deferred' },
      'Open issue on an entity you own':{ badge: 'Issue',     cls: 'decidr-action-issue' }
    };

    function getActionConfig(reason) {
      if (!reason) return { badge: '', cls: '' };
      // Exact match first
      if (STEP_ACTION_CONFIG[reason]) return STEP_ACTION_CONFIG[reason];
      // Partial match
      var lower = reason.toLowerCase();
      if (lower.indexOf('open') !== -1 || lower.indexOf('review') !== -1) return STEP_ACTION_CONFIG['Open decision needs attention'];
      if (lower.indexOf('progress') !== -1) return STEP_ACTION_CONFIG['Decision in progress'];
      if (lower.indexOf('block') !== -1) return STEP_ACTION_CONFIG['Task is blocked'];
      if (lower.indexOf('todo') !== -1 || lower.indexOf('task') !== -1) return STEP_ACTION_CONFIG['TODO task'];
      if (lower.indexOf('defer') !== -1) return STEP_ACTION_CONFIG['Deferred decision'];
      return { badge: reason, cls: 'decidr-action-progress' };
    }

    function renderNextStepsContent() {
      var rawItems = dashState.actionItems;
      if (!rawItems || rawItems.length === 0) {
        return UI.emptyState('No action items right now. You are all caught up!');
      }
      var items = [];
      for (var ai = 0; ai < rawItems.length; ai++) {
        items.push(enrichActionItem(rawItems[ai]));
      }

      // Group by entityType
      var groups = {};
      var groupOrder = [];
      for (var i = 0; i < items.length; i++) {
        var type = items[i].entityType || 'other';
        if (!groups[type]) {
          groups[type] = [];
          groupOrder.push(type);
        }
        groups[type].push(items[i]);
      }

      var ENTITY_LABELS = {
        DECISION: 'Decisions',
        TASK: 'Tasks',
        PROJECT: 'Projects',
        BRIDGE: 'Bridges',
        INITIATIVE: 'Initiatives',
        issue: 'Issues',
        pull_request: 'Pull Requests'
      };

      var html = '';
      for (var g = 0; g < groupOrder.length; g++) {
        var groupType = groupOrder[g];
        var groupItems = groups[groupType];
        var label = ENTITY_LABELS[groupType] || (groupType.charAt(0).toUpperCase() + groupType.slice(1).toLowerCase() + 's');
        var isExpanded = dashState.nextStepsGroupExpanded[groupType] !== false;
        var chevron = isExpanded ? '\u25BC' : '\u25B6';

        // Build status breakdown
        var statusCounts = {};
        for (var s = 0; s < groupItems.length; s++) {
          var st = groupItems[s].status || 'unknown';
          statusCounts[st] = (statusCounts[st] || 0) + 1;
        }
        var statusHtml = '<span class="decidr-next-steps-group-statuses">';
        for (var sk in statusCounts) {
          if (statusCounts.hasOwnProperty(sk)) {
            statusHtml += UI.statusBadge(sk.toUpperCase()) + '<span style="color:var(--text-tertiary);font-size:10px;font-weight:600;">' + statusCounts[sk] + '</span>';
          }
        }
        statusHtml += '</span>';

        html += '<div class="decidr-next-steps-group">';
        html += '<button class="decidr-next-steps-group-header" data-next-steps-group="' + UI.escapeHtml(groupType) + '">';
        html += '<span class="decidr-next-steps-group-chevron">' + chevron + '</span>';
        html += '<span class="decidr-next-steps-group-label">' + UI.escapeHtml(label) + '</span>';
        html += statusHtml;
        html += '<span class="decidr-next-steps-group-count">' + groupItems.length + '</span>';
        html += '</button>';

        if (isExpanded) {
          html += '<div class="decidr-next-steps-group-items">';
          for (var j = 0; j < groupItems.length; j++) {
            var item = groupItems[j];
            // Skip action badge for decisions — status badge is sufficient
            var cfg = (item.entityType === 'DECISION' || item.entityType === 'decision')
              ? { badge: '', cls: '' }
              : getActionConfig(item.reason);
            html += UI.nextStepCard(item, {
              animDelay: 0.05 + j * 0.05,
              actionBadge: cfg.badge,
              actionClass: cfg.cls,
              showWorkflow: true,
              workflowEntity: item,
              lastActivity: dashState.lastActivityByEntity[item.entityId || item.id] || null
            });
          }
          html += '</div>';
        }

        html += '</div>';
      }

      return html;
    }

    function renderNextStepsSection() {
      return UI.section('calendar', 'Next Steps', dashState.actionItems.length,
        '<div id="decidr-next-steps-container">' + renderNextStepsContent() + '</div>',
        { actions: [{ label: '+ Task', action: 'task', title: 'Create task' }] });
    }

    function renderActiveDecisionsContent() {
      var decisions = getActiveDecisions();

      if (decisions.length === 0) {
        return UI.emptyState('No decisions in this view.');
      }

      var limit = dashState.decisionsExpanded ? decisions.length : 5;
      var visible = decisions.slice(0, limit);
      var remaining = decisions.length - limit;
      var html = '';

      for (var i = 0; i < visible.length; i++) {
        html += UI.decisionListItem(visible[i], {
          animDelay: 0.05 + i * 0.05,
          allDecisions: dashState.allDecisions,
          showWorkflow: true,
          lastActivity: dashState.lastActivityByEntity[visible[i].id] || null
        });
      }

      if (remaining > 0 && !dashState.decisionsExpanded) {
        html += '<button class="decidr-dash-show-more" id="decidr-decisions-show-more">'
          + 'Show ' + remaining + ' more</button>';
      } else if (dashState.decisionsExpanded && decisions.length > 5) {
        html += '<button class="decidr-dash-show-more" id="decidr-decisions-show-less">'
          + 'Show less</button>';
      }

      return html;
    }

    function renderActiveDecisionsSection() {
      var decisions = getActiveDecisions();
      var visible = !!dashState.activeDecisionsVisible;
      var toggleLabel = visible ? 'Hide active decisions' : 'Show active decisions';
      var html = '<div class="decidr-active-decisions-toggle-row">'
        + '<button class="decidr-dash-show-more" id="decidr-active-decisions-toggle" aria-expanded="' + (visible ? 'true' : 'false') + '">'
        + UI.escapeHtml(toggleLabel) + '</button>'
        + '</div>';

      if (!visible) {
        return UI.section('decision', 'Active Decisions', decisions.length, html,
          { actions: [{ label: '+ Decision', action: 'decision', title: 'Create decision' }] });
      }

      // Scan all decisions for unique statuses
      var statusSet = {};
      for (var i = 0; i < dashState.allDecisions.length; i++) {
        var s = normalizeStatus(dashState.allDecisions[i]);
        if (s) statusSet[s] = true;
      }

      var STATUS_ORDER = ['BACKLOG', 'DRAFT', 'PROPOSED', 'IN_PROGRESS', 'STAGED', 'APPROVED', 'IMPLEMENTED', 'REJECTED', 'ARCHIVED'];
      var statuses = [];
      for (var j = 0; j < STATUS_ORDER.length; j++) {
        if (statusSet[STATUS_ORDER[j]]) statuses.push(STATUS_ORDER[j]);
      }
      // Add any remaining statuses not in the order
      for (var sk in statusSet) {
        if (statusSet.hasOwnProperty(sk) && statuses.indexOf(sk) === -1) statuses.push(sk);
      }

      var pillBar = '<div style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4);">';
      for (var p = 0; p < statuses.length; p++) {
        var st = statuses[p];
        var isActive = !!dashState.activeDecisionFilters[st];
        var label = st.charAt(0).toUpperCase() + st.slice(1).toLowerCase().replace(/_/g, ' ');
        // Count decisions with this status
        var count = 0;
        for (var c = 0; c < dashState.allDecisions.length; c++) {
          if (normalizeStatus(dashState.allDecisions[c]) === st) count++;
        }
        pillBar += '<button class="decidr-dash-status-pill' + (isActive ? ' active' : '') + '" data-decision-status="' + UI.escapeHtml(st) + '">'
          + UI.escapeHtml(label) + ' (' + count + ')</button>';
      }
      pillBar += '</div>';

      return UI.section('decision', 'Active Decisions', decisions.length,
        html + pillBar + '<div id="decidr-active-decisions-container">' + renderActiveDecisionsContent() + '</div>',
        { actions: [{ label: '+ Decision', action: 'decision', title: 'Create decision' }] });
    }

    function renderInitiativeSections() {
      var initiatives = dashState.initiatives;
      var initiativeActions = [
        { label: '+ Initiative', action: 'initiative', title: 'Create initiative' },
        { label: '+ Project', action: 'project', title: 'Create project', disabled: initiatives.length === 0 }
      ];
      if (initiatives.length === 0) {
        return UI.section('Initiatives', initiatives.length, UI.emptyState('No initiatives found.'), { actions: initiativeActions });
      }

      // Section header
      var html = '<div class="decidr-section-header">'
        + '<span class="decidr-section-title-text">'
        + UI.escapeHtml('Initiatives')
        + ' <span class="decidr-section-count">(' + initiatives.length + ')</span></span>'
        + UI.headerActions(initiativeActions)
        + '</div>';
      var animIdx = 0;

      for (var i = 0; i < initiatives.length; i++) {
        var initiative = initiatives[i];
        var initProjects = dashState.projectsByInitiative[initiative.id] || [];
        var initDecisions = getDecisionsForInitiative(initiative.id);
        var decsByStatus = groupDecisionsByStatus(initDecisions);
        var isCollapsed = !!dashState.collapsedInitiatives[initiative.id];

        html += UI.initiativeCard(initiative, {
          projectCount: initProjects.length,
          totalDecisions: initDecisions.length,
          decisionsByStatus: decsByStatus,
          collapsed: isCollapsed
        });

        // Project grid below initiative card
        var cards = '';
        var currentUserId = API._currentUserId || '';
        for (var p = 0; p < initProjects.length; p++) {
          var proj = initProjects[p];
          var projDecisions = getDecisionsForProject(proj.id);
          var projTasks = getTasksForProject(proj.id);
          var projBridges = getBridgesForProject(proj.id);
          // Count pending decisions and ones needing user's review
          var pendingCount = 0;
          var needsReviewCount = 0;
          for (var pd = 0; pd < projDecisions.length; pd++) {
            var pDec = projDecisions[pd];
            var pStatus = normalizeStatus(pDec);
            if (pStatus === 'PROPOSED' || pStatus === 'IN_PROGRESS' || pStatus === 'STAGED') {
              pendingCount++;
              // Check if current user is a reviewer on this decision
              if (currentUserId && pDec.reviewers && Array.isArray(pDec.reviewers)) {
                for (var ri = 0; ri < pDec.reviewers.length; ri++) {
                  if (pDec.reviewers[ri] === currentUserId) {
                    needsReviewCount++;
                    break;
                  }
                }
              }
            }
          }
          var isOwner = currentUserId && (proj.ownerId === currentUserId || proj.createdById === currentUserId);
          var ghCounts = (dashState.githubCounts || {})[proj.id] || {};
          cards += UI.dashboardProjectCard(proj, {
            decisions: projDecisions,
            tasks: projTasks,
            bridges: projBridges,
            isOwner: isOwner,
            pendingDecisions: pendingCount,
            needsYourReview: needsReviewCount,
            githubCounts: ghCounts,
            animDelay: 0.05 + animIdx * 0.05
          });
          animIdx++;
        }

        var collapsedStyle = isCollapsed ? ' style="display: none;"' : '';
        html += '<div class="decidr-init-projects" data-init-projects="'
          + UI.escapeHtml(initiative.id) + '"' + collapsedStyle + '>'
          + '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));'
          + ' gap: var(--space-4); padding: var(--space-2) 0 var(--space-4) 0;">'
          + cards + '</div></div>';
      }

      return html;
    }

    function renderRecentDecisionsSection() {
      var recent = getRecentDecisions(5);
      if (recent.length === 0) return '';

      var html = '';
      for (var i = 0; i < recent.length; i++) {
        html += UI.decisionListItem(recent[i], {
          animDelay: 0.05 + i * 0.05,
          showWorkflow: true,
          allDecisions: dashState.allDecisions
        });
      }

      return UI.section('decision', 'Recent Decisions', recent.length, html,
        { actions: [{ label: '+ Decision', action: 'decision', title: 'Create decision' }] });
    }

    function renderPendingApprovalsSection() {
      var pending = getPendingDecisions();
      if (pending.length === 0) return '';

      var html = '';
      for (var i = 0; i < pending.length; i++) {
        html += UI.pendingItem(pending[i].decision, {
          animDelay: 0.05 + i * 0.05,
          showWorkflow: true,
          projectName: pending[i].projectName
        });
      }

      return UI.section('approval', 'Pending Approvals', pending.length, html);
    }

    // ── Main Render ────────────────────────────────────────

    function renderDashboard() {
      var html = '<div style="max-width: 1200px; margin: 0 auto; padding: var(--space-6) var(--space-4);'
        + ' font-family: var(--font-sans); color: var(--text-primary);">';

      // Title with org picker
      html += '<div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 var(--space-6) 0;">'
        + '<h1 style="font-size: var(--text-h1); font-weight: var(--weight-bold); margin: 0;">Dashboard</h1>'
        + UI.orgPicker(dashState.organizations, dashState.activeOrgId, { defaultOrgId: dashState.defaultOrgId })
        + '</div>';

      // Stats
      html += renderStatsSection();

      // Next Steps (replaces Action Items)
      html += '<div style="margin-top: var(--space-8);">'
        + renderNextStepsSection()
        + '</div>';

      // Active Decisions
      html += '<div style="margin-top: var(--space-8);">'
        + renderActiveDecisionsSection()
        + '</div>';

      // Initiative sections
      html += '<div style="margin-top: var(--space-8);">'
        + renderInitiativeSections()
        + '</div>';

      // Recent Decisions
      var recentHtml = renderRecentDecisionsSection();
      if (recentHtml) {
        html += '<div style="margin-top: var(--space-8);">'
          + recentHtml + '</div>';
      }

      // Pending Approvals
      var pendingHtml = renderPendingApprovalsSection();
      if (pendingHtml) {
        html += '<div style="margin-top: var(--space-8);">'
          + pendingHtml + '</div>';
      }

      html += '</div>';
      html += renderCreateDialog();

      container.innerHTML = html;
      wireInteractions();
    }

    // ── Event Wiring ───────────────────────────────────────

    function wireInteractions() {
      wireNextStepsShowMore();
      wireActiveDecisionsToggle();
      wireDecisionStatusPills();
      wireDecisionsShowMore();
      wireInitiativeToggle();
      wireCreateActions();
      wireCreateDialog();
      wireEntityClicks(container);
      wireOrgPicker();
    }

    function wireCreateActions() {
      var buttons = container.querySelectorAll('[data-create-action]');
      for (var i = 0; i < buttons.length; i++) {
        (function(btn) {
          if (btn._decidrWired) return;
          btn._decidrWired = true;
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (btn.disabled) return;
            openCreateDialog(btn.getAttribute('data-create-action') || '');
          });
        })(buttons[i]);
      }
    }

    function wireCreateDialog() {
      var form = container.querySelector('#decidr-create-form');
      if (!form) return;
      var cancel = container.querySelector('#decidr-create-cancel');
      var cancelSecondary = container.querySelector('#decidr-create-cancel-secondary');
      var overlay = container.querySelector('.decidr-create-overlay');
      var parentType = container.querySelector('#decidr-create-parent-type') || container.querySelector('#decidr-create-task-parent-type');

      function syncParentSelects(value) {
        var groups = container.querySelectorAll('.decidr-create-parent-select');
        for (var i = 0; i < groups.length; i++) {
          var group = groups[i];
          group.style.display = group.getAttribute('data-parent-select') === value ? 'block' : 'none';
        }
      }

      if (cancel) cancel.addEventListener('click', closeCreateDialog);
      if (cancelSecondary) cancelSecondary.addEventListener('click', closeCreateDialog);
      if (overlay) {
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) closeCreateDialog();
        });
      }
      if (parentType) {
        parentType.addEventListener('change', function() {
          syncParentSelects(parentType.value);
        });
        syncParentSelects(parentType.value);
      }
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitCreateForm(form);
      });
    }

    function wireOrgPicker() {
      var toggle = container.querySelector('#decidr-org-picker-toggle');
      var menu = container.querySelector('#decidr-org-picker-menu');
      if (!toggle || !menu) return;

      function openOrgSettings(orgId) {
        UI.SlideOut.open('organization-settings', orgId, {
          source: container,
          onMutate: function() { refreshDashboard(); }
        });
      }

      function showOrgAuthPrompt(orgId) {
        container.innerHTML = '<div style="padding: var(--space-6); text-align: center;">'
          + '<p style="color: var(--text-secondary); margin-bottom: var(--space-4);">'
          + 'Sign in to DecidR for this organization.</p>'
          + '<button id="decidr-org-auth-btn" style="padding: 8px 16px; border: 1px solid var(--accent-primary);'
          + ' border-radius: var(--border-radius-md); background: var(--accent-primary); color: white;'
          + ' cursor: pointer; font-family: var(--font-sans);">Sign in to DecidR</button>'
          + '</div>';
        var authBtn = container.querySelector('#decidr-org-auth-btn');
        if (authBtn) {
          authBtn.addEventListener('click', function() {
            API.openPluginAuth(orgId).catch(function(error) {
              console.warn('[decidr] Failed to open DecidR sign-in:', error);
            });
          });
        }
      }

      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        menu.classList.toggle('open');
      });

      document.addEventListener('click', function() {
        menu.classList.remove('open');
      });

      menu.addEventListener('click', function(e) {
        var starBtn = e.target.closest('[data-action="set-default"]');
        if (starBtn) {
          e.stopPropagation();
          e.preventDefault();
          var starOrgId = starBtn.getAttribute('data-org-id');
          API.setDefaultOrg(starOrgId).then(function() {
            dashState.defaultOrgId = starOrgId;
            renderDashboard();
          }).catch(function(err) {
            console.error('[decidr] setDefaultOrg failed', err);
          });
          return;
        }
        var settingsBtn = e.target.closest('[data-action="open-settings"]');
        if (settingsBtn) {
          e.stopPropagation();
          e.preventDefault();
          var settingsOrgId = settingsBtn.getAttribute('data-org-id');
          menu.classList.remove('open');
          if (settingsOrgId === dashState.activeOrgId) {
            openOrgSettings(settingsOrgId);
            return;
          }
          dashState.activeOrgId = settingsOrgId;
          container.innerHTML = UI.loadingSpinner('Switching organization...');
          API.switchOrg(settingsOrgId).then(function() {
            return refreshDashboard();
          }).then(function() {
            openOrgSettings(settingsOrgId);
          }).catch(function(err) {
            console.error('[decidr] Org switch failed:', err);
            showOrgAuthPrompt(settingsOrgId);
          });
          return;
        }
        var btn = e.target.closest('[data-org-id]');
        if (!btn) return;
        var orgId = btn.getAttribute('data-org-id');
        if (orgId === dashState.activeOrgId) {
          menu.classList.remove('open');
          return;
        }
        dashState.activeOrgId = orgId;
        menu.classList.remove('open');
        container.innerHTML = UI.loadingSpinner('Switching organization...');
        API.switchOrg(orgId).then(function() {
          refreshDashboard();
        }).catch(function(err) {
          console.error('[decidr] Org switch failed:', err);
          showOrgAuthPrompt(orgId);
        });
      });
    }

    function wireNextStepsShowMore() {
      var groupHeaders = container.querySelectorAll('[data-next-steps-group]');
      for (var i = 0; i < groupHeaders.length; i++) {
        (function(header) {
          if (header._decidrWired) return;
          header._decidrWired = true;
          header.addEventListener('click', function() {
            var groupType = header.getAttribute('data-next-steps-group');
            dashState.nextStepsGroupExpanded[groupType] = !(dashState.nextStepsGroupExpanded[groupType] !== false);
            var cont = container.querySelector('#decidr-next-steps-container');
            if (cont) {
              cont.innerHTML = renderNextStepsContent();
              wireNextStepsShowMore();
              wireEntityClicks(cont);
            }
          });
        })(groupHeaders[i]);
      }
    }

    function wireActiveDecisionsToggle() {
      var toggle = container.querySelector('#decidr-active-decisions-toggle');
      if (!toggle || toggle._decidrWired) return;
      toggle._decidrWired = true;
      toggle.addEventListener('click', function() {
        dashState.activeDecisionsVisible = !dashState.activeDecisionsVisible;
        dashState.decisionsExpanded = false;
        var parent = toggle.closest('.decidr-section');
        if (parent) {
          parent.outerHTML = renderActiveDecisionsSection();
          wireActiveDecisionsToggle();
          wireDecisionStatusPills();
          wireDecisionsShowMore();
          wireEntityClicks(container);
        }
      });
    }

    function wireDecisionStatusPills() {
      var pills = container.querySelectorAll('.decidr-dash-status-pill[data-decision-status]');
      for (var i = 0; i < pills.length; i++) {
        (function(pill) {
          pill.addEventListener('click', function() {
            var status = pill.getAttribute('data-decision-status');
            if (dashState.activeDecisionFilters[status]) {
              delete dashState.activeDecisionFilters[status];
            } else {
              dashState.activeDecisionFilters[status] = true;
            }
            dashState.decisionsExpanded = false;
            // Re-render the entire section to update pill states + content
            var sectionEl = container.querySelector('#decidr-active-decisions-container');
            if (sectionEl) {
              // Need to re-render the whole section for pill state updates
              var parent = sectionEl.closest('.decidr-section');
              if (parent) {
                parent.outerHTML = renderActiveDecisionsSection();
                wireActiveDecisionsToggle();
                wireDecisionStatusPills();
                wireDecisionsShowMore();
                wireEntityClicks(container);
              }
            }
          });
        })(pills[i]);
      }
    }

    function wireDecisionsShowMore() {
      var moreBtn = container.querySelector('#decidr-decisions-show-more');
      var lessBtn = container.querySelector('#decidr-decisions-show-less');

      if (moreBtn) {
        moreBtn.addEventListener('click', function() {
          dashState.decisionsExpanded = true;
          var cont = container.querySelector('#decidr-active-decisions-container');
          if (cont) {
            cont.innerHTML = renderActiveDecisionsContent();
            wireDecisionsShowMore();
            wireEntityClicks(cont);
          }
        });
      }

      if (lessBtn) {
        lessBtn.addEventListener('click', function() {
          dashState.decisionsExpanded = false;
          var cont = container.querySelector('#decidr-active-decisions-container');
          if (cont) {
            cont.innerHTML = renderActiveDecisionsContent();
            wireDecisionsShowMore();
            wireEntityClicks(cont);
          }
        });
      }
    }

    function wireInitiativeToggle() {
      var initHeaders = container.querySelectorAll('.decidr-init-header');
      for (var i = 0; i < initHeaders.length; i++) {
        (function(header) {
          header.style.cursor = 'pointer';
          header.addEventListener('click', function() {
            var card = header.closest('[data-init-id]');
            if (!card) return;
            var initId = card.getAttribute('data-init-id');
            var projectsEl = container.querySelector('[data-init-projects="' + initId + '"]');

            if (dashState.collapsedInitiatives[initId]) {
              delete dashState.collapsedInitiatives[initId];
              if (projectsEl) projectsEl.style.display = '';
              if (card) card.classList.remove('decidr-init-card-collapsed');
            } else {
              dashState.collapsedInitiatives[initId] = true;
              if (projectsEl) projectsEl.style.display = 'none';
              if (card) card.classList.add('decidr-init-card-collapsed');
            }
          });
        })(initHeaders[i]);
      }
    }

    function wireEntityClicks(scope) {
      UI.wireCopyRefButtons(scope);
      var clickables = scope.querySelectorAll('[data-entity-type][data-entity-id]');
      for (var i = 0; i < clickables.length; i++) {
        (function(el) {
          // Skip if already wired
          if (el._decidrWired) return;
          el._decidrWired = true;

          // Skip init headers — they toggle collapse, not slide-out
          if (el.querySelector('.decidr-init-header')) return;

          el.addEventListener('click', function(e) {
            if (e.target.closest && e.target.closest('[data-decidr-copy-ref]')) return;
            // Don't fire if clicking inside init-header (toggle)
            if (e.target.closest('.decidr-init-header')) return;
            e.preventDefault();
            e.stopPropagation();
            var entityType = el.getAttribute('data-entity-type');
            var entityId = el.getAttribute('data-entity-id');
            if (entityType && entityId) {
              UI.SlideOut.open(entityType, entityId, {
                source: container,
                onClose: function() {},
                onMutate: function() { refreshDashboard(); }
              });
            }
          });
        })(clickables[i]);
      }
    }

    }, _orgId);
  };
})();

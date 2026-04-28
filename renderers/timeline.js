(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_timeline = function(container, data, meta, toolArgs, reviewRequired, onDecision) {
    container.innerHTML = '';

    var _orgId = (data && data.organization_id) ? data.organization_id : null;
    window.__decidrAPI.withReady(container, meta, function() {
    var UI = window.__decidrUI;
    var API = window.__decidrAPI;

    var DAY_MS = 24 * 60 * 60 * 1000;
    var MARKER_COLORS = {
      task_due: '#10b981',
      task_overdue: '#ef4444',
      project: '#3b82f6',
      decision: '#f59e0b',
      bridge: '#06b6d4',
      issue: '#ef4444',
      pull_request: '#8b5cf6',
      activity: '#6366f1',
      initiative: '#22c55e'
    };

    var timelineState = {
      organizations: [],
      activeOrgId: null,
      defaultOrgId: null,
      scope: (data && data.view === 'initiative') ? 'initiative' : 'all',
      selectedInitiativeId: (data && data.initiative_ids && data.initiative_ids.length) ? data.initiative_ids[0] : null,
      allowedInitiativeIds: (data && data.initiative_ids && data.initiative_ids.length) ? data.initiative_ids : [],
      filter: 'all',
      initiatives: [],
      projects: [],
      decisions: [],
      tasks: [],
      bridges: [],
      issues: [],
      prs: [],
      members: [],
      timeline: [],
      loaded: false
    };

    container.innerHTML = '<div style="padding:var(--space-6);">'
      + UI.loadingSpinner('Loading timeline...')
      + '</div>';

    fetchTimelineData().then(function() {
      timelineState.loaded = true;
      if (!timelineState.selectedInitiativeId && timelineState.initiatives.length) {
        timelineState.selectedInitiativeId = timelineState.initiatives[0].id;
      }
      renderTimeline();
    }).catch(function(err) {
      console.error('[decidr] Timeline load failed:', err);
      container.innerHTML = '<div style="padding:var(--space-6);">'
        + UI.emptyState('Failed to load timeline data. Please try again.')
        + '</div>';
    });

    function unwrapList(resp) {
      if (resp && Array.isArray(resp.data)) return resp.data;
      if (resp && Array.isArray(resp.items)) return resp.items;
      if (resp && Array.isArray(resp.results)) return resp.results;
      if (Array.isArray(resp)) return resp;
      return [];
    }

    function fetchTimelineData() {
      var fetched = {};
      return API.resolveAndBindTargetOrg({
        pushedOrgId: (data && data.organization_id) ? data.organization_id : null
      }).then(function(preflight) {
        fetched.organizations = preflight.organizations || [];
        fetched.defaultOrgId = preflight.defaultOrgId || null;
        fetched.activeOrgId = preflight.activeOrgId || API.getActiveOrgId();
        return Promise.all([
          API.listInitiatives({ take: 200 }).then(function(resp) { fetched.initiatives = unwrapList(resp); }),
          API.listProjects({ take: 300 }).then(function(resp) { fetched.projects = unwrapList(resp); }),
          API.listDecisions({ take: 300 }).then(function(resp) { fetched.decisions = unwrapList(resp); }),
          API.listTasks({ take: 400 }).then(function(resp) { fetched.tasks = unwrapList(resp); }),
          API.listBridges({ take: 300 }).then(function(resp) { fetched.bridges = unwrapList(resp); }),
          API.listIssues({ take: 300 }).then(function(resp) { fetched.issues = unwrapList(resp); }).catch(function() { fetched.issues = []; }),
          API.listPRs({ take: 300 }).then(function(resp) { fetched.prs = unwrapList(resp); }).catch(function() { fetched.prs = []; }),
          API.listOrgMembers().then(function(resp) { fetched.members = unwrapList(resp); }).catch(function() { fetched.members = []; }),
          API.getTimeline({ take: 500 }).then(function(resp) { fetched.timeline = unwrapList(resp); }).catch(function() { fetched.timeline = []; })
        ]);
      }).then(function() {
        timelineState.organizations = fetched.organizations || [];
        timelineState.defaultOrgId = fetched.defaultOrgId || null;
        timelineState.activeOrgId = fetched.activeOrgId || API.getActiveOrgId();
        if (!timelineState.activeOrgId && timelineState.organizations.length) {
          timelineState.activeOrgId = timelineState.organizations[0].id;
        }
        timelineState.initiatives = fetched.initiatives || [];
        timelineState.projects = fetched.projects || [];
        timelineState.decisions = fetched.decisions || [];
        timelineState.tasks = fetched.tasks || [];
        timelineState.bridges = fetched.bridges || [];
        timelineState.issues = fetched.issues || [];
        timelineState.prs = fetched.prs || [];
        timelineState.members = fetched.members || [];
        timelineState.timeline = fetched.timeline || [];
      });
    }

    function refreshTimeline() {
      container.innerHTML = '<div style="padding:var(--space-6);">'
        + UI.loadingSpinner('Refreshing timeline...')
        + '</div>';
      return fetchTimelineData().then(function() {
        renderTimeline();
      }).catch(function(err) {
        console.error('[decidr] Timeline refresh failed:', err);
        container.innerHTML = '<div style="padding:var(--space-6);">'
          + UI.emptyState('Failed to refresh timeline data. Please try again.')
          + '</div>';
      });
    }

    function getField(obj, names) {
      if (!obj) return null;
      for (var i = 0; i < names.length; i++) {
        if (obj[names[i]] !== undefined && obj[names[i]] !== null) return obj[names[i]];
      }
      return null;
    }

    function makeMap(items) {
      var map = {};
      for (var i = 0; i < items.length; i++) {
        if (items[i] && items[i].id) map[items[i].id] = items[i];
      }
      return map;
    }

    function normalizeStatus(status) {
      return status ? String(status).toUpperCase() : '';
    }

    function statusIsDone(status) {
      var s = normalizeStatus(status);
      return s === 'DONE' || s === 'COMPLETED' || s === 'IMPLEMENTED' || s === 'MERGED' || s === 'ARCHIVED';
    }

    function statusIsActive(status) {
      var s = normalizeStatus(status);
      return s === 'ACTIVE' || s === 'IN_PROGRESS' || s === 'PLANNING' || s === 'PROPOSED' || s === 'APPROVED' || s === 'TODO' || s === 'OPEN' || s === 'IN_REVIEW';
    }

    function validDate(dateStr) {
      if (!dateStr) return null;
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d;
    }

    function startOfDay(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function addDays(d, days) {
      return new Date(d.getTime() + days * DAY_MS);
    }

    function addMonths(d, months) {
      return new Date(d.getFullYear(), d.getMonth() + months, 1);
    }

    function startOfMonth(d) {
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    function startOfQuarter(d) {
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    }

    function formatTick(d, scale) {
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (scale === 'quarter') {
        return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + d.getFullYear();
      }
      return months[d.getMonth()] + ' ' + d.getFullYear();
    }

    function displayName(entity) {
      if (!entity) return '';
      return entity.name || entity.title || entity.number || entity.githubTitle || entity.id || '';
    }

    function truncate(str, max) {
      if (!str) return '';
      str = String(str);
      if (str.length <= max) return str;
      return str.substring(0, max - 3) + '...';
    }

    function titleFromEvent(evt) {
      if (!evt) return 'Activity';
      if (evt.description) return evt.description;
      if (evt.metadata) {
        if (evt.metadata.taskTitle) return evt.metadata.taskTitle;
        if (evt.metadata.decisionTitle) return evt.metadata.decisionTitle;
        if (evt.metadata.projectName) return evt.metadata.projectName;
        if (evt.metadata.bridgeName) return evt.metadata.bridgeName;
      }
      return actionLabel(evt.action);
    }

    function actionLabel(action) {
      var map = {
        CREATED: 'Created',
        UPDATED: 'Updated',
        STATUS_CHANGED: 'Status changed',
        TRANSITIONED: 'Status changed',
        COMMENTED: 'Commented',
        LINKED: 'Document linked',
        UNLINKED: 'Document unlinked',
        ARCHIVED: 'Archived',
        RESTORED: 'Restored',
        REVIEWER_ADDED: 'Reviewer added',
        APPROVED: 'Approved',
        BRIDGE_LINKED: 'Bridge linked',
        BRIDGE_CREATED: 'Bridge created'
      };
      return map[action] || (action ? String(action).replace(/_/g, ' ') : 'Activity');
    }

    function getProjectInitiativeId(project) {
      return getField(project, ['initiativeId', 'initiative_id']);
    }

    function buildLookup() {
      var projectMap = makeMap(timelineState.projects);
      var decisionMap = makeMap(timelineState.decisions);
      var taskMap = makeMap(timelineState.tasks);
      var bridgeMap = makeMap(timelineState.bridges);
      var initiativeMap = makeMap(timelineState.initiatives);
      var projectToInitiative = {};

      for (var i = 0; i < timelineState.projects.length; i++) {
        var p = timelineState.projects[i];
        var initId = getProjectInitiativeId(p);
        if (p.id && initId) projectToInitiative[p.id] = initId;
      }

      return {
        projects: projectMap,
        decisions: decisionMap,
        tasks: taskMap,
        bridges: bridgeMap,
        initiatives: initiativeMap,
        projectToInitiative: projectToInitiative
      };
    }

    function getDecisionProjectId(decision) {
      var direct = getField(decision, ['projectId', 'project_id']);
      if (direct) return direct;
      var et = String(getField(decision, ['entityType', 'entity_type']) || '').toUpperCase();
      if (et === 'PROJECT') return getField(decision, ['entityId', 'entity_id']);
      return null;
    }

    function getDecisionInitiativeId(decision, lookup) {
      var et = String(getField(decision, ['entityType', 'entity_type']) || '').toUpperCase();
      var entityId = getField(decision, ['entityId', 'entity_id']);
      if (et === 'INITIATIVE' && entityId) return entityId;
      var projectId = getDecisionProjectId(decision);
      return projectId ? lookup.projectToInitiative[projectId] : null;
    }

    function getTaskProjectId(task, lookup) {
      var direct = getField(task, ['projectId', 'project_id']);
      if (direct) return direct;
      var decisionId = getField(task, ['decisionId', 'decision_id']);
      if (decisionId && lookup.decisions[decisionId]) return getDecisionProjectId(lookup.decisions[decisionId]);
      var et = String(getField(task, ['entityType', 'entity_type']) || '').toUpperCase();
      var entityId = getField(task, ['entityId', 'entity_id']);
      if (et === 'PROJECT') return entityId;
      if (et === 'DECISION' && lookup.decisions[entityId]) return getDecisionProjectId(lookup.decisions[entityId]);
      return null;
    }

    function getTaskInitiativeId(task, lookup) {
      var projectId = getTaskProjectId(task, lookup);
      return projectId ? lookup.projectToInitiative[projectId] : null;
    }

    function getBridgeProjectId(bridge) {
      return getField(bridge, ['fromProjectId', 'from_project_id', 'sourceProjectId', 'source_project_id'])
        || getField(bridge, ['toProjectId', 'to_project_id', 'targetProjectId', 'target_project_id']);
    }

    function getBridgeInitiativeId(bridge, lookup) {
      var projectId = getBridgeProjectId(bridge);
      return projectId ? lookup.projectToInitiative[projectId] : null;
    }

    function getGitHubEntityProjectId(entity) {
      return getField(entity, ['projectId', 'project_id'])
        || getField(entity, ['linkedProjectId', 'linked_project_id']);
    }

    function getGitHubEntityInitiativeId(entity, lookup) {
      var projectId = getGitHubEntityProjectId(entity);
      if (projectId) return lookup.projectToInitiative[projectId];
      return null;
    }

    function initiativeAllowed(initId) {
      if (!initId) return false;
      if (!timelineState.allowedInitiativeIds || timelineState.allowedInitiativeIds.length === 0) return true;
      for (var i = 0; i < timelineState.allowedInitiativeIds.length; i++) {
        if (timelineState.allowedInitiativeIds[i] === initId) return true;
      }
      return false;
    }

    function scopeAllows(initId) {
      if (!initiativeAllowed(initId)) return false;
      if (timelineState.scope !== 'initiative') return true;
      return initId === timelineState.selectedInitiativeId;
    }

    function pushItem(items, item) {
      if (!item || !item.date || !item.initiativeId) return;
      if (!scopeAllows(item.initiativeId)) return;
      items.push(item);
    }

    function itemMatchesFilter(item) {
      if (timelineState.filter === 'planned') return !item.isActivity;
      if (timelineState.filter === 'activity') return !!item.isActivity;
      if (timelineState.filter === 'risk') return !!item.isRisk;
      return true;
    }

    function addEntityDate(items, entity, cfg) {
      var d = validDate(cfg.date);
      if (!d) return;
      pushItem(items, {
        id: cfg.id,
        type: cfg.type,
        entityType: cfg.entityType,
        entityId: entity.id,
        initiativeId: cfg.initiativeId,
        projectId: cfg.projectId || null,
        date: d,
        label: cfg.label,
        status: entity.status || '',
        bucket: cfg.bucket,
        isActivity: !!cfg.isActivity,
        isRisk: !!cfg.isRisk,
        priority: cfg.priority || 3,
        color: cfg.color || MARKER_COLORS[cfg.type] || MARKER_COLORS.activity
      });
    }

    function eventEntityInfo(evt, lookup) {
      if (evt.taskId && lookup.tasks[evt.taskId]) {
        var task = lookup.tasks[evt.taskId];
        var taskProjectId = getTaskProjectId(task, lookup);
        return {
          entityType: 'task',
          entityId: evt.taskId,
          initiativeId: getTaskInitiativeId(task, lookup),
          projectId: taskProjectId
        };
      }
      if (evt.decisionId && lookup.decisions[evt.decisionId]) {
        var decision = lookup.decisions[evt.decisionId];
        var decisionProjectId = getDecisionProjectId(decision);
        return {
          entityType: 'decision',
          entityId: evt.decisionId,
          initiativeId: getDecisionInitiativeId(decision, lookup),
          projectId: decisionProjectId
        };
      }
      if (evt.bridgeId && lookup.bridges[evt.bridgeId]) {
        var bridge = lookup.bridges[evt.bridgeId];
        var bridgeProjectId = getBridgeProjectId(bridge);
        return {
          entityType: 'bridge',
          entityId: evt.bridgeId,
          initiativeId: getBridgeInitiativeId(bridge, lookup),
          projectId: bridgeProjectId
        };
      }
      if (evt.projectId && lookup.projects[evt.projectId]) {
        return {
          entityType: 'project',
          entityId: evt.projectId,
          initiativeId: lookup.projectToInitiative[evt.projectId],
          projectId: evt.projectId
        };
      }
      if (evt.initiativeId && lookup.initiatives[evt.initiativeId]) {
        return {
          entityType: 'initiative',
          entityId: evt.initiativeId,
          initiativeId: evt.initiativeId,
          projectId: null
        };
      }
      return null;
    }

    function normalizeItems(lookup) {
      var items = [];
      var now = startOfDay(new Date());

      for (var i = 0; i < timelineState.initiatives.length; i++) {
        var init = timelineState.initiatives[i];
        if (!scopeAllows(init.id)) continue;
        addEntityDate(items, init, {
          id: 'initiative-created-' + init.id,
          type: 'initiative',
          entityType: 'initiative',
          initiativeId: init.id,
          date: init.createdAt,
          label: 'Initiative started',
          bucket: 'lifecycle',
          priority: 2,
          color: MARKER_COLORS.initiative
        });
      }

      for (var p = 0; p < timelineState.projects.length; p++) {
        var project = timelineState.projects[p];
        var projectInitId = getProjectInitiativeId(project);
        addEntityDate(items, project, {
          id: 'project-created-' + project.id,
          type: 'project',
          entityType: 'project',
          initiativeId: projectInitId,
          projectId: project.id,
          date: project.createdAt,
          label: displayName(project),
          bucket: 'lifecycle',
          priority: statusIsActive(project.status) ? 1 : 3,
          color: MARKER_COLORS.project
        });
      }

      for (var d = 0; d < timelineState.decisions.length; d++) {
        var decision = timelineState.decisions[d];
        var decisionProjectId = getDecisionProjectId(decision);
        var decisionInitId = getDecisionInitiativeId(decision, lookup);
        var decisionStatus = normalizeStatus(decision.status);
        var riskDecision = decisionStatus === 'PROPOSED' || decisionStatus === 'IN_PROGRESS' || decisionStatus === 'DRAFT';
        addEntityDate(items, decision, {
          id: 'decision-created-' + decision.id,
          type: 'decision',
          entityType: 'decision',
          initiativeId: decisionInitId,
          projectId: decisionProjectId,
          date: decision.createdAt,
          label: displayName(decision),
          bucket: 'decision',
          priority: riskDecision ? 1 : 2,
          isRisk: riskDecision,
          color: MARKER_COLORS.decision
        });
      }

      for (var t = 0; t < timelineState.tasks.length; t++) {
        var task = timelineState.tasks[t];
        var taskDue = validDate(task.dueDate || task.due_date);
        var taskProjectId = getTaskProjectId(task, lookup);
        var taskInitId = getTaskInitiativeId(task, lookup);
        if (taskDue) {
          var overdue = taskDue < now && !statusIsDone(task.status);
          addEntityDate(items, task, {
            id: 'task-due-' + task.id,
            type: overdue ? 'task_overdue' : 'task_due',
            entityType: 'task',
            initiativeId: taskInitId,
            projectId: taskProjectId,
            date: taskDue,
            label: displayName(task),
            bucket: 'planned',
            priority: overdue ? 0 : 1,
            isRisk: overdue,
            color: overdue ? MARKER_COLORS.task_overdue : MARKER_COLORS.task_due
          });
        } else {
          addEntityDate(items, task, {
            id: 'task-created-' + task.id,
            type: 'activity',
            entityType: 'task',
            initiativeId: taskInitId,
            projectId: taskProjectId,
            date: task.createdAt,
            label: displayName(task),
            bucket: 'task',
            isActivity: true,
            priority: 4,
            color: MARKER_COLORS.activity
          });
        }
      }

      for (var b = 0; b < timelineState.bridges.length; b++) {
        var bridge = timelineState.bridges[b];
        var bridgeProjectId = getBridgeProjectId(bridge);
        addEntityDate(items, bridge, {
          id: 'bridge-created-' + bridge.id,
          type: 'bridge',
          entityType: 'bridge',
          initiativeId: getBridgeInitiativeId(bridge, lookup),
          projectId: bridgeProjectId,
          date: bridge.createdAt,
          label: displayName(bridge),
          bucket: 'dependency',
          priority: 2,
          color: MARKER_COLORS.bridge
        });
      }

      for (var is = 0; is < timelineState.issues.length; is++) {
        var issue = timelineState.issues[is];
        var issueInitId = getGitHubEntityInitiativeId(issue, lookup);
        addEntityDate(items, issue, {
          id: 'issue-created-' + issue.id,
          type: 'issue',
          entityType: 'issue',
          initiativeId: issueInitId,
          projectId: getGitHubEntityProjectId(issue),
          date: issue.createdAt || issue.githubCreatedAt,
          label: displayName(issue),
          bucket: 'github',
          priority: normalizeStatus(issue.status) === 'OPEN' ? 2 : 4,
          isRisk: normalizeStatus(issue.status) === 'OPEN',
          color: MARKER_COLORS.issue
        });
      }

      for (var pr = 0; pr < timelineState.prs.length; pr++) {
        var pull = timelineState.prs[pr];
        var prInitId = getGitHubEntityInitiativeId(pull, lookup);
        addEntityDate(items, pull, {
          id: 'pr-created-' + pull.id,
          type: 'pull_request',
          entityType: 'pull_request',
          initiativeId: prInitId,
          projectId: getGitHubEntityProjectId(pull),
          date: pull.createdAt || pull.githubCreatedAt,
          label: displayName(pull),
          bucket: 'github',
          priority: normalizeStatus(pull.status) === 'IN_REVIEW' ? 1 : 3,
          isRisk: normalizeStatus(pull.status) === 'CHANGES_REQUESTED',
          color: MARKER_COLORS.pull_request
        });
      }

      for (var e = 0; e < timelineState.timeline.length; e++) {
        var evt = timelineState.timeline[e];
        var info = eventEntityInfo(evt, lookup);
        var evtDate = validDate(evt.createdAt);
        if (!info || !evtDate) continue;
        pushItem(items, {
          id: 'activity-' + (evt.id || e),
          type: 'activity',
          entityType: info.entityType,
          entityId: info.entityId,
          initiativeId: info.initiativeId,
          projectId: info.projectId,
          date: evtDate,
          label: titleFromEvent(evt),
          status: evt.action || '',
          bucket: 'activity',
          isActivity: true,
          isRisk: false,
          priority: evt.action === 'STATUS_CHANGED' || evt.action === 'APPROVED' ? 1 : 3,
          color: MARKER_COLORS.activity
        });
      }

      items.sort(function(a, b) {
        var diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        return (a.priority || 3) - (b.priority || 3);
      });
      return items;
    }

    function buildModel() {
      var lookup = buildLookup();
      var items = normalizeItems(lookup);
      var lanes = [];
      var laneMap = {};
      var allowed = {};
      var i;

      for (i = 0; i < timelineState.allowedInitiativeIds.length; i++) {
        allowed[timelineState.allowedInitiativeIds[i]] = true;
      }

      for (i = 0; i < timelineState.initiatives.length; i++) {
        var init = timelineState.initiatives[i];
        if (!initiativeAllowed(init.id)) continue;
        if (timelineState.scope === 'initiative' && init.id !== timelineState.selectedInitiativeId) continue;
        laneMap[init.id] = {
          initiative: init,
          items: [],
          projects: 0,
          tasks: 0,
          decisions: 0,
          activeProjects: 0,
          overdueTasks: 0,
          nextTasks: 0,
          lastActivity: null
        };
        lanes.push(laneMap[init.id]);
      }

      for (i = 0; i < items.length; i++) {
        if (laneMap[items[i].initiativeId] && itemMatchesFilter(items[i])) laneMap[items[i].initiativeId].items.push(items[i]);
      }

      var now = startOfDay(new Date());
      var soon = addDays(now, 14);

      for (var p = 0; p < timelineState.projects.length; p++) {
        var pInitId = getProjectInitiativeId(timelineState.projects[p]);
        if (!laneMap[pInitId]) continue;
        laneMap[pInitId].projects++;
        if (statusIsActive(timelineState.projects[p].status)) laneMap[pInitId].activeProjects++;
      }

      for (var d = 0; d < timelineState.decisions.length; d++) {
        var dInitId = getDecisionInitiativeId(timelineState.decisions[d], lookup);
        if (laneMap[dInitId]) laneMap[dInitId].decisions++;
      }

      for (var t = 0; t < timelineState.tasks.length; t++) {
        var task = timelineState.tasks[t];
        var tInitId = getTaskInitiativeId(task, lookup);
        if (!laneMap[tInitId]) continue;
        laneMap[tInitId].tasks++;
        var due = validDate(task.dueDate || task.due_date);
        if (due && !statusIsDone(task.status)) {
          if (due < now) laneMap[tInitId].overdueTasks++;
          else if (due <= soon) laneMap[tInitId].nextTasks++;
        }
      }

      for (i = 0; i < lanes.length; i++) {
        var activityItems = [];
        for (var ai = 0; ai < items.length; ai++) {
          if (items[ai].initiativeId === lanes[i].initiative.id && items[ai].isActivity) {
            activityItems.push(items[ai]);
          }
        }
        activityItems.sort(function(a, b) { return b.date.getTime() - a.date.getTime(); });
        lanes[i].lastActivity = activityItems.length ? activityItems[0] : null;
      }

      return {
        lookup: lookup,
        items: items,
        lanes: lanes,
        range: buildRange(items)
      };
    }

    function buildRange(items) {
      var now = new Date();
      var min = addDays(now, -30);
      var max = addDays(now, 90);
      for (var i = 0; i < items.length; i++) {
        if (items[i].date < min) min = items[i].date;
        if (items[i].date > max) max = items[i].date;
      }
      min = startOfMonth(addMonths(min, -1));
      max = startOfMonth(addMonths(max, 2));
      var spanDays = Math.max(1, Math.round((max.getTime() - min.getTime()) / DAY_MS));
      var scale = spanDays > 420 ? 'quarter' : 'month';
      var ticks = [];
      var tick = scale === 'quarter' ? startOfQuarter(min) : startOfMonth(min);
      var guard = 0;
      while (tick <= max && guard < 80) {
        ticks.push(new Date(tick.getTime()));
        tick = addMonths(tick, scale === 'quarter' ? 3 : 1);
        guard++;
      }
      return {
        min: min,
        max: max,
        span: max.getTime() - min.getTime(),
        scale: scale,
        ticks: ticks,
        width: Math.max(960, ticks.length * 150)
      };
    }

    function positionForDate(date, range) {
      if (!date || !range || !range.span) return 0;
      var raw = ((date.getTime() - range.min.getTime()) / range.span) * 100;
      if (raw < 0) return 0;
      if (raw > 100) return 100;
      return raw;
    }

    function selectedInitiativeName() {
      for (var i = 0; i < timelineState.initiatives.length; i++) {
        if (timelineState.initiatives[i].id === timelineState.selectedInitiativeId) {
          return displayName(timelineState.initiatives[i]);
        }
      }
      return '';
    }

    function statsForModel(model) {
      var activeInitiatives = 0;
      var activeProjects = 0;
      var pendingDecisions = 0;
      var dueSoon = 0;
      var overdue = 0;
      var recentActivity = 0;
      var now = startOfDay(new Date());
      var soon = addDays(now, 14);
      var sevenDaysAgo = addDays(now, -7);
      var laneSet = {};
      var i;

      for (i = 0; i < model.lanes.length; i++) {
        laneSet[model.lanes[i].initiative.id] = true;
        if (statusIsActive(model.lanes[i].initiative.status) || model.lanes[i].activeProjects > 0) activeInitiatives++;
        activeProjects += model.lanes[i].activeProjects;
      }
      for (i = 0; i < timelineState.decisions.length; i++) {
        var dec = timelineState.decisions[i];
        var initId = getDecisionInitiativeId(dec, model.lookup);
        var st = normalizeStatus(dec.status);
        if (laneSet[initId] && (st === 'DRAFT' || st === 'PROPOSED' || st === 'IN_PROGRESS')) pendingDecisions++;
      }
      for (i = 0; i < timelineState.tasks.length; i++) {
        var task = timelineState.tasks[i];
        var taskInitId = getTaskInitiativeId(task, model.lookup);
        if (!laneSet[taskInitId] || statusIsDone(task.status)) continue;
        var due = validDate(task.dueDate || task.due_date);
        if (due && due < now) overdue++;
        else if (due && due <= soon) dueSoon++;
      }
      for (i = 0; i < model.items.length; i++) {
        if (model.items[i].isActivity && model.items[i].date >= sevenDaysAgo) recentActivity++;
      }
      return {
        activeInitiatives: activeInitiatives,
        activeProjects: activeProjects,
        pendingDecisions: pendingDecisions,
        dueSoon: dueSoon,
        overdue: overdue,
        recentActivity: recentActivity
      };
    }

    function renderStat(label, value, tone) {
      var color = tone === 'risk' ? '#ef4444' : (tone === 'next' ? '#10b981' : 'var(--accent-primary)');
      return '<div style="border:1px solid var(--border-color);border-radius:8px;'
        + 'background:var(--bg-surface);padding:var(--space-3);min-width:132px;">'
        + '<div style="font-size:22px;font-weight:var(--weight-bold);color:' + color + ';line-height:1;">'
        + UI.escapeHtml(String(value)) + '</div>'
        + '<div style="font-size:var(--text-small);color:var(--text-secondary);margin-top:6px;">'
        + UI.escapeHtml(label) + '</div>'
        + '</div>';
    }

    function renderHeader(model) {
      var title = timelineState.scope === 'initiative' && selectedInitiativeName()
        ? selectedInitiativeName()
        : 'Timeline';
      var subtitle = timelineState.scope === 'initiative'
        ? 'Focused initiative trajectory'
        : 'All initiatives over time';

      return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);'
        + 'margin-bottom:var(--space-5);flex-wrap:wrap;">'
        + '<div>'
        + '<h1 style="font-size:var(--text-h1);font-weight:var(--weight-bold);margin:0;">'
        + UI.escapeHtml(title) + '</h1>'
        + '<div style="font-size:var(--text-small);color:var(--text-secondary);margin-top:6px;">'
        + UI.escapeHtml(subtitle) + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;justify-content:flex-end;">'
        + renderScopeControls(model)
        + UI.orgPicker(timelineState.organizations, timelineState.activeOrgId, { defaultOrgId: timelineState.defaultOrgId })
        + '</div>'
        + '</div>';
    }

    function renderScopeControls(model) {
      var allActive = timelineState.scope === 'all';
      var initActive = timelineState.scope === 'initiative';
      var html = '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">';
      html += '<div style="display:inline-flex;border:1px solid var(--border-color);border-radius:8px;'
        + 'overflow:hidden;background:var(--bg-surface);height:34px;">'
        + '<button data-timeline-scope="all" style="border:0;border-right:1px solid var(--border-color);'
        + 'padding:0 12px;background:' + (allActive ? 'var(--accent-primary)' : 'transparent')
        + ';color:' + (allActive ? 'white' : 'var(--text-secondary)')
        + ';font-family:var(--font-sans);font-size:12px;cursor:pointer;">All Initiatives</button>'
        + '<button data-timeline-scope="initiative" style="border:0;padding:0 12px;background:'
        + (initActive ? 'var(--accent-primary)' : 'transparent')
        + ';color:' + (initActive ? 'white' : 'var(--text-secondary)')
        + ';font-family:var(--font-sans);font-size:12px;cursor:pointer;">Focused</button>'
        + '</div>';
      html += '<select id="decidr-timeline-initiative-select" style="height:34px;min-width:190px;'
        + 'border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface);'
        + 'color:var(--text-primary);font-family:var(--font-sans);font-size:12px;padding:0 10px;'
        + (timelineState.scope === 'initiative' ? '' : 'opacity:0.58;')
        + '">';
      for (var i = 0; i < timelineState.initiatives.length; i++) {
        var init = timelineState.initiatives[i];
        if (!initiativeAllowed(init.id)) continue;
        html += '<option value="' + UI.escapeHtml(init.id) + '"'
          + (init.id === timelineState.selectedInitiativeId ? ' selected' : '') + '>'
          + UI.escapeHtml(truncate(displayName(init), 42)) + '</option>';
      }
      html += '</select>';
      html += '</div>';
      return html;
    }

    function renderFilterControls() {
      var filters = [
        { key: 'all', label: 'All' },
        { key: 'planned', label: 'Planned' },
        { key: 'activity', label: 'Activity' },
        { key: 'risk', label: 'Risk' }
      ];
      var html = '<div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;margin:var(--space-5) 0 var(--space-3) 0;">';
      for (var i = 0; i < filters.length; i++) {
        var active = timelineState.filter === filters[i].key;
        html += '<button data-timeline-filter="' + filters[i].key + '" style="height:30px;padding:0 12px;'
          + 'border:1px solid ' + (active ? 'var(--accent-primary)' : 'var(--border-color)')
          + ';border-radius:8px;background:' + (active ? 'var(--accent-primary)' : 'var(--bg-surface)')
          + ';color:' + (active ? 'white' : 'var(--text-secondary)')
          + ';font-family:var(--font-sans);font-size:12px;cursor:pointer;">'
          + UI.escapeHtml(filters[i].label) + '</button>';
      }
      html += '<span style="font-size:var(--text-small);color:var(--text-tertiary);">Month and quarter scale adjusts automatically</span>';
      html += '</div>';
      return html;
    }

    function renderStats(model) {
      var stats = statsForModel(model);
      return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:var(--space-3);">'
        + renderStat('Active initiatives', stats.activeInitiatives, 'normal')
        + renderStat('Active projects', stats.activeProjects, 'normal')
        + renderStat('Pending decisions', stats.pendingDecisions, 'normal')
        + renderStat('Due in 14 days', stats.dueSoon, 'next')
        + renderStat('Overdue', stats.overdue, stats.overdue ? 'risk' : 'normal')
        + renderStat('Activity this week', stats.recentActivity, 'normal')
        + '</div>';
    }

    function renderTimelineBoard(model) {
      if (model.lanes.length === 0) {
        return '<div style="padding:var(--space-6);border:1px solid var(--border-color);'
          + 'border-radius:8px;background:var(--bg-surface);">'
          + UI.emptyState('No initiatives match this timeline scope.')
          + '</div>';
      }

      var html = '<div style="border:1px solid var(--border-color);border-radius:8px;'
        + 'background:var(--bg-surface);overflow:hidden;">'
        + '<div style="overflow-x:auto;">'
        + '<div style="min-width:' + model.range.width + 'px;">'
        + renderTimelineHeader(model.range)
        + renderTimelineLanes(model)
        + '</div></div></div>';
      return html;
    }

    function renderTimelineHeader(range) {
      var nowPct = positionForDate(new Date(), range);
      var html = '<div style="display:grid;grid-template-columns:220px 1fr;border-bottom:1px solid var(--border-color);'
        + 'background:var(--bg-subtle);min-height:48px;">'
        + '<div style="padding:14px var(--space-3);font-size:var(--text-small);font-weight:var(--weight-semibold);'
        + 'color:var(--text-secondary);border-right:1px solid var(--border-color);">Initiative</div>'
        + '<div style="position:relative;height:48px;">';
      for (var i = 0; i < range.ticks.length; i++) {
        var pct = positionForDate(range.ticks[i], range);
        html += '<div style="position:absolute;left:' + pct + '%;top:0;bottom:0;border-left:1px solid var(--border-color);"></div>'
          + '<div style="position:absolute;left:calc(' + pct + '% + 8px);top:14px;'
          + 'font-size:11px;color:var(--text-secondary);white-space:nowrap;">'
          + UI.escapeHtml(formatTick(range.ticks[i], range.scale)) + '</div>';
      }
      if (nowPct >= 0 && nowPct <= 100) {
        html += '<div style="position:absolute;left:' + nowPct + '%;top:0;bottom:0;border-left:2px solid #ef4444;"></div>'
          + '<div style="position:absolute;left:calc(' + nowPct + '% + 6px);bottom:4px;'
          + 'font-size:10px;color:#ef4444;font-weight:var(--weight-semibold);">Now</div>';
      }
      html += '</div></div>';
      return html;
    }

    function renderTimelineLanes(model) {
      var html = '';
      for (var i = 0; i < model.lanes.length; i++) {
        html += renderLane(model.lanes[i], model.range, i);
      }
      return html;
    }

    function renderLane(lane, range, idx) {
      var init = lane.initiative;
      var laneItems = lane.items.slice().sort(function(a, b) {
        var pd = (a.priority || 3) - (b.priority || 3);
        if (pd !== 0) return pd;
        return a.date.getTime() - b.date.getTime();
      });
      var visible = laneItems.slice(0, 22);
      visible.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });

      var bg = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)';
      var html = '<div style="display:grid;grid-template-columns:220px 1fr;min-height:104px;'
        + 'border-bottom:1px solid var(--border-color);background:' + bg + ';">';
      html += '<div data-entity-type="initiative" data-entity-id="' + UI.escapeHtml(init.id) + '" '
        + 'style="padding:var(--space-3);border-right:1px solid var(--border-color);cursor:pointer;min-width:0;">'
        + '<div style="font-weight:var(--weight-semibold);font-size:13px;color:var(--text-primary);line-height:1.3;">'
        + UI.escapeHtml(truncate(displayName(init), 46)) + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">'
        + smallMeta(lane.activeProjects + '/' + lane.projects + ' active')
        + smallMeta(lane.decisions + ' decisions')
        + smallMeta(lane.nextTasks + ' next')
        + (lane.overdueTasks ? smallMeta(lane.overdueTasks + ' overdue', '#ef4444') : '')
        + '</div>'
        + (lane.lastActivity ? '<div style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">Last activity '
          + UI.escapeHtml(UI.timeAgo(lane.lastActivity.date.toISOString())) + '</div>' : '')
        + '</div>';
      html += '<div style="position:relative;min-height:104px;">';
      for (var t = 0; t < range.ticks.length; t++) {
        var tickPct = positionForDate(range.ticks[t], range);
        html += '<div style="position:absolute;left:' + tickPct + '%;top:0;bottom:0;border-left:1px solid rgba(148,163,184,0.18);"></div>';
      }
      if (visible.length === 0) {
        html += '<div style="position:absolute;left:24px;top:39px;font-size:12px;color:var(--text-tertiary);">'
          + 'No dated work yet</div>';
      } else {
        for (var i = 0; i < visible.length; i++) {
          html += renderMarker(visible[i], range, i);
        }
        if (laneItems.length > visible.length) {
          html += '<div style="position:absolute;right:12px;bottom:10px;font-size:11px;'
            + 'color:var(--text-tertiary);background:var(--bg-surface);border:1px solid var(--border-color);'
            + 'border-radius:8px;padding:3px 7px;">+' + (laneItems.length - visible.length) + ' more</div>';
        }
      }
      html += '</div></div>';
      return html;
    }

    function smallMeta(text, color) {
      return '<span style="font-size:11px;color:' + (color || 'var(--text-secondary)') + ';'
        + 'border:1px solid var(--border-color);border-radius:999px;padding:2px 7px;'
        + 'background:var(--bg-surface);white-space:nowrap;">' + UI.escapeHtml(text) + '</span>';
    }

    function renderMarker(item, range, idx) {
      var pct = positionForDate(item.date, range);
      var row = idx % 4;
      var top = 18 + row * 18;
      var color = item.color || MARKER_COLORS.activity;
      var label = item.priority <= 1 ? truncate(item.label, 24) : '';
      var dateLabel = UI.formatDate(item.date.toISOString());
      var title = dateLabel + ' - ' + item.label;
      var html = '<button data-entity-type="' + UI.escapeHtml(item.entityType) + '" '
        + 'data-entity-id="' + UI.escapeHtml(item.entityId) + '" '
        + 'title="' + UI.escapeHtml(title) + '" '
        + 'style="position:absolute;left:calc(' + pct + '% - 7px);top:' + top + 'px;'
        + 'width:14px;height:14px;border-radius:' + (item.type === 'decision' ? '3px' : '999px') + ';'
        + 'border:2px solid var(--bg-surface);background:' + color + ';box-shadow:0 0 0 1px rgba(0,0,0,0.12);'
        + 'cursor:pointer;padding:0;z-index:2;"></button>';
      if (label) {
        html += '<div data-entity-type="' + UI.escapeHtml(item.entityType) + '" '
          + 'data-entity-id="' + UI.escapeHtml(item.entityId) + '" '
          + 'title="' + UI.escapeHtml(title) + '" '
          + 'style="position:absolute;left:calc(' + pct + '% + 10px);top:' + (top - 3) + 'px;'
          + 'max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
          + 'font-size:11px;color:var(--text-secondary);cursor:pointer;z-index:2;">'
          + UI.escapeHtml(label) + '</div>';
      }
      return html;
    }

    function collectScanItems(model) {
      var now = startOfDay(new Date());
      var soon = addDays(now, 14);
      var staleCutoff = addDays(now, -30);
      var laneSet = {};
      var i;
      for (i = 0; i < model.lanes.length; i++) {
        laneSet[model.lanes[i].initiative.id] = true;
      }

      var next = [];
      var risk = [];
      var recent = [];

      for (i = 0; i < timelineState.tasks.length; i++) {
        var task = timelineState.tasks[i];
        var taskInitId = getTaskInitiativeId(task, model.lookup);
        if (!laneSet[taskInitId] || statusIsDone(task.status)) continue;
        var due = validDate(task.dueDate || task.due_date);
        if (!due) continue;
        var taskItem = {
          entityType: 'task',
          entityId: task.id,
          label: displayName(task),
          meta: 'Due ' + UI.formatDate(due.toISOString()),
          date: due
        };
        if (due < now) risk.push(taskItem);
        else if (due <= soon) next.push(taskItem);
      }

      for (i = 0; i < timelineState.decisions.length; i++) {
        var dec = timelineState.decisions[i];
        var decInitId = getDecisionInitiativeId(dec, model.lookup);
        if (!laneSet[decInitId]) continue;
        var status = normalizeStatus(dec.status);
        if (status === 'DRAFT' || status === 'PROPOSED' || status === 'IN_PROGRESS') {
          next.push({
            entityType: 'decision',
            entityId: dec.id,
            label: displayName(dec),
            meta: status.replace(/_/g, ' '),
            date: validDate(dec.createdAt) || now
          });
        }
      }

      for (i = 0; i < model.items.length; i++) {
        if (model.items[i].isActivity) recent.push(model.items[i]);
      }
      recent.sort(function(a, b) { return b.date.getTime() - a.date.getTime(); });

      for (i = 0; i < model.lanes.length; i++) {
        var lane = model.lanes[i];
        if (!lane.lastActivity || lane.lastActivity.date < staleCutoff) {
          risk.push({
            entityType: 'initiative',
            entityId: lane.initiative.id,
            label: displayName(lane.initiative),
            meta: lane.lastActivity ? 'No activity in 30 days' : 'No tracked activity',
            date: lane.lastActivity ? lane.lastActivity.date : now
          });
        }
      }

      next.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
      risk.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });

      return {
        recent: recent.slice(0, 6),
        next: next.slice(0, 6),
        risk: risk.slice(0, 6)
      };
    }

    function renderScan(model) {
      var scan = collectScanItems(model);
      return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-3);'
        + 'margin-top:var(--space-5);">'
        + renderScanColumn('Now', 'Recent motion', scan.recent, 'activity')
        + renderScanColumn('Next', 'Due soon and pending', scan.next, 'next')
        + renderScanColumn('Risk', 'Overdue or stalled', scan.risk, 'risk')
        + '</div>';
    }

    function renderScanColumn(title, subtitle, items, tone) {
      var html = '<div style="border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface);'
        + 'padding:var(--space-4);min-height:210px;">'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-2);">'
        + '<h2 style="font-size:15px;margin:0;font-weight:var(--weight-semibold);color:var(--text-primary);">'
        + UI.escapeHtml(title) + '</h2>'
        + '<span style="font-size:11px;color:var(--text-tertiary);">' + UI.escapeHtml(subtitle) + '</span>'
        + '</div>';
      if (!items.length) {
        html += '<div style="font-size:12px;color:var(--text-tertiary);padding:var(--space-5) 0;">Nothing to show</div>';
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:var(--space-3);">';
        for (var i = 0; i < items.length; i++) {
          html += renderScanItem(items[i], tone);
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderScanItem(item, tone) {
      var color = tone === 'risk' ? '#ef4444' : (tone === 'next' ? '#10b981' : '#6366f1');
      var meta = item.meta || (item.date ? UI.timeAgo(item.date.toISOString()) : '');
      return '<div data-entity-type="' + UI.escapeHtml(item.entityType) + '" '
        + 'data-entity-id="' + UI.escapeHtml(item.entityId) + '" '
        + 'style="display:flex;align-items:flex-start;gap:9px;padding:9px;border:1px solid var(--border-color);'
        + 'border-radius:8px;background:var(--bg-subtle);cursor:pointer;">'
        + '<span style="width:9px;height:9px;border-radius:999px;background:' + color + ';margin-top:4px;flex:0 0 auto;"></span>'
        + '<span style="min-width:0;display:block;">'
        + '<span style="display:block;font-size:12px;color:var(--text-primary);font-weight:var(--weight-semibold);'
        + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
        + UI.escapeHtml(truncate(item.label, 58)) + '</span>'
        + '<span style="display:block;font-size:11px;color:var(--text-secondary);margin-top:3px;text-transform:none;">'
        + UI.escapeHtml(meta) + '</span>'
        + '</span>'
        + '</div>';
    }

    function renderLegend() {
      var entries = [
        ['Task due', MARKER_COLORS.task_due],
        ['Overdue', MARKER_COLORS.task_overdue],
        ['Project', MARKER_COLORS.project],
        ['Decision', MARKER_COLORS.decision],
        ['Bridge', MARKER_COLORS.bridge],
        ['GitHub', MARKER_COLORS.pull_request],
        ['Activity', MARKER_COLORS.activity]
      ];
      var html = '<div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;'
        + 'font-size:11px;color:var(--text-secondary);margin:0 0 var(--space-3) 0;">';
      for (var i = 0; i < entries.length; i++) {
        html += '<span style="display:inline-flex;align-items:center;gap:6px;">'
          + '<span style="width:9px;height:9px;border-radius:999px;background:' + entries[i][1] + ';"></span>'
          + UI.escapeHtml(entries[i][0]) + '</span>';
      }
      html += '</div>';
      return html;
    }

    function renderTimeline() {
      var model = buildModel();
      var html = '<div style="max-width:1280px;margin:0 auto;padding:var(--space-6) var(--space-4);'
        + 'font-family:var(--font-sans);color:var(--text-primary);">';
      html += renderHeader(model);
      html += renderStats(model);
      html += renderFilterControls();
      html += renderLegend();
      html += renderTimelineBoard(model);
      html += renderScan(model);
      html += '</div>';
      container.innerHTML = html;
      wireInteractions();
    }

    function wireInteractions() {
      wireScopeControls();
      wireFilterControls();
      wireEntityClicks(container);
      wireOrgPicker();
    }

    function wireScopeControls() {
      var scopeBtns = container.querySelectorAll('[data-timeline-scope]');
      for (var i = 0; i < scopeBtns.length; i++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var scope = btn.getAttribute('data-timeline-scope');
            if (!scope || scope === timelineState.scope) return;
            timelineState.scope = scope;
            if (scope === 'initiative' && !timelineState.selectedInitiativeId && timelineState.initiatives.length) {
              timelineState.selectedInitiativeId = timelineState.initiatives[0].id;
            }
            renderTimeline();
          });
        })(scopeBtns[i]);
      }

      var select = container.querySelector('#decidr-timeline-initiative-select');
      if (select) {
        select.addEventListener('change', function() {
          timelineState.selectedInitiativeId = select.value;
          timelineState.scope = 'initiative';
          renderTimeline();
        });
      }
    }

    function wireFilterControls() {
      var filterBtns = container.querySelectorAll('[data-timeline-filter]');
      for (var i = 0; i < filterBtns.length; i++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var filter = btn.getAttribute('data-timeline-filter');
            if (!filter || filter === timelineState.filter) return;
            timelineState.filter = filter;
            renderTimeline();
          });
        })(filterBtns[i]);
      }
    }

    function wireEntityClicks(scope) {
      var clickables = scope.querySelectorAll('[data-entity-type][data-entity-id]');
      for (var i = 0; i < clickables.length; i++) {
        (function(el) {
          if (el._decidrTimelineWired) return;
          el._decidrTimelineWired = true;
          el.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var entityType = el.getAttribute('data-entity-type');
            var entityId = el.getAttribute('data-entity-id');
            if (entityType && entityId) {
              UI.SlideOut.open(entityType, entityId, {
                source: container,
                onMutate: function() { refreshTimeline(); }
              });
            }
          });
        })(clickables[i]);
      }
    }

    function wireOrgPicker() {
      var toggle = container.querySelector('#decidr-org-picker-toggle');
      var menu = container.querySelector('#decidr-org-picker-menu');
      if (!toggle || !menu) return;

      function openOrgSettings(orgId) {
        UI.SlideOut.open('organization-settings', orgId, {
          source: container,
          onMutate: function() { refreshTimeline(); }
        });
      }

      function showOrgAuthPrompt(orgId) {
        container.innerHTML = '<div style="padding:var(--space-6);text-align:center;">'
          + '<p style="color:var(--text-secondary);margin-bottom:var(--space-4);">'
          + 'No authentication for this organization.</p>'
          + '<button id="decidr-org-auth-btn" style="padding:8px 16px;border:1px solid var(--accent-primary);'
          + 'border-radius:8px;background:var(--accent-primary);color:white;cursor:pointer;'
          + 'font-family:var(--font-sans);">Authenticate</button>'
          + '</div>';
        var authBtn = container.querySelector('#decidr-org-auth-btn');
        if (authBtn) {
          authBtn.addEventListener('click', function() {
            if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
              window.__TAURI__.core.invoke('start_plugin_auth', { pluginName: 'decidr', orgId: orgId });
            }
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
            timelineState.defaultOrgId = starOrgId;
            renderTimeline();
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
          if (settingsOrgId === timelineState.activeOrgId) {
            openOrgSettings(settingsOrgId);
            return;
          }
          timelineState.activeOrgId = settingsOrgId;
          container.innerHTML = UI.loadingSpinner('Switching organization...');
          API.switchOrg(settingsOrgId).then(function() {
            return refreshTimeline();
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
        if (orgId === timelineState.activeOrgId) {
          menu.classList.remove('open');
          return;
        }
        timelineState.activeOrgId = orgId;
        menu.classList.remove('open');
        container.innerHTML = UI.loadingSpinner('Switching organization...');
        API.switchOrg(orgId).then(function() {
          refreshTimeline();
        }).catch(function(err) {
          console.error('[decidr] Org switch failed:', err);
          showOrgAuthPrompt(orgId);
        });
      });
    }

    }, _orgId);
  };
})();

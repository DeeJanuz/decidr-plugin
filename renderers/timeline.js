(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_timeline = function(container, data, meta, toolArgs, reviewRequired, onDecision) {
    container.innerHTML = '';

    var _orgId = (data && data.organization_id) ? data.organization_id : null;
    window.__decidrAPI.withReady(container, meta, function() {
    var UI = window.__decidrUI;
    var API = window.__decidrAPI;

    var MINUTE_MS = 60 * 1000;
    var HOUR_MS = 60 * MINUTE_MS;
    var DAY_MS = 24 * HOUR_MS;
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

    var LEGEND_ENTRIES = [
      { key: 'task_due', label: 'Task due', color: MARKER_COLORS.task_due },
      { key: 'task_overdue', label: 'Overdue', color: MARKER_COLORS.task_overdue },
      { key: 'project', label: 'Project', color: MARKER_COLORS.project },
      { key: 'decision', label: 'Decision', color: MARKER_COLORS.decision },
      { key: 'bridge', label: 'Bridge', color: MARKER_COLORS.bridge },
      { key: 'github', label: 'GitHub', color: MARKER_COLORS.pull_request },
      { key: 'activity', label: 'Activity', color: MARKER_COLORS.activity },
      { key: 'initiative', label: 'Initiative', color: MARKER_COLORS.initiative }
    ];

    var timelineState = {
      organizations: [],
      activeOrgId: null,
      defaultOrgId: null,
      scope: (data && data.view === 'initiative') ? 'initiative' : 'all',
      selectedInitiativeId: (data && data.initiative_ids && data.initiative_ids.length) ? data.initiative_ids[0] : null,
      allowedInitiativeIds: (data && data.initiative_ids && data.initiative_ids.length) ? data.initiative_ids : [],
      filter: 'all',
      peopleFilter: 'all',
      rangePreset: 'thisWeek',
      rangeStart: null,
      rangeEnd: null,
      rangePanRemainder: 0,
      panWheelCleanup: null,
      decisionStartFilter: 'any',
      decisionEndFilter: 'any',
      hiddenLegendTypes: {},
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

    function normalizeUser(user) {
      if (!user) return null;
      if (user.user) user = user.user;
      var id = getField(user, ['id', 'userId', 'user_id']);
      var name = getField(user, ['name', 'displayName', 'display_name', 'email']);
      return {
        id: id || null,
        name: name || (id ? String(id).slice(0, 8) : ''),
        image: getField(user, ['image', 'avatar', 'avatarUrl', 'avatar_url']) || null
      };
    }

    function makeMemberMap(members) {
      var map = {};
      for (var i = 0; i < members.length; i++) {
        var user = normalizeUser(members[i]);
        if (user && user.id) map[user.id] = user;
      }
      return map;
    }

    function resolveUser(value, lookup) {
      if (!value) return null;
      if (typeof value === 'string') {
        return lookup && lookup.members && lookup.members[value]
          ? lookup.members[value]
          : { id: value, name: String(value).slice(0, 8), image: null };
      }
      var user = normalizeUser(value);
      if (user && user.id && lookup && lookup.members && lookup.members[user.id]) {
        var member = lookup.members[user.id];
        return {
          id: user.id,
          name: member.name || user.name,
          image: user.image || member.image || null
        };
      }
      return user;
    }

    function userDisplayName(user) {
      var normalized = normalizeUser(user);
      return normalized ? normalized.name : '';
    }

    function userInitials(user) {
      var name = userDisplayName(user);
      if (!name) return '?';
      var parts = name.split(/\s+/);
      var initials = '';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i]) initials += parts[i].charAt(0).toUpperCase();
        if (initials.length >= 2) break;
      }
      return initials || '?';
    }

    function uniqueIds(ids) {
      var seen = {};
      var result = [];
      for (var i = 0; i < ids.length; i++) {
        if (!ids[i] || seen[ids[i]]) continue;
        seen[ids[i]] = true;
        result.push(ids[i]);
      }
      return result;
    }

    function normalizeStatus(status) {
      return status ? String(status).toUpperCase() : '';
    }

    function statusIsDone(status) {
      var s = normalizeStatus(status);
      return s === 'DONE' || s === 'COMPLETED' || s === 'IMPLEMENTED' || s === 'MERGED' || s === 'ARCHIVED';
    }

    function statusIsBacklog(status) {
      return normalizeStatus(status) === 'BACKLOG';
    }

    function statusIsActive(status) {
      var s = normalizeStatus(status);
      return s === 'ACTIVE' || s === 'IN_PROGRESS' || s === 'STAGED' || s === 'PLANNING' || s === 'PROPOSED' || s === 'APPROVED' || s === 'TODO' || s === 'OPEN' || s === 'IN_REVIEW';
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

    function endOfDay(d) {
      var end = new Date(d.getTime());
      end.setHours(23, 59, 59, 999);
      return end;
    }

    function startOfHour(d) {
      var start = new Date(d.getTime());
      start.setMinutes(0, 0, 0);
      return start;
    }

    function startOfMinute(d) {
      var start = new Date(d.getTime());
      start.setSeconds(0, 0);
      return start;
    }

    function addHours(d, hours) {
      return new Date(d.getTime() + hours * HOUR_MS);
    }

    function addMinutes(d, minutes) {
      return new Date(d.getTime() + minutes * MINUTE_MS);
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

    function endOfMonth(d) {
      return endOfDay(addDays(addMonths(startOfMonth(d), 1), -1));
    }

    function startOfQuarter(d) {
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    }

    function startOfWeek(d) {
      var start = startOfDay(d);
      var day = start.getDay();
      return addDays(start, -day);
    }

    function pad2(value) {
      return String(value).padStart(2, '0');
    }

    function toInputDate(d) {
      if (!d || isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function fromInputDate(value, endOfDay) {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
      var parts = String(value).split('-');
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (isNaN(d.getTime())) return null;
      if (endOfDay) d.setHours(23, 59, 59, 999);
      return d;
    }

    function formatTick(d, scale) {
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (scale === 'quarter') {
        return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + d.getFullYear();
      }
      if (scale === 'week' || scale === 'day') {
        return months[d.getMonth()] + ' ' + d.getDate();
      }
      return months[d.getMonth()] + ' ' + d.getFullYear();
    }

    function formatHourTick(d) {
      var h = d.getHours();
      var suffix = h >= 12 ? 'PM' : 'AM';
      var hour = h % 12 || 12;
      return hour + suffix;
    }

    function formatMinuteTime(d) {
      var h = d.getHours();
      var suffix = h >= 12 ? 'PM' : 'AM';
      var hour = h % 12 || 12;
      return hour + ':' + pad2(d.getMinutes()) + ' ' + suffix;
    }

    function formatDateTime(d) {
      if (!d || isNaN(d.getTime())) return '';
      return UI.formatDate(d.toISOString()) + ' ' + formatMinuteTime(d);
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
        STAGED: 'Staged',
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
      var memberMap = makeMemberMap(timelineState.members);
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
        members: memberMap,
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

    function taskAssigneeId(task) {
      return getField(task, ['assigneeId', 'assignee_id']) || getField(task && task.assignee, ['id', 'userId', 'user_id']);
    }

    function taskPrimaryUser(task, lookup) {
      return resolveUser(task && task.assignee, lookup)
        || resolveUser(taskAssigneeId(task), lookup)
        || resolveUser(task && task.createdBy, lookup)
        || resolveUser(getField(task, ['createdById', 'created_by_id']), lookup);
    }

    function taskPersonIds(task) {
      return uniqueIds([
        taskAssigneeId(task),
        getField(task, ['createdById', 'created_by_id']),
        getField(task && task.project, ['ownerId', 'owner_id']),
        getField(task && task.project, ['createdById', 'created_by_id'])
      ]);
    }

    function taskIsUnassigned(task) {
      return !taskAssigneeId(task);
    }

    function projectPrimaryUser(project, lookup) {
      return resolveUser(project && project.owner, lookup)
        || resolveUser(getField(project, ['ownerId', 'owner_id']), lookup)
        || resolveUser(project && project.createdBy, lookup)
        || resolveUser(getField(project, ['createdById', 'created_by_id']), lookup);
    }

    function projectPersonIds(project) {
      var ids = [
        getField(project, ['ownerId', 'owner_id']),
        getField(project, ['createdById', 'created_by_id'])
      ];
      if (project && Array.isArray(project.members)) {
        for (var i = 0; i < project.members.length; i++) {
          ids.push(getField(project.members[i], ['userId', 'user_id']));
          ids.push(getField(project.members[i] && project.members[i].user, ['id', 'userId', 'user_id']));
        }
      }
      return uniqueIds(ids);
    }

    function decisionReviewerIds(decision) {
      var reviewers = decision && Array.isArray(decision.reviewers) ? decision.reviewers : [];
      var ids = [];
      for (var i = 0; i < reviewers.length; i++) {
        if (typeof reviewers[i] === 'string') ids.push(reviewers[i]);
        else ids.push(getField(reviewers[i], ['userId', 'user_id', 'id']));
      }
      return uniqueIds(ids);
    }

    function decisionPrimaryUser(decision, lookup) {
      return resolveUser(decision && decision.createdBy, lookup)
        || resolveUser(getField(decision, ['createdById', 'created_by_id']), lookup)
        || projectPrimaryUser(decision && decision.project, lookup);
    }

    function decisionPersonIds(decision) {
      return uniqueIds([
        getField(decision, ['createdById', 'created_by_id']),
        getField(decision && decision.project, ['ownerId', 'owner_id']),
        getField(decision && decision.project, ['createdById', 'created_by_id'])
      ].concat(decisionReviewerIds(decision)));
    }

    function eventPrimaryUser(evt, lookup) {
      return resolveUser(evt && evt.actor, lookup)
        || resolveUser(getField(evt, ['actorId', 'actor_id']), lookup);
    }

    function eventPersonIds(evt) {
      return uniqueIds([getField(evt, ['actorId', 'actor_id'])]);
    }

    function eventMetadata(evt) {
      if (!evt || !evt.metadata) return {};
      if (typeof evt.metadata === 'string') {
        try {
          return JSON.parse(evt.metadata);
        } catch (_err) {
          return {};
        }
      }
      return evt.metadata;
    }

    function eventStatusFrom(evt) {
      var metadata = eventMetadata(evt);
      return normalizeStatus(metadata.from || metadata.fromStatus || metadata.from_status);
    }

    function eventStatusTo(evt) {
      var metadata = eventMetadata(evt);
      return normalizeStatus(metadata.to || metadata.toStatus || metadata.to_status);
    }

    function itemHasPerson(item, userId) {
      if (!userId || !item || !Array.isArray(item.personIds)) return false;
      for (var i = 0; i < item.personIds.length; i++) {
        if (item.personIds[i] === userId) return true;
      }
      return false;
    }

    function peopleFilterMatches(personIds, unassigned) {
      if (timelineState.peopleFilter === 'unassigned') return !!unassigned;
      if (!timelineState.peopleFilter || timelineState.peopleFilter === 'all') return true;
      for (var i = 0; i < (personIds || []).length; i++) {
        if (personIds[i] === timelineState.peopleFilter) return true;
      }
      return false;
    }

    function addLanePerson(lane, user) {
      var normalized = normalizeUser(user);
      if (!lane || !normalized || !normalized.id) return;
      lane.activePeople[normalized.id] = normalized;
    }

    function pushItem(items, item) {
      if (!item || !item.date || !item.initiativeId) return;
      if (!scopeAllows(item.initiativeId)) return;
      items.push(item);
    }

    function itemMatchesFilter(item) {
      var typeMatch = true;
      if (timelineState.filter === 'planned') typeMatch = !item.isActivity;
      if (timelineState.filter === 'activity') typeMatch = !!item.isActivity;
      if (timelineState.filter === 'risk') typeMatch = !!item.isRisk;
      if (!typeMatch) return false;
      if (!itemMatchesLegend(item)) return false;
      if (timelineState.peopleFilter === 'unassigned') return !!item.unassigned;
      if (timelineState.peopleFilter && timelineState.peopleFilter !== 'all') return itemHasPerson(item, timelineState.peopleFilter);
      return true;
    }

    function legendKeyForItem(item) {
      if (!item || !item.type) return '';
      if (item.type === 'issue' || item.type === 'pull_request') return 'github';
      return item.type;
    }

    function legendKeyVisible(key) {
      return !key || !timelineState.hiddenLegendTypes || !timelineState.hiddenLegendTypes[key];
    }

    function itemMatchesLegend(item) {
      return legendKeyVisible(legendKeyForItem(item));
    }

    function addEntityDate(items, entity, cfg) {
      var d = validDate(cfg.date);
      if (!d) return;
      var person = cfg.person || null;
      var personIds = uniqueIds((cfg.personIds || []).concat(person && person.id ? [person.id] : []));
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
        unassigned: !!cfg.unassigned,
        person: person,
        personIds: personIds,
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
        var initPerson = resolveUser(init.createdBy, lookup) || resolveUser(getField(init, ['createdById', 'created_by_id']), lookup);
        addEntityDate(items, init, {
          id: 'initiative-created-' + init.id,
          type: 'initiative',
          entityType: 'initiative',
          initiativeId: init.id,
          date: init.createdAt,
          label: 'Initiative started',
          bucket: 'lifecycle',
          person: initPerson,
          personIds: uniqueIds([getField(init, ['createdById', 'created_by_id'])]),
          priority: 2,
          color: MARKER_COLORS.initiative
        });
      }

      for (var p = 0; p < timelineState.projects.length; p++) {
        var project = timelineState.projects[p];
        var projectInitId = getProjectInitiativeId(project);
        var projectPerson = projectPrimaryUser(project, lookup);
        addEntityDate(items, project, {
          id: 'project-created-' + project.id,
          type: 'project',
          entityType: 'project',
          initiativeId: projectInitId,
          projectId: project.id,
          date: project.createdAt,
          label: displayName(project),
          bucket: 'lifecycle',
          person: projectPerson,
          personIds: projectPersonIds(project),
          priority: statusIsActive(project.status) ? 1 : 3,
          color: MARKER_COLORS.project
        });
      }

      for (var t = 0; t < timelineState.tasks.length; t++) {
        var task = timelineState.tasks[t];
        var taskDue = validDate(task.dueDate || task.due_date);
        var taskProjectId = getTaskProjectId(task, lookup);
        var taskInitId = getTaskInitiativeId(task, lookup);
        var taskPerson = taskPrimaryUser(task, lookup);
        var taskUnassigned = taskIsUnassigned(task) && !statusIsDone(task.status) && !statusIsBacklog(task.status);
        if (taskDue && !statusIsBacklog(task.status)) {
          var overdue = taskDue < now && !statusIsDone(task.status) && !statusIsBacklog(task.status);
          addEntityDate(items, task, {
            id: 'task-due-' + task.id,
            type: overdue ? 'task_overdue' : 'task_due',
            entityType: 'task',
            initiativeId: taskInitId,
            projectId: taskProjectId,
            date: taskDue,
            label: displayName(task),
            bucket: 'planned',
            person: taskPerson,
            personIds: taskPersonIds(task),
            unassigned: taskUnassigned,
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
            person: taskPerson,
            personIds: taskPersonIds(task),
            unassigned: taskUnassigned,
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
        var eventPerson = eventPrimaryUser(evt, lookup);
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
          person: eventPerson,
          personIds: eventPersonIds(evt),
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

    function decisionRangeItems(lookup) {
      var items = [];
      for (var i = 0; i < timelineState.decisions.length; i++) {
        var decision = timelineState.decisions[i];
        var initId = getDecisionInitiativeId(decision, lookup);
        if (!scopeAllows(initId)) continue;
        var created = validDate(decision.createdAt);
        if (created) {
          items.push({ date: decisionDisplayStartDate(created) });
          var events = decisionStatusEvents(decision.id);
          var end = decisionFallbackEndDate(decision, events);
          if (end) items.push({ date: decisionDisplayEndDate(created, end) });
        }
      }
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
          decisionSpans: [],
          projects: 0,
          tasks: 0,
          decisions: 0,
          activeProjects: 0,
          overdueTasks: 0,
          nextTasks: 0,
          unassignedActive: 0,
          activePeople: {},
          lastActivity: null
        };
        lanes.push(laneMap[init.id]);
      }

      var range = buildRange(items.concat(decisionRangeItems(lookup)));
      var visibleItems = [];
      for (i = 0; i < items.length; i++) {
        if (laneMap[items[i].initiativeId] && itemMatchesFilter(items[i]) && itemInRange(items[i], range)) {
          laneMap[items[i].initiativeId].items.push(items[i]);
          visibleItems.push(items[i]);
        }
      }
      addDecisionSpans(laneMap, lookup, range);

      var now = startOfDay(new Date());
      var soon = addDays(now, 14);

      for (var p = 0; p < timelineState.projects.length; p++) {
        var pInitId = getProjectInitiativeId(timelineState.projects[p]);
        if (!laneMap[pInitId]) continue;
        laneMap[pInitId].projects++;
        if (statusIsActive(timelineState.projects[p].status)) {
          laneMap[pInitId].activeProjects++;
          addLanePerson(laneMap[pInitId], projectPrimaryUser(timelineState.projects[p], lookup));
        }
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
        if (!statusIsDone(task.status) && !statusIsBacklog(task.status)) {
          addLanePerson(laneMap[tInitId], taskPrimaryUser(task, lookup));
          if (taskIsUnassigned(task)) laneMap[tInitId].unassignedActive++;
          if (due) {
            if (due < now) laneMap[tInitId].overdueTasks++;
            else if (due <= soon) laneMap[tInitId].nextTasks++;
          }
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
        visibleItems: visibleItems,
        lanes: lanes,
        range: range
      };
    }

    function itemBounds(items) {
      var now = startOfDay(new Date());
      var min = addDays(now, -30);
      var max = addDays(now, 90);
      for (var i = 0; i < items.length; i++) {
        if (items[i].date < min) min = items[i].date;
        if (items[i].date > max) max = items[i].date;
      }
      return { min: startOfDay(min), max: startOfDay(max) };
    }

    function presetRange(items) {
      var now = startOfDay(new Date());
      var preset = timelineState.rangePreset || 'thisWeek';
      if (preset === 'today') return { min: now, max: endOfDay(now) };
      if (preset === 'thisWeek') {
        var weekStart = startOfWeek(now);
        return { min: weekStart, max: endOfDay(addDays(weekStart, 6)) };
      }
      if (preset === 'thisMonth') return { min: startOfMonth(now), max: endOfMonth(now) };
      if (preset === 'lastMonth') {
        var monthStart = startOfMonth(now);
        var lastMonthStart = addMonths(monthStart, -1);
        return { min: lastMonthStart, max: endOfDay(addDays(monthStart, -1)) };
      }
      if (preset === 'all') {
        var bounds = itemBounds(items);
        return { min: addDays(bounds.min, -14), max: addDays(bounds.max, 30) };
      }
      return { min: startOfWeek(now), max: endOfDay(addDays(startOfWeek(now), 6)) };
    }

    function selectedRange(items) {
      if (timelineState.rangePreset === 'custom') {
        var customStart = fromInputDate(timelineState.rangeStart, false);
        var customEnd = fromInputDate(timelineState.rangeEnd, true);
        if (customStart && customEnd) {
          if (customEnd.getTime() <= customStart.getTime()) {
            customEnd = addDays(customStart, 7);
          }
          return { min: customStart, max: customEnd };
        }
      }
      return presetRange(items);
    }

    function normalizeRange(min, max) {
      var start = startOfDay(min);
      var end = new Date(max.getTime());
      end.setHours(23, 59, 59, 999);
      if (end.getTime() <= start.getTime()) end = addDays(start, 7);
      var minSpan = DAY_MS - 1;
      if (end.getTime() - start.getTime() < minSpan) end = new Date(start.getTime() + minSpan);
      return { min: start, max: end };
    }

    function buildTimelineTicks(min, max, scale) {
      var ticks = [];
      var tick;
      var guard = 0;
      if (scale === 'quarter') tick = startOfQuarter(min);
      else if (scale === 'month') tick = startOfMonth(min);
      else if (scale === 'week') tick = startOfWeek(min);
      else tick = startOfDay(min);
      while (tick <= max && guard < 160) {
        ticks.push(new Date(tick.getTime()));
        if (scale === 'quarter') tick = addMonths(tick, 3);
        else if (scale === 'month') tick = addMonths(tick, 1);
        else if (scale === 'week') tick = addDays(tick, 7);
        else tick = addDays(tick, 1);
        guard++;
      }
      return ticks;
    }

    function buildHourTicks(min, max, scale, spanDays) {
      if ((scale !== 'day' && scale !== 'week') || spanDays > 8) return [];
      var ticks = [];
      var interval = spanDays <= 1 ? 1 : (spanDays <= 3 ? 3 : 6);
      var tick = startOfHour(min);
      if (tick.getTime() < min.getTime()) tick = addHours(tick, 1);
      var guard = 0;
      while (tick <= max && guard < 240) {
        if (tick.getHours() % interval === 0) ticks.push(new Date(tick.getTime()));
        tick = addHours(tick, 1);
        guard++;
      }
      return ticks;
    }

    function timelineWidthForSpan(spanDays, tickCount) {
      var pixelsPerDay = spanDays <= 30 ? 32 : (spanDays <= 120 ? 18 : (spanDays <= 365 ? 10 : 5));
      return Math.max(960, Math.min(6200, Math.round(Math.max(spanDays * pixelsPerDay, tickCount * 120))));
    }

    function buildRange(items) {
      var selected = selectedRange(items);
      var normalized = normalizeRange(selected.min, selected.max);
      var min = normalized.min;
      var max = normalized.max;
      var spanDays = Math.max(1, Math.round((max.getTime() - min.getTime()) / DAY_MS));
      var scale = spanDays > 420 ? 'quarter' : (spanDays > 120 ? 'month' : (spanDays > 21 ? 'week' : 'day'));
      var ticks = buildTimelineTicks(min, max, scale);
      var hourTicks = buildHourTicks(min, max, scale, spanDays);
      return {
        min: min,
        max: max,
        span: max.getTime() - min.getTime(),
        scale: scale,
        ticks: ticks,
        hourTicks: hourTicks,
        width: timelineWidthForSpan(spanDays, ticks.length)
      };
    }

    function rangeSpanDays(range) {
      if (!range || !range.span) return 1;
      return Math.max(1, Math.round(range.span / DAY_MS));
    }

    function rangeSupportsDayPan(range) {
      if (!range) return false;
      var days = rangeSpanDays(range);
      return days >= 1 && days <= 120;
    }

    function dateIsWithinRange(date, range) {
      if (!date || !range) return false;
      var time = date.getTime();
      return time >= range.min.getTime() && time <= range.max.getTime();
    }

    function timelinePanThreshold(range, surface) {
      var days = rangeSpanDays(range);
      var width = surface && surface.clientWidth ? surface.clientWidth : 960;
      return Math.max(16, Math.min(42, Math.round(width / Math.max(1, days * 3))));
    }

    function wheelDeltaPixels(evt, value) {
      if (!value) return 0;
      if (evt.deltaMode === 1) return value * 16;
      if (evt.deltaMode === 2) return value * 640;
      return value;
    }

    function horizontalPanDeltaFromWheel(evt) {
      var dx = wheelDeltaPixels(evt, evt.deltaX || 0);
      var dy = wheelDeltaPixels(evt, evt.deltaY || 0);
      if (Math.abs(dx) >= 1 && Math.abs(dx) >= Math.abs(dy) * 0.45) return dx;
      if (evt.shiftKey && Math.abs(dy) >= 1) return dy;
      return 0;
    }

    function eventPointWithinElement(evt, element) {
      if (!evt || !element || typeof evt.clientX !== 'number' || typeof evt.clientY !== 'number') return false;
      var rect = element.getBoundingClientRect();
      return evt.clientX >= rect.left
        && evt.clientX <= rect.right
        && evt.clientY >= rect.top
        && evt.clientY <= rect.bottom;
    }

    function decisionStatusEvents(decisionId) {
      var events = [];
      for (var i = 0; i < timelineState.timeline.length; i++) {
        var evt = timelineState.timeline[i];
        if (!evt || evt.decisionId !== decisionId) continue;
        if (normalizeStatus(evt.action) !== 'STATUS_CHANGED') continue;
        var date = validDate(evt.createdAt);
        if (!date) continue;
        events.push({
          date: date,
          from: eventStatusFrom(evt),
          to: eventStatusTo(evt)
        });
      }
      events.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
      return events;
    }

    function decisionInitialStatus(decision, events) {
      if (events && events.length && events[0].from) return events[0].from;
      return normalizeStatus(decision.status) === 'BACKLOG' ? 'BACKLOG' : 'DRAFT';
    }

    function decisionFallbackEndDate(decision, events) {
      var decided = validDate(decision.decidedAt || decision.decided_at);
      if (decided) return decided;
      var current = normalizeStatus(decision.status);
      if ((current === 'IMPLEMENTED' || current === 'REJECTED') && events && events.length) {
        return events[events.length - 1].date;
      }
      return new Date();
    }

    function decisionReachedStatusAt(decision, events, status) {
      var target = normalizeStatus(status);
      var created = validDate(decision.createdAt);
      if (!target || !created) return null;
      var initial = decisionInitialStatus(decision, events);
      if (initial === target) return created;
      for (var i = 0; i < events.length; i++) {
        if (events[i].to === target) return events[i].date;
      }
      if (normalizeStatus(decision.status) === target) {
        return validDate(decision.decidedAt || decision.decided_at) || validDate(decision.updatedAt || decision.updated_at) || created;
      }
      return null;
    }

    function decisionEndStatusRank(status) {
      var s = normalizeStatus(status);
      if (s === 'APPROVED') return 1;
      if (s === 'STAGED') return 2;
      if (s === 'IMPLEMENTED') return 3;
      return 0;
    }

    function decisionReachedEndStatusAt(decision, events, status) {
      var target = normalizeStatus(status);
      var created = validDate(decision.createdAt);
      if (!target || !created) return null;
      var exact = decisionReachedStatusAt(decision, events, target);
      if (exact) return { date: exact, status: target, inherited: false };

      var targetRank = decisionEndStatusRank(target);
      if (!targetRank) return null;

      var initial = decisionInitialStatus(decision, events);
      if (decisionEndStatusRank(initial) >= targetRank) {
        return { date: created, status: initial, inherited: initial !== target };
      }

      for (var i = 0; i < events.length; i++) {
        var eventStatus = normalizeStatus(events[i].to);
        if (decisionEndStatusRank(eventStatus) >= targetRank) {
          return { date: events[i].date, status: eventStatus || target, inherited: eventStatus !== target };
        }
      }

      var current = normalizeStatus(decision.status);
      if (decisionEndStatusRank(current) >= targetRank) {
        return {
          date: validDate(decision.decidedAt || decision.decided_at) || validDate(decision.updatedAt || decision.updated_at) || created,
          status: current,
          inherited: current !== target
        };
      }

      return null;
    }

    function decisionDisplayStartDate(d) {
      return startOfDay(d);
    }

    function decisionDisplayEndDate(startDate, endDate) {
      var start = decisionDisplayStartDate(startDate);
      var end = addDays(startOfDay(endDate), 1);
      if (end.getTime() <= start.getTime()) end = addDays(start, 1);
      return end;
    }

    function decisionSpanFor(decision, lookup, range) {
      var created = validDate(decision.createdAt);
      if (!created) return null;
      var events = decisionStatusEvents(decision.id);
      var startFilter = normalizeStatus(timelineState.decisionStartFilter);
      var endFilter = normalizeStatus(timelineState.decisionEndFilter);
      var startStatus = startFilter && startFilter !== 'ANY'
        ? startFilter
        : decisionInitialStatus(decision, events);
      var startDate = startFilter && startFilter !== 'ANY'
        ? decisionReachedStatusAt(decision, events, startFilter)
        : created;
      if (!startDate) return null;

      var currentStatus = normalizeStatus(decision.status);
      var endStatus = endFilter && endFilter !== 'ANY' ? endFilter : currentStatus;
      var endReached = true;
      var endMatch = endFilter && endFilter !== 'ANY'
        ? decisionReachedEndStatusAt(decision, events, endFilter)
        : null;
      var endDate = endFilter && endFilter !== 'ANY'
        ? (endMatch ? endMatch.date : null)
        : decisionFallbackEndDate(decision, events);
      if (endMatch && endMatch.status) endStatus = endMatch.status;
      if (!endDate && endFilter && endFilter !== 'ANY') {
        endReached = false;
        endDate = new Date();
      }
      if (!endDate) return null;
      if (endDate.getTime() < startDate.getTime()) return null;

      var displayStartDate = decisionDisplayStartDate(startDate);
      var displayEndDate = decisionDisplayEndDate(startDate, endDate);
      var actualStartDate = startOfMinute(startDate);
      var actualEndDate = startOfMinute(endDate);
      if (actualEndDate.getTime() <= actualStartDate.getTime()) actualEndDate = addMinutes(actualStartDate, 1);

      if (displayEndDate.getTime() < range.min.getTime() || displayStartDate.getTime() > range.max.getTime()) return null;

      var person = decisionPrimaryUser(decision, lookup);
      var personIds = decisionPersonIds(decision);
      if (!peopleFilterMatches(personIds, false)) return null;

      return {
        id: 'decision-span-' + decision.id + '-' + startStatus + '-' + endStatus,
        entityType: 'decision',
        entityId: decision.id,
        initiativeId: getDecisionInitiativeId(decision, lookup),
        startDate: startDate,
        endDate: endDate,
        displayStartDate: displayStartDate,
        displayEndDate: displayEndDate,
        actualStartDate: actualStartDate,
        actualEndDate: actualEndDate,
        startStatus: startStatus,
        endStatus: endStatus,
        requestedEndStatus: endFilter && endFilter !== 'ANY' ? endFilter : null,
        inheritedEndStatus: !!(endMatch && endMatch.inherited),
        endReached: endReached,
        currentStatus: currentStatus,
        label: displayName(decision),
        person: person,
        personIds: personIds
      };
    }

    function addDecisionSpans(laneMap, lookup, range) {
      if (timelineState.filter === 'activity') return;
      if (!legendKeyVisible('decision')) return;
      for (var i = 0; i < timelineState.decisions.length; i++) {
        var decision = timelineState.decisions[i];
        var initId = getDecisionInitiativeId(decision, lookup);
        if (!laneMap[initId]) continue;
        var span = decisionSpanFor(decision, lookup, range);
        if (span) laneMap[initId].decisionSpans.push(span);
      }
      for (var laneId in laneMap) {
        if (!Object.prototype.hasOwnProperty.call(laneMap, laneId)) continue;
        laneMap[laneId].decisionSpans.sort(function(a, b) {
          var diff = a.startDate.getTime() - b.startDate.getTime();
          if (diff !== 0) return diff;
          return a.endDate.getTime() - b.endDate.getTime();
        });
      }
    }

    function itemInRange(item, range) {
      if (!item || !item.date || !range) return false;
      return item.date.getTime() >= range.min.getTime() && item.date.getTime() <= range.max.getTime();
    }

    function positionForDate(date, range) {
      if (!date || !range || !range.span) return 0;
      var raw = ((date.getTime() - range.min.getTime()) / range.span) * 100;
      if (raw < 0) return 0;
      if (raw > 100) return 100;
      return raw;
    }

    function setCustomRangeDates(start, end) {
      var normalized = normalizeRange(start, end);
      timelineState.rangePreset = 'custom';
      timelineState.rangeStart = toInputDate(normalized.min);
      timelineState.rangeEnd = toInputDate(normalized.max);
      timelineState.rangePanRemainder = 0;
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
      var unassignedActive = 0;
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
        if (laneSet[initId] && (st === 'DRAFT' || st === 'PROPOSED' || st === 'IN_PROGRESS' || st === 'STAGED')) pendingDecisions++;
      }
      for (i = 0; i < timelineState.tasks.length; i++) {
        var task = timelineState.tasks[i];
        var taskInitId = getTaskInitiativeId(task, model.lookup);
        if (!laneSet[taskInitId] || statusIsDone(task.status) || statusIsBacklog(task.status)) continue;
        if (taskIsUnassigned(task)) unassignedActive++;
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
        unassignedActive: unassignedActive,
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

    function personCountsForModel(model) {
      var counts = {};
      var unassigned = 0;
      for (var i = 0; i < model.items.length; i++) {
        var item = model.items[i];
        if (item.unassigned) unassigned++;
        var ids = item.personIds || [];
        for (var j = 0; j < ids.length; j++) {
          counts[ids[j]] = (counts[ids[j]] || 0) + 1;
        }
      }
      return { counts: counts, unassigned: unassigned };
    }

    function renderFilterButton(attr, key, label, active, count) {
      return '<button ' + attr + '="' + UI.escapeHtml(key) + '" style="height:30px;padding:0 12px;'
        + 'border:1px solid ' + (active ? 'var(--accent-primary)' : 'var(--border-color)')
        + ';border-radius:8px;background:' + (active ? 'var(--accent-primary)' : 'var(--bg-surface)')
        + ';color:' + (active ? 'white' : 'var(--text-secondary)')
        + ';font-family:var(--font-sans);font-size:12px;cursor:pointer;white-space:nowrap;">'
        + UI.escapeHtml(label)
        + (count !== undefined ? ' <span style="opacity:0.78;">' + UI.escapeHtml(String(count)) + '</span>' : '')
        + '</button>';
    }

    function renderRangeButton(key, label) {
      var active = timelineState.rangePreset === key;
      return renderFilterButton('data-timeline-range-preset', key, label, active);
    }

    function renderRangeControls(model) {
      var startValue = toInputDate(model.range.min);
      var endValue = toInputDate(model.range.max);
      var html = '<div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;'
        + 'margin:var(--space-4) 0 0 0;">';
      html += renderRangeButton('today', 'Today');
      html += renderRangeButton('thisWeek', 'This week');
      html += renderRangeButton('thisMonth', 'This month');
      html += renderRangeButton('lastMonth', 'Last month');
      html += '<input id="decidr-timeline-range-start" aria-label="Timeline start date" type="date" value="' + UI.escapeHtml(startValue) + '" '
        + 'style="height:30px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface);'
        + 'color:var(--text-primary);font-family:var(--font-sans);font-size:12px;padding:0 9px;">';
      html += '<input id="decidr-timeline-range-end" aria-label="Timeline end date" type="date" value="' + UI.escapeHtml(endValue) + '" '
        + 'style="height:30px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface);'
        + 'color:var(--text-primary);font-family:var(--font-sans);font-size:12px;padding:0 9px;">';
      html += smallMeta(Math.max(1, Math.round(model.range.span / DAY_MS)) + ' days');
      html += '</div>';
      return html;
    }

    function renderDecisionSpanControls() {
      var startOptions = [
        ['any', 'Any start'],
        ['DRAFT', 'Draft'],
        ['BACKLOG', 'Backlog'],
        ['PROPOSED', 'Proposed'],
        ['APPROVED', 'Approved'],
        ['IN_PROGRESS', 'In progress'],
        ['STAGED', 'Staged']
      ];
      var endOptions = [
        ['any', 'Any end'],
        ['APPROVED', 'Approved'],
        ['STAGED', 'Staged'],
        ['IMPLEMENTED', 'Implemented']
      ];
      var html = '<div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;margin-top:var(--space-2);">';
      html += smallMeta('Decision spans');
      html += renderSpanSelect('decidr-timeline-span-start', 'Decision span start state', startOptions, timelineState.decisionStartFilter);
      html += renderSpanSelect('decidr-timeline-span-end', 'Decision span end state', endOptions, timelineState.decisionEndFilter);
      html += '</div>';
      return html;
    }

    function renderSpanSelect(id, label, options, value) {
      var html = '<select id="' + UI.escapeHtml(id) + '" aria-label="' + UI.escapeHtml(label) + '" '
        + 'style="height:30px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface);'
        + 'color:var(--text-secondary);font-family:var(--font-sans);font-size:12px;padding:0 9px;">';
      for (var i = 0; i < options.length; i++) {
        html += '<option value="' + UI.escapeHtml(options[i][0]) + '"'
          + (String(value) === String(options[i][0]) ? ' selected' : '') + '>'
          + UI.escapeHtml(options[i][1]) + '</option>';
      }
      html += '</select>';
      return html;
    }

    function renderPeopleControls(model) {
      var counts = personCountsForModel(model);
      var members = [];
      for (var i = 0; i < timelineState.members.length; i++) {
        var user = normalizeUser(timelineState.members[i]);
        if (!user || !user.id || !counts.counts[user.id]) continue;
        members.push({ user: user, count: counts.counts[user.id] });
      }
      members.sort(function(a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return userDisplayName(a.user).localeCompare(userDisplayName(b.user));
      });

      var html = '<div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;margin-top:var(--space-2);">';
      html += renderFilterButton('data-timeline-person-filter', 'all', 'All people', timelineState.peopleFilter === 'all');
      html += renderFilterButton(
        'data-timeline-person-filter',
        'unassigned',
        'Unassigned',
        timelineState.peopleFilter === 'unassigned',
        counts.unassigned
      );
      for (var m = 0; m < Math.min(8, members.length); m++) {
        html += renderFilterButton(
          'data-timeline-person-filter',
          members[m].user.id,
          truncate(userDisplayName(members[m].user), 18),
          timelineState.peopleFilter === members[m].user.id,
          members[m].count
        );
      }
      html += '</div>';
      return html;
    }

    function renderFilterControls(model) {
      var filters = [
        { key: 'all', label: 'All' },
        { key: 'planned', label: 'Planned' },
        { key: 'activity', label: 'Activity' },
        { key: 'risk', label: 'Risk' }
      ];
      var html = '<div style="margin:var(--space-5) 0 var(--space-3) 0;">'
        + '<div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;">';
      for (var i = 0; i < filters.length; i++) {
        var active = timelineState.filter === filters[i].key;
        html += renderFilterButton('data-timeline-filter', filters[i].key, filters[i].label, active);
      }
      html += '<span style="font-size:var(--text-small);color:var(--text-tertiary);">Hour ticks appear on day and week ranges</span>';
      html += '</div>';
      html += renderPeopleControls(model);
      html += renderDecisionSpanControls();
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
        + renderStat('Unassigned active', stats.unassignedActive, stats.unassignedActive ? 'risk' : 'normal')
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

      var dayPan = rangeSupportsDayPan(model.range);
      var scrollerStyle = dayPan
        ? 'overflow:hidden;overscroll-behavior:contain;max-width:100%;'
        : 'overflow-x:auto;overscroll-behavior:contain;max-width:100%;';
      var contentStyle = dayPan
        ? 'width:100%;min-width:0;'
        : 'min-width:' + model.range.width + 'px;width:100%;';
      var html = '<div style="border:1px solid var(--border-color);border-radius:8px;'
        + 'background:var(--bg-surface);overflow:hidden;">'
        + '<div data-timeline-board-scroll data-timeline-day-pan="' + (dayPan ? 'true' : 'false') + '" '
        + (dayPan ? 'title="Scroll horizontally to move the timeline by days" ' : '')
        + 'style="' + scrollerStyle + '">'
        + '<div style="' + contentStyle + '">'
        + renderTimelineHeader(model.range)
        + renderTimelineLanes(model)
        + '</div></div></div>';
      return html;
    }

    function renderTimelineHeader(range) {
      var now = new Date();
      var nowPct = positionForDate(now, range);
      var hasHourTicks = range.hourTicks && range.hourTicks.length;
      var headerHeight = hasHourTicks ? 66 : 48;
      var html = '<div style="display:grid;grid-template-columns:220px 1fr;border-bottom:1px solid var(--border-color);'
        + 'background:var(--bg-subtle);min-height:' + headerHeight + 'px;">'
        + '<div style="padding:14px var(--space-3);font-size:var(--text-small);font-weight:var(--weight-semibold);'
        + 'color:var(--text-secondary);border-right:1px solid var(--border-color);">Initiative</div>'
        + '<div style="position:relative;height:' + headerHeight + 'px;">';
      if (hasHourTicks) {
        for (var h = 0; h < range.hourTicks.length; h++) {
          var hourPct = positionForDate(range.hourTicks[h], range);
          html += '<div style="position:absolute;left:' + hourPct + '%;top:28px;bottom:0;border-left:1px solid rgba(148,163,184,0.16);"></div>'
            + '<div style="position:absolute;left:calc(' + hourPct + '% + 4px);top:42px;'
            + 'font-size:9px;color:var(--text-tertiary);white-space:nowrap;">'
            + UI.escapeHtml(formatHourTick(range.hourTicks[h])) + '</div>';
        }
      }
      for (var i = 0; i < range.ticks.length; i++) {
        var pct = positionForDate(range.ticks[i], range);
        html += '<div style="position:absolute;left:' + pct + '%;top:0;bottom:0;border-left:1px solid var(--border-color);"></div>'
          + '<div style="position:absolute;left:calc(' + pct + '% + 8px);top:' + (hasHourTicks ? '10' : '14') + 'px;'
          + 'font-size:11px;color:var(--text-secondary);white-space:nowrap;">'
          + UI.escapeHtml(formatTick(range.ticks[i], range.scale)) + '</div>';
      }
      if (dateIsWithinRange(now, range)) {
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
        var diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        return (a.priority || 3) - (b.priority || 3);
      });
      var visible = laneItems;
      var spanCount = lane.decisionSpans ? lane.decisionSpans.length : 0;
      var eventTop = 18;
      var eventRowHeight = 24;
      var spanRowHeight = 48;
      var spanTop = visible.length ? eventTop + visible.length * eventRowHeight + 12 : 28;
      var eventBottom = visible.length ? eventTop + visible.length * eventRowHeight + 18 : 70;
      var spanBottom = spanCount ? spanTop + spanCount * spanRowHeight + 20 : 0;
      var laneHeight = Math.max(104, eventBottom, spanBottom);

      var bg = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)';
      var html = '<div style="display:grid;grid-template-columns:220px 1fr;min-height:' + laneHeight + 'px;'
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
        + renderLanePeople(lane)
        + (lane.lastActivity ? '<div style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">Last activity '
          + UI.escapeHtml(UI.timeAgo(lane.lastActivity.date.toISOString())) + '</div>' : '')
        + '</div>';
      html += '<div style="position:relative;min-height:' + laneHeight + 'px;overflow:hidden;">';
      if (range.hourTicks && range.hourTicks.length) {
        for (var h = 0; h < range.hourTicks.length; h++) {
          var hourPct = positionForDate(range.hourTicks[h], range);
          html += '<div style="position:absolute;left:' + hourPct + '%;top:0;bottom:0;border-left:1px solid rgba(148,163,184,0.07);"></div>';
        }
      }
      for (var t = 0; t < range.ticks.length; t++) {
        var tickPct = positionForDate(range.ticks[t], range);
        html += '<div style="position:absolute;left:' + tickPct + '%;top:0;bottom:0;border-left:1px solid rgba(148,163,184,0.18);"></div>';
      }
      if (visible.length === 0 && spanCount === 0) {
        html += '<div style="position:absolute;left:24px;top:39px;font-size:12px;color:var(--text-tertiary);">'
          + 'No dated work yet</div>';
      } else {
        for (var i = 0; i < visible.length; i++) {
          html += renderMarker(visible[i], range, i);
        }
        if (spanCount) html += renderDecisionSpans(lane.decisionSpans, range, spanTop, spanRowHeight);
      }
      html += '</div></div>';
      return html;
    }

    function renderDecisionSpans(spans, range, topOffset, rowHeight) {
      var html = '';
      for (var i = 0; i < spans.length; i++) {
        html += renderDecisionSpan(spans[i], range, i, topOffset, rowHeight);
      }
      return html;
    }

    function decisionSpanMinWidth(span) {
      var label = span && span.label ? span.label : '';
      var time = span && span.startDate ? formatMinuteTime(span.startDate) : '';
      return Math.max(160, Math.min(680, Math.round((label.length * 6.2) + (time.length * 5.4) + 64)));
    }

    function timeWidthPx(start, end, range) {
      if (!range || !range.span || !range.width || end <= start) return 8;
      return Math.max(8, Math.round(((end - start) / range.span) * range.width));
    }

    function renderDecisionStartOverflow(span, color) {
      var startLabel = formatDateTime(span.startDate);
      return '<span title="' + UI.escapeHtml('Started before this view: ' + startLabel) + '" '
        + 'style="display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 6px 0 5px;'
        + 'border-radius:999px;border:1px solid rgba(148,163,184,0.28);border-left:2px solid ' + color + ';'
        + 'background:rgba(15,23,42,0.72);color:var(--text-secondary);font-size:9px;'
        + 'font-weight:var(--weight-medium);white-space:nowrap;flex:0 0 auto;">'
        + '&larr; ' + UI.escapeHtml(startLabel) + '</span>';
    }

    function renderDecisionSpan(span, range, idx, topOffset, rowHeight) {
      var displayStart = Math.max(span.displayStartDate.getTime(), range.min.getTime());
      var displayEnd = Math.min(span.displayEndDate.getTime(), range.max.getTime());
      var actualStart = Math.max(span.actualStartDate.getTime(), range.min.getTime());
      var actualEnd = Math.min(span.actualEndDate.getTime(), range.max.getTime());
      if (actualEnd <= actualStart) actualEnd = Math.min(displayEnd, actualStart + MINUTE_MS);
      if (actualEnd <= actualStart) actualEnd = actualStart + MINUTE_MS;
      var wrapperStart = actualStart;
      var wrapperEnd = actualEnd;
      if (wrapperEnd <= wrapperStart) wrapperEnd = wrapperStart + MINUTE_MS;
      var startPct = positionForDate(new Date(wrapperStart), range);
      var endPct = positionForDate(new Date(wrapperEnd), range);
      var labelMinWidth = decisionSpanMinWidth(span);
      var actualBarPx = timeWidthPx(actualStart, actualEnd, range);
      var actualWidthPct = Math.max(0.05, endPct - startPct);
      var actualBarStyle = 'left:0;top:4px;bottom:4px;width:' + actualBarPx + 'px;max-width:100%;min-width:8px;';
      var top = topOffset + idx * rowHeight;
      var color = decisionStatusColor(span.endReached ? span.endStatus : span.currentStatus);
      var startOverflow = span.actualStartDate.getTime() < range.min.getTime();
      var buttonBorder = 'rgba(148,163,184,0.24)';
      var buttonBackground = 'rgba(15,23,42,0.68)';
      var timeBarOpacity = '0.62';
      var buttonWidthStyle = 'width:max-content;min-width:' + Math.max(actualBarPx, labelMinWidth) + 'px;';
      var title = span.label + ' - ' + span.startStatus.replace(/_/g, ' ')
        + ' to ' + span.endStatus.replace(/_/g, ' ')
        + (span.inheritedEndStatus && span.requestedEndStatus
          ? ' (matches ' + span.requestedEndStatus.replace(/_/g, ' ') + ' filter)'
          : '')
        + (span.endReached ? '' : ' pending')
        + ' (' + formatDateTime(span.startDate) + ' - ' + formatDateTime(span.endDate) + ')';
      return '<button data-entity-type="decision" data-entity-id="' + UI.escapeHtml(span.entityId) + '" '
        + 'data-timeline-label-min-width="' + labelMinWidth + '" '
        + 'title="' + UI.escapeHtml(title) + '" '
        + 'style="position:absolute;left:' + startPct + '%;top:' + top + 'px;'
        + buttonWidthStyle + 'min-height:38px;border-radius:8px;'
        + 'border:1px solid ' + buttonBorder + ';background:' + buttonBackground + ';'
        + 'color:var(--text-primary);font-family:var(--font-sans);font-size:10px;'
        + 'display:flex;align-items:center;gap:7px;padding:7px 10px;overflow:visible;cursor:pointer;z-index:2;'
        + 'box-shadow:0 1px 0 rgba(15,23,42,0.08);">'
        + '<span aria-hidden="true" data-timeline-actual-bar="' + UI.escapeHtml(span.entityId) + '" '
        + 'data-timeline-actual-width-pct="' + actualWidthPct + '" '
        + 'style="position:absolute;' + actualBarStyle
        + 'border-radius:6px;background:' + color + ';opacity:' + timeBarOpacity + ';"></span>'
        + '<span style="position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;'
        + 'white-space:nowrap;min-width:max-content;">'
        + (startOverflow ? renderDecisionStartOverflow(span, color) : '')
        + renderDecisionBadge(color, 15, true)
        + '<span>' + UI.escapeHtml(span.label) + '</span>'
        + '<span style="color:var(--text-tertiary);font-size:9px;font-weight:var(--weight-medium);">'
        + UI.escapeHtml(formatMinuteTime(span.startDate)) + '</span>'
        + '</span>'
        + '</button>';
    }

    function decisionBadgeTextColor(color) {
      if (color === '#8b5cf6' || color === '#3b82f6' || color === '#ef4444' || color === '#64748b') return 'white';
      return '#0f172a';
    }

    function renderDecisionBadge(color, size, active) {
      var bg = active ? color : 'transparent';
      var fg = active ? decisionBadgeTextColor(color) : color;
      return '<span aria-hidden="true" style="width:' + size + 'px;height:' + size + 'px;'
        + 'border-radius:4px;border:1px solid ' + color + ';background:' + bg + ';color:' + fg + ';'
        + 'display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;'
        + 'font-size:' + (size <= 14 ? '8px' : '9px') + ';font-weight:var(--weight-semibold);'
        + 'line-height:1;letter-spacing:0;">D</span>';
    }

    function decisionStatusColor(status) {
      var s = normalizeStatus(status);
      if (s === 'IMPLEMENTED') return '#10b981';
      if (s === 'STAGED') return '#8b5cf6';
      if (s === 'APPROVED') return '#f59e0b';
      if (s === 'IN_PROGRESS') return '#3b82f6';
      if (s === 'PROPOSED') return '#06b6d4';
      if (s === 'BACKLOG') return '#94a3b8';
      if (s === 'REJECTED') return '#ef4444';
      return '#64748b';
    }

    function decisionStatusBackground(color) {
      if (color === '#10b981') return 'rgba(16,185,129,0.16)';
      if (color === '#8b5cf6') return 'rgba(139,92,246,0.16)';
      if (color === '#f59e0b') return 'rgba(245,158,11,0.16)';
      if (color === '#3b82f6') return 'rgba(59,130,246,0.16)';
      if (color === '#06b6d4') return 'rgba(6,182,212,0.16)';
      if (color === '#ef4444') return 'rgba(239,68,68,0.16)';
      return 'rgba(100,116,139,0.16)';
    }

    function smallMeta(text, color) {
      return '<span style="font-size:11px;color:' + (color || 'var(--text-secondary)') + ';'
        + 'border:1px solid var(--border-color);border-radius:999px;padding:2px 7px;'
        + 'background:var(--bg-surface);white-space:nowrap;">' + UI.escapeHtml(text) + '</span>';
    }

    function renderMiniUserChip(user, fallbackText) {
      var normalized = normalizeUser(user);
      var text = normalized ? userDisplayName(normalized) : (fallbackText || '');
      if (!text) return '';
      var initials = normalized ? userInitials(normalized) : text.charAt(0).toUpperCase();
      return '<span title="' + UI.escapeHtml(text) + '" style="display:inline-flex;align-items:center;gap:5px;'
        + 'min-width:0;border:1px solid var(--border-color);border-radius:999px;background:var(--bg-surface);'
        + 'color:var(--text-secondary);font-size:11px;line-height:18px;padding:1px 7px 1px 3px;max-width:136px;">'
        + '<span style="width:18px;height:18px;border-radius:999px;background:#475569;color:white;'
        + 'display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:var(--weight-semibold);flex:0 0 auto;">'
        + UI.escapeHtml(initials) + '</span>'
        + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
        + UI.escapeHtml(truncate(text, 18)) + '</span>'
        + '</span>';
    }

    function renderInitialsBadge(user, fallbackText) {
      var normalized = normalizeUser(user);
      var title = normalized ? userDisplayName(normalized) : (fallbackText || '');
      if (!title) return '';
      var initials = normalized ? userInitials(normalized) : title.charAt(0).toUpperCase();
      return '<span title="' + UI.escapeHtml(title) + '" style="width:17px;height:17px;border-radius:999px;'
        + 'background:#475569;color:white;display:inline-flex;align-items:center;justify-content:center;'
        + 'font-size:9px;font-weight:var(--weight-semibold);flex:0 0 auto;">'
        + UI.escapeHtml(initials) + '</span>';
    }

    function activePeopleForLane(lane) {
      var people = [];
      for (var id in lane.activePeople) {
        if (Object.prototype.hasOwnProperty.call(lane.activePeople, id)) people.push(lane.activePeople[id]);
      }
      people.sort(function(a, b) {
        return userDisplayName(a).localeCompare(userDisplayName(b));
      });
      return people;
    }

    function renderLanePeople(lane) {
      var people = activePeopleForLane(lane);
      var html = '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;align-items:center;">';
      for (var i = 0; i < Math.min(3, people.length); i++) {
        html += renderInitialsBadge(people[i]);
      }
      if (people.length > 3) html += smallMeta('+' + (people.length - 3));
      if (lane.unassignedActive) html += smallMeta(lane.unassignedActive + ' unassigned', '#ef4444');
      html += '</div>';
      return people.length || lane.unassignedActive ? html : '';
    }

    function renderMarker(item, range, idx) {
      var pct = positionForDate(item.date, range);
      var top = 18 + idx * 24;
      var color = item.color || MARKER_COLORS.activity;
      var label = truncate(item.label, 40);
      var dateLabel = UI.formatDate(item.date.toISOString());
      var personLabel = item.unassigned ? 'Unassigned' : userDisplayName(item.person);
      var title = dateLabel + ' - ' + item.label + (personLabel ? ' - ' + personLabel : '');
      var isDecision = item.type === 'decision';
      var markerSize = isDecision ? 16 : 14;
      var markerRadius = isDecision ? '4px' : '999px';
      var markerTop = isDecision ? top - 1 : top;
      var markerText = isDecision ? 'D' : '';
      var html = '<button data-entity-type="' + UI.escapeHtml(item.entityType) + '" '
        + 'data-entity-id="' + UI.escapeHtml(item.entityId) + '" '
        + (isDecision ? 'aria-label="' + UI.escapeHtml('Decision: ' + item.label) + '" ' : '')
        + 'title="' + UI.escapeHtml(title) + '" '
        + 'style="position:absolute;left:calc(' + pct + '% - ' + (markerSize / 2) + 'px);top:' + markerTop + 'px;'
        + 'width:' + markerSize + 'px;height:' + markerSize + 'px;border-radius:' + markerRadius + ';'
        + 'border:2px solid var(--bg-surface);background:' + color + ';box-shadow:0 0 0 1px rgba(0,0,0,0.12);'
        + 'color:' + (isDecision ? decisionBadgeTextColor(color) : 'transparent') + ';font-family:var(--font-sans);'
        + 'font-size:9px;font-weight:var(--weight-semibold);line-height:1;'
        + 'display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;z-index:2;">'
        + markerText + '</button>';
      html += '<div data-entity-type="' + UI.escapeHtml(item.entityType) + '" '
        + 'data-entity-id="' + UI.escapeHtml(item.entityId) + '" '
        + 'title="' + UI.escapeHtml(title) + '" '
        + 'style="position:absolute;left:calc(' + pct + '% + 10px);top:' + (top - 5) + 'px;'
        + 'max-width:220px;display:flex;align-items:center;gap:4px;'
        + 'font-size:11px;color:var(--text-secondary);cursor:pointer;z-index:2;">'
        + (item.unassigned ? renderInitialsBadge(null, 'Unassigned') : renderInitialsBadge(item.person))
        + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
        + UI.escapeHtml(label) + '</span></div>';
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
        if (!laneSet[taskInitId] || statusIsDone(task.status) || statusIsBacklog(task.status)) continue;
        var due = validDate(task.dueDate || task.due_date);
        if (!due) continue;
        var taskIds = taskPersonIds(task);
        var taskUnassigned = taskIsUnassigned(task);
        if (!peopleFilterMatches(taskIds, taskUnassigned)) continue;
        var taskPerson = taskPrimaryUser(task, model.lookup);
        var taskItem = {
          entityType: 'task',
          entityId: task.id,
          label: displayName(task),
          meta: 'Due ' + UI.formatDate(due.toISOString()),
          date: due,
          person: taskPerson,
          personIds: taskIds,
          unassigned: taskUnassigned
        };
        if (due < now) risk.push(taskItem);
        else if (due <= soon) next.push(taskItem);
      }

      for (i = 0; i < timelineState.decisions.length; i++) {
        var dec = timelineState.decisions[i];
        var decInitId = getDecisionInitiativeId(dec, model.lookup);
        if (!laneSet[decInitId]) continue;
        var status = normalizeStatus(dec.status);
        if (status === 'DRAFT' || status === 'PROPOSED' || status === 'IN_PROGRESS' || status === 'STAGED') {
          var decIds = decisionPersonIds(dec);
          if (!peopleFilterMatches(decIds, false)) continue;
          next.push({
            entityType: 'decision',
            entityId: dec.id,
            label: displayName(dec),
            meta: status.replace(/_/g, ' '),
            date: validDate(dec.createdAt) || now,
            person: decisionPrimaryUser(dec, model.lookup),
            personIds: decIds,
            unassigned: false
          });
        }
      }

      for (i = 0; i < model.items.length; i++) {
        if (model.items[i].isActivity && peopleFilterMatches(model.items[i].personIds, model.items[i].unassigned)) recent.push(model.items[i]);
      }
      recent.sort(function(a, b) { return b.date.getTime() - a.date.getTime(); });

      if (timelineState.peopleFilter === 'all') {
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
      var personChip = item.unassigned
        ? renderMiniUserChip(null, 'Unassigned')
        : renderMiniUserChip(item.person);
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
        + (personChip ? '<span style="display:block;margin-top:6px;">' + personChip + '</span>' : '')
        + '</span>'
        + '</div>';
    }

    function renderLegend() {
      var html = '<div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;'
        + 'font-size:11px;color:var(--text-secondary);margin:0 0 var(--space-3) 0;">';
      for (var i = 0; i < LEGEND_ENTRIES.length; i++) {
        html += renderLegendToggle(LEGEND_ENTRIES[i]);
      }
      html += '</div>';
      return html;
    }

    function renderLegendToggle(entry) {
      var active = legendKeyVisible(entry.key);
      return '<button type="button" data-timeline-legend-toggle="' + UI.escapeHtml(entry.key) + '" '
        + 'aria-pressed="' + (active ? 'true' : 'false') + '" '
        + 'title="' + UI.escapeHtml(entry.label) + '" '
        + 'style="height:26px;display:inline-flex;align-items:center;gap:6px;padding:0 9px;'
        + 'border:1px solid ' + (active ? 'var(--border-color)' : 'rgba(148,163,184,0.28)')
        + ';border-radius:999px;background:' + (active ? 'var(--bg-surface)' : 'transparent')
        + ';color:' + (active ? 'var(--text-secondary)' : 'var(--text-tertiary)')
        + ';font-family:var(--font-sans);font-size:11px;cursor:pointer;white-space:nowrap;'
        + 'opacity:' + (active ? '1' : '0.48') + ';">'
        + renderLegendIcon(entry, active)
        + UI.escapeHtml(entry.label) + '</button>';
    }

    function renderLegendIcon(entry, active) {
      if (entry.key === 'decision') return renderDecisionBadge(entry.color, 12, active);
      return '<span style="width:9px;height:9px;border-radius:999px;background:' + (active ? entry.color : 'transparent')
        + ';border:1px solid ' + entry.color + ';"></span>';
    }

    function renderTimeline() {
      var model = buildModel();
      timelineState.renderedRange = model.range;
      var html = '<div class="decidr-timeline-root" style="width:100%;max-width:1280px;box-sizing:border-box;'
        + 'margin:0 auto;padding:var(--space-6) var(--space-4);font-family:var(--font-sans);'
        + 'color:var(--text-primary);overflow-x:hidden;">';
      html += '<style>.decidr-timeline-root select{background-color:var(--bg-surface)!important;'
        + 'background-image:none!important;-webkit-appearance:none;appearance:none;box-shadow:none!important;}'
        + '.decidr-timeline-root,.decidr-timeline-root *{box-sizing:border-box;}'
        + '.decidr-timeline-root [data-timeline-board-scroll]{max-width:100%;}</style>';
      html += renderHeader(model);
      html += renderStats(model);
      html += renderRangeControls(model);
      html += renderFilterControls(model);
      html += renderLegend();
      html += renderTimelineBoard(model);
      html += renderScan(model);
      html += '</div>';
      container.innerHTML = html;
      calibrateDecisionActualBars();
      resetTimelineHorizontalScroll();
      wireInteractions();
    }

    function calibrateDecisionActualBars() {
      var bars = container.querySelectorAll('[data-timeline-actual-bar][data-timeline-actual-width-pct]');
      for (var i = 0; i < bars.length; i++) {
        var bar = bars[i];
        var pct = Number(bar.getAttribute('data-timeline-actual-width-pct'));
        if (!isFinite(pct) || pct <= 0) continue;
        var button = bar.closest ? bar.closest('button[data-entity-type="decision"]') : null;
        var rail = button ? button.parentElement : null;
        var railWidth = rail ? (rail.clientWidth || rail.getBoundingClientRect().width) : 0;
        if (!railWidth) continue;
        var actualWidth = Math.max(8, Math.round((pct / 100) * railWidth));
        var labelMinWidth = button ? Number(button.getAttribute('data-timeline-label-min-width')) : 0;
        bar.style.width = actualWidth + 'px';
        if (button && isFinite(labelMinWidth)) {
          button.style.minWidth = Math.max(actualWidth, labelMinWidth || 0) + 'px';
        }
      }
    }

    function resetTimelineHorizontalScroll() {
      var root = container.querySelector('.decidr-timeline-root');
      var node = root;
      while (node) {
        if (node.scrollLeft) node.scrollLeft = 0;
        node = node.parentElement;
      }
      var doc = container.ownerDocument || document;
      if (doc && doc.scrollingElement && doc.scrollingElement.scrollLeft) doc.scrollingElement.scrollLeft = 0;
      if (doc && doc.defaultView && doc.defaultView.scrollX) doc.defaultView.scrollTo(0, doc.defaultView.scrollY || 0);
      setTimeout(function() {
        var delayedRoot = container.querySelector('.decidr-timeline-root');
        var delayedNode = delayedRoot;
        while (delayedNode) {
          if (delayedNode.scrollLeft) delayedNode.scrollLeft = 0;
          delayedNode = delayedNode.parentElement;
        }
        var delayedDoc = container.ownerDocument || document;
        if (delayedDoc && delayedDoc.scrollingElement && delayedDoc.scrollingElement.scrollLeft) delayedDoc.scrollingElement.scrollLeft = 0;
        if (delayedDoc && delayedDoc.defaultView && delayedDoc.defaultView.scrollX) {
          delayedDoc.defaultView.scrollTo(0, delayedDoc.defaultView.scrollY || 0);
        }
      }, 0);
    }

    function wireInteractions() {
      wireScopeControls();
      wireRangeControls();
      wireTimelineDayPan();
      wireFilterControls();
      wirePeopleControls();
      wireDecisionSpanControls();
      wireLegendControls();
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

    function wireRangeControls() {
      var presetBtns = container.querySelectorAll('[data-timeline-range-preset]');
      for (var i = 0; i < presetBtns.length; i++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var preset = btn.getAttribute('data-timeline-range-preset');
            if (!preset || preset === timelineState.rangePreset) return;
            timelineState.rangePreset = preset;
            timelineState.rangeStart = null;
            timelineState.rangeEnd = null;
            timelineState.rangePanRemainder = 0;
            renderTimeline();
          });
        })(presetBtns[i]);
      }

      var startInput = container.querySelector('#decidr-timeline-range-start');
      var endInput = container.querySelector('#decidr-timeline-range-end');
      function applyCustomRange() {
        if (!startInput || !endInput || !startInput.value || !endInput.value) return;
        var start = fromInputDate(startInput.value, false);
        var end = fromInputDate(endInput.value, true);
        if (!start || !end) return;
        setCustomRangeDates(start, end);
        renderTimeline();
      }
      if (startInput) startInput.addEventListener('change', applyCustomRange);
      if (endInput) endInput.addEventListener('change', applyCustomRange);
    }

    function shiftTimelineRangeByDays(days) {
      var range = timelineState.renderedRange;
      if (!range || !days) return;
      setCustomRangeDates(addDays(range.min, days), addDays(range.max, days));
      timelineState.rangePanRemainder = 0;
      renderTimeline();
    }

    function consumeTimelinePanDelta(delta, threshold) {
      if (!delta) return;
      timelineState.rangePanRemainder = (timelineState.rangePanRemainder || 0) + delta;

      threshold = threshold || 32;
      var steps = 0;
      while (Math.abs(timelineState.rangePanRemainder) >= threshold) {
        if (timelineState.rangePanRemainder > 0) {
          steps++;
          timelineState.rangePanRemainder -= threshold;
        } else {
          steps--;
          timelineState.rangePanRemainder += threshold;
        }
      }

      if (steps) shiftTimelineRangeByDays(steps);
    }

    function wireTimelineDayPan() {
      if (timelineState.panWheelCleanup) {
        timelineState.panWheelCleanup();
        timelineState.panWheelCleanup = null;
      }

      var scroller = container.querySelector('[data-timeline-board-scroll]');
      var root = container.querySelector('.decidr-timeline-root');
      var range = timelineState.renderedRange;
      if (!root || !scroller || scroller.getAttribute('data-timeline-day-pan') !== 'true' || !rangeSupportsDayPan(range)) return;
      var doc = container.ownerDocument || document;

      function handleWheel(evt) {
        if (!evt || !evt.target || !root.contains(evt.target)) return;
        var target = evt.target.nodeType === 1 ? evt.target : evt.target.parentElement;
        var panSurface = target && target.closest ? target.closest('[data-timeline-board-scroll]') : null;
        if (!panSurface && eventPointWithinElement(evt, scroller)) panSurface = scroller;
        if (!panSurface || panSurface.getAttribute('data-timeline-day-pan') !== 'true') return;
        var horizontalDelta = horizontalPanDeltaFromWheel(evt);
        if (!horizontalDelta) return;

        evt.preventDefault();
        if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
        else evt.stopPropagation();
        consumeTimelinePanDelta(horizontalDelta, timelinePanThreshold(timelineState.renderedRange, panSurface));
      }

      doc.addEventListener('wheel', handleWheel, { passive: false, capture: true });
      timelineState.panWheelCleanup = function() {
        doc.removeEventListener('wheel', handleWheel, true);
      };
    }

    function wirePeopleControls() {
      var filterBtns = container.querySelectorAll('[data-timeline-person-filter]');
      for (var i = 0; i < filterBtns.length; i++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var filter = btn.getAttribute('data-timeline-person-filter');
            if (!filter || filter === timelineState.peopleFilter) return;
            timelineState.peopleFilter = filter;
            renderTimeline();
          });
        })(filterBtns[i]);
      }
    }

    function wireDecisionSpanControls() {
      var startSelect = container.querySelector('#decidr-timeline-span-start');
      var endSelect = container.querySelector('#decidr-timeline-span-end');
      if (startSelect) {
        startSelect.addEventListener('change', function() {
          timelineState.decisionStartFilter = startSelect.value || 'any';
          renderTimeline();
        });
      }
      if (endSelect) {
        endSelect.addEventListener('change', function() {
          timelineState.decisionEndFilter = endSelect.value || 'any';
          renderTimeline();
        });
      }
    }

    function wireLegendControls() {
      var legendBtns = container.querySelectorAll('[data-timeline-legend-toggle]');
      for (var i = 0; i < legendBtns.length; i++) {
        (function(btn) {
          btn.addEventListener('click', function() {
            var key = btn.getAttribute('data-timeline-legend-toggle');
            if (!key) return;
            if (timelineState.hiddenLegendTypes[key]) delete timelineState.hiddenLegendTypes[key];
            else timelineState.hiddenLegendTypes[key] = true;
            renderTimeline();
          });
        })(legendBtns[i]);
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

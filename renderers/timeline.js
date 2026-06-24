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
    var PROJECT_GROUP_X_INSET = 10;
    var DECISION_MIN_VISIBLE_WIDTH = 36;
    var MARKER_COLORS = {
      task_due: '#10b981',
      task_overdue: '#ef4444',
      project: '#2563eb',
      decision: '#f59e0b',
      bridge: '#0d9488',
      issue: '#ef4444',
      pull_request: '#0369a1',
      activity: '#38bdf8',
      initiative: '#10b981'
    };
    var USER_COLOR_PALETTE = [
      '#2563eb',
      '#16a34a',
      '#dc2626',
      '#0891b2',
      '#ca8a04',
      '#ea580c',
      '#0d9488',
      '#65a30d',
      '#0284c7',
      '#be123c',
      '#475569',
      '#0369a1'
    ];

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
      windowCache: {},
      windowLoadSeq: 0,
      loadingWindow: false,
      windowError: null,
      loadedWindowKey: null,
      lanePositions: {},
      scrollTop: 0,
      viewportTop: 0,
      viewportBottom: 0,
      stickyLegendTop: null,
      stickyLegendLeft: null,
      stickyLegendRight: null,
      stickyLegendAnchorTop: null,
      stickyLegendHeight: null,
      stickyLegendDocked: false,
      stickyLegendCleanup: null,
      virtualScrollCleanup: null,
      virtualScrollFrame: null,
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

    function responseTotal(resp) {
      if (!resp) return null;
      if (typeof resp.total === 'number') return resp.total;
      if (resp.meta && typeof resp.meta.total === 'number') return resp.meta.total;
      if (resp.meta && typeof resp.meta.total_count === 'number') return resp.meta.total_count;
      return null;
    }

    function responseHasMore(resp, items, skip, take) {
      if (resp && resp.has_more !== undefined) return !!resp.has_more;
      if (resp && resp.meta && resp.meta.has_more !== undefined) return !!resp.meta.has_more;
      var total = responseTotal(resp);
      if (typeof total === 'number') return skip + items.length < total;
      return items.length >= take;
    }

    function fetchAllPages(fetchFn, opts) {
      opts = opts || {};
      var pageSize = opts.take || 200;
      var maxItems = opts.max || 1200;
      var baseParams = opts.params || {};
      var skip = opts.skip || 0;
      var all = [];

      function loadNextPage() {
        var remaining = maxItems - all.length;
        if (remaining <= 0) return Promise.resolve(all);
        var take = Math.min(pageSize, remaining);
        var params = {};
        for (var key in baseParams) {
          if (Object.prototype.hasOwnProperty.call(baseParams, key)) params[key] = baseParams[key];
        }
        params.skip = skip;
        params.take = take;
        return fetchFn(params).then(function(resp) {
          var page = unwrapList(resp);
          for (var i = 0; i < page.length && all.length < maxItems; i++) {
            all.push(page[i]);
          }
          var pageSkip = skip;
          skip += page.length;
          if (!page.length || all.length >= maxItems || !responseHasMore(resp, page, pageSkip, take)) {
            return all;
          }
          return loadNextPage();
        });
      }

      return loadNextPage();
    }

    function fetchTimelineData() {
      var fetched = {};
      return API.resolveAndBindTargetOrg({
        pushedOrgId: (data && data.organization_id) ? data.organization_id : null
      }).then(function(preflight) {
        fetched.organizations = preflight.organizations || [];
        fetched.defaultOrgId = preflight.defaultOrgId || null;
        fetched.activeOrgId = preflight.activeOrgId || API.getActiveOrgId();
        timelineState.organizations = fetched.organizations || [];
        timelineState.defaultOrgId = fetched.defaultOrgId || null;
        timelineState.activeOrgId = fetched.activeOrgId || API.getActiveOrgId();
        if (!timelineState.activeOrgId && timelineState.organizations.length) {
          timelineState.activeOrgId = timelineState.organizations[0].id;
        }
        return loadTimelineWindow({ force: true, renderOnStart: false, renderOnComplete: false });
      });
    }

    function payloadFromWindowResponse(resp) {
      if (!resp) return {};
      if (resp.data && !Array.isArray(resp.data)) return resp.data;
      return resp;
    }

    function applyTimelineWindowPayload(payload) {
      payload = payloadFromWindowResponse(payload);
      timelineState.initiatives = payload.initiatives || [];
      timelineState.projects = payload.projects || [];
      timelineState.decisions = payload.decisions || [];
      timelineState.tasks = payload.tasks || [];
      timelineState.bridges = payload.bridges || [];
      timelineState.issues = payload.issues || [];
      timelineState.prs = payload.prs || [];
      timelineState.members = payload.people || payload.members || [];
      timelineState.timeline = payload.timelineEvents || payload.timeline || [];
      timelineState.windowTotals = payload.totals || {};
      timelineState.windowRange = payload.range || null;
    }

    function currentWindowRange() {
      var selected = selectedRange([]);
      return normalizeRange(selected.min, selected.max);
    }

    function windowCacheKey(range) {
      var initiativePart = timelineState.scope === 'initiative' && timelineState.selectedInitiativeId
        ? timelineState.selectedInitiativeId
        : 'all';
      var personPart = timelineState.peopleFilter && timelineState.peopleFilter !== 'all' && timelineState.peopleFilter !== 'unassigned'
        ? timelineState.peopleFilter
        : 'all';
      return [
        timelineState.activeOrgId || 'org',
        toInputDate(range.min),
        toInputDate(range.max),
        initiativePart,
        personPart,
        timelineState.decisionStartFilter || 'any',
        timelineState.decisionEndFilter || 'any'
      ].join('|');
    }

    function windowRequestParams(range) {
      var params = {
        from: range.min.toISOString(),
        to: range.max.toISOString(),
        bufferDays: 7,
        take: 200
      };
      if (timelineState.scope === 'initiative' && timelineState.selectedInitiativeId) {
        params.initiativeId = timelineState.selectedInitiativeId;
      }
      if (timelineState.peopleFilter && timelineState.peopleFilter !== 'all' && timelineState.peopleFilter !== 'unassigned') {
        params.personId = timelineState.peopleFilter;
      }
      if (timelineState.decisionStartFilter && timelineState.decisionStartFilter !== 'any') {
        params.decisionStart = timelineState.decisionStartFilter;
      }
      if (timelineState.decisionEndFilter && timelineState.decisionEndFilter !== 'any') {
        params.decisionEnd = timelineState.decisionEndFilter;
      }
      return params;
    }

    function mergeUniqueRows(baseRows, nextRows) {
      var rows = [];
      var seen = {};
      var i;
      baseRows = baseRows || [];
      nextRows = nextRows || [];
      for (i = 0; i < baseRows.length; i++) {
        if (!baseRows[i] || !baseRows[i].id) {
          rows.push(baseRows[i]);
          continue;
        }
        seen[baseRows[i].id] = true;
        rows.push(baseRows[i]);
      }
      for (i = 0; i < nextRows.length; i++) {
        if (!nextRows[i] || !nextRows[i].id || !seen[nextRows[i].id]) {
          if (nextRows[i] && nextRows[i].id) seen[nextRows[i].id] = true;
          rows.push(nextRows[i]);
        }
      }
      return rows;
    }

    function mergeTimelineWindowPayload(base, next) {
      base = payloadFromWindowResponse(base);
      next = payloadFromWindowResponse(next);
      var merged = {};
      var key;
      for (key in base) {
        if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key];
      }
      var entityKeys = ['initiatives', 'projects', 'decisions', 'tasks', 'bridges', 'issues', 'prs', 'people', 'members'];
      for (var i = 0; i < entityKeys.length; i++) {
        key = entityKeys[i];
        merged[key] = mergeUniqueRows(base[key], next[key]);
      }
      merged.timelineEvents = mergeUniqueRows(base.timelineEvents || base.timeline, next.timelineEvents || next.timeline);
      merged.timeline = merged.timelineEvents;
      merged.nextCursor = next.nextCursor || null;
      merged.truncated = !!next.truncated;
      if (next.totals) merged.totals = next.totals;
      return merged;
    }

    function fetchTimelineWindowPages(params, payload, depth) {
      payload = payloadFromWindowResponse(payload);
      if (!payload.nextCursor || depth >= 10) return Promise.resolve(payload);
      var nextParams = {};
      for (var key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) nextParams[key] = params[key];
      }
      nextParams.cursor = payload.nextCursor;
      return API.getTimelineWindow(nextParams).then(function(resp) {
        var merged = mergeTimelineWindowPayload(payload, resp);
        return fetchTimelineWindowPages(nextParams, merged, depth + 1);
      });
    }

    function loadTimelineWindow(opts) {
      opts = opts || {};
      var range = currentWindowRange();
      var key = windowCacheKey(range);
      if (!opts.force && timelineState.windowCache[key]) {
        applyTimelineWindowPayload(timelineState.windowCache[key]);
        timelineState.loadedWindowKey = key;
        timelineState.windowError = null;
        if (opts.renderOnComplete) renderTimeline();
        return Promise.resolve(timelineState.windowCache[key]);
      }

      var seq = ++timelineState.windowLoadSeq;
      timelineState.loadingWindow = true;
      timelineState.windowError = null;
      if (opts.renderOnStart) renderTimeline();

      var params = windowRequestParams(range);
      return API.getTimelineWindow(params).then(function(resp) {
        return fetchTimelineWindowPages(params, resp, 0);
      }).then(function(resp) {
        if (seq !== timelineState.windowLoadSeq) return resp;
        var payload = payloadFromWindowResponse(resp);
        timelineState.windowCache[key] = payload;
        timelineState.loadedWindowKey = key;
        applyTimelineWindowPayload(payload);
        timelineState.loadingWindow = false;
        timelineState.windowError = null;
        if (!timelineState.selectedInitiativeId && timelineState.initiatives.length) {
          timelineState.selectedInitiativeId = timelineState.initiatives[0].id;
        }
        if (opts.renderOnComplete) renderTimeline();
        return payload;
      }).catch(function(err) {
        if (seq !== timelineState.windowLoadSeq) return null;
        timelineState.loadingWindow = false;
        timelineState.windowError = err;
        if (opts.renderOnComplete) renderTimeline();
        throw err;
      });
    }

    function reloadTimelineWindow(opts) {
      opts = opts || {};
      return loadTimelineWindow({
        force: !!opts.force,
        renderOnStart: opts.renderOnStart !== false,
        renderOnComplete: true
      }).catch(function(err) {
        console.error('[decidr] Timeline window load failed:', err);
      });
    }

    function refreshTimeline() {
      container.innerHTML = '<div style="padding:var(--space-6);">'
        + UI.loadingSpinner('Refreshing timeline...')
        + '</div>';
      timelineState.windowCache = {};
      return loadTimelineWindow({ force: true, renderOnStart: false, renderOnComplete: false }).then(function() {
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
      var email = getField(user, ['email']);
      var name = getField(user, ['name', 'displayName', 'display_name', 'email']);
      return {
        id: id || null,
        name: name || (id ? String(id).slice(0, 8) : ''),
        email: email || null,
        image: getField(user, ['image', 'avatar', 'avatarUrl', 'avatar_url']) || null,
        color: getField(user, ['color', 'avatarColor', 'avatar_color', 'timelineColor', 'timeline_color']) || null,
        initials: getField(user, ['initials']) || null
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
          email: user.email || member.email || null,
          image: user.image || member.image || null,
          color: user.color || member.color || null,
          initials: user.initials || member.initials || null
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
      var first = '';
      var last = '';
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        if (!first) first = parts[i];
        last = parts[i];
      }
      if (!first) return '?';
      if (first === last) return first.charAt(0).toUpperCase();
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }

    function hashString(value) {
      var text = String(value || '');
      var hash = 0;
      for (var i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    }

    function sanitizeTimelineColor(color) {
      if (!color) return null;
      if (UI && UI.sanitizeColor) return UI.sanitizeColor(color);
      return String(color);
    }

    function preferredUserColor(user) {
      var normalized = normalizeUser(user);
      if (!normalized) return USER_COLOR_PALETTE[0];
      var supplied = sanitizeTimelineColor(normalized.color);
      if (supplied) return supplied;
      return USER_COLOR_PALETTE[hashString((normalized.id || '') + '|' + userDisplayName(normalized)) % USER_COLOR_PALETTE.length];
    }

    function makeUserColorState(memberMap) {
      var state = {
        colors: {},
        initialsColorOwner: {}
      };
      var members = [];
      for (var id in memberMap) {
        if (Object.prototype.hasOwnProperty.call(memberMap, id)) members.push(memberMap[id]);
      }
      members.sort(function(a, b) {
        return userDisplayName(a).localeCompare(userDisplayName(b));
      });
      for (var i = 0; i < members.length; i++) {
        assignUserColor(members[i], state);
      }
      return state;
    }

    function assignUserColor(user, state) {
      var normalized = normalizeUser(user);
      if (!normalized) return USER_COLOR_PALETTE[0];
      var userId = normalized.id || userDisplayName(normalized) || '?';
      if (state && state.colors && state.colors[userId]) return state.colors[userId];

      var initials = userInitials(normalized);
      var preferred = preferredUserColor(normalized);
      var color = preferred;
      if (state) {
        state.initialsColorOwner[initials] = state.initialsColorOwner[initials] || {};
        var used = state.initialsColorOwner[initials];
        if (used[color] && used[color] !== userId) {
          var start = hashString(userId + '|' + userDisplayName(normalized)) % USER_COLOR_PALETTE.length;
          for (var i = 0; i < USER_COLOR_PALETTE.length; i++) {
            var candidate = USER_COLOR_PALETTE[(start + i) % USER_COLOR_PALETTE.length];
            if (!used[candidate] || used[candidate] === userId) {
              color = candidate;
              break;
            }
          }
        }
        if (state.colors) state.colors[userId] = color;
        used[color] = userId;
      }
      return color;
    }

    function timelineUserColor(user, lookup) {
      var normalized = normalizeUser(user);
      if (!normalized) return '#475569';
      if (lookup && lookup.userColorState) return assignUserColor(normalized, lookup.userColorState);
      return preferredUserColor(normalized);
    }

    function decorateTimelineUser(user, lookup) {
      var normalized = normalizeUser(user);
      if (!normalized) return null;
      normalized.initials = userInitials(normalized);
      normalized.color = timelineUserColor(normalized, lookup);
      return normalized;
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

    function eventOccurredDate(evt) {
      if (!evt) return null;
      return validDate(evt.occurredAt || evt.occurred_at || evt.createdAt);
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
      return getField(project, ['initiativeId', 'initiative_id'])
        || getField(project && project.initiative, ['id'])
        || getField(project && project.parentInitiative, ['id']);
    }

    function buildLookup() {
      var projectMap = makeMap(timelineState.projects);
      var decisionMap = makeMap(timelineState.decisions);
      var taskMap = makeMap(timelineState.tasks);
      var bridgeMap = makeMap(timelineState.bridges);
      var initiativeMap = makeMap(timelineState.initiatives);
      var memberMap = makeMemberMap(timelineState.members);
      var userColorState = makeUserColorState(memberMap);
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
        userColorState: userColorState,
        projectToInitiative: projectToInitiative
      };
    }

    function getDecisionProjectId(decision) {
      var direct = getField(decision, ['projectId', 'project_id']);
      if (direct) return direct;
      var nestedProjectId = getField(decision && decision.project, ['id']);
      if (nestedProjectId) return nestedProjectId;
      var et = String(getField(decision, ['entityType', 'entity_type']) || '').toUpperCase();
      if (et === 'PROJECT') return getField(decision, ['entityId', 'entity_id']);
      return null;
    }

    function getDecisionInitiativeId(decision, lookup) {
      var direct = getField(decision, ['initiativeId', 'initiative_id']);
      if (direct) return direct;
      var nestedInitiativeId = getField(decision && decision.initiative, ['id']);
      if (nestedInitiativeId) return nestedInitiativeId;
      var nestedProjectInitId = getProjectInitiativeId(decision && decision.project);
      if (nestedProjectInitId) return nestedProjectInitId;
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

    function eventIsCatchUp(evt) {
      var metadata = eventMetadata(evt);
      return metadata.catchUp === true || normalizeStatus(metadata.kind) === 'CATCH_UP';
    }

    function isCatchUpDecision(decision) {
      return normalizeStatus(getField(decision, ['kind', 'decisionKind', 'decision_kind'])) === 'CATCH_UP';
    }

    function decisionAnchorStartDate(decision, events) {
      if (isCatchUpDecision(decision)) {
        if (events && events.length) {
          for (var i = 0; i < events.length; i++) {
            if (events[i].catchUp) return events[i].date;
          }
          return events[0].date;
        }
        return validDate(decision.decidedAt || decision.decided_at)
          || validDate(decision.updatedAt || decision.updated_at)
          || validDate(decision.createdAt);
      }
      return validDate(decision.createdAt);
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

    function addLanePerson(lane, user, lookup) {
      var normalized = decorateTimelineUser(user, lookup);
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
      var personColor = cfg.personColor || (person && person.color ? sanitizeTimelineColor(person.color) : null);
      var personInitials = cfg.personInitials || (person ? (person.initials || userInitials(person)) : '');
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
        personColor: personColor,
        personInitials: personInitials,
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
        var initPerson = decorateTimelineUser(
          resolveUser(init.createdBy, lookup) || resolveUser(getField(init, ['createdById', 'created_by_id']), lookup),
          lookup
        );
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
        var projectPerson = decorateTimelineUser(projectPrimaryUser(project, lookup), lookup);
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
        var taskPerson = decorateTimelineUser(taskPrimaryUser(task, lookup), lookup);
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
        var evtDate = eventOccurredDate(evt);
        if (!info || !evtDate) continue;
        var eventPerson = decorateTimelineUser(eventPrimaryUser(evt, lookup), lookup);
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
        var events = decisionStatusEvents(decision.id);
        var start = decisionAnchorStartDate(decision, events);
        if (start) {
          items.push({ date: decisionDisplayStartDate(start) });
          var end = decisionFallbackEndDate(decision, events);
          if (end) items.push({ date: decisionDisplayEndDate(start, end) });
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
          addLanePerson(laneMap[pInitId], projectPrimaryUser(timelineState.projects[p], lookup), lookup);
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
          addLanePerson(laneMap[tInitId], taskPrimaryUser(task, lookup), lookup);
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
      if (Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.25) return dx;
      if (evt.shiftKey && Math.abs(dy) >= 8) return dy;
      return 0;
    }

    function decisionStatusEvents(decisionId) {
      var events = [];
      for (var i = 0; i < timelineState.timeline.length; i++) {
        var evt = timelineState.timeline[i];
        if (!evt || evt.decisionId !== decisionId) continue;
        if (normalizeStatus(evt.action) !== 'STATUS_CHANGED') continue;
        var date = eventOccurredDate(evt);
        if (!date) continue;
        events.push({
          date: date,
          from: eventStatusFrom(evt),
          to: eventStatusTo(evt),
          catchUp: eventIsCatchUp(evt)
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
      var anchor = decisionAnchorStartDate(decision, events);
      if (!target || !anchor) return null;
      var initial = decisionInitialStatus(decision, events);
      if (initial === target) return anchor;
      for (var i = 0; i < events.length; i++) {
        if (events[i].to === target) return events[i].date;
      }
      if (normalizeStatus(decision.status) === target) {
        return validDate(decision.decidedAt || decision.decided_at) || validDate(decision.updatedAt || decision.updated_at) || anchor;
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
      var anchor = decisionAnchorStartDate(decision, events);
      if (!target || !anchor) return null;
      var exact = decisionReachedStatusAt(decision, events, target);
      if (exact) return { date: exact, status: target, inherited: false };

      var targetRank = decisionEndStatusRank(target);
      if (!targetRank) return null;

      var initial = decisionInitialStatus(decision, events);
      if (decisionEndStatusRank(initial) >= targetRank) {
        return { date: anchor, status: initial, inherited: initial !== target };
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
          date: validDate(decision.decidedAt || decision.decided_at) || validDate(decision.updatedAt || decision.updated_at) || anchor,
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
      var events = decisionStatusEvents(decision.id);
      var anchor = decisionAnchorStartDate(decision, events);
      if (!anchor) return null;
      var startFilter = normalizeStatus(timelineState.decisionStartFilter);
      var endFilter = normalizeStatus(timelineState.decisionEndFilter);
      var startStatus = startFilter && startFilter !== 'ANY'
        ? startFilter
        : decisionInitialStatus(decision, events);
      var startDate = startFilter && startFilter !== 'ANY'
        ? decisionReachedStatusAt(decision, events, startFilter)
        : anchor;
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

      var person = decorateTimelineUser(decisionPrimaryUser(decision, lookup), lookup);
      var personIds = decisionPersonIds(decision);
      if (!peopleFilterMatches(personIds, false)) return null;
      var personColor = person ? timelineUserColor(person, lookup) : MARKER_COLORS.decision;
      var personInitials = person ? userInitials(person) : 'D';

      return {
        id: 'decision-span-' + decision.id + '-' + startStatus + '-' + endStatus,
        entityType: 'decision',
        entityId: decision.id,
        initiativeId: getDecisionInitiativeId(decision, lookup),
        projectId: getDecisionProjectId(decision),
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
        kind: getField(decision, ['kind', 'decisionKind', 'decision_kind']),
        person: person,
        personIds: personIds,
        personColor: personColor,
        personInitials: personInitials
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
        ? 'overflow:hidden;overscroll-behavior-x:contain;overscroll-behavior-y:auto;max-width:100%;'
        : 'overflow-x:auto;overscroll-behavior-x:contain;overscroll-behavior-y:auto;max-width:100%;';
      var contentStyle = dayPan
        ? 'width:100%;min-width:0;'
        : 'min-width:' + model.range.width + 'px;width:100%;';
      var html = '<div style="border:1px solid var(--border-color);border-radius:8px;'
        + 'background:var(--decidr-timeline-board-bg);overflow:hidden;'
        + 'box-shadow:var(--decidr-timeline-board-shadow);">'
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
        + 'background:var(--decidr-timeline-header-bg);min-height:' + headerHeight + 'px;">'
        + '<div style="padding:14px var(--space-3);font-size:var(--text-small);font-weight:var(--weight-semibold);'
        + 'color:var(--text-secondary);border-right:1px solid var(--border-color);">Initiative</div>'
        + '<div style="position:relative;height:' + headerHeight + 'px;">';
      if (hasHourTicks) {
        for (var h = 0; h < range.hourTicks.length; h++) {
          var hourPct = positionForDate(range.hourTicks[h], range);
          html += '<div style="position:absolute;left:' + hourPct + '%;top:28px;bottom:0;border-left:1px solid var(--decidr-timeline-hour-grid);"></div>'
            + '<div style="position:absolute;left:calc(' + hourPct + '% + 4px);top:42px;'
            + 'font-size:9px;color:var(--text-tertiary);white-space:nowrap;">'
            + UI.escapeHtml(formatHourTick(range.hourTicks[h])) + '</div>';
        }
      }
      for (var i = 0; i < range.ticks.length; i++) {
        var pct = positionForDate(range.ticks[i], range);
        html += '<div style="position:absolute;left:' + pct + '%;top:0;bottom:0;border-left:1px solid var(--decidr-timeline-grid);"></div>'
          + '<div style="position:absolute;left:calc(' + pct + '% + 8px);top:' + (hasHourTicks ? '10' : '14') + 'px;'
          + 'font-size:11px;color:var(--text-secondary);white-space:nowrap;">'
          + UI.escapeHtml(formatTick(range.ticks[i], range.scale)) + '</div>';
      }
      if (dateIsWithinRange(now, range)) {
        html += '<div style="position:absolute;left:' + nowPct + '%;top:0;bottom:0;border-left:2px solid var(--decidr-timeline-now);"></div>'
          + '<div style="position:absolute;left:calc(' + nowPct + '% + 6px);bottom:4px;'
          + 'font-size:10px;color:var(--decidr-timeline-now);font-weight:var(--weight-semibold);">Now</div>';
      }
      html += '</div></div>';
      return html;
    }

    function renderTimelineLanes(model) {
      var html = '';
      for (var i = 0; i < model.lanes.length; i++) {
        html += renderLane(model.lanes[i], model.range, i, model.lookup);
      }
      return html;
    }

    function updateTimelineViewport() {
      var metrics = timelineScrollMetrics();
      var scrollTop = metrics.scrollTop || 0;
      var height = metrics.height || 900;
      timelineState.scrollTop = scrollTop;
      timelineState.viewportTop = Math.max(0, scrollTop - 900);
      timelineState.viewportBottom = scrollTop + height + 900;
    }

    function timelineScrollMetrics() {
      var doc = container.ownerDocument || document;
      var win = doc.defaultView || window;
      var scrolling = doc.scrollingElement || doc.documentElement || doc.body;
      var scrollTop = win.pageYOffset !== undefined ? win.pageYOffset : (scrolling ? scrolling.scrollTop : 0);
      var height = win.innerHeight || 900;
      var node = container;

      while (node && node.nodeType === 1) {
        var nodeScrollTop = Number(node.scrollTop || 0);
        var canScroll = node.scrollHeight > node.clientHeight + 1;
        if (canScroll && nodeScrollTop > scrollTop) {
          scrollTop = nodeScrollTop;
          height = node.clientHeight || height;
        }
        node = node.parentElement;
      }

      return { scrollTop: scrollTop || 0, height: height || 900 };
    }

    function timelineScrollTargets() {
      var doc = container.ownerDocument || document;
      var win = doc.defaultView || window;
      var targets = [win];
      var scrolling = doc.scrollingElement || doc.documentElement || doc.body;
      if (scrolling) targets.push(scrolling);

      var node = container;
      while (node && node.nodeType === 1) {
        if (node.scrollHeight > node.clientHeight + 1) targets.push(node);
        node = node.parentElement;
      }

      var unique = [];
      for (var i = 0; i < targets.length; i++) {
        if (unique.indexOf(targets[i]) === -1) unique.push(targets[i]);
      }
      return unique;
    }

    function laneRowShouldRender(laneId, rowTop, rowHeight) {
      var laneTop = timelineState.lanePositions[laneId];
      if (laneTop === undefined || laneTop === null) {
        return rowTop < 2600;
      }
      var absTop = laneTop + rowTop;
      var absBottom = absTop + rowHeight;
      return absBottom >= timelineState.viewportTop && absTop <= timelineState.viewportBottom;
    }

    function measureLanePositions() {
      var scrollTop = timelineScrollMetrics().scrollTop || 0;
      var lanes = container.querySelectorAll('[data-timeline-lane-id]');
      var positions = {};
      for (var i = 0; i < lanes.length; i++) {
        var id = lanes[i].getAttribute('data-timeline-lane-id');
        if (!id) continue;
        positions[id] = lanes[i].getBoundingClientRect().top + scrollTop;
      }
      timelineState.lanePositions = positions;
    }

    function wireVirtualScroll() {
      if (timelineState.virtualScrollCleanup) {
        timelineState.virtualScrollCleanup();
        timelineState.virtualScrollCleanup = null;
      }
      measureLanePositions();
      var doc = container.ownerDocument || document;
      var win = doc.defaultView || window;
      var raf = win.requestAnimationFrame || function(fn) { return setTimeout(fn, 16); };
      var caf = win.cancelAnimationFrame || clearTimeout;
      function onScrollOrResize() {
        if (timelineState.virtualScrollFrame) return;
        timelineState.virtualScrollFrame = raf(function() {
          timelineState.virtualScrollFrame = null;
          updateTimelineViewport();
          renderTimeline();
        });
      }
      win.addEventListener('scroll', onScrollOrResize, { passive: true });
      win.addEventListener('resize', onScrollOrResize);
      var scrollTargets = timelineScrollTargets();
      for (var i = 0; i < scrollTargets.length; i++) {
        if (scrollTargets[i] !== win) scrollTargets[i].addEventListener('scroll', onScrollOrResize, { passive: true });
      }
      timelineState.virtualScrollCleanup = function() {
        win.removeEventListener('scroll', onScrollOrResize);
        win.removeEventListener('resize', onScrollOrResize);
        for (var i = 0; i < scrollTargets.length; i++) {
          if (scrollTargets[i] !== win) scrollTargets[i].removeEventListener('scroll', onScrollOrResize);
        }
        if (timelineState.virtualScrollFrame) {
          caf(timelineState.virtualScrollFrame);
          timelineState.virtualScrollFrame = null;
        }
      };
    }

    function wireStickyLegendDocking() {
      if (timelineState.stickyLegendCleanup) {
        timelineState.stickyLegendCleanup();
        timelineState.stickyLegendCleanup = null;
      }

      var doc = container.ownerDocument || document;
      var win = doc.defaultView || window;
      var targets = timelineScrollTargets();
      var interval = win.setInterval(function() {
        calibrateTimelineStickyLegendOffset();
      }, 160);

      function onScrollOrResize() {
        calibrateTimelineStickyLegendOffset();
      }

      win.addEventListener('resize', onScrollOrResize);
      for (var i = 0; i < targets.length; i++) {
        targets[i].addEventListener('scroll', onScrollOrResize, { passive: true });
      }

      timelineState.stickyLegendCleanup = function() {
        win.clearInterval(interval);
        win.removeEventListener('resize', onScrollOrResize);
        for (var i = 0; i < targets.length; i++) {
          targets[i].removeEventListener('scroll', onScrollOrResize);
        }
      };
    }

    function projectGroupKey(projectId) {
      return projectId ? 'project:' + projectId : 'initiative-level';
    }

    function projectGroupLabel(group, lookup) {
      if (!group || !group.projectId) return 'Initiative-level work';
      var project = lookup && lookup.projects ? lookup.projects[group.projectId] : null;
      return project ? displayName(project) : 'Project ' + truncate(group.projectId, 10);
    }

    function projectGroupStatus(group, lookup) {
      if (!group || !group.projectId || !lookup || !lookup.projects) return '';
      var project = lookup.projects[group.projectId];
      return project ? normalizeStatus(project.status).replace(/_/g, ' ') : '';
    }

    function ensureProjectGroup(groupsByKey, groups, projectId) {
      var key = projectGroupKey(projectId);
      if (!groupsByKey[key]) {
        groupsByKey[key] = {
          key: key,
          projectId: projectId || null,
          items: [],
          decisionSpans: [],
          earliest: null,
          top: 0,
          height: 0
        };
        groups.push(groupsByKey[key]);
      }
      return groupsByKey[key];
    }

    function rememberProjectGroupDate(group, date) {
      if (!group || !date) return;
      if (!group.earliest || date.getTime() < group.earliest.getTime()) group.earliest = date;
    }

    function buildLaneProjectGroups(lane, lookup) {
      var groups = [];
      var groupsByKey = {};
      var laneItems = lane.items.slice().sort(function(a, b) {
        var diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        return (a.priority || 3) - (b.priority || 3);
      });
      var spans = (lane.decisionSpans || []).slice().sort(function(a, b) {
        var diff = a.startDate.getTime() - b.startDate.getTime();
        if (diff !== 0) return diff;
        return a.endDate.getTime() - b.endDate.getTime();
      });

      for (var i = 0; i < laneItems.length; i++) {
        var itemGroup = ensureProjectGroup(groupsByKey, groups, laneItems[i].projectId);
        itemGroup.items.push(laneItems[i]);
        rememberProjectGroupDate(itemGroup, laneItems[i].date);
      }
      for (var s = 0; s < spans.length; s++) {
        var spanGroup = ensureProjectGroup(groupsByKey, groups, spans[s].projectId);
        spanGroup.decisionSpans.push(spans[s]);
        rememberProjectGroupDate(spanGroup, spans[s].startDate);
      }

      groups.sort(function(a, b) {
        if (!a.projectId && b.projectId) return -1;
        if (a.projectId && !b.projectId) return 1;
        var aTime = a.earliest ? a.earliest.getTime() : 0;
        var bTime = b.earliest ? b.earliest.getTime() : 0;
        if (aTime !== bTime) return aTime - bTime;
        return projectGroupLabel(a, lookup).localeCompare(projectGroupLabel(b, lookup));
      });
      return groups;
    }

    function measureProjectGroups(groups) {
      var top = 12;
      var headerHeight = 42;
      var eventRowHeight = 24;
      var spanRowHeight = 48;
      for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var eventCount = group.items.length;
        var spanCount = group.decisionSpans.length;
        var eventTop = top + headerHeight + 10;
        var spanTop = eventCount ? eventTop + eventCount * eventRowHeight + 14 : top + headerHeight + 12;
        var eventBottom = eventCount ? eventTop + eventCount * eventRowHeight + 12 : top + headerHeight + 42;
        var spanBottom = spanCount ? spanTop + spanCount * spanRowHeight + 16 : 0;
        group.top = top;
        group.headerHeight = headerHeight;
        group.eventTop = eventTop;
        group.eventRowHeight = eventRowHeight;
        group.spanTop = spanTop;
        group.spanRowHeight = spanRowHeight;
        group.height = Math.max(98, eventBottom - top, spanBottom ? spanBottom - top : 0);
        top += group.height + 14;
      }
      return Math.max(116, top + 2);
    }

    function renderProjectGroupHeader(group, lookup, top, idx) {
      var label = projectGroupLabel(group, lookup);
      var status = projectGroupStatus(group, lookup);
      var decisionCount = group.decisionSpans.length;
      var eventCount = group.items.length;
      var meta = [];
      if (decisionCount) meta.push(decisionCount + ' decision' + (decisionCount === 1 ? '' : 's'));
      if (eventCount) meta.push(eventCount + ' event' + (eventCount === 1 ? '' : 's'));
      var attrs = group.projectId
        ? 'data-entity-type="project" data-entity-id="' + UI.escapeHtml(group.projectId) + '" '
        : '';
      var accent = group.projectId ? MARKER_COLORS.project : MARKER_COLORS.initiative;
      var accentRing = group.projectId ? 'rgba(59,130,246,0.14)' : 'rgba(34,197,94,0.14)';
      var sectionBg = idx % 2 === 0
        ? 'var(--decidr-timeline-project-section-bg)'
        : 'var(--decidr-timeline-project-section-alt-bg)';
      var headerBg = idx % 2 === 0
        ? 'var(--decidr-timeline-project-header-bg)'
        : 'var(--decidr-timeline-project-header-alt-bg)';
      var html = '<div aria-hidden="true" '
        + 'style="position:absolute;left:10px;right:10px;top:' + top + 'px;height:' + group.height + 'px;'
        + 'border:1px solid var(--decidr-timeline-project-border);border-left:3px solid ' + accent + ';'
        + 'border-radius:8px;background:' + sectionBg + ';'
        + 'box-shadow:var(--decidr-timeline-project-shadow);z-index:1;pointer-events:none;"></div>';
      html += '<div ' + attrs
        + 'style="position:absolute;left:10px;right:10px;top:' + top + 'px;height:' + group.headerHeight + 'px;'
        + 'display:flex;align-items:center;gap:10px;padding:0 12px 0 14px;'
        + 'border-top-left-radius:8px;border-top-right-radius:8px;border-bottom:1px solid var(--decidr-timeline-project-header-border);'
        + 'background:' + headerBg + ';color:var(--text-secondary);font-size:11px;z-index:3;'
        + (group.projectId ? 'cursor:pointer;' : '') + '">'
        + '<span style="width:8px;height:8px;border-radius:999px;background:' + accent + ';'
        + 'box-shadow:0 0 0 3px ' + accentRing + ';flex:0 0 auto;"></span>'
        + '<span data-project-group-label="true" style="font-weight:var(--weight-semibold);color:var(--text-primary);'
        + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(420px,44vw);">'
        + UI.escapeHtml(truncate(label, 68)) + '</span>'
        + (status ? '<span style="font-size:10px;color:var(--text-tertiary);text-transform:capitalize;white-space:nowrap;">'
          + UI.escapeHtml(status.toLowerCase()) + '</span>' : '')
        + (meta.length ? '<span style="font-size:10px;color:var(--text-tertiary);white-space:nowrap;">'
          + UI.escapeHtml(meta.join(' / ')) + '</span>' : '')
        + '</div>';
      return html;
    }

    function renderLane(lane, range, idx, lookup) {
      var init = lane.initiative;
      var groups = buildLaneProjectGroups(lane, lookup);
      var laneHeight = groups.length ? measureProjectGroups(groups) : 104;

      var bg = idx % 2 === 0 ? 'var(--decidr-timeline-lane-bg)' : 'var(--decidr-timeline-lane-alt-bg)';
      var html = '<div data-timeline-lane-id="' + UI.escapeHtml(init.id) + '" '
        + 'style="display:grid;grid-template-columns:220px 1fr;min-height:' + laneHeight + 'px;'
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
          html += '<div style="position:absolute;left:' + hourPct + '%;top:0;bottom:0;border-left:1px solid var(--decidr-timeline-hour-grid-soft);"></div>';
        }
      }
      for (var t = 0; t < range.ticks.length; t++) {
        var tickPct = positionForDate(range.ticks[t], range);
        html += '<div style="position:absolute;left:' + tickPct + '%;top:0;bottom:0;border-left:1px solid var(--decidr-timeline-grid);"></div>';
      }
      if (!groups.length) {
        html += '<div style="position:absolute;left:24px;top:39px;font-size:12px;color:var(--text-tertiary);">'
          + 'No dated work yet</div>';
      } else {
        for (var g = 0; g < groups.length; g++) {
          var group = groups[g];
          if (laneRowShouldRender(init.id, group.top - 4, group.height + 8)) {
            html += renderProjectGroupHeader(group, lookup, group.top, g);
          }
          for (var i = 0; i < group.items.length; i++) {
            var itemTop = group.eventTop + i * group.eventRowHeight;
            if (laneRowShouldRender(init.id, itemTop - 12, group.eventRowHeight + 24)) {
              html += renderMarker(group.items[i], range, i, itemTop);
            }
          }
          if (group.decisionSpans.length) {
            html += renderDecisionSpans(group.decisionSpans, range, group.spanTop, group.spanRowHeight, init.id);
          }
        }
      }
      html += '</div></div>';
      return html;
    }

    function renderDecisionSpans(spans, range, topOffset, rowHeight, laneId) {
      var html = '';
      for (var i = 0; i < spans.length; i++) {
        if (laneRowShouldRender(laneId, topOffset + i * rowHeight - 8, rowHeight + 16)) {
          html += renderDecisionSpan(spans[i], range, i, topOffset, rowHeight);
        }
      }
      return html;
    }

    function decisionSpanMinWidth(span) {
      var label = span && span.label ? span.label : '';
      var time = span && span.startDate ? formatMinuteTime(span.startDate) : '';
      var kindExtra = span && normalizeStatus(span.kind) === 'CATCH_UP' ? 58 : 0;
      return Math.max(160, Math.min(760, Math.round((label.length * 6.2) + (time.length * 5.4) + 64 + kindExtra)));
    }

    function timeWidthPx(start, end, range) {
      if (!range || !range.span || !range.width || end <= start) return 8;
      return Math.max(8, Math.round(((end - start) / range.span) * range.width));
    }

    function renderDecisionStartOverflow(span, color) {
      var startLabel = formatDateTime(span.startDate);
      return '<span title="' + UI.escapeHtml('Started before this view: ' + startLabel) + '" '
        + 'style="display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 6px 0 5px;'
        + 'border-radius:999px;border:1px solid var(--decidr-timeline-pill-border);border-left:2px solid ' + color + ';'
        + 'background:var(--decidr-timeline-overflow-bg);color:var(--text-secondary);font-size:9px;'
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
      var statusColor = decisionStatusColor(span.endReached ? span.endStatus : span.currentStatus);
      var color = span.personColor || statusColor;
      var startOverflow = span.actualStartDate.getTime() < range.min.getTime();
      var buttonBorder = 'var(--decidr-timeline-decision-border)';
      var buttonBackground = 'var(--decidr-timeline-decision-bg)';
      var timeBarOpacity = 'var(--decidr-timeline-time-bar-opacity)';
      var desiredButtonWidth = Math.max(actualBarPx, labelMinWidth);
      var buttonWidthStyle = 'left:calc(' + PROJECT_GROUP_X_INSET + 'px + ' + startPct + '%);'
        + 'width:' + desiredButtonWidth + 'px;min-width:0;'
        + 'max-width:max(' + DECISION_MIN_VISIBLE_WIDTH + 'px,calc(100% - '
        + (PROJECT_GROUP_X_INSET * 2) + 'px - ' + startPct + '%));';
      var catchUp = normalizeStatus(span.kind) === 'CATCH_UP';
      var ownerName = span.person ? userDisplayName(span.person) : '';
      var title = span.label + ' - ' + span.startStatus.replace(/_/g, ' ')
        + ' to ' + span.endStatus.replace(/_/g, ' ')
        + (ownerName ? ' - Owner: ' + ownerName : '')
        + (catchUp ? ' (catch-up)' : '')
        + (span.inheritedEndStatus && span.requestedEndStatus
          ? ' (matches ' + span.requestedEndStatus.replace(/_/g, ' ') + ' filter)'
          : '')
        + (span.endReached ? '' : ' pending')
        + ' (' + formatDateTime(span.startDate) + ' - ' + formatDateTime(span.endDate) + ')';
      return '<button data-entity-type="decision" data-entity-id="' + UI.escapeHtml(span.entityId) + '" '
        + 'data-timeline-label-min-width="' + labelMinWidth + '" '
        + 'data-timeline-start-pct="' + startPct + '" '
        + 'data-timeline-desired-width="' + desiredButtonWidth + '" '
        + 'title="' + UI.escapeHtml(title) + '" '
        + 'style="position:absolute;top:' + top + 'px;'
        + buttonWidthStyle + 'min-height:38px;border-radius:8px;'
        + 'border:1px solid ' + buttonBorder + ';background:' + buttonBackground + ';'
        + 'color:var(--text-primary);font-family:var(--font-sans);font-size:10px;'
        + 'display:flex;align-items:center;gap:7px;padding:7px 10px;overflow:hidden;cursor:pointer;z-index:2;'
        + 'box-shadow:var(--decidr-timeline-decision-shadow);">'
        + '<span aria-hidden="true" data-timeline-actual-bar="' + UI.escapeHtml(span.entityId) + '" '
        + 'data-timeline-actual-width-pct="' + actualWidthPct + '" '
        + 'style="position:absolute;' + actualBarStyle
        + 'border-radius:6px;background:' + color + ';opacity:' + timeBarOpacity + ';"></span>'
        + '<span style="position:relative;z-index:1;display:inline-flex;align-items:center;gap:7px;'
        + 'white-space:nowrap;min-width:0;max-width:100%;overflow:hidden;">'
        + (startOverflow ? renderDecisionStartOverflow(span, color) : '')
        + renderDecisionBadge(color, 21, true, span.personInitials || '?', ownerName)
        + (catchUp ? '<span class="decidr-badge decidr-decision-kind-catch-up">Catch-up</span>' : '')
        + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;">' + UI.escapeHtml(span.label) + '</span>'
        + '<span style="color:var(--text-tertiary);font-size:9px;font-weight:var(--weight-medium);">'
        + UI.escapeHtml(formatMinuteTime(span.startDate)) + '</span>'
        + '</span>'
        + '</button>';
    }

    function decisionBadgeTextColor(color) {
      var hex = String(color || '').replace('#', '');
      if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
      }
      if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        var r = parseInt(hex.substring(0, 2), 16) / 255;
        var g = parseInt(hex.substring(2, 4), 16) / 255;
        var b = parseInt(hex.substring(4, 6), 16) / 255;
        var luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
        return luminance < 0.56 ? 'white' : '#0f172a';
      }
      if (color === '#0369a1' || color === '#2563eb' || color === '#3b82f6' || color === '#ef4444' || color === '#64748b') return 'white';
      return '#0f172a';
    }

    function renderDecisionBadge(color, size, active, label, title) {
      var bg = active ? color : 'transparent';
      var fg = active ? decisionBadgeTextColor(color) : color;
      var text = label || '';
      return '<span aria-hidden="true" '
        + (title ? 'title="' + UI.escapeHtml(title) + '" ' : '')
        + 'style="width:' + size + 'px;height:' + size + 'px;'
        + 'border-radius:4px;border:1px solid ' + color + ';background:' + bg + ';color:' + fg + ';'
        + 'display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;'
        + 'font-size:' + (size <= 14 ? '8px' : '9px') + ';font-weight:var(--weight-semibold);'
        + 'line-height:1;letter-spacing:0;">' + UI.escapeHtml(text) + '</span>';
    }

    function decisionStatusColor(status) {
      var s = normalizeStatus(status);
      if (s === 'IMPLEMENTED') return '#10b981';
      if (s === 'STAGED') return '#0d9488';
      if (s === 'APPROVED') return '#f59e0b';
      if (s === 'IN_PROGRESS') return '#3b82f6';
      if (s === 'PROPOSED') return '#06b6d4';
      if (s === 'BACKLOG') return '#94a3b8';
      if (s === 'REJECTED') return '#ef4444';
      return '#64748b';
    }

    function decisionStatusBackground(color) {
      if (color === '#10b981') return 'rgba(16,185,129,0.16)';
      if (color === '#0d9488') return 'rgba(13,148,136,0.16)';
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
      var initials = normalized ? (normalized.initials || userInitials(normalized)) : text.charAt(0).toUpperCase();
      var color = (normalized && normalized.color) ? sanitizeTimelineColor(normalized.color) : '#475569';
      return '<span title="' + UI.escapeHtml(text) + '" style="display:inline-flex;align-items:center;gap:5px;'
        + 'min-width:0;border:1px solid var(--border-color);border-radius:999px;background:var(--bg-surface);'
        + 'color:var(--text-secondary);font-size:11px;line-height:18px;padding:1px 7px 1px 3px;max-width:136px;">'
        + '<span style="width:18px;height:18px;border-radius:999px;background:' + color + ';color:' + decisionBadgeTextColor(color) + ';'
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
      var initials = normalized ? (normalized.initials || userInitials(normalized)) : title.charAt(0).toUpperCase();
      var color = (normalized && normalized.color) ? sanitizeTimelineColor(normalized.color) : '#475569';
      return '<span title="' + UI.escapeHtml(title) + '" style="width:17px;height:17px;border-radius:999px;'
        + 'background:' + color + ';color:' + decisionBadgeTextColor(color) + ';display:inline-flex;align-items:center;justify-content:center;'
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

    function renderMarker(item, range, idx, topOverride) {
      var pct = positionForDate(item.date, range);
      var top = topOverride === undefined || topOverride === null ? 18 + idx * 24 : topOverride;
      var color = item.color || MARKER_COLORS.activity;
      var label = truncate(item.label, 40);
      var dateLabel = UI.formatDate(item.date.toISOString());
      var personLabel = item.unassigned ? 'Unassigned' : userDisplayName(item.person);
      var title = dateLabel + ' - ' + item.label + (personLabel ? ' - ' + personLabel : '');
      var isDecision = item.type === 'decision';
      if (isDecision && item.personColor) color = item.personColor;
      var markerSize = isDecision ? 20 : 14;
      var markerRadius = isDecision ? '4px' : '999px';
      var markerTop = isDecision ? top - 3 : top;
      var markerText = isDecision ? (item.personInitials || (item.person ? userInitials(item.person) : 'D')) : '';
      var html = '<button data-entity-type="' + UI.escapeHtml(item.entityType) + '" '
        + 'data-entity-id="' + UI.escapeHtml(item.entityId) + '" '
        + (isDecision ? 'aria-label="' + UI.escapeHtml('Decision: ' + item.label) + '" ' : '')
        + 'title="' + UI.escapeHtml(title) + '" '
        + 'style="position:absolute;left:calc(' + pct + '% - ' + (markerSize / 2) + 'px);top:' + markerTop + 'px;'
        + 'width:' + markerSize + 'px;height:' + markerSize + 'px;border-radius:' + markerRadius + ';'
        + 'border:2px solid var(--decidr-timeline-marker-stroke);background:' + color + ';'
        + 'box-shadow:var(--decidr-timeline-marker-shadow);'
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
        var taskPerson = decorateTimelineUser(taskPrimaryUser(task, model.lookup), model.lookup);
        var taskItem = {
          entityType: 'task',
          entityId: task.id,
          label: displayName(task),
          meta: 'Due ' + UI.formatDate(due.toISOString()),
          date: due,
          person: taskPerson,
          personIds: taskIds,
          color: taskPerson ? timelineUserColor(taskPerson, model.lookup) : null,
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
          var decPerson = decorateTimelineUser(decisionPrimaryUser(dec, model.lookup), model.lookup);
          next.push({
            entityType: 'decision',
            entityId: dec.id,
            label: displayName(dec),
            meta: status.replace(/_/g, ' '),
            date: validDate(dec.createdAt) || now,
            person: decPerson,
            personIds: decIds,
            color: decPerson ? timelineUserColor(decPerson, model.lookup) : MARKER_COLORS.decision,
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
      var color = item.color || (tone === 'risk' ? '#ef4444' : (tone === 'next' ? '#10b981' : '#2563eb'));
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
      var docked = timelineLegendDocked();
      var shellStyle = docked
        ? 'height:' + timelineLegendHeightCss() + ';margin:0 0 var(--space-3) 0;'
        : '';
      var legendPosition = docked
        ? 'position:fixed;top:var(--decidr-timeline-sticky-top, 8px);left:var(--decidr-timeline-legend-left, 20px);right:var(--decidr-timeline-legend-right, 20px);'
        : 'position:sticky;top:var(--decidr-timeline-sticky-top, 8px);';
      var html = '<div data-timeline-legend-sentinel style="height:1px;margin:0;padding:0;"></div>'
        + '<div data-timeline-sticky-legend-shell style="' + shellStyle + '">'
        + '<div data-timeline-sticky-legend style="' + legendPosition + 'z-index:120;'
        + 'display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;'
        + 'font-size:11px;color:var(--text-secondary);margin:' + (docked ? '0' : '0 0 var(--space-3) 0') + ';'
        + 'padding:7px;border:1px solid var(--decidr-timeline-legend-border);border-radius:10px;'
        + 'background:var(--decidr-timeline-legend-bg);box-shadow:var(--decidr-timeline-legend-shadow);'
        + 'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);max-width:100%;overflow-x:auto;'
        + 'overscroll-behavior-x:contain;">';
      for (var i = 0; i < LEGEND_ENTRIES.length; i++) {
        html += renderLegendToggle(LEGEND_ENTRIES[i]);
      }
      html += '</div></div>';
      return html;
    }

    function stickyLegendTopCss() {
      var top = Number(timelineState.stickyLegendTop);
      return isFinite(top) && top > 0 ? Math.round(top) + 'px' : '8px';
    }

    function timelineLegendDocked() {
      if (timelineState.stickyLegendDocked) return true;
      var top = Number(timelineState.stickyLegendTop);
      var anchorTop = Number(timelineState.stickyLegendAnchorTop);
      return isFinite(top)
        && isFinite(anchorTop)
        && timelineState.scrollTop + top >= anchorTop - 2;
    }

    function timelineLegendHeightCss() {
      var height = Number(timelineState.stickyLegendHeight);
      return isFinite(height) && height > 0 ? Math.ceil(height) + 'px' : '42px';
    }

    function timelineLegendInsetCss(value, fallback) {
      var inset = Number(value);
      return isFinite(inset) && inset >= 0 ? Math.round(inset) + 'px' : fallback;
    }

    function calibrateTimelineStickyLegendOffset() {
      var root = container.querySelector('.decidr-timeline-root');
      if (!root || !root.getBoundingClientRect) return;

      var rect = root.getBoundingClientRect();
      var containerRect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
      var doc = container.ownerDocument || document;
      var win = doc.defaultView || window;
      var measuredTop = measuredStickyLegendTop(rect, containerRect);
      var metrics = timelineScrollMetrics();
      timelineState.scrollTop = metrics.scrollTop || 0;

      if (measuredTop !== null) {
        timelineState.stickyLegendTop = Math.max(8, Math.min(240, measuredTop));
      }

      if (rect && isFinite(rect.left) && isFinite(rect.right)) {
        timelineState.stickyLegendLeft = Math.max(0, rect.left);
        timelineState.stickyLegendRight = Math.max(0, (win.innerWidth || rect.right) - rect.right);
      }

      var legend = container.querySelector('[data-timeline-sticky-legend]');
      if (legend && legend.getBoundingClientRect) {
        var legendRect = legend.getBoundingClientRect();
        if (legendRect && isFinite(legendRect.height) && legendRect.height > 0) {
          timelineState.stickyLegendHeight = legendRect.height;
        }
        if ((!isFinite(Number(timelineState.stickyLegendAnchorTop)) || (timelineState.scrollTop || 0) < 8)
          && legendRect && isFinite(legendRect.top)) {
          timelineState.stickyLegendAnchorTop = legendRect.top + (timelineState.scrollTop || 0);
        }
      }

      var sentinel = container.querySelector('[data-timeline-legend-sentinel]');
      var shouldDock = timelineStickyLegendShouldDock(rect, legend, sentinel);
      timelineState.stickyLegendDocked = shouldDock;

      root.style.setProperty('--decidr-timeline-sticky-top', stickyLegendTopCss());
      root.style.setProperty('--decidr-timeline-legend-left', timelineLegendInsetCss(timelineState.stickyLegendLeft, '20px'));
      root.style.setProperty('--decidr-timeline-legend-right', timelineLegendInsetCss(timelineState.stickyLegendRight, '20px'));
      applyTimelineLegendDocking(legend);
    }

    function measuredStickyLegendTop(rootRect, containerRect) {
      var candidates = [];
      if (rootRect && isFinite(rootRect.top) && rootRect.top > 24) {
        candidates.push(Math.round(rootRect.top + 4));
      }
      if (containerRect && isFinite(containerRect.top) && containerRect.top > 24) {
        candidates.push(Math.round(containerRect.top + 4));
      }
      if (!candidates.length) return null;
      var top = candidates[0];
      for (var i = 1; i < candidates.length; i++) {
        top = Math.min(top, candidates[i]);
      }
      return top;
    }

    function timelineStickyLegendShouldDock(rootRect, legend, sentinel) {
      var top = Number(timelineState.stickyLegendTop);
      if (!isFinite(top)) return false;
      var height = Number(timelineState.stickyLegendHeight);
      if (!isFinite(height) || height <= 0) height = 42;
      var reference = sentinel || legend;
      var referenceRect = reference && reference.getBoundingClientRect ? reference.getBoundingClientRect() : null;
      if (!referenceRect || !isFinite(referenceRect.top)) return false;
      var board = container.querySelector('[data-timeline-board-scroll]');
      var boardRect = board && board.getBoundingClientRect ? board.getBoundingClientRect() : null;
      if (boardRect && isFinite(boardRect.top) && boardRect.top <= top + 72) return true;
      var rootBottom = rootRect && isFinite(rootRect.bottom) ? rootRect.bottom : null;
      if (isFinite(rootBottom) && rootBottom < top + height + 12) return false;
      return referenceRect.top <= top + 34;
    }

    function applyTimelineLegendDocking(legend) {
      if (!legend || !legend.style) return;
      var shell = legend.parentElement;
      if (timelineState.stickyLegendDocked) {
        if (shell && shell.style) {
          shell.style.height = timelineLegendHeightCss();
          shell.style.margin = '0 0 var(--space-3) 0';
        }
        legend.style.position = 'fixed';
        legend.style.top = 'var(--decidr-timeline-sticky-top, 8px)';
        legend.style.left = 'var(--decidr-timeline-legend-left, 20px)';
        legend.style.right = 'var(--decidr-timeline-legend-right, 20px)';
        legend.style.transform = '';
        legend.style.margin = '0';
        return;
      }
      if (shell && shell.style) {
        shell.style.height = '';
        shell.style.margin = '';
      }
      legend.style.position = 'sticky';
      legend.style.top = 'var(--decidr-timeline-sticky-top, 8px)';
      legend.style.left = '';
      legend.style.right = '';
      legend.style.transform = '';
      legend.style.margin = '0 0 var(--space-3) 0';
    }

    function renderLegendToggle(entry) {
      var active = legendKeyVisible(entry.key);
      return '<button type="button" data-timeline-legend-toggle="' + UI.escapeHtml(entry.key) + '" '
        + 'aria-pressed="' + (active ? 'true' : 'false') + '" '
        + 'title="' + UI.escapeHtml(entry.label) + '" '
        + 'style="height:26px;display:inline-flex;align-items:center;gap:6px;padding:0 9px;'
        + 'border:1px solid ' + (active ? 'var(--border-color)' : 'var(--decidr-timeline-muted-border)')
        + ';border-radius:999px;background:' + (active ? 'var(--bg-surface)' : 'transparent')
        + ';color:' + (active ? 'var(--text-secondary)' : 'var(--text-tertiary)')
        + ';font-family:var(--font-sans);font-size:11px;cursor:pointer;white-space:nowrap;'
        + 'opacity:' + (active ? '1' : '0.48') + ';">'
        + renderLegendIcon(entry, active)
        + UI.escapeHtml(entry.label) + '</button>';
    }

    function renderLegendIcon(entry, active) {
      if (entry.key === 'decision') return renderDecisionBadge(entry.color, 12, active, '');
      return '<span style="width:9px;height:9px;border-radius:999px;background:' + (active ? entry.color : 'transparent')
        + ';border:1px solid ' + entry.color + ';"></span>';
    }

    function renderWindowStatus() {
      if (!timelineState.loadingWindow && !timelineState.windowError) return '';
      var text = timelineState.loadingWindow
        ? 'Loading timeline window...'
        : 'Could not load this timeline window.';
      var html = '<div style="display:flex;align-items:center;gap:var(--space-2);margin:0 0 var(--space-3) 0;'
        + 'font-size:12px;color:var(--text-secondary);">';
      if (timelineState.loadingWindow) {
        html += '<span style="width:10px;height:10px;border-radius:999px;background:var(--accent-primary);'
          + 'display:inline-block;opacity:0.82;"></span>';
      }
      html += '<span>' + UI.escapeHtml(text) + '</span>';
      if (timelineState.windowError) {
        html += '<button type="button" data-timeline-retry-window style="height:26px;padding:0 9px;'
          + 'border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface);'
          + 'color:var(--text-primary);font-family:var(--font-sans);font-size:11px;cursor:pointer;">Retry</button>';
      }
      html += '</div>';
      return html;
    }

    function timelineLightThemeCss(selector) {
      return selector + '{'
        + '--bg-surface:rgba(255,255,255,0.92);'
        + '--bg-subtle:#f8fafc;'
        + '--text-primary:rgba(15,23,42,0.92);'
        + '--text-secondary:rgba(51,65,85,0.72);'
        + '--text-tertiary:rgba(71,85,105,0.52);'
        + '--accent-primary:#2563eb;'
        + '--accent-primary-hover:#1d4ed8;'
        + '--accent-primary-ghost:rgba(37,99,235,0.08);'
        + '--border-color:rgba(100,116,139,0.22);'
        + '--decidr-timeline-board-bg:#ffffff;'
        + '--decidr-timeline-board-shadow:0 1px 2px rgba(15,23,42,0.08);'
        + '--decidr-timeline-header-bg:rgba(248,250,252,0.78);'
        + '--decidr-timeline-lane-bg:rgba(255,255,255,0.66);'
        + '--decidr-timeline-lane-alt-bg:rgba(255,255,255,0.66);'
        + '--decidr-timeline-grid:rgba(100,116,139,0.24);'
        + '--decidr-timeline-hour-grid:rgba(100,116,139,0.16);'
        + '--decidr-timeline-hour-grid-soft:rgba(100,116,139,0.12);'
        + '--decidr-timeline-now:#dc2626;'
        + '--decidr-timeline-project-section-bg:rgba(241,245,249,0.56);'
        + '--decidr-timeline-project-section-alt-bg:rgba(241,245,249,0.56);'
        + '--decidr-timeline-project-header-bg:rgba(255,255,255,0.72);'
        + '--decidr-timeline-project-header-alt-bg:rgba(255,255,255,0.72);'
        + '--decidr-timeline-project-border:rgba(100,116,139,0.26);'
        + '--decidr-timeline-project-header-border:rgba(100,116,139,0.2);'
        + '--decidr-timeline-project-shadow:inset 0 1px 0 rgba(255,255,255,0.9);'
        + '--decidr-timeline-decision-bg:rgba(255,255,255,0.68);'
        + '--decidr-timeline-decision-border:rgba(71,85,105,0.24);'
        + '--decidr-timeline-decision-shadow:0 1px 2px rgba(15,23,42,0.08);'
        + '--decidr-timeline-time-bar-opacity:0.48;'
        + '--decidr-timeline-overflow-bg:rgba(255,255,255,0.74);'
        + '--decidr-timeline-pill-border:rgba(100,116,139,0.28);'
        + '--decidr-timeline-legend-bg:rgba(255,255,255,0.76);'
        + '--decidr-timeline-legend-border:rgba(100,116,139,0.2);'
        + '--decidr-timeline-legend-shadow:0 1px 2px rgba(15,23,42,0.08);'
        + '--decidr-timeline-marker-stroke:#ffffff;'
        + '--decidr-timeline-marker-shadow:0 0 0 1px rgba(15,23,42,0.18),0 1px 2px rgba(15,23,42,0.12);'
        + '--decidr-timeline-muted-border:rgba(100,116,139,0.3);'
        + '}';
    }

    function renderTimeline() {
      updateTimelineViewport();
      var model = buildModel();
      timelineState.renderedRange = model.range;
      var html = '<div class="decidr-timeline-root" style="--decidr-timeline-sticky-top:' + stickyLegendTopCss() + ';'
        + '--decidr-timeline-legend-left:' + timelineLegendInsetCss(timelineState.stickyLegendLeft, '20px') + ';'
        + '--decidr-timeline-legend-right:' + timelineLegendInsetCss(timelineState.stickyLegendRight, '20px') + ';'
        + 'width:calc(100vw - 40px);max-width:calc(100vw - 40px);box-sizing:border-box;'
        + 'margin:0 auto;padding:var(--space-5) 0;font-family:var(--font-sans);'
        + 'color:var(--text-primary);overflow-x:visible;overflow-y:visible;">';
      html += '<style>.decidr-timeline-root select{background-color:var(--bg-surface)!important;'
        + 'background-image:none!important;-webkit-appearance:none;appearance:none;box-shadow:none!important;}'
        + '.decidr-timeline-root{'
        + '--border-color:var(--border-default);'
        + '--bg-subtle:var(--bg-surface-subtle);'
        + '--decidr-timeline-board-bg:var(--bg-surface);'
        + '--decidr-timeline-board-shadow:0 1px 2px rgba(0,0,0,0.18);'
        + '--decidr-timeline-header-bg:var(--bg-surface-subtle);'
        + '--decidr-timeline-lane-bg:var(--bg-surface);'
        + '--decidr-timeline-lane-alt-bg:var(--bg-surface-subtle);'
        + '--decidr-timeline-grid:rgba(148,163,184,0.18);'
        + '--decidr-timeline-hour-grid:rgba(148,163,184,0.16);'
        + '--decidr-timeline-hour-grid-soft:rgba(148,163,184,0.07);'
        + '--decidr-timeline-now:#f97316;'
        + '--decidr-timeline-project-section-bg:rgba(15,23,42,0.46);'
        + '--decidr-timeline-project-section-alt-bg:rgba(15,23,42,0.36);'
        + '--decidr-timeline-project-header-bg:rgba(17,24,39,0.88);'
        + '--decidr-timeline-project-header-alt-bg:rgba(17,24,39,0.78);'
        + '--decidr-timeline-project-border:rgba(148,163,184,0.22);'
        + '--decidr-timeline-project-header-border:rgba(148,163,184,0.18);'
        + '--decidr-timeline-project-shadow:inset 0 1px 0 rgba(255,255,255,0.03);'
        + '--decidr-timeline-decision-bg:rgba(17,24,39,0.82);'
        + '--decidr-timeline-decision-border:rgba(148,163,184,0.24);'
        + '--decidr-timeline-decision-shadow:0 1px 0 rgba(15,23,42,0.08);'
        + '--decidr-timeline-time-bar-opacity:0.62;'
        + '--decidr-timeline-overflow-bg:rgba(15,23,42,0.72);'
        + '--decidr-timeline-pill-border:rgba(148,163,184,0.28);'
        + '--decidr-timeline-legend-bg:rgba(15,23,42,0.78);'
        + '--decidr-timeline-legend-border:rgba(148,163,184,0.18);'
        + '--decidr-timeline-legend-shadow:0 1px 2px rgba(0,0,0,0.18);'
        + '--decidr-timeline-marker-stroke:var(--bg-surface);'
        + '--decidr-timeline-marker-shadow:0 0 0 1px rgba(0,0,0,0.12);'
        + '--decidr-timeline-muted-border:rgba(148,163,184,0.28);'
        + '}'
        + '@media (prefers-color-scheme: light){' + timelineLightThemeCss('.decidr-timeline-root') + '}'
        + timelineLightThemeCss('html[data-decidr-theme="light"] .decidr-timeline-root,.decidr-timeline-root[data-decidr-theme="light"]')
        + '.decidr-timeline-root,.decidr-timeline-root *{box-sizing:border-box;}'
        + '.decidr-timeline-root [data-timeline-board-scroll]{max-width:100%;}</style>';
      html += renderHeader(model);
      html += renderStats(model);
      html += renderRangeControls(model);
      html += renderFilterControls(model);
      html += renderLegend();
      html += renderWindowStatus();
      html += renderTimelineBoard(model);
      html += renderScan(model);
      html += '</div>';
      container.innerHTML = html;
      calibrateTimelineStickyLegendOffset();
      calibrateDecisionActualBars();
      resetTimelineHorizontalScroll();
      wireInteractions();
      wireStickyLegendDocking();
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
        var desiredWidth = button ? Number(button.getAttribute('data-timeline-desired-width')) : 0;
        var startPct = button ? Number(button.getAttribute('data-timeline-start-pct')) : 0;
        if (!isFinite(startPct)) startPct = 0;
        startPct = Math.max(0, Math.min(100, startPct));
        var rawLeft = PROJECT_GROUP_X_INSET + ((startPct / 100) * railWidth);
        var left = Math.min(rawLeft, Math.max(PROJECT_GROUP_X_INSET, railWidth - PROJECT_GROUP_X_INSET - DECISION_MIN_VISIBLE_WIDTH));
        var maxWidth = Math.max(DECISION_MIN_VISIBLE_WIDTH, railWidth - left - PROJECT_GROUP_X_INSET);
        var buttonWidth = Math.min(Math.max(actualWidth, labelMinWidth || 0, desiredWidth || 0), maxWidth);
        bar.style.width = Math.min(actualWidth, buttonWidth) + 'px';
        if (button && isFinite(labelMinWidth)) {
          button.style.left = left + 'px';
          button.style.width = buttonWidth + 'px';
          button.style.maxWidth = buttonWidth + 'px';
          button.style.minWidth = '0px';
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
      wireWindowRetry();
      wireVirtualScroll();
      wireEntityClicks(container);
      wireOrgPicker();
    }

    function wireWindowRetry() {
      var retry = container.querySelector('[data-timeline-retry-window]');
      if (!retry) return;
      retry.addEventListener('click', function() {
        reloadTimelineWindow({ force: true });
      });
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
            reloadTimelineWindow();
          });
        })(scopeBtns[i]);
      }

      var select = container.querySelector('#decidr-timeline-initiative-select');
      if (select) {
        select.addEventListener('change', function() {
          timelineState.selectedInitiativeId = select.value;
          timelineState.scope = 'initiative';
          reloadTimelineWindow();
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
            reloadTimelineWindow();
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
        reloadTimelineWindow();
      }
      if (startInput) startInput.addEventListener('change', applyCustomRange);
      if (endInput) endInput.addEventListener('change', applyCustomRange);
    }

    function shiftTimelineRangeByDays(days) {
      var range = timelineState.renderedRange;
      if (!range || !days) return;
      setCustomRangeDates(addDays(range.min, days), addDays(range.max, days));
      timelineState.rangePanRemainder = 0;
      reloadTimelineWindow();
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

      function handleWheel(evt) {
        if (!evt || !evt.target || !root.contains(evt.target)) return;
        var horizontalDelta = horizontalPanDeltaFromWheel(evt);
        if (!horizontalDelta) return;

        evt.preventDefault();
        if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
        else evt.stopPropagation();
        consumeTimelinePanDelta(horizontalDelta, timelinePanThreshold(timelineState.renderedRange, scroller));
      }

      scroller.addEventListener('wheel', handleWheel, { passive: false });
      timelineState.panWheelCleanup = function() {
        scroller.removeEventListener('wheel', handleWheel);
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
            reloadTimelineWindow();
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
          reloadTimelineWindow();
        });
      }
      if (endSelect) {
        endSelect.addEventListener('change', function() {
          timelineState.decisionEndFilter = endSelect.value || 'any';
          reloadTimelineWindow();
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
          UI.prepareInteractiveEntity(el);

          function openEntity(e) {
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
          }

          el.addEventListener('click', openEntity);
          el.addEventListener('keydown', function(e) {
            if (!UI.isActivationKey(e)) return;
            openEntity(e);
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
          + 'Sign in to DecidR for this organization.</p>'
          + '<button id="decidr-org-auth-btn" style="padding:8px 16px;border:1px solid var(--accent-primary);'
          + 'border-radius:8px;background:var(--accent-primary);color:white;cursor:pointer;'
          + 'font-family:var(--font-sans);">Sign in to DecidR</button>'
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
          timelineState.windowCache = {};
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
        timelineState.windowCache = {};
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

(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_audit_dashboard = function(container, data, meta) {
    container.innerHTML = '';

    var _orgId = (data && data.organization_id) ? data.organization_id : null;

    window.__decidrAPI.withReady(container, meta, function() {
      var UI = window.__decidrUI;
      var API = window.__decidrAPI;

      var state = {
        loaded: false,
        loading: false,
        error: null,
        events: [],
        total: 0,
        categories: [],
        projects: [],
        decisions: [],
        organizations: [],
        activeOrgId: null,
        defaultOrgId: null,
        filtersDirty: false,
        lastFetchedAt: null,
        skip: 0,
        take: 100,
        filters: {
          range: (data && data.range) || '30',
          status: (data && (data.status || data.audit_status)) || '',
          categoryId: (data && (data.category_id || data.categoryId)) || '',
          projectId: (data && (data.project_id || data.projectId)) || '',
          decisionId: (data && (data.decision_id || data.decisionId)) || '',
          search: (data && data.search) || '',
          occurredFrom: (data && (data.occurred_from || data.occurredFrom)) || '',
          occurredTo: (data && (data.occurred_to || data.occurredTo)) || '',
          sort: (data && data.sort) || 'status'
        }
      };

      container.innerHTML = UI.loadingSpinner('Loading audit dashboard...');

      API.resolveAndBindTargetOrg({
        pushedOrgId: (data && data.organization_id) ? data.organization_id : null
      }).then(function(preflight) {
        state.organizations = preflight.organizations || [];
        state.defaultOrgId = preflight.defaultOrgId || null;
        state.activeOrgId = API.getActiveOrgId()
          || (state.organizations.length ? state.organizations[0].id : null);

        return Promise.all([
          API.listAuditCategories({ take: 200 }).then(unwrapList).catch(function() { return []; }),
          API.listProjects({ take: 200 }).then(unwrapList).catch(function() { return []; }),
          API.listDecisions({ take: 200 }).then(unwrapList).catch(function() { return []; })
        ]);
      }).then(function(results) {
        state.categories = results[0] || [];
        state.projects = results[1] || [];
        state.decisions = results[2] || [];
        return fetchEvents(true);
      }).catch(function(err) {
        state.error = err;
        container.innerHTML = UI.emptyState('Failed to load audit dashboard.');
      });

      function unwrapList(resp) {
        if (resp && Array.isArray(resp.data)) return resp.data;
        if (Array.isArray(resp)) return resp;
        return [];
      }

      function responseTotal(resp, fallback) {
        if (resp && typeof resp.total === 'number') return resp.total;
        if (resp && typeof resp.totalCount === 'number') return resp.totalCount;
        return fallback || 0;
      }

      function statusOrder(status) {
        var s = String(status || '').toUpperCase();
        if (s === 'OPEN') return 0;
        if (s === 'ACKNOWLEDGED') return 1;
        if (s === 'RESOLVED') return 2;
        if (s === 'ARCHIVED') return 3;
        return 4;
      }

      function projectName(projectId) {
        if (!projectId) return '';
        for (var i = 0; i < state.projects.length; i++) {
          if (state.projects[i].id === projectId) return state.projects[i].name || projectId;
        }
        return projectId;
      }

      function categoryName(event) {
        if (!event) return '';
        if (event.category && event.category.name) return event.category.name;
        if (event.category) return String(event.category);
        return '';
      }

      function linkedDecisionTitles(event) {
        var links = event.decisionLinks || event.auditEventLinks || [];
        var titles = [];
        for (var i = 0; i < links.length; i++) {
          var dec = links[i].decision || links[i];
          if (dec && (dec.title || dec.id)) titles.push(dec.title || dec.id);
        }
        return titles;
      }

      function formatDateInput(value) {
        if (!value) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
        var d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + m + '-' + day;
      }

      function buildEventParams(reset) {
        var f = state.filters;
        var params = { take: state.take, skip: reset ? 0 : state.skip };
        if (f.status) params.status = f.status;
        if (f.categoryId) params.categoryId = f.categoryId;
        if (f.projectId) params.projectId = f.projectId;
        if (f.decisionId) params.decisionId = f.decisionId;
        if (f.search && f.search.trim()) params.search = f.search.trim();

        if (f.range && f.range !== 'all' && f.range !== 'custom') {
          var days = Number(f.range);
          if (!Number.isNaN(days) && days > 0) {
            var from = new Date();
            from.setDate(from.getDate() - Math.max(days - 1, 0));
            from.setHours(0, 0, 0, 0);
            params.occurredFrom = from.toISOString();
          }
        }

        if (f.range === 'custom') {
          if (f.occurredFrom) params.occurredFrom = f.occurredFrom + 'T00:00:00.000Z';
          if (f.occurredTo) params.occurredTo = f.occurredTo + 'T23:59:59.999Z';
        }

        return params;
      }

      function sortEvents(events) {
        var sorted = events.slice();
        var sort = state.filters.sort || 'status';
        sorted.sort(function(a, b) {
          if (sort === 'status') {
            var statusDiff = statusOrder(a.status) - statusOrder(b.status);
            if (statusDiff !== 0) return statusDiff;
          } else if (sort === 'category') {
            var catDiff = categoryName(a).localeCompare(categoryName(b));
            if (catDiff !== 0) return catDiff;
          } else if (sort === 'project') {
            var projectDiff = projectName(a.projectId).localeCompare(projectName(b.projectId));
            if (projectDiff !== 0) return projectDiff;
          }
          return new Date(b.occurredAt || b.createdAt || 0) - new Date(a.occurredAt || a.createdAt || 0);
        });
        return sorted;
      }

      function fetchEvents(reset) {
        state.loading = true;
        if (reset) {
          state.skip = 0;
          state.events = [];
        }
        render();

        return API.listAuditEvents(buildEventParams(reset)).then(function(resp) {
          var items = unwrapList(resp);
          state.total = responseTotal(resp, items.length);
          state.events = reset ? items : state.events.concat(items);
          state.skip = state.events.length;
          state.loaded = true;
          state.loading = false;
          state.error = null;
          state.filtersDirty = false;
          state.lastFetchedAt = new Date();
          render();
        }).catch(function(err) {
          state.loading = false;
          state.error = err;
          render();
        });
      }

      function countBy(items, getter) {
        var out = {};
        for (var i = 0; i < items.length; i++) {
          var key = getter(items[i]) || 'Uncategorized';
          out[key] = (out[key] || 0) + 1;
        }
        return out;
      }

      function mapEntries(map) {
        var rows = [];
        for (var key in map) {
          if (map.hasOwnProperty(key)) rows.push({ key: key, count: map[key] });
        }
        rows.sort(function(a, b) { return b.count - a.count || a.key.localeCompare(b.key); });
        return rows;
      }

      function visibleEvents() {
        return sortEvents(state.events);
      }

      function formatDateTime(value) {
        if (!value) return '';
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      }

      function parseDateOnly(value) {
        if (!value) return null;
        var str = String(value);
        var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        var date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      function startOfDay(date) {
        var copy = new Date(date.getTime());
        copy.setHours(0, 0, 0, 0);
        return copy;
      }

      function endOfDay(date) {
        var copy = new Date(date.getTime());
        copy.setHours(23, 59, 59, 999);
        return copy;
      }

      function addDays(date, days) {
        var copy = new Date(date.getTime());
        copy.setDate(copy.getDate() + days);
        return copy;
      }

      function dateKey(date) {
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return date.getFullYear() + '-' + month + '-' + day;
      }

      function daysBetweenInclusive(from, to) {
        var start = startOfDay(from).getTime();
        var end = startOfDay(to).getTime();
        return Math.max(1, Math.floor((end - start) / 86400000) + 1);
      }

      function formatDateShort(date, forceYear) {
        if (!date) return '';
        var opts = { month: 'short', day: 'numeric' };
        if (forceYear) opts.year = 'numeric';
        return date.toLocaleDateString([], opts);
      }

      function formatDateRange(from, to) {
        if (!from && !to) return '';
        if (from && !to) return 'From ' + formatDateShort(from, true);
        if (!from && to) return 'Through ' + formatDateShort(to, true);
        var sameYear = from.getFullYear() === to.getFullYear();
        if (dateKey(from) === dateKey(to)) return formatDateShort(from, true);
        return formatDateShort(from, !sameYear) + ' - ' + formatDateShort(to, true);
      }

      function statusLabel(status) {
        var labels = {
          OPEN: 'Open',
          ACKNOWLEDGED: 'Acknowledged',
          RESOLVED: 'Resolved',
          ARCHIVED: 'Archived'
        };
        return labels[String(status || '').toUpperCase()] || status || 'Unknown';
      }

      function eventDateBounds() {
        var from = null;
        var to = null;
        for (var i = 0; i < state.events.length; i++) {
          var raw = state.events[i].occurredAt || state.events[i].createdAt;
          if (!raw) continue;
          var date = new Date(raw);
          if (Number.isNaN(date.getTime())) continue;
          if (!from || date < from) from = date;
          if (!to || date > to) to = date;
        }
        return {
          from: from ? startOfDay(from) : null,
          to: to ? endOfDay(to) : null
        };
      }

      function rangeLabel(range) {
        if (range === '7') return 'Last 7 days';
        if (range === '30') return 'Last 30 days';
        if (range === '90') return 'Last 90 days';
        if (range === 'all') return 'All time';
        if (range === 'custom') return 'Custom dates';
        return 'Last 30 days';
      }

      function selectedDateWindow() {
        var f = state.filters;
        var todayStart = startOfDay(new Date());
        var todayEnd = endOfDay(todayStart);
        if (f.range && f.range !== 'all' && f.range !== 'custom') {
          var days = Number(f.range);
          if (Number.isNaN(days) || days < 1) days = 30;
          return {
            from: addDays(todayStart, -Math.max(days - 1, 0)),
            to: todayEnd,
            label: rangeLabel(f.range)
          };
        }

        var bounds = eventDateBounds();
        if (f.range === 'custom') {
          var customFromDate = f.occurredFrom ? parseDateOnly(f.occurredFrom) : null;
          var customToDate = f.occurredTo ? parseDateOnly(f.occurredTo) : null;
          var customFrom = customFromDate ? startOfDay(customFromDate) : null;
          var customTo = customToDate ? endOfDay(customToDate) : null;
          return {
            from: customFrom || bounds.from,
            to: customTo || bounds.to || todayEnd,
            label: 'Custom dates'
          };
        }

        return {
          from: bounds.from,
          to: bounds.to,
          label: 'All time'
        };
      }

      function activeFilterItems() {
        var f = state.filters;
        var items = [{ type: 'Range', value: rangeLabel(f.range) }];
        if (f.status) items.push({ type: 'Status', value: statusLabel(f.status) });
        if (f.categoryId) {
          var category = '';
          for (var c = 0; c < state.categories.length; c++) {
            if (state.categories[c].id === f.categoryId) category = state.categories[c].name || state.categories[c].id;
          }
          items.push({ type: 'Category', value: category || f.categoryId });
        }
        if (f.projectId) items.push({ type: 'Project', value: projectName(f.projectId) || f.projectId });
        if (f.decisionId) {
          var decision = '';
          for (var d = 0; d < state.decisions.length; d++) {
            if (state.decisions[d].id === f.decisionId) decision = state.decisions[d].title || state.decisions[d].id;
          }
          items.push({ type: 'Linked Decision', value: decision || f.decisionId });
        }
        if (f.range === 'custom' && (f.occurredFrom || f.occurredTo)) {
          items.push({ type: 'Dates', value: (f.occurredFrom || 'Any') + ' to ' + (f.occurredTo || 'Any') });
        }
        if (f.search) items.push({ type: 'Search', value: f.search });
        return items;
      }

      function renderScopeSummary() {
        var items = activeFilterItems();
        var html = '<div class="decidr-section" style="padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;">';
        html += '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;">';
        html += '<span style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;">Scope</span>';
        for (var i = 0; i < items.length; i++) {
          html += '<span class="decidr-badge" title="' + UI.escapeHtml(items[i].type) + ': ' + UI.escapeHtml(items[i].value) + '">'
            + UI.escapeHtml(items[i].type) + ': ' + UI.escapeHtml(UI.truncate(items[i].value, 38)) + '</span>';
        }
        html += '</div>';
        html += '<div style="color:var(--text-tertiary);font-size:var(--text-xs);">';
        if (state.lastFetchedAt) html += 'Refreshed ' + UI.escapeHtml(formatDateTime(state.lastFetchedAt));
        if (state.filtersDirty) html += (state.lastFetchedAt ? ' · ' : '') + '<strong style="color:var(--text-secondary);">Filters not applied</strong>';
        html += '</div></div></div>';
        return html;
      }

      function renderStatCards() {
        var statusCounts = countBy(state.events, function(event) {
          return String(event.status || 'OPEN').toUpperCase();
        });
        var linkedCount = 0;
        for (var i = 0; i < state.events.length; i++) {
          if (linkedDecisionTitles(state.events[i]).length > 0) linkedCount++;
        }
        var categories = mapEntries(countBy(state.events, categoryName));

        return UI.statsRow([
          { value: state.total, label: 'Total In Scope', opts: { animDelay: 0.05 } },
          { value: statusCounts.OPEN || 0, label: 'Open Loaded', opts: { animDelay: 0.10 } },
          { value: statusCounts.ACKNOWLEDGED || 0, label: 'Acknowledged Loaded', opts: { animDelay: 0.15 } },
          { value: statusCounts.RESOLVED || 0, label: 'Resolved Loaded', opts: { animDelay: 0.20 } },
          { value: linkedCount, label: 'With Decision Links', opts: { animDelay: 0.25 } },
          { value: categories.length, label: 'Loaded Categories', opts: { animDelay: 0.30 } }
        ]);
      }

      function renderTrustNote() {
        if (!state.total || state.events.length >= state.total) return '';
        return '<div style="margin-top:var(--space-2);color:var(--text-tertiary);font-size:var(--text-xs);line-height:1.45;">'
          + 'Breakdowns and loaded status counts are based on the ' + UI.escapeHtml(String(state.events.length))
          + ' loaded events. Total in scope comes from the server result count.</div>';
      }

      function renderInsightSummary() {
        var events = state.events || [];
        var open = 0;
        var unlinked = 0;
        var revised = 0;
        var projectCounts = {};
        for (var i = 0; i < events.length; i++) {
          if (String(events[i].status || 'OPEN').toUpperCase() === 'OPEN') open++;
          if (!linkedDecisionTitles(events[i]).length) unlinked++;
          if (events[i].revisions && events[i].revisions.length) revised++;
          var pid = events[i].projectId || '';
          projectCounts[pid] = (projectCounts[pid] || 0) + 1;
        }
        var topProject = '';
        var topProjectCount = 0;
        for (var projectId in projectCounts) {
          if (projectCounts.hasOwnProperty(projectId) && projectCounts[projectId] > topProjectCount) {
            topProjectCount = projectCounts[projectId];
            topProject = projectName(projectId) || 'No project label';
          }
        }
        var coverage = events.length ? Math.round(((events.length - unlinked) / events.length) * 100) : 0;
        var html = '<div class="decidr-section" style="padding:var(--space-4);margin-top:var(--space-5);">';
        html += '<div class="decidr-section-header">What Needs Attention</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);">';
        html += insightItem('Open loaded events', open, 'Review or acknowledge these first.');
        html += insightItem('Without linked decisions', unlinked, 'Evidence is harder to trace.');
        html += insightItem('Decision coverage', coverage + '%', 'Share of loaded events tied to decisions.');
        html += insightItem('Most active project', topProject || 'No loaded events', topProjectCount ? topProjectCount + ' loaded events' : 'Nothing loaded yet.');
        html += '</div>';
        if (revised) {
          html += '<div style="margin-top:var(--space-3);color:var(--text-secondary);font-size:var(--text-small);">'
            + UI.escapeHtml(String(revised)) + ' loaded event' + (revised === 1 ? ' has' : 's have') + ' visible revision history.</div>';
        }
        html += renderTrustNote();
        html += '</div>';
        return html;
      }

      function insightItem(label, value, detail) {
        return '<div style="border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:var(--space-3);background:var(--bg-surface);min-width:0;">'
          + '<div style="font-size:var(--text-h3);font-weight:var(--weight-bold);line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(String(value)) + '</div>'
          + '<div style="margin-top:4px;color:var(--text-secondary);font-size:var(--text-small);font-weight:var(--weight-semibold);">' + UI.escapeHtml(label) + '</div>'
          + '<div style="margin-top:3px;color:var(--text-tertiary);font-size:var(--text-xs);line-height:1.35;">' + UI.escapeHtml(detail) + '</div>'
          + '</div>';
      }

      function controlStyle() {
        return 'width:100%;min-height:38px;border:1px solid var(--border-default);'
          + 'border-radius:var(--border-radius-md);background:var(--bg-surface);'
          + 'color:var(--text-primary);font:inherit;padding:8px 10px;';
      }

      function buttonStyle(primary) {
        return 'min-height:38px;padding:0 14px;border:1px solid '
          + (primary ? 'var(--accent-primary)' : 'var(--border-default)')
          + ';border-radius:var(--border-radius-md);background:'
          + (primary ? 'var(--accent-primary)' : 'var(--bg-surface)')
          + ';color:' + (primary ? '#fff' : 'var(--text-primary)')
          + ';font-weight:var(--weight-semibold);font-size:var(--text-small);cursor:pointer;';
      }

      function labelHtml(text) {
        return '<label style="display:flex;flex-direction:column;gap:var(--space-1);'
          + 'font-size:var(--text-xs);font-weight:var(--weight-semibold);'
          + 'color:var(--text-secondary);text-transform:uppercase;">'
          + UI.escapeHtml(text);
      }

      function option(value, label, selectedValue) {
        return '<option value="' + UI.escapeHtml(value || '') + '"'
          + (String(selectedValue || '') === String(value || '') ? ' selected' : '')
          + '>' + UI.escapeHtml(label || value || '') + '</option>';
      }

      function renderFilters() {
        var f = state.filters;
        var html = '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-audit-filter-head">'
          + '<div><div class="decidr-section-header" style="margin:0;">Filter Evidence</div>'
          + '<div class="decidr-audit-filter-help">Filters define the audit scope for counts, volume, and the review queue. Apply changes to refresh the data.</div></div>'
          + (state.filtersDirty ? '<div class="decidr-audit-filter-dirty">Unsaved filter changes</div>' : '')
          + '</div>';
        html += '<div class="decidr-audit-filter-grid">';

        html += labelHtml('Search')
          + '<input id="decidr-audit-filter-search" type="search" value="' + UI.escapeHtml(f.search) + '"'
          + ' placeholder="Title or summary" style="' + controlStyle() + '"></label>';

        html += labelHtml('Status')
          + '<select id="decidr-audit-filter-status" style="' + controlStyle() + '">'
          + option('', 'All statuses', f.status)
          + option('OPEN', 'Open', f.status)
          + option('ACKNOWLEDGED', 'Acknowledged', f.status)
          + option('RESOLVED', 'Resolved', f.status)
          + option('ARCHIVED', 'Archived', f.status)
          + '</select></label>';

        html += labelHtml('Category')
          + '<select id="decidr-audit-filter-category" style="' + controlStyle() + '">'
          + option('', 'All categories', f.categoryId);
        for (var c = 0; c < state.categories.length; c++) {
          html += option(state.categories[c].id, state.categories[c].name || state.categories[c].id, f.categoryId);
        }
        html += '</select></label>';

        html += labelHtml('Project')
          + '<select id="decidr-audit-filter-project" style="' + controlStyle() + '">'
          + option('', 'All projects', f.projectId);
        for (var p = 0; p < state.projects.length; p++) {
          html += option(state.projects[p].id, state.projects[p].name || state.projects[p].id, f.projectId);
        }
        html += '</select></label>';

        html += labelHtml('Sort')
          + '<select id="decidr-audit-filter-sort" style="' + controlStyle() + '">'
          + option('status', 'Status first', f.sort)
          + option('newest', 'Newest first', f.sort)
          + option('category', 'Category', f.sort)
          + option('project', 'Project', f.sort)
          + '</select></label>';

        html += labelHtml('Range')
          + '<select id="decidr-audit-filter-range" style="' + controlStyle() + '">'
          + option('7', 'Last 7 days', f.range)
          + option('30', 'Last 30 days', f.range)
          + option('90', 'Last 90 days', f.range)
          + option('all', 'All time', f.range)
          + option('custom', 'Custom dates', f.range)
          + '</select></label>';

        var customDates = f.range === 'custom';
        html += labelHtml('From')
          + '<input id="decidr-audit-filter-from" type="' + (customDates ? 'date' : 'text') + '" value="' + UI.escapeHtml(customDates ? formatDateInput(f.occurredFrom) : '') + '"'
          + ' placeholder="' + (customDates ? '' : 'Select Custom dates') + '" style="' + controlStyle() + (customDates ? '' : 'opacity:.58;') + '"' + (customDates ? '' : ' disabled') + '></label>';

        html += labelHtml('To')
          + '<input id="decidr-audit-filter-to" type="' + (customDates ? 'date' : 'text') + '" value="' + UI.escapeHtml(customDates ? formatDateInput(f.occurredTo) : '') + '"'
          + ' placeholder="' + (customDates ? '' : 'Select Custom dates') + '" style="' + controlStyle() + (customDates ? '' : 'opacity:.58;') + '"' + (customDates ? '' : ' disabled') + '></label>';

        html += labelHtml('Linked Decision')
          + '<select id="decidr-audit-filter-decision" style="' + controlStyle() + '">'
          + option('', 'All decisions', f.decisionId);
        for (var d = 0; d < state.decisions.length; d++) {
          html += option(state.decisions[d].id, state.decisions[d].title || state.decisions[d].id, f.decisionId);
        }
        html += '</select></label>';

        html += '<div class="decidr-audit-filter-actions">'
          + '<button id="decidr-audit-filter-apply" style="' + buttonStyle(true) + '">' + (state.filtersDirty ? 'Apply filters' : 'Refresh results') + '</button>'
          + '<button id="decidr-audit-filter-clear" style="' + buttonStyle(false) + '">Reset</button>'
          + '</div>';

        html += '</div></div>';
        return html;
      }

      function renderBreakdown(title, rows, opts) {
        opts = opts || {};
        var max = opts.max || 8;
        var html = '<div class="decidr-section" style="padding:var(--space-4);min-height:100%;">';
        html += '<div class="decidr-section-header">' + UI.escapeHtml(title) + '</div>';
        if (!rows.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No events in this filter.</div>';
        } else {
          var topCount = rows[0].count || 1;
          for (var i = 0; i < rows.length && i < max; i++) {
            var row = rows[i];
            var width = Math.max(8, Math.round((row.count / topCount) * 100));
            var attrs = opts.attr ? ' ' + opts.attr + '="' + UI.escapeHtml(row.id || row.key) + '"' : '';
            html += '<button class="decidr-audit-breakdown-row" type="button"' + attrs
              + ' style="display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;padding:6px 0;">'
              + '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);font-size:var(--text-small);">'
              + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(row.key) + '</span>'
              + '<span style="color:var(--text-tertiary);font-weight:var(--weight-semibold);">' + row.count + '</span>'
              + '</div>'
              + '<div style="height:4px;border-radius:var(--border-radius-pill);background:var(--bg-surface);margin-top:4px;overflow:hidden;">'
              + '<div style="height:100%;width:' + width + '%;background:var(--accent-primary);"></div>'
              + '</div>'
              + '</button>';
          }
        }
        html += '</div>';
        return html;
      }

      function renderTimelineBars() {
        var spec = buildVolumeBuckets();
        var rows = spec.rows;
        var max = 1;
        for (var i = 0; i < rows.length; i++) max = Math.max(max, rows[i].count);
        var stackKeyMap = volumeStackKeyMap(spec.stackSegments);

        var html = '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-audit-volume-head">'
          + '<div><div class="decidr-section-header" style="margin:0;">Event Volume</div>'
          + '<div class="decidr-audit-volume-subtitle">' + UI.escapeHtml(spec.unitLabel + ' for ' + spec.windowLabel + (spec.windowRange ? ' (' + spec.windowRange + ')' : '')) + '</div></div>'
          + '<div class="decidr-audit-volume-summary">' + UI.escapeHtml(spec.loadedLabel) + '</div>'
          + '</div>';
        if (!rows.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No event volume for this filter.</div>';
        } else {
          html += '<div class="decidr-audit-volume-legend">'
            + '<span><strong>Number</strong> = audit events</span>'
            + '<span><strong>Bucket</strong> = ' + UI.escapeHtml(spec.bucketLabel) + '</span>'
            + '<span><strong>Grouped by</strong> = occurred date</span>'
            + '<span><strong>Stack</strong> = audit category</span>'
            + '</div>';
          html += renderVolumeStackLegend(spec.stackSegments);
          html += '<div class="decidr-audit-volume-note">Bar height is total audit events in the bucket. Color segments show category makeup, with smaller categories folded into Other when needed. Dates use the event occurred date, using created date only when occurred date is missing. ' + UI.escapeHtml(spec.emptyBucketNote)
            + (spec.peakLabel ? ' Peak: ' + UI.escapeHtml(spec.peakLabel) + '.' : '')
            + '</div>';
          html += '<div class="decidr-audit-volume-axis"><span>0 events</span><span>' + UI.escapeHtml(String(max)) + ' events max</span></div>';
          html += '<div class="decidr-audit-volume-chart" style="grid-template-columns:repeat(' + rows.length + ',minmax(8px,1fr));">';
          for (var b = 0; b < rows.length; b++) {
            var height = Math.max(8, Math.round((rows[b].count / max) * 80));
            if (!rows[b].count) height = 3;
            html += '<div class="decidr-audit-volume-bucket" title="' + UI.escapeHtml(rows[b].title + ': ' + rows[b].count + ' event' + (rows[b].count === 1 ? '' : 's') + volumeCompositionLabel(rows[b], spec.stackSegments, stackKeyMap)) + '">'
              + '<div class="decidr-audit-volume-count">' + (rows[b].count ? UI.escapeHtml(String(rows[b].count)) : '&nbsp;') + '</div>'
              + renderStackedVolumeBar(rows[b], height, spec.stackSegments, stackKeyMap)
              + '<div class="decidr-audit-volume-label">' + renderBucketLabel(rows[b], spec.unitName, b, rows.length) + '</div>'
              + '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
        return html;
      }

      function renderBucketLabel(row, unitName, index, count) {
        if (unitName === 'day' || unitName === 'date range') {
          return (row.monthLabel ? '<span class="decidr-audit-volume-month">' + UI.escapeHtml(row.monthLabel) + '</span>' : '')
            + '<span class="decidr-audit-volume-day">' + UI.escapeHtml(row.dayLabel || row.label || '') + '</span>';
        }
        return shouldShowBucketLabel(index, count) ? UI.escapeHtml(row.label) : '&nbsp;';
      }

      function renderVolumeStackLegend(segments) {
        if (!segments || !segments.length) return '';
        var html = '<div class="decidr-audit-volume-stack-legend">';
        for (var i = 0; i < segments.length; i++) {
          html += '<span><i class="decidr-audit-volume-segment-swatch decidr-audit-volume-segment-c' + i + '"></i>' + UI.escapeHtml(segments[i].label) + '</span>';
        }
        html += '</div>';
        return html;
      }

      function renderStackedVolumeBar(row, height, segments, stackKeyMap) {
        if (!row.count) {
          return '<div class="decidr-audit-volume-bar empty" style="height:' + height + 'px;"></div>';
        }
        var html = '<div class="decidr-audit-volume-bar stacked" style="height:' + height + 'px;">';
        var rendered = 0;
        for (var i = 0; i < segments.length; i++) {
          var count = volumeSegmentCount(row, segments[i], stackKeyMap);
          if (!count) continue;
          rendered += count;
          html += '<div class="decidr-audit-volume-segment decidr-audit-volume-segment-c' + i + '" style="height:' + Math.max(1, (count / row.count) * 100) + '%;"></div>';
        }
        if (!rendered) {
          html += '<div class="decidr-audit-volume-segment decidr-audit-volume-segment-c0" style="height:100%;"></div>';
        }
        html += '</div>';
        return html;
      }

      function volumeCompositionLabel(row, segments, stackKeyMap) {
        if (!row.count || !segments || !segments.length) return '';
        var parts = [];
        for (var i = 0; i < segments.length; i++) {
          var count = volumeSegmentCount(row, segments[i], stackKeyMap);
          if (count) parts.push(segments[i].label + ' ' + count);
        }
        return parts.length ? ' (' + parts.join(', ') + ')' : '';
      }

      function volumeStackKeyMap(segments) {
        var map = {};
        if (!segments) return map;
        for (var i = 0; i < segments.length; i++) {
          if (!segments[i].other) map[segments[i].key] = true;
        }
        return map;
      }

      function volumeSegmentCount(row, segment, stackKeyMap) {
        var counts = row.segments || {};
        if (!segment.other) return counts[segment.key] || 0;
        var total = 0;
        for (var key in counts) {
          if (counts.hasOwnProperty(key) && !stackKeyMap[key]) total += counts[key] || 0;
        }
        return total;
      }

      function shouldShowBucketLabel(index, count) {
        if (count <= 14) return true;
        if (index === 0 || index === count - 1) return true;
        return index % Math.ceil(count / 6) === 0;
      }

      function buildVolumeBuckets() {
        var windowRange = selectedDateWindow();
        if (!windowRange.from || !windowRange.to || windowRange.from > windowRange.to) {
          return {
            rows: [],
            unitLabel: 'Event count',
            unitName: 'bucket',
            unitNamePlural: 'buckets',
            windowLabel: rangeLabel(state.filters.range),
            windowRange: '',
            loadedLabel: state.events.length + ' loaded events',
            stackSegments: [],
            peakLabel: ''
          };
        }

        var dailyRows = buildDailyVolumeRows(windowRange.from, windowRange.to);
        var rowMap = {};
        for (var r = 0; r < dailyRows.length; r++) rowMap[dailyRows[r].key] = dailyRows[r];
        for (var e = 0; e < state.events.length; e++) {
          var raw = state.events[e].occurredAt || state.events[e].createdAt;
          if (!raw) continue;
          var eventDate = new Date(raw);
          if (Number.isNaN(eventDate.getTime()) || eventDate < windowRange.from || eventDate > windowRange.to) continue;
          var key = dateKey(eventDate);
          if (key && rowMap[key]) {
            rowMap[key].count++;
            addVolumeSegment(rowMap[key].segments, eventCategorySegment(state.events[e]), 1);
          }
        }

        var loaded = 0;
        for (var i = 0; i < dailyRows.length; i++) loaded += dailyRows[i].count;

        var fitted = fitDailyVolumeRows(dailyRows);
        var rows = fitted.rows;
        var stackSegments = topVolumeSegments(rows, 6);
        var peak = null;
        for (var pi = 0; pi < rows.length; pi++) {
          if (!peak || rows[pi].count > peak.count) peak = rows[pi];
        }

        var loadedLabel = loaded + ' loaded event' + (loaded === 1 ? '' : 's');
        if (state.total && state.total !== loaded) {
          loadedLabel += ' charted from ' + state.events.length + ' loaded of ' + state.total + ' in scope';
        }

        return {
          rows: rows,
          unitLabel: fitted.unitLabel,
          unitName: fitted.unitName,
          unitNamePlural: fitted.unitName + 's',
          bucketLabel: fitted.bucketLabel,
          emptyBucketNote: fitted.emptyBucketNote,
          stackSegments: stackSegments,
          windowLabel: windowRange.label,
          windowRange: formatDateRange(windowRange.from, windowRange.to),
          loadedLabel: loadedLabel,
          peakLabel: peak && peak.count ? peak.count + ' on ' + peak.title : ''
        };
      }

      function buildDailyVolumeRows(from, to) {
        var rows = [];
        var cursor = startOfDay(from);
        while (cursor <= to) {
          var showMonth = rows.length === 0 || cursor.getDate() === 1;
          rows.push({
            key: dateKey(cursor),
            count: 0,
            from: cursor,
            to: endOfDay(cursor),
            label: formatDateShort(cursor, false),
            monthLabel: showMonth ? cursor.toLocaleDateString([], { month: 'short' }) : '',
            dayLabel: String(cursor.getDate()),
            title: formatDateShort(cursor, true),
            segments: {}
          });
          cursor = addDays(cursor, 1);
        }
        return rows;
      }

      function fitDailyVolumeRows(dailyRows) {
        var idealColumns = 42;
        var compressed = compressEmptyDayRanges(dailyRows);
        if (compressed.length <= idealColumns) {
          return {
            rows: compressed,
            unitLabel: 'Audit events grouped by day',
            unitName: 'day',
            bucketLabel: 'one day; empty ranges collapse',
            emptyBucketNote: 'Consecutive empty days are collapsed into start-end ranges so the axis stays readable.'
          };
        }

        return {
          rows: aggregateDailyRows(dailyRows, idealColumns),
          unitLabel: 'Audit events grouped by date range',
          unitName: 'date range',
          bucketLabel: 'adaptive date range',
          emptyBucketNote: 'The selected range has too many daily columns, so adjacent days are combined into readable date-range buckets.'
        };
      }

      function aggregateDailyRows(rows, targetColumns) {
        var bucketSize = Math.max(1, Math.ceil(rows.length / targetColumns));
        var buckets = [];
        for (var i = 0; i < rows.length; i += bucketSize) {
          var startRow = rows[i];
          var endIndex = Math.min(rows.length - 1, i + bucketSize - 1);
          var endRow = rows[endIndex];
          var count = 0;
          for (var j = i; j <= endIndex; j++) count += rows[j].count || 0;
          buckets.push(dateRangeBucket(startRow, endRow, count, buckets.length === 0, mergeVolumeSegments(rows, i, endIndex)));
        }
        return mergeAdjacentEmptyRangeBuckets(buckets);
      }

      function compressEmptyDayRanges(rows) {
        var compressed = [];
        var i = 0;
        while (i < rows.length) {
          var row = rows[i];
          if (row.count) {
            compressed.push(row);
            i++;
            continue;
          }

          var start = i;
          var end = i;
          while (end + 1 < rows.length && !rows[end + 1].count) end++;

          if (end > start) {
            compressed.push(dateRangeBucket(rows[start], rows[end], 0, compressed.length === 0, {}));
          } else {
            compressed.push(row);
          }
          i = end + 1;
        }
        return compressed;
      }

      function mergeAdjacentEmptyRangeBuckets(rows) {
        var merged = [];
        var i = 0;
        while (i < rows.length) {
          var row = rows[i];
          if (row.count) {
            merged.push(row);
            i++;
            continue;
          }
          var start = i;
          var end = i;
          while (end + 1 < rows.length && !rows[end + 1].count) end++;
          if (end > start) {
            merged.push(dateRangeBucket(rows[start], rows[end], 0, merged.length === 0, {}));
          } else {
            merged.push(row);
          }
          i = end + 1;
        }
        return merged;
      }

      function dateRangeBucket(startRow, endRow, count, firstBucket, segments) {
        var sameMonth = startRow.from.getFullYear() === endRow.from.getFullYear()
          && startRow.from.getMonth() === endRow.from.getMonth();
        var startMonth = startRow.from.toLocaleDateString([], { month: 'short' });
        var endMonth = endRow.from.toLocaleDateString([], { month: 'short' });
        var startDay = String(startRow.from.getDate());
        var endDay = String(endRow.from.getDate());
        var monthLabel = firstBucket || startRow.from.getDate() === 1 ? startMonth : '';
        var sameDay = dateKey(startRow.from) === dateKey(endRow.from);
        var dayLabel = sameDay ? startDay : (sameMonth ? startDay + '-' + endDay : startMonth + ' ' + startDay + '-' + endMonth + ' ' + endDay);

        return {
          key: startRow.key + '-to-' + endRow.key,
          count: count || 0,
          from: startRow.from,
          to: endRow.to,
          label: sameMonth ? dayLabel : dayLabel,
          monthLabel: sameMonth ? monthLabel : '',
          dayLabel: dayLabel,
          title: formatDateRange(startRow.from, endRow.from),
          segments: segments || {}
        };
      }

      function eventCategorySegment(event) {
        return categoryName(event) || 'Uncategorized';
      }

      function addVolumeSegment(segments, key, count) {
        if (!key) key = 'Uncategorized';
        segments[key] = (segments[key] || 0) + (count || 0);
      }

      function mergeVolumeSegments(rows, start, end) {
        var segments = {};
        for (var i = start; i <= end; i++) {
          var rowSegments = rows[i].segments || {};
          for (var key in rowSegments) {
            if (rowSegments.hasOwnProperty(key)) addVolumeSegment(segments, key, rowSegments[key]);
          }
        }
        return segments;
      }

      function topVolumeSegments(rows, maxSegments) {
        var counts = {};
        for (var i = 0; i < rows.length; i++) {
          var rowSegments = rows[i].segments || {};
          for (var key in rowSegments) {
            if (rowSegments.hasOwnProperty(key)) addVolumeSegment(counts, key, rowSegments[key]);
          }
        }

        var entries = mapEntries(counts);
        if (!entries.length) return [];
        var limit = Math.max(2, maxSegments || 6);
        var segments = [];
        var shown = Math.min(entries.length, limit);
        if (entries.length > limit) shown = limit - 1;
        for (var e = 0; e < shown; e++) {
          segments.push({ key: entries[e].key, label: entries[e].key });
        }
        if (entries.length > limit) {
          segments.push({ key: '__OTHER__', label: 'Other', other: true });
        }
        return segments;
      }

      function renderLocalStyles() {
        return '<style>'
          + '.decidr-audit-filter-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3);}'
          + '.decidr-audit-filter-help{color:var(--text-secondary);font-size:var(--text-small);line-height:1.4;margin-top:4px;}'
          + '.decidr-audit-filter-dirty{border:1px solid var(--border-default);border-radius:var(--border-radius-md);background:var(--bg-surface);color:var(--text-secondary);font-size:var(--text-xs);font-weight:var(--weight-semibold);padding:6px 8px;white-space:nowrap;}'
          + '.decidr-audit-filter-grid{display:grid;grid-template-columns:repeat(4,minmax(170px,1fr));gap:var(--space-3);align-items:end;}'
          + '.decidr-audit-filter-actions{display:flex;gap:var(--space-2);align-items:end;justify-content:flex-end;}'
          + '.decidr-audit-volume-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-2);}'
          + '.decidr-audit-volume-subtitle{color:var(--text-secondary);font-size:var(--text-small);line-height:1.4;margin-top:4px;}'
          + '.decidr-audit-volume-summary{border:1px solid var(--border-default);border-radius:var(--border-radius-md);background:var(--bg-surface);color:var(--text-secondary);font-size:var(--text-xs);font-weight:var(--weight-semibold);padding:6px 8px;white-space:nowrap;}'
          + '.decidr-audit-volume-legend{display:flex;flex-wrap:wrap;gap:6px;margin:var(--space-2) 0;}'
          + '.decidr-audit-volume-legend span{border:1px solid var(--border-default);border-radius:var(--border-radius-md);background:var(--bg-surface);color:var(--text-secondary);font-size:var(--text-xs);padding:5px 7px;}'
          + '.decidr-audit-volume-legend strong{color:var(--text-primary);font-weight:var(--weight-semibold);}'
          + '.decidr-audit-volume-stack-legend{display:flex;flex-wrap:wrap;gap:8px 12px;margin:0 0 var(--space-2);color:var(--text-secondary);font-size:var(--text-xs);}'
          + '.decidr-audit-volume-stack-legend span{display:inline-flex;align-items:center;gap:5px;min-width:0;}'
          + '.decidr-audit-volume-segment-swatch{width:9px;height:9px;border-radius:2px;display:inline-block;box-shadow:0 0 0 1px rgba(255,255,255,.12) inset;}'
          + '.decidr-audit-volume-note{color:var(--text-tertiary);font-size:var(--text-xs);line-height:1.45;margin-bottom:var(--space-2);}'
          + '.decidr-audit-volume-axis{display:flex;justify-content:space-between;color:var(--text-tertiary);font-size:var(--text-xs);border-bottom:1px solid var(--border-subtle);padding-bottom:3px;margin-bottom:4px;}'
          + '.decidr-audit-volume-chart{display:grid;gap:3px;align-items:end;min-height:144px;}'
          + '.decidr-audit-volume-bucket{min-width:0;display:flex;flex-direction:column;justify-content:flex-end;gap:3px;height:144px;}'
          + '.decidr-audit-volume-count{height:15px;color:var(--text-tertiary);font-size:10px;text-align:center;line-height:1;}'
          + '.decidr-audit-volume-bar{width:100%;background:var(--accent-primary);border-radius:var(--border-radius-sm) var(--border-radius-sm) 0 0;opacity:.9;overflow:hidden;}'
          + '.decidr-audit-volume-bar.stacked{display:flex;flex-direction:column-reverse;background:var(--bg-surface);box-shadow:0 0 0 1px rgba(255,255,255,.06) inset;}'
          + '.decidr-audit-volume-bar.empty{background:var(--border-default);opacity:.45;}'
          + '.decidr-audit-volume-segment{width:100%;min-height:1px;}'
          + '.decidr-audit-volume-segment-c0{background:#818cf8;}'
          + '.decidr-audit-volume-segment-c1{background:#34d399;}'
          + '.decidr-audit-volume-segment-c2{background:#f59e0b;}'
          + '.decidr-audit-volume-segment-c3{background:#22d3ee;}'
          + '.decidr-audit-volume-segment-c4{background:#f472b6;}'
          + '.decidr-audit-volume-segment-c5{background:#94a3b8;}'
          + '.decidr-audit-volume-label{height:42px;color:var(--text-tertiary);font-size:10px;line-height:1.15;text-align:center;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}'
          + '.decidr-audit-volume-month{color:var(--text-secondary);font-weight:var(--weight-semibold);min-height:12px;}'
          + '.decidr-audit-volume-day{color:var(--text-tertiary);min-height:12px;}'
          + '.decidr-audit-event-group-title{display:flex;align-items:center;gap:7px;color:var(--text-secondary);font-size:var(--text-small);font-weight:var(--weight-semibold);}'
          + '.decidr-audit-event-group-dot{width:8px;height:8px;border-radius:50%;background:var(--accent-primary);box-shadow:0 0 0 3px rgba(129,140,248,.12);}'
          + '.decidr-audit-event-group-open{background:#818cf8;}'
          + '.decidr-audit-event-group-acknowledged{background:#22d3ee;}'
          + '.decidr-audit-event-group-resolved{background:#34d399;}'
          + '.decidr-audit-event-group-archived{background:#94a3b8;}'
          + '@media (max-width:960px){.decidr-audit-filter-grid{grid-template-columns:1fr 1fr;}.decidr-audit-filter-actions{justify-content:stretch;}.decidr-audit-filter-actions button{flex:1;}.decidr-audit-volume-head{flex-direction:column;}.decidr-audit-volume-summary{white-space:normal;}}'
          + '@media (max-width:640px){.decidr-audit-filter-grid{grid-template-columns:1fr;}}'
          + '</style>';
      }

      function renderEventRow(event) {
        var decisions = linkedDecisionTitles(event);
        var project = projectName(event.projectId);
        var cat = categoryName(event) || 'Uncategorized';
        var occurred = event.occurredAt || event.createdAt;
        var source = event.createdByClient || '';
        var linkCount = Array.isArray(event.links) ? event.links.length : 0;
        var revisionCount = Array.isArray(event.revisions) ? event.revisions.length : 0;
        var summary = event.summary ? UI.truncate(event.summary, 180) : '';

        var html = '<div class="decidr-card decidr-audit-dashboard-row" data-entity-type="audit_event" data-entity-id="' + UI.escapeHtml(event.id) + '"'
          + ' style="display:grid;grid-template-columns:168px minmax(240px,1fr) minmax(190px,280px);gap:var(--space-4);align-items:start;cursor:pointer;">';
        html += '<div style="display:flex;flex-direction:column;gap:4px;padding-top:2px;">'
          + '<span style="color:var(--text-secondary);font-size:var(--text-xs);font-weight:var(--weight-semibold);line-height:1.35;">' + UI.escapeHtml(occurred ? formatDateTime(occurred) : 'No event date') + '</span>'
          + '</div>';
        html += '<div style="min-width:0;">'
          + '<div style="font-size:var(--text-body);font-weight:var(--weight-semibold);color:var(--text-primary);line-height:1.35;">' + UI.escapeHtml(event.title || 'Untitled event') + '</div>'
          + (summary ? '<div style="margin-top:4px;color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;">' + UI.escapeHtml(summary) + '</div>' : '')
          + '<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-2);color:var(--text-tertiary);font-size:var(--text-xs);">'
          + '<span>' + UI.escapeHtml(cat) + '</span>'
          + (source ? '<span>' + UI.escapeHtml(source) + '</span>' : '')
          + (linkCount ? '<span>' + linkCount + ' evidence link' + (linkCount === 1 ? '' : 's') + '</span>' : '')
          + (revisionCount ? '<span>' + revisionCount + ' revision' + (revisionCount === 1 ? '' : 's') + '</span>' : '')
          + '</div>'
          + '</div>';
        html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);min-width:0;">'
          + (project ? '<div style="color:var(--text-secondary);font-size:var(--text-small);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(project) + '</div>' : '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No project label</div>')
          + (decisions.length ? '<div style="color:var(--text-tertiary);font-size:var(--text-xs);line-height:1.4;">' + UI.escapeHtml(decisions.slice(0, 2).join(', ')) + (decisions.length > 2 ? ' +' + (decisions.length - 2) : '') + '</div>' : '<div style="color:var(--text-tertiary);font-size:var(--text-xs);">No linked decisions</div>')
          + '<div style="margin-top:2px;color:var(--accent-primary);font-size:var(--text-xs);font-weight:var(--weight-semibold);">View evidence</div>'
          + '</div>';
        html += '</div>';
        return html;
      }

      function renderEventGroup(status, events) {
        if (!events.length) return '';
        var html = '<div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3);">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);padding:0 var(--space-1);">'
          + '<div class="decidr-audit-event-group-title"><span class="decidr-audit-event-group-dot decidr-audit-event-group-' + UI.escapeHtml(String(status || 'OTHER').toLowerCase()) + '"></span>' + UI.escapeHtml(statusLabel(status)) + '</div>'
          + '<span style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);">' + UI.escapeHtml(String(events.length)) + ' loaded</span>'
          + '</div>';
        for (var i = 0; i < events.length; i++) html += renderEventRow(events[i]);
        html += '</div>';
        return html;
      }

      function renderEventList() {
        var events = visibleEvents();
        var html = '<div class="decidr-section">';
        html += '<div class="decidr-section-header">Review Queue <span class="decidr-section-count">('
          + state.events.length + ' of ' + state.total + ')</span></div>';
        if (state.error) {
          html += UI.emptyState('Could not load audit events for these filters.');
        } else if (!events.length && !state.loading) {
          html += UI.emptyState('No audit events match these filters.');
        } else {
          var grouped = { OPEN: [], ACKNOWLEDGED: [], RESOLVED: [], ARCHIVED: [], OTHER: [] };
          for (var i = 0; i < events.length; i++) {
            var status = String(events[i].status || 'OPEN').toUpperCase();
            if (!grouped[status]) status = 'OTHER';
            grouped[status].push(events[i]);
          }
          html += '<div style="display:flex;flex-direction:column;gap:var(--space-3);">';
          html += renderEventGroup('OPEN', grouped.OPEN);
          html += renderEventGroup('ACKNOWLEDGED', grouped.ACKNOWLEDGED);
          html += renderEventGroup('RESOLVED', grouped.RESOLVED);
          html += renderEventGroup('ARCHIVED', grouped.ARCHIVED);
          html += renderEventGroup('OTHER', grouped.OTHER);
          html += '</div>';
        }
        if (state.loading) html += '<div style="padding:var(--space-4);">' + UI.loadingSpinner('Loading audit events...') + '</div>';
        if (!state.loading && state.events.length < state.total) {
          html += '<button id="decidr-audit-load-more" style="width:100%;margin-top:var(--space-3);min-height:36px;border:1px solid var(--border-default);border-radius:var(--border-radius-md);background:var(--bg-surface);color:var(--text-primary);font-weight:var(--weight-semibold);cursor:pointer;">Load more</button>';
        }
        html += '</div>';
        return html;
      }

      function render() {
        var events = state.events || [];
        var categoryRows = mapEntries(countBy(events, categoryName));
        for (var i = 0; i < categoryRows.length; i++) {
          for (var c = 0; c < state.categories.length; c++) {
            if (state.categories[c].name === categoryRows[i].key) categoryRows[i].id = state.categories[c].id;
          }
        }
        var statusRows = mapEntries(countBy(events, function(event) {
          return String(event.status || 'OPEN').toUpperCase();
        }));
        var projectCounts = {};
        for (var pi = 0; pi < events.length; pi++) {
          var projectKey = events[pi].projectId || '';
          projectCounts[projectKey] = (projectCounts[projectKey] || 0) + 1;
        }
        var projectRows = [];
        for (var projectId in projectCounts) {
          if (projectCounts.hasOwnProperty(projectId)) {
            projectRows.push({
              id: projectId,
              key: projectName(projectId) || 'No project',
              count: projectCounts[projectId]
            });
          }
        }
        projectRows.sort(function(a, b) { return b.count - a.count || a.key.localeCompare(b.key); });

        var html = renderLocalStyles() + '<div style="max-width:1280px;margin:0 auto;padding:var(--space-6) var(--space-4);font-family:var(--font-sans);color:var(--text-primary);">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-4);">'
          + '<div><div style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;margin-bottom:4px;">Auditability</div>'
          + '<h1 style="font-size:var(--text-h1);font-weight:var(--weight-bold);margin:0;">Audit Overview</h1>'
          + '<div style="color:var(--text-secondary);font-size:var(--text-small);margin-top:4px;">Review what changed, what needs attention, and what evidence supports it.</div></div>'
          + UI.orgPicker(state.organizations, state.activeOrgId, { defaultOrgId: state.defaultOrgId })
          + '</div>';
        html += renderScopeSummary();
        html += renderStatCards();
        html += renderInsightSummary();
        html += renderFilters();
        html += '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-4);margin-top:var(--space-5);">'
          + renderBreakdown('Status', statusRows, { attr: 'data-audit-status', max: 6 })
          + renderBreakdown('Categories', categoryRows, { attr: 'data-audit-category-id', max: 8 })
          + renderBreakdown('Projects', projectRows, { attr: 'data-audit-project-id', max: 8 })
          + '</div>';
        html += '<div style="margin-top:var(--space-5);">' + renderTimelineBars() + '</div>';
        html += '<div style="margin-top:var(--space-5);">' + renderEventList() + '</div>';
        html += '</div>';

        container.innerHTML = html;
        wireInteractions();
      }

      function updateFiltersFromControls() {
        var search = container.querySelector('#decidr-audit-filter-search');
        var status = container.querySelector('#decidr-audit-filter-status');
        var category = container.querySelector('#decidr-audit-filter-category');
        var project = container.querySelector('#decidr-audit-filter-project');
        var decision = container.querySelector('#decidr-audit-filter-decision');
        var range = container.querySelector('#decidr-audit-filter-range');
        var from = container.querySelector('#decidr-audit-filter-from');
        var to = container.querySelector('#decidr-audit-filter-to');
        var sort = container.querySelector('#decidr-audit-filter-sort');
        state.filters.search = search ? search.value : '';
        state.filters.status = status ? status.value : '';
        state.filters.categoryId = category ? category.value : '';
        state.filters.projectId = project ? project.value : '';
        state.filters.decisionId = decision ? decision.value : '';
        state.filters.range = range ? range.value : '30';
        state.filters.occurredFrom = from ? from.value : '';
        state.filters.occurredTo = to ? to.value : '';
        state.filters.sort = sort ? sort.value : 'status';
      }

      function wireInteractions() {
        var apply = container.querySelector('#decidr-audit-filter-apply');
        if (apply) {
          apply.addEventListener('click', function() {
            updateFiltersFromControls();
            fetchEvents(true);
          });
        }

        var clear = container.querySelector('#decidr-audit-filter-clear');
        if (clear) {
          clear.addEventListener('click', function() {
            state.filters = {
              range: '30',
              status: '',
              categoryId: '',
              projectId: '',
              decisionId: '',
              search: '',
              occurredFrom: '',
              occurredTo: '',
              sort: 'status'
            };
            fetchEvents(true);
          });
        }

        var autoControls = container.querySelectorAll('#decidr-audit-filter-status,#decidr-audit-filter-category,#decidr-audit-filter-project,#decidr-audit-filter-decision,#decidr-audit-filter-range,#decidr-audit-filter-sort');
        for (var i = 0; i < autoControls.length; i++) {
          autoControls[i].addEventListener('change', function() {
            updateFiltersFromControls();
            state.filtersDirty = true;
            render();
          });
        }

        var search = container.querySelector('#decidr-audit-filter-search');
        if (search) {
          search.addEventListener('input', function() {
            updateFiltersFromControls();
            state.filtersDirty = true;
          });
          search.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
              updateFiltersFromControls();
              fetchEvents(true);
            }
          });
        }

        var dateControls = container.querySelectorAll('#decidr-audit-filter-from,#decidr-audit-filter-to');
        for (var dc = 0; dc < dateControls.length; dc++) {
          dateControls[dc].addEventListener('change', function() {
            updateFiltersFromControls();
            state.filtersDirty = true;
            render();
          });
        }

        var statusRows = container.querySelectorAll('[data-audit-status]');
        for (var s = 0; s < statusRows.length; s++) {
          statusRows[s].addEventListener('click', function() {
            state.filters.status = this.getAttribute('data-audit-status') || '';
            fetchEvents(true);
          });
        }

        var categoryRows = container.querySelectorAll('[data-audit-category-id]');
        for (var c = 0; c < categoryRows.length; c++) {
          categoryRows[c].addEventListener('click', function() {
            state.filters.categoryId = this.getAttribute('data-audit-category-id') || '';
            fetchEvents(true);
          });
        }

        var projectRows = container.querySelectorAll('[data-audit-project-id]');
        for (var p = 0; p < projectRows.length; p++) {
          projectRows[p].addEventListener('click', function() {
            state.filters.projectId = this.getAttribute('data-audit-project-id') || '';
            fetchEvents(true);
          });
        }

        var more = container.querySelector('#decidr-audit-load-more');
        if (more) {
          more.addEventListener('click', function() { fetchEvents(false); });
        }

        wireEntityClicks(container);
        wireOrgPicker();
      }

      function wireEntityClicks(scope) {
        var clickables = scope.querySelectorAll('[data-entity-type][data-entity-id]');
        for (var i = 0; i < clickables.length; i++) {
          (function(el) {
            if (el._decidrAuditWired) return;
            el._decidrAuditWired = true;
            el.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              var entityType = el.getAttribute('data-entity-type');
              var entityId = el.getAttribute('data-entity-id');
              if (!entityType || !entityId) return;
              UI.SlideOut.open(entityType, entityId, {
                source: container,
                onMutate: function() { fetchEvents(true); }
              });
            });
          })(clickables[i]);
        }
      }

      function showOrgAuthPrompt(orgId) {
        container.innerHTML = '<div style="padding:var(--space-6);text-align:center;">'
          + '<p style="color:var(--text-secondary);margin-bottom:var(--space-4);">No authentication for this organization.</p>'
          + '<button id="decidr-org-auth-btn" style="padding:8px 16px;border:1px solid var(--accent-primary);border-radius:var(--border-radius-md);background:var(--accent-primary);color:white;cursor:pointer;font-family:var(--font-sans);">Authenticate</button>'
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

      function wireOrgPicker() {
        var toggle = container.querySelector('#decidr-org-picker-toggle');
        var menu = container.querySelector('#decidr-org-picker-menu');
        if (!toggle || !menu) return;

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
              state.defaultOrgId = starOrgId;
              render();
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
            UI.SlideOut.open('organization-settings', settingsOrgId, {
              source: container,
              onMutate: function() { fetchEvents(true); }
            });
            return;
          }

          var btn = e.target.closest('[data-org-id]');
          if (!btn) return;
          var orgId = btn.getAttribute('data-org-id');
          if (orgId === state.activeOrgId) {
            menu.classList.remove('open');
            return;
          }
          state.activeOrgId = orgId;
          menu.classList.remove('open');
          container.innerHTML = UI.loadingSpinner('Switching organization...');
          API.switchOrg(orgId).then(function() {
            return Promise.all([
              API.listAuditCategories({ take: 200 }).then(unwrapList).catch(function() { return []; }),
              API.listProjects({ take: 200 }).then(unwrapList).catch(function() { return []; }),
              API.listDecisions({ take: 200 }).then(unwrapList).catch(function() { return []; })
            ]);
          }).then(function(results) {
            state.categories = results[0] || [];
            state.projects = results[1] || [];
            state.decisions = results[2] || [];
            fetchEvents(true);
          }).catch(function(err) {
            console.error('[decidr] Org switch failed:', err);
            showOrgAuthPrompt(orgId);
          });
        });
      }
    }, _orgId);
  };
})();

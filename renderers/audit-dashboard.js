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
            from.setDate(from.getDate() - days);
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
          { value: state.total, label: 'Matching Events', opts: { animDelay: 0.05 } },
          { value: statusCounts.OPEN || 0, label: 'Open', opts: { animDelay: 0.10 } },
          { value: statusCounts.ACKNOWLEDGED || 0, label: 'Acknowledged', opts: { animDelay: 0.15 } },
          { value: statusCounts.RESOLVED || 0, label: 'Resolved', opts: { animDelay: 0.20 } },
          { value: linkedCount, label: 'Decision Links', opts: { animDelay: 0.25 } },
          { value: categories.length, label: 'Categories', opts: { animDelay: 0.30 } }
        ]);
      }

      function controlStyle() {
        return 'width:100%;min-height:36px;border:1px solid var(--border-default);'
          + 'border-radius:var(--border-radius-md);background:var(--bg-surface);'
          + 'color:var(--text-primary);font:inherit;padding:8px 10px;';
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
        html += '<div style="display:grid;grid-template-columns:minmax(220px,2fr) repeat(4,minmax(150px,1fr));gap:var(--space-3);align-items:end;">';

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

        html += '</div>';

        html += '<div style="display:grid;grid-template-columns:minmax(160px,1fr) minmax(150px,1fr) minmax(150px,1fr) minmax(180px,2fr) auto auto;gap:var(--space-3);align-items:end;margin-top:var(--space-3);">';

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
          + ' placeholder="' + (customDates ? '' : 'Custom') + '" style="' + controlStyle() + '"' + (customDates ? '' : ' disabled') + '></label>';

        html += labelHtml('To')
          + '<input id="decidr-audit-filter-to" type="' + (customDates ? 'date' : 'text') + '" value="' + UI.escapeHtml(customDates ? formatDateInput(f.occurredTo) : '') + '"'
          + ' placeholder="' + (customDates ? '' : 'Custom') + '" style="' + controlStyle() + '"' + (customDates ? '' : ' disabled') + '></label>';

        html += labelHtml('Linked Decision')
          + '<select id="decidr-audit-filter-decision" style="' + controlStyle() + '">'
          + option('', 'All decisions', f.decisionId);
        for (var d = 0; d < state.decisions.length; d++) {
          html += option(state.decisions[d].id, state.decisions[d].title || state.decisions[d].id, f.decisionId);
        }
        html += '</select></label>';

        html += '<button id="decidr-audit-filter-apply" style="min-height:36px;padding:0 14px;border:1px solid var(--accent-primary);border-radius:var(--border-radius-md);background:var(--accent-primary);color:white;font-weight:var(--weight-semibold);cursor:pointer;">Apply</button>';
        html += '<button id="decidr-audit-filter-clear" style="min-height:36px;padding:0 14px;border:1px solid var(--border-default);border-radius:var(--border-radius-md);background:var(--bg-surface);color:var(--text-primary);font-weight:var(--weight-semibold);cursor:pointer;">Clear</button>';

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
        var buckets = countBy(state.events, function(event) {
          var raw = event.occurredAt || event.createdAt;
          if (!raw) return 'Unknown';
          return raw.slice(0, 10);
        });
        var rows = mapEntries(buckets).sort(function(a, b) { return a.key.localeCompare(b.key); });
        var max = 1;
        for (var i = 0; i < rows.length; i++) max = Math.max(max, rows[i].count);

        var html = '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-section-header">Event Volume</div>';
        if (!rows.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No event volume for this filter.</div>';
        } else {
          html += '<div style="display:flex;align-items:end;gap:4px;min-height:92px;padding-top:var(--space-2);">';
          for (var b = Math.max(0, rows.length - 28); b < rows.length; b++) {
            var height = Math.max(8, Math.round((rows[b].count / max) * 80));
            html += '<div title="' + UI.escapeHtml(rows[b].key + ': ' + rows[b].count) + '" style="flex:1;min-width:6px;height:' + height + 'px;background:var(--accent-primary);border-radius:var(--border-radius-sm) var(--border-radius-sm) 0 0;opacity:.85;"></div>';
          }
          html += '</div>';
        }
        html += '</div>';
        return html;
      }

      function renderEventRow(event) {
        var decisions = linkedDecisionTitles(event);
        var project = projectName(event.projectId);
        var cat = categoryName(event) || 'Uncategorized';
        var occurred = event.occurredAt || event.createdAt;
        var source = event.createdByClient || '';
        var linkCount = Array.isArray(event.links) ? event.links.length : 0;
        var summary = event.summary ? UI.truncate(event.summary, 180) : '';

        var html = '<div class="decidr-card decidr-audit-dashboard-row" data-entity-type="audit_event" data-entity-id="' + UI.escapeHtml(event.id) + '"'
          + ' style="display:grid;grid-template-columns:140px minmax(240px,1fr) minmax(180px,260px);gap:var(--space-4);align-items:start;">';
        html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);">'
          + UI.statusBadge(event.status || 'OPEN')
          + '<span style="color:var(--text-tertiary);font-size:var(--text-xs);">' + UI.escapeHtml(occurred ? UI.formatDate(occurred) : '') + '</span>'
          + '</div>';
        html += '<div style="min-width:0;">'
          + '<div style="font-size:var(--text-body);font-weight:var(--weight-semibold);color:var(--text-primary);line-height:1.35;">' + UI.escapeHtml(event.title || 'Untitled event') + '</div>'
          + (summary ? '<div style="margin-top:4px;color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;">' + UI.escapeHtml(summary) + '</div>' : '')
          + '<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-2);color:var(--text-tertiary);font-size:var(--text-xs);">'
          + '<span>' + UI.escapeHtml(cat) + '</span>'
          + (source ? '<span>' + UI.escapeHtml(source) + '</span>' : '')
          + (linkCount ? '<span>' + linkCount + ' links</span>' : '')
          + '</div>'
          + '</div>';
        html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);min-width:0;">'
          + (project ? '<div style="color:var(--text-secondary);font-size:var(--text-small);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(project) + '</div>' : '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No project label</div>')
          + (decisions.length ? '<div style="color:var(--text-tertiary);font-size:var(--text-xs);line-height:1.4;">' + UI.escapeHtml(decisions.slice(0, 2).join(', ')) + (decisions.length > 2 ? ' +' + (decisions.length - 2) : '') + '</div>' : '<div style="color:var(--text-tertiary);font-size:var(--text-xs);">No linked decisions</div>')
          + '</div>';
        html += '</div>';
        return html;
      }

      function renderEventList() {
        var events = visibleEvents();
        var html = '<div class="decidr-section">';
        html += '<div class="decidr-section-header">Audit Events <span class="decidr-section-count">('
          + state.events.length + ' of ' + state.total + ')</span></div>';
        if (state.error) {
          html += UI.emptyState('Could not load audit events for these filters.');
        } else if (!events.length && !state.loading) {
          html += UI.emptyState('No audit events match these filters.');
        } else {
          html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
          for (var i = 0; i < events.length; i++) html += renderEventRow(events[i]);
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

        var html = '<div style="max-width:1280px;margin:0 auto;padding:var(--space-6) var(--space-4);font-family:var(--font-sans);color:var(--text-primary);">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-6);">'
          + '<div><h1 style="font-size:var(--text-h1);font-weight:var(--weight-bold);margin:0;">Audit Dashboard</h1>'
          + '<div style="color:var(--text-secondary);font-size:var(--text-small);margin-top:4px;">Operational Audit Trail</div></div>'
          + UI.orgPicker(state.organizations, state.activeOrgId, { defaultOrgId: state.defaultOrgId })
          + '</div>';
        html += renderStatCards();
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
            if (state.filters.range !== 'custom') {
              fetchEvents(true);
            } else {
              render();
            }
          });
        }

        var search = container.querySelector('#decidr-audit-filter-search');
        if (search) {
          search.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
              updateFiltersFromControls();
              fetchEvents(true);
            }
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

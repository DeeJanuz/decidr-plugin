(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_audit_reports = function(container, data, meta) {
    container.innerHTML = '';

    var _orgId = (data && data.organization_id) ? data.organization_id : null;

    window.__decidrAPI.withReady(container, meta, function() {
      var UI = window.__decidrUI;
      var API = window.__decidrAPI;

      var state = {
        loading: true,
        running: false,
        saving: false,
        error: null,
        activeOrgId: null,
        defaultOrgId: null,
        organizations: [],
        projects: [],
        categories: [],
        members: [],
        reports: [],
        fields: [],
        currentReport: null,
        mode: (data && data.mode) || ((data && (data.report_id || data.reportId)) ? 'view' : 'gallery'),
        builderTab: 'scope',
        fieldSearch: '',
        selectedReportId: (data && (data.report_id || data.reportId)) || '',
        previewDirty: false,
        preview: { rows: [], total: 0, selectedColumns: [] },
        filters: {
          status: (data && data.status) || '',
          categoryId: (data && (data.category_id || data.categoryId)) || '',
          occurredFrom: '',
          occurredTo: '',
          search: ''
        },
        share: { userId: '', role: 'VIEWER' },
        draft: defaultDraft(data)
      };

      container.innerHTML = UI.loadingSpinner('Loading audit reports...');

      API.resolveAndBindTargetOrg({
        pushedOrgId: data && data.organization_id ? data.organization_id : null
      }).then(function(preflight) {
        state.organizations = preflight.organizations || [];
        state.defaultOrgId = preflight.defaultOrgId || null;
        state.activeOrgId = API.getActiveOrgId()
          || (state.organizations.length ? state.organizations[0].id : null);
        return loadReferenceData();
      }).then(function() {
        state.loading = false;
        if (state.selectedReportId) {
          state.mode = 'view';
          return loadReport(state.selectedReportId);
        }
        if (state.mode === 'builder') {
          if (state.draft.projectIds.length) return loadFields(false).then(runReport);
          render();
          return Promise.resolve();
        }
        render();
        return Promise.resolve();
      }).catch(function(err) {
        state.loading = false;
        state.error = err;
        render();
      });

      function defaultDraft(pushData) {
        var projectId = pushData && (pushData.project_id || pushData.projectId);
        return {
          name: 'New audit report',
          description: '',
          visibility: 'PRIVATE',
          projectIds: projectId ? [projectId] : [],
          datePreset: 'all',
          dateRange: null,
          logic: { rules: [] },
          selectedColumns: [
            { field: 'occurredAt', label: 'Occurred' },
            { field: 'status', label: 'Status' },
            { field: 'category', label: 'Category' },
            { field: 'title', label: 'Title' },
            { field: 'decisionLinks.titles', label: 'Linked Decisions' }
          ],
          sort: []
        };
      }

      function unwrapList(resp) {
        if (resp && Array.isArray(resp.data)) return resp.data;
        if (Array.isArray(resp)) return resp;
        return [];
      }

      function loadReferenceData() {
        return Promise.all([
          API.listProjects({ take: 200 }).then(unwrapList).catch(function() { return []; }),
          API.listAuditCategories({ take: 200 }).then(unwrapList).catch(function() { return []; }),
          API.listAuditReports({ take: 200 }).then(unwrapList).catch(function() { return []; }),
          API.listMembers().then(unwrapList).catch(function() { return []; })
        ]).then(function(results) {
          state.projects = results[0] || [];
          state.categories = results[1] || [];
          state.reports = results[2] || [];
          state.members = results[3] || [];
        });
      }

      function loadFields(refresh) {
        var projectIds = state.draft.projectIds || [];
        return API.getAuditReportFields({
          projectIds: projectIds.join(','),
          refresh: refresh ? 'true' : undefined
        }).then(function(resp) {
          state.fields = (resp && resp.fields) || [];
          render();
        });
      }

      function loadReport(id) {
        state.loading = true;
        render();
        return API.getAuditReport(id).then(function(report) {
          state.selectedReportId = id;
          state.currentReport = report;
          state.draft = {
            name: report.name || 'Untitled report',
            description: report.description || '',
            visibility: report.visibility || 'PRIVATE',
            projectIds: Array.isArray(report.projectIds) ? report.projectIds : [],
            datePreset: report.datePreset || 'all',
            dateRange: report.dateRange || null,
            logic: report.logic || { rules: [] },
            selectedColumns: normalizeColumns(report.selectedColumns),
            sort: Array.isArray(report.sort) ? report.sort : [],
            groupBy: report.groupBy || null
          };
          state.loading = false;
          return loadFields(false).then(runReport);
        }).catch(function(err) {
          state.loading = false;
          state.error = err;
          render();
        });
      }

      function normalizeColumns(cols) {
        if (!Array.isArray(cols) || !cols.length) return defaultDraft({}).selectedColumns;
        return cols.map(function(col) {
          if (typeof col === 'string') return { field: col, label: col };
          return {
            field: col.field || col.path || '',
            label: col.label || col.name || col.field || col.path || ''
          };
        }).filter(function(col) { return col.field; });
      }

      function buildRunPayload() {
        var filters = {
          status: state.filters.status || undefined,
          categoryId: state.filters.categoryId || undefined,
          projectIds: state.draft.projectIds,
          occurredFrom: state.filters.occurredFrom || undefined,
          occurredTo: state.filters.occurredTo || undefined,
          search: state.filters.search || undefined
        };
        return {
          reportId: state.selectedReportId || undefined,
          name: state.draft.name,
          description: state.draft.description,
          visibility: state.draft.visibility,
          projectIds: state.draft.projectIds,
          datePreset: state.draft.datePreset,
          dateRange: state.draft.dateRange,
          logic: state.draft.logic,
          selectedColumns: state.draft.selectedColumns,
          sort: state.draft.sort,
          filters: filters,
          take: 200
        };
      }

      function runReport() {
        if (!state.draft.projectIds.length) {
          state.preview = { rows: [], total: 0, selectedColumns: state.draft.selectedColumns };
          state.previewDirty = false;
          render();
          return Promise.resolve();
        }
        state.running = true;
        state.error = null;
        render();
        return API.runAuditReport(buildRunPayload()).then(function(resp) {
          state.preview = {
            rows: resp.rows || [],
            total: resp.total || 0,
            selectedColumns: resp.selectedColumns || state.draft.selectedColumns
          };
          state.running = false;
          state.previewDirty = false;
          render();
        }).catch(function(err) {
          state.running = false;
          state.error = err;
          render();
        });
      }

      function saveReport() {
        syncDraftFromControls();
        if (!state.draft.name.trim()) {
          state.error = new Error('Report name is required.');
          render();
          return;
        }
        state.saving = true;
        render();
        var payload = {
          name: state.draft.name,
          description: state.draft.description,
          visibility: state.draft.visibility,
          projectIds: state.draft.projectIds,
          datePreset: state.draft.datePreset,
          dateRange: state.draft.dateRange,
          logic: state.draft.logic,
          selectedColumns: state.draft.selectedColumns,
          sort: state.draft.sort
        };
        var op = state.selectedReportId
          ? API.updateAuditReport(state.selectedReportId, payload).then(function() { return { id: state.selectedReportId }; })
          : API.createAuditReport(payload);
        op.then(function(result) {
          state.selectedReportId = result.id || state.selectedReportId;
          state.mode = 'view';
          return loadReferenceData();
        }).then(function() {
          state.saving = false;
          if (state.selectedReportId) return loadReport(state.selectedReportId);
          return runReport();
        }).catch(function(err) {
          state.saving = false;
          state.error = err;
          render();
        });
      }

      function exportCsv() {
        if (!state.selectedReportId) {
          state.error = new Error('Save the report before exporting CSV.');
          render();
          return;
        }
        API.exportAuditReportCsv(state.selectedReportId).then(function(result) {
          var blob = new Blob([result.text || ''], { type: 'text/csv;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = (state.draft.name || 'audit-report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.csv';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }).catch(function(err) {
          state.error = err;
          render();
        });
      }

      function shareReport() {
        if (!state.selectedReportId || !state.share.userId) return;
        API.shareAuditReport(state.selectedReportId, {
          userId: state.share.userId,
          role: state.share.role || 'VIEWER'
        }).then(function() {
          return loadReport(state.selectedReportId);
        }).catch(function(err) {
          state.error = err;
          render();
        });
      }

      function unshareReport(userId) {
        if (!state.selectedReportId || !userId) return;
        API.unshareAuditReport(state.selectedReportId, userId).then(function() {
          return loadReport(state.selectedReportId);
        }).catch(function(err) {
          state.error = err;
          render();
        });
      }

      function controlStyle(extra) {
        return 'width:100%;min-height:38px;border:1px solid var(--border-default);'
          + 'border-radius:var(--border-radius-md);background:var(--bg-surface);'
          + 'color:var(--text-primary);font:inherit;padding:8px 10px;' + (extra || '');
      }

      function smallButtonStyle(primary) {
        return 'min-height:38px;padding:0 14px;border:1px solid '
          + (primary ? 'var(--accent-primary)' : 'var(--border-default)')
          + ';border-radius:var(--border-radius-md);background:'
          + (primary ? 'var(--accent-primary)' : 'var(--bg-surface)')
          + ';color:' + (primary ? '#fff' : 'var(--text-primary)')
          + ';font-weight:var(--weight-semibold);font-size:var(--text-small);cursor:pointer;white-space:nowrap;';
      }

      function label(text) {
        return '<label style="display:flex;flex-direction:column;gap:var(--space-1);font-size:var(--text-xs);'
          + 'font-weight:var(--weight-semibold);color:var(--text-secondary);text-transform:uppercase;">'
          + UI.escapeHtml(text);
      }

      function option(value, text, selected) {
        return '<option value="' + UI.escapeHtml(value || '') + '"'
          + (String(value || '') === String(selected || '') ? ' selected' : '')
          + '>' + UI.escapeHtml(text || value || '') + '</option>';
      }

      function operatorChoices(type) {
        var base = [
          ['equals', 'equals'],
          ['not_equals', 'not equals'],
          ['contains', 'contains'],
          ['not_contains', 'does not contain'],
          ['is_empty', 'is empty'],
          ['is_not_empty', 'is not empty']
        ];
        var numberOps = [['gt', '>'], ['gte', '>='], ['lt', '<'], ['lte', '<='], ['between', 'between']];
        var dateOps = [['before', 'before'], ['after', 'after'], ['on', 'on'], ['within_last_days', 'within last days']];
        var ops = base.slice();
        if (type === 'NUMBER') ops = base.concat(numberOps);
        if (type === 'DATE') ops = base.concat(dateOps);
        if (type === 'BOOLEAN') ops = [['equals', 'is'], ['not_equals', 'is not'], ['is_empty', 'is empty'], ['is_not_empty', 'is not empty']];
        return ops;
      }

      function operatorOptions(type, selected) {
        var ops = operatorChoices(type);
        return ops.map(function(row) { return option(row[0], row[1], selected); }).join('');
      }

      function normalizeOperatorForField(fieldMeta, op) {
        var type = String((fieldMeta && fieldMeta.valueType) || '').toUpperCase();
        var ops = operatorChoices(type);
        for (var i = 0; i < ops.length; i++) {
          if (ops[i][0] === op) return op;
        }
        return 'equals';
      }

      function formatRuleValue(value) {
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'object') {
          try {
            return JSON.stringify(value);
          } catch (err) {
            return String(value);
          }
        }
        return String(value);
      }

      function splitRuleValues(value) {
        return String(value || '').split(',').map(function(part) {
          return part.trim();
        }).filter(function(part) { return part !== ''; });
      }

      function uniqueRuleValues(values) {
        var seen = Object.create(null);
        var output = [];
        for (var i = 0; i < values.length; i++) {
          var value = formatRuleValue(values[i]).trim();
          if (value === '' || seen[value]) continue;
          seen[value] = true;
          output.push(value);
        }
        return output;
      }

      function normalizedRuleValues(value) {
        if (Array.isArray(value)) return uniqueRuleValues(value);
        if (value === null || value === undefined || value === '') return [];
        return uniqueRuleValues([value]);
      }

      function usesMultiValueControl(fieldMeta, op) {
        var type = String((fieldMeta && fieldMeta.valueType) || '').toUpperCase();
        return type !== 'DATE' && type !== 'NUMBER' && (op === 'equals' || op === 'not_equals');
      }

      function renderRuleValueControl(index, cond, fieldMeta) {
        var op = cond.op || 'equals';
        if (usesMultiValueControl(fieldMeta, op)) {
          var selected = normalizedRuleValues(cond.value);
          var selectedMap = Object.create(null);
          for (var sv = 0; sv < selected.length; sv++) selectedMap[selected[sv]] = true;
          var distinct = uniqueRuleValues(Array.isArray(fieldMeta.distinctValues) ? fieldMeta.distinctValues : []);
          var distinctMap = Object.create(null);
          for (var dv = 0; dv < distinct.length; dv++) distinctMap[distinct[dv]] = true;
          var extras = selected.filter(function(value) { return !distinctMap[value]; });
          var html = '<div class="audit-rule-value-stack">';
          if (distinct.length) {
            html += '<div class="audit-rule-value-list" data-rule-values="' + index + '">';
            for (var i = 0; i < distinct.length; i++) {
              html += '<label class="audit-rule-value-option"><input type="checkbox" data-rule-value-option="' + index + '" value="' + UI.escapeHtml(distinct[i]) + '"' + (selectedMap[distinct[i]] ? ' checked' : '') + '><span>' + UI.escapeHtml(distinct[i]) + '</span></label>';
            }
            html += '</div>';
          } else {
            html += '<div class="audit-rule-empty-values">No cached values yet.</div>';
          }
          html += '<input data-rule-value-extra="' + index + '" value="' + UI.escapeHtml(extras.join(', ')) + '" placeholder="' + (distinct.length ? 'Add extra values, comma separated' : 'Values separated by commas') + '" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" style="' + controlStyle() + '">';
          html += '<div class="audit-rule-value-help">' + (selected.length ? UI.escapeHtml(String(selected.length)) + ' selected' : 'Select one or more values') + '</div>';
          html += '</div>';
          return html;
        }

        var rawValue = cond.value == null ? '' : (Array.isArray(cond.value) ? normalizedRuleValues(cond.value).join(', ') : formatRuleValue(cond.value));
        var input = '<input data-rule-value="' + index + '" list="audit-rule-values-' + index + '" value="' + UI.escapeHtml(rawValue) + '" placeholder="Value" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" style="' + controlStyle() + '">';
        if (Array.isArray(fieldMeta.distinctValues) && fieldMeta.distinctValues.length) {
          input += '<datalist id="audit-rule-values-' + index + '">';
          var values = uniqueRuleValues(fieldMeta.distinctValues);
          for (var v = 0; v < values.length; v++) {
            input += '<option value="' + UI.escapeHtml(values[v]) + '"></option>';
          }
          input += '</datalist>';
        }
        return input;
      }

      function fieldLabel(fieldPath) {
        for (var i = 0; i < state.fields.length; i++) {
          if (state.fields[i].fieldPath === fieldPath) {
            return state.fields[i].label || state.fields[i].displayName || state.fields[i].name || titleizeFieldPath(fieldPath);
          }
        }
        return titleizeFieldPath(fieldPath);
      }

      function titleizeFieldPath(fieldPath) {
        var raw = String(fieldPath || '');
        if (!raw) return '';
        var last = raw.split('.').pop();
        return last.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
      }

      function fieldGroupLabel(field) {
        var source = String((field && field.source) || '').toLowerCase();
        var path = String((field && field.fieldPath) || '').toLowerCase();
        if (path.indexOf('decision') !== -1) return 'Decision links';
        if (path.indexOf('project') !== -1) return 'Project';
        if (path.indexOf('source') !== -1 || source.indexOf('source') !== -1) return 'Source';
        if (path.indexOf('payload') === 0 || source.indexOf('payload') !== -1) return 'Payload fields';
        return 'Event basics';
      }

      function ruleFieldOptions(selectedField) {
        var html = '';
        var foundSelected = false;
        for (var i = 0; i < state.fields.length; i++) {
          var fieldPath = state.fields[i].fieldPath || '';
          if (!fieldPath) continue;
          if (fieldPath === selectedField) foundSelected = true;
          html += option(fieldPath, fieldLabel(fieldPath), selectedField);
        }
        if (selectedField && !foundSelected) {
          html = option(selectedField, fieldLabel(selectedField) + ' (saved field)', selectedField) + html;
        }
        return html;
      }

      function fieldMetaForPath(fieldPath) {
        for (var i = 0; i < state.fields.length; i++) {
          if (state.fields[i].fieldPath === fieldPath) return state.fields[i];
        }
        return {};
      }

      function projectName(projectId) {
        for (var i = 0; i < state.projects.length; i++) {
          if (state.projects[i].id === projectId) return state.projects[i].name || projectId;
        }
        return projectId;
      }

      function categoryName(categoryId) {
        for (var i = 0; i < state.categories.length; i++) {
          if (state.categories[i].id === categoryId) return state.categories[i].name || categoryId;
        }
        return categoryId;
      }

      function statusName(status) {
        var map = { OPEN: 'Open', ACKNOWLEDGED: 'Acknowledged', RESOLVED: 'Resolved', ARCHIVED: 'Archived' };
        return map[status] || status;
      }

      function operatorName(op) {
        var map = {
          equals: 'equals',
          not_equals: 'not equals',
          contains: 'contains',
          not_contains: 'does not contain',
          is_empty: 'is empty',
          is_not_empty: 'is not empty',
          gt: '>',
          gte: '>=',
          lt: '<',
          lte: '<=',
          between: 'between',
          before: 'before',
          after: 'after',
          on: 'on',
          within_last_days: 'within last days'
        };
        return map[op] || op || 'equals';
      }

      function ruleSummary(rule) {
        var cond = (rule && rule.if) || {};
        var then = (rule && rule.then) || {};
        var op = cond.op || 'equals';
        var needsValue = op !== 'is_empty' && op !== 'is_not_empty';
        var value = cond.value;
        if (Array.isArray(value)) value = '[' + normalizedRuleValues(value).join(', ') + ']';
        if (value === true) value = 'true';
        if (value === false) value = 'false';
        if (value == null || value === '') value = needsValue ? '[value]' : '';
        var action = then.include === false ? 'Exclude' : (then.label || (Array.isArray(then.labels) && then.labels[0]) ? 'Label' : 'Include');
        return action + ' where ' + fieldLabel(cond.field || 'field') + ' ' + operatorName(op) + (needsValue ? ' ' + value : '');
      }

      function activeFilterItems() {
        var items = [];
        var projectIds = state.draft.projectIds || [];
        if (projectIds.length) {
          var projectLabel = projectIds.length === 1 ? projectName(projectIds[0]) : projectIds.length + ' projects';
          items.push({ type: 'Project scope', value: projectLabel, locked: true });
        }
        if (state.filters.status) items.push({ type: 'Status', value: statusName(state.filters.status), clear: 'status' });
        if (state.filters.categoryId) items.push({ type: 'Category', value: categoryName(state.filters.categoryId), clear: 'category' });
        if (state.filters.occurredFrom || state.filters.occurredTo) {
          items.push({
            type: 'Date range',
            value: (state.filters.occurredFrom || 'Any') + ' to ' + (state.filters.occurredTo || 'Any'),
            clear: 'date'
          });
        }
        if (state.filters.search) items.push({ type: 'Search', value: state.filters.search, clear: 'search' });
        var rules = Array.isArray(state.draft.logic.rules) ? state.draft.logic.rules : [];
        for (var r = 0; r < rules.length; r++) {
          items.push({ type: 'Advanced', value: ruleSummary(rules[r]), ruleIndex: r });
        }
        return items;
      }

      function renderAppliedFilters() {
        var items = activeFilterItems();
        var html = '<div class="audit-filter-summary">';
        html += '<div class="audit-filter-summary-head">'
          + '<div class="decidr-section-header" style="margin:0;">Applied Filters</div>'
          + '<div class="decidr-badge">' + UI.escapeHtml(String(items.length)) + '</div></div>';
        html += '<div class="audit-filter-chip-row">';
        if (!items.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);">None yet</div>';
        }
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          html += '<div class="audit-filter-chip">'
            + '<span class="audit-filter-chip-type">' + UI.escapeHtml(item.type) + '</span>'
            + '<span class="audit-filter-chip-value">' + UI.escapeHtml(item.value) + '</span>';
          if (item.clear) {
            html += '<button class="audit-filter-chip-remove" data-clear-filter="' + UI.escapeHtml(item.clear) + '">×</button>';
          } else if (typeof item.ruleIndex === 'number') {
            html += '<button class="audit-filter-chip-remove" data-remove-rule="' + item.ruleIndex + '">×</button>';
          }
          html += '</div>';
        }
        html += '</div></div>';
        return html;
      }

      function renderStyles() {
        return '<style>'
          + '.audit-reports-shell{height:100%;max-width:1600px;margin:0 auto;padding:var(--space-5) var(--space-4);font-family:var(--font-sans);color:var(--text-primary);}'
          + '.audit-report-titlebar{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-3);}'
          + '.audit-report-toolbar{display:grid;grid-template-columns:minmax(190px,1fr) minmax(260px,1.5fr) minmax(130px,.7fr);gap:var(--space-3);align-items:end;padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);}'
          + '.audit-report-toolbar-actions{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:var(--space-2);justify-content:flex-end;align-items:center;border-top:1px solid var(--border-subtle);padding-top:var(--space-3);}'
          + '.audit-builder-workspace{display:grid;grid-template-columns:360px minmax(0,1fr) 310px;gap:var(--space-4);align-items:start;}'
          + '.audit-builder-panel{min-height:720px;max-height:calc(100vh - 230px);overflow:hidden;display:flex;flex-direction:column;}'
          + '.audit-builder-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:var(--space-3);border-bottom:1px solid var(--border-subtle);}'
          + '.audit-builder-tab{min-height:34px;border:1px solid transparent;border-radius:var(--border-radius-md);background:transparent;color:var(--text-secondary);font:inherit;font-size:var(--text-small);font-weight:var(--weight-semibold);cursor:pointer;}'
          + '.audit-builder-tab.active{background:var(--bg-surface);border-color:var(--border-default);color:var(--text-primary);}'
          + '.audit-builder-pane{padding:var(--space-4);overflow:auto;}'
          + '.audit-report-side{display:flex;flex-direction:column;gap:var(--space-4);}'
          + '.audit-report-gallery{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:var(--space-4);align-items:start;}'
          + '.audit-report-gallery-list{display:grid;gap:var(--space-3);}'
          + '.audit-report-gallery-card{border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);background:var(--bg-primary);padding:var(--space-4);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-3);align-items:center;}'
          + '.audit-report-stepper{display:grid;grid-template-columns:1fr;gap:6px;padding:var(--space-3);border-bottom:1px solid var(--border-subtle);}'
          + '.audit-report-step{min-height:34px;border:1px solid transparent;border-radius:var(--border-radius-md);background:transparent;color:var(--text-secondary);font:inherit;font-size:var(--text-small);font-weight:var(--weight-semibold);cursor:pointer;text-align:left;padding:0 10px;}'
          + '.audit-report-step.active{background:var(--bg-surface);border-color:var(--border-default);color:var(--text-primary);}'
          + '.audit-report-mode-actions{display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center;}'
          + '.audit-report-scope-grid{display:grid;grid-template-columns:1fr;gap:var(--space-3);}'
          + '.audit-filter-summary{border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);background:var(--bg-surface);padding:10px;margin-bottom:var(--space-4);}'
          + '.audit-filter-summary-head{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:8px;}'
          + '.audit-filter-chip-row{display:flex;flex-wrap:wrap;gap:6px;}'
          + '.audit-filter-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;border:1px solid var(--border-default);border-radius:var(--border-radius-md);background:var(--bg-primary);padding:5px 7px;font-size:var(--text-xs);}'
          + '.audit-filter-chip-type{color:var(--text-tertiary);font-weight:var(--weight-semibold);text-transform:uppercase;}'
          + '.audit-filter-chip-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
          + '.audit-filter-chip-remove{width:18px;height:18px;border:0;border-radius:var(--border-radius-sm);background:transparent;color:var(--text-tertiary);font:inherit;font-weight:var(--weight-bold);line-height:16px;cursor:pointer;}'
          + '.audit-add-filter-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-bottom:var(--space-3);}'
          + '.audit-add-filter-row button:disabled{opacity:.45;cursor:not-allowed;}'
          + '.audit-rule-card{border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:10px;display:flex;flex-direction:column;gap:8px;margin-bottom:10px;background:var(--bg-surface);}'
          + '.audit-rule-row{display:grid;grid-template-columns:minmax(112px,132px) minmax(0,1fr);gap:8px;align-items:start;}'
          + '.audit-rule-value-stack{display:grid;gap:6px;min-width:0;}'
          + '.audit-rule-value-list{max-height:150px;overflow:auto;border:1px solid var(--border-default);border-radius:var(--border-radius-md);background:var(--bg-surface);padding:5px;}'
          + '.audit-rule-value-option{display:grid;grid-template-columns:16px minmax(0,1fr);gap:7px;align-items:start;min-height:26px;padding:4px;border-radius:var(--border-radius-sm);font-size:var(--text-small);color:var(--text-primary);cursor:pointer;}'
          + '.audit-rule-value-option:hover{background:var(--bg-secondary);}'
          + '.audit-rule-value-option input{margin:2px 0 0 0;}'
          + '.audit-rule-value-option span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
          + '.audit-rule-value-help{color:var(--text-tertiary);font-size:var(--text-xs);}'
          + '.audit-rule-empty-values{min-height:42px;border:1px dashed var(--border-default);border-radius:var(--border-radius-md);display:flex;align-items:center;padding:7px 9px;color:var(--text-tertiary);font-size:var(--text-small);}'
          + '.audit-rule-action-row{display:grid;grid-template-columns:minmax(112px,136px) minmax(0,1fr) 34px;gap:8px;align-items:end;}'
          + '.audit-column-row{display:grid;grid-template-columns:28px minmax(0,1fr) 34px;gap:8px;align-items:start;margin-bottom:8px;}'
          + '.audit-column-handle{width:28px;height:34px;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);}'
          + '.audit-column-path{color:var(--text-tertiary);font-size:var(--text-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px;}'
          + '.audit-preview-card{min-height:720px;}'
          + '.audit-preview-table-wrap{overflow:auto;max-height:calc(100vh - 330px);min-height:520px;}'
          + '@media (max-width:1280px){.audit-builder-workspace{grid-template-columns:340px minmax(0,1fr);}.audit-report-side{grid-column:1 / -1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);}.audit-report-toolbar{grid-template-columns:repeat(3,minmax(0,1fr));}.audit-preview-table-wrap{max-height:620px;}}'
          + '@media (max-width:920px){.audit-report-titlebar{flex-direction:column;}.audit-report-toolbar,.audit-builder-workspace,.audit-report-side,.audit-report-gallery{grid-template-columns:1fr;}.audit-report-toolbar-actions{justify-content:stretch;}.audit-report-toolbar-actions button{flex:1;}.audit-builder-panel,.audit-preview-card{min-height:auto;max-height:none;}.audit-preview-table-wrap{min-height:360px;max-height:520px;}.audit-rule-row,.audit-rule-action-row{grid-template-columns:1fr;}.audit-column-row{grid-template-columns:minmax(0,1fr) 34px;}.audit-column-handle{display:none;}}'
          + '</style>';
      }

      function renderHeader() {
        var subtitle = 'Choose a saved report or start a new stakeholder-ready audit export.';
        if (state.mode === 'view') subtitle = state.draft.name || 'Saved audit report';
        if (state.mode === 'builder') subtitle = 'Build the report by choosing scope, focus, columns, preview, then publish.';
        var html = '<div class="audit-report-titlebar">';
        html += '<div style="min-width:0;"><div style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;margin-bottom:4px;">Audit Reporting</div>'
          + '<h1 style="font-size:var(--text-h1);font-weight:var(--weight-bold);margin:0;">Audit Reports</h1>'
          + '<div style="color:var(--text-secondary);font-size:var(--text-small);margin-top:4px;">' + UI.escapeHtml(subtitle) + '</div></div>';
        html += UI.orgPicker(state.organizations, state.activeOrgId, { defaultOrgId: state.defaultOrgId });
        html += '</div>';
        return html;
      }

      function renderTopControls() {
        var html = '<div class="decidr-section audit-report-toolbar">';
        html += label('Saved report') + '<select id="audit-report-select" style="' + controlStyle() + '">'
          + option('', 'New unsaved report', state.selectedReportId);
        for (var i = 0; i < state.reports.length; i++) {
          html += option(state.reports[i].id, state.reports[i].name || state.reports[i].id, state.selectedReportId);
        }
        html += '</select></label>';
        html += label('Report name') + '<input id="audit-report-name" value="' + UI.escapeHtml(state.draft.name) + '" style="' + controlStyle() + '"></label>';
        html += label('Visibility') + '<select id="audit-report-visibility" style="' + controlStyle() + '">'
          + option('PRIVATE', 'Private', state.draft.visibility)
          + option('PUBLIC', 'Public to org', state.draft.visibility)
          + '</select></label>';
        html += '<div class="audit-report-toolbar-actions">'
          + '<button id="audit-report-gallery" style="' + smallButtonStyle(false) + '">Reports</button>'
          + '<button id="audit-report-new" style="' + smallButtonStyle(false) + '">New</button>'
          + '<button id="audit-report-run" style="' + smallButtonStyle(true) + '">' + (state.running ? 'Running...' : 'Refresh Preview') + '</button>'
          + '<button id="audit-report-save" style="' + smallButtonStyle(false) + '">' + (state.saving ? 'Saving...' : 'Save') + '</button>'
          + '<button id="audit-report-export" style="' + smallButtonStyle(false) + '">Export CSV</button>'
          + '</div>';
        html += '</div>';
        return html;
      }

      function renderScope() {
        var html = '<div class="audit-report-scope-grid">';
        html += '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;">Choose the projects that define the report boundary. No project is selected automatically.</div>';
        html += label('Projects') + '<select id="audit-report-projects" multiple size="4" style="' + controlStyle('min-height:92px;') + '">';
        for (var p = 0; p < state.projects.length; p++) {
          var selected = state.draft.projectIds.indexOf(state.projects[p].id) !== -1;
          html += '<option value="' + UI.escapeHtml(state.projects[p].id) + '"' + (selected ? ' selected' : '') + '>'
            + UI.escapeHtml(state.projects[p].name || state.projects[p].id) + '</option>';
        }
        html += '</select></label>';
        if (!state.draft.projectIds.length) {
          html += '<div style="border:1px dashed var(--border-default);border-radius:var(--border-radius-md);padding:var(--space-3);color:var(--text-tertiary);font-size:var(--text-small);">Select one or more projects to unlock field discovery and preview results.</div>';
        }
        html += '</div>';
        return html;
      }

      function renderFocusControls() {
        var html = '<div class="audit-report-scope-grid">';
        html += '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;">Narrow the selected project scope to the events stakeholders need to review.</div>';
        html += label('Status') + '<select id="audit-report-status" style="' + controlStyle() + '">'
          + option('', 'All statuses', state.filters.status)
          + option('OPEN', 'Open', state.filters.status)
          + option('ACKNOWLEDGED', 'Acknowledged', state.filters.status)
          + option('RESOLVED', 'Resolved', state.filters.status)
          + option('ARCHIVED', 'Archived', state.filters.status)
          + '</select></label>';
        html += label('Category') + '<select id="audit-report-category" style="' + controlStyle() + '">'
          + option('', 'All categories', state.filters.categoryId);
        for (var c = 0; c < state.categories.length; c++) html += option(state.categories[c].id, state.categories[c].name, state.filters.categoryId);
        html += '</select></label>';
        html += label('From date') + '<input id="audit-report-from" type="text" value="' + UI.escapeHtml(state.filters.occurredFrom) + '" placeholder="YYYY-MM-DD" autocomplete="off" inputmode="numeric" style="' + controlStyle() + '"></label>';
        html += label('To date') + '<input id="audit-report-to" type="text" value="' + UI.escapeHtml(state.filters.occurredTo) + '" placeholder="YYYY-MM-DD" autocomplete="off" inputmode="numeric" style="' + controlStyle() + '"></label>';
        html += label('Search') + '<input id="audit-report-search" type="search" value="' + UI.escapeHtml(state.filters.search) + '" placeholder="Title or summary" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" style="' + controlStyle() + '"></label>';
        html += '</div>';
        return html;
      }

      function renderFieldPalette() {
        var search = state.fieldSearch.toLowerCase();
        var fields = state.fields.filter(function(field) {
          var fieldPath = String(field.fieldPath || '').toLowerCase();
          return !search || fieldPath.indexOf(search) !== -1 || fieldLabel(field.fieldPath || '').toLowerCase().indexOf(search) !== -1 || String(field.source || '').toLowerCase().indexOf(search) !== -1;
        }).sort(function(a, b) {
          var groupDiff = fieldGroupLabel(a).localeCompare(fieldGroupLabel(b));
          if (groupDiff !== 0) return groupDiff;
          return fieldLabel(a.fieldPath).localeCompare(fieldLabel(b.fieldPath));
        }).slice(0, 80);
        var html = '<div class="decidr-section-header">Field Catalog</div>';
        html += '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;margin-bottom:var(--space-3);">Use friendly columns first. Payload fields are available for deeper evidence reports.</div>';
        html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);">'
          + '<input id="audit-report-field-search" type="search" value="' + UI.escapeHtml(state.fieldSearch) + '" placeholder="Search fields" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" style="' + controlStyle() + '">'
          + '<button id="audit-report-refresh-fields" style="' + smallButtonStyle(false) + '">Refresh</button></div>';
        html += '<div id="audit-report-field-list">';
        html += renderFieldListItems(fields);
        html += '</div>';
        return html;
      }

      function renderFieldListItems(fields) {
        var html = '';
        if (!fields.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No fields found for this scope.</div>';
        }
        var lastGroup = '';
        for (var i = 0; i < fields.length; i++) {
          var f = fields[i];
          var group = fieldGroupLabel(f);
          if (group !== lastGroup) {
            lastGroup = group;
            html += '<div style="margin-top:' + (i ? 'var(--space-3)' : '0') + ';color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;">' + UI.escapeHtml(group) + '</div>';
          }
          html += '<div style="border-top:1px solid var(--border-subtle);padding:8px 0;">'
            + '<div style="display:flex;justify-content:space-between;gap:var(--space-2);align-items:start;">'
            + '<div style="min-width:0;"><div style="font-size:var(--text-small);font-weight:var(--weight-semibold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(fieldLabel(f.fieldPath)) + '</div>'
            + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(f.fieldPath || '') + '</div>'
            + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);">' + UI.escapeHtml((f.source || '') + ' · ' + (f.valueType || '')) + '</div></div>'
            + '<div style="display:flex;gap:4px;flex-shrink:0;">'
            + '<button data-add-column="' + UI.escapeHtml(f.fieldPath) + '" style="' + smallButtonStyle(false) + '">Add</button>'
            + '<button data-add-rule="' + UI.escapeHtml(f.fieldPath) + '" style="' + smallButtonStyle(false) + '">Filter</button>'
            + '</div></div>';
          var values = Array.isArray(f.distinctValues) ? f.distinctValues.slice(0, 4) : [];
          if (values.length) {
            html += '<div style="margin-top:5px;color:var(--text-tertiary);font-size:var(--text-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
              + UI.escapeHtml(values.join(', ')) + '</div>';
          }
          html += '</div>';
        }
        return html;
      }

      function renderRules() {
        var rules = Array.isArray(state.draft.logic.rules) ? state.draft.logic.rules : [];
        var html = '<div style="margin-top:var(--space-4);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);">'
          + '<div><div class="decidr-section-header" style="margin:0;">Field Filters</div>'
          + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);line-height:1.4;margin-top:3px;">Use payload or linked-record fields when basic filters are not specific enough.</div></div></div>';
        html += '<div class="audit-add-filter-row">'
          + '<select id="audit-report-new-rule-field" style="' + controlStyle() + '">'
          + option('', 'Choose a field to filter', '')
          + ruleFieldOptions('')
          + '</select>'
          + '<button id="audit-report-add-selected-rule" style="' + smallButtonStyle(false) + '" disabled>Add Filter</button></div>';
        if (!rules.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);padding:var(--space-3) 0;">No field filters yet.</div>';
        }
        for (var i = 0; i < rules.length; i++) {
          var rule = rules[i];
          var cond = rule.if || {};
          var then = rule.then || {};
          var field = cond.field || '';
          var fieldMeta = fieldMetaForPath(field);
          var action = then.include === false ? 'exclude' : (then.include === true ? 'include' : 'label');
          var labelValue = then.label || (Array.isArray(then.labels) ? then.labels[0] : '') || '';
          html += '<div class="audit-rule-card">';
          html += '<div style="font-size:var(--text-xs);color:var(--text-tertiary);font-weight:var(--weight-semibold);text-transform:uppercase;">Filter ' + (i + 1) + '</div>';
          html += '<select data-rule-field="' + i + '" style="' + controlStyle() + '">' + ruleFieldOptions(field) + '</select>';
          html += '<div class="audit-rule-row">';
          html += '<select data-rule-op="' + i + '" style="' + controlStyle() + '">' + operatorOptions(fieldMeta.valueType, cond.op || 'equals') + '</select>';
          html += renderRuleValueControl(i, cond, fieldMeta);
          html += '</div>';
          html += '<div class="audit-rule-action-row">';
          html += '<select data-rule-action="' + i + '" style="' + controlStyle() + '">'
            + option('include', 'Include', action)
            + option('exclude', 'Exclude', action)
            + option('label', 'Add label', action)
            + '</select>';
          html += '<input data-rule-label="' + i + '" value="' + UI.escapeHtml(labelValue) + '" placeholder="Optional label" style="' + controlStyle() + '">';
          html += '<button data-remove-rule="' + i + '" style="' + smallButtonStyle(false) + '">×</button>';
          html += '</div>';
          html += '</div>';
        }
        html += '</div>';
        return html;
      }

      function renderOutline() {
        var html = '<div class="decidr-section-header">Columns</div>';
        html += '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;margin-bottom:var(--space-3);">Choose what appears in the export. Keep the first columns readable for stakeholders.</div>';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:var(--space-3);">'
          + '<div style="color:var(--text-secondary);font-size:var(--text-small);font-weight:var(--weight-semibold);">Columns</div>'
          + '<button data-builder-tab="fields" style="' + smallButtonStyle(false) + '">Add Column</button></div>';
        for (var i = 0; i < state.draft.selectedColumns.length; i++) {
          var col = state.draft.selectedColumns[i];
          html += '<div class="audit-column-row">'
            + '<div class="audit-column-handle">' + (i + 1) + '</div>'
            + '<div><input data-column-label="' + i + '" value="' + UI.escapeHtml(col.label || col.field) + '" style="' + controlStyle() + '">'
            + '<div class="audit-column-path">' + UI.escapeHtml(col.field) + '</div></div>'
            + '<button data-remove-column="' + i + '" style="' + smallButtonStyle(false) + '">×</button></div>';
        }
        return html;
      }

      function renderFiltersPane() {
        var html = '<div class="decidr-section-header">Focus</div>';
        html += renderAppliedFilters();
        html += renderFocusControls();
        html += renderRules();
        return html;
      }

      function renderBuilderPanel() {
        var active = state.builderTab || 'scope';
        var filterCount = activeFilterItems().length;
        var html = '<div class="decidr-section audit-builder-panel">';
        html += '<div class="audit-report-stepper">'
          + '<button class="audit-report-step' + (active === 'scope' ? ' active' : '') + '" data-builder-tab="scope">1. Scope</button>'
          + '<button class="audit-report-step' + (active === 'focus' || active === 'filters' ? ' active' : '') + '" data-builder-tab="focus">2. Focus' + (filterCount ? ' (' + filterCount + ')' : '') + '</button>'
          + '<button class="audit-report-step' + (active === 'columns' || active === 'outline' || active === 'fields' ? ' active' : '') + '" data-builder-tab="columns">3. Columns</button>'
          + '<button class="audit-report-step' + (active === 'preview' ? ' active' : '') + '" data-builder-tab="preview">4. Preview</button>'
          + '<button class="audit-report-step' + (active === 'publish' ? ' active' : '') + '" data-builder-tab="publish">5. Publish</button>'
          + '</div>';
        html += '<div class="audit-builder-pane">';
        if (active === 'scope') html += '<div class="decidr-section-header">Scope</div>' + renderScope();
        else if (active === 'focus' || active === 'filters') html += renderFiltersPane();
        else if (active === 'preview') {
          html += '<div class="decidr-section-header">Preview</div>';
          html += renderAppliedFilters();
          html += '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;">Review the table on the right, then refresh the preview if the filter or column summary says it is stale.</div>';
        } else if (active === 'publish') {
          html += '<div class="decidr-section-header">Publish</div>';
          html += '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;margin-bottom:var(--space-3);">Save the definition, export the CSV, or share a saved report with teammates.</div>';
          html += renderReportSide();
        } else {
          html += renderOutline();
          html += '<div style="margin-top:var(--space-5);">' + renderFieldPalette() + '</div>';
        }
        html += '</div></div>';
        return html;
      }

      function renderReportSide() {
        var html = '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-section-header">Report Details</div>';
        html += '<div style="display:grid;gap:var(--space-3);">';
        html += '<div><div style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;margin-bottom:4px;">Report type</div><div class="decidr-badge">Audit Events</div></div>';
        html += '<div><div style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;margin-bottom:4px;">Rows in preview</div><div style="font-size:var(--text-h3);font-weight:var(--weight-bold);">' + UI.escapeHtml(String(state.preview.total || 0)) + '</div></div>';
        html += '<div><div style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;margin-bottom:4px;">Configured columns</div><div style="font-weight:var(--weight-semibold);">' + UI.escapeHtml(String(state.draft.selectedColumns.length)) + '</div></div>';
        html += '</div></div>';

        html += '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-section-header">Sharing</div>';
        var shares = (state.currentReport && Array.isArray(state.currentReport.shares)) ? state.currentReport.shares : [];
        if (!state.selectedReportId) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);margin-bottom:var(--space-3);">Save the report before sharing.</div>';
        } else if (shares.length) {
          html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:var(--space-3);">';
          for (var s = 0; s < shares.length; s++) {
            var share = shares[s];
            var user = share.user || {};
            html += '<div style="display:grid;grid-template-columns:minmax(0,1fr) 70px 32px;gap:6px;align-items:center;">'
              + '<div style="min-width:0;font-size:var(--text-small);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(user.name || user.email || share.userId) + '</div>'
              + '<div class="decidr-badge">' + UI.escapeHtml(share.role || 'VIEWER') + '</div>'
              + '<button data-unshare-user="' + UI.escapeHtml(share.userId) + '" style="' + smallButtonStyle(false) + '">×</button></div>';
          }
          html += '</div>';
        }
        html += '<div style="display:grid;grid-template-columns:minmax(0,1fr) 92px auto;gap:6px;align-items:end;">';
        html += '<select id="audit-report-share-user" style="' + controlStyle() + '">'
          + option('', 'Select user', state.share.userId);
        for (var m = 0; m < state.members.length; m++) {
          html += option(state.members[m].userId || state.members[m].id, state.members[m].name || state.members[m].email || state.members[m].id, state.share.userId);
        }
        html += '</select>';
        html += '<select id="audit-report-share-role" style="' + controlStyle() + '">'
          + option('VIEWER', 'Viewer', state.share.role)
          + option('EDITOR', 'Editor', state.share.role)
          + '</select>';
        html += '<button id="audit-report-share" style="' + smallButtonStyle(false) + '"' + (state.selectedReportId ? '' : ' disabled') + '>Share</button>';
        html += '</div></div>';

        var versions = (state.currentReport && Array.isArray(state.currentReport.versions)) ? state.currentReport.versions : [];
        html += '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-section-header">Version History</div>';
        if (!versions.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No saved versions yet.</div>';
        } else {
          for (var v = 0; v < versions.length; v++) {
            var version = versions[v];
            html += '<div style="border-top:1px solid var(--border-subtle);padding:8px 0;font-size:var(--text-small);">'
              + '<div style="display:flex;justify-content:space-between;gap:var(--space-2);">'
              + '<strong>v' + UI.escapeHtml(String(version.versionNumber || '')) + '</strong>'
              + '<span style="color:var(--text-tertiary);">' + UI.escapeHtml(formatDateTime(version.createdAt)) + '</span></div>'
              + '<div style="color:var(--text-secondary);margin-top:3px;">' + UI.escapeHtml(version.changeSummary || 'Definition saved') + '</div>'
              + '</div>';
          }
        }
        html += '</div>';
        return html;
      }

      function renderPreview() {
        var cols = state.preview.selectedColumns.length ? state.preview.selectedColumns : state.draft.selectedColumns;
        var html = '<div class="decidr-section audit-preview-card" style="padding:0;overflow:hidden;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-4);border-bottom:1px solid var(--border-subtle);">'
          + '<div><div class="decidr-section-header" style="margin:0;">Preview <span class="decidr-section-count">(' + state.preview.total + ')</span></div>'
          + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);margin-top:3px;">Audit Events</div></div>'
          + '<div style="display:flex;align-items:center;gap:var(--space-2);">'
          + (state.running ? '<div style="color:var(--text-tertiary);font-size:var(--text-small);">Running...</div>' : '')
          + '<button id="audit-report-run-preview" style="' + smallButtonStyle(false) + '">' + (state.running ? 'Running...' : (state.previewDirty ? 'Refresh Preview' : 'Run Preview')) + '</button></div>'
          + '</div>';
        html += '<div id="audit-preview-dirty-note" style="display:' + (state.previewDirty ? 'block' : 'none') + ';padding:9px var(--space-4);border-bottom:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-secondary);font-size:var(--text-small);">Preview is showing the last run. Refresh Preview to apply builder edits.</div>';
        if (state.error) {
          html += '<div style="padding:var(--space-4);color:var(--color-error-text);font-size:var(--text-small);">' + UI.escapeHtml(state.error.message || 'Something went wrong') + '</div>';
        }
        if (!state.draft.projectIds.length && !state.running) {
          html += UI.emptyState('Choose one or more projects to preview this report.');
        } else if (!state.preview.rows.length && !state.running) {
          html += UI.emptyState('No audit events match this report.');
        } else {
          html += '<div class="audit-preview-table-wrap"><table style="width:100%;border-collapse:collapse;font-size:var(--text-small);">';
          html += '<thead><tr><th style="' + thStyle() + '">Event</th>';
          for (var c = 0; c < cols.length; c++) html += '<th style="' + thStyle() + '">' + UI.escapeHtml(cols[c].label || cols[c].field) + '</th>';
          html += '</tr></thead><tbody>';
          for (var r = 0; r < state.preview.rows.length; r++) {
            var row = state.preview.rows[r];
            html += '<tr style="border-top:1px solid var(--border-subtle);">';
            html += '<td style="' + tdStyle('min-width:220px;') + '"><button data-entity-type="audit_event" data-entity-id="' + UI.escapeHtml(row.auditEventId || row.id) + '" style="border:0;background:transparent;color:var(--accent-primary);cursor:pointer;text-align:left;font:inherit;font-weight:var(--weight-semibold);padding:0;">' + UI.escapeHtml(row.title || row.id) + '</button>'
              + (row.labels && row.labels.length ? '<div style="margin-top:4px;">' + row.labels.map(function(lbl) { return '<span class="decidr-badge">' + UI.escapeHtml(lbl) + '</span>'; }).join(' ') + '</div>' : '')
              + '</td>';
            for (var cc = 0; cc < cols.length; cc++) {
              var val = row.values ? row.values[cols[cc].field] : '';
              html += '<td style="' + tdStyle() + '">' + UI.escapeHtml(formatValue(val)) + '</td>';
            }
            html += '</tr>';
          }
          html += '</tbody></table></div>';
        }
        html += '</div>';
        return html;
      }

      function reportProjectSummary(projectIds) {
        var ids = projectIds || [];
        if (!ids.length) return 'No project scope';
        if (ids.length === 1) return projectName(ids[0]);
        return ids.length + ' projects';
      }

      function renderGallery() {
        var html = '<div class="audit-report-gallery">';
        html += '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-section-header">Saved Reports <span class="decidr-section-count">(' + state.reports.length + ')</span></div>';
        if (!state.reports.length) {
          html += UI.emptyState('No saved audit reports yet.');
        } else {
          html += '<div class="audit-report-gallery-list">';
          for (var i = 0; i < state.reports.length; i++) {
            var report = state.reports[i];
            html += '<div class="audit-report-gallery-card">'
              + '<div style="min-width:0;">'
              + '<div style="font-weight:var(--weight-semibold);font-size:var(--text-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(report.name || 'Untitled report') + '</div>'
              + '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.4;margin-top:4px;">' + UI.escapeHtml(report.description || reportProjectSummary(report.projectIds || [])) + '</div>'
              + '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-2);">'
              + '<span class="decidr-badge">' + UI.escapeHtml(report.visibility || 'PRIVATE') + '</span>'
              + '<span class="decidr-badge">' + UI.escapeHtml(reportProjectSummary(report.projectIds || [])) + '</span>'
              + '</div></div>'
              + '<button data-open-report="' + UI.escapeHtml(report.id) + '" style="' + smallButtonStyle(true) + '">Open</button>'
              + '</div>';
          }
          html += '</div>';
        }
        html += '</div>';

        html += '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-section-header">Start New</div>';
        html += '<div style="display:grid;gap:var(--space-3);">';
        html += '<div style="border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:var(--space-3);background:var(--bg-surface);">'
          + '<div style="font-weight:var(--weight-semibold);">Audit evidence report</div>'
          + '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.45;margin-top:4px;">Build a CSV-ready report from audit events, linked decisions, projects, and selected payload fields.</div>'
          + '<button id="audit-report-start-builder" style="' + smallButtonStyle(true) + 'margin-top:var(--space-3);">Build Report</button>'
          + '</div>';
        html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);line-height:1.45;">Reports now start with an explicit project scope so stakeholders can see exactly what evidence is included.</div>';
        html += '</div></div>';
        html += '</div>';
        return html;
      }

      function renderReadView() {
        var html = '<div class="decidr-section" style="padding:var(--space-4);margin-bottom:var(--space-4);">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;">';
        html += '<div style="min-width:0;">'
          + '<div style="font-size:var(--text-h2);font-weight:var(--weight-bold);line-height:1.2;">' + UI.escapeHtml(state.draft.name || 'Audit report') + '</div>'
          + '<div style="color:var(--text-secondary);font-size:var(--text-small);margin-top:4px;">' + UI.escapeHtml(state.draft.description || reportProjectSummary(state.draft.projectIds)) + '</div>'
          + '</div>';
        html += '<div class="audit-report-mode-actions">'
          + '<button id="audit-report-gallery" style="' + smallButtonStyle(false) + '">Reports</button>'
          + '<button id="audit-report-edit-mode" style="' + smallButtonStyle(false) + '">Edit Report</button>'
          + '<button id="audit-report-run" style="' + smallButtonStyle(true) + '">' + (state.running ? 'Running...' : 'Refresh') + '</button>'
          + '<button id="audit-report-export" style="' + smallButtonStyle(false) + '">Export CSV</button>'
          + '</div>';
        html += '</div>';
        html += '<div style="margin-top:var(--space-3);">' + renderAppliedFilters() + '</div>';
        html += '</div>';
        html += '<div class="audit-builder-workspace" style="grid-template-columns:minmax(0,1fr) 310px;">';
        html += renderPreview();
        html += '<div class="audit-report-side">' + renderReportSide() + '</div>';
        html += '</div>';
        return html;
      }

      function thStyle() {
        return 'text-align:left;padding:9px 10px;color:var(--text-secondary);font-size:var(--text-xs);text-transform:uppercase;border-bottom:1px solid var(--border-subtle);background:var(--bg-surface);position:sticky;top:0;';
      }

      function tdStyle(extra) {
        return 'vertical-align:top;padding:10px;color:var(--text-primary);max-width:280px;overflow:hidden;text-overflow:ellipsis;' + (extra || '');
      }

      function formatValue(value) {
        if (value === undefined || value === null) return '';
        if (Array.isArray(value)) {
          if (!value.length) return '';
          return value.map(function(item) { return formatValue(item); }).slice(0, 4).join(', ')
            + (value.length > 4 ? ' +' + (value.length - 4) : '');
        }
        if (typeof value === 'object') {
          var keys = Object.keys(value);
          if (!keys.length) return '';
          return keys.length + ' field' + (keys.length === 1 ? '' : 's') + ': ' + keys.slice(0, 4).join(', ');
        }
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
        return String(value);
      }

      function formatDateTime(value) {
        if (!value) return '';
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      }

      function render() {
        if (state.loading) {
          container.innerHTML = UI.loadingSpinner('Loading audit reports...');
          return;
        }
        var html = renderStyles() + '<div class="audit-reports-shell">';
        html += renderHeader();
        if (state.mode === 'gallery') {
          html += renderGallery();
        } else if (state.mode === 'view') {
          html += renderReadView();
        } else {
          html += renderTopControls();
          html += '<div class="audit-builder-workspace">';
          html += renderBuilderPanel();
          html += renderPreview();
          if (state.builderTab !== 'publish') html += '<div class="audit-report-side">' + renderReportSide() + '</div>';
          html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
        wire();
      }

      function syncDraftFromControls() {
        var name = container.querySelector('#audit-report-name');
        var visibility = container.querySelector('#audit-report-visibility');
        var projects = container.querySelector('#audit-report-projects');
        var status = container.querySelector('#audit-report-status');
        var category = container.querySelector('#audit-report-category');
        var from = container.querySelector('#audit-report-from');
        var to = container.querySelector('#audit-report-to');
        var search = container.querySelector('#audit-report-search');
        var shareUser = container.querySelector('#audit-report-share-user');
        var shareRole = container.querySelector('#audit-report-share-role');
        state.draft.name = name ? name.value : state.draft.name;
        state.draft.visibility = visibility ? visibility.value : state.draft.visibility;
        state.draft.projectIds = projects ? Array.prototype.slice.call(projects.selectedOptions).map(function(opt) { return opt.value; }) : state.draft.projectIds;
        state.filters.status = status ? status.value : state.filters.status;
        state.filters.categoryId = category ? category.value : state.filters.categoryId;
        state.filters.occurredFrom = from ? from.value : state.filters.occurredFrom;
        state.filters.occurredTo = to ? to.value : state.filters.occurredTo;
        state.filters.search = search ? search.value : state.filters.search;
        state.share.userId = shareUser ? shareUser.value : state.share.userId;
        state.share.role = shareRole ? shareRole.value : state.share.role;

        var rules = Array.isArray(state.draft.logic.rules) ? state.draft.logic.rules : [];
        for (var i = 0; i < rules.length; i++) {
          var f = container.querySelector('[data-rule-field="' + i + '"]');
          var op = container.querySelector('[data-rule-op="' + i + '"]');
          var val = container.querySelector('[data-rule-value="' + i + '"]');
          var multi = container.querySelector('[data-rule-values="' + i + '"]');
          var extra = container.querySelector('[data-rule-value-extra="' + i + '"]');
          var action = container.querySelector('[data-rule-action="' + i + '"]');
          var lbl = container.querySelector('[data-rule-label="' + i + '"]');
          var previousIf = rules[i].if || {};
          var nextField = f ? f.value : (previousIf.field || '');
          var fieldChanged = nextField !== (previousIf.field || '');
          var nextOp = normalizeOperatorForField(fieldMetaForPath(nextField), op ? op.value : (previousIf.op || 'equals'));
          var rawValue = '';
          if (!fieldChanged) {
            rawValue = val ? val.value : '';
            if (multi || extra) {
              rawValue = readMultiRuleValue(i);
            }
          }
          rules[i].if = { field: nextField, op: nextOp, value: coerceRuleValue(rawValue, nextOp) };
          rules[i].then = {};
          if (action && action.value === 'exclude') rules[i].then.include = false;
          else if (action && action.value === 'label') {
            rules[i].then.label = lbl ? lbl.value : '';
          } else {
            rules[i].then.include = true;
            if (lbl && lbl.value) rules[i].then.label = lbl.value;
          }
        }
        state.draft.logic.rules = rules;

        for (var c = 0; c < state.draft.selectedColumns.length; c++) {
          var labelInput = container.querySelector('[data-column-label="' + c + '"]');
          if (labelInput) state.draft.selectedColumns[c].label = labelInput.value;
        }
      }

      function coerceRuleValue(value, op) {
        if (Array.isArray(value)) {
          return value.map(function(item) {
            return coerceScalarRuleValue(item);
          }).filter(function(item) { return item !== ''; });
        }
        if (op === 'between') {
          return String(value || '').split(',').map(function(part) {
            var trimmed = part.trim();
            return trimmed !== '' && !Number.isNaN(Number(trimmed)) ? Number(trimmed) : trimmed;
          }).filter(function(part) { return part !== ''; });
        }
        return coerceScalarRuleValue(value);
      }

      function coerceScalarRuleValue(value) {
        if (value === true || value === false) return value;
        if (typeof value === 'number') return value;
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
        return value;
      }

      function readMultiRuleValue(index) {
        var values = [];
        var options = container.querySelectorAll('[data-rule-value-option="' + index + '"]');
        for (var i = 0; i < options.length; i++) {
          if (options[i].checked) values.push(options[i].value);
        }
        var extra = container.querySelector('[data-rule-value-extra="' + index + '"]');
        if (extra) values = values.concat(splitRuleValues(extra.value));
        return uniqueRuleValues(values);
      }

      function setPreviewDirty(dirty) {
        state.previewDirty = !!dirty;
        var note = container.querySelector('#audit-preview-dirty-note');
        if (note) note.style.display = state.previewDirty ? 'block' : 'none';
        var runPreview = container.querySelector('#audit-report-run-preview');
        if (runPreview && !state.running) runPreview.textContent = state.previewDirty ? 'Refresh Preview' : 'Run Preview';
      }

      function addRule(fieldPath) {
        syncDraftFromControls();
        state.draft.logic.rules = Array.isArray(state.draft.logic.rules) ? state.draft.logic.rules : [];
        state.draft.logic.rules.push({
          if: { field: fieldPath || (state.fields[0] && state.fields[0].fieldPath) || 'status', op: 'equals', value: '' },
          then: { include: true }
        });
        state.builderTab = 'focus';
        state.previewDirty = true;
        render();
      }

      function addColumn(fieldPath) {
        syncDraftFromControls();
        if (!fieldPath) return;
        if (state.draft.selectedColumns.some(function(col) { return col.field === fieldPath; })) return;
        state.draft.selectedColumns.push({ field: fieldPath, label: fieldLabel(fieldPath) });
        state.previewDirty = true;
        render();
      }

      function clearFilter(kind) {
        syncDraftFromControls();
        if (kind === 'status') state.filters.status = '';
        if (kind === 'category') state.filters.categoryId = '';
        if (kind === 'date') {
          state.filters.occurredFrom = '';
          state.filters.occurredTo = '';
        }
        if (kind === 'search') state.filters.search = '';
        state.previewDirty = true;
        render();
      }

      function beginNewReport() {
        state.mode = 'builder';
        state.selectedReportId = '';
        state.currentReport = null;
        state.builderTab = 'scope';
        state.fieldSearch = '';
        state.fields = [];
        state.draft = defaultDraft(data);
        state.filters = { status: '', categoryId: '', occurredFrom: '', occurredTo: '', search: '' };
        state.preview = { rows: [], total: 0, selectedColumns: state.draft.selectedColumns };
        state.previewDirty = false;
        render();
      }

      function wire() {
        var galleryBtn = container.querySelector('#audit-report-gallery');
        if (galleryBtn) galleryBtn.addEventListener('click', function() {
          state.mode = 'gallery';
          state.error = null;
          render();
        });
        var startBuilder = container.querySelector('#audit-report-start-builder');
        if (startBuilder) startBuilder.addEventListener('click', beginNewReport);
        var openReportBtns = container.querySelectorAll('[data-open-report]');
        for (var ob = 0; ob < openReportBtns.length; ob++) openReportBtns[ob].addEventListener('click', function(e) {
          state.mode = 'view';
          loadReport(e.currentTarget.getAttribute('data-open-report'));
        });
        var editMode = container.querySelector('#audit-report-edit-mode');
        if (editMode) editMode.addEventListener('click', function() {
          state.mode = 'builder';
          state.builderTab = 'scope';
          if (state.draft.projectIds.length && !state.fields.length) {
            loadFields(false);
          } else {
            render();
          }
        });
        var select = container.querySelector('#audit-report-select');
        if (select) select.addEventListener('change', function() {
          if (!select.value) {
            beginNewReport();
          } else {
            state.mode = 'view';
            loadReport(select.value);
          }
        });
        var run = container.querySelector('#audit-report-run');
        if (run) run.addEventListener('click', function() { syncDraftFromControls(); runReport(); });
        var runPreview = container.querySelector('#audit-report-run-preview');
        if (runPreview) runPreview.addEventListener('click', function() { syncDraftFromControls(); runReport(); });
        var save = container.querySelector('#audit-report-save');
        if (save) save.addEventListener('click', saveReport);
        var fresh = container.querySelector('#audit-report-refresh-fields');
        if (fresh) fresh.addEventListener('click', function() { syncDraftFromControls(); loadFields(true); });
        var newBtn = container.querySelector('#audit-report-new');
        if (newBtn) newBtn.addEventListener('click', beginNewReport);
        var exportBtn = container.querySelector('#audit-report-export');
        if (exportBtn) exportBtn.addEventListener('click', exportCsv);
        var shareBtn = container.querySelector('#audit-report-share');
        if (shareBtn) shareBtn.addEventListener('click', function() { syncDraftFromControls(); shareReport(); });
        var fieldSearch = container.querySelector('#audit-report-field-search');
        if (fieldSearch) fieldSearch.addEventListener('input', function() {
          state.fieldSearch = fieldSearch.value;
          var list = container.querySelector('#audit-report-field-list');
          if (!list) {
            render();
            return;
          }
          var search = state.fieldSearch.toLowerCase();
          var fields = state.fields.filter(function(field) {
            var fieldPath = String(field.fieldPath || '').toLowerCase();
            return !search || fieldPath.indexOf(search) !== -1 || fieldLabel(field.fieldPath || '').toLowerCase().indexOf(search) !== -1 || String(field.source || '').toLowerCase().indexOf(search) !== -1;
          }).sort(function(a, b) {
            var groupDiff = fieldGroupLabel(a).localeCompare(fieldGroupLabel(b));
            if (groupDiff !== 0) return groupDiff;
            return fieldLabel(a.fieldPath).localeCompare(fieldLabel(b.fieldPath));
          }).slice(0, 80);
          list.innerHTML = renderFieldListItems(fields);
          wireFieldPaletteButtons(list);
        });
        var addRuleBtn = container.querySelector('#audit-report-add-rule');
        if (addRuleBtn) addRuleBtn.addEventListener('click', function() { addRule(); });
        var addSelectedRuleBtn = container.querySelector('#audit-report-add-selected-rule');
        if (addSelectedRuleBtn) addSelectedRuleBtn.addEventListener('click', function() {
          var fieldSelect = container.querySelector('#audit-report-new-rule-field');
          if (!fieldSelect || !fieldSelect.value) return;
          addRule(fieldSelect.value);
        });
        var newRuleField = container.querySelector('#audit-report-new-rule-field');
        if (newRuleField && addSelectedRuleBtn) newRuleField.addEventListener('change', function() {
          addSelectedRuleBtn.disabled = !newRuleField.value;
        });
        var tabBtns = container.querySelectorAll('[data-builder-tab]');
        for (var tb = 0; tb < tabBtns.length; tb++) tabBtns[tb].addEventListener('click', function(e) {
          syncDraftFromControls();
          state.builderTab = e.currentTarget.getAttribute('data-builder-tab') || 'outline';
          if (state.builderTab === 'columns' && state.draft.projectIds.length && !state.fields.length) {
            loadFields(false);
          } else {
            render();
          }
        });

        wireFieldPaletteButtons(container);
        var removeRuleBtns = container.querySelectorAll('[data-remove-rule]');
        for (var rr = 0; rr < removeRuleBtns.length; rr++) removeRuleBtns[rr].addEventListener('click', function(e) {
          syncDraftFromControls();
          state.draft.logic.rules.splice(Number(e.currentTarget.getAttribute('data-remove-rule')), 1);
          state.previewDirty = true;
          render();
        });
        var removeColumnBtns = container.querySelectorAll('[data-remove-column]');
        for (var rc = 0; rc < removeColumnBtns.length; rc++) removeColumnBtns[rc].addEventListener('click', function(e) {
          syncDraftFromControls();
          state.draft.selectedColumns.splice(Number(e.currentTarget.getAttribute('data-remove-column')), 1);
          state.previewDirty = true;
          render();
        });
        var dirtyControls = container.querySelectorAll('#audit-report-projects,#audit-report-status,#audit-report-category,#audit-report-from,#audit-report-to,#audit-report-search,[data-rule-field],[data-rule-op],[data-rule-value],[data-rule-value-option],[data-rule-value-extra],[data-rule-action],[data-rule-label],[data-column-label]');
        for (var dc = 0; dc < dirtyControls.length; dc++) {
          if (dirtyControls[dc]._auditReportsDirtyWired) continue;
          dirtyControls[dc]._auditReportsDirtyWired = true;
          dirtyControls[dc].addEventListener('change', function() {
            syncDraftFromControls();
            setPreviewDirty(true);
            if (this.id === 'audit-report-projects') {
              state.fields = [];
              if (state.draft.projectIds.length) {
                loadFields(false);
                return;
              }
            }
            if (state.builderTab === 'focus' || state.builderTab === 'filters' || state.builderTab === 'scope') render();
          });
          dirtyControls[dc].addEventListener('input', function() { setPreviewDirty(true); });
        }
        var clearFilterBtns = container.querySelectorAll('[data-clear-filter]');
        for (var cf = 0; cf < clearFilterBtns.length; cf++) clearFilterBtns[cf].addEventListener('click', function(e) {
          clearFilter(e.currentTarget.getAttribute('data-clear-filter'));
        });
        var unshareBtns = container.querySelectorAll('[data-unshare-user]');
        for (var us = 0; us < unshareBtns.length; us++) unshareBtns[us].addEventListener('click', function(e) {
          unshareReport(e.currentTarget.getAttribute('data-unshare-user'));
        });

        wireOrgPicker();
        wireEntityClicks();
      }

      function wireFieldPaletteButtons(scope) {
        var root = scope || container;
        var addColumnBtns = root.querySelectorAll('[data-add-column]');
        for (var i = 0; i < addColumnBtns.length; i++) {
          if (addColumnBtns[i]._auditReportsColumnWired) continue;
          addColumnBtns[i]._auditReportsColumnWired = true;
          addColumnBtns[i].addEventListener('click', function(e) {
            addColumn(e.currentTarget.getAttribute('data-add-column'));
          });
        }
        var addRuleBtns = root.querySelectorAll('[data-add-rule]');
        for (var r = 0; r < addRuleBtns.length; r++) {
          if (addRuleBtns[r]._auditReportsRuleWired) continue;
          addRuleBtns[r]._auditReportsRuleWired = true;
          addRuleBtns[r].addEventListener('click', function(e) {
            addRule(e.currentTarget.getAttribute('data-add-rule'));
          });
        }
      }

      function reloadForActiveOrg() {
        state.mode = 'gallery';
        state.builderTab = 'scope';
        state.selectedReportId = '';
        state.currentReport = null;
        state.draft = defaultDraft(data);
        state.fields = [];
        state.preview = { rows: [], total: 0, selectedColumns: state.draft.selectedColumns };
        container.innerHTML = UI.loadingSpinner('Switching organization...');
        return loadReferenceData().then(function() {
          render();
        }).catch(function(err) {
          state.error = err;
          render();
        });
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
              onMutate: reloadForActiveOrg
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
          API.switchOrg(orgId).then(reloadForActiveOrg).catch(function(err) {
            state.error = err;
            render();
          });
        });
      }

      function wireEntityClicks() {
        var clickables = container.querySelectorAll('[data-entity-type][data-entity-id]');
        for (var i = 0; i < clickables.length; i++) {
          (function(el) {
            if (el._auditReportsWired) return;
            el._auditReportsWired = true;
            el.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              var type = el.getAttribute('data-entity-type');
              var id = el.getAttribute('data-entity-id');
              if (type && id) {
                UI.SlideOut.open(type, id, { source: container, onMutate: runReport });
              }
            });
          })(clickables[i]);
        }
      }
    }, _orgId);
  };
})();

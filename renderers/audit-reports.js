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
        fieldSearch: '',
        selectedReportId: (data && (data.report_id || data.reportId)) || '',
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
        return loadFields(false);
      }).then(function() {
        if (state.selectedReportId) return loadReport(state.selectedReportId);
        return runReport();
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
          if (!state.draft.projectIds.length && state.projects.length) {
            state.draft.projectIds = [state.projects[0].id];
          }
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
        return 'width:100%;min-height:34px;border:1px solid var(--border-default);'
          + 'border-radius:var(--border-radius-md);background:var(--bg-surface);'
          + 'color:var(--text-primary);font:inherit;padding:7px 9px;' + (extra || '');
      }

      function smallButtonStyle(primary) {
        return 'min-height:32px;padding:0 11px;border:1px solid '
          + (primary ? 'var(--accent-primary)' : 'var(--border-default)')
          + ';border-radius:var(--border-radius-md);background:'
          + (primary ? 'var(--accent-primary)' : 'var(--bg-surface)')
          + ';color:' + (primary ? '#fff' : 'var(--text-primary)')
          + ';font-weight:var(--weight-semibold);font-size:var(--text-small);cursor:pointer;';
      }

      function label(text) {
        return '<label style="display:flex;flex-direction:column;gap:4px;font-size:var(--text-xs);'
          + 'font-weight:var(--weight-semibold);color:var(--text-secondary);text-transform:uppercase;">'
          + UI.escapeHtml(text);
      }

      function option(value, text, selected) {
        return '<option value="' + UI.escapeHtml(value || '') + '"'
          + (String(value || '') === String(selected || '') ? ' selected' : '')
          + '>' + UI.escapeHtml(text || value || '') + '</option>';
      }

      function operatorOptions(type, selected) {
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
        return ops.map(function(row) { return option(row[0], row[1], selected); }).join('');
      }

      function fieldLabel(fieldPath) {
        for (var i = 0; i < state.fields.length; i++) {
          if (state.fields[i].fieldPath === fieldPath) return fieldPath;
        }
        return fieldPath;
      }

      function renderHeader() {
        var html = '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);margin-bottom:var(--space-4);">';
        html += '<div style="min-width:0;"><h1 style="font-size:var(--text-h1);font-weight:var(--weight-bold);margin:0;">Audit Reports</h1>'
          + '<div style="color:var(--text-secondary);font-size:var(--text-small);margin-top:4px;">Rule-based reports over audit events</div></div>';
        html += UI.orgPicker(state.organizations, state.activeOrgId, { defaultOrgId: state.defaultOrgId });
        html += '</div>';
        return html;
      }

      function renderTopControls() {
        var html = '<div class="decidr-section" style="padding:var(--space-4);margin-bottom:var(--space-4);">';
        html += '<div style="display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(220px,2fr) minmax(130px,.7fr) repeat(4,auto);gap:var(--space-3);align-items:end;">';
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
        html += '<button id="audit-report-new" style="' + smallButtonStyle(false) + '">New</button>';
        html += '<button id="audit-report-run" style="' + smallButtonStyle(true) + '">' + (state.running ? 'Running...' : 'Run') + '</button>';
        html += '<button id="audit-report-save" style="' + smallButtonStyle(false) + '">' + (state.saving ? 'Saving...' : 'Save') + '</button>';
        html += '<button id="audit-report-export" style="' + smallButtonStyle(false) + '">Export CSV</button>';
        html += '</div>';
        html += '</div>';
        return html;
      }

      function renderScope() {
        var html = '<div class="decidr-section" style="padding:var(--space-4);margin-bottom:var(--space-4);">';
        html += '<div class="decidr-section-header">Scope</div>';
        html += '<div style="display:grid;grid-template-columns:minmax(220px,1.4fr) repeat(5,minmax(130px,1fr));gap:var(--space-3);align-items:end;">';
        html += label('Projects') + '<select id="audit-report-projects" multiple size="4" style="' + controlStyle('min-height:92px;') + '">';
        for (var p = 0; p < state.projects.length; p++) {
          var selected = state.draft.projectIds.indexOf(state.projects[p].id) !== -1;
          html += '<option value="' + UI.escapeHtml(state.projects[p].id) + '"' + (selected ? ' selected' : '') + '>'
            + UI.escapeHtml(state.projects[p].name || state.projects[p].id) + '</option>';
        }
        html += '</select></label>';
        html += label('Status') + '<select id="audit-report-status" style="' + controlStyle() + '">'
          + option('', 'All', state.filters.status)
          + option('OPEN', 'Open', state.filters.status)
          + option('ACKNOWLEDGED', 'Acknowledged', state.filters.status)
          + option('RESOLVED', 'Resolved', state.filters.status)
          + option('ARCHIVED', 'Archived', state.filters.status)
          + '</select></label>';
        html += label('Category') + '<select id="audit-report-category" style="' + controlStyle() + '">'
          + option('', 'All', state.filters.categoryId);
        for (var c = 0; c < state.categories.length; c++) html += option(state.categories[c].id, state.categories[c].name, state.filters.categoryId);
        html += '</select></label>';
        html += label('From') + '<input id="audit-report-from" type="date" value="' + UI.escapeHtml(state.filters.occurredFrom) + '" style="' + controlStyle() + '"></label>';
        html += label('To') + '<input id="audit-report-to" type="date" value="' + UI.escapeHtml(state.filters.occurredTo) + '" style="' + controlStyle() + '"></label>';
        html += label('Search') + '<input id="audit-report-search" type="search" value="' + UI.escapeHtml(state.filters.search) + '" placeholder="Title or summary" style="' + controlStyle() + '"></label>';
        html += '</div></div>';
        return html;
      }

      function renderFieldPalette() {
        var search = state.fieldSearch.toLowerCase();
        var fields = state.fields.filter(function(field) {
          return !search || field.fieldPath.toLowerCase().indexOf(search) !== -1 || String(field.source || '').toLowerCase().indexOf(search) !== -1;
        }).slice(0, 80);
        var html = '<div class="decidr-section" style="padding:var(--space-4);height:100%;overflow:auto;">';
        html += '<div class="decidr-section-header">Fields</div>';
        html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);">'
          + '<input id="audit-report-field-search" type="search" value="' + UI.escapeHtml(state.fieldSearch) + '" placeholder="Search fields" style="' + controlStyle() + '">'
          + '<button id="audit-report-refresh-fields" style="' + smallButtonStyle(false) + '">Refresh</button></div>';
        if (!fields.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);">No fields found for this scope.</div>';
        }
        for (var i = 0; i < fields.length; i++) {
          var f = fields[i];
          html += '<div style="border-top:1px solid var(--border-subtle);padding:8px 0;">'
            + '<div style="display:flex;justify-content:space-between;gap:var(--space-2);align-items:start;">'
            + '<div style="min-width:0;"><div style="font-size:var(--text-small);font-weight:var(--weight-semibold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(f.fieldPath) + '</div>'
            + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);">' + UI.escapeHtml((f.source || '') + ' · ' + (f.valueType || '')) + '</div></div>'
            + '<div style="display:flex;gap:4px;flex-shrink:0;">'
            + '<button data-add-column="' + UI.escapeHtml(f.fieldPath) + '" style="' + smallButtonStyle(false) + '">Column</button>'
            + '<button data-add-rule="' + UI.escapeHtml(f.fieldPath) + '" style="' + smallButtonStyle(false) + '">Rule</button>'
            + '</div></div>';
          var values = Array.isArray(f.distinctValues) ? f.distinctValues.slice(0, 4) : [];
          if (values.length) {
            html += '<div style="margin-top:5px;color:var(--text-tertiary);font-size:var(--text-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
              + UI.escapeHtml(values.join(', ')) + '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
        return html;
      }

      function renderRules() {
        var rules = Array.isArray(state.draft.logic.rules) ? state.draft.logic.rules : [];
        var html = '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);">'
          + '<div class="decidr-section-header" style="margin:0;">If/Then Logic</div>'
          + '<button id="audit-report-add-rule" style="' + smallButtonStyle(false) + '">Add Rule</button></div>';
        if (!rules.length) {
          html += '<div style="color:var(--text-tertiary);font-size:var(--text-small);padding:var(--space-3) 0;">No rules yet. The report includes all scoped events.</div>';
        }
        for (var i = 0; i < rules.length; i++) {
          var rule = rules[i];
          var cond = rule.if || {};
          var then = rule.then || {};
          var field = cond.field || '';
          var fieldMeta = state.fields.filter(function(f) { return f.fieldPath === field; })[0] || {};
          var action = then.include === false ? 'exclude' : (then.include === true ? 'include' : 'label');
          var labelValue = then.label || (Array.isArray(then.labels) ? then.labels[0] : '') || '';
          html += '<div style="display:grid;grid-template-columns:32px minmax(150px,1fr) 120px minmax(120px,1fr) 100px minmax(90px,1fr) 32px;gap:6px;align-items:end;border-top:1px solid var(--border-subtle);padding:8px 0;">';
          html += '<div style="font-size:var(--text-xs);color:var(--text-tertiary);padding-bottom:8px;">IF</div>';
          html += '<select data-rule-field="' + i + '" style="' + controlStyle() + '">';
          for (var fIdx = 0; fIdx < state.fields.length; fIdx++) html += option(state.fields[fIdx].fieldPath, state.fields[fIdx].fieldPath, field);
          html += '</select>';
          html += '<select data-rule-op="' + i + '" style="' + controlStyle() + '">' + operatorOptions(fieldMeta.valueType, cond.op || 'equals') + '</select>';
          html += '<input data-rule-value="' + i + '" value="' + UI.escapeHtml(cond.value == null ? '' : String(cond.value)) + '" style="' + controlStyle() + '">';
          html += '<select data-rule-action="' + i + '" style="' + controlStyle() + '">'
            + option('include', 'include', action)
            + option('exclude', 'exclude', action)
            + option('label', 'label', action)
            + '</select>';
          html += '<input data-rule-label="' + i + '" value="' + UI.escapeHtml(labelValue) + '" placeholder="Label" style="' + controlStyle() + '">';
          html += '<button data-remove-rule="' + i + '" style="' + smallButtonStyle(false) + '">×</button>';
          html += '</div>';
        }
        html += '</div>';
        return html;
      }

      function renderColumnsAndShare() {
        var html = '<div class="decidr-section" style="padding:var(--space-4);">';
        html += '<div class="decidr-section-header">Columns</div>';
        for (var i = 0; i < state.draft.selectedColumns.length; i++) {
          var col = state.draft.selectedColumns[i];
          html += '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(90px,.7fr) 32px;gap:6px;align-items:center;margin-bottom:6px;">'
            + '<input data-column-label="' + i + '" value="' + UI.escapeHtml(col.label || col.field) + '" style="' + controlStyle() + '">'
            + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + UI.escapeHtml(col.field) + '</div>'
            + '<button data-remove-column="' + i + '" style="' + smallButtonStyle(false) + '">×</button></div>';
        }
        html += '</div>';

        html += '<div class="decidr-section" style="padding:var(--space-4);margin-top:var(--space-4);">';
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
        html += '<div class="decidr-section" style="padding:var(--space-4);margin-top:var(--space-4);">';
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
        var html = '<div class="decidr-section" style="padding:0;overflow:hidden;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-4);border-bottom:1px solid var(--border-subtle);">'
          + '<div class="decidr-section-header" style="margin:0;">Preview <span class="decidr-section-count">(' + state.preview.total + ')</span></div>'
          + (state.running ? '<div style="color:var(--text-tertiary);font-size:var(--text-small);">Running...</div>' : '')
          + '</div>';
        if (state.error) {
          html += '<div style="padding:var(--space-4);color:var(--color-error-text);font-size:var(--text-small);">' + UI.escapeHtml(state.error.message || 'Something went wrong') + '</div>';
        }
        if (!state.preview.rows.length && !state.running) {
          html += UI.emptyState('No audit events match this report.');
        } else {
          html += '<div style="overflow:auto;max-height:620px;"><table style="width:100%;border-collapse:collapse;font-size:var(--text-small);">';
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

      function thStyle() {
        return 'text-align:left;padding:9px 10px;color:var(--text-secondary);font-size:var(--text-xs);text-transform:uppercase;border-bottom:1px solid var(--border-subtle);background:var(--bg-surface);position:sticky;top:0;';
      }

      function tdStyle(extra) {
        return 'vertical-align:top;padding:10px;color:var(--text-primary);max-width:280px;overflow:hidden;text-overflow:ellipsis;' + (extra || '');
      }

      function formatValue(value) {
        if (value === undefined || value === null) return '';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value);
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
        var html = '<div style="max-width:1480px;margin:0 auto;padding:var(--space-5) var(--space-4);font-family:var(--font-sans);color:var(--text-primary);">';
        html += renderHeader();
        html += renderTopControls();
        html += renderScope();
        html += '<div style="display:grid;grid-template-columns:minmax(260px,320px) minmax(0,1fr) minmax(300px,360px);gap:var(--space-4);align-items:start;">';
        html += renderFieldPalette();
        html += renderPreview();
        html += '<div>' + renderRules() + renderColumnsAndShare() + '</div>';
        html += '</div></div>';
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
          var action = container.querySelector('[data-rule-action="' + i + '"]');
          var lbl = container.querySelector('[data-rule-label="' + i + '"]');
          rules[i].if = { field: f ? f.value : '', op: op ? op.value : 'equals', value: coerceRuleValue(val ? val.value : '', op ? op.value : 'equals') };
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
        if (op === 'between') {
          return String(value || '').split(',').map(function(part) {
            var trimmed = part.trim();
            return trimmed !== '' && !Number.isNaN(Number(trimmed)) ? Number(trimmed) : trimmed;
          }).filter(function(part) { return part !== ''; });
        }
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
        return value;
      }

      function addRule(fieldPath) {
        syncDraftFromControls();
        state.draft.logic.rules = Array.isArray(state.draft.logic.rules) ? state.draft.logic.rules : [];
        state.draft.logic.rules.push({
          if: { field: fieldPath || (state.fields[0] && state.fields[0].fieldPath) || 'status', op: 'equals', value: '' },
          then: { include: true }
        });
        render();
      }

      function addColumn(fieldPath) {
        syncDraftFromControls();
        if (!fieldPath) return;
        if (state.draft.selectedColumns.some(function(col) { return col.field === fieldPath; })) return;
        state.draft.selectedColumns.push({ field: fieldPath, label: fieldLabel(fieldPath) });
        render();
      }

      function wire() {
        var select = container.querySelector('#audit-report-select');
        if (select) select.addEventListener('change', function() {
          if (!select.value) {
            state.selectedReportId = '';
            state.currentReport = null;
            state.draft = defaultDraft(data);
            render();
            runReport();
          } else {
            loadReport(select.value);
          }
        });
        var run = container.querySelector('#audit-report-run');
        if (run) run.addEventListener('click', function() { syncDraftFromControls(); loadFields(false).then(runReport); });
        var save = container.querySelector('#audit-report-save');
        if (save) save.addEventListener('click', saveReport);
        var fresh = container.querySelector('#audit-report-refresh-fields');
        if (fresh) fresh.addEventListener('click', function() { syncDraftFromControls(); loadFields(true); });
        var newBtn = container.querySelector('#audit-report-new');
        if (newBtn) newBtn.addEventListener('click', function() { state.selectedReportId = ''; state.currentReport = null; state.draft = defaultDraft(data); render(); runReport(); });
        var exportBtn = container.querySelector('#audit-report-export');
        if (exportBtn) exportBtn.addEventListener('click', exportCsv);
        var shareBtn = container.querySelector('#audit-report-share');
        if (shareBtn) shareBtn.addEventListener('click', function() { syncDraftFromControls(); shareReport(); });
        var fieldSearch = container.querySelector('#audit-report-field-search');
        if (fieldSearch) fieldSearch.addEventListener('input', function() { state.fieldSearch = fieldSearch.value; render(); });
        var addRuleBtn = container.querySelector('#audit-report-add-rule');
        if (addRuleBtn) addRuleBtn.addEventListener('click', function() { addRule(); });

        var addColumnBtns = container.querySelectorAll('[data-add-column]');
        for (var i = 0; i < addColumnBtns.length; i++) addColumnBtns[i].addEventListener('click', function(e) { addColumn(e.currentTarget.getAttribute('data-add-column')); });
        var addRuleBtns = container.querySelectorAll('[data-add-rule]');
        for (var r = 0; r < addRuleBtns.length; r++) addRuleBtns[r].addEventListener('click', function(e) { addRule(e.currentTarget.getAttribute('data-add-rule')); });
        var removeRuleBtns = container.querySelectorAll('[data-remove-rule]');
        for (var rr = 0; rr < removeRuleBtns.length; rr++) removeRuleBtns[rr].addEventListener('click', function(e) {
          syncDraftFromControls();
          state.draft.logic.rules.splice(Number(e.currentTarget.getAttribute('data-remove-rule')), 1);
          render();
        });
        var removeColumnBtns = container.querySelectorAll('[data-remove-column]');
        for (var rc = 0; rc < removeColumnBtns.length; rc++) removeColumnBtns[rc].addEventListener('click', function(e) {
          syncDraftFromControls();
          state.draft.selectedColumns.splice(Number(e.currentTarget.getAttribute('data-remove-column')), 1);
          render();
        });
        var unshareBtns = container.querySelectorAll('[data-unshare-user]');
        for (var us = 0; us < unshareBtns.length; us++) unshareBtns[us].addEventListener('click', function(e) {
          unshareReport(e.currentTarget.getAttribute('data-unshare-user'));
        });

        wireOrgPicker();
        wireEntityClicks();
      }

      function reloadForActiveOrg() {
        state.selectedReportId = '';
        state.currentReport = null;
        state.draft = defaultDraft(data);
        state.preview = { rows: [], total: 0, selectedColumns: state.draft.selectedColumns };
        container.innerHTML = UI.loadingSpinner('Switching organization...');
        return loadReferenceData().then(function() {
          return loadFields(false);
        }).then(runReport).catch(function(err) {
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

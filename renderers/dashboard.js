(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_dashboard = function(container, data, meta, toolArgs, reviewRequired, onDecision) {
    container.innerHTML = '<div class="decidr-dashboard-root decidr-dashboard-skeleton" aria-busy="true"'
      + ' aria-label="Loading governance dashboard" style="min-height:1120px;padding:24px;">'
      + '<div data-dashboard-skeleton="header" style="height:92px;border-radius:12px;background:var(--surface-secondary);"></div>'
      + '<div data-dashboard-skeleton="stats" style="height:88px;margin-top:24px;border-radius:12px;background:var(--surface-secondary);"></div>'
      + '<div data-dashboard-skeleton="next-steps" style="height:300px;margin-top:32px;border-radius:12px;background:var(--surface-secondary);"></div>'
      + '<div data-dashboard-skeleton="active-decisions" style="height:120px;margin-top:32px;border-radius:12px;background:var(--surface-secondary);"></div>'
      + '<div data-dashboard-skeleton="initiatives" style="height:260px;margin-top:32px;border-radius:12px;background:var(--surface-secondary);"></div>'
      + '<div data-dashboard-skeleton="recent-decisions" style="height:150px;margin-top:32px;border-radius:12px;background:var(--surface-secondary);"></div>'
      + '<div data-dashboard-skeleton="approvals" style="height:150px;margin-top:32px;border-radius:12px;background:var(--surface-secondary);"></div>'
      + '</div>';
    if (window.performance && window.performance.mark) {
      window.performance.mark('decidr-dashboard-ack');
    }

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
      totals: { initiatives: 0, projects: 0, decisions: 0, tasks: 0, needs_action: 0 },
      recentDecisions: [],
      pendingApprovals: [],
      activeDecisionTotal: 0,
      activeDecisionStatusCounts: {},
      summary: null,
      drilldowns: null,
      drilldownPromise: null,
      summaryController: null,
      drilldownController: null,
      actionItemsController: null,
      loadGeneration: 0,
      legacyMode: false,
      readOnlyPreview: false,
      previewError: null,
      loaded: false,
      error: null,
      // New section state
      activeDecisionFilters: { BACKLOG: false, DRAFT: true, PROPOSED: true, IN_PROGRESS: true, STAGED: true, APPROVED: true, REJECTED: true },
      activeDecisionsVisible: false,
      nextStepsExpanded: false,
      nextStepsGroupExpanded: {},
      nextStepsHiddenTypes: {},
      nextStepsHiddenStatuses: {},
      nextStepsInitiativeMode: 'ALL',
      nextStepsSelectedInitiatives: {},
      nextStepsIncludeUnassigned: true,
      nextStepsFacets: null,
      nextStepsInitiativeFilterOpen: false,
      nextStepsPreferenceWarning: '',
      nextStepsSaveTimer: null,
      nextStepsPendingSave: null,
      nextStepsSavePromise: Promise.resolve(),
      decisionsExpanded: false,
      createDialog: null,
      // Org picker
      organizations: [],
      activeOrgId: null,
      defaultOrgId: null
    };

    // ── Show loading ───────────────────────────────────────

    // The stable shell was painted before auth initialization. Keep it in place
    // until a scoped preview or authoritative summary can replace it.

    // ── Fetch all data ─────────────────────────────────────

    function freshFetches() {
      return {
        organizations: null,
        defaultOrgId: null,
        activeOrgId: null,
        initiatives: null,
        projects: null,
        decisions: null,
        tasks: null,
        bridges: null,
        issues: null,
        prs: null,
        actionItems: null,
        timeline: null,
        nextStepsFilters: null,
        nextStepsPreferenceError: null
      };
    }

    var fetches = freshFetches();

    function emitDashboardMetric(outcome, detail) {
      var safeDetail = {
        route: 'dashboard',
        representation_version: 'dashboard.v1',
        outcome: outcome
      };
      detail = detail || {};
      if (typeof detail.status === 'number') safeDetail.status = detail.status;
      if (window.performance && window.performance.mark) {
        window.performance.mark('decidr-dashboard-' + outcome);
      }
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('decidr:dashboard-performance', {
          detail: safeDetail
        }));
      }
    }

    function unwrapList(resp) {
      if (resp && Array.isArray(resp.data)) return resp.data;
      if (Array.isArray(resp)) return resp;
      return [];
    }

    function orgExists(orgs, orgId) {
      if (!orgId) return false;
      for (var i = 0; i < orgs.length; i++) {
        if (orgs[i].id === orgId) return true;
      }
      return false;
    }

    function inferOrgIdFromRows(orgs) {
      var sources = [
        fetches.initiatives,
        fetches.projects,
        fetches.decisions,
        fetches.tasks,
        fetches.bridges,
        fetches.actionItems
      ];
      for (var s = 0; s < sources.length; s++) {
        var rows = sources[s] || [];
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r] || {};
          var orgId = row.orgId || row.organizationId || row.org_id || row.organization_id;
          if (orgExists(orgs, orgId)) return orgId;
        }
      }
      return null;
    }

    function requiredLoad(label, promise, assign) {
      return promise.then(function(resp) {
        assign(unwrapList(resp));
      }).catch(function(err) {
        if (err && typeof err === 'object' && !err._decidrOperation) {
          err._decidrOperation = label;
        }
        throw err;
      });
    }

    function loadRequiredDashboardData(target) {
      var targetOrgId = target.activeOrgId || dashState.activeOrgId || API.getActiveOrgId();
      return Promise.all([
        requiredLoad('Initiatives', API.listInitiatives({ take: 200 }), function(rows) { target.initiatives = rows; }),
        requiredLoad('Projects', API.listProjects({ take: 200 }), function(rows) { target.projects = rows; }),
        requiredLoad('Decisions', API.listDecisions({ take: 200 }), function(rows) { target.decisions = rows; }),
        requiredLoad('Tasks', API.listTasks({ take: 200 }), function(rows) { target.tasks = rows; }),
        requiredLoad('Bridges', API.listBridges({ take: 200 }), function(rows) { target.bridges = rows; }),
        API.listIssues({ take: 200 }).then(function(resp) { target.issues = unwrapList(resp); }).catch(function() { target.issues = []; }),
        API.listPRs({ take: 200 }).then(function(resp) { target.prs = unwrapList(resp); }).catch(function() { target.prs = []; }),
        API.getActionItems({ take: 200 }).then(function(resp) { target.actionItems = unwrapList(resp); }).catch(function() { target.actionItems = []; }),
        API.getTimeline({ take: 200 }).then(function(resp) { target.timeline = unwrapList(resp); }).catch(function() { target.timeline = []; }),
        API.getNextStepsFilters(targetOrgId).then(function(resp) {
          target.nextStepsFilters = resp;
          target.nextStepsPreferenceError = null;
        }).catch(function(err) {
          target.nextStepsFilters = null;
          target.nextStepsPreferenceError = err;
        })
      ]);
    }

    function projectMapFromProjects(projects) {
      // Projects have direct initiativeId
      var projectToInit = {};
      projects = projects || [];
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
    }

    function isAuthLoadError(err) {
      return !!(err && (
        err.code === 'DECIDR_ORG_CONTEXT_UNAVAILABLE' ||
        err.status === 401 ||
        err.status === 403
      ));
    }

    function authOrgIdForError(err) {
      return (err && (err.organizationId || err.orgId)) || _orgId || API.getActiveOrgId();
    }

    function renderDashboardLoadError(err) {
      var detail = API.describeError
        ? API.describeError(err, 'Please try again.')
        : ((err && err.message) || 'Please try again.');
      var orgId = authOrgIdForError(err);
      var canAuth = isAuthLoadError(err) && orgId;
      container.innerHTML = '<div style="padding:var(--space-6);">'
        + '<div class="decidr-empty-state">'
        + '<p class="decidr-empty-message">Failed to load dashboard data: ' + UI.escapeHtml(detail) + '</p>'
        + '<div style="display:flex;justify-content:center;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-4);">'
        + '<button id="decidr-dashboard-retry-load" type="button" class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm">Retry</button>'
        + (canAuth ? '<button id="decidr-dashboard-auth-load" type="button" class="decidr-so-btn decidr-so-btn-sm">Sign in to DecidR</button>' : '')
        + '</div>'
        + '<p id="decidr-dashboard-load-hint" style="color:var(--text-secondary);font-size:12px;margin-top:var(--space-3);"></p>'
        + '</div>'
        + '</div>';
      var retry = container.querySelector('#decidr-dashboard-retry-load');
      if (retry) {
        retry.addEventListener('click', function() {
          loadDashboard();
        });
      }
      var auth = container.querySelector('#decidr-dashboard-auth-load');
      if (auth && canAuth) {
        auth.addEventListener('click', function() {
          var hint = container.querySelector('#decidr-dashboard-load-hint');
          if (hint) hint.textContent = 'Opening DecidR sign-in...';
          API.openPluginAuth(orgId).then(function() {
            if (hint) hint.textContent = 'Sign-in opened. Retry after connecting this organization.';
          }).catch(function(error) {
            console.warn('[decidr] Failed to open DecidR sign-in:', error);
            if (hint) hint.textContent = 'Could not open sign-in. Retry or open DecidR auth from MCPViews.';
          });
        });
      }
    }

    function applyLoadedDashboardState() {
      var projectMap = projectMapFromProjects(fetches.projects || []);
      // Org list + tokenStatus + defaultOrgId come pre-annotated from the
      // API.resolveAndBindTargetOrg preflight — no local recomputation.
      var orgs = fetches.organizations || [];
      dashState.organizations = orgs;
      dashState.defaultOrgId = fetches.defaultOrgId || null;
      // Mirror the bound token's org onto local state. Some renderer launches
      // only get a bearer-resolved org from returned records, so use that
      // before falling back to the first org in the membership list.
      var boundOrgId = API.getActiveOrgId() || fetches.activeOrgId || inferOrgIdFromRows(orgs);
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
      applyNextStepsPreference(fetches.nextStepsFilters, fetches.nextStepsPreferenceError);

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
    }

    function loadLegacyDashboard() {
      dashState.legacyMode = true;
      dashState.loaded = false;
      dashState.error = null;
      fetches = freshFetches();
      container.innerHTML = UI.loadingSpinner('Loading dashboard...');
      // Preflight: resolve the user's target org BEFORE firing the main data
      // fetches. Without this, data fetches run against whatever token withReady
      // picked first (usually the currently-connected org), and the user's
      // default-org preference is ignored on fresh mount.
      return API.resolveAndBindTargetOrg({
        pushedOrgId: (data && data.organization_id) ? data.organization_id : null
      }).then(function(preflight) {
        fetches.organizations = preflight.organizations;
        fetches.defaultOrgId = preflight.defaultOrgId;
        fetches.activeOrgId = preflight.activeOrgId;
        // Phase 2: actual data fetches now run against the correct org token.
        return loadRequiredDashboardData(fetches);
      }).then(function() {
        applyLoadedDashboardState();
      }).catch(function(err) {
        dashState.error = err;
        console.error('[decidr] Dashboard initial load failed:', err);
        renderDashboardLoadError(err);
      });
    }

    function mergeDecisionRows(groups) {
      var seen = {};
      var rows = [];
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g] || [];
        for (var i = 0; i < group.length; i++) {
          var row = group[i];
          if (!row || !row.id || seen[row.id]) continue;
          seen[row.id] = true;
          rows.push(row);
        }
      }
      return rows;
    }

    function applyDashboardSummary(summary, readOnlyPreview) {
      if (!summary || summary.representation_version !== 'dashboard.v1') {
        var versionError = new Error('Unsupported dashboard representation');
        versionError.code = 'DECIDR_DASHBOARD_REPRESENTATION';
        throw versionError;
      }
      var responseOrgId = summary.organization && summary.organization.id;
      if (_orgId && responseOrgId !== _orgId) {
        API.purgeDashboardPreview(_orgId);
        var scopeError = new Error('Dashboard organization did not match the requested organization');
        scopeError.code = 'DECIDR_DASHBOARD_SCOPE_MISMATCH';
        scopeError.status = 403;
        throw scopeError;
      }

      API.setVerifiedPrincipal(summary.viewer);
      dashState.summary = summary;
      dashState.activeOrgId = responseOrgId;
      dashState.defaultOrgId = summary.default_organization_id || null;
      dashState.organizations = summary.organizations || [];
      for (var o = 0; o < dashState.organizations.length; o++) {
        if (dashState.organizations[o].id === responseOrgId) {
          dashState.organizations[o].tokenStatus = 'valid';
        }
      }
      dashState.totals = summary.totals || dashState.totals;
      dashState.actionItems = (summary.next_steps && summary.next_steps.data) || [];
      dashState.nextStepsFacets = (summary.next_steps && summary.next_steps.facets) || null;
      dashState.initiatives = (summary.initiatives && summary.initiatives.data) || [];
      dashState.recentDecisions = summary.recent_decisions || [];
      dashState.pendingApprovals = (summary.pending_approvals && summary.pending_approvals.data) || [];
      dashState.activeDecisionTotal = (summary.active_decisions && summary.active_decisions.total_count) || 0;
      dashState.activeDecisionStatusCounts = (summary.active_decisions && summary.active_decisions.status_counts) || {};
      dashState.allDecisions = mergeDecisionRows([
        dashState.recentDecisions,
        dashState.pendingApprovals
      ]);
      dashState.projectsByInitiative = {};
      applyNextStepsPreference(summary.next_steps_preference, null);
      dashState.loaded = true;
      dashState.error = null;
      dashState.readOnlyPreview = !!readOnlyPreview;
      dashState.previewError = null;

      for (var i = 0; i < dashState.initiatives.length; i++) {
        var initiativeId = dashState.initiatives[i].id;
        if (dashState.collapsedInitiatives[initiativeId] === undefined) {
          dashState.collapsedInitiatives[initiativeId] = true;
        }
      }
      renderDashboard();
      if (window.performance && window.performance.mark) {
        window.performance.mark(readOnlyPreview
          ? 'decidr-dashboard-preview'
          : 'decidr-dashboard-authoritative');
      }
    }

    function applyDashboardDrilldowns(drilldowns, readOnlyPreview) {
      if (!drilldowns || drilldowns.representation_version !== 'dashboard.v1') return;
      if (dashState.activeOrgId && drilldowns.organization_id !== dashState.activeOrgId) {
        API.purgeDashboardPreview(dashState.activeOrgId);
        return;
      }
      dashState.drilldowns = drilldowns;
      var activeRows = (drilldowns.active_decisions && drilldowns.active_decisions.data) || [];
      var projectRows = (drilldowns.projects && drilldowns.projects.data) || [];
      dashState.allDecisions = mergeDecisionRows([
        activeRows,
        dashState.recentDecisions,
        dashState.pendingApprovals
      ]);
      dashState.projectsByInitiative = projectMapFromProjects(projectRows);
      dashState.lastActivityByEntity = {};
      for (var i = 0; i < activeRows.length; i++) {
        if (!activeRows[i].lastActivityAt) continue;
        dashState.lastActivityByEntity[activeRows[i].id] = {
          action: activeRows[i].lastActivityAction,
          label: ACTIVITY_LABELS[activeRows[i].lastActivityAction] || activeRows[i].lastActivityAction,
          createdAt: activeRows[i].lastActivityAt
        };
      }
      dashState.readOnlyPreview = !!readOnlyPreview;
      renderDashboard();
    }

    function preloadDashboardDrilldowns(generation) {
      if (dashState.drilldownController) dashState.drilldownController.abort();
      dashState.drilldownController = new AbortController();
      var controller = dashState.drilldownController;
      dashState.drilldownPromise = API.getDashboardDrilldowns({
        include: 'active_decisions,projects'
      }, {
        signal: controller.signal
      }).then(function(drilldowns) {
        if (generation !== dashState.loadGeneration) return drilldowns;
        applyDashboardDrilldowns(drilldowns, false);
        API.putDashboardPreview(dashState.activeOrgId, dashState.summary, drilldowns);
        return drilldowns;
      }).catch(function(err) {
        if (err && err.name === 'AbortError') return null;
        if (err && (err.status === 401 || err.status === 403)) {
          API.purgeDashboardPreview(dashState.activeOrgId);
          renderDashboardLoadError(err);
          return null;
        }
        console.warn('[decidr] Dashboard drilldown preload failed:', err);
        return null;
      });
      return dashState.drilldownPromise;
    }

    function loadDashboard() {
      var options = arguments[0] || {};
      dashState.legacyMode = false;
      dashState.loadGeneration++;
      var generation = dashState.loadGeneration;
      if (dashState.summaryController) dashState.summaryController.abort();
      if (dashState.drilldownController) dashState.drilldownController.abort();
      dashState.summaryController = new AbortController();

      if (!_orgId) {
        return loadLegacyDashboard();
      }

      var preview = options.ignorePreview ? null : API.getDashboardPreview(_orgId);
      if (preview && preview.summary) {
        applyDashboardSummary(preview.summary, true);
        if (preview.drilldowns) applyDashboardDrilldowns(preview.drilldowns, true);
        emitDashboardMetric('preview-hit');
      }

      return API.getDashboardSummary({
        signal: dashState.summaryController.signal
      }).then(function(summary) {
        if (generation !== dashState.loadGeneration) return;
        applyDashboardSummary(summary, false);
        emitDashboardMetric('authoritative');
        API.putDashboardPreview(_orgId, summary, null);
        preloadDashboardDrilldowns(generation);
        API.listPluginOrgAuth().then(function(entries) {
          var statusByOrg = {};
          for (var i = 0; i < (entries || []).length; i++) {
            var entry = entries[i] || {};
            statusByOrg[entry.org_id || entry.orgId] = entry.status || 'valid';
          }
          for (var o = 0; o < dashState.organizations.length; o++) {
            dashState.organizations[o].tokenStatus = statusByOrg[dashState.organizations[o].id] || 'no-token';
          }
          renderDashboard();
        }).catch(function() {});
      }).catch(function(err) {
        if (err && err.name === 'AbortError') return;
        if (err && (err.status === 404 || err.status === 501)) {
          emitDashboardMetric('legacy-fallback', { status: err.status });
          return loadLegacyDashboard();
        }
        if (err && (err.status === 401 || err.status === 403)) {
          API.purgeDashboardPreview(_orgId);
          renderDashboardLoadError(err);
          return;
        }
        if (preview && preview.summary) {
          dashState.readOnlyPreview = true;
          dashState.previewError = API.describeError(err, 'Fresh dashboard data is unavailable.');
          emitDashboardMetric('locked-preview-error', { status: err && err.status });
          renderDashboard();
          return;
        }
        renderDashboardLoadError(err);
      });
    }

    loadDashboard();

    function refreshLegacyDashboard() {
      var rf = {
        initiatives: null, projects: null, decisions: null, tasks: null,
        bridges: null, issues: null, prs: null, actionItems: null, timeline: null,
        activeOrgId: API.getActiveOrgId() || dashState.activeOrgId,
        nextStepsFilters: null, nextStepsPreferenceError: null
      };
      return loadRequiredDashboardData(rf).then(function() {
        var projects = rf.projects || [];
        var projectMap = projectMapFromProjects(projects);
        dashState.initiatives = rf.initiatives;
        dashState.projectsByInitiative = projectMap;
        dashState.allDecisions = rf.decisions;
        dashState.allTasks = rf.tasks;
        dashState.allBridges = rf.bridges;
        dashState.allIssues = rf.issues || [];
        dashState.allPRs = rf.prs || [];
        dashState.actionItems = rf.actionItems || [];
        applyNextStepsPreference(rf.nextStepsFilters, rf.nextStepsPreferenceError);

        dashState.lastActivityByEntity = buildActivityMap(rf.timeline || []);

        renderDashboard();
      }).catch(function(err) {
        console.error('[decidr] Dashboard refresh failed:', err);
      });
    }

    function refreshDashboard() {
      var orgId = dashState.activeOrgId || _orgId;
      API.purgeDashboardPreview(orgId);
      if (dashState.legacyMode) return refreshLegacyDashboard();
      return loadDashboard({ ignorePreview: true });
    }

    function evictEntityFromDashboardState(entityId) {
      function withoutEntity(rows) {
        var retained = [];
        for (var i = 0; i < (rows || []).length; i++) {
          var row = rows[i] || {};
          if (row.id === entityId || row.entityId === entityId || row.entity_id === entityId) continue;
          retained.push(row);
        }
        return retained;
      }

      dashState.actionItems = withoutEntity(dashState.actionItems);
      dashState.allDecisions = withoutEntity(dashState.allDecisions);
      dashState.recentDecisions = withoutEntity(dashState.recentDecisions);
      dashState.pendingApprovals = withoutEntity(dashState.pendingApprovals);
      for (var initiativeId in dashState.projectsByInitiative) {
        if (!dashState.projectsByInitiative.hasOwnProperty(initiativeId)) continue;
        dashState.projectsByInitiative[initiativeId] = withoutEntity(
          dashState.projectsByInitiative[initiativeId]
        );
      }
    }

    if (container._decidrDashboardEntityEvictedHandler) {
      window.removeEventListener(
        'decidr:dashboard-entity-evicted',
        container._decidrDashboardEntityEvictedHandler
      );
    }
    container._decidrDashboardEntityEvictedHandler = function(event) {
      var detail = event && event.detail ? event.detail : {};
      if (
        detail.organizationId &&
        dashState.activeOrgId &&
        detail.organizationId !== dashState.activeOrgId
      ) return;
      evictEntityFromDashboardState(detail.entityId);
      dashState.readOnlyPreview = true;
      dashState.previewError = 'This item no longer exists. Refreshing dashboard data.';
      renderDashboard();
      refreshDashboard();
    };
    window.addEventListener(
      'decidr:dashboard-entity-evicted',
      container._decidrDashboardEntityEvictedHandler
    );

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

    function truthyMapFromArray(values) {
      var out = {};
      values = Array.isArray(values) ? values : [];
      for (var i = 0; i < values.length; i++) {
        if (typeof values[i] === 'string' && values[i]) out[values[i]] = true;
      }
      return out;
    }

    function truthyMapKeys(map) {
      var values = [];
      map = map || {};
      for (var key in map) {
        if (map.hasOwnProperty(key) && map[key]) values.push(key);
      }
      return values;
    }

    function applyNextStepsPreference(preference, loadError) {
      preference = preference || {};
      dashState.nextStepsInitiativeMode = preference.initiativeMode === 'CUSTOM' ? 'CUSTOM' : 'ALL';
      dashState.nextStepsSelectedInitiatives = truthyMapFromArray(preference.initiativeIds);
      dashState.nextStepsIncludeUnassigned = dashState.nextStepsInitiativeMode === 'ALL'
        ? true
        : preference.includeUnassigned === true;
      dashState.nextStepsHiddenTypes = truthyMapFromArray(preference.hiddenTypes);
      dashState.nextStepsHiddenStatuses = truthyMapFromArray(preference.hiddenStatuses);
      dashState.nextStepsInitiativeFilterOpen = false;
      dashState.nextStepsPreferenceWarning = loadError
        ? 'Saved filters could not be loaded. Showing defaults; account sync may be unavailable.'
        : '';
    }

    function nextStepsPreferenceSnapshot() {
      return {
        organizationId: dashState.activeOrgId || API.getActiveOrgId(),
        initiativeMode: dashState.nextStepsInitiativeMode,
        initiativeIds: dashState.nextStepsInitiativeMode === 'CUSTOM'
          ? truthyMapKeys(dashState.nextStepsSelectedInitiatives)
          : [],
        includeUnassigned: dashState.nextStepsInitiativeMode === 'ALL'
          ? true
          : dashState.nextStepsIncludeUnassigned,
        hiddenTypes: truthyMapKeys(dashState.nextStepsHiddenTypes),
        hiddenStatuses: truthyMapKeys(dashState.nextStepsHiddenStatuses)
      };
    }

    function syncNextStepsPreferenceWarning() {
      var warning = container.querySelector('#decidr-next-steps-filter-warning');
      if (!warning) return;
      warning.textContent = dashState.nextStepsPreferenceWarning || '';
      warning.hidden = !dashState.nextStepsPreferenceWarning;
    }

    function flushNextStepsFilterSave() {
      if (dashState.nextStepsSaveTimer) {
        clearTimeout(dashState.nextStepsSaveTimer);
        dashState.nextStepsSaveTimer = null;
      }
      var payload = dashState.nextStepsPendingSave;
      dashState.nextStepsPendingSave = null;
      if (!payload || !payload.organizationId) return dashState.nextStepsSavePromise;

      dashState.nextStepsSavePromise = dashState.nextStepsSavePromise.catch(function() {
        return null;
      }).then(function() {
        return API.saveNextStepsFilters(payload);
      }).then(function() {
        if (dashState.summary) {
          dashState.summary.next_steps_preference = payload;
          API.putDashboardPreview(
            dashState.activeOrgId,
            dashState.summary,
            dashState.drilldowns
          );
        }
        dashState.nextStepsPreferenceWarning = '';
        syncNextStepsPreferenceWarning();
      }).catch(function(err) {
        console.warn('[decidr] Failed to save Next Steps filters:', err);
        dashState.nextStepsPreferenceWarning = 'Filter applied, but account sync failed. Change a filter to retry.';
        syncNextStepsPreferenceWarning();
      });
      return dashState.nextStepsSavePromise;
    }

    function queueNextStepsFilterSave() {
      dashState.nextStepsPendingSave = nextStepsPreferenceSnapshot();
      if (dashState.nextStepsSaveTimer) clearTimeout(dashState.nextStepsSaveTimer);
      dashState.nextStepsSaveTimer = setTimeout(function() {
        flushNextStepsFilterSave();
      }, 200);
    }

    function clearNextStepsFilterPreference() {
      if (dashState.nextStepsSaveTimer) {
        clearTimeout(dashState.nextStepsSaveTimer);
        dashState.nextStepsSaveTimer = null;
      }
      dashState.nextStepsPendingSave = null;
      var orgId = dashState.activeOrgId || API.getActiveOrgId();
      if (!orgId) return Promise.resolve();
      dashState.nextStepsSavePromise = dashState.nextStepsSavePromise.catch(function() {
        return null;
      }).then(function() {
        return API.clearNextStepsFilters(orgId);
      }).then(function() {
        if (dashState.summary) {
          dashState.summary.next_steps_preference = {
            organizationId: orgId,
            initiativeMode: 'ALL',
            initiativeIds: [],
            includeUnassigned: true,
            hiddenTypes: [],
            hiddenStatuses: []
          };
          API.putDashboardPreview(
            dashState.activeOrgId,
            dashState.summary,
            dashState.drilldowns
          );
        }
        dashState.nextStepsPreferenceWarning = '';
        syncNextStepsPreferenceWarning();
      }).catch(function(err) {
        console.warn('[decidr] Failed to reset saved Next Steps filters:', err);
        dashState.nextStepsPreferenceWarning = 'Filters reset here, but the saved preference could not be cleared.';
        syncNextStepsPreferenceWarning();
      });
      return dashState.nextStepsSavePromise;
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
      } else if (type === 'ISSUE') {
        full = findEntityById(dashState.allIssues, id);
      }
      if (!full) return item;
      var enriched = shallowMerge(full, item);
      enriched.entityType = item.entityType || item.entity_type || type;
      enriched.entityId = item.entityId || item.entity_id || full.id;
      return enriched;
    }

    function normalizeActionItemType(item) {
      return String((item && (item.entityType || item.entity_type)) || 'OTHER').toUpperCase();
    }

    function normalizeActionItemStatus(item) {
      return String((item && item.status) || 'UNKNOWN').toUpperCase();
    }

    function addUniqueValue(values, value) {
      if (typeof value === 'string' && value && values.indexOf(value) === -1) {
        values.push(value);
      }
    }

    function projectInitiativeId(projectId) {
      if (!projectId) return null;
      for (var initiativeId in dashState.projectsByInitiative) {
        if (!dashState.projectsByInitiative.hasOwnProperty(initiativeId)) continue;
        var projects = dashState.projectsByInitiative[initiativeId] || [];
        for (var i = 0; i < projects.length; i++) {
          if (projects[i].id === projectId) {
            return initiativeId === '_ungrouped' ? null : initiativeId;
          }
        }
      }
      return null;
    }

    function addBridgeInitiativeIds(values, bridge) {
      if (!bridge) return;
      addUniqueValue(values, projectInitiativeId(
        bridge.fromProjectId || bridge.from_project_id || bridge.sourceProjectId || bridge.source_project_id
      ));
      addUniqueValue(values, projectInitiativeId(
        bridge.toProjectId || bridge.to_project_id || bridge.targetProjectId || bridge.target_project_id
      ));
    }

    function addDecisionInitiativeIds(values, decision, includeBridge) {
      if (!decision) return;
      addUniqueValue(values, decision.initiativeId || decision.initiative_id);
      addUniqueValue(values, projectInitiativeId(decision.projectId || decision.project_id));
      var parentType = String(decision.entityType || decision.entity_type || '').toUpperCase();
      var parentId = decision.entityId || decision.entity_id;
      if (parentType === 'INITIATIVE') addUniqueValue(values, parentId);
      if (parentType === 'PROJECT') addUniqueValue(values, projectInitiativeId(parentId));
      if (includeBridge !== false) {
        addBridgeInitiativeIds(values, findEntityById(
          dashState.allBridges,
          decision.bridgeId || decision.bridge_id
        ));
      }
    }

    function addTaskInitiativeIds(values, task) {
      if (!task) return;
      addUniqueValue(values, task.initiativeId || task.initiative_id);
      addUniqueValue(values, projectInitiativeId(task.projectId || task.project_id));
      addDecisionInitiativeIds(values, findEntityById(
        dashState.allDecisions,
        task.decisionId || task.decision_id
      ), true);
      addBridgeInitiativeIds(values, findEntityById(
        dashState.allBridges,
        task.bridgeId || task.bridge_id
      ));
    }

    function resolveActionItemInitiativeIds(item) {
      var values = [];
      var supplied = item && (item.initiativeIds || item.initiative_ids);
      if (Array.isArray(supplied)) {
        for (var i = 0; i < supplied.length; i++) addUniqueValue(values, supplied[i]);
      }
      if (!item) return values;

      addUniqueValue(values, item.initiativeId || item.initiative_id);
      var type = normalizeActionItemType(item);
      if (type === 'DECISION') {
        addDecisionInitiativeIds(values, item, true);
      } else if (type === 'TASK') {
        addTaskInitiativeIds(values, item);
      } else if (type === 'ISSUE') {
        addUniqueValue(values, projectInitiativeId(
          item.projectId || item.project_id || item.linkedProjectId || item.linked_project_id
        ));
        var links = item.entityLinks || item.entity_links || [];
        for (var l = 0; l < links.length; l++) {
          var linkedType = String(links[l].entityType || links[l].entity_type || '').toUpperCase();
          var linkedId = links[l].entityId || links[l].entity_id;
          if (linkedType === 'PROJECT') {
            addUniqueValue(values, projectInitiativeId(linkedId));
          } else if (linkedType === 'TASK') {
            addTaskInitiativeIds(values, findEntityById(dashState.allTasks, linkedId));
          } else if (linkedType === 'DECISION') {
            addDecisionInitiativeIds(values, findEntityById(dashState.allDecisions, linkedId), true);
          }
        }
      } else if (type === 'PROJECT') {
        addUniqueValue(values, projectInitiativeId(item.entityId || item.entity_id || item.id));
      } else if (type === 'INITIATIVE') {
        addUniqueValue(values, item.entityId || item.entity_id || item.id);
      } else if (type === 'BRIDGE') {
        addBridgeInitiativeIds(values, findEntityById(
          dashState.allBridges,
          item.entityId || item.entity_id || item.id
        ));
      }
      return values;
    }

    function actionItemMatchesInitiativeFilter(item) {
      if (dashState.nextStepsInitiativeMode !== 'CUSTOM') return true;
      var initiativeIds = item.initiativeIds || [];
      if (initiativeIds.length === 0) return dashState.nextStepsIncludeUnassigned;
      for (var i = 0; i < initiativeIds.length; i++) {
        if (dashState.nextStepsSelectedInitiatives[initiativeIds[i]]) return true;
      }
      return false;
    }

    function getEnrichedActionItems() {
      var results = [];
      var rawItems = dashState.actionItems || [];
      for (var i = 0; i < rawItems.length; i++) {
        var enriched = enrichActionItem(rawItems[i]) || {};
        var normalized = shallowMerge(enriched, {
          entityType: normalizeActionItemType(enriched),
          status: normalizeActionItemStatus(enriched),
          initiativeIds: resolveActionItemInitiativeIds(enriched)
        });
        results.push(normalized);
      }
      return results;
    }

    function getFilteredActionItems(items) {
      var results = [];
      for (var i = 0; i < items.length; i++) {
        var type = normalizeActionItemType(items[i]);
        var status = normalizeActionItemStatus(items[i]);
        if (!actionItemMatchesInitiativeFilter(items[i])) continue;
        if (dashState.nextStepsHiddenTypes[type]) continue;
        if (dashState.nextStepsHiddenStatuses[status]) continue;
        results.push(items[i]);
      }
      return results;
    }

    function hasNextStepsFilters() {
      var key;
      for (key in dashState.nextStepsHiddenTypes) {
        if (dashState.nextStepsHiddenTypes.hasOwnProperty(key) && dashState.nextStepsHiddenTypes[key]) return true;
      }
      for (key in dashState.nextStepsHiddenStatuses) {
        if (dashState.nextStepsHiddenStatuses.hasOwnProperty(key) && dashState.nextStepsHiddenStatuses[key]) return true;
      }
      if (dashState.nextStepsInitiativeMode === 'CUSTOM') return true;
      return false;
    }

    function orderedFilterValues(counts, preferredOrder) {
      var values = [];
      for (var i = 0; i < preferredOrder.length; i++) {
        if (counts[preferredOrder[i]]) values.push(preferredOrder[i]);
      }
      for (var key in counts) {
        if (counts.hasOwnProperty(key) && values.indexOf(key) === -1) values.push(key);
      }
      return values;
    }

    function actionItemTypeLabel(type) {
      var labels = {
        DECISION: 'Decisions',
        TASK: 'Tasks',
        PROJECT: 'Projects',
        BRIDGE: 'Bridges',
        INITIATIVE: 'Initiatives',
        ISSUE: 'Issues',
        PULL_REQUEST: 'Pull Requests',
        OTHER: 'Other'
      };
      return labels[type] || String(type || 'Other').replace(/_/g, ' ').replace(/\b\w/g, function(c) {
        return c.toUpperCase();
      });
    }

    function actionItemStatusLabel(status) {
      return String(status || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, function(c) {
        return c.toUpperCase();
      });
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

    function isSupersededDecision(dec) {
      return !!(dec && dec.supersededById);
    }

    function isPendingDecision(dec) {
      if (isSupersededDecision(dec)) return false;
      var status = normalizeStatus(dec);
      return status === 'PROPOSED' || status === 'IN_PROGRESS' || status === 'STAGED';
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
        if (isPendingDecision(dec)) {
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
      var totals = dashState.totals || {};

      return UI.statsRow([
        { value: totals.initiatives || 0, label: 'Initiatives', opts: { animDelay: 0.05 } },
        { value: totals.projects || 0, label: 'Projects', opts: { animDelay: 0.10 } },
        { value: totals.decisions || 0, label: 'Decisions', opts: { animDelay: 0.15 } },
        { value: totals.tasks || 0, label: 'Tasks', opts: { animDelay: 0.20 } },
        { value: totals.needs_action || 0, label: 'Needs Action', opts: { animDelay: 0.25 } }
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

    function renderNextStepsFilterPill(kind, value, label, count, isIncluded) {
      var title = (isIncluded ? 'Hide ' : 'Show ') + label + ' next steps';
      return '<button type="button" class="decidr-dash-status-pill decidr-next-steps-filter-pill'
        + (isIncluded ? ' active' : '') + '" data-next-steps-filter-kind="' + UI.escapeHtml(kind)
        + '" data-next-steps-filter-value="' + UI.escapeHtml(value) + '" aria-pressed="'
        + (isIncluded ? 'true' : 'false') + '" title="' + UI.escapeHtml(title) + '">'
        + UI.escapeHtml(label) + ' <span class="decidr-next-steps-filter-count">' + count + '</span></button>';
    }

    function sortedInitiativesForFilter() {
      var initiatives = (dashState.initiatives || []).slice();
      initiatives.sort(function(a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      return initiatives;
    }

    function initiativeFilterTriggerLabel(initiatives) {
      if (dashState.nextStepsInitiativeMode === 'ALL') return 'All initiatives';
      var selectedCount = 0;
      for (var i = 0; i < initiatives.length; i++) {
        if (dashState.nextStepsSelectedInitiatives[initiatives[i].id]) selectedCount++;
      }
      if (selectedCount === 0 && dashState.nextStepsIncludeUnassigned) return 'No initiative';
      if (selectedCount === 0) return 'None selected';
      return selectedCount + ' selected';
    }

    function renderInitiativeFilter(items) {
      var initiatives = sortedInitiativesForFilter();
      var counts = dashState.nextStepsFacets && dashState.nextStepsFacets.initiatives
        ? dashState.nextStepsFacets.initiatives
        : {};
      var unassignedCount = dashState.nextStepsFacets
        ? Number(dashState.nextStepsFacets.unassigned || 0)
        : 0;
      if (!dashState.nextStepsFacets) {
        for (var i = 0; i < items.length; i++) {
          var initiativeIds = items[i].initiativeIds || [];
          if (initiativeIds.length === 0) {
            unassignedCount++;
            continue;
          }
          for (var j = 0; j < initiativeIds.length; j++) {
            counts[initiativeIds[j]] = (counts[initiativeIds[j]] || 0) + 1;
          }
        }
      }

      var allSelected = dashState.nextStepsInitiativeMode === 'ALL';
      var anySelected = allSelected || dashState.nextStepsIncludeUnassigned;
      if (!allSelected) {
        allSelected = true;
        for (var s = 0; s < initiatives.length; s++) {
          if (dashState.nextStepsSelectedInitiatives[initiatives[s].id]) {
            anySelected = true;
          } else {
            allSelected = false;
          }
        }
        if (unassignedCount > 0 && !dashState.nextStepsIncludeUnassigned) allSelected = false;
      }

      var html = '<div class="decidr-next-steps-initiative-filter">';
      html += '<button type="button" id="decidr-next-steps-initiative-trigger"'
        + ' class="decidr-next-steps-initiative-trigger" aria-haspopup="true"'
        + ' aria-expanded="' + (dashState.nextStepsInitiativeFilterOpen ? 'true' : 'false') + '"'
        + ' aria-controls="decidr-next-steps-initiative-menu">'
        + '<span>' + UI.escapeHtml(initiativeFilterTriggerLabel(initiatives)) + '</span>'
        + '<span class="decidr-next-steps-initiative-chevron" aria-hidden="true">\u25BE</span></button>';

      html += '<div id="decidr-next-steps-initiative-menu"'
        + ' class="decidr-next-steps-initiative-menu" role="group" aria-label="Initiatives"'
        + (dashState.nextStepsInitiativeFilterOpen ? '' : ' hidden') + '>';
      html += '<label class="decidr-next-steps-initiative-option decidr-next-steps-initiative-select-all">'
        + '<input type="checkbox" data-next-steps-initiative-select-all="true"'
        + ((!allSelected && anySelected) ? ' data-next-steps-indeterminate="true"' : '')
        + (allSelected ? ' checked' : '') + '>'
        + '<span>Select all</span></label>';
      html += '<div class="decidr-next-steps-initiative-list">';
      for (var k = 0; k < initiatives.length; k++) {
        var initiative = initiatives[k];
        var checked = dashState.nextStepsInitiativeMode === 'ALL'
          || !!dashState.nextStepsSelectedInitiatives[initiative.id];
        html += '<label class="decidr-next-steps-initiative-option">'
          + '<input type="checkbox" data-next-steps-initiative-id="' + UI.escapeHtml(initiative.id) + '"'
          + (checked ? ' checked' : '') + '>'
          + '<span class="decidr-next-steps-initiative-name">' + UI.escapeHtml(initiative.name || 'Untitled initiative') + '</span>'
          + '<span class="decidr-next-steps-filter-count">' + (counts[initiative.id] || 0) + '</span></label>';
      }
      if (unassignedCount > 0) {
        html += '<label class="decidr-next-steps-initiative-option">'
          + '<input type="checkbox" data-next-steps-initiative-unassigned="true"'
          + ((dashState.nextStepsInitiativeMode === 'ALL' || dashState.nextStepsIncludeUnassigned) ? ' checked' : '') + '>'
          + '<span class="decidr-next-steps-initiative-name">No initiative</span>'
          + '<span class="decidr-next-steps-filter-count">' + unassignedCount + '</span></label>';
      }
      html += '</div></div></div>';

      return {
        html: html,
        selectAllIndeterminate: !allSelected && anySelected
      };
    }

    function renderNextStepsFilters(items, visibleCount) {
      var typeCounts = dashState.nextStepsFacets && dashState.nextStepsFacets.types
        ? dashState.nextStepsFacets.types
        : {};
      var statusCounts = dashState.nextStepsFacets && dashState.nextStepsFacets.statuses
        ? dashState.nextStepsFacets.statuses
        : {};
      if (!dashState.nextStepsFacets) {
        for (var i = 0; i < items.length; i++) {
          var type = normalizeActionItemType(items[i]);
          var status = normalizeActionItemStatus(items[i]);
          typeCounts[type] = (typeCounts[type] || 0) + 1;
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
      }

      var types = orderedFilterValues(typeCounts, ['DECISION', 'TASK', 'PROJECT', 'BRIDGE', 'INITIATIVE', 'ISSUE', 'PULL_REQUEST', 'OTHER']);
      var statuses = orderedFilterValues(statusCounts, ['BACKLOG', 'DRAFT', 'PROPOSED', 'APPROVED', 'IN_PROGRESS', 'STAGED', 'TODO', 'BLOCKED', 'OPEN', 'IMPLEMENTED', 'DONE', 'REJECTED', 'CLOSED', 'MERGED', 'ARCHIVED', 'UNKNOWN']);
      var html = '<div class="decidr-next-steps-filters" aria-label="Filter Next Steps">';

      var initiativeFilter = renderInitiativeFilter(items);
      html += '<div class="decidr-next-steps-filter-row"><span class="decidr-next-steps-filter-label">Initiative</span>'
        + initiativeFilter.html + '</div>';

      html += '<div class="decidr-next-steps-filter-row"><span class="decidr-next-steps-filter-label">Type</span>'
        + '<div class="decidr-next-steps-filter-options">';
      for (var t = 0; t < types.length; t++) {
        var typeValue = types[t];
        html += renderNextStepsFilterPill('type', typeValue, actionItemTypeLabel(typeValue), typeCounts[typeValue], !dashState.nextStepsHiddenTypes[typeValue]);
      }
      html += '</div></div>';

      html += '<div class="decidr-next-steps-filter-row"><span class="decidr-next-steps-filter-label">Stage</span>'
        + '<div class="decidr-next-steps-filter-options">';
      for (var s = 0; s < statuses.length; s++) {
        var statusValue = statuses[s];
        html += renderNextStepsFilterPill('status', statusValue, actionItemStatusLabel(statusValue), statusCounts[statusValue], !dashState.nextStepsHiddenStatuses[statusValue]);
      }
      html += '</div></div>';

      html += '<div class="decidr-next-steps-filter-summary" aria-live="polite">'
        + '<span>Showing ' + visibleCount + ' of ' + items.length + ' next steps</span>'
        + (hasNextStepsFilters() ? '<button type="button" id="decidr-next-steps-filter-reset" class="decidr-next-steps-filter-reset">Reset filters</button>' : '')
        + '</div>'
        + '<p id="decidr-next-steps-filter-warning" class="decidr-next-steps-filter-warning" role="status"'
        + (dashState.nextStepsPreferenceWarning ? '' : ' hidden') + '>'
        + UI.escapeHtml(dashState.nextStepsPreferenceWarning || '') + '</p></div>';
      return html;
    }

    function renderNextStepsContent() {
      var items = getEnrichedActionItems();
      if (items.length === 0) {
        return UI.emptyState('No action items right now. You are all caught up!');
      }
      var filteredItems = getFilteredActionItems(items);
      var html = renderNextStepsFilters(items, filteredItems.length);
      if (filteredItems.length === 0) {
        return html + UI.emptyState('No next steps match these filters. Reset filters to show everything.');
      }

      // Group by entityType
      var groups = {};
      var groupOrder = [];
      for (var i = 0; i < filteredItems.length; i++) {
        var type = normalizeActionItemType(filteredItems[i]);
        if (!groups[type]) {
          groups[type] = [];
          groupOrder.push(type);
        }
        groups[type].push(filteredItems[i]);
      }

      var ENTITY_LABELS = {
        DECISION: 'Decisions',
        TASK: 'Tasks',
        PROJECT: 'Projects',
        BRIDGE: 'Bridges',
        INITIATIVE: 'Initiatives',
        ISSUE: 'Issues',
        PULL_REQUEST: 'Pull Requests'
      };

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
        html += '<button class="decidr-next-steps-group-header" data-next-steps-group="' + UI.escapeHtml(groupType)
          + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '">';
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
      var visibleCount = getFilteredActionItems(getEnrichedActionItems()).length;
      return UI.section('calendar', 'Next Steps', visibleCount,
        '<div id="decidr-next-steps-container">' + renderNextStepsContent() + '</div>',
        { actions: [{ label: '+ Task', action: 'task', title: 'Create task' }] });
    }

    function renderActiveDecisionsContent() {
      var decisions = getActiveDecisions();

      if (decisions.length === 0) {
        if (dashState.activeDecisionTotal > 0 && dashState.drilldownPromise) {
          return '<div class="decidr-dashboard-section-skeleton" aria-busy="true"'
            + ' style="height:160px;border-radius:12px;background:var(--surface-secondary);"></div>';
        }
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
      var totalCount = dashState.activeDecisionTotal || decisions.length;
      var visible = !!dashState.activeDecisionsVisible;
      var toggleLabel = visible ? 'Hide active decisions' : 'Show active decisions';
      var html = '<div class="decidr-active-decisions-toggle-row">'
        + '<button class="decidr-dash-show-more" id="decidr-active-decisions-toggle" aria-expanded="' + (visible ? 'true' : 'false') + '">'
        + UI.escapeHtml(toggleLabel) + '</button>'
        + '</div>';

      if (!visible) {
        return UI.section('decision', 'Active Decisions', totalCount, html,
          { actions: [{ label: '+ Decision', action: 'decision', title: 'Create decision' }] });
      }

      var statusSet = {};
      var summaryStatuses = dashState.activeDecisionStatusCounts || {};
      for (var summaryStatus in summaryStatuses) {
        if (summaryStatuses.hasOwnProperty(summaryStatus)) statusSet[summaryStatus] = true;
      }
      for (var i = 0; i < dashState.allDecisions.length; i++) {
        var loadedStatus = normalizeStatus(dashState.allDecisions[i]);
        if (loadedStatus) statusSet[loadedStatus] = true;
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
        var count = summaryStatuses[st] || 0;
        pillBar += '<button class="decidr-dash-status-pill' + (isActive ? ' active' : '') + '" data-decision-status="' + UI.escapeHtml(st) + '">'
          + UI.escapeHtml(label) + ' (' + count + ')</button>';
      }
      pillBar += '</div>';

      return UI.section('decision', 'Active Decisions', totalCount,
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
        var decsByStatus = initiative.decision_status_counts || groupDecisionsByStatus(initDecisions);
        var initiativeProjectCount = typeof initiative.project_count === 'number'
          ? initiative.project_count : initProjects.length;
        var initiativeDecisionCount = typeof initiative.decision_count === 'number'
          ? initiative.decision_count : initDecisions.length;
        var isCollapsed = !!dashState.collapsedInitiatives[initiative.id];

        html += UI.initiativeCard(initiative, {
          projectCount: initiativeProjectCount,
          totalDecisions: initiativeDecisionCount,
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
            if (isPendingDecision(pDec)) {
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
          var ghCounts = {
            issues: Number(proj.githubIssueCount || 0),
            pullRequests: Number(proj.githubPrCount || 0)
          };
          cards += UI.dashboardProjectCard(proj, {
            decisions: projDecisions,
            tasks: projTasks,
            bridges: projBridges,
            decisionCount: Number(proj.decisionCount || 0),
            taskCount: Number(proj.taskCount || 0),
            taskDoneCount: Number(proj.taskDoneCount || 0),
            bridgeCount: Number(proj.bridgeCount || 0),
            isOwner: isOwner,
            pendingDecisions: Number(proj.pendingDecisionCount || pendingCount),
            needsYourReview: Number(proj.needsYourReviewCount || needsReviewCount),
            githubCounts: ghCounts,
            animDelay: 0.05 + animIdx * 0.05
          });
          animIdx++;
        }

        var initProjectsId = 'decidr-init-projects-' + String(initiative.id || '').replace(/[^A-Za-z0-9_-]/g, '-');
        var collapsedStyle = isCollapsed ? ' style="display: none;"' : '';
        html += '<div class="decidr-init-projects" id="' + UI.escapeHtml(initProjectsId) + '" data-init-projects="'
          + UI.escapeHtml(initiative.id) + '"' + collapsedStyle + '>'
          + '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));'
          + ' gap: var(--space-4); padding: var(--space-2) 0 var(--space-4) 0;">'
          + cards + '</div></div>';
      }

      return html;
    }

    function renderRecentDecisionsSection() {
      var recent = dashState.recentDecisions.length
        ? dashState.recentDecisions : getRecentDecisions(5);
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
      var pending = [];
      if (dashState.pendingApprovals.length) {
        for (var pi = 0; pi < dashState.pendingApprovals.length; pi++) {
          var pendingDecision = dashState.pendingApprovals[pi];
          pending.push({
            decision: pendingDecision,
            projectName: pendingDecision.project
              ? pendingDecision.project.name
              : (pendingDecision.projectName || '')
          });
        }
      } else {
        pending = getPendingDecisions();
      }
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
      var html = '<div class="decidr-dashboard-root">';
      if (dashState.readOnlyPreview) {
        html += '<div class="decidr-dashboard-preview-banner" role="status"'
          + ' style="margin-bottom:var(--space-4);padding:var(--space-3);border:1px solid var(--border-subtle);'
          + 'border-radius:var(--border-radius-md);background:var(--surface-secondary);color:var(--text-secondary);">'
          + '<strong>Refreshing dashboard.</strong> Cached data is read-only until access and state are verified.'
          + (dashState.previewError
            ? '<div style="margin-top:4px;">' + UI.escapeHtml(dashState.previewError) + '</div>'
            : '')
          + '</div>';
      }

      // Title with org picker
      html += '<div class="decidr-dashboard-header">'
        + '<div class="decidr-dashboard-title-block">'
        + '<p class="decidr-dashboard-kicker">DecidR</p>'
        + '<h1 class="decidr-dashboard-title">Governance Dashboard</h1>'
        + '<p class="decidr-dashboard-subtitle">Next decisions, approvals, projects, and proof signals in one workspace.</p>'
        + '</div>'
        + UI.orgPicker(dashState.organizations, dashState.activeOrgId, {
          defaultOrgId: dashState.defaultOrgId,
          showActiveSettings: true
        })
        + '</div>';

      // Stats
      html += renderStatsSection();

      // Next Steps (replaces Action Items)
      html += '<div id="decidr-next-steps-section" style="margin-top: var(--space-8);">'
        + renderNextStepsSection()
        + '</div>';

      // Active Decisions
      html += '<div class="decidr-dashboard-below-fold" style="margin-top: var(--space-8);">'
        + renderActiveDecisionsSection()
        + '</div>';

      // Initiative sections
      html += '<div class="decidr-dashboard-below-fold" style="margin-top: var(--space-8);">'
        + renderInitiativeSections()
        + '</div>';

      // Recent Decisions
      var recentHtml = renderRecentDecisionsSection();
      if (recentHtml) {
        html += '<div class="decidr-dashboard-below-fold" style="margin-top: var(--space-8);">'
          + recentHtml + '</div>';
      }

      // Pending Approvals
      var pendingHtml = renderPendingApprovalsSection();
      if (pendingHtml) {
        html += '<div class="decidr-dashboard-below-fold" style="margin-top: var(--space-8);">'
          + pendingHtml + '</div>';
      }

      html += '</div>';
      html += renderCreateDialog();

      container.innerHTML = html;
      container.setAttribute('aria-busy', dashState.readOnlyPreview ? 'true' : 'false');
      if (dashState.readOnlyPreview) {
        var lockedControls = container.querySelectorAll('button, input, select, textarea');
        for (var lockedIndex = 0; lockedIndex < lockedControls.length; lockedIndex++) {
          lockedControls[lockedIndex].disabled = true;
          lockedControls[lockedIndex].setAttribute('aria-disabled', 'true');
        }
      }
      wireInteractions();
    }

    // ── Event Wiring ───────────────────────────────────────

    function wireInteractions() {
      if (dashState.readOnlyPreview) return;
      wireNextStepsFilters();
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
      var activeSettingsBtn = container.querySelector('.decidr-org-picker-active-settings');

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

      function openOrgSettingsForOrg(settingsOrgId) {
        if (!settingsOrgId) return;
        menu.classList.remove('open');
        if (settingsOrgId === API.getActiveOrgId()) {
          openOrgSettings(settingsOrgId);
          return;
        }
        container.innerHTML = UI.loadingSpinner('Switching organization...');
        flushNextStepsFilterSave().then(function() {
          API.purgeDashboardPreview(dashState.activeOrgId);
          dashState.activeOrgId = settingsOrgId;
          _orgId = settingsOrgId;
          return API.switchOrg(settingsOrgId, { skipSession: true });
        }).then(function() {
          return refreshDashboard();
        }).then(function() {
          openOrgSettings(settingsOrgId);
        }).catch(function(err) {
          console.error('[decidr] Org switch failed:', err);
          showOrgAuthPrompt(settingsOrgId);
        });
      }

      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        menu.classList.toggle('open');
      });

      if (activeSettingsBtn) {
        activeSettingsBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          var settingsOrgId = activeSettingsBtn.getAttribute('data-org-id') || dashState.activeOrgId;
          if (!settingsOrgId) return;
          openOrgSettingsForOrg(settingsOrgId);
        });
      }

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
            if (dashState.summary) {
              dashState.summary.default_organization_id = starOrgId;
              API.putDashboardPreview(
                dashState.activeOrgId,
                dashState.summary,
                dashState.drilldowns
              );
            }
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
          openOrgSettingsForOrg(settingsOrgId);
          return;
        }
        var btn = e.target.closest('[data-org-id]');
        if (!btn) return;
        var orgId = btn.getAttribute('data-org-id');
        if (orgId === dashState.activeOrgId) {
          menu.classList.remove('open');
          return;
        }
        menu.classList.remove('open');
        container.innerHTML = UI.loadingSpinner('Switching organization...');
        flushNextStepsFilterSave().then(function() {
          API.purgeDashboardPreview(dashState.activeOrgId);
          dashState.activeOrgId = orgId;
          _orgId = orgId;
          return API.switchOrg(orgId, { skipSession: true });
        }).then(function() {
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

    function refreshNextStepsSection(focusSelector) {
      var section = container.querySelector('#decidr-next-steps-section');
      if (!section) return;
      section.outerHTML = '<div id="decidr-next-steps-section" style="margin-top: var(--space-8);">'
        + renderNextStepsSection() + '</div>';
      wireNextStepsFilters();
      wireNextStepsShowMore();
      wireCreateActions();
      wireEntityClicks(container);
      if (focusSelector) {
        var focusTarget = container.querySelector(focusSelector);
        if (focusTarget) focusTarget.focus();
      }
    }

    function refreshActionItemsFromServer(focusSelector) {
      if (dashState.legacyMode || dashState.readOnlyPreview) return Promise.resolve();
      if (dashState.actionItemsController) dashState.actionItemsController.abort();
      dashState.actionItemsController = new AbortController();

      var params = { take: 50 };
      var knownTypes = {};
      var knownStatuses = {};
      var sourceItems = dashState.actionItems || [];
      for (var i = 0; i < sourceItems.length; i++) {
        knownTypes[normalizeActionItemType(sourceItems[i])] = true;
        knownStatuses[normalizeActionItemStatus(sourceItems[i])] = true;
      }
      var visibleTypes = [];
      var hiddenTypeCount = 0;
      for (var type in knownTypes) {
        if (!knownTypes.hasOwnProperty(type)) continue;
        if (dashState.nextStepsHiddenTypes[type]) hiddenTypeCount++;
        else visibleTypes.push(type);
      }
      var visibleStatuses = [];
      var hiddenStatusCount = 0;
      for (var status in knownStatuses) {
        if (!knownStatuses.hasOwnProperty(status)) continue;
        if (dashState.nextStepsHiddenStatuses[status]) hiddenStatusCount++;
        else visibleStatuses.push(status);
      }
      if (hiddenTypeCount > 0) {
        if (visibleTypes.length === 0) {
          refreshNextStepsSection(focusSelector);
          return Promise.resolve();
        }
        params.types = visibleTypes.join(',');
      }
      if (hiddenStatusCount > 0) {
        if (visibleStatuses.length === 0) {
          refreshNextStepsSection(focusSelector);
          return Promise.resolve();
        }
        params.statuses = visibleStatuses.join(',');
      }
      if (dashState.nextStepsInitiativeMode === 'CUSTOM') {
        var selectedInitiatives = truthyMapKeys(dashState.nextStepsSelectedInitiatives);
        if (selectedInitiatives.length === 0 && !dashState.nextStepsIncludeUnassigned) {
          refreshNextStepsSection(focusSelector);
          return Promise.resolve();
        }
        if (selectedInitiatives.length > 0) {
          params.initiative_ids = selectedInitiatives.join(',');
        }
        params.include_unassigned = dashState.nextStepsIncludeUnassigned ? 'true' : 'false';
      }

      return API.getActionItems(params, {
        signal: dashState.actionItemsController.signal
      }).then(function(result) {
        dashState.actionItems = unwrapList(result);
        dashState.totals.needs_action = result.total_count || dashState.actionItems.length;
        if (dashState.summary && dashState.summary.next_steps) {
          dashState.summary.next_steps.data = dashState.actionItems;
          dashState.summary.next_steps.total_count = result.total_count || dashState.actionItems.length;
          dashState.summary.next_steps.has_more = !!result.has_more;
          dashState.summary.next_steps.next_cursor = result.next_cursor || null;
          API.putDashboardPreview(dashState.activeOrgId, dashState.summary, dashState.drilldowns);
        }
        refreshNextStepsSection(focusSelector);
      }).catch(function(err) {
        if (err && err.name === 'AbortError') return;
        if (err && (err.status === 401 || err.status === 403)) {
          API.purgeDashboardPreview(dashState.activeOrgId);
          renderDashboardLoadError(err);
          return;
        }
        dashState.nextStepsPreferenceWarning = 'Fresh filtered results could not be loaded.';
        syncNextStepsPreferenceWarning();
      });
    }

    function wireNextStepsFilters() {
      var initiativeTrigger = container.querySelector('#decidr-next-steps-initiative-trigger');
      var initiativeMenu = container.querySelector('#decidr-next-steps-initiative-menu');
      if (initiativeTrigger && initiativeMenu) {
        initiativeTrigger.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          dashState.nextStepsInitiativeFilterOpen = !dashState.nextStepsInitiativeFilterOpen;
          initiativeMenu.hidden = !dashState.nextStepsInitiativeFilterOpen;
          initiativeTrigger.setAttribute('aria-expanded', dashState.nextStepsInitiativeFilterOpen ? 'true' : 'false');
          if (dashState.nextStepsInitiativeFilterOpen) {
            var firstCheckbox = initiativeMenu.querySelector('input[type="checkbox"]');
            if (firstCheckbox) firstCheckbox.focus();
          } else {
            flushNextStepsFilterSave();
          }
        });
        initiativeMenu.addEventListener('click', function(e) {
          e.stopPropagation();
        });
        initiativeMenu.addEventListener('keydown', function(e) {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          dashState.nextStepsInitiativeFilterOpen = false;
          initiativeMenu.hidden = true;
          initiativeTrigger.setAttribute('aria-expanded', 'false');
          initiativeTrigger.focus();
          flushNextStepsFilterSave();
        });

        if (container._decidrNextStepsOutsideHandler) {
          document.removeEventListener('click', container._decidrNextStepsOutsideHandler);
        }
        container._decidrNextStepsOutsideHandler = function() {
          if (!dashState.nextStepsInitiativeFilterOpen) return;
          dashState.nextStepsInitiativeFilterOpen = false;
          initiativeMenu.hidden = true;
          initiativeTrigger.setAttribute('aria-expanded', 'false');
          flushNextStepsFilterSave();
        };
        document.addEventListener('click', container._decidrNextStepsOutsideHandler);
      }

      function initializeCustomInitiativeSelection() {
        if (dashState.nextStepsInitiativeMode === 'CUSTOM') return;
        dashState.nextStepsInitiativeMode = 'CUSTOM';
        dashState.nextStepsSelectedInitiatives = {};
        var initiatives = dashState.initiatives || [];
        for (var i = 0; i < initiatives.length; i++) {
          dashState.nextStepsSelectedInitiatives[initiatives[i].id] = true;
        }
        dashState.nextStepsIncludeUnassigned = true;
      }

      var selectAll = container.querySelector('[data-next-steps-initiative-select-all]');
      if (selectAll) {
        selectAll.indeterminate = selectAll.getAttribute('data-next-steps-indeterminate') === 'true';
        selectAll.addEventListener('change', function() {
          if (selectAll.checked) {
            dashState.nextStepsInitiativeMode = 'ALL';
            dashState.nextStepsSelectedInitiatives = {};
            dashState.nextStepsIncludeUnassigned = true;
          } else {
            dashState.nextStepsInitiativeMode = 'CUSTOM';
            dashState.nextStepsSelectedInitiatives = {};
            dashState.nextStepsIncludeUnassigned = false;
          }
          dashState.nextStepsInitiativeFilterOpen = true;
          queueNextStepsFilterSave();
          refreshNextStepsSection('[data-next-steps-initiative-select-all]');
          refreshActionItemsFromServer('[data-next-steps-initiative-select-all]');
        });
      }

      var initiativeCheckboxes = container.querySelectorAll('[data-next-steps-initiative-id]');
      for (var initiativeIndex = 0; initiativeIndex < initiativeCheckboxes.length; initiativeIndex++) {
        (function(checkbox) {
          checkbox.addEventListener('change', function() {
            initializeCustomInitiativeSelection();
            var initiativeId = checkbox.getAttribute('data-next-steps-initiative-id');
            if (checkbox.checked) {
              dashState.nextStepsSelectedInitiatives[initiativeId] = true;
            } else {
              delete dashState.nextStepsSelectedInitiatives[initiativeId];
            }
            dashState.nextStepsInitiativeFilterOpen = true;
            queueNextStepsFilterSave();
            refreshNextStepsSection('[data-next-steps-initiative-id="' + initiativeId + '"]');
            refreshActionItemsFromServer('[data-next-steps-initiative-id="' + initiativeId + '"]');
          });
        })(initiativeCheckboxes[initiativeIndex]);
      }

      var unassigned = container.querySelector('[data-next-steps-initiative-unassigned]');
      if (unassigned) {
        unassigned.addEventListener('change', function() {
          initializeCustomInitiativeSelection();
          dashState.nextStepsIncludeUnassigned = unassigned.checked;
          dashState.nextStepsInitiativeFilterOpen = true;
          queueNextStepsFilterSave();
          refreshNextStepsSection('[data-next-steps-initiative-unassigned]');
          refreshActionItemsFromServer('[data-next-steps-initiative-unassigned]');
        });
      }

      var pills = container.querySelectorAll('[data-next-steps-filter-kind][data-next-steps-filter-value]');
      for (var i = 0; i < pills.length; i++) {
        (function(pill) {
          if (pill._decidrWired) return;
          pill._decidrWired = true;
          pill.addEventListener('click', function() {
            var kind = pill.getAttribute('data-next-steps-filter-kind');
            var value = pill.getAttribute('data-next-steps-filter-value');
            var hidden = kind === 'type' ? dashState.nextStepsHiddenTypes : dashState.nextStepsHiddenStatuses;
            if (hidden[value]) {
              delete hidden[value];
            } else {
              hidden[value] = true;
            }
            queueNextStepsFilterSave();
            refreshNextStepsSection();
            refreshActionItemsFromServer();
          });
        })(pills[i]);
      }

      var reset = container.querySelector('#decidr-next-steps-filter-reset');
      if (reset && !reset._decidrWired) {
        reset._decidrWired = true;
        reset.addEventListener('click', function() {
          dashState.nextStepsHiddenTypes = {};
          dashState.nextStepsHiddenStatuses = {};
          dashState.nextStepsInitiativeMode = 'ALL';
          dashState.nextStepsSelectedInitiatives = {};
          dashState.nextStepsIncludeUnassigned = true;
          dashState.nextStepsInitiativeFilterOpen = false;
          clearNextStepsFilterPreference();
          refreshNextStepsSection();
          refreshActionItemsFromServer();
        });
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

    function initiativeProjectsId(initId) {
      return 'decidr-init-projects-' + String(initId || '').replace(/[^A-Za-z0-9_-]/g, '-');
    }

    function setInitiativeToggleState(header, projectsEl, expanded) {
      header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (projectsEl) {
        projectsEl.style.display = expanded ? '' : 'none';
      }
      var card = header.closest('[data-init-id]');
      if (card) {
        card.classList.toggle('decidr-init-card-collapsed', !expanded);
      }
    }

    function toggleInitiative(header) {
      var card = header.closest('[data-init-id]');
      if (!card) return;
      var initId = card.getAttribute('data-init-id');
      var projectsEl = container.querySelector('[data-init-projects="' + initId + '"]');
      var nextExpanded = !!dashState.collapsedInitiatives[initId];

      if (nextExpanded) {
        delete dashState.collapsedInitiatives[initId];
      } else {
        dashState.collapsedInitiatives[initId] = true;
      }
      setInitiativeToggleState(header, projectsEl, nextExpanded);
    }

    function wireInitiativeToggle() {
      var initHeaders = container.querySelectorAll('.decidr-init-header');
      for (var i = 0; i < initHeaders.length; i++) {
        (function(header) {
          var card = header.closest('[data-init-id]');
          var initId = card ? card.getAttribute('data-init-id') : '';
          var projectsEl = initId ? container.querySelector('[data-init-projects="' + initId + '"]') : null;
          var labelEl = header.querySelector('.decidr-init-name');
          var label = labelEl ? labelEl.textContent : 'initiative';

          header.style.cursor = 'pointer';
          header.setAttribute('role', 'button');
          header.setAttribute('tabindex', '0');
          header.setAttribute('aria-label', 'Toggle ' + label + ' projects');
          if (projectsEl) {
            if (!projectsEl.id) projectsEl.id = initiativeProjectsId(initId);
            header.setAttribute('aria-controls', projectsEl.id);
          }
          setInitiativeToggleState(header, projectsEl, !dashState.collapsedInitiatives[initId]);

          header.addEventListener('click', function(e) {
            if (e.target.closest && e.target.closest('[data-decidr-copy-ref]')) return;
            toggleInitiative(header);
          });
          header.addEventListener('keydown', function(e) {
            var key = e.key || e.code;
            if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
            e.preventDefault();
            toggleInitiative(header);
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
          UI.prepareInteractiveEntity(el);

          function openEntity(e) {
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
          }

          el.addEventListener('click', openEntity);
          el.addEventListener('keydown', function(e) {
            if (!UI.isActivationKey(e)) return;
            openEntity(e);
          });
        })(clickables[i]);
      }
    }

    }, _orgId, { preserveLoading: true, skipSession: true });
  };
})();

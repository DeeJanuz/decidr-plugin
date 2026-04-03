(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_dashboard = function(container, data, meta, toolArgs, reviewRequired, onDecision) {
    container.innerHTML = '';

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
      allTasks: [],
      allBridges: [],
      loaded: false,
      error: null,
      // New section state
      activeDecisionTab: 'action',
      nextStepsExpanded: false,
      decisionsExpanded: false,
      // Org picker
      organizations: [],
      activeOrgId: null
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

    Promise.all([
      API.listInitiatives({ take: 200 }).then(function(resp) { fetches.initiatives = unwrapList(resp); }),
      API.listProjects({ take: 200 }).then(function(resp) { fetches.projects = unwrapList(resp); }),
      API.listDecisions({ take: 200 }).then(function(resp) { fetches.decisions = unwrapList(resp); }),
      API.listTasks({ take: 200 }).then(function(resp) { fetches.tasks = unwrapList(resp); }),
      API.listBridges({ take: 200 }).then(function(resp) { fetches.bridges = unwrapList(resp); }),
      API.getActionItems({ take: 200 }).then(function(resp) { fetches.actionItems = unwrapList(resp); }),
      API.listOrganizations().then(function(orgs) { fetches.organizations = orgs; }).catch(function() { fetches.organizations = []; }),
      API.listPluginOrgs().then(function(orgIds) { fetches.pluginOrgs = orgIds; }).catch(function() { fetches.pluginOrgs = []; })
    ]).then(function() {
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
      // Merge token status into organizations
      var pluginOrgs = fetches.pluginOrgs || [];
      var pluginOrgSet = {};
      for (var po = 0; po < pluginOrgs.length; po++) {
        pluginOrgSet[pluginOrgs[po]] = true;
      }
      var orgs = fetches.organizations || [];
      for (var o = 0; o < orgs.length; o++) {
        orgs[o].tokenStatus = pluginOrgSet[orgs[o].id] ? 'valid' : 'no-token';
      }
      dashState.organizations = orgs;
      // Use data.organization_id from push data if available, or first org with token
      if (data && data.organization_id) {
        dashState.activeOrgId = data.organization_id;
      } else if (orgs.length > 0) {
        dashState.activeOrgId = orgs[0].id;
      }

      dashState.initiatives = fetches.initiatives;
      dashState.projectsByInitiative = projectMap;
      dashState.allDecisions = fetches.decisions;
      dashState.allTasks = fetches.tasks;
      dashState.allBridges = fetches.bridges;
      dashState.actionItems = fetches.actionItems;
      dashState.loaded = true;

      // Default all initiatives to collapsed
      for (var i = 0; i < dashState.initiatives.length; i++) {
        dashState.collapsedInitiatives[dashState.initiatives[i].id] = true;
      }

      renderDashboard();
    }).catch(function(err) {
      dashState.error = err;
      container.innerHTML = UI.emptyState('Failed to load dashboard data. Please try again.');
    });

    function refreshDashboard() {
      Promise.all([
        API.listInitiatives({ take: 200 }).then(function(resp) { return unwrapList(resp); }),
        API.listProjects({ take: 200 }).then(function(resp) { return unwrapList(resp); }),
        API.listDecisions({ take: 200 }).then(function(resp) { return unwrapList(resp); }),
        API.listTasks({ take: 200 }).then(function(resp) { return unwrapList(resp); }),
        API.listBridges({ take: 200 }).then(function(resp) { return unwrapList(resp); }),
        API.getActionItems({ take: 200 }).then(function(resp) { return unwrapList(resp); })
      ]).then(function(results) {
        var projects = results[1] || [];
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
        dashState.initiatives = results[0];
        dashState.projectsByInitiative = projectMap;
        dashState.allDecisions = results[2];
        dashState.allTasks = results[3];
        dashState.allBridges = results[4];
        dashState.actionItems = results[5];
        renderDashboard();
      }).catch(function(err) {
        console.error('[decidr] Dashboard refresh failed:', err);
      });
    }

    // ── Data Helpers ───────────────────────────────────────

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

    function getDecisionsForInitiative(initiativeId) {
      var projects = dashState.projectsByInitiative[initiativeId] || [];
      var projectIds = {};
      for (var i = 0; i < projects.length; i++) {
        projectIds[projects[i].id] = true;
      }
      var results = [];
      for (var j = 0; j < dashState.allDecisions.length; j++) {
        var dec = dashState.allDecisions[j];
        if (projectIds[dec.projectId] || (dec.entityType === 'project' && projectIds[dec.entityId])) {
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

    var ACTIONABLE_STATUSES = { PROPOSED: true, IN_PROGRESS: true };
    var TERMINAL_STATUSES = { IMPLEMENTED: true, REJECTED: true, ARCHIVED: true };

    function isActionableStatus(status) {
      return !!ACTIONABLE_STATUSES[status ? String(status).toUpperCase() : ''];
    }

    function normalizeStatus(dec) {
      return dec.status ? String(dec.status).toUpperCase() : '';
    }

    function sortByCreatedDesc(arr) {
      return arr.slice().sort(function(a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    }

    function getActiveDecisions(tab) {
      var results = [];
      for (var i = 0; i < dashState.allDecisions.length; i++) {
        var dec = dashState.allDecisions[i];
        var status = normalizeStatus(dec);
        if (tab === 'action') {
          if (isActionableStatus(status)) results.push(dec);
        } else if (tab === 'active') {
          if (!TERMINAL_STATUSES[status]) results.push(dec);
        } else if (tab === 'resolved') {
          if (status === 'APPROVED' || status === 'IMPLEMENTED') results.push(dec);
        }
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
        if (isActionableStatus(dec.status)) {
          results.push({ decision: dec, projectName: projectMap[dec.projectId] || '' });
        }
      }
      return results;
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
      'TODO task':                       { badge: 'Tasks',     cls: 'decidr-action-tasks' },
      'Deferred decision':              { badge: 'Deferred',  cls: 'decidr-action-deferred' }
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
      var items = dashState.actionItems;
      if (!items || items.length === 0) {
        return UI.emptyState('No action items right now. You are all caught up!');
      }

      var limit = dashState.nextStepsExpanded ? items.length : 5;
      var visible = items.slice(0, limit);
      var remaining = items.length - limit;

      var html = '';
      for (var i = 0; i < visible.length; i++) {
        var item = visible[i];
        var cfg = getActionConfig(item.reason);
        html += UI.nextStepCard(item, {
          animDelay: 0.05 + i * 0.05,
          actionBadge: cfg.badge,
          actionClass: cfg.cls
        });
      }

      if (remaining > 0 && !dashState.nextStepsExpanded) {
        html += '<button class="decidr-dash-show-more" id="decidr-next-steps-show-more">'
          + 'Show ' + remaining + ' more</button>';
      } else if (dashState.nextStepsExpanded && items.length > 5) {
        html += '<button class="decidr-dash-show-more" id="decidr-next-steps-show-less">'
          + 'Show less</button>';
      }

      return html;
    }

    function renderNextStepsSection() {
      return UI.section('calendar', 'Next Steps', dashState.actionItems.length,
        '<div id="decidr-next-steps-container">' + renderNextStepsContent() + '</div>');
    }

    function renderActiveDecisionsContent() {
      var tab = dashState.activeDecisionTab;
      var decisions = getActiveDecisions(tab);

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
          allDecisions: dashState.allDecisions
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
      var actionCount = getActiveDecisions('action').length;
      var activeCount = getActiveDecisions('active').length;
      var resolvedCount = getActiveDecisions('resolved').length;
      var tab = dashState.activeDecisionTab;

      var tabBar = '<div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-4);">'
        + '<button class="decidr-dash-tab' + (tab === 'action' ? ' active' : '') + '" data-decision-tab="action">Needs Action (' + actionCount + ')</button>'
        + '<button class="decidr-dash-tab' + (tab === 'active' ? ' active' : '') + '" data-decision-tab="active">All Active (' + activeCount + ')</button>'
        + '<button class="decidr-dash-tab' + (tab === 'resolved' ? ' active' : '') + '" data-decision-tab="resolved">Recently Resolved (' + resolvedCount + ')</button>'
        + '</div>';

      return UI.section('decision', 'Active Decisions', null,
        tabBar + '<div id="decidr-active-decisions-container">' + renderActiveDecisionsContent() + '</div>');
    }

    function renderInitiativeSections() {
      var initiatives = dashState.initiatives;
      if (initiatives.length === 0) {
        return UI.section('Initiatives', null, UI.emptyState('No initiatives found.'));
      }

      // Section header
      var html = '<div class="decidr-section-header">'
        + UI.escapeHtml('Initiatives')
        + ' <span class="decidr-section-count">(' + initiatives.length + ')</span>'
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
          // Count pending decisions and ones needing user's review
          var pendingCount = 0;
          var needsReviewCount = 0;
          for (var pd = 0; pd < projDecisions.length; pd++) {
            var pDec = projDecisions[pd];
            if (isActionableStatus(pDec.status)) {
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
          cards += UI.dashboardProjectCard(proj, {
            decisions: projDecisions,
            tasks: projTasks,
            isOwner: isOwner,
            pendingDecisions: pendingCount,
            needsYourReview: needsReviewCount,
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
          allDecisions: dashState.allDecisions
        });
      }

      return UI.section('decision', 'Recent Decisions', recent.length, html);
    }

    function renderPendingApprovalsSection() {
      var pending = getPendingDecisions();
      if (pending.length === 0) return '';

      var html = '';
      for (var i = 0; i < pending.length; i++) {
        html += UI.pendingItem(pending[i].decision, {
          animDelay: 0.05 + i * 0.05,
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
        + UI.orgPicker(dashState.organizations, dashState.activeOrgId)
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

      container.innerHTML = html;
      wireInteractions();
    }

    // ── Event Wiring ───────────────────────────────────────

    function wireInteractions() {
      wireNextStepsShowMore();
      wireDecisionTabs();
      wireDecisionsShowMore();
      wireInitiativeToggle();
      wireEntityClicks(container);
      wireOrgPicker();
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
          container.innerHTML = '<div style="padding: var(--space-6); text-align: center;">'
            + '<p style="color: var(--text-secondary); margin-bottom: var(--space-4);">'
            + 'No authentication for this organization.</p>'
            + '<button id="decidr-org-auth-btn" style="padding: 8px 16px; border: 1px solid var(--accent-primary);'
            + ' border-radius: var(--border-radius-md); background: var(--accent-primary); color: white;'
            + ' cursor: pointer; font-family: var(--font-sans);">Authenticate</button>'
            + '</div>';
          var authBtn = container.querySelector('#decidr-org-auth-btn');
          if (authBtn) {
            authBtn.addEventListener('click', function() {
              if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
                window.__TAURI__.core.invoke('start_plugin_auth', { pluginName: 'decidr', orgId: orgId });
              }
            });
          }
        });
      });
    }

    function wireNextStepsShowMore() {
      var moreBtn = container.querySelector('#decidr-next-steps-show-more');
      var lessBtn = container.querySelector('#decidr-next-steps-show-less');

      if (moreBtn) {
        moreBtn.addEventListener('click', function() {
          dashState.nextStepsExpanded = true;
          var cont = container.querySelector('#decidr-next-steps-container');
          if (cont) {
            cont.innerHTML = renderNextStepsContent();
            wireNextStepsShowMore();
            wireEntityClicks(cont);
          }
        });
      }

      if (lessBtn) {
        lessBtn.addEventListener('click', function() {
          dashState.nextStepsExpanded = false;
          var cont = container.querySelector('#decidr-next-steps-container');
          if (cont) {
            cont.innerHTML = renderNextStepsContent();
            wireNextStepsShowMore();
            wireEntityClicks(cont);
          }
        });
      }
    }

    function wireDecisionTabs() {
      var tabs = container.querySelectorAll('.decidr-dash-tab[data-decision-tab]');
      for (var i = 0; i < tabs.length; i++) {
        (function(tab) {
          tab.addEventListener('click', function() {
            var newTab = tab.getAttribute('data-decision-tab');
            if (newTab === dashState.activeDecisionTab) return;
            dashState.activeDecisionTab = newTab;
            dashState.decisionsExpanded = false;
            // Update tab active states
            var allTabs = container.querySelectorAll('.decidr-dash-tab[data-decision-tab]');
            for (var t = 0; t < allTabs.length; t++) {
              allTabs[t].classList.remove('active');
              if (allTabs[t].getAttribute('data-decision-tab') === newTab) {
                allTabs[t].classList.add('active');
              }
            }
            // Re-render decisions content
            var cont = container.querySelector('#decidr-active-decisions-container');
            if (cont) {
              cont.innerHTML = renderActiveDecisionsContent();
              wireDecisionsShowMore();
              wireEntityClicks(cont);
            }
          });
        })(tabs[i]);
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
      var clickables = scope.querySelectorAll('[data-entity-type][data-entity-id]');
      for (var i = 0; i < clickables.length; i++) {
        (function(el) {
          // Skip if already wired
          if (el._decidrWired) return;
          el._decidrWired = true;

          // Skip init headers — they toggle collapse, not slide-out
          if (el.querySelector('.decidr-init-header')) return;

          el.addEventListener('click', function(e) {
            // Don't fire if clicking inside init-header (toggle)
            if (e.target.closest('.decidr-init-header')) return;
            e.preventDefault();
            e.stopPropagation();
            var entityType = el.getAttribute('data-entity-type');
            var entityId = el.getAttribute('data-entity-id');
            if (entityType && entityId) {
              UI.SlideOut.open(entityType, entityId, {
                onClose: function() {},
                onMutate: function() { refreshDashboard(); }
              });
            }
          });
        })(clickables[i]);
      }
    }

    });
  };
})();

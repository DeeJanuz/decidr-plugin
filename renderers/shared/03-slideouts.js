/**
 * DecidR MCP Views — Slideout Renderers
 *
 * Entity-specific slide-out detail panel renderers.
 * Pure HTML-returning functions — no DOM queries, no event wiring.
 * Split from 02-components.js for maintainability.
 */
(function() {
  'use strict';

  var UI = window.__decidrUI;

  // Alias private vars exposed by 02-components.js
  var ENTITY_ICONS = UI._ENTITY_ICONS;
  var ICON_TRASH = UI._ICON_TRASH;
  var ICON_EDIT = UI._ICON_EDIT;
  var ICON_CHEVRON_DOWN = UI._ICON_CHEVRON_DOWN;
  var ICON_CALENDAR = UI._ICON_CALENDAR;
  var STATUS_LABELS = UI._STATUS_LABELS;
  var statusLabel = UI._statusLabel;

  // ═══════════════════════════════════════════════════════════════════
  // ENTITY-SPECIFIC SLIDE-OUT RENDERERS
  // Pure HTML-returning functions — no DOM queries, no event wiring.
  // Registered on UI so renderers can call them directly.
  // ═══════════════════════════════════════════════════════════════════

  UI.githubSection = function(summary) {
    if (!summary) return '';
    var html = '';
    if (summary.issues && summary.issues.length) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Issues', summary.issues.length);
      html += UI.githubIssuesList(summary.issues);
      html += '</div>';
    }
    if (summary.prs && summary.prs.length) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Pull Requests', summary.prs.length);
      html += UI.githubPRsList(summary.prs);
      html += '</div>';
    }
    return html;
  };

  /**
   * Render issue slide-out detail panel.
   * @param {Object} issue - Issue data with _enriched sub-objects
   * @returns {string} HTML string
   */
  UI.slideOutIssue = function(issue) {
    var html = '<div class="decidr-so-detail">';

    // Title row: icon + title + state badge
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-2);">';
    html += '<span class="decidr-entity-icon">' + (ENTITY_ICONS.issue || '') + '</span>';
    html += '<h2 style="margin:0;font-size:var(--text-h2);">' + UI.escapeHtml(issue.githubIssueTitle || '') + '</h2>';
    if (issue.githubState) html += UI.statusBadge(issue.githubState);
    html += '</div>';

    // Meta row
    var metaItems = [];
    if (issue.githubIssueNumber) metaItems.push({ html: '<strong>#' + issue.githubIssueNumber + '</strong>' });
    if (issue.source) metaItems.push({ html: '<strong>Source:</strong> ' + UI.escapeHtml(issue.source) });
    if (issue.githubAuthorUsername) metaItems.push({ html: '<strong>Author:</strong> ' + UI.escapeHtml(issue.githubAuthorUsername) });
    if (issue.githubCreatedAt) metaItems.push({ html: '<strong>Created:</strong> ' + UI.formatDate(issue.githubCreatedAt) });
    if (issue.githubUpdatedAt) metaItems.push({ html: '<strong>Updated:</strong> ' + UI.formatDate(issue.githubUpdatedAt) });
    if (issue.githubIssueUrl) metaItems.push({ html: '<a href="' + UI.escapeHtml(issue.githubIssueUrl) + '" target="_blank" style="color:var(--accent-primary);text-decoration:none;">View on GitHub</a>' });
    if (metaItems.length > 0) html += UI.SlideOut._renderMeta(metaItems);

    // Description (githubBody)
    if (issue.githubBody) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Description', 0);
      html += '<div class="decidr-so-description" style="white-space:pre-wrap;word-break:break-word;">' + UI.escapeHtml(issue.githubBody).replace(/\n/g, '<br>') + '</div>';
      html += '</div>';
    }

    // Labels
    var labels = issue.githubLabels;
    if (labels && labels.length > 0) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Labels', labels.length);
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      for (var li = 0; li < labels.length; li++) {
        html += UI.labelBadge(labels[li]);
      }
      html += '</div>';
      html += '</div>';
    }

    // Linked Entities — shared entity list with per-row type badge
    if (issue.entityLinks && issue.entityLinks.length > 0) {
      var issueLinkItems = [];
      for (var i = 0; i < issue.entityLinks.length; i++) {
        var link = issue.entityLinks[i];
        issueLinkItems.push({
          id: link.entityId,
          title: link.entityName || link.entityId,
          entityType: link.entityType,
          status: link.status
        });
      }
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Linked Entities', issueLinkItems.length);
      html += UI.SlideOut._renderEntityList(issueLinkItems, null, { showTypeBadge: true });
      html += '</div>';
    }

    // Linked PRs (from enrichment)
    var issueEnriched = issue._enriched || {};
    var linkedPRs = issueEnriched.linkedPRs;
    if (linkedPRs) {
      var prList = (linkedPRs && linkedPRs.data) ? linkedPRs.data : (Array.isArray(linkedPRs) ? linkedPRs : []);
      if (prList.length > 0) {
        html += '<div class="decidr-so-section">';
        html += UI.SlideOut._renderSectionHeader('Linked Pull Requests', prList.length);
        html += UI.githubPRsList(prList);
        html += '</div>';
      }
    } else if (!issue._enrichmentDone) {
      html += '<div class="decidr-so-section"><div class="decidr-so-section-header">Linked PRs</div><div class="decidr-so-section-empty">Loading...</div></div>';
    }

    html += '</div>';
    return html;
  };

  /**
   * Render pull request slide-out detail panel.
   * @param {Object} pr - Pull request data
   * @returns {string} HTML string
   */
  UI.slideOutPR = function(pr) {
    var html = '<div class="decidr-so-detail">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-2);">';
    html += '<span class="decidr-entity-icon">' + (ENTITY_ICONS.pull_request || '') + '</span>';
    html += '<h2 style="margin:0;font-size:var(--text-h2);">PR #' + (pr.githubPrNumber || '') + '</h2>';
    html += UI.statusBadge(pr.status || pr.githubState || 'OPEN');
    html += '</div>';
    var metaItems = [];
    if (pr.branchName) metaItems.push({ html: '<strong>Branch:</strong> ' + UI.escapeHtml(pr.branchName) });
    if (pr.source) metaItems.push({ html: '<strong>Source:</strong> ' + UI.escapeHtml(pr.source) });
    if (pr.createdBy && pr.createdBy.name) metaItems.push({ html: '<strong>Created by:</strong> ' + UI.escapeHtml(pr.createdBy.name) });
    else if (pr.githubAuthorUsername) metaItems.push({ html: '<strong>Author:</strong> ' + UI.escapeHtml(pr.githubAuthorUsername) });
    if (pr.reviewer && pr.reviewer.name) metaItems.push({ html: '<strong>Reviewer:</strong> ' + UI.escapeHtml(pr.reviewer.name) });
    if (pr.githubPrUrl) metaItems.push({ html: '<a href="' + UI.escapeHtml(pr.githubPrUrl) + '" target="_blank" style="color:var(--accent-primary);text-decoration:none;">View on GitHub</a>' });
    if (pr.reviewPromptGenerated) metaItems.push({ html: '<strong>Review Prompt:</strong> Generated' });
    if (metaItems.length > 0) html += UI.SlideOut._renderMeta(metaItems);

    // Linked issue
    if (pr.issueRef) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Linked Issue', 1);
      html += '<div class="decidr-so-doc-item" data-entity-type="issue" data-entity-id="' + UI.escapeHtml(pr.issueRef.id) + '">';
      html += '<span class="decidr-so-doc-link" style="pointer-events:none;">';
      html += '<span style="color:var(--text-tertiary);font-weight:var(--weight-medium);margin-right:4px;">#' + (pr.issueRef.githubIssueNumber || '') + '</span>';
      html += UI.escapeHtml(pr.issueRef.githubIssueTitle || 'Untitled');
      html += '</span>';
      if (pr.issueRef.source) html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(pr.issueRef.source) + '</span>';
      html += '</div>';
      html += '</div>';

      // Linked DecidR entities (from the issue's entity links) — shared helper
      var entityLinks = pr.issueRef.entityLinks || [];
      if (entityLinks.length > 0) {
        var prLinkItems = [];
        for (var eli = 0; eli < entityLinks.length; eli++) {
          var elink = entityLinks[eli];
          prLinkItems.push({
            id: elink.entityId,
            title: elink.entityName || elink.entityId,
            entityType: elink.entityType,
            status: elink.status
          });
        }
        html += '<div class="decidr-so-section">';
        html += UI.SlideOut._renderSectionHeader('Linked Entities', prLinkItems.length);
        html += UI.SlideOut._renderEntityList(prLinkItems, null, { showTypeBadge: true });
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  };

  /**
   * Render repository slide-out detail panel.
   * @param {Object} repo - Repository data
   * @returns {string} HTML string
   */
  UI.slideOutRepo = function(repo) {
    var html = '<div class="decidr-so-detail">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-2);">';
    html += '<span class="decidr-entity-icon">' + (ENTITY_ICONS.repo || '') + '</span>';
    html += '<h2 style="margin:0;font-size:var(--text-h2);">' + UI.escapeHtml(repo.githubOwner + '/' + repo.githubRepo) + '</h2>';
    html += '</div>';
    var metaItems = [];
    if (repo.defaultBranch) metaItems.push({ html: '<strong>Default:</strong> ' + UI.escapeHtml(repo.defaultBranch) });
    if (repo.stagingBranch) metaItems.push({ html: '<strong>Staging:</strong> ' + UI.escapeHtml(repo.stagingBranch) });
    if (metaItems.length > 0) html += UI.SlideOut._renderMeta(metaItems);
    html += '</div>';
    return html;
  };

  UI.slideOutOrganizationSettings = function(payload) {
    var organization = payload.organization || {};
    var permissions = payload.permissions || {};
    var members = payload.members || [];
    var invitations = payload.invitations || [];
    var currentUserRole = permissions.currentUserRole || 'MEMBER';
    var inviteRoleOptions = currentUserRole === 'OWNER'
      ? ['OWNER', 'ADMIN', 'MEMBER']
      : ['ADMIN', 'MEMBER'];
    var html = '<div class="decidr-so-detail decidr-so-org-settings">';

    var metaItems = [
      { html: '<strong>' + members.length + '</strong> members' },
      { html: '<strong>' + invitations.length + '</strong> pending invites' },
      { html: '<strong>Your role:</strong> ' + UI.escapeHtml(currentUserRole) }
    ];
    if (organization.slug) {
      metaItems.push({ html: '<strong>Slug:</strong> ' + UI.escapeHtml(organization.slug) });
    }
    html += UI.SlideOut._renderMeta(metaItems);

    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Invite Member');
    if (permissions.canInviteMembers) {
      html += '<div class="decidr-so-org-invite-form">';
      html += '<input class="decidr-so-org-input" type="email" id="decidr-so-input-org-invite-email" placeholder="name@company.com">';
      html += '<select class="decidr-so-org-select" id="decidr-so-input-org-invite-role">';
      for (var ir = 0; ir < inviteRoleOptions.length; ir++) {
        var inviteRole = inviteRoleOptions[ir];
        html += '<option value="' + inviteRole + '"' + (inviteRole === 'MEMBER' ? ' selected' : '') + '>'
          + UI.escapeHtml(inviteRole) + '</option>';
      }
      html += '</select>';
      html += '<button class="decidr-so-btn decidr-so-btn-primary" id="decidr-so-btn-send-org-invite">Send Invite</button>';
      html += '</div>';
      html += '<div class="decidr-so-muted-note">Invites route through shared Ludflow auth, then guide people into DecidR setup.</div>';
    } else {
      html += '<div class="decidr-so-empty-hint">Only organization admins can send invitations.</div>';
    }
    html += '</div>';

    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Members', members.length);
    if (!members.length) {
      html += '<div class="decidr-so-empty-hint">No members found.</div>';
    } else {
      for (var m = 0; m < members.length; m++) {
        var member = members[m];
        var canEditRole = permissions.canChangeRoles && (currentUserRole === 'OWNER' || member.role !== 'OWNER');
        var canRemoveMember = permissions.canRemoveMembers && (currentUserRole === 'OWNER' || member.role !== 'OWNER');
        var memberRoleOptions = currentUserRole === 'OWNER'
          ? ['OWNER', 'ADMIN', 'MEMBER']
          : ['ADMIN', 'MEMBER'];
        if (memberRoleOptions.indexOf(member.role) === -1) {
          memberRoleOptions.unshift(member.role);
        }

        html += '<div class="decidr-so-org-row">';
        html += '<div class="decidr-so-org-person">';
        html += UI.avatar(member, 'sm');
        html += '<div class="decidr-so-org-person-copy">';
        html += '<div class="decidr-so-org-person-name">' + UI.escapeHtml(member.name || member.email || 'Unknown Member') + '</div>';
        html += '<div class="decidr-so-org-person-meta">' + UI.escapeHtml(member.email || '') + '</div>';
        html += '</div>';
        html += '</div>';
        html += '<div class="decidr-so-org-actions">';
        html += '<select class="decidr-so-org-select" data-member-role-user-id="' + UI.escapeHtml(member.userId || member.id) + '" data-current-role="' + UI.escapeHtml(member.role) + '"' + (canEditRole ? '' : ' disabled') + '>';
        for (var mr = 0; mr < memberRoleOptions.length; mr++) {
          var memberRole = memberRoleOptions[mr];
          html += '<option value="' + memberRole + '"' + (memberRole === member.role ? ' selected' : '') + '>'
            + UI.escapeHtml(memberRole) + '</option>';
        }
        html += '</select>';
        html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" data-remove-member-user-id="' + UI.escapeHtml(member.userId || member.id) + '"' + (canRemoveMember ? '' : ' disabled') + '>Remove</button>';
        html += '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Pending Invites', invitations.length);
    if (!invitations.length) {
      html += '<div class="decidr-so-empty-hint">No pending invitations.</div>';
    } else {
      for (var i = 0; i < invitations.length; i++) {
        var invitation = invitations[i];
        var canCancelInvite = permissions.canInviteMembers && (currentUserRole === 'OWNER' || invitation.role !== 'OWNER');
        html += '<div class="decidr-so-org-row">';
        html += '<div class="decidr-so-org-person">';
        html += '<div class="decidr-so-org-person-copy">';
        html += '<div class="decidr-so-org-person-name">' + UI.escapeHtml(invitation.email) + '</div>';
        html += '<div class="decidr-so-org-person-meta">Role ' + UI.escapeHtml(invitation.role)
          + ' · ' + UI.escapeHtml(invitation.targetProduct || 'DECIDR')
          + ' · Expires ' + UI.escapeHtml(UI.formatDate(invitation.expiresAt))
          + '</div>';
        html += '</div>';
        html += '</div>';
        html += '<div class="decidr-so-org-actions">';
        html += '<span class="decidr-so-org-inline-note">Invited by ' + UI.escapeHtml(invitation.invitedByName || 'Unknown') + '</span>';
        html += '<button class="decidr-so-btn decidr-so-btn-sm" data-cancel-invitation-id="' + UI.escapeHtml(invitation.id) + '"' + (canCancelInvite ? '' : ' disabled') + '>Cancel</button>';
        html += '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    html += '</div>';
    return html;
  };

  /**
   * Render project slide-out detail panel.
   * @param {Object} project - Project data with _enriched sub-objects
   * @returns {string} HTML string
   */
  UI.slideOutProject = function(project) {
    var state = UI.SlideOut._projectPanelState;
    var enriched = project._enriched || {};
    var html = '<div class="decidr-so-detail">';

    // Action bar
    html += '<div class="decidr-so-action-bar">';
    html += '<span class="decidr-so-spacer"></span>';
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-project-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    // Title row
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-2);">';
    html += '<div class="decidr-so-color-dot" style="background:' + UI.sanitizeColor(project.color || '#6366f1') + ';"></div>';
    html += '<h3 class="decidr-so-detail-title" style="margin:0;">' + UI.escapeHtml(project.name) + '</h3>';
    html += UI.statusBadge(project.status);
    html += '</div>';

    // Parent initiative link
    if (project.initiativeId && enriched.initiative) {
      html += UI.SlideOut._renderParentLink(ENTITY_ICONS.initiative, 'Initiative', 'initiative', enriched.initiative);
    }

    // Meta
    var metaItems = [];
    if (project.createdBy && project.createdBy.name) {
      metaItems.push({ html: UI.escapeHtml(project.createdBy.name) });
    }
    if (project.createdAt) {
      metaItems.push({ html: UI.formatDate(project.createdAt) });
    }
    if (metaItems.length > 0) html += UI.SlideOut._renderMeta(metaItems);

    // Description
    if (project.description) {
      html += '<p class="decidr-so-description">' + UI.escapeHtml(project.description) + '</p>';
    }

    // Task Progress
    var tasks = (enriched.tasks && enriched.tasks.data) || enriched.tasks || [];
    if (Array.isArray(tasks) && tasks.length > 0) {
      var tasksDone = 0;
      for (var i = 0; i < tasks.length; i++) {
        var ts = (tasks[i].status || '').toUpperCase();
        if (ts === 'DONE' || ts === 'COMPLETED') tasksDone++;
      }
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Task Progress', tasks.length);
      html += UI.SlideOut._renderProgressBar(tasksDone, tasks.length);
      html += '</div>';
    } else if (!enriched.tasks) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading tasks...</div>';
    }

    // Tasks list (individual items with checkboxes)
    if (Array.isArray(tasks) && tasks.length > 0) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Tasks', tasks.length);
      for (var ti = 0; ti < tasks.length; ti++) {
        var task = tasks[ti];
        var isDone = (task.status || '').toUpperCase() === 'DONE' || (task.status || '').toUpperCase() === 'COMPLETED';
        var doneClass = isDone ? ' decidr-so-task-done' : '';
        html += '<div class="decidr-so-task-item' + doneClass + '" data-entity-type="task" data-entity-id="' + UI.escapeHtml(task.id) + '">';
        html += '<button class="decidr-so-task-checkbox' + (isDone ? ' checked' : '') + '" data-task-id="' + UI.escapeHtml(task.id) + '" data-task-done="' + (isDone ? '1' : '0') + '">';
        html += isDone ? '\u2713' : '';
        html += '</button>';
        html += '<span class="decidr-so-task-title">' + UI.escapeHtml(task.title) + '</span>';
        html += UI.statusBadge(task.status);
        html += '</div>';
      }
      html += '</div>';
    }

    // Quick actions: Add Task
    html += '<div class="decidr-so-quick-actions">';
    html += '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-add-project-task">+ Add Task</button>';
    html += '</div>';

    // Add Task inline form
    html += '<div class="decidr-so-inline-form' + (state.addTaskFormOpen ? ' visible' : '') + '" id="decidr-so-form-add-project-task">';
    html += '<input type="text" id="decidr-so-input-project-task-title" placeholder="Task title...">';
    html += '<div class="decidr-so-form-actions">'
      + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-cancel-project-task">Cancel</button>'
      + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-save-project-task">Save</button>'
      + '</div></div>';

    // Decisions (with supersession grouping built from flat list)
    var decisions = (enriched.decisions && enriched.decisions.data) || enriched.decisions || [];
    if (Array.isArray(decisions)) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Decisions', decisions.length);
      if (decisions.length === 0) {
        html += '<div class="decidr-so-empty-hint">No decisions</div>';
      } else {
        // Build supersession tree from flat list using supersededById
        var decById = {};
        var supersededIds = {};
        var childrenOf = {};
        for (var si = 0; si < decisions.length; si++) {
          decById[decisions[si].id] = decisions[si];
          if (decisions[si].supersededById) {
            supersededIds[decisions[si].id] = true;
            if (!childrenOf[decisions[si].supersededById]) childrenOf[decisions[si].supersededById] = [];
            childrenOf[decisions[si].supersededById].push(decisions[si]);
          }
        }
        for (var di = 0; di < decisions.length; di++) {
          var dec = decisions[di];
          if (supersededIds[dec.id]) continue;
          var supersededChildren = childrenOf[dec.id] || [];
          html += '<div class="decidr-so-decision-item" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(dec.id) + '">';
          html += UI.statusBadge(dec.status);
          html += '<span class="decidr-so-decision-title">' + UI.escapeHtml(dec.title) + '</span>';
          if (supersededChildren.length > 0) {
            html += '<span class="decidr-so-supersedes-badge">Supersedes</span>';
          }
          html += '<span class="decidr-so-decision-chevron">\u203a</span>';
          html += '</div>';
          // Render superseded children
          for (var sc = 0; sc < supersededChildren.length; sc++) {
            var oldDec = supersededChildren[sc];
            html += '<div class="decidr-so-decision-item decidr-so-decision-superseded" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(oldDec.id) + '">';
            html += '<span class="decidr-so-decision-superseded-indicator">\u21b3</span>';
            html += '<span class="decidr-so-decision-superseded-label">Superseded</span>';
            var wasStatus = oldDec.status ? ' <span class="decidr-so-decision-was-status">was ' + UI.escapeHtml(statusLabel(oldDec.status)) + '</span>' : '';
            html += wasStatus;
            html += '<span class="decidr-so-decision-title">' + UI.escapeHtml(oldDec.title) + '</span>';
            html += '</div>';
          }
        }
      }
      html += '</div>';
    } else if (!enriched.decisions) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading decisions...</div>';
    }

    // Bridges
    var bridges = (enriched.bridges && enriched.bridges.data) || enriched.bridges || [];
    if (Array.isArray(bridges)) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Bridges', bridges.length);
      if (bridges.length === 0) {
        html += '<div class="decidr-so-empty-hint">No bridges</div>';
      } else {
        for (var b = 0; b < bridges.length; b++) {
          var br = bridges[b];
          var linkedName = '';
          if (br.fromProject && br.fromProject.id !== project.id) {
            linkedName = br.fromProject.name || '';
          } else if (br.toProject) {
            linkedName = br.toProject.name || '';
          }
          html += '<div class="decidr-so-bridge-item">';
          html += '<div class="decidr-so-bridge-header" data-bridge-toggle="' + b + '">';
          html += '<span class="decidr-so-bridge-name">'
            + UI.escapeHtml(project.name) + ' \u2192 ' + UI.escapeHtml(linkedName || br.name)
            + '</span>';
          html += UI.statusBadge(br.status);
          html += '</div>';
          html += '<div class="decidr-so-bridge-expand" id="decidr-so-bridge-expand-' + b + '">';
          html += '<div class="decidr-so-bridge-expand-inner">';
          if (br.description) {
            html += '<p style="margin:0 0 6px 0;">' + UI.escapeHtml(br.description) + '</p>';
          }
          html += '<a class="decidr-so-nav-link" data-entity-type="bridge" data-entity-id="' + UI.escapeHtml(br.id) + '">View Bridge</a>';
          html += '</div></div>';
          html += '</div>';
        }
      }
      html += '</div>';
    } else if (!enriched.bridges) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading bridges...</div>';
    }

    // Owner
    var owner = project.owner || project.createdBy;
    if (owner && owner.name) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Owner');
      html += UI.userChip(owner);
      html += '</div>';
    }

    // Tags
    var projTags = project.tags || [];
    if (projTags.length > 0) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Tags');
      html += '<div class="decidr-so-tags">';
      for (var pt = 0; pt < projTags.length; pt++) {
        var ptag = projTags[pt].tag || projTags[pt];
        html += '<span class="decidr-badge" style="background:var(--bg-surface);color:var(--text-secondary);">'
          + UI.escapeHtml(ptag.name || ptag) + '</span>';
      }
      html += '</div></div>';
    }

    // Documents section (shared helper)
    html += UI.SlideOut._renderDocumentSection('PROJECT', project.id, project.documents || [], state);

    // GitHub Issues & PRs
    var ghSummary = enriched.githubSummary;
    if (ghSummary) {
      html += UI.githubSection(ghSummary);
    } else if (!project._enrichmentDone) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading issues & PRs...</div>';
    }

    // Timeline
    html += UI.SlideOut._renderTimeline(enriched.timeline, state.timelineFilter, { filterPrefix: 'project-timeline', parentType: 'project', parentId: project.id });
    if (enriched.timeline) {
      html += '<div style="text-align:center;margin:var(--space-2) 0;">'
        + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-view-all-project-timeline">View All Activity</button>'
        + '</div>';
    }

    // Comment form
    html += '<div class="decidr-so-comment-form">';
    html += '<textarea id="decidr-so-input-project-comment" placeholder="Add a comment to this project..." rows="3"></textarea>';
    html += '<div class="decidr-so-form-actions">'
      + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-post-project-comment">Post</button>'
      + '</div></div>';

    html += '</div>';
    return html;
  };

  /**
   * Render decision slide-out detail panel.
   * @param {Object} decision - Decision data with _enriched sub-objects
   * @returns {string} HTML string
   */
  UI.slideOutDecision = function(decision) {
    var state = UI.SlideOut._decisionPanelState;
    var enriched = decision._enriched || {};
    var html = '<div class="decidr-so-detail">';

    // Meta row
    var metaItems = [{ html: UI.statusBadge(decision.status) }];
    // Priority from tags
    var tags = decision.tags || [];
    for (var ti = 0; ti < tags.length; ti++) {
      var tag = tags[ti].tag || tags[ti];
      var tagName = (tag.name || '').toLowerCase();
      if (tagName === 'high' || tagName === 'medium' || tagName === 'low') {
        metaItems.push({ html: UI.priorityBadge(tagName) });
      }
    }
    if (decision.createdBy && decision.createdBy.name) {
      metaItems.push({ html: UI.userChip(decision.createdBy) });
    }
    if (decision.createdAt) {
      metaItems.push({ html: ICON_CALENDAR + ' ' + UI.formatDate(decision.createdAt) });
    }
    html += UI.SlideOut._renderMeta(metaItems);

    // Action bar
    var transitions = decision.allowedTransitions || [];

    html += '<div class="decidr-so-action-bar">';
    html += '<button class="decidr-so-btn" id="decidr-so-btn-edit">'
      + ICON_EDIT + ' ' + (state.editMode ? 'Cancel Edit' : 'Edit') + '</button>';
    if (transitions.length > 0) {
      html += '<div class="decidr-so-status-dropdown">';
      html += '<button class="decidr-so-btn" id="decidr-so-btn-status">Status ' + ICON_CHEVRON_DOWN + '</button>';
      html += '<div class="decidr-so-status-menu" id="decidr-so-status-menu">';
      for (var si = 0; si < transitions.length; si++) {
        html += '<button class="decidr-so-status-option" data-decision-transition="' + transitions[si] + '">'
          + UI.escapeHtml(STATUS_LABELS[transitions[si]] || transitions[si]) + '</button>';
      }
      html += '</div></div>';
    }
    if (decision.status === 'APPROVED' || decision.status === 'IMPLEMENTED') {
      html += '<button class="decidr-so-btn" id="decidr-so-btn-supersede">Supersede</button>';
    }
    html += '<span class="decidr-so-spacer"></span>';
    html += '<button class="decidr-so-btn decidr-so-btn-danger" id="decidr-so-btn-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    // Reviewers & Approval Progress
    var reviewers = decision.reviewers || decision.approvals || [];
    var approvalProgress = decision.approvalProgress || null;

    html += '<div class="decidr-so-reviewers-card">';
    html += '<div class="decidr-so-reviewers-label">REVIEWERS</div>';

    // Reviewer chips with approve/reject states
    html += '<div class="decidr-so-reviewers">';
    for (var ri = 0; ri < reviewers.length; ri++) {
      var appr = reviewers[ri];
      var approverUser = { name: appr.userName || appr.userId || 'Unknown', image: appr.image, avatarColor: appr.avatarColor };
      var chipStatus = appr.status || (appr.approved ? 'approved' : '');
      var chipClass = chipStatus === 'approved' ? ' approved' : (chipStatus === 'rejected' ? ' rejected' : '');
      html += '<span class="decidr-so-reviewer-chip' + chipClass + '">'
        + UI.avatar(approverUser, 'sm')
        + ' <span>' + UI.escapeHtml(approverUser.name) + '</span>';
      if (chipStatus === 'approved') {
        html += ' <span class="decidr-so-reviewer-check">\u2713</span>';
      } else if (chipStatus === 'rejected') {
        html += ' <span class="decidr-so-reviewer-reject">\u2717</span>';
      }
      html += '</span>';
    }
    html += '<div style="position:relative;display:inline-block;">';
    html += '<button class="decidr-so-assign-btn" id="decidr-so-btn-assign-reviewers">+ Assign</button>';
    html += '<div class="decidr-so-reviewer-dropdown" id="decidr-so-reviewer-dropdown" style="display:none;">';
    html += '<div class="decidr-so-reviewer-dropdown-header">Add Reviewer</div>';
    html += '<div id="decidr-so-reviewer-list"></div>';
    html += '</div></div>';
    html += '</div>';

    // Approval progress summary
    if (approvalProgress) {
      var totalNeeded = approvalProgress.totalNeeded || 1;
      var totalHave = approvalProgress.totalHave || 0;
      html += '<div class="decidr-so-approval-progress">';
      html += '<span class="decidr-so-approval-stepper">';
      html += '<button class="decidr-so-stepper-btn" id="decidr-so-btn-approvals-dec" title="Decrease required approvals">\u2212</button>';
      html += '<span class="decidr-so-stepper-label" id="decidr-so-approvals-needed">' + totalNeeded + '</span>';
      html += '<button class="decidr-so-stepper-btn" id="decidr-so-btn-approvals-inc" title="Increase required approvals">+</button>';
      html += '</span>';
      html += '<span class="decidr-so-stepper-label">required</span>';
      html += '<span class="decidr-so-approval-divider">\u00b7</span>';
      if (approvalProgress.satisfied) {
        html += '<span class="decidr-so-approval-satisfied">\u2713 ' + totalHave + ' / ' + totalNeeded + ' approved</span>';
      } else {
        html += '<span class="decidr-so-approval-count">' + totalHave + ' / ' + totalNeeded + ' approvals</span>';
      }
      html += '</div>';
    }

    // Approve/Reject action buttons — reflect current user's vote
    var myVote = null;
    var myUserId = (typeof API !== 'undefined' && API._currentUserId) ? API._currentUserId : null;
    if (myUserId) {
      for (var vi = 0; vi < approvals.length; vi++) {
        if (approvals[vi].userId === myUserId) {
          myVote = approvals[vi].status || 'approved';
          break;
        }
      }
    }
    html += '<div class="decidr-so-approval-actions">';
    if (myVote === 'approved') {
      html += '<span class="decidr-so-btn decidr-so-btn-approve decidr-so-btn-active" aria-disabled="true">'
        + '\u2713 You approved</span>';
      html += '<button class="decidr-so-btn decidr-so-btn-reject" id="decidr-so-btn-reject">'
        + '\u2717 Reject</button>';
    } else if (myVote === 'rejected') {
      html += '<button class="decidr-so-btn decidr-so-btn-approve" id="decidr-so-btn-approve">'
        + '\u2713 Approve</button>';
      html += '<span class="decidr-so-btn decidr-so-btn-reject decidr-so-btn-active" aria-disabled="true">'
        + '\u2717 You rejected</span>';
    } else {
      html += '<button class="decidr-so-btn decidr-so-btn-approve" id="decidr-so-btn-approve">'
        + '\u2713 Approve</button>';
      html += '<button class="decidr-so-btn decidr-so-btn-reject" id="decidr-so-btn-reject">'
        + '\u2717 Reject</button>';
    }
    html += '</div>';

    html += '</div>';

    // Supersession banner
    html += UI.SlideOut._renderSupersessionBanner(decision);

    // Title + Description (view/edit mode)
    if (state.editMode) {
      html += '<input type="text" class="decidr-so-edit-input" id="decidr-so-edit-title" value="'
        + UI.escapeHtml(decision.title) + '">';
      html += '<textarea class="decidr-so-edit-textarea" id="decidr-so-edit-description" rows="4">'
        + UI.escapeHtml(decision.description || '') + '</textarea>';
      html += '<div class="decidr-so-form-actions">'
        + '<button class="decidr-so-btn" id="decidr-so-btn-cancel-edit">Cancel</button>'
        + '<button class="decidr-so-btn decidr-so-btn-primary" id="decidr-so-btn-save-edit">Save</button>'
        + '</div>';
    } else {
      html += '<h3 class="decidr-so-detail-title">' + UI.escapeHtml(decision.title) + '</h3>';
      if (decision.description) {
        html += '<p class="decidr-so-description">' + UI.escapeHtml(decision.description) + '</p>';
      }
    }

    // Parent entity link
    if (enriched.parentEntity) {
      var parentType = decision.projectId ? 'project' : (decision.bridgeId ? 'bridge' : 'initiative');
      var parentLabel = parentType.charAt(0).toUpperCase() + parentType.slice(1);
      var parentIcon = ENTITY_ICONS[parentType] || '';
      html += UI.SlideOut._renderParentLink(parentIcon, parentLabel, parentType, enriched.parentEntity);
    }

    // Parent decision link
    if (enriched.parentDecision) {
      html += UI.SlideOut._renderParentLink(ENTITY_ICONS.decision, 'Parent Decision', 'decision', enriched.parentDecision);
    }

    // Tasks section — compact checkbox rows (same as project panel)
    var tasks = decision.tasks || [];
    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Tasks', tasks.length);
    if (tasks.length > 0) {
      for (var t = 0; t < tasks.length; t++) {
        var task = tasks[t];
        var isDone = (task.status || '').toUpperCase() === 'DONE' || (task.status || '').toUpperCase() === 'COMPLETED';
        var doneClass = isDone ? ' decidr-so-task-done' : '';
        html += '<div class="decidr-so-task-item' + doneClass + '" data-entity-type="task" data-entity-id="' + UI.escapeHtml(task.id) + '">';
        html += '<button class="decidr-so-task-checkbox' + (isDone ? ' checked' : '') + '" data-task-id="' + UI.escapeHtml(task.id) + '" data-task-done="' + (isDone ? '1' : '0') + '">';
        html += isDone ? '\u2713' : '';
        html += '</button>';
        html += '<span class="decidr-so-task-title">' + UI.escapeHtml(task.title) + '</span>';
        html += UI.statusBadge(task.status);
        html += '</div>';
      }
    }
    html += '</div>';

    // Quick actions: Add Task
    html += '<div class="decidr-so-quick-actions">';
    html += '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-add-task">+ Add Task</button>';
    html += '</div>';

    // Add Task inline form
    html += '<div class="decidr-so-inline-form' + (state.addTaskFormOpen ? ' visible' : '') + '" id="decidr-so-form-add-task">';
    html += '<input type="text" id="decidr-so-input-task-title" placeholder="Task title...">';
    html += '<div class="decidr-so-form-actions">'
      + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-cancel-task">Cancel</button>'
      + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-save-task">Save</button>'
      + '</div></div>';

    // Documents section (shared helper)
    html += UI.SlideOut._renderDocumentSection('DECISION', decision.id, decision.documents || [], state);

    // GitHub Issues & PRs
    var ghSummaryDec = enriched.githubSummary;
    if (ghSummaryDec) {
      html += UI.githubSection(ghSummaryDec);
    } else if (!decision._enrichmentDone) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading issues & PRs...</div>';
    }

    // Sub-decisions
    var children = decision.children || [];
    if (children.length > 0) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Sub-decisions', children.length);
      html += UI.SlideOut._renderEntityList(children, 'decision');
      html += '</div>';
    }

    // Supersede form
    if (state.supersedeFormOpen) {
      html += '<div class="decidr-so-inline-form visible" id="decidr-so-form-supersede">';
      html += '<input type="text" id="decidr-so-input-supersede-title" placeholder="New decision title...">';
      html += '<textarea class="decidr-so-edit-textarea" id="decidr-so-input-supersede-rationale" placeholder="Rationale..." rows="2"></textarea>';
      html += '<div class="decidr-so-form-actions">'
        + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-cancel-supersede">Cancel</button>'
        + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-save-supersede">Supersede</button>'
        + '</div></div>';
    }

    // Timeline (always show section, even if empty)
    html += UI.SlideOut._renderTimeline(enriched.timeline, state.timelineFilter, { filterPrefix: 'decision-timeline', showEmpty: true, parentType: 'decision', parentId: decision.id });
    html += '<div style="text-align:center;margin:var(--space-2) 0;">'
      + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-view-all-decision-timeline">View All Activity</button>'
      + '</div>';

    // Comment form
    html += '<div class="decidr-so-comment-form">';
    html += '<textarea id="decidr-so-input-comment" placeholder="Add a comment..." rows="3"></textarea>';
    html += '<div class="decidr-so-form-actions">'
      + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-post-comment">Post</button>'
      + '</div></div>';

    html += '</div>';
    return html;
  };

  /**
   * Render task slide-out detail panel.
   * @param {Object} task - Task data with _enriched sub-objects
   * @returns {string} HTML string
   */
  UI.slideOutTask = function(task) {
    var state = UI.SlideOut._taskPanelState;
    var enriched = task._enriched || {};
    var html = '<div class="decidr-so-detail">';

    // Action bar
    var transitions = task.allowedTransitions || [];

    html += '<div class="decidr-so-action-bar">';
    html += '<button class="decidr-so-btn" id="decidr-so-btn-task-edit">'
      + (state.editMode ? 'Cancel Edit' : 'Edit') + '</button>';
    if (transitions.length > 0) {
      html += '<div class="decidr-so-status-dropdown">';
      html += '<button class="decidr-so-btn" id="decidr-so-btn-task-status">Status \u25BE</button>';
      html += '<div class="decidr-so-status-menu" id="decidr-so-task-status-menu">';
      for (var si = 0; si < transitions.length; si++) {
        html += '<button class="decidr-so-status-option" data-task-transition="' + transitions[si] + '">'
          + UI.escapeHtml(STATUS_LABELS[transitions[si]] || transitions[si]) + '</button>';
      }
      html += '</div></div>';
    }
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-task-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    // Meta row
    var metaItems = [{ html: UI.statusBadge(task.status) }];
    if (task.assignee && task.assignee.name) {
      metaItems.push({ html: UI.userChip(task.assignee) });
    } else if (task.assigneeId) {
      metaItems.push({ html: 'Assignee: ' + UI.escapeHtml(task.assigneeId.slice(0, 8)) });
    }
    if (task.dueDate) {
      metaItems.push({ html: 'Due: ' + UI.formatDate(task.dueDate) });
    }
    if (task.createdAt) {
      metaItems.push({ html: UI.formatDate(task.createdAt) });
    }
    html += UI.SlideOut._renderMeta(metaItems);

    // Title + Description
    if (state.editMode) {
      html += '<input type="text" class="decidr-so-edit-input" id="decidr-so-edit-task-title" value="'
        + UI.escapeHtml(task.title) + '">';
      html += '<textarea class="decidr-so-edit-textarea" id="decidr-so-edit-task-description" rows="3">'
        + UI.escapeHtml(task.description || '') + '</textarea>';
      html += '<div class="decidr-so-form-actions">'
        + '<button class="decidr-so-btn" id="decidr-so-btn-cancel-task-edit">Cancel</button>'
        + '<button class="decidr-so-btn decidr-so-btn-primary" id="decidr-so-btn-save-task-edit">Save</button>'
        + '</div>';
    } else {
      html += '<h3 class="decidr-so-detail-title">' + UI.escapeHtml(task.title) + '</h3>';
      if (task.description) {
        html += '<p class="decidr-so-description">' + UI.escapeHtml(task.description) + '</p>';
      }
    }

    // Parent Decision link
    var parentDecision = task.decision || enriched.parentDecision;
    if (parentDecision) {
      html += UI.SlideOut._renderParentLink(ENTITY_ICONS.decision, 'Decision', 'decision', parentDecision);
    }

    // Parent Project link
    var parentProject = task.project || enriched.parentProject;
    if (parentProject) {
      html += UI.SlideOut._renderParentLink(ENTITY_ICONS.project, 'Project', 'project', parentProject);
    }

    // Completed by
    var taskStatus = (task.status || '').toUpperCase();
    if (taskStatus === 'DONE' && task.completedBy && task.completedBy.name) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Completed by');
      html += '<div class="decidr-so-completed-by">'
        + '<span class="decidr-so-reviewer-check" style="margin-right:6px;">\u2713</span>'
        + UI.userChip(task.completedBy)
        + '</div>';
      html += '</div>';
    }

    // Blockers
    var blockedByTasks = task.blockedByTasks || [];
    var blockedByDecisions = task.blockedByDecisions || [];
    if (blockedByTasks.length > 0 || blockedByDecisions.length > 0) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Blocked By');
      html += '<div class="decidr-so-blockers-list">';
      for (var bt = 0; bt < blockedByTasks.length; bt++) {
        var bTask = blockedByTasks[bt];
        html += '<span class="decidr-so-blocker-chip" data-entity-type="task" data-entity-id="' + UI.escapeHtml(bTask.id) + '">'
          + entityIcon('task') + ' ' + UI.escapeHtml(bTask.title || bTask.id)
          + '</span>';
      }
      for (var bd = 0; bd < blockedByDecisions.length; bd++) {
        var bDec = blockedByDecisions[bd];
        html += '<span class="decidr-so-blocker-chip" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(bDec.id) + '">'
          + entityIcon('decision') + ' ' + UI.escapeHtml(bDec.title || bDec.id)
          + '</span>';
      }
      html += '</div></div>';
    }

    // Documents section (shared helper)
    html += UI.SlideOut._renderDocumentSection('TASK', task.id, task.documents || [], state);

    // GitHub Issues & PRs
    var ghSummaryTask = enriched.githubSummary;
    if (ghSummaryTask) {
      html += UI.githubSection(ghSummaryTask);
    } else if (!task._enrichmentDone) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading issues & PRs...</div>';
    }

    html += '</div>';
    return html;
  };

  /**
   * Render bridge slide-out detail panel.
   * @param {Object} bridge - Bridge data with _enriched sub-objects
   * @returns {string} HTML string
   */
  UI.slideOutBridge = function(bridge) {
    var state = UI.SlideOut._bridgePanelState;
    var enriched = bridge._enriched || {};
    var html = '<div class="decidr-so-detail">';

    // Title row
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-2);">';
    html += '<span style="display:flex;align-items:center;color:var(--text-secondary);">' + ENTITY_ICONS.bridge + '</span>';
    html += '<h3 class="decidr-so-detail-title" style="margin:0;">' + UI.escapeHtml(bridge.name) + '</h3>';
    html += '</div>';

    // Meta
    html += UI.SlideOut._renderMeta([
      { html: UI.entityTypeBadge('bridge') },
      { html: UI.statusBadge(bridge.status) },
      bridge.createdBy && bridge.createdBy.name ? { html: UI.escapeHtml(bridge.createdBy.name) } : null,
      bridge.createdAt ? { html: UI.formatDate(bridge.createdAt) } : null
    ].filter(function(x) { return x; }));

    // Action bar
    var bridgeTransitions = bridge.allowedTransitions || [];
    html += '<div class="decidr-so-action-bar">';
    if (bridgeTransitions.length > 0) {
      html += '<div class="decidr-so-status-dropdown">';
      html += '<button class="decidr-so-btn" id="decidr-so-btn-bridge-status">Status \u25BE</button>';
      html += '<div class="decidr-so-status-menu" id="decidr-so-bridge-status-menu">';
      for (var bsi = 0; bsi < bridgeTransitions.length; bsi++) {
        html += '<button class="decidr-so-status-option" data-bridge-transition="' + bridgeTransitions[bsi] + '">'
          + UI.escapeHtml(STATUS_LABELS[bridgeTransitions[bsi]] || bridgeTransitions[bsi]) + '</button>';
      }
      html += '</div></div>';
    }
    html += '<span class="decidr-so-spacer"></span>';
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-bridge-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    // Description
    if (bridge.description) {
      html += '<p class="decidr-so-description">' + UI.escapeHtml(bridge.description) + '</p>';
    }

    // Source Project
    if (bridge.fromProject) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Source Project');
      html += '<div class="decidr-so-list-item" data-entity-type="project" data-entity-id="' + UI.escapeHtml(bridge.fromProject.id) + '" style="cursor:pointer;">';
      html += '<div class="decidr-so-color-dot" style="background:' + UI.sanitizeColor(bridge.fromProject.color || '#6366f1') + ';display:inline-block;margin-right:6px;"></div>';
      html += '<span class="decidr-so-list-title">' + UI.escapeHtml(bridge.fromProject.name) + '</span>';
      html += UI.statusBadge(bridge.fromProject.status);
      html += '</div></div>';
    }

    // Target Project
    if (bridge.toProject) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Target Project');
      html += '<div class="decidr-so-list-item" data-entity-type="project" data-entity-id="' + UI.escapeHtml(bridge.toProject.id) + '" style="cursor:pointer;">';
      html += '<div class="decidr-so-color-dot" style="background:' + UI.sanitizeColor(bridge.toProject.color || '#6366f1') + ';display:inline-block;margin-right:6px;"></div>';
      html += '<span class="decidr-so-list-title">' + UI.escapeHtml(bridge.toProject.name) + '</span>';
      html += UI.statusBadge(bridge.toProject.status);
      html += '</div></div>';
    }

    // Decisions
    var decisions = bridge.decisions || [];
    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Decisions', decisions.length);
    html += UI.SlideOut._renderEntityList(decisions, 'decision', { emptyText: 'No decisions on this bridge' });
    html += '</div>';

    // Documents section (shared helper)
    html += UI.SlideOut._renderDocumentSection('BRIDGE', bridge.id, bridge.documents || [], state);

    // Timeline
    html += UI.SlideOut._renderTimeline(enriched.timeline, 'all', { filterPrefix: 'bridge-timeline', parentType: 'bridge', parentId: bridge.id });

    html += '</div>';
    return html;
  };

  /**
   * Render initiative slide-out detail panel.
   * @param {Object} initiative - Initiative data with _enriched sub-objects
   * @returns {string} HTML string
   */
  UI.slideOutInitiative = function(initiative) {
    var state = UI.SlideOut._initiativePanelState;
    var enriched = initiative._enriched || {};
    var html = '<div class="decidr-so-detail">';

    html += '<h3 class="decidr-so-detail-title">' + UI.escapeHtml(initiative.name) + '</h3>';

    // Meta
    var metaItems = [];
    if (initiative.createdBy && initiative.createdBy.name) {
      metaItems.push({ html: UI.escapeHtml(initiative.createdBy.name) });
    }
    if (initiative.createdAt) {
      metaItems.push({ html: UI.formatDate(initiative.createdAt) });
    }
    // Stats from _count
    var counts = initiative._count || {};
    if (counts.projects > 0) {
      metaItems.push({ html: counts.projects + ' Project' + (counts.projects !== 1 ? 's' : '') });
    }
    if (counts.decisions > 0) {
      metaItems.push({ html: counts.decisions + ' Decision' + (counts.decisions !== 1 ? 's' : '') });
    }
    if (metaItems.length > 0) html += UI.SlideOut._renderMeta(metaItems);

    // Action bar
    html += '<div class="decidr-so-action-bar">';
    html += '<span class="decidr-so-spacer"></span>';
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-initiative-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    // Description
    if (initiative.description) {
      html += '<p class="decidr-so-description">' + UI.escapeHtml(initiative.description) + '</p>';
    }

    // Projects
    var projects = (enriched.projects && enriched.projects.data) || enriched.projects || [];
    if (Array.isArray(projects) && projects.length > 0) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Projects', projects.length);
      html += UI.SlideOut._renderEntityList(projects, 'project');
      html += '</div>';
    } else if (!enriched.projects) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading projects...</div>';
    }

    // Decisions
    var decisions = (enriched.decisions && enriched.decisions.data) || enriched.decisions || [];
    if (Array.isArray(decisions) && decisions.length > 0) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Decisions', decisions.length);
      html += UI.SlideOut._renderEntityList(decisions, 'decision');
      html += '</div>';
    } else if (!enriched.decisions) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading decisions...</div>';
    }

    // Documents section (shared helper)
    html += UI.SlideOut._renderDocumentSection('INITIATIVE', initiative.id, initiative.documents || [], state);

    html += '</div>';
    return html;
  };

  /**
   * Render full timeline panel for project or decision.
   * @param {Object} data - Entity data with _enriched.timeline
   * @param {string} entityType - 'project' or 'decision'
   * @returns {string} HTML string
   */
  UI.slideOutTimeline = function(data, entityType) {
    var enriched = data._enriched || {};
    var html = '<div class="decidr-so-detail">';
    html += '<h3 class="decidr-so-detail-title">' + UI.escapeHtml(data.name || data.title || '') + '</h3>';
    html += UI.SlideOut._renderTimeline(enriched.timeline, 'all', { filterPrefix: entityType + '-timeline', limit: 100, parentType: entityType, parentId: data.id });
    if (!enriched.timeline) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading timeline...</div>';
    }
    html += '</div>';
    return html;
  };

})();

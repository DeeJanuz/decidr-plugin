/**
 * DecidR MCP Views — Shared Component Library
 *
 * Ported from mockup TRIBEX_UI but adapted for the API-driven plugin:
 *   - No DB.* dependencies — all data passed as parameters
 *   - Registered on window.__decidrUI instead of TRIBEX_UI
 *   - Uses decidr- CSS class prefix (styles injected by theme.js)
 *   - Returns HTML strings (same pattern as mockup)
 */
(function() {
  'use strict';

  window.__decidrUI = window.__decidrUI || {};
  var UI = window.__decidrUI;

  // ─── Decision Status Config ───────────────────────────────────────

  var DECISION_STATUS_CONFIG = {
    colors: {
      decided: '#22c55e',
      agreed: '#22c55e',
      implemented: '#22c55e',
      in_progress: '#3b82f6',
      under_discussion: '#3b82f6',
      open: '#3b82f6',
      proposed: '#f59e0b',
      blocked: '#ef4444',
      deferred: '#6b7280'
    },
    labels: {
      decided: 'Decided',
      agreed: 'Agreed',
      implemented: 'Implemented',
      in_progress: 'In Progress',
      under_discussion: 'Under Discussion',
      open: 'Open',
      proposed: 'Proposed',
      blocked: 'Blocked',
      deferred: 'Deferred'
    },
    order: ['decided', 'agreed', 'implemented', 'in_progress', 'under_discussion', 'open', 'proposed', 'blocked', 'deferred']
  };

  // ─── Status / Priority / Entity Labels ────────────────────────────

  var STATUS_LABELS = {
    PLANNING: 'Planning',
    ACTIVE: 'Active',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
    PROPOSED: 'Proposed',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    IN_PROGRESS: 'In Progress',
    IMPLEMENTED: 'Implemented',
    PLANNING: 'Planning',
    ACTIVE: 'Active',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
    TODO: 'To Do',
    DONE: 'Done'
  };

  var PRIORITY_LABELS = {
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };

  var ENTITY_TYPE_LABELS = {
    decision: 'Decision',
    bridge: 'Bridge',
    task: 'Task',
    project: 'Project',
    initiative: 'Initiative'
  };

  // ─── Utility Functions ────────────────────────────────────────────

  UI.escapeHtml = function(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  UI.sanitizeColor = function(c) {
    return (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : '#6b7280';
  };

  UI.truncate = function(str, max) {
    if (!str) return '';
    max = max || 80;
    if (str.length <= max) return str;
    return str.slice(0, max) + '...';
  };

  UI.timeAgo = function(dateStr) {
    if (!dateStr) return '';
    var now = new Date();
    var then = new Date(dateStr);
    var diffMs = now - then;
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHr = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHr / 24);
    var diffWeek = Math.floor(diffDay / 7);
    var diffMonth = Math.floor(diffDay / 30);
    var diffYear = Math.floor(diffDay / 365);

    if (diffSec < 0) return 'just now';
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return diffMin + ' minute' + (diffMin !== 1 ? 's' : '') + ' ago';
    if (diffHr < 24) return diffHr + ' hour' + (diffHr !== 1 ? 's' : '') + ' ago';
    if (diffDay < 7) return diffDay + ' day' + (diffDay !== 1 ? 's' : '') + ' ago';
    if (diffWeek < 5) return diffWeek + ' week' + (diffWeek !== 1 ? 's' : '') + ' ago';
    if (diffMonth < 12) return diffMonth + ' month' + (diffMonth !== 1 ? 's' : '') + ' ago';
    return diffYear + ' year' + (diffYear !== 1 ? 's' : '') + ' ago';
  };

  UI.formatDate = function(dateStr) {
    if (!dateStr) return '';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var d = new Date(dateStr);
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  };

  /** Normalize a status enum to lowercase with underscores for CSS class names */
  function normalizeStatus(status) {
    if (!status) return 'unknown';
    return String(status).toLowerCase().replace(/\s+/g, '_');
  }

  /** Get a human label for a status enum */
  function statusLabel(status) {
    if (!status) return 'Unknown';
    var label = STATUS_LABELS[status] || STATUS_LABELS[status.toUpperCase()];
    if (label) return label;
    // Fallback: capitalize and replace underscores
    return String(status).replace(/_/g, ' ').replace(/\b\w/g, function(c) {
      return c.toUpperCase();
    });
  }

  // ─── Badge Components ─────────────────────────────────────────────

  UI.statusBadge = function(status) {
    var norm = normalizeStatus(status);
    var label = statusLabel(status);
    return '<span class="decidr-badge decidr-status-' + norm + '">' + UI.escapeHtml(label) + '</span>';
  };

  UI.priorityBadge = function(priority) {
    var norm = normalizeStatus(priority);
    var label = PRIORITY_LABELS[priority] || PRIORITY_LABELS[norm] || UI.escapeHtml(String(priority));
    return '<span class="decidr-badge decidr-priority-' + norm + '">' + UI.escapeHtml(label) + '</span>';
  };

  UI.entityTypeBadge = function(entityType) {
    var norm = normalizeStatus(entityType);
    var label = ENTITY_TYPE_LABELS[norm] || UI.escapeHtml(String(entityType));
    return '<span class="decidr-badge decidr-entity-' + norm + '">' + UI.escapeHtml(label) + '</span>';
  };

  // ─── Avatar + User Chip ────────────────────────────────────────────

  UI.avatar = function(user, size) {
    var s = size || 'md';
    var name = (user && user.name) ? user.name : '?';
    var initials = name.split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').slice(0,2);
    var color = UI.sanitizeColor((user && user.avatarColor) ? user.avatarColor : '#6366f1');
    return '<span class="decidr-avatar decidr-avatar-' + s + '" style="background-color:' + color + ';">' + UI.escapeHtml(initials) + '</span>';
  };

  UI.userChip = function(user) {
    var name = (user && user.name) ? UI.escapeHtml(user.name) : 'Unknown';
    return '<span class="decidr-user-chip">' + UI.avatar(user, 'sm') + ' <span class="decidr-user-chip-name">' + name + '</span></span>';
  };

  // ─── Entity Type Icons (inline SVG) ────────────────────────────────

  var ENTITY_ICONS = {
    project: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M3 4.5A1.5 1.5 0 014.5 3h3.379a1.5 1.5 0 011.06.44l1.122 1.12a1.5 1.5 0 001.06.44H15.5A1.5 1.5 0 0117 6.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5v-10z"/>'
      + '</svg>',
    decision: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="10" cy="10" r="7"/>'
      + '<path d="M10 6v4l2.5 2.5"/>'
      + '</svg>',
    task: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="3" y="3" width="14" height="14" rx="2"/>'
      + '<path d="M7 10l2 2 4-4"/>'
      + '</svg>',
    bridge: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M3 10h14"/>'
      + '<path d="M3 10c0-3 3-6 7-6"/>'
      + '<path d="M17 10c0-3-3-6-7-6"/>'
      + '<circle cx="3" cy="10" r="1.5"/>'
      + '<circle cx="17" cy="10" r="1.5"/>'
      + '</svg>',
    initiative: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M10 3l7 4v6l-7 4-7-4V7l7-4z"/>'
      + '<path d="M10 10l7-4"/>'
      + '<path d="M10 10v7"/>'
      + '<path d="M10 10L3 6"/>'
      + '</svg>'
  };

  var ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z"/><line x1="9" y1="4.5" x2="11.5" y2="7"/></svg>';
  var ICON_CHEVRON_DOWN = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l5 5 5-5"/></svg>';
  var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10"/><path d="M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1"/><path d="M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9"/></svg>';
  var ICON_CALENDAR = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5" y1="1.5" x2="5" y2="4.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/></svg>';

  function entityIcon(type) {
    return ENTITY_ICONS[type] || ENTITY_ICONS.project;
  }

  // ─── Card Components ──────────────────────────────────────────────

  UI.projectCard = function(project, opts) {
    var o = opts || {};
    var decisions = o.decisions || [];
    var tasks = o.tasks || [];

    var taskTotal = tasks.length;
    var taskDone = 0;
    for (var i = 0; i < tasks.length; i++) {
      var ts = normalizeStatus(tasks[i].status);
      if (ts === 'done' || ts === 'completed') taskDone++;
    }
    var pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
    var fillDoneClass = pct === 100 ? ' decidr-progress-fill-done' : '';

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var descHtml = project.description
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.truncate(project.description, 120)) + '</div>'
      : '';

    var progressHtml = '';
    if (taskTotal > 0) {
      progressHtml = '<div class="decidr-progress-wrap">'
        + '<div class="decidr-progress-bar">'
        + '<div class="decidr-progress-fill' + fillDoneClass + '" style="width: ' + pct + '%;"></div>'
        + '</div>'
        + '<span class="decidr-progress-label">' + taskDone + '/' + taskTotal + ' tasks</span>'
        + '</div>';
    }

    var metaParts = [];
    if (decisions.length > 0) {
      metaParts.push(decisions.length + ' decision' + (decisions.length !== 1 ? 's' : ''));
    }
    if (taskTotal > 0) {
      metaParts.push(taskTotal + ' task' + (taskTotal !== 1 ? 's' : ''));
    }
    if (metaParts.length === 0 && project.createdAt) {
      metaParts.push('Created ' + UI.timeAgo(project.createdAt));
    }
    var metaHtml = metaParts.length > 0
      ? '<div class="decidr-card-meta">' + UI.escapeHtml(metaParts.join(' \u00b7 ')) + '</div>'
      : '';

    return '<div class="decidr-card decidr-project-card" '
      + 'data-entity-type="project" data-entity-id="' + UI.escapeHtml(project.id) + '"'
      + animStyle + '>'
      + '<div class="decidr-card-icon">' + entityIcon('project') + '</div>'
      + '<div class="decidr-card-body">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-type-label">Project</span>'
      + UI.statusBadge(project.status)
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(project.name) + '</div>'
      + descHtml
      + metaHtml
      + progressHtml
      + '</div>'
      + '</div>';
  };

  // Compact project card for dashboard initiative sections
  UI.dashboardProjectCard = function(project, opts) {
    var o = opts || {};
    var decisions = o.decisions || [];
    var tasks = o.tasks || [];
    var isOwner = o.isOwner || false;
    var pendingCount = o.pendingDecisions || 0;
    var needsYourReview = o.needsYourReview || 0;

    var taskTotal = tasks.length;
    var taskDone = 0;
    for (var i = 0; i < tasks.length; i++) {
      var ts = normalizeStatus(tasks[i].status);
      if (ts === 'done' || ts === 'completed') taskDone++;
    }
    var pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
    var fillDoneClass = pct === 100 ? ' decidr-progress-fill-done' : '';

    var projColor = project.color || '#6366f1';
    var styleStr = 'border-left: 3px solid ' + projColor + ';';
    if (typeof o.animDelay === 'number') {
      styleStr += 'animation-delay: ' + o.animDelay.toFixed(2) + 's;';
    }

    // Badges: owner + pending
    var badgesHtml = '';
    if (isOwner) {
      badgesHtml += '<span class="decidr-dash-proj-badge decidr-dash-proj-badge-owner">Owner</span>';
    }
    if (needsYourReview > 0) {
      badgesHtml += '<span class="decidr-dash-proj-badge decidr-dash-proj-badge-review">'
        + needsYourReview + ' needs review</span>';
    }
    if (pendingCount > 0) {
      badgesHtml += '<span class="decidr-dash-proj-badge decidr-dash-proj-badge-pending">'
        + pendingCount + ' pending</span>';
    }

    // Owner line
    var ownerHtml = '';
    if (project.createdBy && project.createdBy.name) {
      var ownerName = project.createdBy.name;
      var initials = ownerName.split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').slice(0, 2);
      var avatarColor = UI.sanitizeColor(project.createdBy.avatarColor || projColor);
      ownerHtml = '<div class="decidr-dash-proj-owner">'
        + '<span class="decidr-dash-proj-owner-avatar" style="background:' + avatarColor + ';">' + UI.escapeHtml(initials) + '</span>'
        + '<span>' + UI.escapeHtml(ownerName) + '</span>'
        + '</div>';
    }

    // Stats line
    var statParts = [];
    if (decisions.length > 0) {
      statParts.push('<span class="decidr-inline-icon">' + ENTITY_ICONS.decision + '</span>'
        + decisions.length + ' decision' + (decisions.length !== 1 ? 's' : ''));
    }
    if (taskTotal > 0) {
      statParts.push(taskDone + '/' + taskTotal + ' tasks');
    }
    var statHtml = statParts.length > 0
      ? '<div class="decidr-dash-proj-stat">' + statParts.join(' &middot; ') + '</div>'
      : '';

    // Progress bar
    var progressHtml = '';
    if (taskTotal > 0) {
      progressHtml = '<div class="decidr-progress-wrap" style="margin-top:6px;">'
        + '<div class="decidr-progress-bar">'
        + '<div class="decidr-progress-fill' + fillDoneClass + '" style="width:' + pct + '%;"></div>'
        + '</div>'
        + '</div>';
    }

    return '<div class="decidr-dash-proj" '
      + 'data-entity-type="project" data-entity-id="' + UI.escapeHtml(project.id) + '"'
      + ' style="' + styleStr + '">'
      + '<div class="decidr-dash-proj-name">' + UI.escapeHtml(project.name) + '</div>'
      + ownerHtml
      + '<div class="decidr-dash-proj-meta">'
      + UI.statusBadge(project.status)
      + (badgesHtml ? ' ' + badgesHtml : '')
      + '</div>'
      + statHtml
      + progressHtml
      + '</div>';
  };

  // ─── Graph Project Card (SVG foreignObject content) ───────────────

  /** @private Status color map for graph nodes */
  function _graphStatusColor(status) {
    var map = { active: '#22c55e', planning: '#3b82f6', completed: '#6b7280',
                proposed: '#f59e0b', in_progress: '#3b82f6', implemented: '#22c55e' };
    return map[status] || '#6b7280';
  }

  /**
   * Graph project card rendered inside SVG foreignObject.
   * Node shape: { label, color, status, ownerColor, ownerInitials, ownerName, decisionCount }
   * @param {Object} node
   * @returns {string} HTML string
   */
  UI.graphProjectCard = function(node) {
    var statusNorm = (node.status || 'unknown').toLowerCase().replace(/\s+/g, '_');
    var statusColor = _graphStatusColor(statusNorm);
    var statusLabel = statusNorm.replace(/_/g, ' ');

    return '<div xmlns="http://www.w3.org/1999/xhtml" class="decidr-graph-proj-card" style="border-left-color:' + UI.sanitizeColor(node.color || '#60a5fa') + ';">'
      + '<div class="decidr-graph-proj-card-name">' + UI.escapeHtml(node.label || '') + '</div>'
      + '<div class="decidr-graph-proj-card-owner">'
      + '<span class="decidr-graph-proj-card-avatar" style="background:' + UI.sanitizeColor(node.ownerColor || '#6b7280') + ';">'
      + UI.escapeHtml(node.ownerInitials || '??') + '</span>'
      + '<span>' + UI.escapeHtml(node.ownerName || 'Unknown') + '</span>'
      + '</div>'
      + '<div class="decidr-graph-proj-card-footer">'
      + '<div class="decidr-graph-proj-card-status">'
      + '<span class="decidr-graph-proj-card-dot" style="background:' + statusColor + ';"></span>'
      + '<span>' + UI.escapeHtml(statusLabel) + '</span>'
      + '</div>'
      + '<span>' + (node.decisionCount || 0) + ' dec' + ((node.decisionCount || 0) !== 1 ? 's' : '') + '</span>'
      + '</div>'
      + '</div>';
  };

  UI.decisionCard = function(decision, opts) {
    var o = opts || {};

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var descHtml = decision.description
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.truncate(decision.description, 120)) + '</div>'
      : '';

    var metaParts = [];
    if (decision.status) metaParts.push(statusLabel(decision.status));
    if (decision.createdAt) metaParts.push(UI.timeAgo(decision.createdAt));
    if (o.parentName) metaParts.push('on ' + o.parentName);
    var metaHtml = metaParts.length > 0
      ? '<div class="decidr-card-meta">' + UI.escapeHtml(metaParts.join(' \u00b7 ')) + '</div>'
      : '';

    return '<div class="decidr-card decidr-decision-card" '
      + 'data-entity-type="decision" data-entity-id="' + UI.escapeHtml(decision.id) + '"'
      + animStyle + '>'
      + '<div class="decidr-card-icon">' + entityIcon('decision') + '</div>'
      + '<div class="decidr-card-body">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-type-label">Decision</span>'
      + UI.statusBadge(decision.status)
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(decision.title) + '</div>'
      + descHtml
      + metaHtml
      + '</div>'
      + '</div>';
  };

  UI.taskCard = function(task, opts) {
    var o = opts || {};

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var descHtml = task.description
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.truncate(task.description, 100)) + '</div>'
      : '';

    var metaParts = [];
    if (task.status) metaParts.push(statusLabel(task.status));
    if (task.dueDate) metaParts.push('Due ' + UI.formatDate(task.dueDate));
    else if (task.createdAt) metaParts.push(UI.timeAgo(task.createdAt));
    if (task.priority) metaParts.push(task.priority + ' priority');
    if (o.parentName) metaParts.push('on ' + o.parentName);
    var metaHtml = metaParts.length > 0
      ? '<div class="decidr-card-meta">' + UI.escapeHtml(metaParts.join(' \u00b7 ')) + '</div>'
      : '';

    return '<div class="decidr-card decidr-task-card" '
      + 'data-entity-type="task" data-entity-id="' + UI.escapeHtml(task.id) + '"'
      + animStyle + '>'
      + '<div class="decidr-card-icon">' + entityIcon('task') + '</div>'
      + '<div class="decidr-card-body">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-type-label">Task</span>'
      + UI.statusBadge(task.status)
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(task.title) + '</div>'
      + descHtml
      + metaHtml
      + '</div>'
      + '</div>';
  };

  UI.bridgeCard = function(bridge, opts) {
    var o = opts || {};

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var descHtml = bridge.description
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.truncate(bridge.description, 120)) + '</div>'
      : '';

    var metaParts = [];
    if (o.fromProjectName || o.toProjectName) {
      var fromName = o.fromProjectName || '?';
      var toName = o.toProjectName || '?';
      metaParts.push(fromName + ' \u2192 ' + toName);
    }
    if (bridge.status) metaParts.push(statusLabel(bridge.status));
    if (bridge.createdAt && metaParts.length < 2) metaParts.push(UI.timeAgo(bridge.createdAt));
    var metaHtml = metaParts.length > 0
      ? '<div class="decidr-card-meta">' + UI.escapeHtml(metaParts.join(' \u00b7 ')) + '</div>'
      : '';

    return '<div class="decidr-card decidr-bridge-card" '
      + 'data-entity-type="bridge" data-entity-id="' + UI.escapeHtml(bridge.id) + '"'
      + animStyle + '>'
      + '<div class="decidr-card-icon">' + entityIcon('bridge') + '</div>'
      + '<div class="decidr-card-body">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-type-label">Bridge</span>'
      + UI.statusBadge(bridge.status)
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(bridge.name) + '</div>'
      + descHtml
      + metaHtml
      + '</div>'
      + '</div>';
  };

  UI.initiativeCard = function(initiative, opts) {
    var o = opts || {};
    var projectCount = o.projectCount || 0;
    var totalDecisions = o.totalDecisions || 0;

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    // Enhanced mode: if decisionsByStatus or collapsed is provided, render rich header
    if (o.decisionsByStatus || o.collapsed !== undefined) {
      var collapsedClass = o.collapsed ? ' decidr-init-card-collapsed' : '';
      var chevronSvg = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l5 5 5-5"/></svg>';
      var decsByStatus = o.decisionsByStatus || {};
      var decHealthHtml = UI.decisionHealthBar(decsByStatus, { size: 'sm' });
      var legendHtml = UI.decisionHealthLegend(decsByStatus);

      return '<div class="decidr-card decidr-init-card' + collapsedClass + '" '
        + 'data-entity-type="initiative" data-entity-id="' + UI.escapeHtml(initiative.id) + '" '
        + 'data-init-id="' + UI.escapeHtml(initiative.id) + '"'
        + animStyle + '>'
        + '<div class="decidr-init-header">'
        + '<div class="decidr-init-toggle">' + chevronSvg + '</div>'
        + '<div class="decidr-init-title-area">'
        + '<span class="decidr-init-name">' + UI.escapeHtml(initiative.name) + '</span>'
        + (initiative.description ? '<span class="decidr-init-description">' + UI.escapeHtml(UI.truncate(initiative.description, 80)) + '</span>' : '')
        + '</div>'
        + '<div class="decidr-init-stats">'
        + '<span class="decidr-init-stat">' + projectCount + ' project' + (projectCount !== 1 ? 's' : '') + '</span>'
        + '<span class="decidr-init-stat">' + totalDecisions + ' decision' + (totalDecisions !== 1 ? 's' : '') + '</span>'
        + '</div>'
        + '<div class="decidr-init-health">'
        + legendHtml
        + decHealthHtml
        + '</div>'
        + '</div>'
        + '</div>';
    }

    // Fallback: simple card (backward-compatible for list.js)
    var descHtml = initiative.description
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.truncate(initiative.description, 100)) + '</div>'
      : '';

    var metaParts = [];
    if (projectCount > 0) {
      metaParts.push(projectCount + ' project' + (projectCount !== 1 ? 's' : ''));
    }
    if (totalDecisions > 0) {
      metaParts.push(totalDecisions + ' decision' + (totalDecisions !== 1 ? 's' : ''));
    }
    var metaHtml = metaParts.length > 0
      ? '<div class="decidr-card-meta">' + UI.escapeHtml(metaParts.join(' \u00b7 ')) + '</div>'
      : '';

    return '<div class="decidr-card decidr-init-card" '
      + 'data-entity-type="initiative" data-entity-id="' + UI.escapeHtml(initiative.id) + '"'
      + animStyle + '>'
      + '<div class="decidr-card-icon">' + entityIcon('initiative') + '</div>'
      + '<div class="decidr-card-body">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-type-label">Initiative</span>'
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(initiative.name) + '</div>'
      + descHtml
      + metaHtml
      + '</div>'
      + '</div>';
  };

  UI.actionItemCard = function(item, opts) {
    var o = opts || {};

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var reasonHtml = item.reason
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.truncate(item.reason, 100)) + '</div>'
      : '';

    var metaParts = [];
    if (item.parentName) metaParts.push(item.parentName);
    if (item.dueDate) metaParts.push('Due: ' + UI.formatDate(item.dueDate));
    var metaHtml = metaParts.length > 0
      ? '<div class="decidr-card-meta">' + UI.escapeHtml(metaParts.join(' \u00b7 ')) + '</div>'
      : '';

    var entityType = item.entityType || '';
    var typeLabel = ENTITY_TYPE_LABELS[entityType] || entityType;

    return '<div class="decidr-card decidr-action-item-card" '
      + 'data-entity-type="' + UI.escapeHtml(entityType) + '" '
      + 'data-entity-id="' + UI.escapeHtml(item.entityId || item.id || '') + '"'
      + animStyle + '>'
      + '<div class="decidr-card-icon">' + entityIcon(entityType) + '</div>'
      + '<div class="decidr-card-body">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-type-label">' + UI.escapeHtml(typeLabel) + '</span>'
      + (item.priority ? ' ' + UI.priorityBadge(item.priority) : '')
      + (item.status ? ' ' + UI.statusBadge(item.status) : '')
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(item.title) + '</div>'
      + reasonHtml
      + metaHtml
      + '</div>'
      + '</div>';
  };

  UI.nextStepCard = function(item, opts) {
    var o = opts || {};
    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var entityType = item.entityType || '';
    var typeLabel = ENTITY_TYPE_LABELS[entityType] || entityType;

    // Action badge (category) instead of priority badge
    var actionBadgeHtml = '';
    if (o.actionBadge) {
      actionBadgeHtml = ' <span class="decidr-next-step-action-badge'
        + (o.actionClass ? ' ' + o.actionClass : '') + '">'
        + UI.escapeHtml(o.actionBadge) + '</span>';
    }

    // Build subtitle: "Status · for "parent" on Project · time ago"
    var subtitleParts = [];
    if (item.status) subtitleParts.push(item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase().replace(/_/g, ' '));
    if (item.parentName) subtitleParts.push('for \u201c' + item.parentName + '\u201d');
    if (item.createdAt) subtitleParts.push(UI.timeAgo(item.createdAt));
    var subtitleHtml = subtitleParts.length > 0
      ? '<div class="decidr-next-step-meta">' + UI.escapeHtml(subtitleParts.join(' \u00b7 ')) + '</div>'
      : '';

    return '<div class="decidr-next-step-item" '
      + 'data-entity-type="' + UI.escapeHtml(entityType) + '" '
      + 'data-entity-id="' + UI.escapeHtml(item.entityId || item.id || '') + '"'
      + animStyle + '>'
      + '<div class="decidr-next-step-icon">' + entityIcon(entityType) + '</div>'
      + '<div class="decidr-next-step-body">'
      + '<div class="decidr-next-step-header">'
      + '<span class="decidr-next-step-type-label">' + UI.escapeHtml(typeLabel) + '</span>'
      + actionBadgeHtml
      + '</div>'
      + '<div class="decidr-next-step-title">' + UI.escapeHtml(item.title) + '</div>'
      + subtitleHtml
      + '</div>'
      + '</div>';
  };

  // ─── Skeleton Loading Components ───────────────────────────────────

  UI.nextStepCardSkeleton = function(opts) {
    var o = opts || {};
    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';
    return '<div class="decidr-next-step-item decidr-skeleton"' + animStyle + '>'
      + '<div class="decidr-next-step-icon"><div class="decidr-skeleton-box" style="width:20px;height:20px;border-radius:4px;"></div></div>'
      + '<div class="decidr-next-step-body">'
      + '<div class="decidr-skeleton-box" style="width:60%;height:13px;margin-bottom:6px;border-radius:4px;"></div>'
      + '<div class="decidr-skeleton-box" style="width:80%;height:14px;margin-bottom:4px;border-radius:4px;"></div>'
      + '<div class="decidr-skeleton-box" style="width:40%;height:11px;border-radius:4px;"></div>'
      + '</div></div>';
  };

  // ─── Health Bar Components ────────────────────────────────────────

  UI.healthBar = function(score, opts) {
    var o = opts || {};
    var size = o.size || 'sm';
    var fillClass = 'decidr-health-fill';
    if (score >= 70) {
      fillClass += ' decidr-health-fill-good';
    } else if (score >= 40) {
      fillClass += ' decidr-health-fill-warn';
    } else {
      fillClass += ' decidr-health-fill-bad';
    }

    var labelHtml = o.label
      ? '<span class="decidr-health-label">' + UI.escapeHtml(o.label) + '</span>'
      : '';

    var scoreHtml = '<span class="decidr-health-score">' + Math.round(score) + '</span>';

    return '<div class="decidr-health-bar decidr-health-bar-' + size + '">'
      + labelHtml
      + '<div class="decidr-health-track">'
      + '<div class="' + fillClass + '" style="width: '
        + Math.min(100, Math.max(0, score)) + '%;"></div>'
      + '</div>'
      + scoreHtml
      + '</div>';
  };

  UI.decisionHealthBar = function(decsByStatus, opts) {
    var o = opts || {};
    var sizeClass = o.size === 'sm' ? ' decidr-decision-health-sm' : '';
    var cfg = DECISION_STATUS_CONFIG;
    var total = 0;
    var k;

    for (k in decsByStatus) {
      if (decsByStatus.hasOwnProperty(k)) {
        total += decsByStatus[k];
      }
    }

    if (total === 0) {
      return '<div class="decidr-decision-health' + sizeClass + '"></div>';
    }

    var barHtml = '<div class="decidr-decision-health' + sizeClass + '">';
    for (var i = 0; i < cfg.order.length; i++) {
      var s = cfg.order[i];
      // Match against both lowercase key and uppercase enum
      var count = decsByStatus[s] || decsByStatus[s.toUpperCase()] || 0;
      if (count > 0) {
        var pct = (count / total) * 100;
        var color = cfg.colors[s] || '#6b7280';
        barHtml += '<div class="decidr-health-segment" style="width:'
          + pct.toFixed(1) + '%;background:' + color + ';"></div>';
      }
    }
    barHtml += '</div>';

    return barHtml;
  };

  // ─── Decision Health Legend ────────────────────────────────────────

  UI.decisionHealthLegend = function(decsByStatus) {
    var cfg = DECISION_STATUS_CONFIG;
    var html = '<div class="decidr-decision-health-legend">';
    for (var i = 0; i < cfg.order.length; i++) {
      var s = cfg.order[i];
      var count = (decsByStatus || {})[s] || (decsByStatus || {})[s.toUpperCase()] || 0;
      if (count > 0) {
        var color = cfg.colors[s] || '#6b7280';
        var label = cfg.labels[s] || s;
        html += '<span class="decidr-decision-health-legend-item">'
          + '<span class="decidr-decision-health-legend-dot" style="background:' + color + ';"></span>'
          + count + ' ' + UI.escapeHtml(label)
          + '</span>';
      }
    }
    html += '</div>';
    return html;
  };

  // ─── Decision List Item ──────────────────────────────────────────

  UI.decisionListItem = function(decision, opts) {
    var o = opts || {};
    var ago = UI.timeAgo(decision.createdAt);
    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var allDecisions = o.allDecisions || [];
    var supersededDec = null;
    if (decision.supersededById) {
      for (var i = 0; i < allDecisions.length; i++) {
        if (allDecisions[i].id === decision.supersededById) {
          supersededDec = allDecisions[i];
          break;
        }
      }
    }
    var supersedesBadge = supersededDec
      ? ' <span class="decidr-decision-item-supersedes-badge">Supersedes</span>' : '';

    var html = '<div class="decidr-decision-item" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(decision.id) + '"' + animStyle + '>'
      + '<div class="decidr-decision-item-body">'
      + '<div class="decidr-decision-item-title">' + UI.escapeHtml(decision.title) + '</div>'
      + '<div class="decidr-decision-item-meta">' + UI.escapeHtml(ago) + '</div>'
      + '</div>'
      + UI.statusBadge(decision.status)
      + supersedesBadge
      + '</div>';

    if (supersededDec) {
      var supersededAgo = UI.timeAgo(supersededDec.createdAt);
      var childDelay = typeof o.animDelay === 'number' ? o.animDelay + 0.03 : undefined;
      var childAnimStyle = childDelay !== undefined
        ? ' style="animation-delay: ' + childDelay.toFixed(2) + 's;"' : '';

      var prevStatusHtml = supersededDec.statusBeforeSupersession
        ? ' <span style="font-size:10px;color:var(--text-tertiary);font-style:italic;">was '
          + UI.escapeHtml(statusLabel(supersededDec.statusBeforeSupersession))
          + '</span>' : '';

      html += '<div class="decidr-decision-item decidr-decision-item-superseded" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(supersededDec.id) + '"' + childAnimStyle + '>'
        + '<div class="decidr-decision-item-body">'
        + '<div class="decidr-decision-item-superseded-indicator">\u21b3 Superseded</div>'
        + '<div class="decidr-decision-item-title">' + UI.escapeHtml(supersededDec.title) + '</div>'
        + '<div class="decidr-decision-item-meta">' + UI.escapeHtml(supersededAgo) + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">'
        + UI.statusBadge(supersededDec.status)
        + prevStatusHtml
        + '</div>'
        + '</div>';
    }

    return html;
  };

  // ─── Pending Item ────────────────────────────────────────────────

  UI.pendingItem = function(decision, opts) {
    var o = opts || {};
    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';
    var projectName = o.projectName || '';

    return '<div class="decidr-pending-item" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(decision.id) + '"' + animStyle + '>'
      + '<span class="decidr-pending-item-dot"></span>'
      + '<div class="decidr-pending-item-body">'
      + '<div class="decidr-pending-item-title">' + UI.escapeHtml(decision.title) + '</div>'
      + (projectName ? '<div class="decidr-pending-item-project">' + UI.escapeHtml(projectName) + '</div>' : '')
      + '</div>'
      + UI.statusBadge(decision.status)
      + '</div>';
  };

  // ─── Stat Components ──────────────────────────────────────────────

  UI.statCard = function(value, label, opts) {
    var o = opts || {};
    var styleStr = '';
    if (typeof o.animDelay === 'number') {
      styleStr = ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"';
    }
    var displayValue = String(value) + (o.suffix || '');

    return '<div class="decidr-stat-card"' + styleStr + '>'
      + '<div class="decidr-stat-value">' + UI.escapeHtml(displayValue) + '</div>'
      + '<div class="decidr-stat-label">' + UI.escapeHtml(label) + '</div>'
      + '</div>';
  };

  UI.statsRow = function(cards) {
    if (!cards || cards.length === 0) return '';
    var html = '<div class="decidr-stats-row">';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += UI.statCard(c.value, c.label, c.opts || {});
    }
    html += '</div>';
    return html;
  };

  // ─── Layout Components ────────────────────────────────────────────

  var SECTION_ICONS = {
    calendar: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5" y1="1.5" x2="5" y2="4.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/></svg>',
    decision: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>',
    approval: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l2 2 4-4"/><circle cx="8" cy="8" r="6"/></svg>'
  };

  // UI.section(title, count, content) — backward-compatible
  // UI.section(icon, title, count, content) — with icon
  UI.section = function(a, b, c, d) {
    var icon, title, count, content;
    if (typeof b === 'string') {
      // Called with icon: section(icon, title, count, content)
      icon = a; title = b; count = c; content = d;
    } else {
      // Called without icon: section(title, count, content)
      icon = null; title = a; count = b; content = c;
    }
    var iconHtml = icon && SECTION_ICONS[icon]
      ? '<span class="decidr-section-icon">' + SECTION_ICONS[icon] + '</span>'
      : '';
    var countHtml = (count !== null && count !== undefined)
      ? ' <span class="decidr-section-count">(' + count + ')</span>'
      : '';
    return '<div class="decidr-section">'
      + '<div class="decidr-section-header">'
      + iconHtml + UI.escapeHtml(title) + countHtml
      + '</div>'
      + '<div class="decidr-section-content">'
      + (content || '')
      + '</div>'
      + '</div>';
  };

  UI.emptyState = function(message) {
    return '<div class="decidr-empty-state">'
      + '<p class="decidr-empty-message">' + UI.escapeHtml(message) + '</p>'
      + '</div>';
  };

  UI.loadingSpinner = function(message) {
    var msgHtml = message
      ? '<span class="decidr-glass-loader-text">' + UI.escapeHtml(message) + '</span>'
      : '';
    return '<div class="decidr-glass-pane">'
      + '<div class="decidr-glass-glow-tl"></div>'
      + '<div class="decidr-glass-glow-br"></div>'
      + msgHtml
      + '</div>';
  };

  // ─── Slide-Out Panel System ───────────────────────────────────────

  UI.SlideOut = {
    _stack: [],
    _overlay: null,
    _onCloseCallback: null,
    _onMutateCallback: null,
    _busy: false,

    open: function(type, id, opts) {
      type = (type || '').toLowerCase();
      var o = opts || {};

      // Store onClose callback only when opening root panel
      if (UI.SlideOut._stack.length === 0 && o.onClose) {
        UI.SlideOut._onCloseCallback = o.onClose;
      }
      if (UI.SlideOut._stack.length === 0 && o.onMutate) {
        UI.SlideOut._onMutateCallback = o.onMutate;
      }

      // If preloaded data is provided, push and render immediately
      if (o.data) {
        UI.SlideOut._stack.push({ type: type, id: id, data: o.data });
        UI.SlideOut._render();
        return;
      }

      // Push a loading state and render
      UI.SlideOut._stack.push({ type: type, id: id, data: null });
      UI.SlideOut._render();

      // Fetch from API
      var API = window.__decidrAPI;
      if (!API) return;

      var fetchFn = null;
      if (type === 'project' || type === 'project-timeline') fetchFn = API.getProject;
      else if (type === 'decision' || type === 'decision-timeline') fetchFn = API.getDecision;
      else if (type === 'task') fetchFn = API.getTask;
      else if (type === 'bridge') fetchFn = API.getBridge;
      else if (type === 'initiative') fetchFn = API.getInitiative;

      if (fetchFn) {
        fetchFn(id).then(function(data) {
          // Update the top of stack with fetched data
          var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
          if (top && top.id === id && top.type === type) {
            top.data = data;
            // Don't render yet — wait for enrichment to complete
            // so the glass loader stays visible until everything is ready
            UI.SlideOut._enrichAndRender(type, id, data);
          }
        }).catch(function(err) {
          // Render error state with debug info
          console.error('[decidr] SlideOut fetch failed:', err);
          console.error('[decidr] API baseUrl:', window.__decidrAPI ? window.__decidrAPI._baseUrl : 'NO API');
          console.error('[decidr] API token:', window.__decidrAPI ? (window.__decidrAPI._hasToken ? 'present' : 'EMPTY') : 'NO API');
          var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
          if (top && top.id === id && top.type === type) {
            top.data = { _error: true, _errorMsg: String(err.message || err) };
            UI.SlideOut._render();
          }
        });
      }
    },

    _render: function() {
      if (UI.SlideOut._stack.length === 0) return;
      var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
      var els = UI.SlideOut._ensureDOM();

      // Header
      var hasStack = UI.SlideOut._stack.length > 1;
      var backLabel = hasStack ? 'Back' : 'Close';
      var backSvg = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" '
        + 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" '
        + 'stroke-linejoin="round"><path d="M10 3l-5 5 5 5"/></svg>';

      var typeLabels = {
        project: 'Project', decision: 'Decision',
        task: 'Task', bridge: 'Bridge', initiative: 'Initiative',
        'project-timeline': 'Timeline', 'decision-timeline': 'Timeline'
      };

      var headerHtml = '<div class="decidr-so-header-row">'
        + '<button class="decidr-so-btn-back" id="decidr-so-btn-back" title="' + backLabel + '">'
        + backSvg + '</button>'
        + '<span class="decidr-so-type-badge decidr-so-type-' + UI.escapeHtml(top.type) + '">'
        + UI.escapeHtml(typeLabels[top.type] || top.type)
        + '</span>'
        + '<span class="decidr-so-title">'
        + UI.escapeHtml(UI.SlideOut._getTitle(top))
        + '</span>'
        + '</div>';

      els.header.innerHTML = headerHtml;

      // Content — glass loader stays until primary + enrichment data are both ready
      var contentHtml;
      if (!top.data || (!top.data._error && !top.data._enrichmentDone)) {
        contentHtml = UI.loadingSpinner('Loading ' + (typeLabels[top.type] || '') + '...');
      } else if (top.data._error) {
        contentHtml = UI.emptyState('Failed to load data: ' + (top.data._errorMsg || 'Unknown error'));
      } else {
        contentHtml = UI.SlideOut._renderDetail(top.type, top.data);
      }
      els.content.innerHTML = contentHtml;

      // Wire events
      UI.SlideOut._wirePanel(els.panel);

      // Show
      els.overlay.style.display = 'block';
      els.panel.style.display = 'flex';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          els.overlay.classList.add('decidr-so-open');
          els.panel.classList.add('decidr-so-open');
        });
      });
    },

    _getTitle: function(entry) {
      if (!entry.data) return '...';
      if (entry.data._error) return 'Error';
      if (entry.type === 'project-timeline') return 'Project Timeline';
      if (entry.type === 'decision-timeline') return 'Decision Timeline';
      var d = entry.data;
      return d.name || d.title || d.id || '';
    },

    _detailRenderers: {
      project: function(data) { return UI.slideOutProject(data); },
      decision: function(data) { return UI.slideOutDecision(data); },
      task: function(data) { return UI.slideOutTask(data); },
      bridge: function(data) { return UI.slideOutBridge(data); },
      initiative: function(data) { return UI.slideOutInitiative(data); },
      'project-timeline': function(data) { return UI.slideOutTimeline(data, 'project'); },
      'decision-timeline': function(data) { return UI.slideOutTimeline(data, 'decision'); }
    },

    _renderDetail: function(type, data) {
      var renderer = UI.SlideOut._detailRenderers[type];
      if (renderer) return renderer(data);
      return UI.emptyState('Unknown entity type: ' + UI.escapeHtml(type));
    },

    // ─── Enrichment Infrastructure ──────────────────────────────────

    _enrichAndRender: function(type, id, data) {
      // Phase 1: already rendered with primary data
      data._enriched = {};

      // Phase 2: determine needed fetches
      var fetches = UI.SlideOut._getEnrichmentFetches(type, id, data);
      if (fetches.length === 0) {
        data._enrichmentDone = true;
        UI.SlideOut._render();
        return;
      }

      var keys = [];
      var promises = [];
      for (var i = 0; i < fetches.length; i++) {
        keys.push(fetches[i].key);
        promises.push(fetches[i].promise);
      }

      Promise.all(promises.map(function(p) {
        return p.catch(function(err) {
          console.warn('[decidr] Enrichment fetch failed:', err);
          return null;
        });
      })).then(function(results) {
        // Stale guard
        var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
        if (!top || top.type !== type || top.id !== id) return;

        for (var i = 0; i < keys.length; i++) {
          if (results[i] != null) {
            top.data._enriched[keys[i]] = results[i];
          }
        }
        top.data._enrichmentDone = true;
        UI.SlideOut._render();
      });
    },

    // Guard for write operations — prevents double-submit.
    // Returns true if busy (caller should abort). Sets busy flag if not.
    _guardBusy: function() {
      if (UI.SlideOut._busy) return true;
      UI.SlideOut._busy = true;
      return false;
    },

    // Re-fetch the current entity from API and re-render with enrichment.
    // Use after any write operation (create task, post comment, link doc, etc.)
    // Clears _busy flag on completion.
    _refetchAndRender: function() {
      var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
      if (!top) { UI.SlideOut._busy = false; return; }
      var API = window.__decidrAPI;
      if (!API) { UI.SlideOut._busy = false; return; }

      var type = top.type;
      var id = top.id;

      API.getEntity(type, id).then(function(freshData) {
        UI.SlideOut._busy = false;
        var current = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
        if (!current || current.type !== type || current.id !== id) return;
        current.data = freshData;
        UI.SlideOut._render();
        UI.SlideOut._enrichAndRender(type, id, freshData);
        if (UI.SlideOut._onMutateCallback) {
          try { UI.SlideOut._onMutateCallback(type, id); } catch(e) { console.error('[decidr] onMutate callback error:', e); }
        }
      }).catch(function(err) {
        UI.SlideOut._busy = false;
        console.error('[decidr] Refetch failed:', err);
      });
    },

    _getEnrichmentFetches: function(type, id, data) {
      var API = window.__decidrAPI;
      if (!API) return [];
      var fetches = [];

      if (type === 'decision') {
        // Parent entity
        if (data.projectId) {
          fetches.push({ key: 'parentEntity', promise: API.getProject(data.projectId) });
        } else if (data.bridgeId) {
          fetches.push({ key: 'parentEntity', promise: API.getBridge(data.bridgeId) });
        } else if (data.initiativeId) {
          fetches.push({ key: 'parentEntity', promise: API.getInitiative(data.initiativeId) });
        }
        // Timeline
        fetches.push({ key: 'timeline', promise: API.getTimeline({ decisionId: id, take: 20 }) });
        // Superseding decision
        if (data.supersededById) {
          fetches.push({ key: 'supersedingDecision', promise: API.getDecision(data.supersededById) });
        }
        // Parent decision
        if (data.parentId) {
          fetches.push({ key: 'parentDecision', promise: API.getDecision(data.parentId) });
        }
      } else if (type === 'project') {
        fetches.push({ key: 'decisions', promise: API.listDecisions({ projectId: id }) });
        fetches.push({ key: 'tasks', promise: API.listTasks({ projectId: id }) });
        fetches.push({ key: 'bridges', promise: API.listBridges({ projectId: id }) });
        fetches.push({ key: 'timeline', promise: API.getTimeline({ projectId: id, take: 20 }) });
        if (data.initiativeId) {
          fetches.push({ key: 'initiative', promise: API.getInitiative(data.initiativeId) });
        }
      } else if (type === 'task') {
        if (data.decisionId && !data.decision) {
          fetches.push({ key: 'parentDecision', promise: API.getDecision(data.decisionId) });
        }
        if (data.projectId && !data.project) {
          fetches.push({ key: 'parentProject', promise: API.getProject(data.projectId) });
        }
      } else if (type === 'bridge') {
        fetches.push({ key: 'timeline', promise: API.getTimeline({ bridgeId: id, take: 20 }) });
      } else if (type === 'initiative') {
        fetches.push({ key: 'projects', promise: API.listProjects({ initiativeId: id }) });
        fetches.push({ key: 'decisions', promise: API.listDecisions({ initiativeId: id }) });
      } else if (type === 'project-timeline') {
        fetches.push({ key: 'timeline', promise: API.getTimeline({ projectId: id, take: 100 }) });
      } else if (type === 'decision-timeline') {
        fetches.push({ key: 'timeline', promise: API.getTimeline({ decisionId: id, take: 100 }) });
      }

      return fetches;
    },

    // ─── Shared Rendering Helpers ──────────────────────────────────

    _renderParentLink: function(icon, label, entityType, entity) {
      if (!entity) return '';
      return '<div class="decidr-so-parent-link">'
        + '<span class="decidr-so-parent-icon">' + icon + '</span>'
        + '<span class="decidr-so-parent-label">' + UI.escapeHtml(label) + ':</span> '
        + '<a class="decidr-so-nav-link" data-entity-type="' + UI.escapeHtml(entityType) + '" '
        + 'data-entity-id="' + UI.escapeHtml(entity.id) + '">'
        + UI.escapeHtml(entity.name || entity.title) + '</a>'
        + '</div>';
    },

    _renderMeta: function(items) {
      if (!items || items.length === 0) return '';
      var html = '<div class="decidr-so-meta">';
      for (var i = 0; i < items.length; i++) {
        html += '<span class="decidr-so-meta-item">' + items[i].html + '</span>';
      }
      html += '</div>';
      return html;
    },

    _renderProgressBar: function(done, total) {
      if (total === 0) return '';
      var pct = Math.round((done / total) * 100);
      var fillClass = pct === 100 ? ' decidr-so-progress-fill-done' : '';
      return '<div class="decidr-so-progress-wrap">'
        + '<div class="decidr-so-progress-bar-inner">'
        + '<div class="decidr-so-progress-fill' + fillClass + '" style="width:' + pct + '%;"></div>'
        + '</div>'
        + '<span class="decidr-so-progress-label">' + done + '/' + total + ' (' + pct + '%)</span>'
        + '</div>';
    },

    _renderTimeline: function(timelineData, filterState, opts) {
      var o = opts || {};
      var events = [];
      if (timelineData && timelineData.data) {
        events = timelineData.data;
      } else if (Array.isArray(timelineData)) {
        events = timelineData;
      }
      if (events.length === 0 && !o.showEmpty) return '';

      var filterPrefix = o.filterPrefix || 'timeline';
      var filters = ['all', 'status', 'reviews', 'docs', 'tasks', 'comments', 'bridges'];
      var filterLabels = { all: 'All', status: 'Status', comments: 'Comments', tasks: 'Tasks', docs: 'Docs', reviews: 'Reviews', bridges: 'Bridges' };
      var activeFilter = filterState || 'all';

      // Filter events
      var filtered = [];
      for (var i = 0; i < events.length; i++) {
        var evt = events[i];
        if (activeFilter === 'all') { filtered.push(evt); continue; }
        var action = (evt.action || '').toUpperCase();
        if (activeFilter === 'status' && action === 'STATUS_CHANGED') filtered.push(evt);
        else if (activeFilter === 'comments' && action === 'COMMENTED') filtered.push(evt);
        else if (activeFilter === 'tasks' && (action === 'CREATED' || action === 'UPDATED') && evt.taskId) filtered.push(evt);
        else if (activeFilter === 'docs' && action === 'LINKED') filtered.push(evt);
        else if (activeFilter === 'reviews' && (action === 'REVIEWER_ADDED' || action === 'APPROVED')) filtered.push(evt);
        else if (activeFilter === 'bridges' && (action === 'BRIDGE_LINKED' || action === 'BRIDGE_CREATED' || (action === 'TRANSITIONED' && evt.bridgeId))) filtered.push(evt);
      }

      var limit = o.limit || 10;
      var limited = filtered.slice(0, limit);

      var html = '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Activity', events.length);

      // Filter chips
      html += '<div class="decidr-so-timeline-filters">';
      for (var f = 0; f < filters.length; f++) {
        var isActive = filters[f] === activeFilter;
        html += '<button class="decidr-so-timeline-chip' + (isActive ? ' active' : '') + '" '
          + 'data-' + filterPrefix + '-filter="' + filters[f] + '">'
          + (filterLabels[filters[f]] || filters[f])
          + '</button>';
      }
      html += '</div>';

      if (limited.length === 0) {
        html += '<div class="decidr-so-timeline-empty">No activity yet</div>';
      } else {
        html += '<div class="decidr-so-timeline-list">';
        for (var e = 0; e < limited.length; e++) {
          html += UI.SlideOut._renderTimelineEntry(limited[e], o.parentType, o.parentId);
        }
        html += '</div>';
      }

      html += '</div>';
      return html;
    },

    _timelineActionType: function(action) {
      var map = {
        CREATED: 'status', APPROVED: 'status', STATUS_CHANGED: 'status',
        TRANSITIONED: 'status', RESTORED: 'status', ARCHIVED: 'status',
        REVIEWER_ADDED: 'review',
        LINKED: 'doc',
        COMMENTED: 'comment',
        BRIDGE_LINKED: 'bridge', BRIDGE_CREATED: 'bridge'
      };
      return map[action] || 'status';
    },

    _timelineTypeLabels: {
      status: 'STATUS', review: 'REVIEW', doc: 'DOC',
      task: 'TASK', comment: 'COMMENT', bridge: 'BRIDGE'
    },

    _renderTimelineEntry: function(evt, parentType, parentId) {
      var actionType = UI.SlideOut._timelineActionType(evt.action);
      // Override for task-related events
      if (evt.taskId && (evt.action === 'CREATED' || evt.action === 'UPDATED')) {
        actionType = 'task';
      }
      var typeLabel = UI.SlideOut._timelineTypeLabels[actionType] || 'STATUS';
      var typeClass = ' decidr-so-timeline-type-' + actionType;

      var actionConfig = {
        CREATED:        { svg: '<circle cx="10" cy="10" r="4" fill="currentColor"/>' },
        STATUS_CHANGED: { svg: '<path d="M6 10h8M12 7l3 3-3 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
        COMMENTED:      { svg: '<path d="M6 7h8v5a1 1 0 01-1 1H9l-2 2v-2H7a1 1 0 01-1-1V7z" stroke="currentColor" stroke-width="1.3" fill="none"/>' },
        LINKED:         { svg: '<rect x="6" y="5" width="8" height="10" rx="1" stroke="currentColor" stroke-width="1.3" fill="none"/><line x1="8" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1"/><line x1="8" y1="10.5" x2="12" y2="10.5" stroke="currentColor" stroke-width="1"/>' },
        UPDATED:        { svg: '<path d="M7 13l2-2 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>' },
        ARCHIVED:       { svg: '<rect x="5" y="7" width="10" height="7" rx="1" stroke="currentColor" stroke-width="1.3" fill="none"/><line x1="5" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1"/>' },
        RESTORED:       { svg: '<path d="M8 7l-3 3 3 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10h7a3 3 0 010 6H10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>' },
        REVIEWER_ADDED: { svg: '<circle cx="10" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5.5 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>' },
        APPROVED:       { svg: '<path d="M6.5 10l2.5 2.5 5-5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
        BRIDGE_LINKED:  { svg: '<path d="M6 10h8M8 7.5L6 10l2 2.5M12 7.5l2 2.5-2 2.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
        BRIDGE_CREATED: { svg: '<path d="M6 10h8M8 7.5L6 10l2 2.5M12 7.5l2 2.5-2 2.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
        TRANSITIONED:   { svg: '<path d="M6 10h8M12 7l3 3-3 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' }
      };
      var cfg = actionConfig[evt.action] || { svg: '<circle cx="10" cy="10" r="3" fill="currentColor"/>' };
      var actor = (evt.actor && evt.actor.name) ? evt.actor : { name: (evt.actorId ? evt.actorId.slice(0, 8) : 'System') };

      // Determine clickable entity — skip if it points to the panel we're already viewing
      var navAttrs = '';
      var navType = '';
      var navId = '';
      if (evt.taskId) {
        navType = 'task'; navId = evt.taskId;
      } else if (evt.bridgeId) {
        navType = 'bridge'; navId = evt.bridgeId;
      } else if (evt.decisionId) {
        navType = 'decision'; navId = evt.decisionId;
      } else if (evt.projectId) {
        navType = 'project'; navId = evt.projectId;
      }
      // Only add nav attrs if linking to a different entity
      if (navType && navId && !(navType === parentType && navId === parentId)) {
        navAttrs = ' data-entity-type="' + navType + '" data-entity-id="' + UI.escapeHtml(navId) + '" style="cursor:pointer;"';
      }

      // Build breadcrumb from event metadata
      var breadcrumb = '';
      if (evt.metadata) {
        var parts = [];
        if (evt.metadata.projectName) parts.push(UI.escapeHtml(evt.metadata.projectName));
        if (evt.metadata.bridgeName) parts.push(UI.escapeHtml(evt.metadata.bridgeName));
        if (evt.metadata.decisionTitle) {
          var title = evt.metadata.decisionTitle;
          parts.push(UI.escapeHtml(title.length > 30 ? title.substring(0, 30) + '\u2026' : title));
        }
        if (parts.length > 0) {
          breadcrumb = '<div class="decidr-so-timeline-breadcrumb">'
            + parts.join(' <span class="decidr-so-timeline-breadcrumb-sep">\u203a</span> ')
            + '</div>';
        }
      }

      return '<div class="decidr-so-timeline-entry' + typeClass + '"' + navAttrs + '>'
        + '<div class="decidr-so-timeline-icon">'
        + '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' + cfg.svg + '</svg>'
        + '</div>'
        + '<div class="decidr-so-timeline-content">'
        + '<div class="decidr-so-timeline-header">'
        + '<span class="decidr-so-timeline-actor">' + UI.escapeHtml(actor.name) + '</span>'
        + '<span class="decidr-so-timeline-time">' + UI.timeAgo(evt.createdAt) + '</span>'
        + '<span class="decidr-so-timeline-action-pill decidr-so-timeline-pill-' + actionType + '">' + UI.escapeHtml(typeLabel) + '</span>'
        + '</div>'
        + (evt.description ? '<div class="decidr-so-timeline-desc">' + UI.escapeHtml(evt.description) + '</div>' : '')
        + breadcrumb
        + '</div>'
        + '</div>';
    },

    _renderSupersessionBanner: function(data) {
      var html = '';
      if (data.supersededById) {
        var superseding = (data._enriched && data._enriched.supersedingDecision) || null;
        var supersedingTitle = superseding ? superseding.title : data.supersededById;
        var prevStatusText = data.statusBeforeSupersession
          ? ' (was ' + (STATUS_LABELS[data.statusBeforeSupersession] || data.statusBeforeSupersession) + ')'
          : '';
        html += '<div class="decidr-so-superseded-banner">'
          + '<span class="decidr-so-superseded-icon">&#x26A0;</span>'
          + '<span>This decision has been superseded' + UI.escapeHtml(prevStatusText) + ' by </span>'
          + '<a class="decidr-so-nav-link" data-entity-type="decision" '
          + 'data-entity-id="' + UI.escapeHtml(data.supersededById) + '">'
          + UI.escapeHtml(supersedingTitle) + '</a>'
          + ' <button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-undo-supersede">Undo Supersession</button>'
          + '</div>';
      }
      if (data.supersedes && data.supersedes.length > 0) {
        for (var s = 0; s < data.supersedes.length; s++) {
          var old = data.supersedes[s];
          html += '<div class="decidr-so-supersedes-note">'
            + '<span>Supersedes: </span>'
            + '<a class="decidr-so-nav-link" data-entity-type="decision" '
            + 'data-entity-id="' + UI.escapeHtml(old.id) + '">'
            + UI.escapeHtml(old.title || old.id) + '</a>'
            + '</div>';
        }
      }
      return html;
    },

    _renderSectionHeader: function(title, count) {
      var countHtml = (count != null) ? ' <span class="decidr-so-section-count">(' + count + ')</span>' : '';
      return '<div class="decidr-so-section-title">' + UI.escapeHtml(title) + countHtml + '</div>';
    },

    _renderEntityList: function(items, entityType, opts) {
      var o = opts || {};
      if (!items || items.length === 0) {
        return o.emptyText ? '<div class="decidr-so-empty-hint">' + UI.escapeHtml(o.emptyText) + '</div>' : '';
      }
      var html = '<div class="decidr-so-list">';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var title = item.title || item.name || item.id;
        html += '<div class="decidr-so-list-item" data-entity-type="' + UI.escapeHtml(entityType) + '" '
          + 'data-entity-id="' + UI.escapeHtml(item.id) + '" style="cursor:pointer;">'
          + '<span class="decidr-so-list-title">' + UI.escapeHtml(title) + '</span>'
          + UI.statusBadge(item.status)
          + '</div>';
      }
      html += '</div>';
      return html;
    },

    // Panel state objects for stateful interactions
    _decisionPanelState: {
      editMode: false,
      addTaskFormOpen: false,
      addDocFormOpen: false,
      docFormTab: 'search',
      assignDropdownOpen: false,
      timelineFilter: 'all',
      supersedeFormOpen: false
    },

    _taskPanelState: {
      editMode: false,
      statusDropdownOpen: false,
      addDocFormOpen: false,
      docFormTab: 'search'
    },

    _projectPanelState: {
      timelineFilter: 'all',
      addDocFormOpen: false,
      docFormTab: 'search'
    },

    _bridgePanelState: {
      statusDropdownOpen: false,
      addDocFormOpen: false,
      docFormTab: 'search'
    },

    _initiativePanelState: {
      addDocFormOpen: false,
      docFormTab: 'search'
    },

    // ─── Detail Renderers (delegated to UI.slideOutX functions) ─────

    back: function() {
      UI.SlideOut._stack.pop();
      if (UI.SlideOut._stack.length === 0) {
        UI.SlideOut.close();
      } else {
        UI.SlideOut._render();
      }
    },

    close: function() {
      UI.SlideOut._stack = [];
      var els = UI.SlideOut._ensureDOM();
      els.overlay.classList.remove('decidr-so-open');
      els.panel.classList.remove('decidr-so-open');
      var callback = UI.SlideOut._onCloseCallback;
      UI.SlideOut._onCloseCallback = null;
      UI.SlideOut._onMutateCallback = null;
      setTimeout(function() {
        els.overlay.style.display = 'none';
        els.panel.style.display = 'none';
        if (callback) callback();
      }, 300);
    },

    _ensureDOM: function() {
      var overlay = document.querySelector('.decidr-so-overlay');
      var panel = document.querySelector('.decidr-so-panel');

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'decidr-so-overlay';
        overlay.addEventListener('click', function() {
          UI.SlideOut.close();
        });
        document.body.appendChild(overlay);
        UI.SlideOut._overlay = overlay;
      }

      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'decidr-so-panel';

        var header = document.createElement('div');
        header.className = 'decidr-so-header';

        var content = document.createElement('div');
        content.className = 'decidr-so-content';

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // Escape key handler
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && UI.SlideOut._stack.length > 0) {
            UI.SlideOut.close();
          }
        });
      }

      return {
        overlay: overlay,
        panel: panel,
        header: panel.querySelector('.decidr-so-header'),
        content: panel.querySelector('.decidr-so-content')
      };
    },

    _wirePanel: function(panel) {
      var API = window.__decidrAPI;

      // Back / close button
      var backBtn = panel.querySelector('#decidr-so-btn-back');
      if (backBtn) {
        backBtn.onclick = function() {
          if (UI.SlideOut._stack.length > 1) {
            UI.SlideOut.back();
          } else {
            UI.SlideOut.close();
          }
        };
      }

      // Wire all entity navigation links
      var navItems = panel.querySelectorAll('[data-entity-type][data-entity-id]');
      for (var i = 0; i < navItems.length; i++) {
        (function(el) {
          el.onclick = function(e) {
            // Don't navigate if clicking a task checkbox
            if (e.target.hasAttribute('data-task-toggle')) return;
            e.preventDefault();
            e.stopPropagation();
            var entityType = el.getAttribute('data-entity-type');
            var entityId = el.getAttribute('data-entity-id');
            if (entityType && entityId) {
              UI.SlideOut.open(entityType, entityId);
            }
          };
        })(navItems[i]);
      }

      // Get current entity context
      var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
      if (!top || !top.data || top.data._error) return;

      // --- Decision events ---
      if (top.type === 'decision') {
        UI.SlideOut._wireDecisionEvents(panel, top.id, top.data);
      }

      // --- Task events ---
      if (top.type === 'task') {
        UI.SlideOut._wireTaskEvents(panel, top.id, top.data);
      }

      // --- Project events ---
      if (top.type === 'project') {
        UI.SlideOut._wireProjectEvents(panel, top.id, top.data);
      }

      // --- Bridge events ---
      if (top.type === 'bridge') {
        UI.SlideOut._wireBridgeEvents(panel, top.id, top.data);
      }

      // --- Initiative events ---
      if (top.type === 'initiative') {
        UI.SlideOut._wireInitiativeEvents(panel, top.id, top.data);
      }

      // --- Timeline filter chips (generic, all entity types) ---
      UI.SlideOut._wireTimelineFilters(panel, top.type);
    },

    _wireEditMode: function(panel, config) {
      var state = config.state;
      var API = window.__decidrAPI;

      // Edit toggle
      var editBtn = panel.querySelector(config.editBtnId);
      if (editBtn) {
        editBtn.onclick = function() {
          state.editMode = !state.editMode;
          UI.SlideOut._render();
        };
      }

      // Save edit
      var saveBtn = panel.querySelector(config.saveBtnId);
      if (saveBtn) {
        saveBtn.onclick = function() {
          var titleInput = panel.querySelector(config.titleInputId);
          var descInput = panel.querySelector(config.descInputId);
          var updates = {};
          if (titleInput) updates.title = titleInput.value.trim();
          if (descInput) updates.description = descInput.value.trim();
          if (API && updates.title) {
            if (UI.SlideOut._guardBusy()) return;
            config.updateFn(config.entityId, updates).then(function() {
              state.editMode = false;
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Update failed:', err); });
          }
        };
      }

      // Cancel edit
      var cancelBtn = panel.querySelector(config.cancelBtnId);
      if (cancelBtn) {
        cancelBtn.onclick = function() {
          state.editMode = false;
          UI.SlideOut._render();
        };
      }
    },

    _wireDecisionEvents: function(panel, id, data) {
      var state = UI.SlideOut._decisionPanelState;
      var API = window.__decidrAPI;

      // View All Activity
      var viewAllDecBtn = panel.querySelector('#decidr-so-btn-view-all-decision-timeline');
      if (viewAllDecBtn) {
        viewAllDecBtn.onclick = function() {
          UI.SlideOut.open('decision-timeline', id);
        };
      }

      UI.SlideOut._wireEditMode(panel, {
        state: state,
        entityId: id,
        editBtnId: '#decidr-so-btn-edit',
        saveBtnId: '#decidr-so-btn-save-edit',
        cancelBtnId: '#decidr-so-btn-cancel-edit',
        titleInputId: '#decidr-so-edit-title',
        descInputId: '#decidr-so-edit-description',
        updateFn: API.updateDecision
      });

      // Status dropdown toggle
      var statusBtn = panel.querySelector('#decidr-so-btn-status');
      if (statusBtn) {
        statusBtn.onclick = function(e) {
          e.stopPropagation();
          var menu = panel.querySelector('#decidr-so-status-menu');
          if (menu) menu.classList.toggle('open');
        };
      }

      // Status transitions
      var statusOptions = panel.querySelectorAll('[data-decision-transition]');
      for (var s = 0; s < statusOptions.length; s++) {
        (function(opt) {
          opt.onclick = function(e) {
            e.stopPropagation();
            var newStatus = opt.getAttribute('data-decision-transition');
            if (API) {
              if (UI.SlideOut._guardBusy()) return;
              API.transitionDecision(id, newStatus).then(function() {
                UI.SlideOut._refetchAndRender();
              }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Transition failed:', err); });
            }
          };
        })(statusOptions[s]);
      }

      // Delete
      var deleteBtn = panel.querySelector('#decidr-so-btn-delete');
      if (deleteBtn) {
        deleteBtn.onclick = function() {
          if (!confirm('Delete this decision?')) return;
          if (API) {
            if (UI.SlideOut._guardBusy()) return;
            API.updateDecision(id, { deletedAt: new Date().toISOString() }).then(function() {
              UI.SlideOut._busy = false;
              if (UI.SlideOut._onMutateCallback) {
                try { UI.SlideOut._onMutateCallback('decision', id); } catch(e) { console.error('[decidr] onMutate callback error:', e); }
              }
              UI.SlideOut.back();
            }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Delete failed:', err); });
          }
        };
      }

      // Supersede button
      var supersedeBtn = panel.querySelector('#decidr-so-btn-supersede');
      if (supersedeBtn) {
        supersedeBtn.onclick = function() {
          state.supersedeFormOpen = !state.supersedeFormOpen;
          UI.SlideOut._render();
        };
      }

      // Save supersede
      var saveSupersedeBtn = panel.querySelector('#decidr-so-btn-save-supersede');
      if (saveSupersedeBtn) {
        saveSupersedeBtn.onclick = function() {
          var titleInput = panel.querySelector('#decidr-so-input-supersede-title');
          var rationaleInput = panel.querySelector('#decidr-so-input-supersede-rationale');
          var title = titleInput ? titleInput.value.trim() : '';
          if (!title || !API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.supersedeDecision(id, {
            title: title,
            rationale: rationaleInput ? rationaleInput.value.trim() : ''
          }).then(function(result) {
            UI.SlideOut._busy = false;
            state.supersedeFormOpen = false;
            if (result && result.id) {
              UI.SlideOut.open('decision', result.id);
            } else {
              UI.SlideOut._render();
            }
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Supersede failed:', err); });
        };
      }

      // Cancel supersede
      var cancelSupersedeBtn = panel.querySelector('#decidr-so-btn-cancel-supersede');
      if (cancelSupersedeBtn) {
        cancelSupersedeBtn.onclick = function() {
          state.supersedeFormOpen = false;
          UI.SlideOut._render();
        };
      }

      // Undo supersession
      var undoSupersedeBtn = panel.querySelector('#decidr-so-btn-undo-supersede');
      if (undoSupersedeBtn) {
        undoSupersedeBtn.onclick = function() {
          if (!API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.post('/decisions/' + id + '/unsupersede').then(function() {
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Undo supersede failed:', err); });
        };
      }

      // Task checkbox toggle
      var checkboxes = panel.querySelectorAll('[data-task-toggle]');
      for (var c = 0; c < checkboxes.length; c++) {
        (function(cb) {
          cb.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            var taskId = cb.getAttribute('data-task-toggle');
            // Find task in current data
            var tasks = data.tasks || [];
            var task = null;
            for (var t = 0; t < tasks.length; t++) {
              if (tasks[t].id === taskId) { task = tasks[t]; break; }
            }
            if (!task || !API) return;
            if (UI.SlideOut._guardBusy()) return;
            var newStatus = (task.status === 'DONE' || task.status === 'done') ? 'TODO' : 'DONE';
            API.transitionTask(taskId, newStatus).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Task toggle failed:', err); });
          };
        })(checkboxes[c]);
      }

      // Add Task form
      var addTaskBtn = panel.querySelector('#decidr-so-btn-add-task');
      if (addTaskBtn) {
        addTaskBtn.onclick = function() {
          state.addTaskFormOpen = true;
          var form = panel.querySelector('#decidr-so-form-add-task');
          if (form) form.classList.add('visible');
        };
      }
      var cancelTaskBtn = panel.querySelector('#decidr-so-btn-cancel-task');
      if (cancelTaskBtn) {
        cancelTaskBtn.onclick = function() {
          state.addTaskFormOpen = false;
          var form = panel.querySelector('#decidr-so-form-add-task');
          if (form) form.classList.remove('visible');
        };
      }
      var saveTaskBtn = panel.querySelector('#decidr-so-btn-save-task');
      if (saveTaskBtn) {
        saveTaskBtn.onclick = function() {
          var titleInput = panel.querySelector('#decidr-so-input-task-title');
          var title = titleInput ? titleInput.value.trim() : '';
          if (!title || !API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.createTask({
            title: title,
            decisionId: id,
            projectId: data.projectId || undefined
          }).then(function() {
            state.addTaskFormOpen = false;
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Create task failed:', err); });
        };
      }

      // Assign reviewer button + dropdown
      var assignBtn = panel.querySelector('#decidr-so-btn-assign-reviewers');
      if (assignBtn) {
        assignBtn.onclick = function(e) {
          e.stopPropagation();
          var dropdown = panel.querySelector('#decidr-so-reviewer-dropdown');
          if (!dropdown) return;
          var isOpen = dropdown.style.display !== 'none';
          if (isOpen) {
            dropdown.style.display = 'none';
            state.assignDropdownOpen = false;
            return;
          }
          dropdown.style.display = 'block';
          state.assignDropdownOpen = true;
          // Fetch org members
          var listEl = panel.querySelector('#decidr-so-reviewer-list');
          if (listEl && API) {
            listEl.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary);">Loading...</div>';
            API.listOrgMembers().then(function(result) {
              var members = (result && result.data) || result || [];
              if (!Array.isArray(members)) members = [];
              var html = '';
              for (var m = 0; m < members.length; m++) {
                var mem = members[m];
                html += '<div class="decidr-so-reviewer-option" data-reviewer-user-id="' + UI.escapeHtml(mem.id || mem.userId || '') + '">'
                  + UI.avatar(mem, 'sm') + ' ' + UI.escapeHtml(mem.name || mem.email || 'Unknown')
                  + '</div>';
              }
              if (html === '') html = '<div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary);">No members found</div>';
              listEl.innerHTML = html;
              // Wire click on reviewer options
              var options = listEl.querySelectorAll('[data-reviewer-user-id]');
              for (var o = 0; o < options.length; o++) {
                (function(opt) {
                  opt.onclick = function(ev) {
                    ev.stopPropagation();
                    var userId = opt.getAttribute('data-reviewer-user-id');
                    if (!userId || !API) return;
                    // Optimistic UI: immediately add chip and close dropdown
                    var memberName = opt.textContent.trim();
                    var reviewersEl = panel.querySelector('.decidr-so-reviewers');
                    if (reviewersEl) {
                      var chipHtml = '<span class="decidr-so-reviewer-chip">'
                        + UI.avatar({ name: memberName }, 'sm')
                        + ' <span>' + UI.escapeHtml(memberName) + '</span></span>';
                      var assignWrapper = reviewersEl.querySelector('[style*="position:relative"]');
                      if (assignWrapper) {
                        assignWrapper.insertAdjacentHTML('beforebegin', chipHtml);
                      }
                    }
                    var dropdown = panel.querySelector('#decidr-so-reviewer-dropdown');
                    if (dropdown) dropdown.style.display = 'none';
                    state.assignDropdownOpen = false;
                    // Fire API call in background — no busy guard needed
                    API.addReviewer(id, userId).then(function() {
                      // Silent success — chip already shown
                    }).catch(function(err) { console.error('[decidr] Add reviewer failed:', err); });
                  };
                })(options[o]);
              }
            }).catch(function(err) {
              listEl.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--color-error-text);">Failed to load</div>';
              console.error('[decidr] List org members failed:', err);
            });
          }
        };
      }

      // Approve
      var approveBtn = panel.querySelector('#decidr-so-btn-approve');
      if (approveBtn && API) {
        approveBtn.onclick = function() {
          if (UI.SlideOut._guardBusy()) return;
          API.approveDecision(id).then(function() {
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Approve failed:', err); });
        };
      }

      // Reject
      var rejectBtn = panel.querySelector('#decidr-so-btn-reject');
      if (rejectBtn && API) {
        rejectBtn.onclick = function() {
          if (UI.SlideOut._guardBusy()) return;
          API.rejectDecision(id).then(function() {
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Reject failed:', err); });
        };
      }

      // Approval count stepper
      var decBtn = panel.querySelector('#decidr-so-btn-approvals-dec');
      var incBtn = panel.querySelector('#decidr-so-btn-approvals-inc');
      var neededSpan = panel.querySelector('#decidr-so-approvals-needed');
      if (decBtn && incBtn && neededSpan) {
        function updateApprovalCount(delta) {
          var current = parseInt(neededSpan.textContent, 10) || 1;
          var next = Math.max(1, current + delta);
          if (next === current) return;
          neededSpan.textContent = next;
          var countSpan = panel.querySelector('.decidr-so-approval-count');
          if (countSpan) {
            var have = data.approvalProgress ? (data.approvalProgress.totalHave || 0) : 0;
            countSpan.textContent = have + ' / ' + next + ' approvals';
          }
          if (typeof API !== 'undefined' && API.updateDecision) {
            API.updateDecision(id, { required_approvals: next });
          }
        }
        decBtn.addEventListener('click', function() { updateApprovalCount(-1); });
        incBtn.addEventListener('click', function() { updateApprovalCount(1); });
      }

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'DECISION', id, state);

      // Comment posting
      var postCommentBtn = panel.querySelector('#decidr-so-btn-post-comment');
      if (postCommentBtn) {
        postCommentBtn.onclick = function() {
          var textarea = panel.querySelector('#decidr-so-input-comment');
          var text = textarea ? textarea.value.trim() : '';
          if (!text || !API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.post('/timeline', {
            action: 'COMMENTED',
            description: text,
            decisionId: id
          }).then(function() {
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Comment failed:', err); });
        };
      }
    },

    _wireTaskEvents: function(panel, id, data) {
      var state = UI.SlideOut._taskPanelState;
      var API = window.__decidrAPI;

      UI.SlideOut._wireEditMode(panel, {
        state: state,
        entityId: id,
        editBtnId: '#decidr-so-btn-task-edit',
        saveBtnId: '#decidr-so-btn-save-task-edit',
        cancelBtnId: '#decidr-so-btn-cancel-task-edit',
        titleInputId: '#decidr-so-edit-task-title',
        descInputId: '#decidr-so-edit-task-description',
        updateFn: API.updateTask
      });

      // Status dropdown
      var statusBtn = panel.querySelector('#decidr-so-btn-task-status');
      if (statusBtn) {
        statusBtn.onclick = function(e) {
          e.stopPropagation();
          var menu = panel.querySelector('#decidr-so-task-status-menu');
          if (menu) menu.classList.toggle('open');
        };
      }

      var statusOptions = panel.querySelectorAll('[data-task-transition]');
      for (var s = 0; s < statusOptions.length; s++) {
        (function(opt) {
          opt.onclick = function(e) {
            e.stopPropagation();
            var newStatus = opt.getAttribute('data-task-transition');
            if (API) {
              if (UI.SlideOut._guardBusy()) return;
              API.transitionTask(id, newStatus).then(function() {
                UI.SlideOut._refetchAndRender();
              }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Task transition failed:', err); });
            }
          };
        })(statusOptions[s]);
      }

      // Delete
      var deleteBtn = panel.querySelector('#decidr-so-btn-task-delete');
      if (deleteBtn) {
        deleteBtn.onclick = function() {
          if (!confirm('Delete this task?')) return;
          if (API) {
            if (UI.SlideOut._guardBusy()) return;
            API.updateTask(id, { deletedAt: new Date().toISOString() }).then(function() {
              UI.SlideOut._busy = false;
              if (UI.SlideOut._onMutateCallback) {
                try { UI.SlideOut._onMutateCallback('task', id); } catch(e) { console.error('[decidr] onMutate callback error:', e); }
              }
              UI.SlideOut.back();
            }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Delete task failed:', err); });
          }
        };
      }

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'TASK', id, state);
    },

    _wireProjectEvents: function(panel, id, data) {
      var state = UI.SlideOut._projectPanelState;
      var API = window.__decidrAPI;

      // View All Activity
      var viewAllBtn = panel.querySelector('#decidr-so-btn-view-all-project-timeline');
      if (viewAllBtn) {
        viewAllBtn.onclick = function() {
          UI.SlideOut.open('project-timeline', id);
        };
      }

      // Bridge expand/collapse
      var bridgeHeaders = panel.querySelectorAll('[data-bridge-toggle]');
      for (var i = 0; i < bridgeHeaders.length; i++) {
        (function(header) {
          header.onclick = function(e) {
            e.stopPropagation();
            var idx = header.getAttribute('data-bridge-toggle');
            var expand = panel.querySelector('#decidr-so-bridge-expand-' + idx);
            if (expand) expand.classList.toggle('open');
          };
        })(bridgeHeaders[i]);
      }

      // Task checkbox completion
      var checkboxes = panel.querySelectorAll('.decidr-so-task-checkbox');
      for (var ci = 0; ci < checkboxes.length; ci++) {
        (function(cb) {
          cb.addEventListener('click', function(e) {
            e.stopPropagation();
            var taskId = cb.getAttribute('data-task-id');
            var isDone = cb.getAttribute('data-task-done') === '1';
            if (!isDone && typeof API !== 'undefined' && API.completeTask) {
              cb.classList.add('checked');
              cb.textContent = '\u2713';
              cb.setAttribute('data-task-done', '1');
              var item = cb.closest('.decidr-so-task-item');
              if (item) item.classList.add('decidr-so-task-done');
              API.completeTask(taskId);
            }
          });
        })(checkboxes[ci]);
      }

      // Comment posting
      var postBtn = panel.querySelector('#decidr-so-btn-post-project-comment');
      if (postBtn) {
        postBtn.onclick = function() {
          var textarea = panel.querySelector('#decidr-so-input-project-comment');
          var text = textarea ? textarea.value.trim() : '';
          if (!text || !API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.post('/timeline', {
            action: 'COMMENTED',
            description: text,
            projectId: id
          }).then(function() {
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Comment failed:', err); });
        };
      }

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'PROJECT', id, state);
    },

    _wireBridgeEvents: function(panel, id, data) {
      var state = UI.SlideOut._bridgePanelState;
      var API = window.__decidrAPI;

      // Status dropdown toggle
      var statusBtn = panel.querySelector('#decidr-so-btn-bridge-status');
      if (statusBtn) {
        statusBtn.onclick = function(e) {
          e.stopPropagation();
          var menu = panel.querySelector('#decidr-so-bridge-status-menu');
          if (menu) menu.classList.toggle('open');
        };
      }

      // Status transitions
      var statusOptions = panel.querySelectorAll('[data-bridge-transition]');
      for (var s = 0; s < statusOptions.length; s++) {
        (function(opt) {
          opt.onclick = function(e) {
            e.stopPropagation();
            var newStatus = opt.getAttribute('data-bridge-transition');
            if (API) {
              if (UI.SlideOut._guardBusy()) return;
              API.transitionBridge(id, newStatus).then(function() {
                UI.SlideOut._refetchAndRender();
              }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Bridge transition failed:', err); });
            }
          };
        })(statusOptions[s]);
      }

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'BRIDGE', id, state);
    },

    _wireInitiativeEvents: function(panel, id, data) {
      var state = UI.SlideOut._initiativePanelState;

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'INITIATIVE', id, state);
    },

    // ─── Shared Document Linking Section ─────────────────────────────

    _renderDocumentSection: function(entityType, entityId, documents, state) {
      var docs = documents || [];
      var html = '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Documents', docs.length);

      // List linked documents
      if (docs.length > 0) {
        for (var d = 0; d < docs.length; d++) {
          var doc = docs[d];
          var docType = (doc.type || 'URL').toUpperCase();
          var isUrl = docType === 'URL';
          var isLudflow = docType === 'LUDFLOW';
          html += '<div class="decidr-so-doc-item">';
          if (isUrl && doc.url) {
            html += '<a href="' + UI.escapeHtml(doc.url) + '" target="_blank" rel="noopener" class="decidr-so-doc-link">'
              + UI.escapeHtml(doc.title || doc.url)
              + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
              + '</a>';
          } else if (isLudflow) {
            html += '<span class="decidr-so-doc-link decidr-so-doc-ludflow" data-ludflow-doc-id="' + UI.escapeHtml(doc.ludflowDocumentId || doc.id) + '">'
              + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> '
              + UI.escapeHtml(doc.title || 'LudFlow Document')
              + '</span>';
          } else {
            html += '<span class="decidr-so-doc-link">' + UI.escapeHtml(doc.title || 'Untitled') + '</span>';
          }
          html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(docType === 'LUDFLOW' ? 'LudFlow' : docType) + '</span>';
          html += '<button class="decidr-so-btn-unlink-doc" data-doc-unlink-id="' + UI.escapeHtml(doc.id) + '" title="Unlink document">'
            + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            + '</button>';
          html += '</div>';
        }
      } else {
        html += '<div class="decidr-so-empty-hint">No linked documents</div>';
      }

      // Quick action
      html += '<div class="decidr-so-quick-actions" style="margin-top:var(--space-2);">';
      html += '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-add-doc">+ Link Document</button>';
      html += '</div>';

      // Inline form (tabbed)
      html += '<div class="decidr-so-inline-form' + (state.addDocFormOpen ? ' visible' : '') + '" id="decidr-so-form-add-doc">';
      // Tab bar
      html += '<div class="decidr-so-tab-bar">';
      html += '<button class="decidr-so-tab' + (state.docFormTab === 'search' ? ' active' : '') + '" data-decidr-doc-tab="search">Search LudFlow</button>';
      html += '<button class="decidr-so-tab' + (state.docFormTab === 'manual' ? ' active' : '') + '" data-decidr-doc-tab="manual">Manual URL</button>';
      html += '<button class="decidr-so-tab' + (state.docFormTab === 'upload' ? ' active' : '') + '" data-decidr-doc-tab="upload">Upload</button>';
      html += '</div>';
      // Tab: Search LudFlow
      html += '<div class="decidr-so-tab-panel' + (state.docFormTab === 'search' ? ' active' : '') + '" id="decidr-so-doc-tab-search">';
      html += '<input type="text" id="decidr-so-input-doc-search" placeholder="Search LudFlow documents...">';
      html += '<div id="decidr-so-doc-search-results"></div>';
      html += '<div class="decidr-so-form-actions">'
        + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-cancel-doc">Cancel</button>'
        + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-link-search-doc">Link Selected</button>'
        + '</div>';
      html += '</div>';
      // Tab: Manual URL
      html += '<div class="decidr-so-tab-panel' + (state.docFormTab === 'manual' ? ' active' : '') + '" id="decidr-so-doc-tab-manual">';
      html += '<input type="text" id="decidr-so-input-doc-title" placeholder="Document title...">';
      html += '<input type="text" id="decidr-so-input-doc-url" placeholder="URL...">';
      html += '<div class="decidr-so-form-actions">'
        + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-cancel-doc-manual">Cancel</button>'
        + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-save-doc">Link</button>'
        + '</div>';
      html += '</div>';
      // Tab: Upload
      html += '<div class="decidr-so-tab-panel' + (state.docFormTab === 'upload' ? ' active' : '') + '" id="decidr-so-doc-tab-upload">';
      html += '<div class="decidr-so-file-input-wrap">';
      html += '<span>\u{1F4CE}</span> <span>Coming soon</span>';
      html += '</div>';
      html += '<div class="decidr-so-form-actions">'
        + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-cancel-doc-upload">Cancel</button>'
        + '</div>';
      html += '</div>';
      html += '</div>';

      // (LudFlow docs open in slide-out panel via entity navigation)

      html += '</div>';
      return html;
    },

    _wireDocumentEvents: function(panel, entityType, entityId, state) {
      var API = window.__decidrAPI;

      // "Link Document" button opens form
      var addDocBtn = panel.querySelector('#decidr-so-btn-add-doc');
      if (addDocBtn) {
        addDocBtn.onclick = function() {
          state.addDocFormOpen = true;
          var form = panel.querySelector('#decidr-so-form-add-doc');
          if (form) form.classList.add('visible');
        };
      }

      // Tab switching
      var docTabs = panel.querySelectorAll('[data-decidr-doc-tab]');
      for (var dt = 0; dt < docTabs.length; dt++) {
        (function(tab) {
          tab.onclick = function(e) {
            e.stopPropagation();
            var tabName = tab.getAttribute('data-decidr-doc-tab');
            state.docFormTab = tabName;
            var allTabs = panel.querySelectorAll('[data-decidr-doc-tab]');
            for (var at = 0; at < allTabs.length; at++) {
              allTabs[at].classList.toggle('active', allTabs[at].getAttribute('data-decidr-doc-tab') === tabName);
            }
            var panelIds = { search: 'decidr-so-doc-tab-search', manual: 'decidr-so-doc-tab-manual', upload: 'decidr-so-doc-tab-upload' };
            for (var pKey in panelIds) {
              if (panelIds.hasOwnProperty(pKey)) {
                var pEl = panel.querySelector('#' + panelIds[pKey]);
                if (pEl) pEl.classList.toggle('active', pKey === tabName);
              }
            }
          };
        })(docTabs[dt]);
      }

      // Search input (debounced)
      var docSearchInput = panel.querySelector('#decidr-so-input-doc-search');
      if (docSearchInput && API) {
        var _docSearchTimer = null;
        var _selectedDocId = null;
        var _selectedDocTitle = null;
        docSearchInput.oninput = function() {
          if (_docSearchTimer) clearTimeout(_docSearchTimer);
          _docSearchTimer = setTimeout(function() {
            var query = docSearchInput.value.trim();
            var resultsEl = panel.querySelector('#decidr-so-doc-search-results');
            if (!resultsEl) return;
            if (!query) { resultsEl.innerHTML = ''; return; }
            API.searchLudflowDocuments(query).then(function(result) {
              var docs = (result && result.data) || result || [];
              if (!Array.isArray(docs)) docs = [];
              var html = '';
              for (var d = 0; d < docs.length; d++) {
                var doc = docs[d];
                html += '<div class="decidr-so-doc-search-item" data-doc-search-id="' + UI.escapeHtml(doc.id || '') + '" data-doc-search-title="' + UI.escapeHtml(doc.title || doc.name || '') + '">'
                  + UI.escapeHtml(doc.title || doc.name || doc.id)
                  + '</div>';
              }
              if (html === '') html = '<div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary);">No results</div>';
              resultsEl.innerHTML = html;
              // Wire result selection
              var items = resultsEl.querySelectorAll('[data-doc-search-id]');
              for (var di = 0; di < items.length; di++) {
                (function(item) {
                  item.onclick = function() {
                    var siblings = resultsEl.querySelectorAll('[data-doc-search-id]');
                    for (var si = 0; si < siblings.length; si++) siblings[si].classList.remove('selected');
                    item.classList.add('selected');
                    _selectedDocId = item.getAttribute('data-doc-search-id');
                    _selectedDocTitle = item.getAttribute('data-doc-search-title');
                  };
                })(items[di]);
              }
            }).catch(function(err) {
              console.error('[decidr] Doc search failed:', err);
              var resultsEl = panel.querySelector('#decidr-so-doc-search-results');
              if (resultsEl) resultsEl.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--color-error-text);">Search failed</div>';
            });
          }, 300);
        };

        // Link selected search doc
        var linkSearchBtn = panel.querySelector('#decidr-so-btn-link-search-doc');
        if (linkSearchBtn) {
          linkSearchBtn.onclick = function() {
            if (!_selectedDocId || !API) return;
            if (UI.SlideOut._guardBusy()) return;
            API.linkEntityDocument({
              title: _selectedDocTitle || 'LudFlow Document',
              type: 'LUDFLOW',
              ludflowDocumentId: _selectedDocId,
              entityType: entityType,
              entityId: entityId
            }).then(function() {
              state.addDocFormOpen = false;
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Link search doc failed:', err); });
          };
        }
      }

      // Cancel buttons (all tabs)
      var cancelDocBtns = panel.querySelectorAll('#decidr-so-btn-cancel-doc, #decidr-so-btn-cancel-doc-manual, #decidr-so-btn-cancel-doc-upload');
      for (var cb = 0; cb < cancelDocBtns.length; cb++) {
        cancelDocBtns[cb].onclick = function() {
          state.addDocFormOpen = false;
          var form = panel.querySelector('#decidr-so-form-add-doc');
          if (form) form.classList.remove('visible');
        };
      }

      // Save doc (manual URL tab)
      var saveDocBtn = panel.querySelector('#decidr-so-btn-save-doc');
      if (saveDocBtn) {
        saveDocBtn.onclick = function() {
          var titleInput = panel.querySelector('#decidr-so-input-doc-title');
          var urlInput = panel.querySelector('#decidr-so-input-doc-url');
          var title = titleInput ? titleInput.value.trim() : '';
          var url = urlInput ? urlInput.value.trim() : '';
          if (!title || !API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.linkEntityDocument({
            title: title,
            url: url,
            type: 'URL',
            entityType: entityType,
            entityId: entityId
          }).then(function() {
            state.addDocFormOpen = false;
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Link doc failed:', err); });
        };
      }

      // Unlink buttons
      var unlinkBtns = panel.querySelectorAll('[data-doc-unlink-id]');
      for (var ub = 0; ub < unlinkBtns.length; ub++) {
        (function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var docId = btn.getAttribute('data-doc-unlink-id');
            if (!docId || !API) return;
            if (UI.SlideOut._guardBusy()) return;
            API.deleteDocument(docId).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Unlink doc failed:', err); });
          };
        })(unlinkBtns[ub]);
      }

      // LudFlow doc click — fetch content and push to companion as rich_content
      var ludflowLinks = panel.querySelectorAll('[data-ludflow-doc-id]');
      for (var lf = 0; lf < ludflowLinks.length; lf++) {
        (function(link) {
          link.onclick = function(e) {
            e.stopPropagation();
            var ludflowId = link.getAttribute('data-ludflow-doc-id');
            if (!ludflowId || !API) return;
            API.getLudflowDocument(ludflowId).then(function(doc) {
              var title = (doc && doc.title) || 'LudFlow Document';
              var body = (doc && (doc.content || doc.body)) || 'No content available';
              // Push to companion as rich_content
              fetch('http://localhost:4200/api/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  toolName: 'rich_content',
                  result: { data: { title: title, body: body } }
                })
              }).catch(function(err) {
                console.error('[decidr] Failed to push doc to companion:', err);
              });
            }).catch(function(err) {
              console.error('[decidr] Failed to fetch LudFlow doc:', err);
            });
          };
        })(ludflowLinks[lf]);
      }
    },

    _wireTimelineFilters: function(panel, entityType) {
      var stateMap = {
        decision: UI.SlideOut._decisionPanelState,
        project: UI.SlideOut._projectPanelState,
        bridge: UI.SlideOut._bridgePanelState,
        initiative: UI.SlideOut._initiativePanelState,
        'project-timeline': UI.SlideOut._projectPanelState,
        'decision-timeline': UI.SlideOut._decisionPanelState
      };
      var state = stateMap[entityType] || {};

      // Find all timeline filter chips
      var chips = panel.querySelectorAll('[data-decision-timeline-filter],[data-project-timeline-filter],[data-bridge-timeline-filter]');
      for (var i = 0; i < chips.length; i++) {
        (function(chip) {
          chip.onclick = function() {
            var filterVal = chip.getAttribute('data-decision-timeline-filter')
              || chip.getAttribute('data-project-timeline-filter')
              || chip.getAttribute('data-bridge-timeline-filter');
            if (filterVal) {
              state.timelineFilter = filterVal;
              UI.SlideOut._render();
            }
          };
        })(chips[i]);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // ENTITY-SPECIFIC SLIDE-OUT RENDERERS
  // Pure HTML-returning functions — no DOM queries, no event wiring.
  // Registered on UI so renderers can call them directly.
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Render project slide-out detail panel.
   * @param {Object} project - Project data with _enriched sub-objects
   * @returns {string} HTML string
   */
  UI.slideOutProject = function(project) {
    var state = UI.SlideOut._projectPanelState;
    var enriched = project._enriched || {};
    var html = '<div class="decidr-so-detail">';

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
    html += '<button class="decidr-so-btn decidr-so-btn-danger" id="decidr-so-btn-delete">' + ICON_TRASH + '</button>';
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
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-task-delete">Delete</button>';
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
    if (bridgeTransitions.length > 0) {
      html += '<div class="decidr-so-action-bar">';
      html += '<div class="decidr-so-status-dropdown">';
      html += '<button class="decidr-so-btn" id="decidr-so-btn-bridge-status">Status \u25BE</button>';
      html += '<div class="decidr-so-status-menu" id="decidr-so-bridge-status-menu">';
      for (var bsi = 0; bsi < bridgeTransitions.length; bsi++) {
        html += '<button class="decidr-so-status-option" data-bridge-transition="' + bridgeTransitions[bsi] + '">'
          + UI.escapeHtml(STATUS_LABELS[bridgeTransitions[bsi]] || bridgeTransitions[bsi]) + '</button>';
      }
      html += '</div></div>';
      html += '</div>';
    }

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

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

    UI.auditEventsList = function(events, opts) {
      opts = opts || {};
      var items = events || [];
      if (!items.length) {
        return opts.emptyText ? '<div class="decidr-so-empty-hint">' + UI.escapeHtml(opts.emptyText) + '</div>' : '';
    }
    var html = '<div class="decidr-so-list">';
    for (var i = 0; i < items.length; i++) {
      var event = items[i];
      var category = event.category && event.category.name ? event.category.name : event.category;
      html += '<div class="decidr-so-list-item" data-entity-type="audit_event" data-entity-id="' + UI.escapeHtml(event.id) + '" style="cursor:pointer;">';
      html += UI.statusBadge(event.status || 'OPEN');
      html += '<span class="decidr-so-list-title">' + UI.escapeHtml(event.title || 'Untitled event') + '</span>';
      if (category) {
        html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(category) + '</span>';
      }
      if (event.occurredAt) {
        html += '<span class="decidr-so-empty-hint" style="margin-left:auto;">' + UI.escapeHtml(UI.formatDate(event.occurredAt)) + '</span>';
      }
      html += '</div>';
    }
      html += '</div>';
      return html;
    };

    function formatNumber(value) {
      var number = Number(value || 0);
      if (!Number.isFinite(number)) return '0';
      return number.toLocaleString('en-US');
    }

    function formatCurrencyCents(value) {
      var cents = Number(value || 0);
      if (!Number.isFinite(cents)) cents = 0;
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2
        }).format(cents / 100);
      } catch (e) {
        return '$' + (cents / 100).toFixed(2);
      }
    }

    function hasNumber(source, key) {
      return source && typeof source[key] === 'number' && Number.isFinite(source[key]);
    }

    function billingValue(source, key, fallback) {
      return hasNumber(source, key) ? source[key] : fallback;
    }

    function billingStatusLabel(status) {
      return statusLabel(status || 'not_started');
    }

    function billingMetricCard(label, value, caption) {
      var html = '<div class="decidr-so-billing-card">';
      html += '<div class="decidr-so-billing-label">' + UI.escapeHtml(label) + '</div>';
      html += '<div class="decidr-so-billing-value">' + UI.escapeHtml(value) + '</div>';
      if (caption) {
        html += '<div class="decidr-so-billing-caption">' + UI.escapeHtml(caption) + '</div>';
      }
      html += '</div>';
      return html;
    }

    function billingBreakdownRow(label, value) {
      return '<div class="decidr-so-billing-breakdown-row">'
        + '<span>' + UI.escapeHtml(label) + '</span>'
        + '<strong>' + UI.escapeHtml(String(value)) + '</strong>'
        + '</div>';
    }

    function orgSettingsTabs(activeTab) {
      var tabs = [
        { key: 'members', label: 'Members' },
        { key: 'github', label: 'GitHub Sync' },
        { key: 'billing', label: 'Billing' }
      ];
      var html = '<div class="decidr-so-org-tabs" role="tablist">';
      for (var i = 0; i < tabs.length; i++) {
        html += '<button class="decidr-so-org-tab' + (activeTab === tabs[i].key ? ' active' : '') + '" '
          + 'type="button" role="tab" data-org-settings-tab="' + UI.escapeHtml(tabs[i].key) + '">'
          + UI.escapeHtml(tabs[i].label) + '</button>';
      }
      html += '</div>';
      return html;
    }

    function ludflowContent(value) {
      if (value == null) return '';
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return String(value || '');
      }
    }

    function ludflowVersionLabel(version) {
      if (!version) return 'Current';
      if (version.label) return version.label;
      if (version.versionNumber != null) return 'Version ' + version.versionNumber;
      if (version.version_number != null) return 'Version ' + version.version_number;
      return 'Version';
    }

    function ludflowVersionDate(value) {
      if (!value) return '';
      try {
        return UI.formatDate(value) || '';
      } catch (e) {
        return '';
      }
    }

    function ludflowLifecycleStage(value) {
      if (!value) return '';
      var normalized = String(value).toUpperCase();
      return normalized === 'PLAN' || normalized === 'STAGED' || normalized === 'IMPLEMENTED'
        ? normalized
        : '';
    }

    function ludflowLifecycleBadge(value) {
      var stage = ludflowLifecycleStage(value);
      if (!stage) return '';
      return '<span class="decidr-so-lifecycle-badge decidr-stage-' + UI.escapeHtml(stage.toLowerCase()) + '">'
        + UI.escapeHtml(stage)
        + '</span>';
    }

    function ludflowField(record, camelKey, snakeKey) {
      if (!record) return undefined;
      if (record[camelKey] != null) return record[camelKey];
      if (snakeKey && record[snakeKey] != null) return record[snakeKey];
      return undefined;
    }

    function ludflowVersionItems(doc) {
      var versions = Array.isArray(doc.versions) ? doc.versions : [];
      if (versions.length === 0) {
        var updatedDate = ludflowVersionDate(doc.updatedAt || doc.updated_at);
        return [{
          id: '__current',
          label: 'Current',
          detail: updatedDate ? 'Updated ' + updatedDate : '',
          content: ludflowContent(doc.content || doc.body || ''),
          format: doc.format || 'MARKDOWN',
          mimeType: doc.mimeType || doc.mime_type || '',
          decisionId: doc.decisionId || doc.decision_id || null,
          decisionLifecycleStage: ludflowLifecycleStage(doc.decisionLifecycleStage || doc.decision_lifecycle_stage),
          dateLabel: updatedDate ? 'Updated ' + updatedDate : '',
          current: true
        }];
      }

      var items = [];
      for (var i = 0; i < versions.length; i++) {
        var version = versions[i] || {};
        var current = i === 0;
        var versionNumber = ludflowField(version, 'versionNumber', 'version_number');
        var createdDate = ludflowVersionDate(version.createdAt || version.created_at);
        var format = ludflowField(version, 'format');
        var mimeType = ludflowField(version, 'mimeType', 'mime_type') || doc.mimeType || doc.mime_type || '';
        var sourceArtifactVersion = ludflowField(version, 'sourceArtifactVersion', 'source_artifact_version');
        var decisionId = ludflowField(version, 'decisionId', 'decision_id');
        var decisionLifecycleStage = ludflowLifecycleStage(ludflowField(version, 'decisionLifecycleStage', 'decision_lifecycle_stage'));
        var detailParts = [];
        if (current) detailParts.push('Current');
        if (versionNumber != null) detailParts.push('Version ' + versionNumber);
        if (createdDate) detailParts.push(createdDate);
        items.push({
          id: version.id || ('__version_' + i),
          label: version.label || (current ? 'Current' : ludflowVersionLabel(version)),
          detail: detailParts.join(' · '),
          content: ludflowContent(version.content || version.body || version.extractedText || (current ? (doc.content || doc.body || '') : '')),
          format: format || doc.format || 'MARKDOWN',
          mimeType: mimeType,
          versionNumber: versionNumber,
          sourceArtifactVersion: sourceArtifactVersion,
          decisionId: decisionId,
          decisionLifecycleStage: decisionLifecycleStage,
          dateLabel: createdDate,
          current: current
        });
      }
      return items;
    }

    function ludflowLooksMarkdown(item) {
      var format = String((item && item.format) || '').toLowerCase();
      var mimeType = String((item && item.mimeType) || '').toLowerCase();
      return !format ||
        format === 'markdown' ||
        format === 'md' ||
        format === 'text' ||
        format === 'plain_text' ||
        mimeType.indexOf('markdown') !== -1 ||
        mimeType.indexOf('text/plain') !== -1;
    }

    function ludflowPreviewHtml(item) {
      var content = ludflowContent(item && item.content);
      if (!content || !content.trim()) {
        return '<div class="decidr-so-empty-hint">No content available for this version</div>';
      }
      if (ludflowLooksMarkdown(item)) {
        return UI.richDescription(content, { className: 'decidr-so-doc-preview-rich' });
      }
      return '<pre class="decidr-so-doc-preview-raw"><code>' + UI.escapeHtml(content) + '</code></pre>';
    }

    function ludflowSelectedVersion(doc, items) {
      var selectedId = doc._selectedVersionId || (items[0] && items[0].id) || '__current';
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === selectedId) return items[i];
      }
      return items[0];
    }

    UI.slideOutLudflowDocument = function(doc) {
      var items = ludflowVersionItems(doc || {});
      var selected = ludflowSelectedVersion(doc || {}, items);
      var html = '<div class="decidr-so-detail decidr-so-doc-preview">';

      html += '<h3 class="decidr-so-detail-title">' + UI.escapeHtml((doc && doc.title) || 'LudFlow Document') + '</h3>';
      var metaItems = [];
      var selectedVersionMeta = selected.current
        ? 'Current document'
        : (selected.versionNumber != null ? 'Version ' + selected.versionNumber : (selected.label || 'Version'));
      metaItems.push({ html: UI.escapeHtml(selectedVersionMeta) });
      if (selected.format) metaItems.push({ html: UI.escapeHtml(String(selected.format).replace(/_/g, ' ')) });
      if (selected.mimeType) metaItems.push({ html: UI.escapeHtml(selected.mimeType) });
      if (selected.decisionLifecycleStage) metaItems.push({ html: ludflowLifecycleBadge(selected.decisionLifecycleStage) });
      if (selected.dateLabel) metaItems.push({ html: UI.escapeHtml(selected.dateLabel) });
      if (selected.sourceArtifactVersion) metaItems.push({ html: 'Source ' + UI.escapeHtml(selected.sourceArtifactVersion) });
      html += UI.SlideOut._renderMeta(metaItems);

      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Versions', items.length);
      html += '<div class="decidr-so-version-list">';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var active = item.id === selected.id;
        html += '<button type="button" class="decidr-so-version-item' + (active ? ' active' : '') + '" data-ludflow-version-id="' + UI.escapeHtml(item.id) + '">';
        html += '<span class="decidr-so-version-title-wrap">';
        html += '<span class="decidr-so-version-title">' + UI.escapeHtml(item.label) + '</span>';
        html += ludflowLifecycleBadge(item.decisionLifecycleStage);
        html += '</span>';
        if (item.detail) html += '<span class="decidr-so-version-detail">' + UI.escapeHtml(item.detail) + '</span>';
        html += '</button>';
      }
      html += '</div></div>';
      if (doc && doc._versionFetchState === 'loading') {
        html += '<div class="decidr-so-empty-hint">Loading Ludflow version history...</div>';
      } else if (doc && doc._versionFetchState === 'error') {
        html += '<div class="decidr-so-empty-hint">Version history could not be loaded.</div>';
      }

      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Preview');
      html += ludflowPreviewHtml(selected);
      html += '</div>';

      html += '</div>';
      return html;
    };

    function renderGitHubComingSoon(githubStatus) {
      var html = '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('GitHub Sync');
      html += '<div class="decidr-so-callout"><strong>Coming soon.</strong> Repository sync controls are moving into the Ludflow-backed GitHub integration.</div>';
      if (githubStatus) {
        var connected = !!githubStatus.connected;
        var summary = githubStatus.summary || {};
        html += '<div class="decidr-so-meta" style="margin-top:var(--space-3);">';
        html += '<span class="decidr-so-meta-item"><strong>Status:</strong> ' + UI.escapeHtml(connected ? 'Connected via Ludflow' : 'Not connected') + '</span>';
        html += '<span class="decidr-so-meta-item"><strong>Repos:</strong> ' + UI.escapeHtml(String(summary.repositoryCount || 0)) + '</span>';
        html += '<span class="decidr-so-meta-item"><strong>Metadata Sync:</strong> ' + UI.escapeHtml(String(summary.metadataSyncRepositoryCount || 0)) + ' enabled</span>';
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    function renderBillingSettings(nodeBilling, currentUserRole) {
      var canManageBilling = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
      var status = nodeBilling && nodeBilling.billing ? nodeBilling.billing.status : 'not_started';
      var actionLabel = status === 'active' ? 'Manage billing' : 'Start billing';
      var html = '<div class="decidr-so-section">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap;">';
      html += UI.SlideOut._renderSectionHeader('Billing');
      html += '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-billing"'
        + ' data-billing-status="' + UI.escapeHtml(status) + '"'
        + (canManageBilling ? '' : ' disabled') + '>' + UI.escapeHtml(actionLabel) + '</button>';
      html += '</div>';
      if (!canManageBilling) {
        html += '<div class="decidr-so-muted-note">Only owners and admins can change billing.</div>';
      }

      if (!nodeBilling) {
        html += '<div class="decidr-so-callout">';
        html += canManageBilling
          ? 'Billing has not been set up yet. Start billing to add a payment method and enable organization-wide node billing. Usage details will appear after billing is connected.'
          : 'Billing has not been set up yet. Ask an owner or admin to start billing. Usage details will appear after billing is connected.';
        html += '</div>';
        html += '</div>';
        return html;
      }

      var nodeAccess = nodeBilling.nodeAccess || {};
      if (nodeAccess.canCreate === false || nodeAccess.canEdit === false) {
        html += '<div class="decidr-so-callout decidr-so-callout-warning">';
        html += nodeAccess.canCreate === false
          ? 'This organization is at or above its ' + formatNumber(nodeBilling.freeNodesIncluded) + '-node free limit without active billing. New nodes are blocked until billing starts.'
          : 'This organization is over its ' + formatNumber(nodeBilling.freeNodesIncluded) + '-node free limit without active billing. Existing nodes cannot be edited until billing is fixed.';
        html += '</div>';
      }

      if (nodeBilling.decidrUsageSource && nodeBilling.decidrUsageSource !== 'live') {
        html += '<div class="decidr-so-callout decidr-so-callout-warning">DecidR usage is using '
          + UI.escapeHtml(String(nodeBilling.decidrUsageSource).replace('_', ' '))
          + ' data, so totals may be incomplete.</div>';
      }

      if (nodeBilling.billing && nodeBilling.billing.rolloutMode === 'shadow') {
        html += '<div class="decidr-so-callout">Node billing is in shadow mode. These balances are projections only and no Stripe usage is reported.</div>';
      }

      var currentBalanceCents = billingValue(nodeBilling, 'currentBalanceCents', 0);
      var projectedChargeCents = billingValue(nodeBilling, 'projectedChargeCents', 0);
      var nodePriceCents = billingValue(nodeBilling, 'nodePriceCents', null);
      var perUserCapCents = billingValue(nodeBilling, 'perUserCapCents', null);
      var minimumInvoiceCents = billingValue(nodeBilling, 'minimumInvoiceCents', null);
      var billableNodes = billingValue(nodeBilling, 'billableNodes', 0);
      var peakActiveUsers = billingValue(nodeBilling, 'peakActiveUsers', 0);
      var peakTotalNodes = billingValue(nodeBilling, 'peakTotalNodes', 0);
      var currentTotalNodes = billingValue(nodeBilling, 'currentTotalNodes', 0);

      html += '<div class="decidr-so-billing-grid">';
      html += billingMetricCard('Peak nodes', formatNumber(peakTotalNodes), 'Highest usage this billing cycle');
      html += billingMetricCard('Billable nodes', formatNumber(billableNodes), 'After the free allowance');
      html += billingMetricCard('Peak active users', formatNumber(peakActiveUsers), 'Used for the monthly cap');
      html += billingMetricCard('Current balance', formatCurrencyCents(currentBalanceCents), 'Based on usage right now');
      html += billingMetricCard('Projected monthly charge', formatCurrencyCents(projectedChargeCents), 'Based on peak usage so far');
      html += '</div>';

      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Pricing rules');
      html += '<div class="decidr-so-billing-rules">';
      html += '<span>Status: <strong>' + UI.escapeHtml(billingStatusLabel(status)) + '</strong>.</span>';
      html += '<span>First ' + UI.escapeHtml(formatNumber(nodeBilling.freeNodesIncluded)) + ' nodes are free for the whole organization.</span>';
      if (nodePriceCents != null) {
        html += '<span>' + UI.escapeHtml(formatCurrencyCents(nodePriceCents)) + ' per billable node after the free allowance.</span>';
      }
      if (perUserCapCents != null) {
        html += '<span>Capped at ' + UI.escapeHtml(formatCurrencyCents(perUserCapCents)) + ' per peak active user each month.</span>';
      }
      if (minimumInvoiceCents != null) {
        html += '<span>Usage is reported when projected charges reach ' + UI.escapeHtml(formatCurrencyCents(minimumInvoiceCents)) + '.</span>';
      }
      if (nodeBilling.periodEnd) {
        html += '<span>Current billing period ends on ' + UI.escapeHtml(UI.formatDate(nodeBilling.periodEnd)) + '.</span>';
      }
      html += '<span>Current node total: ' + UI.escapeHtml(formatNumber(currentTotalNodes)) + '. Peak this month: ' + UI.escapeHtml(formatNumber(peakTotalNodes)) + '.</span>';
      if (hasNumber(nodeBilling, 'uncappedChargeCents') && hasNumber(nodeBilling, 'userCapChargeCents')) {
        html += '<span>Uncapped charge: ' + UI.escapeHtml(formatCurrencyCents(nodeBilling.uncappedChargeCents))
          + '. User cap: ' + UI.escapeHtml(formatCurrencyCents(nodeBilling.userCapChargeCents)) + '.</span>';
      }
      html += '</div>';
      html += '</div>';

      var breakdown = nodeBilling.nodeBreakdown || {};
      var ludflow = breakdown.ludflow || {};
      var decidr = breakdown.decidr || {};
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Node breakdown');
      html += '<div class="decidr-so-billing-breakdown">';
      html += billingBreakdownRow('Documents', formatNumber(ludflow.documents));
      html += billingBreakdownRow('Knowledge entities', formatNumber(ludflow.knowledgeEntities));
      html += billingBreakdownRow('Data tables', formatNumber(ludflow.dataTables));
      html += billingBreakdownRow('Synced repos', formatNumber(ludflow.syncedRepositories) + ' (' + formatNumber(ludflow.syncedRepositoryNodes) + ' nodes)');
      html += billingBreakdownRow('Initiatives', formatNumber(decidr.initiatives));
      html += billingBreakdownRow('Projects', formatNumber(decidr.projects));
      html += billingBreakdownRow('Decisions', formatNumber(decidr.decisions));
      html += billingBreakdownRow('Tasks', formatNumber(decidr.tasks));
      html += billingBreakdownRow('Issues + PRs', formatNumber((decidr.issues || 0) + (decidr.prs || 0)));
      html += '</div>';
      html += '</div>';

      if (nodeBilling.ai) {
        html += '<div class="decidr-so-callout' + (nodeBilling.ai.ready ? '' : ' decidr-so-callout-warning') + '">';
        html += nodeBilling.ai.ready
          ? 'Provider-backed indexing and retrieval are ready for this organization.'
          : 'Provider-backed indexing and retrieval are limited until this organization configures model keys in Ludflow.';
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    function projectAuditTabs(activeTab, decisionCount, eventCount) {
    var active = activeTab || 'decisions';
    var html = '<div class="decidr-so-section" style="margin-top:var(--space-4);">';
    html += '<div style="display:flex;gap:var(--space-2);border-bottom:1px solid var(--border-subtle);">';
    html += '<button class="decidr-so-btn decidr-so-btn-sm' + (active === 'decisions' ? ' decidr-so-btn-primary' : '') + '" data-project-tab="decisions">'
      + 'Decisions' + (decisionCount != null ? ' (' + decisionCount + ')' : '') + '</button>';
    html += '<button class="decidr-so-btn decidr-so-btn-sm' + (active === 'audit-events' ? ' decidr-so-btn-primary' : '') + '" data-project-tab="audit-events">'
      + 'Audit Events' + (eventCount != null ? ' (' + eventCount + ')' : '') + '</button>';
    html += '</div></div>';
    return html;
  }

  function bridgeIsDecisionBridge(bridge) {
    return !!(
      bridge &&
      (bridge.fromDecision || bridge.toDecision || bridge.fromDecisionId || bridge.toDecisionId ||
       bridge.from_decision_id || bridge.to_decision_id)
    );
  }

  function renderBridgeSection(title, bridges, opts) {
    opts = opts || {};
    var prefix = opts.prefix || 'bridge';
    if (!Array.isArray(bridges)) return '';

    var html = '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader(title, bridges.length);
    if (bridges.length === 0) {
      html += '<div class="decidr-so-empty-hint">No bridges</div>';
    } else {
      for (var b = 0; b < bridges.length; b++) {
        var br = bridges[b];
        var bridgeKey = prefix + '-' + b;
        var summary = UI.bridgeEndpointSummary(br) || br.name || 'Bridge';
        var scopeLabel = bridgeIsDecisionBridge(br) ? 'Decision bridge' : 'Project bridge';
        var fromProjectName = UI.bridgeEndpointProjectName(br, 'from');
        var toProjectName = UI.bridgeEndpointProjectName(br, 'to');

        html += '<div class="decidr-so-bridge-item">';
        html += '<div class="decidr-so-bridge-header" data-bridge-toggle="' + UI.escapeHtml(bridgeKey) + '">';
        html += '<span class="decidr-so-bridge-name">' + UI.escapeHtml(summary) + '</span>';
        html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(scopeLabel) + '</span>';
        html += UI.statusBadge(br.status);
        html += '</div>';
        html += '<div class="decidr-so-bridge-expand" id="decidr-so-bridge-expand-' + UI.escapeHtml(bridgeKey) + '">';
        html += '<div class="decidr-so-bridge-expand-inner">';
        if (fromProjectName || toProjectName) {
          html += '<div class="decidr-so-empty-hint">Projects: '
            + UI.escapeHtml(fromProjectName || 'Source') + ' \u2192 '
            + UI.escapeHtml(toProjectName || 'Target') + '</div>';
        }
        if (br.description) {
          html += UI.richDescription(br.description, { className: 'decidr-so-description decidr-so-description-compact' });
        }
        html += '<a class="decidr-so-nav-link" data-entity-type="bridge" data-entity-id="' + UI.escapeHtml(br.id) + '">View Bridge</a>';
        html += '</div></div>';
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  function responsibilityUserLabel(user, userId, emptyText) {
    if (user && (user.name || user.email || user.id)) {
      return UI.userChip(user);
    }
    if (userId) {
      return '<span class="decidr-so-responsibility-user">'
        + UI.escapeHtml(userId.slice(0, 8)) + '</span>';
    }
    return '<span class="decidr-so-empty-hint">' + UI.escapeHtml(emptyText) + '</span>';
  }

  function renderResponsibilityRow(kind, label, user, userId, emptyText) {
    var safeKind = UI.escapeHtml(kind);
    var safeCurrent = UI.escapeHtml(userId || '');
    var selectId = 'decidr-so-' + safeKind + '-select';
    return '<div class="decidr-so-responsibility-row" data-responsibility-kind="' + safeKind + '">'
      + '<div class="decidr-so-responsibility-main">'
      + '<span class="decidr-so-responsibility-title">' + UI.escapeHtml(label) + '</span>'
      + '<span class="decidr-so-responsibility-current">' + responsibilityUserLabel(user, userId, emptyText) + '</span>'
      + '</div>'
      + '<select class="decidr-so-responsibility-select" id="' + selectId + '" data-current-value="' + safeCurrent + '" disabled>'
      + '<option value="">Loading members...</option>'
      + '</select>'
      + '</div>';
  }

  function renderDecisionResponsibilities(decision) {
    var ownerId = decision.ownerId || (decision.owner && decision.owner.id) || '';
    var implementerId = decision.implementerId || (decision.implementer && decision.implementer.id) || '';
    var html = '<div class="decidr-so-responsibilities-card">';
    html += '<div class="decidr-so-reviewers-label">RESPONSIBILITIES</div>';
    html += renderResponsibilityRow('owner', 'Owner', decision.owner, ownerId, 'No owner assigned');
    html += renderResponsibilityRow('implementer', 'Implementer', decision.implementer, implementerId, 'No implementer assigned');
    html += UI.workflowPills(decision, 'decision', {
      className: 'decidr-workflow-pills-slideout',
      fields: ['stage', 'nextStep']
    });
    html += '<div class="decidr-so-responsibility-actions">'
      + '<button class="decidr-so-btn decidr-so-btn-sm decidr-so-btn-primary" id="decidr-so-btn-save-responsibilities" disabled>Save responsibilities</button>'
      + '</div>';
    html += '</div>';
    return html;
  }

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

  function auditCategoryLabel(event) {
    if (event.category && event.category.name) return event.category.name;
    if (typeof event.category === 'string') return event.category;
    return '';
  }

  function auditDateTime(value) {
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

  function auditValuePreview(value) {
    if (value === null || value === undefined || value === '') return 'Not provided';
    if (Array.isArray(value)) {
      if (!value.length) return 'Empty list';
      return value.slice(0, 4).map(function(item) { return auditValuePreview(item); }).join(', ')
        + (value.length > 4 ? ' +' + (value.length - 4) : '');
    }
    if (typeof value === 'object') {
      var keys = Object.keys(value);
      if (!keys.length) return 'Empty object';
      return keys.length + ' field' + (keys.length === 1 ? '' : 's') + ': ' + keys.slice(0, 4).join(', ');
    }
    return String(value);
  }

  function auditFactGrid(items) {
    var html = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-2);margin-top:var(--space-3);">';
    for (var i = 0; i < items.length; i++) {
      if (!items[i].value) continue;
      html += '<div style="border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);background:var(--bg-surface);padding:var(--space-3);min-width:0;">'
        + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);text-transform:uppercase;margin-bottom:4px;">' + UI.escapeHtml(items[i].label) + '</div>'
        + '<div style="color:var(--text-primary);font-size:var(--text-small);font-weight:var(--weight-semibold);line-height:1.35;overflow:hidden;text-overflow:ellipsis;">' + items[i].value + '</div>'
        + '</div>';
    }
    html += '</div>';
    return html;
  }

  function auditObjectPreviewSection(title, obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Object.keys(obj).length) return '';
    var keys = Object.keys(obj).slice(0, 8);
    var html = '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader(title);
    html += '<div style="display:grid;gap:6px;">';
    for (var i = 0; i < keys.length; i++) {
      html += '<div style="display:grid;grid-template-columns:minmax(110px,.7fr) minmax(0,1.3fr);gap:var(--space-2);align-items:start;border-top:1px solid var(--border-subtle);padding-top:6px;">'
        + '<div style="color:var(--text-tertiary);font-size:var(--text-xs);font-weight:var(--weight-semibold);overflow:hidden;text-overflow:ellipsis;">' + UI.escapeHtml(keys[i]) + '</div>'
        + '<div style="color:var(--text-secondary);font-size:var(--text-small);line-height:1.35;word-break:break-word;">' + UI.escapeHtml(auditValuePreview(obj[keys[i]])) + '</div>'
        + '</div>';
    }
    if (Object.keys(obj).length > keys.length) {
      html += '<div class="decidr-so-empty-hint">+' + (Object.keys(obj).length - keys.length) + ' more fields in technical details</div>';
    }
    html += '</div></div>';
    return html;
  }

  function auditRevisionFields(rev) {
    var before = rev.previousValues || {};
    var after = rev.nextValues || {};
    var seen = {};
    var fields = [];
    var keys = Object.keys(before).concat(Object.keys(after));
    for (var i = 0; i < keys.length; i++) {
      if (!seen[keys[i]]) {
        seen[keys[i]] = true;
        fields.push(keys[i]);
      }
    }
    return fields;
  }

  function renderAuditEditForm(event, category, links) {
    var html = '<div class="decidr-so-action-bar">';
    html += '<button class="decidr-so-btn" id="decidr-so-btn-audit-edit">' + ICON_EDIT + ' Cancel Edit</button>';
    html += '<span class="decidr-so-spacer"></span>';
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-audit-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';
    html += '<input type="text" class="decidr-so-edit-input" id="decidr-so-audit-title" value="' + UI.escapeHtml(event.title || '') + '">';
    html += '<textarea class="decidr-so-edit-textarea" id="decidr-so-audit-summary" rows="3">' + UI.escapeHtml(event.summary || '') + '</textarea>';
    html += '<div class="decidr-so-form-row" style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2);">';
    html += '<select class="decidr-so-edit-input" id="decidr-so-audit-status" style="flex:1;">';
    var statuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ARCHIVED'];
    for (var si = 0; si < statuses.length; si++) {
      html += '<option value="' + statuses[si] + '"' + (statuses[si] === event.status ? ' selected' : '') + '>'
        + UI.escapeHtml(STATUS_LABELS[statuses[si]] || statuses[si]) + '</option>';
    }
    html += '</select>';
    html += '<input type="text" class="decidr-so-edit-input" id="decidr-so-audit-category" placeholder="Category" value="' + UI.escapeHtml(category) + '" style="flex:1;">';
    html += '</div>';
    html += '<textarea class="decidr-so-edit-textarea" id="decidr-so-audit-links" rows="2" placeholder="One URL per line">' + UI.escapeHtml(links.join('\n')) + '</textarea>';
    html += '<textarea class="decidr-so-edit-textarea" id="decidr-so-audit-payload" rows="5">' + UI.escapeHtml(JSON.stringify(event.payload || {}, null, 2)) + '</textarea>';
    html += '<textarea class="decidr-so-edit-textarea" id="decidr-so-audit-source-context" rows="4">' + UI.escapeHtml(JSON.stringify(event.sourceContext || {}, null, 2)) + '</textarea>';
    html += '<input type="text" class="decidr-so-edit-input" id="decidr-so-audit-edit-reason" placeholder="Edit reason (optional)">';
    html += '<div class="decidr-so-form-actions">'
      + '<button class="decidr-so-btn" id="decidr-so-btn-cancel-audit-edit">Cancel</button>'
      + '<button class="decidr-so-btn decidr-so-btn-primary" id="decidr-so-btn-save-audit-edit">Save</button>'
      + '</div>';
    return html;
  }

  UI.slideOutAuditEvent = function(event) {
    var state = UI.SlideOut._auditEventPanelState;
    var enriched = event._enriched || {};
    var category = auditCategoryLabel(event);
    var links = Array.isArray(event.links) ? event.links : [];
    var decisionLinks = event.decisionLinks || [];
    var revisions = event.revisions || [];
    var project = event.project || enriched.project;
    var html = '<div class="decidr-so-detail">';

    if (state.editMode) {
      html += renderAuditEditForm(event, category, links);
      html += '</div>';
      return html;
    }

    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3);">';
    html += '<div style="min-width:0;"><div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:6px;">'
      + UI.statusBadge(event.status || 'OPEN')
      + (category ? '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(category) + '</span>' : '')
      + '</div>'
      + '<h3 class="decidr-so-detail-title" style="margin-bottom:0;">' + UI.escapeHtml(event.title || 'Untitled event') + '</h3></div>';
    html += '</div>';

    if (event.summary) {
      html += '<p class="decidr-so-description">' + UI.escapeHtml(event.summary) + '</p>';
    }

    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Summary');
    html += auditFactGrid([
      { label: 'Occurred', value: event.occurredAt ? UI.escapeHtml(auditDateTime(event.occurredAt)) : '' },
      { label: 'Source', value: event.createdByClient ? UI.escapeHtml(event.createdByClient) : '' },
      { label: 'Actor', value: event.createdBy && event.createdBy.name ? UI.escapeHtml(event.createdBy.name) : '' },
      { label: 'Project', value: project ? UI.escapeHtml(project.name || project.title || project.id) : '' },
      { label: 'Linked decisions', value: UI.escapeHtml(String(decisionLinks.length)) },
      { label: 'Evidence links', value: UI.escapeHtml(String(links.length)) }
    ]);
    html += '</div>';

    if (project) {
      html += UI.SlideOut._renderParentLink(ENTITY_ICONS.project, 'Project', 'project', project);
    }

    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Linked Decisions', decisionLinks.length);
    if (decisionLinks.length === 0) {
      html += '<div class="decidr-so-empty-hint">No linked decisions. This event may need a decision link before it can support governance review.</div>';
    } else {
      var decisions = [];
      for (var dl = 0; dl < decisionLinks.length; dl++) {
        if (decisionLinks[dl].decision) decisions.push(decisionLinks[dl].decision);
      }
      html += UI.SlideOut._renderEntityList(decisions, 'decision', { emptyText: 'No linked decisions' });
    }
    html += '</div>';

    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Evidence', links.length);
    if (!links.length && !event.sourceContext && !event.payload) {
      html += '<div class="decidr-so-empty-hint">No supporting evidence attached.</div>';
    }
    for (var li = 0; li < links.length; li++) {
      html += '<div class="decidr-so-doc-item">';
      html += '<a class="decidr-so-doc-link" href="' + UI.escapeHtml(links[li]) + '" target="_blank">'
        + UI.escapeHtml(links[li]) + '</a>';
      html += '</div>';
    }
    html += '</div>';

    html += auditObjectPreviewSection('Source Context', event.sourceContext);
    html += auditObjectPreviewSection('Payload Summary', event.payload);

    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Changes', revisions.length);
    if (revisions.length === 0) {
      html += '<div class="decidr-so-empty-hint">No revisions recorded.</div>';
    } else {
      for (var ri = 0; ri < revisions.length; ri++) {
        var rev = revisions[ri];
        var editor = rev.editedBy && rev.editedBy.name ? rev.editedBy.name : rev.editedById;
        var fields = auditRevisionFields(rev);
        html += '<div class="decidr-so-doc-item" style="display:block;">';
        html += '<div style="display:flex;justify-content:space-between;gap:var(--space-2);margin-bottom:4px;">';
        html += '<strong>' + UI.escapeHtml(editor || 'Unknown editor') + '</strong>';
        html += '<span class="decidr-so-empty-hint">' + UI.escapeHtml(rev.createdAt ? auditDateTime(rev.createdAt) : '') + '</span>';
        html += '</div>';
        if (rev.editReason) html += '<div style="color:var(--text-secondary);font-size:var(--text-small);margin-bottom:6px;">' + UI.escapeHtml(rev.editReason) + '</div>';
        if (!fields.length) {
          html += '<div class="decidr-so-empty-hint">Revision details were recorded without field-level changes.</div>';
        } else {
          html += '<div style="display:grid;gap:5px;">';
          for (var f = 0; f < fields.length; f++) {
            var beforeValue = rev.previousValues ? rev.previousValues[fields[f]] : undefined;
            var afterValue = rev.nextValues ? rev.nextValues[fields[f]] : undefined;
            html += '<div style="display:grid;grid-template-columns:minmax(90px,.5fr) minmax(0,1fr);gap:var(--space-2);font-size:var(--text-small);">'
              + '<div style="color:var(--text-tertiary);font-weight:var(--weight-semibold);overflow:hidden;text-overflow:ellipsis;">' + UI.escapeHtml(fields[f]) + '</div>'
              + '<div style="color:var(--text-secondary);word-break:break-word;">'
              + UI.escapeHtml(auditValuePreview(beforeValue)) + ' → ' + UI.escapeHtml(auditValuePreview(afterValue))
              + '</div></div>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
    }
    html += '</div>';

    html += '<details class="decidr-so-section" style="display:block;">';
    html += '<summary style="cursor:pointer;font-weight:var(--weight-semibold);color:var(--text-secondary);">Technical details</summary>';
    html += '<pre style="white-space:pre-wrap;word-break:break-word;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:var(--space-3);font-size:12px;margin-top:var(--space-3);">'
      + UI.escapeHtml(JSON.stringify({ payload: event.payload || {}, sourceContext: event.sourceContext || {} }, null, 2)) + '</pre>';
    html += '</details>';

    html += '<div class="decidr-so-action-bar" style="margin-top:var(--space-4);">';
    html += '<button class="decidr-so-btn" id="decidr-so-btn-audit-edit">' + ICON_EDIT + ' Edit</button>';
    html += '<span class="decidr-so-spacer"></span>';
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-audit-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    html += '</div>';
    return html;
  };

    UI.slideOutOrganizationSettings = function(payload) {
      var state = UI.SlideOut._organizationSettingsPanelState;
      var organization = payload.organization || {};
      var permissions = payload.permissions || {};
      var members = payload.members || [];
      var invitations = payload.invitations || [];
      var enriched = payload._enriched || {};
      var githubStatus = enriched.githubStatus || null;
      var nodeBilling = enriched.nodeBilling || null;
      var currentUserRole = permissions.currentUserRole || 'MEMBER';
      var inviteRoleOptions = currentUserRole === 'OWNER'
        ? ['OWNER', 'ADMIN', 'MEMBER']
        : ['ADMIN', 'MEMBER'];
      var activeTab = state.activeTab || 'members';
      if (activeTab !== 'members' && activeTab !== 'github' && activeTab !== 'billing') {
        activeTab = 'members';
        state.activeTab = activeTab;
      }
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
      html += orgSettingsTabs(activeTab);

      if (activeTab === 'github') {
        html += renderGitHubComingSoon(githubStatus);
        html += '</div>';
        return html;
      }

      if (activeTab === 'billing') {
        html += renderBillingSettings(nodeBilling, currentUserRole);
        html += '</div>';
        return html;
      }

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
      html += '<button class="decidr-so-btn decidr-so-btn-primary" id="decidr-so-btn-send-org-invite">Send New Invite</button>';
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
        var canManageInvite = permissions.canInviteMembers && (currentUserRole === 'OWNER' || invitation.role !== 'OWNER');
          html += '<div class="decidr-so-org-row">';
          html += '<div class="decidr-so-org-person">';
          html += '<div class="decidr-so-org-person-copy">';
          html += '<div class="decidr-so-org-person-name">' + UI.escapeHtml(invitation.email) + '</div>';
          html += '<div class="decidr-so-org-person-meta">Role ' + UI.escapeHtml(invitation.role)
            + ' - ' + UI.escapeHtml(invitation.targetProduct || 'DECIDR')
            + ' - Expires ' + UI.escapeHtml(UI.formatDate(invitation.expiresAt))
            + '</div>';
          html += '</div>';
          html += '</div>';
        html += '<div class="decidr-so-org-actions">';
        html += '<span class="decidr-so-org-inline-note">Invited by ' + UI.escapeHtml(invitation.invitedByName || 'Unknown') + '</span>';
        html += '<button class="decidr-so-btn decidr-so-btn-sm" data-resend-invitation-id="' + UI.escapeHtml(invitation.id) + '"' + (canManageInvite ? '' : ' disabled') + '>Resend</button>';
        html += '<button class="decidr-so-btn decidr-so-btn-sm" data-cancel-invitation-id="' + UI.escapeHtml(invitation.id) + '"' + (canManageInvite ? '' : ' disabled') + '>Cancel</button>';
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
    html += UI.copyRefButton('project', project.id);
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
      html += UI.richDescription(project.description, { className: 'decidr-so-description' });
    }

    var decisionsForTab = (enriched.decisions && enriched.decisions.data) || enriched.decisions || [];
    var auditEventsForTab = (enriched.auditEvents && enriched.auditEvents.data) || enriched.auditEvents || [];
    var activeProjectTab = project._activeTab || 'decisions';
    html += projectAuditTabs(
      activeProjectTab,
      Array.isArray(decisionsForTab) ? decisionsForTab.length : null,
      Array.isArray(auditEventsForTab) ? auditEventsForTab.length : null
    );

    if (activeProjectTab === 'audit-events') {
      if (Array.isArray(auditEventsForTab)) {
        html += '<div class="decidr-so-section">';
        html += UI.SlideOut._renderSectionHeader('Audit Events', auditEventsForTab.length);
        html += UI.auditEventsList(auditEventsForTab, { emptyText: 'No audit events yet' });
        html += '</div>';
      } else if (!enriched.auditEvents) {
        html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading audit events...</div>';
      }

      html += '</div>';
      return html;
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
        html += UI.copyRefButton('task', task.id);
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
      html += UI.SlideOut._renderSectionHeader(
        'Decisions',
        decisions.length,
        UI.headerActions([{ label: '+ Decision', id: 'decidr-so-btn-add-project-decision', title: 'Create decision' }])
      );
      html += UI.projectDecisionCreateForm(state.addDecisionFormOpen);
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
          html += UI.copyRefButton('decision', dec.id);
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
            html += UI.copyRefButton('decision', oldDec.id);
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
      html += renderBridgeSection('Bridges', bridges, { prefix: 'project-bridge' });
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
    var isCatchUp = UI.isCatchUpDecision && UI.isCatchUpDecision(decision);
    var html = '<div class="decidr-so-detail">';

    // Meta row
    var metaItems = [{ html: UI.statusBadge(decision.status) }];
    if (isCatchUp) metaItems.push({ html: UI.decisionKindBadge(decision) });
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
    if (decision.status === 'APPROVED' || decision.status === 'STAGED' || decision.status === 'IMPLEMENTED') {
      html += '<button class="decidr-so-btn" id="decidr-so-btn-supersede">Supersede</button>';
    }
    html += '<span class="decidr-so-spacer"></span>';
    html += UI.copyRefButton('decision', decision.id);
    html += '<button class="decidr-so-btn decidr-so-btn-danger" id="decidr-so-btn-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    html += renderDecisionResponsibilities(decision);

    if (!isCatchUp) {
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
        for (var vi = 0; vi < reviewers.length; vi++) {
          if (reviewers[vi].userId === myUserId) {
            myVote = reviewers[vi].status || 'approved';
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
    }

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
        html += UI.richDescription(decision.description, { className: 'decidr-so-description' });
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

    var decisionBridges = (enriched.bridges && enriched.bridges.data) || enriched.bridges
      || decision.decisionBridges || [];
    if ((!decisionBridges || !decisionBridges.length) && (decision.bridgesFrom || decision.bridgesTo)) {
      decisionBridges = [];
      if (Array.isArray(decision.bridgesFrom)) {
        for (var dbf = 0; dbf < decision.bridgesFrom.length; dbf++) decisionBridges.push(decision.bridgesFrom[dbf]);
      }
      if (Array.isArray(decision.bridgesTo)) {
        for (var dbt = 0; dbt < decision.bridgesTo.length; dbt++) decisionBridges.push(decision.bridgesTo[dbt]);
      }
    }
    if (Array.isArray(decisionBridges)) {
      html += renderBridgeSection('Decision Bridges', decisionBridges, { prefix: 'decision-bridge' });
    } else if (!enriched.bridges) {
      html += '<div class="decidr-so-loading-section"><div class="decidr-spinner"></div> Loading bridges...</div>';
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
        html += UI.copyRefButton('task', task.id);
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

    var linkedAuditEvents = [];
    if (enriched.auditEvents && enriched.auditEvents.data) {
      linkedAuditEvents = enriched.auditEvents.data;
    } else if (Array.isArray(enriched.auditEvents)) {
      linkedAuditEvents = enriched.auditEvents;
    } else if (decision.auditEventLinks && decision.auditEventLinks.length) {
      for (var aei = 0; aei < decision.auditEventLinks.length; aei++) {
        if (decision.auditEventLinks[aei].auditEvent) linkedAuditEvents.push(decision.auditEventLinks[aei].auditEvent);
      }
    }
    html += '<div class="decidr-so-section">';
    html += UI.SlideOut._renderSectionHeader('Linked Audit Events', linkedAuditEvents.length);
    html += UI.auditEventsList(linkedAuditEvents, { emptyText: 'No linked audit events' });
    html += '</div>';

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
    html += '<span class="decidr-so-spacer"></span>';
    html += UI.copyRefButton('task', task.id);
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
    html += UI.workflowPills(task, 'task', {
      className: 'decidr-so-workflow-card decidr-workflow-pills-slideout',
      fields: ['stage', 'nextStep']
    });

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
        html += UI.richDescription(task.description, { className: 'decidr-so-description' });
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
      html += UI.richDescription(bridge.description, { className: 'decidr-so-description' });
    }

    // Source endpoint
    if (bridge.fromDecision) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Source Decision');
      html += '<div class="decidr-so-list-item" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(bridge.fromDecision.id) + '" style="cursor:pointer;">';
      html += UI.statusBadge(bridge.fromDecision.status);
      html += '<span class="decidr-so-list-title">' + UI.escapeHtml(bridge.fromDecision.title || bridge.fromDecision.id) + '</span>';
      if (bridge.fromDecision.project && bridge.fromDecision.project.name) {
        html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(bridge.fromDecision.project.name) + '</span>';
      }
      html += UI.copyRefButton('decision', bridge.fromDecision.id);
      html += '</div></div>';
    } else if (bridge.fromProject) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Source Project');
      html += '<div class="decidr-so-list-item" data-entity-type="project" data-entity-id="' + UI.escapeHtml(bridge.fromProject.id) + '" style="cursor:pointer;">';
      html += '<div class="decidr-so-color-dot" style="background:' + UI.sanitizeColor(bridge.fromProject.color || '#6366f1') + ';display:inline-block;margin-right:6px;"></div>';
      html += '<span class="decidr-so-list-title">' + UI.escapeHtml(bridge.fromProject.name) + '</span>';
      html += UI.statusBadge(bridge.fromProject.status);
      html += UI.copyRefButton('project', bridge.fromProject.id);
      html += '</div></div>';
    }

    // Target endpoint
    if (bridge.toDecision) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Target Decision');
      html += '<div class="decidr-so-list-item" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(bridge.toDecision.id) + '" style="cursor:pointer;">';
      html += UI.statusBadge(bridge.toDecision.status);
      html += '<span class="decidr-so-list-title">' + UI.escapeHtml(bridge.toDecision.title || bridge.toDecision.id) + '</span>';
      if (bridge.toDecision.project && bridge.toDecision.project.name) {
        html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(bridge.toDecision.project.name) + '</span>';
      }
      html += UI.copyRefButton('decision', bridge.toDecision.id);
      html += '</div></div>';
    } else if (bridge.toProject) {
      html += '<div class="decidr-so-section">';
      html += UI.SlideOut._renderSectionHeader('Target Project');
      html += '<div class="decidr-so-list-item" data-entity-type="project" data-entity-id="' + UI.escapeHtml(bridge.toProject.id) + '" style="cursor:pointer;">';
      html += '<div class="decidr-so-color-dot" style="background:' + UI.sanitizeColor(bridge.toProject.color || '#6366f1') + ';display:inline-block;margin-right:6px;"></div>';
      html += '<span class="decidr-so-list-title">' + UI.escapeHtml(bridge.toProject.name) + '</span>';
      html += UI.statusBadge(bridge.toProject.status);
      html += UI.copyRefButton('project', bridge.toProject.id);
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
    html += UI.copyRefButton('initiative', initiative.id);
    html += '<button class="decidr-so-btn decidr-so-btn-danger decidr-so-btn-sm" id="decidr-so-btn-initiative-archive">' + ICON_TRASH + ' Archive</button>';
    html += '</div>';

    // Description
    if (initiative.description) {
      html += UI.richDescription(initiative.description, { className: 'decidr-so-description' });
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

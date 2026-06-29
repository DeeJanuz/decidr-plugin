(function() {
  'use strict';

  var _token = '';
  var _activeOrgId = null;

  function isValidId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
  }

  function _validatePathIds(path) {
    var segments = path.split('/');
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (!seg) continue;
      if (seg.indexOf('?') !== -1) {
        if (i !== segments.length - 1) {
          throw new Error('Invalid query position in path');
        }
        seg = seg.split('?')[0];
      }
      if (!seg) continue;
      if (seg === '.' || seg === '..') {
        throw new Error('Invalid path segment: ' + seg);
      }
      if (/^[a-z_-]+$/.test(seg) || /^[a-z_-]+\.csv$/.test(seg)) continue;
      // This segment looks like an ID — validate it
      if (!isValidId(seg)) {
        throw new Error('Invalid ID in path: ' + seg);
      }
    }
  }

  function _qs(params) {
    if (!params) return '';
    var parts = [];
    for (var key in params) {
      if (params.hasOwnProperty(key) && params[key] != null) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    return parts.length ? '?' + parts.join('&') : '';
  }

  function _headers(withBody) {
    var h = {};
    if (_token) {
      h['Authorization'] = 'Bearer ' + _token;
    }
    if (withBody) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  }

  function _buildApiError(response, bodyText) {
    var bodyMessage = '';
    var parsedBody = null;
    if (bodyText) {
      try {
        parsedBody = JSON.parse(bodyText);
        if (parsedBody && typeof parsedBody === 'object') {
          bodyMessage = parsedBody.error || parsedBody.message || '';
        }
      } catch (e) {
        // Not JSON — use the raw text if it looks like a message
        if (bodyText.length < 500) bodyMessage = bodyText;
      }
    }
    var err = new Error('API error: ' + response.status + ' ' + response.statusText
      + (bodyMessage ? ' — ' + bodyMessage : ''));
    err.status = response.status;
    err.statusText = response.statusText;
    err.body = parsedBody;
    err.bodyText = bodyText || '';
    err.bodyMessage = bodyMessage;
    return err;
  }

  function _handleResponse(response) {
    if (!response.ok) {
      return response.text().then(function(text) {
        throw _buildApiError(response, text);
      }, function() {
        throw _buildApiError(response, '');
      });
    }
    return response.json();
  }

  function _handleTextResponse(response) {
    if (!response.ok) {
      return response.text().then(function(text) {
        throw _buildApiError(response, text);
      }, function() {
        throw _buildApiError(response, '');
      });
    }
    return response.text().then(function(text) {
      return { text: text, response: response };
    });
  }

  function _handleBlobResponse(response) {
    if (!response.ok) {
      return response.text().then(function(text) {
        throw _buildApiError(response, text);
      }, function() {
        throw _buildApiError(response, '');
      });
    }
    return response.blob().then(function(blob) {
      return { blob: blob, response: response };
    });
  }

  function _hasTauri() {
    return window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function';
  }

  function _statusHasUsableToken(status) {
    return status === 'valid' || status === 'expired_refreshable';
  }

  function _refreshToken() {
    if (!_hasTauri()) {
      return Promise.reject(new Error('Tauri IPC not available for token refresh'));
    }
    var ipcArgs = { pluginName: 'decidr' };
    if (_activeOrgId) ipcArgs.orgId = _activeOrgId;
    return window.__TAURI__.core.invoke('get_plugin_auth_header', ipcArgs)
      .then(function(authHeader) {
        var t = (authHeader || '').replace(/^Bearer\s+/i, '');
        _token = t;
        return _token;
      });
  }

  function _fetchWithRetry(url, opts) {
    return fetch(url, opts).then(function(response) {
      if (response.status === 401 && _hasTauri()) {
        return _refreshToken().then(function() {
          var retryOpts = {};
          for (var key in opts) {
            if (opts.hasOwnProperty(key)) {
              retryOpts[key] = opts[key];
            }
          }
          retryOpts.headers = _headers(!!retryOpts.body);
          return fetch(url, retryOpts).then(_handleResponse);
        });
      }
      return _handleResponse(response);
    });
  }

  function _fetchTextWithRetry(url, opts) {
    return fetch(url, opts).then(function(response) {
      if (response.status === 401 && _hasTauri()) {
        return _refreshToken().then(function() {
          var retryOpts = {};
          for (var key in opts) {
            if (opts.hasOwnProperty(key)) retryOpts[key] = opts[key];
          }
          retryOpts.headers = _headers(!!retryOpts.body);
          return fetch(url, retryOpts).then(_handleTextResponse);
        });
      }
      return _handleTextResponse(response);
    });
  }

  function _fetchBlobWithRetry(url, opts) {
    return fetch(url, opts).then(function(response) {
      if (response.status === 401 && _hasTauri()) {
        return _refreshToken().then(function() {
          var retryOpts = {};
          for (var key in opts) {
            if (opts.hasOwnProperty(key)) retryOpts[key] = opts[key];
          }
          retryOpts.headers = _headers(!!retryOpts.body);
          return fetch(url, retryOpts).then(_handleBlobResponse);
        });
      }
      return _handleBlobResponse(response);
    });
  }

  var api = {
    _baseUrl: '',
    _currentUserId: null,
    _initialized: false,

    setToken: function(t) {
      _token = t || '';
    },

    hasToken: function() {
      return !!_token;
    },

    setActiveOrg: function(orgId) {
      _activeOrgId = orgId || null;
    },

    getActiveOrgId: function() {
      return _activeOrgId;
    },

    init: function(baseUrl, token) {
      api._baseUrl = baseUrl.replace(/\/$/, '');
      _token = token || '';
    },

    autoInit: function(meta) {
      if (api._initialized) {
        return Promise.resolve();
      }

      // Resolve base URL from MCPViews plugin config, meta override, or fallback
      var base = '';
      if (meta && meta._api_base) {
        base = meta._api_base;
      } else if (window.__mcpviews_plugins && window.__mcpviews_plugins.decidr && window.__mcpviews_plugins.decidr.mcp_url) {
        base = window.__mcpviews_plugins.decidr.mcp_url.replace(/\/api\/mcp\/?$/, '/api');
      } else {
        base = 'http://localhost:3001/api';
      }

      api._baseUrl = base.replace(/\/$/, '');

      // Resolve token
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        var initIpcArgs = { pluginName: 'decidr' };
        if (_activeOrgId) initIpcArgs.orgId = _activeOrgId;
        var targetedOrgId = _activeOrgId;
        return window.__TAURI__.core.invoke('get_plugin_auth_header', initIpcArgs)
          .then(function(authHeader) {
            var t = (authHeader || '').replace(/^Bearer\s+/i, '');
            _token = t;
            api._initialized = true;
            return api._fetchCurrentUser();
          })
          .catch(function(err) {
            // If caller explicitly targeted an org and Tauri has no stored token
            // for it, propagate the failure so the UI can show an auth prompt.
            // Only fall back to window.__decidrToken for non-targeted autoInit
            // (e.g., test harnesses or initial boot with no stored active org).
            if (targetedOrgId) {
              api._initialized = false;
              _token = '';
              return Promise.reject(err || new Error('No stored token for plugin org ' + targetedOrgId));
            }
            _token = window.__decidrToken || '';
            api._initialized = true;
            return api._fetchCurrentUser();
          });
      }

      _token = window.__decidrToken || '';
      api._initialized = true;
      return api._fetchCurrentUser();
    },

    _fetchCurrentUser: function() {
      return fetch(api._baseUrl.replace(/\/api$/, '/api/auth/get-session'), {
        headers: _headers(false),
        credentials: 'include'
      }).then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (data && data.user && data.user.id) {
            api._currentUserId = data.user.id;
          }
          if (
            data &&
            data.session &&
            data.session.currentOrganizationId &&
            !_activeOrgId
          ) {
            _activeOrgId = data.session.currentOrganizationId;
          }
        }).catch(function() { /* session fetch is best-effort */ });
    },

    withReady: function(container, meta, renderFn, orgId) {
      // Dependency guard
      if (!window.__decidrUI || !window.__decidrAPI) {
        var _retries = 0;
        var _check = setInterval(function() {
          _retries++;
          if (window.__decidrUI && window.__decidrAPI) {
            clearInterval(_check);
            api.withReady(container, meta, renderFn, orgId);
          } else if (_retries >= 10) {
            clearInterval(_check);
            container.innerHTML = '<div style="color:var(--color-error-text);padding:var(--space-4);">'
              + 'Error: DecidR dependencies failed to load after 500ms.</div>';
          }
        }, 50);
        return;
      }

      var UI = window.__decidrUI;

      container.innerHTML = '<div style="padding:var(--space-6);">'
        + UI.loadingSpinner('Initializing...')
        + '</div>';

      var targetOrg = orgId || null;
      if (targetOrg !== _activeOrgId) {
        _activeOrgId = targetOrg;
        api._initialized = false;
      }

      api.autoInit(meta || {}).then(function() {
        renderFn(UI, api);
      }).catch(function(err) {
        console.error('[decidr] Init error:', err);
        container.innerHTML = '<div style="color:var(--color-error-text);padding:var(--space-4);">'
          + 'Failed to initialize. Please check your connection and try again.'
          + '</div>';
      });
    },

    get: function(path) {
      _validatePathIds(path);
      return _fetchWithRetry(api._baseUrl + path, {
        method: 'GET',
        headers: _headers(false)
      });
    },

    post: function(path, body) {
      _validatePathIds(path);
      return _fetchWithRetry(api._baseUrl + path, {
        method: 'POST',
        headers: _headers(true),
        body: JSON.stringify(body)
      });
    },

    patch: function(path, body) {
      _validatePathIds(path);
      return _fetchWithRetry(api._baseUrl + path, {
        method: 'PATCH',
        headers: _headers(true),
        body: JSON.stringify(body)
      });
    },

    delete: function(path) {
      _validatePathIds(path);
      return _fetchWithRetry(api._baseUrl + path, {
        method: 'DELETE',
        headers: _headers(false)
      });
    },

    // --- List endpoints ---

    listInitiatives: function(params) {
      return api.get('/initiatives' + _qs(params));
    },

    listProjects: function(params) {
      return api.get('/projects' + _qs(params));
    },

    listDecisions: function(params) {
      return api.get('/decisions' + _qs(params));
    },

    listTasks: function(params) {
      return api.get('/tasks' + _qs(params));
    },

    listBridges: function(params) {
      return api.get('/bridges' + _qs(params));
    },

    listAuditEvents: function(params) {
      return api.get('/audit-events' + _qs(params));
    },

    listAuditCategories: function(params) {
      return api.get('/audit-categories' + _qs(params));
    },

    listAuditReports: function(params) {
      return api.get('/audit-reports' + _qs(params));
    },

    getAuditReportFields: function(params) {
      return api.get('/audit-report-fields' + _qs(params));
    },

    // --- Single entity endpoints ---

    getInitiative: function(id) {
      return api.get('/initiatives/' + id);
    },

    getProject: function(id) {
      return api.get('/projects/' + id);
    },

    getDecision: function(id) {
      return api.get('/decisions/' + id);
    },

    getTask: function(id) {
      return api.get('/tasks/' + id);
    },

    getBridge: function(id) {
      return api.get('/bridges/' + id);
    },

    getAuditEvent: function(id) {
      return api.get('/audit-events/' + id);
    },

    getAuditReport: function(id) {
      return api.get('/audit-reports/' + id);
    },

    // --- Special endpoints ---

    getActionItems: function(params) {
      return api.get('/action-items' + _qs(params));
    },

    search: function(query) {
      return api.get('/search?query=' + encodeURIComponent(query));
    },

    getTimeline: function(params) {
      return api.get('/timeline' + _qs(params));
    },

    getTimelineWindow: function(params) {
      return api.get('/timeline/window' + _qs(params));
    },

    runAuditReport: function(data) {
      return api.post('/audit-reports/run', data);
    },

    // --- Transition / action endpoints ---

    approveDecision: function(id) {
      return api.post('/decisions/' + id + '/approve');
    },

    rejectDecision: function(id) {
      return api.post('/decisions/' + id + '/reject');
    },

    supersedeDecision: function(id, data) {
      return api.post('/decisions/' + id + '/supersede', data);
    },

    transitionDecision: function(id, status) {
      return api.post('/decisions/' + id + '/transition', { status: status });
    },

    transitionProject: function(id, status) {
      return api.post('/projects/' + id + '/transition', { status: status });
    },

    transitionTask: function(id, status) {
      return api.post('/tasks/' + id + '/transition', { status: status });
    },

    transitionBridge: function(id, status) {
      return api.post('/bridges/' + id + '/transition', { status: status });
    },

    completeTask: function(id) {
      return api.transitionTask(id, 'DONE');
    },

    // --- CRUD: Create ---

    createInitiative: function(data) {
      return api.post('/initiatives', data);
    },

    createProject: function(data) {
      return api.post('/projects', data);
    },

    createDecision: function(data) {
      return api.post('/decisions', data);
    },

    createCatchUpDecision: function(data) {
      var body = {};
      data = data || {};
      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) body[key] = data[key];
      }
      body.kind = 'CATCH_UP';
      return api.post('/decisions', body);
    },

    createTask: function(data) {
      return api.post('/tasks', data);
    },

    createBridge: function(data) {
      return api.post('/bridges', data);
    },

    createAuditEvent: function(data) {
      return api.post('/audit-events', data);
    },

    createAuditReport: function(data) {
      return api.post('/audit-reports', data);
    },

    // --- CRUD: Update ---

    updateInitiative: function(id, data) {
      return api.patch('/initiatives/' + id, data);
    },

    updateProject: function(id, data) {
      return api.patch('/projects/' + id, data);
    },

    updateDecision: function(id, data) {
      return api.patch('/decisions/' + id, data);
    },

    markDecisionAsCatchUp: function(id, data) {
      return api.post('/decisions/' + id + '/catch-up', data || {});
    },

    updateTask: function(id, data) {
      return api.patch('/tasks/' + id, data);
    },

    updateBridge: function(id, data) {
      return api.patch('/bridges/' + id, data);
    },

    updateAuditEvent: function(id, data) {
      return api.patch('/audit-events/' + id, data);
    },

    updateAuditReport: function(id, data) {
      return api.patch('/audit-reports/' + id, data);
    },

    shareAuditReport: function(id, data) {
      return api.post('/audit-reports/' + id + '/share', data);
    },

    unshareAuditReport: function(id, userId) {
      return api.delete('/audit-reports/' + id + '/share/' + userId);
    },

    exportAuditReportCsv: function(id) {
      _validatePathIds('/audit-reports/' + id + '/export.csv');
      return _fetchTextWithRetry(api._baseUrl + '/audit-reports/' + id + '/export.csv', {
        method: 'POST',
        headers: _headers(false)
      });
    },

    // --- Archive endpoints ---

    archiveInitiative: function(id) {
      return api.delete('/initiatives/' + id);
    },

    archiveProject: function(id) {
      return api.delete('/projects/' + id);
    },

    archiveDecision: function(id) {
      return api.delete('/decisions/' + id);
    },

    archiveTask: function(id) {
      return api.delete('/tasks/' + id);
    },

    archiveBridge: function(id) {
      return api.delete('/bridges/' + id);
    },

    archiveAuditEvent: function(id) {
      return api.delete('/audit-events/' + id);
    },

    archiveAuditReport: function(id) {
      return api.delete('/audit-reports/' + id);
    },

    // --- Restore endpoints ---

    restoreInitiative: function(id) {
      return api.post('/initiatives/' + id + '/restore');
    },

    restoreProject: function(id) {
      return api.post('/projects/' + id + '/restore');
    },

    restoreDecision: function(id) {
      return api.post('/decisions/' + id + '/restore');
    },

    restoreTask: function(id) {
      return api.post('/tasks/' + id + '/restore');
    },

    restoreBridge: function(id) {
      return api.post('/bridges/' + id + '/restore');
    },

    // --- Document linking ---

    linkEntityDocument: function(data) {
      return api.post('/documents', data);
    },

    startEvidenceFileUpload: function(data) {
      return api.post('/documents/evidence-upload/start', data);
    },

    completeEvidenceFileUpload: function(data) {
      return api.post('/documents/evidence-upload/complete', data);
    },

    listEntityDocuments: function(entityType, entityId) {
      return api.get('/documents' + _qs({ entityType: entityType, entityId: entityId }));
    },

    deleteDocument: function(id) {
      _validatePathIds('/documents/' + id);
      return _fetchWithRetry(api._baseUrl + '/documents/' + id, {
        method: 'DELETE',
        headers: _headers(false)
      });
    },

    searchLudflowDocuments: function(query) {
      return api.get('/ludflow-documents' + _qs({ search: query }));
    },

    getLudflowDocument: function(id) {
      return api.get('/ludflow-documents/' + id);
    },

    fetchLudflowDocumentAsset: function(documentId, versionId) {
      _validatePathIds('/ludflow-documents/' + documentId + '/versions/' + versionId + '/asset');
      return _fetchBlobWithRetry(api._baseUrl + '/ludflow-documents/' + documentId + '/versions/' + versionId + '/asset', {
        method: 'GET',
        headers: _headers(false)
      });
    },

    listDecisionDocumentEvidence: function(decisionId) {
      _validatePathIds('/decisions/' + decisionId + '/document-evidence');
      return api.get('/decisions/' + decisionId + '/document-evidence');
    },

    listMembers: function() {
      return api.get('/auth/members');
    },

    // Backward-compat aliases
    linkDocument: function(decisionId, data) {
      data.entityType = 'DECISION';
      data.entityId = decisionId;
      data.type = data.type || 'URL';
      return api.post('/documents', data);
    },

    searchDocuments: function(query) {
      return api.get('/search?q=' + encodeURIComponent(query) + '&types=document');
    },

    addReviewer: function(decisionId, userId) {
      return api.post('/decisions/' + decisionId + '/reviewers', { userId: userId });
    },

    linkDecisionAuditEvent: function(decisionId, auditEventId) {
      return api.post('/decisions/' + decisionId + '/audit-events', { auditEventId: auditEventId });
    },

    unlinkDecisionAuditEvent: function(decisionId, auditEventId) {
      return api.delete('/decisions/' + decisionId + '/audit-events/' + auditEventId);
    },

    replaceDecisions: function(replacingDecisionId, replacedDecisionIds) {
      return api.post('/decisions/' + replacingDecisionId + '/replacements', {
        replacedDecisionIds: replacedDecisionIds
      });
    },

    listOrgMembers: function() {
      return api.get('/auth/members');
    },

    getOrganizationMemberSettings: function(orgId) {
      return api.get('/organizations/' + orgId + '/members');
    },

    getOrganizationNodeBilling: function(orgId) {
      return api.get('/organizations/' + orgId + '/node-billing');
    },

    openOrganizationBilling: function(orgId, billingStatus) {
      if (billingStatus && billingStatus !== 'active') {
        return api.post('/billing/checkout', { organizationId: orgId });
      }
      return api.post('/billing/portal', { organizationId: orgId }).catch(function(err) {
        if (err && err.body && err.body.code === 'NO_CUSTOMER') {
          return api.post('/billing/checkout', { organizationId: orgId });
        }
        throw err;
      });
    },

    getLudflowGitHubStatus: function() {
      return api.get('/github/ludflow/status');
    },

    connectLudflowGitHub: function() {
      return api.post('/github/ludflow/connect', {});
    },

    listLudflowGitHubRepositories: function(params) {
      return api.get('/github/ludflow/repositories' + _qs(params));
    },

    getLudflowGitHubRepository: function(id) {
      return api.get('/github/ludflow/repositories/' + id);
    },

    updateLudflowGitHubRepository: function(id, data) {
      return api.patch('/github/ludflow/repositories/' + id, data);
    },

    refreshLudflowGitHubRepository: function(id) {
      return api.post('/github/ludflow/repositories/' + id + '/refresh-metadata', {});
    },

    inviteOrgMember: function(orgId, data) {
      var payload = {
        email: data.email,
        role: data.role || 'MEMBER',
        targetProduct: data.targetProduct || 'DECIDR'
      };
      return api.post('/organizations/' + orgId + '/members', payload);
    },

    updateOrgMemberRole: function(orgId, userId, role) {
      return api.patch('/organizations/' + orgId + '/members', {
        userId: userId,
        role: role
      });
    },

    removeOrgMember: function(orgId, userId) {
      return api.delete('/organizations/' + orgId + '/members?userId=' + encodeURIComponent(userId));
    },

    cancelOrgInvitation: function(orgId, invitationId) {
      return api.delete('/organizations/' + orgId + '/members?invitationId=' + encodeURIComponent(invitationId));
    },

    resendOrgInvitation: function(orgId, invitationId) {
      return api.post('/organizations/' + orgId + '/members', {
        action: 'resend_invite',
        invitationId: invitationId
      });
    },

    listOrganizations: function() {
      return api.get('/organizations').then(function(resp) {
        if (resp && Array.isArray(resp.data)) return resp.data;
        if (Array.isArray(resp)) return resp;
        return [];
      });
    },

    listPluginOrgs: function() {
      if (!_hasTauri()) return Promise.resolve([]);
      return window.__TAURI__.core.invoke('list_plugin_orgs', { pluginName: 'decidr' });
    },

    listPluginContexts: function() {
      if (!_hasTauri()) return Promise.resolve(null);
      return window.__TAURI__.core.invoke('list_plugin_contexts', {
        pluginNames: ['decidr'],
        includeContexts: true,
        includeLabels: false,
        includeApps: false,
        maxContextsPerPlugin: 50
      }).catch(function() {
        return null;
      });
    },

    listPluginOrgAuth: function() {
      if (!_hasTauri()) return Promise.resolve([]);
      return api.listPluginContexts().then(function(contextResult) {
        var plugins = contextResult && contextResult.plugins;
        var plugin = plugins && plugins.length ? plugins[0] : null;
        if (!plugin || !Array.isArray(plugin.contexts)) return null;
        return plugin.contexts.map(function(context) {
          return {
            org_id: context.context_id,
            status: context.status || (context.refreshable ? 'expired_refreshable' : 'valid'),
            refreshable: !!context.refreshable
          };
        });
      }).then(function(sharedContexts) {
        if (Array.isArray(sharedContexts)) return sharedContexts;
        return window.__TAURI__.core.invoke('list_plugin_org_auth', { pluginName: 'decidr' });
      })
        .catch(function() {
          return api.listPluginOrgs().then(function(orgs) {
            return (orgs || []).map(function(orgId) {
              return { org_id: orgId, status: 'valid', refreshable: false };
            });
          });
        });
    },

    refreshOrgToken: function(orgId) {
      if (!_hasTauri()) return Promise.reject(new Error('Tauri IPC not available for token refresh'));
      return window.__TAURI__.core.invoke('get_plugin_auth_header', {
        pluginName: 'decidr',
        orgId: orgId
      });
    },

    openPluginAuth: function(orgId) {
      var data = {
        plugin_name: 'decidr',
        plugin_label: 'DecidR',
        organization_id: orgId || null
      };
      var utils = window.__companionUtils || {};
      if (typeof utils.openSession === 'function') {
        utils.openSession({
          sessionKey: 'plugin-auth-decidr-' + (orgId || 'default'),
          toolName: 'plugin_email_code_auth',
          contentType: 'plugin_email_code_auth',
          data: data,
          meta: { headerTitle: 'Sign in to DecidR' },
          toolArgs: { plugin_name: 'decidr', organization_id: orgId || null }
        });
        return Promise.resolve();
      }
      if (_hasTauri()) {
        return window.__TAURI__.core.invoke('start_plugin_auth', {
          pluginName: 'decidr',
          orgId: orgId || null,
          authFlow: 'email_code'
        });
      }
      return Promise.reject(new Error('MCPViews authentication UI is not available.'));
    },

    switchOrg: function(orgId) {
      _activeOrgId = orgId || null;
      _token = '';
      api._initialized = false;
      return api.autoInit({});
    },

    getUserPreferences: function() {
      return api.get('/me/preferences');
    },

    setDefaultOrg: function(orgId) {
      return api.patch('/me/preferences', { defaultOrganizationId: orgId });
    },

    clearDefaultOrg: function() {
      return api.patch('/me/preferences', { defaultOrganizationId: null });
    },

    /**
     * Fetches organizations, shared MCPViews contexts, plugin-org tokens, and
     * user preferences in parallel, annotates each org with `tokenStatus`, and
     * — if no org is currently bound to the client — resolves a target org and
     * calls switchOrg. Returns `{ organizations, defaultOrgId, activeOrgId }`.
     *
     * Routing is a no-op when `_activeOrgId` is already set, so this is safe
     * to call on every fetch pass (initial mount and subsequent refetches).
     * That invariant is what prevents refetches after a user click from
     * looping back to the default org.
     *
     * Target precedence when nothing is bound:
     *   1. `opts.pushedOrgId` (from MCP push data)
     *   2. project default context from MCPViews (if usable)
     *   3. `preferences.defaultOrganizationId` (if the user has a stored
     *      plugin token for it)
     *   4. first stored plugin org token
     */
    resolveAndBindTargetOrg: function(opts) {
      opts = opts || {};
      var pushedOrgId = opts.pushedOrgId || null;
      return Promise.all([
        api.listOrganizations().catch(function() { return []; }),
        api.listPluginContexts().catch(function() { return null; }),
        api.listPluginOrgAuth().catch(function() { return []; }),
        api.getUserPreferences().catch(function() { return null; })
      ]).then(function(results) {
        var orgs = results[0] || [];
        var contextResult = results[1] || null;
        var pluginOrgAuth = results[2] || [];
        var prefs = results[3] || null;

        var pluginOrgStatus = {};
        var firstUsablePluginOrgId = null;
        for (var i = 0; i < pluginOrgAuth.length; i++) {
          var entry = pluginOrgAuth[i] || {};
          var entryOrgId = entry.org_id || entry.orgId;
          if (!entryOrgId) continue;
          pluginOrgStatus[entryOrgId] = entry.status || (entry.refreshable ? 'expired_refreshable' : 'valid');
          if (!firstUsablePluginOrgId && _statusHasUsableToken(pluginOrgStatus[entryOrgId])) {
            firstUsablePluginOrgId = entryOrgId;
          }
        }

        var projectDefaultOrgId = null;
        var projectDefaultUsable = false;
        var contextPlugin = contextResult && contextResult.plugins && contextResult.plugins.length
          ? contextResult.plugins[0]
          : null;
        var defaultContext = contextPlugin && contextPlugin.default_context;
        if (defaultContext && defaultContext.source === 'project') {
          projectDefaultOrgId = defaultContext.context_id || null;
          projectDefaultUsable = defaultContext.usable !== false
            && _statusHasUsableToken(defaultContext.status || pluginOrgStatus[projectDefaultOrgId]);
          if (projectDefaultOrgId && defaultContext.status) {
            pluginOrgStatus[projectDefaultOrgId] = defaultContext.status;
          }
        }

        var defaultOrgId = (prefs && prefs.defaultOrganizationId) || null;
        var currentlyBound = api.getActiveOrgId();

        // Routing only applies when nothing is currently bound. Once an org
        // is active (initial resolution, user click, or earlier refetch),
        // leave it alone and just return fresh org data.
        var targetOrgId = null;
        if (!currentlyBound) {
          if (pushedOrgId) {
            targetOrgId = pushedOrgId;
          } else if (projectDefaultOrgId) {
            targetOrgId = projectDefaultOrgId;
          } else if (defaultOrgId && _statusHasUsableToken(pluginOrgStatus[defaultOrgId])) {
            targetOrgId = defaultOrgId;
          } else if (firstUsablePluginOrgId) {
            targetOrgId = firstUsablePluginOrgId;
          }
        }

        var refreshes = [];
        for (var r = 0; r < orgs.length; r++) {
          (function(org) {
            var status = pluginOrgStatus[org.id] || 'no-token';
            if (status !== 'expired_refreshable') return;
            refreshes.push(api.refreshOrgToken(org.id).then(function() {
              pluginOrgStatus[org.id] = 'valid';
            }).catch(function() {
              pluginOrgStatus[org.id] = 'expired_unrefreshable';
            }));
          })(orgs[r]);
        }

        return Promise.all(refreshes).then(function() {
          for (var o = 0; o < orgs.length; o++) {
            orgs[o].tokenStatus = pluginOrgStatus[orgs[o].id] || 'no-token';
          }

          var switchPromise = Promise.resolve();
          var strictTarget = !!(pushedOrgId || projectDefaultOrgId);
          if (strictTarget) {
            var strictTargetStatus = pluginOrgStatus[targetOrgId] || 'no-token';
            if (!_statusHasUsableToken(strictTargetStatus)) {
              throw new Error('DecidR organization context cannot be bound: ' + targetOrgId + ' is ' + strictTargetStatus + '. Connect this organization before opening the renderer.');
            }
          }
          if (targetOrgId && _statusHasUsableToken(pluginOrgStatus[targetOrgId])) {
            switchPromise = api.switchOrg(targetOrgId).catch(function(err) {
              if (strictTarget) throw err;
              // Fall through to whatever token autoInit last bound for
              // implicit preference/first-token routing only.
            });
          }

          return switchPromise;
        }).then(function() {
          return {
            organizations: orgs,
            defaultOrgId: projectDefaultOrgId || defaultOrgId,
            activeOrgId: api.getActiveOrgId()
          };
        });
      });
    },

    // --- GitHub endpoints ---

    listRepos: function(params) {
      return api.get('/github/repos' + _qs(params));
    },

    getRepo: function(id) {
      return api.get('/github/repos/' + id);
    },

    listIssues: function(params) {
      return api.get('/github/issues' + _qs(params));
    },

    getIssue: function(id) {
      return api.get('/github/issues/' + id);
    },

    listPRs: function(params) {
      return api.get('/github/prs' + _qs(params));
    },

    getPR: function(id) {
      return api.get('/github/prs/' + id);
    },

    getEntityGithubSummary: function(entityType, entityId) {
      return api.get('/github/entity-summary' + _qs({ entityType: entityType, entityId: entityId }));
    },

    getEntityGithubCounts: function(entityType, entityIds) {
      return api.get('/github/entity-counts' + _qs({ entityType: entityType, entityIds: entityIds.join(',') }));
    },

    // --- Generic entity dispatcher ---

    getEntity: function(entityType, entityId) {
      var fetchers = {
        initiative: api.getInitiative,
        project: api.getProject,
        decision: api.getDecision,
        task: api.getTask,
        bridge: api.getBridge,
        audit_event: api.getAuditEvent,
        'organization-settings': api.getOrganizationMemberSettings,
        ludflow_document: api.getLudflowDocument,
        external_document: function(id) {
          return Promise.reject(new Error('External document previews open from a linked document row'));
        },
        issue: function(id) { return api.getIssue(id); },
        pull_request: function(id) { return api.getPR(id); },
        repo: function(id) { return api.getRepo(id); }
      };
      var fn = fetchers[entityType];
      if (!fn) return Promise.reject(new Error('Unknown entity type: ' + entityType));
      return fn(entityId);
    },

    fetchEntities: function(refs) {
      var promises = [];
      for (var i = 0; i < refs.length; i++) {
        (function(ref, idx) {
          promises.push(
            api.getEntity(ref.type, ref.id)
              .then(function(entity) { return { ref: ref, entity: entity, index: idx }; })
              .catch(function(err) { return { ref: ref, error: err, index: idx }; })
          );
        })(refs[i], i);
      }
      return Promise.all(promises);
    }
  };

  // Expose hasToken check without exposing the token value
  Object.defineProperty(api, '_hasToken', {
    get: function() { return !!_token; },
    enumerable: false
  });

  window.__decidrAPI = api;
})();

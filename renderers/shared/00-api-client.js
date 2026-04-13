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
      // Skip empty segments, known resource names, and query strings
      if (!seg || seg.indexOf('?') !== -1) continue;
      if (/^[a-z_-]+$/.test(seg)) continue;
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

  function _hasTauri() {
    return window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function';
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

    createTask: function(data) {
      return api.post('/tasks', data);
    },

    createBridge: function(data) {
      return api.post('/bridges', data);
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

    updateTask: function(id, data) {
      return api.patch('/tasks/' + id, data);
    },

    updateBridge: function(id, data) {
      return api.patch('/bridges/' + id, data);
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

    listOrgMembers: function() {
      return api.get('/auth/members');
    },

    getOrganizationMemberSettings: function(orgId) {
      return api.get('/organizations/' + orgId + '/members');
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
     * Fetches organizations, plugin-org tokens, and user preferences in
     * parallel, annotates each org with `tokenStatus`, and — if no org is
     * currently bound to the client — resolves a target org and calls
     * switchOrg. Returns `{ organizations, defaultOrgId, activeOrgId }`.
     *
     * Routing is a no-op when `_activeOrgId` is already set, so this is safe
     * to call on every fetch pass (initial mount and subsequent refetches).
     * That invariant is what prevents refetches after a user click from
     * looping back to the default org.
     *
     * Target precedence when nothing is bound:
     *   1. `opts.pushedOrgId` (from MCP push data)
     *   2. `preferences.defaultOrganizationId` (if the user has a stored
     *      plugin token for it)
     *   3. none — the Tauri autoInit fallback token stays in place
     */
    resolveAndBindTargetOrg: function(opts) {
      opts = opts || {};
      var pushedOrgId = opts.pushedOrgId || null;
      return Promise.all([
        api.listOrganizations().catch(function() { return []; }),
        api.listPluginOrgs().catch(function() { return []; }),
        api.getUserPreferences().catch(function() { return null; })
      ]).then(function(results) {
        var orgs = results[0] || [];
        var pluginOrgs = results[1] || [];
        var prefs = results[2] || null;

        var pluginOrgSet = {};
        for (var i = 0; i < pluginOrgs.length; i++) {
          pluginOrgSet[pluginOrgs[i]] = true;
        }
        for (var o = 0; o < orgs.length; o++) {
          orgs[o].tokenStatus = pluginOrgSet[orgs[o].id] ? 'valid' : 'no-token';
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
          } else if (defaultOrgId && pluginOrgSet[defaultOrgId]) {
            targetOrgId = defaultOrgId;
          }
        }

        var switchPromise = Promise.resolve();
        if (targetOrgId) {
          switchPromise = api.switchOrg(targetOrgId).catch(function() {
            // Fall through to whatever token autoInit last bound. The
            // backend resolver fallback can still route MCP calls to the
            // user's default via their session preference.
          });
        }

        return switchPromise.then(function() {
          return {
            organizations: orgs,
            defaultOrgId: defaultOrgId,
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
        'organization-settings': api.getOrganizationMemberSettings,
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

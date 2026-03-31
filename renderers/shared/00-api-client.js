(function() {
  'use strict';

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

  function _headers(token, withBody) {
    var h = {};
    if (token) {
      h['Authorization'] = 'Bearer ' + token;
    }
    if (withBody) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  }

  function _handleResponse(response) {
    if (!response.ok) {
      throw new Error('API error: ' + response.status + ' ' + response.statusText);
    }
    return response.json();
  }

  var api = {
    _baseUrl: '',
    _token: '',
    _currentUserId: null,
    _initialized: false,

    init: function(baseUrl, token) {
      api._baseUrl = baseUrl.replace(/\/$/, '');
      api._token = token;
    },

    autoInit: function(meta) {
      if (api._initialized) {
        return Promise.resolve();
      }

      // Resolve base URL
      var base = '';
      if (meta && meta._api_base) {
        base = meta._api_base;
      } else if (window.__decidrManifest && window.__decidrManifest.mcp && window.__decidrManifest.mcp.url) {
        base = window.__decidrManifest.mcp.url.replace(/\/api\/mcp\/?$/, '/api');
      } else {
        base = 'http://localhost:3001/api';
      }

      api._baseUrl = base.replace(/\/$/, '');

      // Resolve token
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        return window.__TAURI__.core.invoke('get_plugin_auth_header', { pluginName: 'decidr' })
          .then(function(authHeader) {
            var token = (authHeader || '').replace(/^Bearer\s+/i, '');
            api._token = token;
            api._initialized = true;
            return api._fetchCurrentUser();
          })
          .catch(function() {
            api._token = window.__decidrToken || '';
            api._initialized = true;
            return api._fetchCurrentUser();
          });
      }

      api._token = window.__decidrToken || '';
      api._initialized = true;
      return api._fetchCurrentUser();
    },

    _fetchCurrentUser: function() {
      return fetch(api._baseUrl.replace(/\/api$/, '/api/auth/get-session'), {
        headers: _headers(api._token, false),
        credentials: 'include'
      }).then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (data && data.user && data.user.id) {
            api._currentUserId = data.user.id;
          }
        }).catch(function() { /* session fetch is best-effort */ });
    },

    withReady: function(container, meta, renderFn) {
      // Dependency guard
      if (!window.__decidrUI || !window.__decidrAPI) {
        var _retries = 0;
        var _check = setInterval(function() {
          _retries++;
          if (window.__decidrUI && window.__decidrAPI) {
            clearInterval(_check);
            api.withReady(container, meta, renderFn);
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

      api.autoInit(meta || {}).then(function() {
        renderFn(UI, api);
      }).catch(function(err) {
        container.innerHTML = '<div style="color:var(--color-error-text);padding:var(--space-4);">'
          + 'Init error: ' + (UI.escapeHtml ? UI.escapeHtml(String(err.message || err)) : String(err.message || err))
          + '</div>';
      });
    },

    get: function(path) {
      return fetch(api._baseUrl + path, {
        method: 'GET',
        headers: _headers(api._token, false)
      }).then(_handleResponse);
    },

    post: function(path, body) {
      return fetch(api._baseUrl + path, {
        method: 'POST',
        headers: _headers(api._token, true),
        body: JSON.stringify(body)
      }).then(_handleResponse);
    },

    patch: function(path, body) {
      return fetch(api._baseUrl + path, {
        method: 'PATCH',
        headers: _headers(api._token, true),
        body: JSON.stringify(body)
      }).then(_handleResponse);
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

    // --- Soft-delete endpoints ---

    deleteDecision: function(id) {
      return api.patch('/decisions/' + id, { deletedAt: new Date().toISOString() });
    },

    deleteTask: function(id) {
      return api.patch('/tasks/' + id, { deletedAt: new Date().toISOString() });
    },

    // --- Document linking ---

    linkEntityDocument: function(data) {
      return api.post('/documents', data);
    },

    listEntityDocuments: function(entityType, entityId) {
      return api.get('/documents' + _qs({ entityType: entityType, entityId: entityId }));
    },

    deleteDocument: function(id) {
      return fetch(api._baseUrl + '/documents/' + id, {
        method: 'DELETE',
        headers: _headers(api._token, false)
      }).then(_handleResponse);
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

    // --- Generic entity dispatcher ---

    getEntity: function(entityType, entityId) {
      var fetchers = {
        initiative: api.getInitiative,
        project: api.getProject,
        decision: api.getDecision,
        task: api.getTask,
        bridge: api.getBridge
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

  window.__decidrAPI = api;
})();

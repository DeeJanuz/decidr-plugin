(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  // ─── Shared reference to UI (set during render via withReady) ─────
  var UI;
  var _scrollState = { loading: false };
  var _scrollObserver = null;

  // ─── Helper: detect entity type from tool name ────────────────────

  function detectEntityType(toolName) {
    if (!toolName) return '';
    var match = toolName.match(/(?:list|get|create|update)_(\w+)/);
    if (!match) return '';
    var raw = match[1];
    var pluralMap = {
      initiatives: 'initiative',
      projects: 'project',
      decisions: 'decision',
      tasks: 'task',
      bridges: 'bridge'
    };
    return pluralMap[raw] || raw;
  }

  // ─── Helper: detect rendering mode from tool name ─────────────────

  function detectMode(toolName) {
    if (!toolName) return 'list';
    if (toolName === 'search') return 'search';
    if (toolName === 'my_action_items') return 'action_items';
    if (toolName === 'approve_decision') return 'approve';
    if (toolName === 'supersede_decision') return 'supersede';
    if (toolName === 'complete_task') return 'complete';
    if (toolName.indexOf('create_') === 0) return 'create';
    if (toolName.indexOf('update_') === 0) return 'update';
    if (toolName.indexOf('get_') === 0) return 'get';
    if (toolName.indexOf('list_') === 0) return 'list';
    return 'list';
  }

  // ─── Helper: human-readable entity type label ─────────────────────

  var ENTITY_TYPE_LABELS = {
    initiative: 'Initiative',
    project: 'Project',
    decision: 'Decision',
    task: 'Task',
    bridge: 'Bridge'
  };

  function entityLabel(type, plural) {
    var label = ENTITY_TYPE_LABELS[type] || type;
    if (plural) label += 's';
    return label;
  }

  // ─── Helper: get the display name/title for an entity ─────────────

  function entityDisplayName(entity) {
    return entity.name || entity.title || entity.id || '';
  }

  // ─── Helper: render a single entity card by type ──────────────────

  var CARD_RENDERERS = {
    project: function(entity, o, UI) { return UI.projectCard(entity, o); },
    decision: function(entity, o, UI) { return UI.decisionCard(entity, o); },
    task: function(entity, o, UI) { return UI.taskCard(entity, o); },
    bridge: function(entity, o, UI) { return UI.bridgeCard(entity, o); },
    initiative: function(entity, o, UI) { return UI.initiativeCard(entity, o); }
  };

  function renderCard(UI, entity, entityType, opts) {
    var o = opts || {};
    var renderer = CARD_RENDERERS[entityType];
    if (renderer) return renderer(entity, o, UI);
    // Fallback: generic card
    return '<div class="decidr-card" data-entity-type="' + UI.escapeHtml(entityType) + '" '
      + 'data-entity-id="' + UI.escapeHtml(entity.id) + '" style="cursor:pointer;">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-title">' + UI.escapeHtml(entityDisplayName(entity)) + '</span>'
      + (entity.status ? UI.statusBadge(entity.status) : '')
      + '</div>'
      + '</div>';
  }

  // ─── Helper: render a card grid container ─────────────────────────

  function cardGridOpen() {
    return '<div class="decidr-list-grid" style="display:flex;flex-direction:column;gap:var(--space-2);">';
  }

  function cardGridClose() {
    return '</div>';
  }

  // ─── Helper: render a section header ──────────────────────────────

  function sectionHeader(title, count) {
    var esc = (UI && UI.escapeHtml) ? UI.escapeHtml : function(s) { return String(s || ''); };
    var countHtml = (count !== null && count !== undefined)
      ? ' <span class="decidr-list-count" style="'
        + 'display:inline-flex;align-items:center;justify-content:center;'
        + 'min-width:20px;padding:0 6px;height:20px;'
        + 'border-radius:var(--border-radius-pill);'
        + 'background:var(--accent-primary-ghost);color:var(--accent-primary);'
        + 'font-size:var(--text-xs);font-weight:var(--weight-medium);'
        + '">' + count + '</span>'
      : '';
    return '<div style="font-size:var(--text-h2);font-weight:var(--weight-semibold);'
      + 'color:var(--text-primary);margin-bottom:var(--space-4);display:flex;'
      + 'align-items:center;gap:var(--space-2);">'
      + esc(title) + countHtml
      + '</div>';
  }

  // ─── Helper: render a success banner ──────────────────────────────

  function successBanner(message) {
    var esc = (UI && UI.escapeHtml) ? UI.escapeHtml : function(s) { return String(s || ''); };
    return '<div id="decidr-success-banner" style="'
      + 'background:var(--color-success-bg);border:1px solid var(--color-success);'
      + 'border-radius:var(--border-radius-md);padding:var(--space-4);'
      + 'margin-bottom:var(--space-6);display:flex;align-items:center;gap:var(--space-3);'
      + '">'
      + '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">'
      + '<circle cx="10" cy="10" r="9" stroke="var(--color-success)" stroke-width="1.5"/>'
      + '<path d="M6 10l3 3 5-6" stroke="var(--color-success)" stroke-width="1.5" '
      + 'stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>'
      + '<span style="color:var(--color-success-text);font-size:var(--text-body);'
      + 'font-weight:var(--weight-medium);">'
      + esc(message)
      + '</span>'
      + '</div>';
  }

  // ─── Helper: render metadata fields ───────────────────────────────

  function metadataField(label, value) {
    if (!value) return '';
    var esc = (UI && UI.escapeHtml) ? UI.escapeHtml : function(s) { return String(s || ''); };
    return '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2);">'
      + '<span style="color:var(--text-tertiary);font-size:var(--text-small);'
      + 'min-width:80px;">' + esc(label) + '</span>'
      + '<span style="color:var(--text-secondary);font-size:var(--text-small);">'
      + esc(value) + '</span>'
      + '</div>';
  }

  // ─── List Mode ────────────────────────────────────────────────────

  function renderList(container, items, entityType, meta, API) {
    var html = '';
    html += sectionHeader(entityLabel(entityType, true), meta.result_count || items.length);
    html += '<div id="decidr-list-items">';
    html += cardGridOpen();

    for (var i = 0; i < items.length; i++) {
      html += renderCard(UI, items[i], entityType, { animDelay: i * 0.05 });
    }

    html += cardGridClose();
    html += '</div>';

    if (meta.has_more) {
      html += '<div id="decidr-scroll-sentinel" style="height:1px;"></div>';
    }

    container.innerHTML = html;

    // For project cards, fetch decisions/tasks counts
    if (entityType === 'project') {
      fetchProjectStats(items, API);
    }

    if (meta.has_more) {
      wireInfiniteScroll(container, entityType, items.length, meta, API);
    }

    wireEntityLinks(container);
  }

  function fetchProjectStats(projects, API) {
    for (var i = 0; i < projects.length; i++) {
      (function(proj) {
        API.getProject(proj.id).then(function(fullProj) {
          var cardEl = document.querySelector(
            '[data-entity-type="project"][data-entity-id="' + proj.id + '"]'
          );
          if (cardEl && fullProj) {
            var decisions = fullProj.decisions || [];
            var tasks = fullProj.tasks || [];
            cardEl.outerHTML = UI.projectCard(fullProj, { decisions: decisions, tasks: tasks });
            // Re-wire the replaced element
            var newCard = document.querySelector(
              '[data-entity-type="project"][data-entity-id="' + proj.id + '"]'
            );
            if (newCard) {
              newCard.addEventListener('click', function() {
                UI.SlideOut.open('project', proj.id);
              });
            }
          }
        }).catch(function() {
          // Silently ignore — card already renders without stats
        });
      })(projects[i]);
    }
  }

  function wireInfiniteScroll(container, entityType, loadedCount, meta, API) {
    if (_scrollObserver) {
      _scrollObserver.disconnect();
      _scrollObserver = null;
    }

    var sentinel = container.querySelector('#decidr-scroll-sentinel');
    if (!sentinel) return;

    var currentOffset = loadedCount;
    var pageSize = loadedCount;

    _scrollObserver = new IntersectionObserver(function(entries) {
      for (var ei = 0; ei < entries.length; ei++) {
        if (!entries[ei].isIntersecting) continue;
        if (_scrollState.loading) return;

        _scrollState.loading = true;
        if (_scrollObserver) {
          _scrollObserver.disconnect();
          _scrollObserver = null;
        }

        var params = { skip: currentOffset, take: pageSize };

        var fetchFn;
        if (entityType === '_action_items') {
          fetchFn = function(p) { return API.getActionItems(p); };
        } else {
          var LIST_FETCHERS = {
            initiative: API.listInitiatives,
            project: API.listProjects,
            decision: API.listDecisions,
            task: API.listTasks,
            bridge: API.listBridges
          };
          fetchFn = LIST_FETCHERS[entityType];
        }

        if (!fetchFn) {
          _scrollState.loading = false;
          return;
        }

        fetchFn(params).then(function(result) {
          var newItems;
          if (entityType === '_action_items') {
            newItems = result.data || (Array.isArray(result) ? result : []);
          } else {
            newItems = Array.isArray(result) ? result : (result.data || []);
          }

          if (newItems.length === 0) {
            var oldSentinel = container.querySelector('#decidr-scroll-sentinel');
            if (oldSentinel) oldSentinel.remove();
            _scrollState.loading = false;
            return;
          }

          // Find the appropriate list container
          var listEl = container.querySelector('#decidr-action-list') || container.querySelector('.decidr-list-grid');
          if (!listEl) {
            _scrollState.loading = false;
            return;
          }

          // Remove old sentinel
          var oldSentinel = container.querySelector('#decidr-scroll-sentinel');
          if (oldSentinel) oldSentinel.remove();

          // Render new cards
          var fragment = '';
          for (var i = 0; i < newItems.length; i++) {
            if (entityType === '_action_items') {
              fragment += UI.nextStepCard(newItems[i], { animDelay: i * 0.05 });
            } else {
              fragment += renderCard(UI, newItems[i], entityType, { animDelay: i * 0.05 });
            }
          }
          listEl.insertAdjacentHTML('beforeend', fragment);

          currentOffset += newItems.length;

          if (entityType === 'project') {
            fetchProjectStats(newItems, API);
          }

          wireEntityLinks(container);

          // Check if more items remain
          var hasMore;
          if (result.has_more !== undefined) {
            hasMore = result.has_more;
          } else if (result.meta && result.meta.has_more !== undefined) {
            hasMore = result.meta.has_more;
          } else {
            hasMore = newItems.length >= pageSize;
          }

          if (hasMore) {
            listEl.insertAdjacentHTML('afterend', '<div id="decidr-scroll-sentinel" style="height:1px;"></div>');
            wireInfiniteScroll(container, entityType, currentOffset, meta, API);
          }

          _scrollState.loading = false;
        }).catch(function() {
          _scrollState.loading = false;
        });
      }
    });

    _scrollObserver.observe(sentinel);
  }

  // ─── Detail Mode (get / inline detail) ────────────────────────────

  function renderDetail(container, entity, entityType, API) {
    var html = '<div id="decidr-detail-view" style="'
      + 'background:var(--glass-bg);border:1px solid var(--glass-border);'
      + 'border-radius:var(--border-radius-lg);padding:var(--space-6);'
      + 'backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur));">';

    // Header: entity type badge + status badge
    html += '<div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);">'
      + UI.entityTypeBadge(entityType)
      + (entity.status ? ' ' + UI.statusBadge(entity.status) : '')
      + '</div>';

    // Title
    html += '<h2 style="font-size:var(--text-h1);font-weight:var(--weight-bold);'
      + 'color:var(--text-primary);margin:0 0 var(--space-4) 0;line-height:var(--leading-tight);">'
      + UI.escapeHtml(entityDisplayName(entity))
      + '</h2>';

    // Description
    if (entity.description) {
      html += '<p style="color:var(--text-secondary);font-size:var(--text-body);'
        + 'line-height:var(--leading-normal);margin:0 0 var(--space-6) 0;">'
        + UI.escapeHtml(entity.description)
        + '</p>';
    }

    // Metadata
    html += '<div style="margin-bottom:var(--space-6);">';
    html += metadataField('ID', entity.id);
    html += metadataField('Created', entity.createdAt ? UI.formatDate(entity.createdAt) : '');
    html += metadataField('Updated', entity.updatedAt ? UI.formatDate(entity.updatedAt) : '');
    if (entity.dueDate) {
      html += metadataField('Due Date', UI.formatDate(entity.dueDate));
    }
    if (entity.priority) {
      html += '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2);">'
        + '<span style="color:var(--text-tertiary);font-size:var(--text-small);'
        + 'min-width:80px;">Priority</span>'
        + UI.priorityBadge(entity.priority)
        + '</div>';
    }
    html += '</div>';

    // Related entities placeholder (loaded async)
    html += '<div id="decidr-detail-related">'
      + UI.loadingSpinner('Loading related entities...')
      + '</div>';

    html += '</div>';

    container.innerHTML = html;

    // Fetch and render related entities
    fetchRelatedEntities(container, entity, entityType, API);
  }

  var RELATED_FETCHERS = {
    project: function(relatedEl, entity, API) { fetchProjectRelated(relatedEl, entity, API); },
    decision: function(relatedEl, entity, API) { fetchDecisionRelated(relatedEl, entity, API); },
    bridge: function(relatedEl, entity) { renderBridgeRelated(relatedEl, entity); },
    initiative: function(relatedEl, entity, API) { fetchInitiativeRelated(relatedEl, entity, API); }
  };

  function fetchRelatedEntities(container, entity, entityType, API) {
    var relatedEl = container.querySelector('#decidr-detail-related');
    if (!relatedEl) return;

    var fetcher = RELATED_FETCHERS[entityType];
    if (fetcher) {
      fetcher(relatedEl, entity, API);
    } else {
      // Tasks and others: render inline data if present, otherwise clear
      renderInlineRelated(relatedEl, entity);
    }
  }

  function fetchProjectRelated(relatedEl, project, API) {
    API.getProject(project.id).then(function(fullProject) {
      var html = '';
      var decisions = fullProject.decisions || project.decisions || [];
      var tasks = fullProject.tasks || project.tasks || [];
      var bridges = fullProject.bridges || project.bridges || [];

      if (decisions.length > 0) {
        html += UI.section('Decisions', decisions.length,
          cardGridOpen()
          + decisions.map(function(d, i) {
            return UI.decisionCard(d, { animDelay: i * 0.05 });
          }).join('')
          + cardGridClose()
        );
      }

      if (tasks.length > 0) {
        html += UI.section('Tasks', tasks.length,
          cardGridOpen()
          + tasks.map(function(t, i) {
            return UI.taskCard(t, { animDelay: i * 0.05 });
          }).join('')
          + cardGridClose()
        );
      }

      if (bridges.length > 0) {
        html += UI.section('Bridges', bridges.length,
          cardGridOpen()
          + bridges.map(function(b, i) {
            return UI.bridgeCard(b, { animDelay: i * 0.05 });
          }).join('')
          + cardGridClose()
        );
      }

      if (!html) {
        html = UI.emptyState('No related entities found.');
      }

      relatedEl.innerHTML = html;
      wireEntityLinks(relatedEl);
    }).catch(function() {
      relatedEl.innerHTML = UI.emptyState('Failed to load related entities.');
    });
  }

  function fetchDecisionRelated(relatedEl, decision, API) {
    API.getDecision(decision.id).then(function(fullDecision) {
      var html = '';
      var tasks = fullDecision.tasks || decision.tasks || [];

      if (tasks.length > 0) {
        html += UI.section('Tasks', tasks.length,
          cardGridOpen()
          + tasks.map(function(t, i) {
            return UI.taskCard(t, { animDelay: i * 0.05 });
          }).join('')
          + cardGridClose()
        );
      }

      // Alternatives (non-navigable)
      var alternatives = fullDecision.alternatives || decision.alternatives || [];
      if (alternatives.length > 0) {
        var altHtml = '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
        for (var a = 0; a < alternatives.length; a++) {
          var alt = alternatives[a];
          var altTitle = alt.title || alt.name || alt;
          altHtml += '<div class="decidr-card" style="padding:var(--space-3);">'
            + '<span style="color:var(--text-primary);font-size:var(--text-body);">'
            + UI.escapeHtml(altTitle)
            + '</span>'
            + '</div>';
        }
        altHtml += '</div>';
        html += UI.section('Alternatives', alternatives.length, altHtml);
      }

      if (!html) {
        html = UI.emptyState('No related entities found.');
      }

      relatedEl.innerHTML = html;
      wireEntityLinks(relatedEl);
    }).catch(function() {
      relatedEl.innerHTML = UI.emptyState('Failed to load related entities.');
    });
  }

  function renderBridgeRelated(relatedEl, bridge) {
    var html = '';

    if (bridge.fromProject) {
      html += UI.section('From Project', null,
        cardGridOpen()
        + UI.projectCard(bridge.fromProject)
        + cardGridClose()
      );
    }

    if (bridge.toProject) {
      html += UI.section('To Project', null,
        cardGridOpen()
        + UI.projectCard(bridge.toProject)
        + cardGridClose()
      );
    }

    var decisions = bridge.decisions || [];
    if (decisions.length > 0) {
      html += UI.section('Decisions', decisions.length,
        cardGridOpen()
        + decisions.map(function(d, i) {
          return UI.decisionCard(d, { animDelay: i * 0.05 });
        }).join('')
        + cardGridClose()
      );
    }

    if (!html) {
      html = UI.emptyState('No related entities found.');
    }

    relatedEl.innerHTML = html;
    wireEntityLinks(relatedEl);
  }

  function fetchInitiativeRelated(relatedEl, initiative, API) {
    API.listProjects({ initiative_id: initiative.id }).then(function(result) {
      var projects = Array.isArray(result) ? result : (result.data || []);
      var html = '';

      if (projects.length > 0) {
        html += UI.section('Projects', projects.length,
          cardGridOpen()
          + projects.map(function(p, i) {
            return UI.projectCard(p, { animDelay: i * 0.05 });
          }).join('')
          + cardGridClose()
        );
      }

      if (!html) {
        html = UI.emptyState('No related projects found.');
      }

      relatedEl.innerHTML = html;
      wireEntityLinks(relatedEl);
    }).catch(function() {
      relatedEl.innerHTML = UI.emptyState('Failed to load related projects.');
    });
  }

  function renderInlineRelated(relatedEl, entity) {
    var html = '';

    // Task might have parent decision or project
    if (entity.decision) {
      html += UI.section('Parent Decision', null,
        cardGridOpen()
        + UI.decisionCard(entity.decision)
        + cardGridClose()
      );
    }

    if (entity.project) {
      html += UI.section('Project', null,
        cardGridOpen()
        + UI.projectCard(entity.project)
        + cardGridClose()
      );
    }

    if (!html) {
      relatedEl.innerHTML = '';
      return;
    }

    relatedEl.innerHTML = html;
    wireEntityLinks(relatedEl);
  }

  // ─── Search Results Mode ──────────────────────────────────────────

  function renderSearchResults(container, items) {
    if (!items || items.length === 0) {
      container.innerHTML = sectionHeader('Search Results', 0)
        + UI.emptyState('No results found.');
      return;
    }

    // Render in payload order — agent controls ranking/priority
    var html = sectionHeader('Search Results', items.length);

    html += cardGridOpen();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var type = (item.entityType || 'unknown').toLowerCase();
      html += renderCard(UI, item, type, { animDelay: i * 0.05 });
    }
    html += cardGridClose();

    container.innerHTML = html;
    wireEntityLinks(container);
  }

  // ─── Action Items Mode ────────────────────────────────────────────

  function isRefPayload(items) {
    return items.length > 0 && !items[0].title;
  }

  function inferPriority(entity) {
    var s = (entity.status || '').toUpperCase();
    if (s === 'BLOCKED' || s === 'OPEN' || s === 'PROPOSED') return 'high';
    if (s === 'IN_PROGRESS' || s === 'UNDER_DISCUSSION') return 'medium';
    return 'low';
  }

  function inferReason(entity, entityType) {
    var s = (entity.status || '').toUpperCase();
    if (s === 'BLOCKED') return 'Blocked — needs attention';
    if (entityType === 'decision' && (s === 'OPEN' || s === 'PROPOSED' || s === 'UNDER_DISCUSSION')) {
      return 'Decision pending';
    }
    if (entityType === 'task' && (s === 'TODO' || s === 'IN_PROGRESS')) {
      return 'Task in progress';
    }
    return '';
  }

  function entityToActionItem(entity, entityType) {
    var parentName = '';
    if (entity.decision && entity.decision.title) parentName = entity.decision.title;
    else if (entity.project && entity.project.name) parentName = entity.project.name;
    else if (entity.bridge && entity.bridge.name) parentName = entity.bridge.name;

    return {
      entityType: entityType,
      entityId: entity.id,
      title: entity.title || entity.name || '',
      status: entity.status || '',
      priority: entity.priority || inferPriority(entity),
      reason: inferReason(entity, entityType),
      parentName: parentName,
      createdAt: entity.createdAt || ''
    };
  }

  function renderActionItems(container, items, meta, API) {
    if (!items || items.length === 0) {
      container.innerHTML = sectionHeader('Action Items', 0)
        + UI.emptyState('No action items found.');
      return;
    }

    // Detect payload shape: refs vs full objects
    if (isRefPayload(items)) {
      renderActionItemsFromRefs(container, items, meta, API);
    } else {
      renderActionItemsFull(container, items, meta, API);
    }
  }

  function renderActionItemsFull(container, items, meta, API) {
    var totalCount = (meta && meta.total_count) ? meta.total_count : items.length;
    var html = '';
    html += sectionHeader('Action Items', totalCount);
    html += '<div id="decidr-action-list" style="display:flex;flex-direction:column;gap:var(--space-2);">';

    for (var i = 0; i < items.length; i++) {
      html += UI.nextStepCard(items[i], { animDelay: i * 0.05 });
    }

    html += '</div>';

    if (meta && meta.has_more) {
      html += '<div id="decidr-scroll-sentinel" style="height:1px;"></div>';
    }

    container.innerHTML = html;
    wireEntityLinks(container);

    if (meta && meta.has_more) {
      wireInfiniteScroll(container, '_action_items', items.length, meta, API);
    }
  }

  function renderActionItemsFromRefs(container, refs, meta, API) {
    var html = '';
    html += sectionHeader('Action Items', refs.length);
    html += '<div id="decidr-action-list" style="display:flex;flex-direction:column;gap:var(--space-2);">';

    for (var i = 0; i < refs.length; i++) {
      html += '<div data-ref-index="' + i + '">'
        + UI.nextStepCardSkeleton({ animDelay: i * 0.05 })
        + '</div>';
    }

    html += '</div>';

    if (meta && meta.has_more) {
      html += '<div id="decidr-scroll-sentinel" style="height:1px;"></div>';
    }

    container.innerHTML = html;

    // Hydrate each ref progressively
    for (var j = 0; j < refs.length; j++) {
      (function(ref, index) {
        API.getEntity(ref.entityType, ref.entityId).then(function(entity) {
          var slot = container.querySelector('[data-ref-index="' + index + '"]');
          if (!slot) return;
          var actionItem = entityToActionItem(entity, ref.entityType);
          slot.innerHTML = UI.nextStepCard(actionItem, { animDelay: 0 });
          wireEntityLinks(slot);
        }).catch(function(err) {
          var slot = container.querySelector('[data-ref-index="' + index + '"]');
          if (!slot) return;
          slot.innerHTML = '<div class="decidr-next-step-item" style="border-color:var(--color-error);">'
            + '<div class="decidr-next-step-icon" style="color:var(--color-error);">'
            + '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">'
            + '<circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>'
            + '<path d="M10 6v5M10 13.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
            + '</svg></div>'
            + '<div class="decidr-next-step-body">'
            + '<div class="decidr-next-step-title" style="color:var(--color-error-text);">Failed to load ' + UI.escapeHtml(ref.entityType) + '</div>'
            + '<div class="decidr-next-step-meta">' + UI.escapeHtml(ref.entityId) + '</div>'
            + '</div></div>';
        });
      })(refs[j], j);
    }

    if (meta && meta.has_more) {
      wireInfiniteScroll(container, '_action_items', refs.length, meta, API);
    }
  }

  // ─── Success + Detail Mode (create / update / approve / etc.) ─────

  function renderSuccess(container, message, entity, entityType, API) {
    var bannerHtml = successBanner(message);
    container.innerHTML = bannerHtml + '<div id="decidr-success-detail"></div>';

    var detailContainer = container.querySelector('#decidr-success-detail');
    if (detailContainer && entity && entityType) {
      renderDetail(detailContainer, entity, entityType, API);
    }
  }

  // ─── Wire entity click handlers ───────────────────────────────────

  function wireEntityLinks(root) {
    var items = root.querySelectorAll('[data-entity-type][data-entity-id]');
    for (var i = 0; i < items.length; i++) {
      (function(el) {
        // Avoid double-binding by checking a flag
        if (el.getAttribute('data-decidr-wired')) return;
        el.setAttribute('data-decidr-wired', '1');

        el.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var type = el.getAttribute('data-entity-type');
          var id = el.getAttribute('data-entity-id');
          if (type && id) {
            UI.SlideOut.open(type, id);
          }
        });
      })(items[i]);
    }
  }

  // ─── Approval detail helpers ──────────────────────────────────────

  function renderApprovalDetail(container, data, API) {
    var decision = data.decision || data;
    var approvalInfo = '';

    if (data.approvalsSatisfied !== undefined) {
      var satisfiedLabel = data.approvalsSatisfied ? 'Yes' : 'No';
      var satisfiedColor = data.approvalsSatisfied
        ? 'var(--color-success-text)' : 'var(--color-warning-text)';

      approvalInfo = '<div style="'
        + 'background:var(--glass-bg);border:1px solid var(--glass-border);'
        + 'border-radius:var(--border-radius-md);padding:var(--space-4);'
        + 'margin-bottom:var(--space-4);'
        + '">'
        + '<div style="font-size:var(--text-h3);font-weight:var(--weight-semibold);'
        + 'color:var(--text-primary);margin-bottom:var(--space-3);">Approval Status</div>'
        + '<div style="display:flex;gap:var(--space-6);">'
        + '<div>'
        + '<span style="color:var(--text-tertiary);font-size:var(--text-small);">Satisfied</span>'
        + '<div style="color:' + satisfiedColor + ';font-size:var(--text-body);'
        + 'font-weight:var(--weight-medium);">' + satisfiedLabel + '</div>'
        + '</div>';

      if (data.currentApprovals !== undefined || data.requiredApprovals !== undefined) {
        approvalInfo += '<div>'
          + '<span style="color:var(--text-tertiary);font-size:var(--text-small);">Approvals</span>'
          + '<div style="color:var(--text-primary);font-size:var(--text-body);'
          + 'font-weight:var(--weight-medium);">'
          + (data.currentApprovals || 0) + ' / ' + (data.requiredApprovals || '?')
          + '</div>'
          + '</div>';
      }

      approvalInfo += '</div></div>';
    }

    var bannerMsg = 'Decision approved successfully';
    container.innerHTML = successBanner(bannerMsg)
      + approvalInfo
      + '<div id="decidr-success-detail"></div>';

    var detailContainer = container.querySelector('#decidr-success-detail');
    if (detailContainer && decision) {
      renderDetail(detailContainer, decision, 'decision', API);
    }
  }

  // ─── Ref-Only Rendering ───────────────────────────────────────────

  function renderRefOnly(container, refs, meta, API) {
    var entityType = '';
    if (refs.length > 0) entityType = refs[0].type || '';

    var allSameType = true;
    for (var i = 1; i < refs.length; i++) {
      if (refs[i].type !== entityType) { allSameType = false; break; }
    }

    var title = allSameType ? entityLabel(entityType, true) : 'Entities';

    container.innerHTML = '<div id="decidr-render-root" style="padding:var(--space-4);"></div>';
    var root = container.querySelector('#decidr-render-root');

    // Show skeletons
    var html = sectionHeader(title, refs.length);
    html += cardGridOpen();
    for (var j = 0; j < refs.length; j++) {
      html += '<div data-ref-index="' + j + '">'
        + '<div class="decidr-card" style="min-height:60px;display:flex;align-items:center;padding:var(--space-4);">'
        + UI.loadingSpinner('Loading ' + (refs[j].type || 'entity') + '...')
        + '</div></div>';
    }
    html += cardGridClose();
    root.innerHTML = html;

    // Fetch all entities
    API.fetchEntities(refs).then(function(results) {
      results.sort(function(a, b) { return a.index - b.index; });

      for (var k = 0; k < results.length; k++) {
        var result = results[k];
        var slot = root.querySelector('[data-ref-index="' + result.index + '"]');
        if (!slot) continue;

        if (result.error) {
          slot.innerHTML = '<div class="decidr-card" style="border-color:var(--color-error);padding:var(--space-4);">'
            + '<span style="color:var(--color-error-text);">Failed to load '
            + UI.escapeHtml(result.ref.type || 'entity') + ': '
            + UI.escapeHtml(result.ref.id || '') + '</span>'
            + '</div>';
        } else {
          var type = result.ref.type || '';
          slot.innerHTML = renderCard(UI, result.entity, type, { animDelay: k * 0.03 });
        }
      }

      wireEntityLinks(root);

      if (allSameType && entityType === 'project') {
        var entities = results.filter(function(r) { return r.entity; }).map(function(r) { return r.entity; });
        fetchProjectStats(entities, API);
      }
    });
  }

  // ─── Main Renderer Entry Point ────────────────────────────────────

  window.__renderers.decidr_list = function(container, data, meta, toolArgs, reviewRequired, onDecision) {
    container.innerHTML = '';

    window.__decidrAPI.withReady(container, meta, function() {
      UI = window.__decidrUI;
      var API = window.__decidrAPI;

      // MCPViews may pass tool meta inside data.meta; merge it into meta
      if (data && !Array.isArray(data) && data.meta && data.meta.tool_name) {
        meta = data.meta;
        data = data.data || data;
      }

      // Ref-only mode: data.entities = [{type, id}, ...]
      if (data && data.entities && Array.isArray(data.entities)) {
        renderRefOnly(container, data.entities, meta || {}, API);
        return;
      }

      var toolName = (meta && meta.tool_name) ? meta.tool_name : '';
      var mode = detectMode(toolName);
      var entityType = detectEntityType(toolName);

      function renderAsync() {
        try {
          container.innerHTML = '<div id="decidr-render-root" style="padding:var(--space-4);"></div>';
          var root = container.querySelector('#decidr-render-root');

          if (mode === 'list') {
            var items = Array.isArray(data) ? data : (data.data || []);
            renderList(root, items, entityType, meta || {}, API);
          } else if (mode === 'get') {
            renderList(root, [data], entityType, meta || {}, API);
          } else if (mode === 'search') {
            var searchItems = Array.isArray(data) ? data : (data.data || []);
            renderSearchResults(root, searchItems);
          } else if (mode === 'action_items') {
            var actionItems = Array.isArray(data) ? data : (data.data || []);
            renderActionItems(root, actionItems, meta || {}, API);
          } else if (mode === 'create') {
            renderSuccess(root, entityLabel(entityType) + ' created successfully', data, entityType, API);
          } else if (mode === 'update') {
            renderSuccess(root, entityLabel(entityType) + ' updated successfully', data, entityType, API);
          } else if (mode === 'approve') {
            renderApprovalDetail(root, data, API);
          } else if (mode === 'supersede') {
            var supersededDecision = data.decision || data;
            renderSuccess(root, 'Decision superseded successfully', supersededDecision, 'decision', API);
          } else if (mode === 'complete') {
            var completedTask = data.task || data;
            renderSuccess(root, 'Task completed successfully', completedTask, 'task', API);
          } else {
            if (Array.isArray(data)) {
              renderList(root, data, entityType || 'unknown', meta || {}, API);
            } else if (data && typeof data === 'object') {
              renderDetail(root, data, entityType || 'unknown', API);
            } else {
              root.innerHTML = UI.emptyState('No data to display.');
            }
          }
        } catch (err) {
          container.innerHTML = '<div style="color:var(--color-error-text);padding:var(--space-4);">'
            + 'Render error: ' + UI.escapeHtml(String(err.message || err))
            + '</div>';
        }
      }

      renderAsync();
    });
  };

})();

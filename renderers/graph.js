(function() {
  'use strict';
  window.__renderers = window.__renderers || {};

  window.__renderers.decidr_graph = function(container, data, meta, toolArgs, reviewRequired, onDecision) {
    container.innerHTML = '';

    var _orgId = (data && data.organization_id) ? data.organization_id : null;
    window.__decidrAPI.withReady(container, meta, function() {
    var UI = window.__decidrUI;
    var API = window.__decidrAPI;

    // ── State ─────────────────────────────────────────────────
    var graphState = {
      selectedNode: null,       // { type: 'project', id: '...' }
      transform: { x: 0, y: 0, k: 1 },
      // Org picker
      organizations: [],
      activeOrgId: null
    };

    var currentLayout = null;
    var graphData = null;

    // ── Cached DOM refs (set after SVG insertion) ─────────────
    var cachedZoomLayer = null;
    var cachedSummaryLayer = null;
    var cachedDetailLayer = null;
    var cachedSvgEl = null;

    // ── RAF throttle state ────────────────────────────────────
    var rafPending = false;

    // ── Constants ─────────────────────────────────────────────
    var DECISION_STATUS_CONFIG = [
      { key: 'implemented', label: 'Implemented', color: 'var(--decision-approved)' },
      { key: 'approved', label: 'Approved', color: 'var(--decision-proposed)' },
      { key: 'proposed', label: 'Proposed', color: 'var(--priority-medium)' },
      { key: 'superseded', label: 'Superseded', color: 'var(--decision-superseded)' }
    ];

    var PROJECT_STAGE_CONFIG = [
      { key: 'backlog', label: 'Backlog', color: '#9ca3af' },
      { key: 'planning', label: 'Planning', color: '#3b82f6' },
      { key: 'active', label: 'Active', color: '#22c55e' },
      { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
      { key: 'implemented', label: 'Implemented', color: '#22c55e' },
      { key: 'completed', label: 'Completed', color: '#22c55e' },
      { key: 'maintenance', label: 'Maintenance', color: '#f59e0b' },
      { key: 'on_hold', label: 'On Hold', color: '#f59e0b' },
      { key: 'archived', label: 'Archived', color: '#6b7280' }
    ];

    var GRAPH_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

    // ── Edge lookup maps (built after layout) ─────────────────
    var edgesBySource = {};
    var edgesByTarget = {};

    // ── Show loading ──────────────────────────────────────────
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;'
      + 'height:100%;min-height:400px;">'
      + UI.loadingSpinner('Loading graph...')
      + '</div>';

    // ── Fetch all data (single batch — no N+1) ───────────────
    _fetchGraphData().then(function(gd) {
      graphData = gd;
      renderGraphWithData(gd);
    }).catch(function(err) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;'
        + 'height:100%;min-height:400px;">'
        + UI.emptyState('Failed to load graph data: ' + (err.message || err))
        + '</div>';
    });

    // ── Utility: extract array from API response ──────────────
    function _extractArray(resp) {
      if (Array.isArray(resp)) return resp;
      if (resp && resp.data && Array.isArray(resp.data)) return resp.data;
      if (resp && Array.isArray(resp.items)) return resp.items;
      if (resp && Array.isArray(resp.results)) return resp.results;
      return [];
    }

    // ── Fetch + derive graph data (single source of truth) ────
    function _fetchGraphData() {
      return Promise.all([
        API.listInitiatives(),
        API.listBridges(),
        API.listDecisions(),
        API.listProjects(),
        API.listOrgMembers(),
        API.listOrganizations().catch(function() { return []; }),
        API.listPluginOrgs().catch(function() { return []; })
      ]).then(function(results) {
        var initiatives = _extractArray(results[0]);
        var allBridges = _extractArray(results[1]);
        var allDecisions = _extractArray(results[2]);
        var allProjects = _extractArray(results[3]);
        var allMembers = _extractArray(results[4]);

        // Merge org token status
        var orgs = results[5] || [];
        var pluginOrgs = results[6] || [];
        var pluginOrgSet = {};
        for (var po = 0; po < pluginOrgs.length; po++) {
          pluginOrgSet[pluginOrgs[po]] = true;
        }
        for (var o = 0; o < orgs.length; o++) {
          orgs[o].tokenStatus = pluginOrgSet[orgs[o].id] ? 'valid' : 'no-token';
        }
        graphState.organizations = orgs;
        if (!graphState.activeOrgId && orgs.length > 0) {
          if (data && data.organization_id) {
            graphState.activeOrgId = data.organization_id;
          } else {
            graphState.activeOrgId = orgs[0].id;
          }
        }

        // Build user lookup map
        var userMap = {};
        for (var u = 0; u < allMembers.length; u++) {
          var member = allMembers[u];
          var uid = member.id || member.userId || member.user_id;
          if (uid) userMap[uid] = member;
        }

        // Projects have direct initiativeId FK
        var projectInitMap = {};
        var projectLookup = {};
        for (var pi = 0; pi < allProjects.length; pi++) {
          projectLookup[allProjects[pi].id] = allProjects[pi];
          var directInit = allProjects[pi].initiativeId || allProjects[pi].initiative_id;
          if (directInit) {
            if (!projectInitMap[allProjects[pi].id]) projectInitMap[allProjects[pi].id] = {};
            projectInitMap[allProjects[pi].id][directInit] = true;
          }
        }

        // Group projects by initiative_id
        var projectsByInit = {};
        for (var projId in projectInitMap) {
          if (!projectInitMap.hasOwnProperty(projId)) continue;
          var proj = projectLookup[projId];
          if (!proj) continue;
          var initIds = projectInitMap[projId];
          for (var initKey in initIds) {
            if (!initIds.hasOwnProperty(initKey)) continue;
            if (!projectsByInit[initKey]) projectsByInit[initKey] = [];
            projectsByInit[initKey].push(proj);
          }
        }

        // Fetch GitHub counts for all project IDs (fire-and-forget, re-renders on completion)
        var ghProjectIds = [];
        for (var gpi = 0; gpi < allProjects.length; gpi++) {
          ghProjectIds.push(allProjects[gpi].id);
        }
        if (ghProjectIds.length) {
          API.getEntityGithubCounts('PROJECT', ghProjectIds).then(function(result) {
            graphState.githubCounts = result || {};
          }).catch(function() { graphState.githubCounts = {}; });
        }

        return {
          initiatives: initiatives,
          projectsByInit: projectsByInit,
          bridges: allBridges,
          decisions: allDecisions,
          userMap: userMap
        };
      });
    }

    // ── Utility: truncate label ───────────────────────────────
    function truncateLabel(str, max) {
      if (!str) return '';
      if (str.length <= max) return str;
      return str.slice(0, max - 1) + '\u2026';
    }

    // ── Color helpers ─────────────────────────────────────────
    /* Bridge type colors kept as literals — values feed into SVG stroke attributes
       where CSS custom properties are not supported. Matches:
       #a78bfa = --entity-bridge, #2dd4bf = --entity-task,
       #fbbf24 = no exact token (shared resource amber) */
    function getBridgeTypeColor(type) {
      var map = {
        dependency: '#a78bfa',
        data_flow: '#2dd4bf',
        shared_resource: '#fbbf24',
        DEPENDENCY: '#a78bfa',
        DATA_FLOW: '#2dd4bf',
        SHARED_RESOURCE: '#fbbf24'
      };
      return map[type] || '#a78bfa';
    }

    function getProjectColor(project) {
      return UI.sanitizeColor(project.color || '#60a5fa'); /* matches --entity-project; kept as literal for SVG attribute compatibility */
    }

    function _graphStatusColor(status) {
      var map = { active: '#22c55e', planning: '#3b82f6', completed: '#6b7280',
                  proposed: '#f59e0b', in_progress: '#3b82f6', implemented: '#22c55e' };
      return map[status] || '#6b7280';
    }

    // ── Data helpers ──────────────────────────────────────────
    function getProjectDecisions(projectId, allDecisions) {
      var result = [];
      for (var i = 0; i < allDecisions.length; i++) {
        var d = allDecisions[i];
        var et = (d.entityType || d.entity_type || '').toUpperCase();
        if (et === 'PROJECT' &&
            (d.projectId === projectId || d.project_id === projectId ||
             d.entityId === projectId || d.entity_id === projectId)) {
          result.push(d);
        }
      }
      return result;
    }

    function countDecisionsByStatus(decisions) {
      var counts = { proposed: 0, approved: 0, implemented: 0, superseded: 0, other: 0 };
      for (var i = 0; i < decisions.length; i++) {
        var st = (decisions[i].status || '').toLowerCase().replace(/\s+/g, '_');
        if (st === 'proposed' || st === 'under_discussion' || st === 'open' || st === 'in_progress') {
          counts.proposed++;
        } else if (st === 'approved' || st === 'agreed') {
          counts.approved++;
        } else if (st === 'implemented' || st === 'decided') {
          counts.implemented++;
        } else if (st === 'superseded') {
          counts.superseded++;
        } else {
          counts.other++;
        }
      }
      return counts;
    }

    function _getUserFromMap(ownerId, userMap) {
      if (!ownerId || !userMap) return null;
      return userMap[ownerId] || null;
    }

    function _getOwnerName(user) {
      if (!user) return 'Unknown';
      return user.name || user.displayName || user.display_name || 'Unknown';
    }

    function _getOwnerInitials(user) {
      var name = _getOwnerName(user);
      if (name === 'Unknown') return '??';
      return name.split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').slice(0, 2);
    }

    function _getOwnerColor(user) {
      if (!user) return '#6b7280';
      return UI.sanitizeColor(user.avatarColor || user.avatar_color || '#6b7280');
    }

    // ── Layout computation ────────────────────────────────────

    function _computeContainers(initiatives, projectsByInit, decisions, bridges, userMap) {
      var containers = [];

      for (var i = 0; i < initiatives.length; i++) {
        var init = initiatives[i];
        var projects = projectsByInit[init.id] || [];

        if (projects.length === 0) continue;

        // Collect decisions for this initiative's projects
        var initDecisions = [];
        for (var dp = 0; dp < projects.length; dp++) {
          var pDecs = getProjectDecisions(projects[dp].id, decisions);
          for (var pd = 0; pd < pDecs.length; pd++) {
            initDecisions.push(pDecs[pd]);
          }
        }
        var decStatusCounts = countDecisionsByStatus(initDecisions);

        // Compute unique owners from projects
        var ownersSeen = {};
        var owners = [];
        for (var oi = 0; oi < projects.length; oi++) {
          var ownerId = projects[oi].ownerId || projects[oi].owner_id ||
            projects[oi].createdById || projects[oi].created_by_id ||
            (projects[oi].createdBy && (projects[oi].createdBy.id || projects[oi].createdBy));
          if (!ownerId || ownersSeen[ownerId]) continue;
          ownersSeen[ownerId] = true;
          var ownerUser = _getUserFromMap(ownerId, userMap);
          owners.push({
            name: _getOwnerName(ownerUser),
            initials: _getOwnerInitials(ownerUser),
            color: _getOwnerColor(ownerUser)
          });
        }

        // Compute stage counts
        var stageCounts = {};
        for (var sci = 0; sci < projects.length; sci++) {
          var pStatus = (projects[sci].status || 'unknown').toLowerCase().replace(/\s+/g, '_');
          stageCounts[pStatus] = (stageCounts[pStatus] || 0) + 1;
        }

        var containerW = Math.max(700, projects.length * 180);
        var containerH = Math.max(650, projects.length * 160);
        var nodeW = 180;
        var nodeH = 100;

        var cx = containerW / 2;
        var cy = containerH / 2 + 20;
        var radius = Math.min(containerW, containerH) * 0.35;
        var projectNodes = [];

        for (var p = 0; p < projects.length; p++) {
          var px, py, angle;
          if (projects.length === 1) {
            px = cx - nodeW / 2;
            py = cy - nodeH / 2;
            angle = -Math.PI / 2;
          } else {
            angle = (2 * Math.PI * p) / projects.length - Math.PI / 2;
            px = cx + radius * Math.cos(angle) - nodeW / 2;
            py = cy + radius * Math.sin(angle) - nodeH / 2;
          }

          var decs = getProjectDecisions(projects[p].id, decisions);
          var projOwnerId = projects[p].ownerId || projects[p].owner_id ||
            projects[p].createdById || projects[p].created_by_id ||
            (projects[p].createdBy && (projects[p].createdBy.id || projects[p].createdBy));
          var projOwner = _getUserFromMap(projOwnerId, userMap);

          projectNodes.push({
            type: 'project',
            id: projects[p].id,
            initiativeId: init.id,
            label: projects[p].name,
            color: getProjectColor(projects[p]),
            status: projects[p].status,
            ownerName: _getOwnerName(projOwner),
            ownerInitials: _getOwnerInitials(projOwner),
            ownerColor: _getOwnerColor(projOwner),
            decisionCount: decs.length,
            localX: px,
            localY: py,
            centerLocalX: projects.length === 1 ? cx : cx + radius * Math.cos(angle),
            centerLocalY: projects.length === 1 ? cy : cy + radius * Math.sin(angle),
            w: nodeW,
            h: nodeH
          });
        }

        // Compute edges from bridges
        var projMap = {};
        for (var pm = 0; pm < projectNodes.length; pm++) {
          projMap[projectNodes[pm].id] = projectNodes[pm];
        }

        var edges = [];
        for (var e = 0; e < bridges.length; e++) {
          var b = bridges[e];
          var srcId = b.fromProjectId || b.from_project_id || b.sourceProjectId || b.source_project_id;
          var tgtId = b.toProjectId || b.to_project_id || b.targetProjectId || b.target_project_id;
          var src = projMap[srcId];
          var tgt = projMap[tgtId];
          if (!src || !tgt) continue;

          edges.push({
            id: b.id,
            name: b.name,
            type: b.type || b.bridgeType || b.bridge_type,
            status: b.status,
            sourceId: srcId,
            targetId: tgtId,
            srcLocalCX: src.centerLocalX,
            srcLocalCY: src.centerLocalY,
            tgtLocalCX: tgt.centerLocalX,
            tgtLocalCY: tgt.centerLocalY,
            containerCX: cx,
            containerCY: cy
          });
        }

        // Collapse duplicate edges between the same project pair
        var edgePairMap = {};
        for (var de = 0; de < edges.length; de++) {
          var dedgeKey = [edges[de].sourceId, edges[de].targetId].sort().join('|');
          if (!edgePairMap[dedgeKey]) edgePairMap[dedgeKey] = [];
          edgePairMap[dedgeKey].push(edges[de]);
        }
        var dedupedEdges = [];
        for (var pairKey in edgePairMap) {
          if (!edgePairMap.hasOwnProperty(pairKey)) continue;
          var pairEdges = edgePairMap[pairKey];
          if (pairEdges.length === 1) {
            dedupedEdges.push(pairEdges[0]);
          } else {
            var merged = {};
            for (var mk in pairEdges[0]) {
              if (pairEdges[0].hasOwnProperty(mk)) merged[mk] = pairEdges[0][mk];
            }
            var allIds = [];
            for (var ai = 0; ai < pairEdges.length; ai++) {
              allIds.push(pairEdges[ai].id);
            }
            merged.edgeIds = allIds;
            merged.id = allIds[0];
            merged.name = pairEdges.length + ' bridges';
            dedupedEdges.push(merged);
          }
        }

        containers.push({
          initiativeId: init.id,
          name: init.name,
          projectCount: projects.length,
          decisionCount: initDecisions.length,
          decStatusCounts: decStatusCounts,
          owners: owners,
          stageCounts: stageCounts,
          width: containerW,
          height: containerH,
          x: 0,
          y: 0,
          projectNodes: projectNodes,
          edges: dedupedEdges
        });
      }

      return containers;
    }

    function _positionContainers(containers) {
      var spacing = 60;
      var totalWidth = 0;
      for (var tw = 0; tw < containers.length; tw++) {
        totalWidth += containers[tw].width;
      }
      totalWidth += spacing * Math.max(0, containers.length - 1);

      var startX = -totalWidth / 2;
      var maxH = 0;
      for (var mh = 0; mh < containers.length; mh++) {
        if (containers[mh].height > maxH) maxH = containers[mh].height;
      }

      var currentX = startX;
      for (var ci = 0; ci < containers.length; ci++) {
        containers[ci].x = currentX;
        containers[ci].y = -maxH / 2;
        currentX += containers[ci].width + spacing;
      }
    }

    function _computeGlobalPositions(containers) {
      var allNodes = [];
      var allEdges = [];

      for (var gi = 0; gi < containers.length; gi++) {
        var gc = containers[gi];
        for (var gn = 0; gn < gc.projectNodes.length; gn++) {
          var node = gc.projectNodes[gn];
          node.globalX = gc.x + node.localX;
          node.globalY = gc.y + node.localY;
          node.globalCX = gc.x + node.centerLocalX;
          node.globalCY = gc.y + node.centerLocalY;
          allNodes.push(node);
        }

        for (var ge = 0; ge < gc.edges.length; ge++) {
          var edge = gc.edges[ge];
          var sx = gc.x + edge.srcLocalCX;
          var sy = gc.y + edge.srcLocalCY;
          var tx = gc.x + edge.tgtLocalCX;
          var ty = gc.y + edge.tgtLocalCY;
          var midX = (sx + tx) / 2;
          var midY = (sy + ty) / 2;
          var ccx = gc.x + edge.containerCX;
          var ccy = gc.y + edge.containerCY;
          var dxOff = midX - ccx;
          var dyOff = midY - ccy;
          var curveFactor = 0.35;
          var ctrlX = midX - dxOff * curveFactor;
          var ctrlY = midY - dyOff * curveFactor;

          edge.path = 'M ' + sx + ' ' + sy + ' Q ' + ctrlX + ' ' + ctrlY + ' ' + tx + ' ' + ty;
          edge.labelX = ctrlX;
          edge.labelY = ctrlY - 8;
          allEdges.push(edge);
        }
      }

      return { nodes: allNodes, edges: allEdges };
    }

    function _buildEdgeLookups(edges) {
      edgesBySource = {};
      edgesByTarget = {};
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (!edgesBySource[e.sourceId]) edgesBySource[e.sourceId] = [];
        edgesBySource[e.sourceId].push(e);
        if (!edgesByTarget[e.targetId]) edgesByTarget[e.targetId] = [];
        edgesByTarget[e.targetId].push(e);
      }
    }

    function _getConnectedEdgeIds(nodeId) {
      var ids = {};
      var srcEdges = edgesBySource[nodeId] || [];
      var tgtEdges = edgesByTarget[nodeId] || [];
      for (var i = 0; i < srcEdges.length; i++) ids[srcEdges[i].id] = true;
      for (var j = 0; j < tgtEdges.length; j++) ids[tgtEdges[j].id] = true;
      return ids;
    }

    function computeLayout(gd) {
      var containers = _computeContainers(
        gd.initiatives, gd.projectsByInit,
        gd.decisions, gd.bridges, gd.userMap
      );
      _positionContainers(containers);
      var positions = _computeGlobalPositions(containers);

      // Build edge lookup maps for O(1) highlighting
      _buildEdgeLookups(positions.edges);

      return {
        containers: containers,
        nodes: positions.nodes,
        edges: positions.edges
      };
    }

    // ── Build SVG ─────────────────────────────────────────────
    function buildSVG(layout) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"'
        + ' style="position:absolute;inset:0;">';

      // Defs — no SVG filters (feDropShadow/feGaussianBlur kill perf during transforms)
      svg += '<defs></defs>';

      // Background rect for panning
      svg += '<rect id="decidr-canvas-bg" width="100%" height="100%" fill="transparent"/>';

      // Zoom layer
      svg += '<g id="decidr-zoom-layer">';

      // ── Summary layer (visible when zoomed out) ─────────────
      svg += '<g id="decidr-summary-layer" opacity="1" pointer-events="auto">';
      for (var si = 0; si < layout.containers.length; si++) {
        var sc = layout.containers[si];

        // Build owner pills
        var ownerPills = '';
        for (var op = 0; op < sc.owners.length; op++) {
          var ow = sc.owners[op];
          ownerPills += '<span class="decidr-graph-summary-owner-pill">'
            + '<span class="decidr-graph-summary-avatar" style="background:' + ow.color + ';">' + UI.escapeHtml(ow.initials) + '</span>'
            + '<span class="decidr-graph-summary-owner-name">' + UI.escapeHtml(ow.name) + '</span>'
            + '</span>';
        }

        // Build decision health bar for summary card
        var dsc = sc.decStatusCounts;
        var totalDec = (dsc.implemented || 0) + (dsc.approved || 0) + (dsc.proposed || 0)
          + (dsc.superseded || 0) + (dsc.other || 0);
        var healthBar = '';
        if (totalDec > 0) {
          healthBar += '<div class="decidr-graph-summary-bar-wrap">';
          healthBar += '<div class="decidr-graph-summary-section-label">Decision Health</div>';
          healthBar += '<div class="decidr-graph-summary-bar">';
          for (var hb = 0; hb < DECISION_STATUS_CONFIG.length; hb++) {
            var dsCfg = DECISION_STATUS_CONFIG[hb];
            var dsCount = dsc[dsCfg.key] || 0;
            if (dsCount > 0) {
              var dsPct = Math.round((dsCount / totalDec) * 100);
              healthBar += '<div style="width:' + dsPct + '%;background:' + dsCfg.color + ';"></div>';
            }
          }
          healthBar += '</div>';

          // Legend
          healthBar += '<div class="decidr-graph-summary-legend">';
          for (var li = 0; li < DECISION_STATUS_CONFIG.length; li++) {
            var legCfg = DECISION_STATUS_CONFIG[li];
            var legCount = dsc[legCfg.key] || 0;
            if (legCount > 0) {
              healthBar += '<span class="decidr-graph-summary-legend-item">'
                + '<span class="decidr-graph-summary-legend-dot" style="background:' + legCfg.color + ';"></span>'
                + legCount + ' ' + legCfg.label
                + '</span>';
            }
          }
          healthBar += '</div>';
          healthBar += '</div>';
        }

        // Build project stage pills
        var stagePills = '';
        for (var sp = 0; sp < PROJECT_STAGE_CONFIG.length; sp++) {
          var stg = PROJECT_STAGE_CONFIG[sp];
          var stgCount = sc.stageCounts[stg.key];
          if (stgCount > 0) {
            stagePills += '<span class="decidr-graph-summary-stage-pill"'
              + ' style="background:' + stg.color + '20;color:' + stg.color + ';">'
              + stgCount + ' ' + stg.label
              + '</span>';
          }
        }

        svg += '<g class="decidr-initiative-summary" data-init-id="' + sc.initiativeId + '">';
        svg += '<rect x="' + sc.x + '" y="' + sc.y + '" width="' + sc.width + '" height="' + sc.height + '"'
          + ' rx="20" style="fill:var(--glass-bg);stroke:var(--glass-border)" stroke-width="1"/>';
        svg += '<foreignObject x="' + sc.x + '" y="' + sc.y + '" width="' + sc.width + '" height="' + sc.height + '">';
        svg += '<div xmlns="http://www.w3.org/1999/xhtml" style="'
          + 'width:100%;height:100%;display:flex;flex-direction:column;'
          + 'align-items:center;justify-content:center;gap:32px;'
          + 'font-family:Figtree,-apple-system,sans-serif;cursor:pointer;'
          + 'border-radius:20px;padding:48px;box-sizing:border-box;'
          + '">';
        // Initiative name
        svg += '<div style="font-size:52px;font-weight:var(--weight-bold);color:var(--text-primary);'
          + 'text-align:center;letter-spacing:-0.03em;line-height:1.1;">'
          + UI.escapeHtml(sc.name) + '</div>';
        // Stats line
        svg += '<div style="font-size:24px;color:var(--text-tertiary);font-weight:var(--weight-medium);">'
          + sc.projectCount + ' project' + (sc.projectCount !== 1 ? 's' : '')
          + ' \u00b7 ' + sc.decisionCount + ' decision' + (sc.decisionCount !== 1 ? 's' : '')
          + '</div>';
        // Owner pills
        svg += '<div class="decidr-graph-summary-owners">'
          + ownerPills + '</div>';
        // Decision health bar
        svg += healthBar;
        // Project stage pills
        if (stagePills) {
          svg += '<div class="decidr-graph-summary-stages">'
            + '<div class="decidr-graph-summary-section-label">Project Stages</div>'
            + '<div class="decidr-graph-summary-stage-pills">'
            + stagePills + '</div></div>';
        }
        svg += '</div>';
        svg += '</foreignObject>';
        svg += '</g>';
      }
      svg += '</g>'; // close summary-layer

      // ── Detail layer (visible when zoomed in) ───────────────
      svg += '<g id="decidr-detail-layer" opacity="0" pointer-events="none">';

      // Render initiative containers
      for (var ci = 0; ci < layout.containers.length; ci++) {
        var c = layout.containers[ci];
        svg += '<g class="decidr-initiative-container" data-init-id="' + c.initiativeId + '">';

        // Glass background rect — no SVG filter (kills perf during transforms)
        svg += '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.width + '" height="' + c.height + '"'
          + ' rx="20" ry="20"'
          + ' style="fill:var(--glass-bg);stroke:var(--glass-border)" stroke-width="1"/>';

        // Header — clipped to container's rounded top corners
        var headerH = 56;
        var clipId = 'header-clip-' + c.initiativeId;
        svg += '<defs><clipPath id="' + clipId + '">'
          + '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.width + '" height="' + headerH + '"'
          + ' rx="20" ry="20"/></clipPath></defs>';
        svg += '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.width + '" height="' + headerH + '"'
          + ' clip-path="url(#' + clipId + ')" fill="var(--glass-bg-heavy)"/>';
        // Header border bottom
        svg += '<line x1="' + c.x + '" y1="' + (c.y + headerH) + '" x2="' + (c.x + c.width) + '" y2="' + (c.y + headerH) + '"'
          + ' stroke="var(--glass-border)" stroke-width="1"/>';
        // Initiative name
        svg += '<text x="' + (c.x + 18) + '" y="' + (c.y + 28) + '"'
          + ' font-family="Figtree,sans-serif" font-size="16" font-weight="700"'
          + ' fill="var(--text-primary)">' + UI.escapeHtml(c.name) + '</text>';
        // Stats subtitle
        svg += '<text x="' + (c.x + 18) + '" y="' + (c.y + 44) + '"'
          + ' font-family="Figtree,sans-serif" font-size="11"'
          + ' fill="var(--text-secondary)">'
          + c.projectCount + ' project' + (c.projectCount !== 1 ? 's' : '')
          + ' \u00b7 ' + c.decisionCount + ' decision' + (c.decisionCount !== 1 ? 's' : '')
          + '</text>';

        svg += '</g>';
      }

      // Render bridge edges
      for (var ei = 0; ei < layout.edges.length; ei++) {
        var edge = layout.edges[ei];
        var edgeColor = getBridgeTypeColor(edge.type);
        var isSelected = graphState.selectedNode
          && graphState.selectedNode.type === 'project'
          && (graphState.selectedNode.id === edge.sourceId || graphState.selectedNode.id === edge.targetId);
        var edgeOpacity = isSelected ? '0.9' : '0.5';
        var edgeWidth = isSelected ? '3' : '2';

        svg += '<g class="decidr-graph-edge" data-edge-id="' + edge.id + '"'
          + (edge.edgeIds ? ' data-edge-ids="' + edge.edgeIds.join(',') + '"' : '')
          + ' style="cursor:pointer;">';
        // Hit area (transparent wider path for easier clicking)
        svg += '<path class="decidr-edge-hit" d="' + edge.path + '"'
          + ' fill="none" stroke="transparent" stroke-width="16" style="cursor:pointer;"/>';
        // Visible edge
        svg += '<path class="decidr-edge-visible" d="' + edge.path + '"'
          + ' stroke="' + edgeColor + '"'
          + ' stroke-width="' + edgeWidth + '" stroke-dasharray="6 4"'
          + ' fill="none" opacity="' + edgeOpacity + '"/>';

        // Label pill
        var labelText = truncateLabel(edge.name, 24);
        var labelW = labelText.length * 6 + 16;
        var labelH = 20;
        svg += '<rect x="' + (edge.labelX - labelW / 2) + '" y="' + (edge.labelY - labelH / 2) + '"'
          + ' width="' + labelW + '" height="' + labelH + '"'
          + ' rx="10" style="fill:rgba(0,0,0,0.6)" stroke="' + edgeColor + '" stroke-width="0.5" stroke-opacity="0.4"/>'; /* rgba(0,0,0,0.6) — no matching token for semi-transparent black overlay */
        svg += '<text x="' + edge.labelX + '" y="' + (edge.labelY + 4) + '"'
          + ' text-anchor="middle" style="fill:var(--text-secondary)"'
          + ' font-family="Figtree, sans-serif" font-size="9" font-weight="500">'
          + UI.escapeHtml(labelText) + '</text>';

        svg += '</g>';
      }

      // Render project nodes — pure SVG (no foreignObject)
      for (var ni = 0; ni < layout.nodes.length; ni++) {
        var node = layout.nodes[ni];
        var projSelected = graphState.selectedNode
          && graphState.selectedNode.type === 'project'
          && graphState.selectedNode.id === node.id;

        svg += '<g class="decidr-graph-node' + (projSelected ? ' decidr-selected' : '') + '"'
          + ' data-node-type="project" data-node-id="' + node.id + '"'
          + ' data-node-label="' + UI.escapeHtml(node.label) + '"'
          + ' style="cursor:pointer;">';

        // Selection ring (outline)
        svg += '<rect class="decidr-node-outline" x="' + (node.globalX - 3) + '" y="' + (node.globalY - 3) + '"'
          + ' width="' + (node.w + 6) + '" height="' + (node.h + 6) + '"'
          + ' rx="14" fill="none"'
          + ' stroke="' + node.color + '" stroke-width="2"'
          + ' opacity="' + (projSelected ? '1' : '0') + '"/>';

        // Glass card — pure SVG (no foreignObject, avoids HTML reflow on pan/zoom)
        svg += '<rect x="' + node.globalX + '" y="' + node.globalY + '"'
          + ' width="' + node.w + '" height="' + node.h + '"'
          + ' rx="12" fill="var(--glass-bg-heavy)" stroke="var(--glass-border)" stroke-width="1"/>';

        // Row 1: Color dot + Project name
        var nameY = node.globalY + 24;
        svg += '<circle cx="' + (node.globalX + 16) + '" cy="' + nameY + '" r="5"'
          + ' fill="' + node.color + '"/>';
        svg += '<text x="' + (node.globalX + 28) + '" y="' + (nameY + 4) + '"'
          + ' font-family="Figtree,sans-serif" font-size="13" font-weight="600"'
          + ' fill="var(--text-primary)">'
          + UI.escapeHtml(truncateLabel(node.label, 18)) + '</text>';

        // Row 2: Avatar circle + Owner name
        var ownerY = node.globalY + 50;
        svg += '<circle cx="' + (node.globalX + 16) + '" cy="' + ownerY + '" r="8"'
          + ' fill="' + node.ownerColor + '"/>';
        svg += '<text x="' + (node.globalX + 16) + '" y="' + (ownerY + 3.5) + '"'
          + ' font-family="Figtree,sans-serif" font-size="7" font-weight="600"'
          + ' fill="white" text-anchor="middle">'
          + UI.escapeHtml(node.ownerInitials) + '</text>';
        svg += '<text x="' + (node.globalX + 30) + '" y="' + (ownerY + 4) + '"'
          + ' font-family="Figtree,sans-serif" font-size="11" fill="var(--text-secondary)">'
          + UI.escapeHtml(truncateLabel(node.ownerName, 16)) + '</text>';

        // Row 3: Status dot + status label + decision count
        var footerY = node.globalY + 76;
        svg += '<circle cx="' + (node.globalX + 16) + '" cy="' + footerY + '" r="4"'
          + ' fill="' + _graphStatusColor((node.status || '').toLowerCase()) + '"/>';
        svg += '<text x="' + (node.globalX + 26) + '" y="' + (footerY + 3.5) + '"'
          + ' font-family="Figtree,sans-serif" font-size="10" fill="var(--text-tertiary)">'
          + UI.escapeHtml((node.status || 'Unknown').replace(/_/g, ' ')) + '</text>';
        svg += '<text x="' + (node.globalX + node.w - 12) + '" y="' + (footerY + 3.5) + '"'
          + ' font-family="Figtree,sans-serif" font-size="10" fill="var(--text-tertiary)"'
          + ' text-anchor="end">'
          + node.decisionCount + 'd</text>';

        // GitHub indicator: show small dot + count if pending review PRs exist
        var ghNodeCounts = (graphState.githubCounts || {})[node.id];
        if (ghNodeCounts && (ghNodeCounts.pendingReviewPrs > 0 || ghNodeCounts.openPrs > 0)) {
          var ghY = footerY + 16;
          var ghLabel = '';
          if (ghNodeCounts.pendingReviewPrs > 0) {
            ghLabel = ghNodeCounts.pendingReviewPrs + ' review';
          } else {
            ghLabel = ghNodeCounts.openPrs + ' PR' + (ghNodeCounts.openPrs !== 1 ? 's' : '');
          }
          svg += '<circle cx="' + (node.globalX + 16) + '" cy="' + ghY + '" r="3"'
            + ' fill="' + (ghNodeCounts.pendingReviewPrs > 0 ? '#d29922' : '#8884ff') + '"/>';
          svg += '<text x="' + (node.globalX + 26) + '" y="' + (ghY + 3) + '"'
            + ' font-family="Figtree,sans-serif" font-size="9" fill="var(--text-tertiary)">'
            + UI.escapeHtml(ghLabel) + '</text>';
        }

        svg += '</g>';
      }

      svg += '</g>'; // close detail-layer
      svg += '</g>'; // close zoom-layer
      svg += '</svg>';
      return svg;
    }

    // ── Semantic Zoom ─────────────────────────────────────────
    function applySemanticZoom(scale) {
      var summaryLayer = cachedSummaryLayer;
      var detailLayer = cachedDetailLayer;
      if (!summaryLayer || !detailLayer) return;

      var LOW = 0.65;
      var HIGH = 0.78;

      var t;
      if (scale >= HIGH) {
        t = 1;
      } else if (scale <= LOW) {
        t = 0;
      } else {
        t = (scale - LOW) / (HIGH - LOW);
      }

      summaryLayer.setAttribute('opacity', (1 - t).toFixed(2));
      detailLayer.setAttribute('opacity', t.toFixed(2));

      if (t > 0.5) {
        summaryLayer.setAttribute('pointer-events', 'none');
        detailLayer.setAttribute('pointer-events', 'auto');
        detailLayer.setAttribute('visibility', 'visible');
      } else {
        summaryLayer.setAttribute('pointer-events', 'auto');
        detailLayer.setAttribute('pointer-events', 'none');
        if (t === 0) {
          detailLayer.setAttribute('visibility', 'hidden');
        } else {
          detailLayer.setAttribute('visibility', 'visible');
        }
      }
    }

    // ── Transform helpers ─────────────────────────────────────
    function applyTransform() {
      var zoomLayer = cachedZoomLayer;
      if (zoomLayer) {
        zoomLayer.setAttribute('transform',
          'translate(' + graphState.transform.x + ',' + graphState.transform.y + ') scale(' + graphState.transform.k + ')');
      }
      applySemanticZoom(graphState.transform.k);
    }

    function scheduleTransform() {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(function() {
          rafPending = false;
          applyTransform();
        });
      }
    }

    function fitToContent(layout) {
      var svgEl = cachedSvgEl;
      if (!svgEl) return;

      var rect = svgEl.getBoundingClientRect();
      var svgW = rect.width;
      var svgH = rect.height;

      if (svgW === 0 || svgH === 0) return;

      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var i = 0; i < layout.containers.length; i++) {
        var lc = layout.containers[i];
        if (lc.x < minX) minX = lc.x;
        if (lc.y < minY) minY = lc.y;
        if (lc.x + lc.width > maxX) maxX = lc.x + lc.width;
        if (lc.y + lc.height > maxY) maxY = lc.y + lc.height;
      }

      var contentW = maxX - minX;
      var contentH = maxY - minY;
      var padding = 80;

      var scaleX = (svgW - padding * 2) / contentW;
      var scaleY = (svgH - padding * 2) / contentH;
      var k = Math.min(scaleX, scaleY, 0.5); // cap to start in summary view

      var centerX = (minX + maxX) / 2;
      var centerY = (minY + maxY) / 2;

      graphState.transform.k = k;
      graphState.transform.x = svgW / 2 - centerX * k;
      graphState.transform.y = svgH / 2 - centerY * k;

      applyTransform();
    }

    function zoomToInitiative(initId) {
      if (!currentLayout) return;
      var svgEl = cachedSvgEl;
      if (!svgEl) return;
      var svgRect = svgEl.getBoundingClientRect();
      var svgW = svgRect.width;
      var svgH = svgRect.height;
      var padding = 60;

      for (var ci = 0; ci < currentLayout.containers.length; ci++) {
        var lc = currentLayout.containers[ci];
        if (lc.initiativeId === initId) {
          var scaleX = (svgW - padding * 2) / lc.width;
          var scaleY = (svgH - padding * 2) / lc.height;
          var k = Math.min(scaleX, scaleY, 2);

          var centerX = lc.x + lc.width / 2;
          var centerY = lc.y + lc.height / 2;

          graphState.transform.k = k;
          graphState.transform.x = svgW / 2 - centerX * k;
          graphState.transform.y = svgH / 2 - centerY * k;
          applyTransform();
          break;
        }
      }
    }

    // ── Legend ─────────────────────────────────────────────────
    function buildLegend() {
      return '<div style="display:flex;align-items:center;justify-content:center;'
        + 'gap:var(--space-5);padding:var(--space-2) var(--space-4);border-top:1px solid var(--border-default);">'
        + '<span style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-small);color:var(--text-secondary);">'
          + '<span style="width:14px;height:14px;border-radius:50%;background:var(--entity-project);'
            + 'border:2px solid var(--border-strong);"></span>'
          + 'Project</span>'
        + '<span style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-small);color:var(--text-secondary);">'
          + '<span style="width:24px;height:0;border-top:2px dashed var(--entity-bridge);"></span>'
          + 'Dependency</span>'
        + '<span style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-small);color:var(--text-secondary);">'
          + '<span style="width:24px;height:0;border-top:2px dashed var(--entity-task);"></span>'
          + 'Data Flow</span>'
        + '<span style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-small);color:var(--text-secondary);">'
          + '<span style="width:24px;height:0;border-top:2px dashed #fbbf24;"></span>' /* #fbbf24 — no exact token match for shared resource color */
          + 'Shared Resource</span>'
        + '</div>';
    }

    // ── Controls ──────────────────────────────────────────────
    function buildZoomControls() {
      // Action buttons — top left, horizontal text buttons
      var actions = '<div style="position:absolute;top:var(--space-3);left:var(--space-3);'
        + 'display:flex;gap:var(--space-2);align-items:center;z-index:100;">'
        + UI.orgPicker(graphState.organizations, graphState.activeOrgId)
        + '<button class="decidr-graph-zoom-btn" data-action="new-initiative"'
        + ' style="padding:6px 14px;width:auto;font-size:12px;">New Initiative</button>'
        + '<button class="decidr-graph-zoom-btn" data-action="new-project"'
        + ' style="padding:6px 14px;width:auto;font-size:12px;">New Project</button>'
        + '<button class="decidr-graph-zoom-btn" data-action="new-bridge"'
        + ' style="padding:6px 14px;width:auto;font-size:12px;">Create Bridge</button>'
        + '</div>';

      // Zoom buttons — top right, horizontal
      var zoom = '<div id="decidr-zoom-controls" style="position:absolute;top:var(--space-3);right:var(--space-3);'
        + 'display:flex;gap:var(--space-1);z-index:100;">'
        + '<button class="decidr-graph-zoom-btn" data-action="zoom-in" title="Zoom In">+</button>'
        + '<button class="decidr-graph-zoom-btn" data-action="zoom-out" title="Zoom Out">&minus;</button>'
        + '<button class="decidr-graph-zoom-btn" data-action="zoom-reset" title="Fit to View">&#10227;</button>'
        + '</div>';

      return actions + zoom;
    }

    // ── Detail strip ──────────────────────────────────────────
    function updateDetailStrip(nodeId) {
      var strip = container.querySelector('#decidr-detail-strip');
      if (!strip) return;

      if (!nodeId || !graphState.selectedNode) {
        strip.classList.remove('decidr-graph-detail-strip-visible');
        return;
      }

      // Find node in layout
      var node = null;
      for (var i = 0; i < currentLayout.nodes.length; i++) {
        if (currentLayout.nodes[i].id === nodeId) {
          node = currentLayout.nodes[i];
          break;
        }
      }
      if (!node) {
        strip.classList.remove('decidr-graph-detail-strip-visible');
        return;
      }

      var statusNorm = (node.status || 'unknown').toLowerCase().replace(/\s+/g, '_');
      var html = '<span class="decidr-graph-detail-strip-label">Selected:</span>';
      html += '<span class="decidr-graph-detail-strip-name">' + UI.escapeHtml(node.label) + '</span>';
      html += UI.statusBadge(node.status);
      html += '<span class="decidr-graph-detail-strip-spacer"></span>';
      html += '<span class="decidr-graph-detail-strip-meta">';
      html += '<span>' + UI.escapeHtml(node.ownerName) + '</span>';
      html += '<span>' + node.decisionCount + ' decision' + (node.decisionCount !== 1 ? 's' : '') + '</span>';
      html += '</span>';

      strip.innerHTML = html;
      strip.classList.add('decidr-graph-detail-strip-visible');
    }

    // ── Shared modal helper ─────────────────────────────────────
    function _showModal(config) {
      // config: { html, onCreate, focusSelector }
      var existing = container.querySelector('.decidr-graph-modal-overlay');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.className = 'decidr-graph-modal-overlay';
      overlay.innerHTML = config.html;
      container.appendChild(overlay);

      // Cancel wiring
      var cancelBtn = overlay.querySelector('#decidr-modal-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() { overlay.remove(); });
      }
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
      });

      // Create wiring
      var createBtn = overlay.querySelector('#decidr-modal-create');
      if (createBtn) {
        createBtn.addEventListener('click', function() {
          config.onCreate(overlay);
        });
      }

      // Enter key on focus element
      if (config.focusSelector) {
        var focusEl = overlay.querySelector(config.focusSelector);
        if (focusEl) {
          focusEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') createBtn.click();
          });
        }
      }

      return overlay;
    }

    // ── Add Project Modal ─────────────────────────────────────
    function _buildAddProjectModalHtml(initiatives) {
      var optionsHtml = '';
      for (var i = 0; i < initiatives.length; i++) {
        optionsHtml += '<option value="' + initiatives[i].id + '">'
          + UI.escapeHtml(initiatives[i].name) + '</option>';
      }

      var colorDotsHtml = '';
      for (var c = 0; c < GRAPH_COLORS.length; c++) {
        colorDotsHtml += '<span class="decidr-graph-modal-color-dot" data-color="' + GRAPH_COLORS[c] + '" style="'
          + 'background:' + GRAPH_COLORS[c] + ';'
          + (c === 0 ? 'border-color:white;' : '')
          + '"></span>';
      }

      return '<div class="decidr-graph-modal">'
        + '<h3>New Project</h3>'
        + '<label>Project Name</label>'
        + '<input type="text" id="decidr-new-proj-name" placeholder="e.g. Auth Service" autofocus />'
        + '<label>Initiative</label>'
        + '<select id="decidr-new-proj-init">' + optionsHtml + '</select>'
        + '<label>Color</label>'
        + '<div style="display:flex;gap:8px;margin-bottom:var(--space-3);" id="decidr-color-picker">'
        + colorDotsHtml + '</div>'
        + '<div class="decidr-graph-modal-actions">'
        + '<button class="decidr-graph-modal-btn-cancel" id="decidr-modal-cancel">Cancel</button>'
        + '<button class="decidr-graph-modal-btn-create" id="decidr-modal-create">Create</button>'
        + '</div>'
        + '</div>';
    }

    function showAddProjectModal() {
      var selectedColor = GRAPH_COLORS[0];

      var overlay = _showModal({
        html: _buildAddProjectModalHtml(graphData.initiatives),
        focusSelector: '#decidr-new-proj-name',
        onCreate: function(ov) {
          var name = ov.querySelector('#decidr-new-proj-name').value.trim();
          var initId = ov.querySelector('#decidr-new-proj-init').value;
          if (!name) {
            ov.querySelector('#decidr-new-proj-name').style.borderColor = 'var(--color-error)';
            return;
          }

          API.createProject({
            name: name,
            initiative_id: initId,
            color: selectedColor,
            status: 'planning'
          }).then(function() {
            ov.remove();
            _fetchGraphData().then(function(gd) {
              graphData = gd;
              renderGraphWithData(gd);
            });
          }).catch(function(err) {
            if (typeof console !== 'undefined') console.error('Create project failed:', err);
          });
        }
      });

      // Color picker — modal-specific wiring
      var picker = overlay.querySelector('#decidr-color-picker');
      if (picker) {
        picker.addEventListener('click', function(e) {
          var dot = e.target.closest('.decidr-graph-modal-color-dot');
          if (!dot) return;
          var dots = picker.querySelectorAll('.decidr-graph-modal-color-dot');
          for (var j = 0; j < dots.length; j++) {
            dots[j].style.borderColor = 'transparent';
          }
          dot.style.borderColor = 'white';
          selectedColor = dot.getAttribute('data-color');
        });
      }
    }

    // ── Re-fetch and re-render helper ──────────────────────────
    function _refetchAndRerender() {
      _fetchGraphData().then(function(gd) {
        graphData = gd;
        renderGraphWithData(gd);
      });
    }

    // ── Add Initiative Modal ──────────────────────────────────
    function showAddInitiativeModal() {
      _showModal({
        html: '<div class="decidr-graph-modal">'
          + '<h3>New Initiative</h3>'
          + '<label>Initiative Name</label>'
          + '<input type="text" id="decidr-new-init-name" placeholder="e.g. Q3 Platform Migration" autofocus />'
          + '<div class="decidr-graph-modal-actions">'
          + '<button class="decidr-graph-modal-btn-cancel" id="decidr-modal-cancel">Cancel</button>'
          + '<button class="decidr-graph-modal-btn-create" id="decidr-modal-create">Create</button>'
          + '</div>'
          + '</div>',
        focusSelector: '#decidr-new-init-name',
        onCreate: function(ov) {
          var name = ov.querySelector('#decidr-new-init-name').value.trim();
          if (!name) {
            ov.querySelector('#decidr-new-init-name').style.borderColor = 'var(--color-error)';
            return;
          }

          API.createInitiative({ name: name }).then(function() {
            ov.remove();
            _refetchAndRerender();
          }).catch(function(err) {
            if (typeof console !== 'undefined') console.error('Create initiative failed:', err);
          });
        }
      });
    }

    // ── Add Bridge Modal ──────────────────────────────────────
    function showAddBridgeModal() {
      // Collect all projects from graphData
      var allProjects = [];
      for (var initId in graphData.projectsByInit) {
        if (!graphData.projectsByInit.hasOwnProperty(initId)) continue;
        var projs = graphData.projectsByInit[initId];
        for (var pi = 0; pi < projs.length; pi++) {
          var alreadyAdded = false;
          for (var ai = 0; ai < allProjects.length; ai++) {
            if (allProjects[ai].id === projs[pi].id) { alreadyAdded = true; break; }
          }
          if (!alreadyAdded) allProjects.push(projs[pi]);
        }
      }

      var projectOptionsHtml = '<option value="">-- Select Project --</option>';
      for (var po = 0; po < allProjects.length; po++) {
        projectOptionsHtml += '<option value="' + allProjects[po].id + '">'
          + UI.escapeHtml(allProjects[po].name) + '</option>';
      }

      _showModal({
        html: '<div class="decidr-graph-modal">'
          + '<h3>Create Bridge</h3>'
          + '<label>Bridge Name</label>'
          + '<input type="text" id="decidr-new-bridge-name" placeholder="e.g. Auth Data Flow" autofocus />'
          + '<label>From Project</label>'
          + '<select id="decidr-new-bridge-from">' + projectOptionsHtml + '</select>'
          + '<label>To Project</label>'
          + '<select id="decidr-new-bridge-to">' + projectOptionsHtml + '</select>'
          + '<div class="decidr-graph-modal-actions">'
          + '<button class="decidr-graph-modal-btn-cancel" id="decidr-modal-cancel">Cancel</button>'
          + '<button class="decidr-graph-modal-btn-create" id="decidr-modal-create">Create</button>'
          + '</div>'
          + '</div>',
        focusSelector: '#decidr-new-bridge-name',
        onCreate: function(ov) {
          var name = ov.querySelector('#decidr-new-bridge-name').value.trim();
          var fromId = ov.querySelector('#decidr-new-bridge-from').value;
          var toId = ov.querySelector('#decidr-new-bridge-to').value;

          var hasError = false;
          if (!name) {
            ov.querySelector('#decidr-new-bridge-name').style.borderColor = 'var(--color-error)';
            hasError = true;
          }
          if (!fromId) {
            ov.querySelector('#decidr-new-bridge-from').style.borderColor = 'var(--color-error)';
            hasError = true;
          }
          if (!toId) {
            ov.querySelector('#decidr-new-bridge-to').style.borderColor = 'var(--color-error)';
            hasError = true;
          }
          if (fromId && toId && fromId === toId) {
            ov.querySelector('#decidr-new-bridge-to').style.borderColor = 'var(--color-error)';
            hasError = true;
          }
          if (hasError) return;

          API.createBridge({ name: name, from_project_id: fromId, to_project_id: toId }).then(function() {
            ov.remove();
            _refetchAndRerender();
          }).catch(function(err) {
            if (typeof console !== 'undefined') console.error('Create bridge failed:', err);
          });
        }
      });
    }

    // ── Main render with data ─────────────────────────────────
    function renderGraphWithData(gd) {
      currentLayout = computeLayout(gd);

      if (currentLayout.containers.length === 0) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;'
          + 'height:100%;min-height:400px;">'
          + UI.emptyState('No initiatives with projects found.')
          + '</div>';
        return;
      }

      // Build the full UI
      container.innerHTML = '<div id="decidr-graph-wrap" style="'
        + 'display:flex;flex-direction:column;height:100%;min-height:500px;'
        + 'background:var(--bg-app);border-radius:var(--border-radius-lg);'
        + 'overflow:hidden;position:relative;">'
        // Graph canvas
        + '<div id="decidr-graph-canvas" style="flex:1;position:relative;overflow:hidden;">'
        + buildSVG(currentLayout)
        + buildZoomControls()
        + '<div class="decidr-graph-tooltip" id="decidr-graph-tooltip"></div>'
        + '</div>'
        // Legend footer
        + buildLegend()
        // Detail strip
        + '<div class="decidr-graph-detail-strip" id="decidr-detail-strip"></div>'
        + '</div>';

      // Cache DOM references
      cachedSvgEl = container.querySelector('svg');
      cachedZoomLayer = container.querySelector('#decidr-zoom-layer');
      cachedSummaryLayer = container.querySelector('#decidr-summary-layer');
      cachedDetailLayer = container.querySelector('#decidr-detail-layer');

      // Wire interactions
      wireInteractions(gd);

      // Fit to content after a tick (allow DOM to settle)
      setTimeout(function() {
        fitToContent(currentLayout);
      }, 50);
    }

    // ── Wire interactions (event delegation) ──────────────────
    function wireInteractions(gd) {
      var svgEl = cachedSvgEl;
      var canvas = container.querySelector('#decidr-graph-canvas');
      var isPanning = false;
      var didPan = false;
      var panStart = { x: 0, y: 0 };
      var tooltip = container.querySelector('#decidr-graph-tooltip');

      // ── Pan & Zoom ────────────────────────────────────────
      if (svgEl && canvas) {
        svgEl.addEventListener('wheel', function(e) {
          e.preventDefault();
          var factor = e.deltaY < 0 ? 1.04 : 0.96;
          var newK = Math.max(0.1, Math.min(3, graphState.transform.k * factor));

          var rect = svgEl.getBoundingClientRect();
          var mouseX = e.clientX - rect.left;
          var mouseY = e.clientY - rect.top;

          var scaleChange = newK / graphState.transform.k;
          graphState.transform.x = mouseX - scaleChange * (mouseX - graphState.transform.x);
          graphState.transform.y = mouseY - scaleChange * (mouseY - graphState.transform.y);
          graphState.transform.k = newK;

          scheduleTransform();
        }, { passive: false });

        // Pan starts on mousedown anywhere on canvas — except interactive elements
        canvas.addEventListener('mousedown', function(e) {
          // Don't pan on interactive elements (buttons, inputs, zoom controls)
          var interactive = e.target.closest('.decidr-graph-zoom-btn, .decidr-graph-modal, button, input, select');
          if (interactive) return;

          isPanning = true;
          didPan = false;
          panStart.x = e.clientX - graphState.transform.x;
          panStart.y = e.clientY - graphState.transform.y;
          canvas.style.cursor = 'grabbing';
          e.preventDefault();
        });

        window.addEventListener('mousemove', function(e) {
          if (isPanning) {
            var dx = e.clientX - panStart.x - graphState.transform.x;
            var dy = e.clientY - panStart.y - graphState.transform.y;
            if (!didPan && (dx * dx + dy * dy) < 25) return; // 5px dead zone
            didPan = true;
            graphState.transform.x = e.clientX - panStart.x;
            graphState.transform.y = e.clientY - panStart.y;
            scheduleTransform();
          }
        });

        window.addEventListener('mouseup', function() {
          if (isPanning) {
            isPanning = false;
            canvas.style.cursor = '';
          }
        });
      }

      // ── Delegated click handler on graph canvas ───────────
      if (canvas) {
        canvas.addEventListener('click', function(e) {
          // Suppress click if we just finished a pan drag
          if (didPan) {
            didPan = false;
            return;
          }
          var target = e.target;

          // Walk up to find attributed element
          var nodeEl = target.closest('.decidr-graph-node');
          var edgeEl = target.closest('.decidr-graph-edge');
          var summaryEl = target.closest('.decidr-initiative-summary');
          var zoomBtn = target.closest('.decidr-graph-zoom-btn');

          if (zoomBtn) {
            e.stopPropagation();
            _handleZoomBtnClick(zoomBtn);
            return;
          }

          if (nodeEl) {
            e.stopPropagation();
            _handleNodeClick(nodeEl);
            return;
          }

          if (edgeEl) {
            e.stopPropagation();
            var mergedIds = edgeEl.getAttribute('data-edge-ids');
            var edgeId = mergedIds ? mergedIds.split(',')[0] : edgeEl.getAttribute('data-edge-id');
            UI.SlideOut.open('bridge', edgeId, {
              onMutate: function() { _refetchAndRerender(); }
            });
            return;
          }

          if (summaryEl) {
            e.stopPropagation();
            var initId = summaryEl.getAttribute('data-init-id');
            zoomToInitiative(initId);
            return;
          }

          // Background click — clear selection
          if (target === canvas || target.tagName === 'svg'
            || (target.tagName === 'rect' && target.id === 'decidr-canvas-bg')) {
            _clearSelection();
          }
        });

        // ── Hover tooltips (delegated) ───────────────────────
        canvas.addEventListener('mouseenter', function(e) {
          var nodeEl = e.target.closest('.decidr-graph-node');
          if (nodeEl && tooltip) {
            var label = nodeEl.getAttribute('data-node-label') || '';
            tooltip.textContent = label;
            tooltip.classList.add('decidr-graph-tooltip-visible');
          }
        }, true);

        canvas.addEventListener('mousemove', function(e) {
          if (tooltip && tooltip.classList.contains('decidr-graph-tooltip-visible')) {
            var canvasRect = canvas.getBoundingClientRect();
            tooltip.style.left = (e.clientX - canvasRect.left + 12) + 'px';
            tooltip.style.top = (e.clientY - canvasRect.top - 8) + 'px';
          }
        });

        canvas.addEventListener('mouseleave', function(e) {
          var nodeEl = e.target.closest('.decidr-graph-node');
          if (nodeEl && tooltip) {
            tooltip.classList.remove('decidr-graph-tooltip-visible');
          }
        }, true);
      }

      // ── Node click handler ────────────────────────────────
      function _handleNodeClick(nodeEl) {
        var type = nodeEl.getAttribute('data-node-type');
        var id = nodeEl.getAttribute('data-node-id');

        // Toggle selection
        if (graphState.selectedNode && graphState.selectedNode.id === id) {
          graphState.selectedNode = null;
        } else {
          graphState.selectedNode = { type: type, id: id };
        }

        // Update selection visuals
        var allNodes = container.querySelectorAll('.decidr-graph-node');
        for (var j = 0; j < allNodes.length; j++) {
          allNodes[j].classList.remove('decidr-selected');
          var outline = allNodes[j].querySelector('.decidr-node-outline');
          if (outline) {
            outline.setAttribute('opacity', '0');
            outline.setAttribute('stroke-width', '2');
          }
        }

        if (graphState.selectedNode) {
          nodeEl.classList.add('decidr-selected');
          var selOutline = nodeEl.querySelector('.decidr-node-outline');
          if (selOutline) {
            selOutline.setAttribute('opacity', '1');
            selOutline.setAttribute('stroke-width', '3');
          }

          // Dim all edges
          var allEdgeVis = container.querySelectorAll('.decidr-graph-edge .decidr-edge-visible');
          for (var k = 0; k < allEdgeVis.length; k++) {
            allEdgeVis[k].setAttribute('opacity', '0.2');
            allEdgeVis[k].setAttribute('stroke-width', '2');
          }

          // Highlight connected edges via O(1) lookup
          if (graphState.selectedNode.type === 'project') {
            var connectedIds = _getConnectedEdgeIds(id);
            var edgeEls = container.querySelectorAll('.decidr-graph-edge');
            for (var m = 0; m < edgeEls.length; m++) {
              var eId = edgeEls[m].getAttribute('data-edge-id');
              if (connectedIds[eId]) {
                var visPath = edgeEls[m].querySelector('.decidr-edge-visible');
                if (visPath) {
                  visPath.setAttribute('opacity', '0.9');
                  visPath.setAttribute('stroke-width', '3');
                }
              }
            }
          }

          // Open slide-out panel
          UI.SlideOut.open(type, id, {
            onMutate: function() { _refetchAndRerender(); }
          });

          // Update detail strip
          updateDetailStrip(id);
        } else {
          _clearEdgeHighlights();
          updateDetailStrip(null);
        }
      }

      function _clearSelection() {
        graphState.selectedNode = null;

        var allNodes = container.querySelectorAll('.decidr-graph-node');
        for (var j = 0; j < allNodes.length; j++) {
          allNodes[j].classList.remove('decidr-selected');
          var outline = allNodes[j].querySelector('.decidr-node-outline');
          if (outline) {
            outline.setAttribute('opacity', '0');
            outline.setAttribute('stroke-width', '2');
          }
        }

        _clearEdgeHighlights();
        updateDetailStrip(null);
      }

      function _clearEdgeHighlights() {
        var allEdges = container.querySelectorAll('.decidr-graph-edge .decidr-edge-visible');
        for (var n = 0; n < allEdges.length; n++) {
          allEdges[n].setAttribute('opacity', '0.5');
          allEdges[n].setAttribute('stroke-width', '2');
        }
      }

      // ── Zoom control handler ──────────────────────────────
      function _handleZoomBtnClick(btn) {
        var action = btn.getAttribute('data-action');
        var svgRect = svgEl ? svgEl.getBoundingClientRect() : { width: 800, height: 500 };
        var cx = svgRect.width / 2;
        var cy = svgRect.height / 2;

        if (action === 'zoom-in') {
          var newK = Math.min(3, graphState.transform.k * 1.3);
          var sc = newK / graphState.transform.k;
          graphState.transform.x = cx - sc * (cx - graphState.transform.x);
          graphState.transform.y = cy - sc * (cy - graphState.transform.y);
          graphState.transform.k = newK;
          applyTransform();
        } else if (action === 'zoom-out') {
          var newK2 = Math.max(0.1, graphState.transform.k * 0.7);
          var sc2 = newK2 / graphState.transform.k;
          graphState.transform.x = cx - sc2 * (cx - graphState.transform.x);
          graphState.transform.y = cy - sc2 * (cy - graphState.transform.y);
          graphState.transform.k = newK2;
          applyTransform();
        } else if (action === 'zoom-reset') {
          graphState.transform = { x: 0, y: 0, k: 1 };
          if (currentLayout) {
            fitToContent(currentLayout);
          }
        } else if (action === 'new-project') {
          showAddProjectModal();
        } else if (action === 'new-initiative') {
          showAddInitiativeModal();
        } else if (action === 'new-bridge') {
          showAddBridgeModal();
        }
      }

      // ── Org picker wiring ─────────────────────────────────
      var orgToggle = container.querySelector('#decidr-org-picker-toggle');
      var orgMenu = container.querySelector('#decidr-org-picker-menu');
      if (orgToggle && orgMenu) {
        orgToggle.addEventListener('click', function(e) {
          e.stopPropagation();
          orgMenu.classList.toggle('open');
        });

        document.addEventListener('click', function() {
          orgMenu.classList.remove('open');
        });

        orgMenu.addEventListener('click', function(e) {
          var btn = e.target.closest('[data-org-id]');
          if (!btn) return;
          var orgId = btn.getAttribute('data-org-id');
          if (orgId === graphState.activeOrgId) {
            orgMenu.classList.remove('open');
            return;
          }
          graphState.activeOrgId = orgId;
          orgMenu.classList.remove('open');
          container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;'
            + 'height:100%;min-height:400px;">'
            + UI.loadingSpinner('Switching organization...')
            + '</div>';
          API.switchOrg(orgId).then(function() {
            _refetchAndRerender();
          }).catch(function(err) {
            console.error('[decidr] Graph org switch failed:', err);
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
    }

    }, _orgId);
  };
})();

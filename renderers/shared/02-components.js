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
      staged: '#14b8a6',
      in_progress: '#3b82f6',
      under_discussion: '#3b82f6',
      open: '#3b82f6',
      proposed: '#f59e0b',
      blocked: '#ef4444',
      deferred: '#6b7280',
      backlog: '#9ca3af'
    },
    labels: {
      decided: 'Decided',
      agreed: 'Agreed',
      implemented: 'Implemented',
      staged: 'Staged',
      in_progress: 'In Progress',
      under_discussion: 'Under Discussion',
      open: 'Open',
      proposed: 'Proposed',
      blocked: 'Blocked',
      deferred: 'Deferred',
      backlog: 'Backlog'
    },
    order: ['decided', 'agreed', 'implemented', 'staged', 'in_progress', 'under_discussion', 'open', 'proposed', 'blocked', 'deferred', 'backlog']
  };

  // ─── Status / Priority / Entity Labels ────────────────────────────

  var STATUS_LABELS = {
    PLANNING: 'Planning',
    ACTIVE: 'Active',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
    BACKLOG: 'Backlog',
    PROPOSED: 'Proposed',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    IN_PROGRESS: 'In Progress',
    STAGED: 'Staged',
    IMPLEMENTED: 'Implemented',
    PLANNING: 'Planning',
    ACTIVE: 'Active',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
    TODO: 'To Do',
    DONE: 'Done',
    DRAFT: 'Draft',
    OPEN: 'Open',
    ACKNOWLEDGED: 'Acknowledged',
    RESOLVED: 'Resolved',
    EXTERNAL_OPEN: 'External',
    IN_REVIEW: 'In Review',
    CHANGES_REQUESTED: 'Changes Requested',
    SUPERSEDED: 'Superseded',
    COUNTER_REVIEW: 'Counter Review',
    COUNTER_SUPERSEDED: 'Counter Superseded',
    MERGED: 'Merged',
    INTERNAL: 'Internal',
    EXTERNAL: 'External'
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
    initiative: 'Initiative',
    issue: 'Issue',
    audit_event: 'Audit Event',
    pull_request: 'Pull Request',
    repo: 'Repository'
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

  function encodeBase64Utf8(str) {
    var text = String(str || '');
    try {
      if (typeof btoa === 'function') {
        return btoa(unescape(encodeURIComponent(text)));
      }
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(text, 'utf8').toString('base64');
      }
    } catch (e) {}
    return '';
  }

  UI.sanitizeColor = function(c) {
    return (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : '#6b7280';
  };

  UI.truncate = function(str, max) {
    if (!str) return '';
    max = max || 80;
    if (str.length <= max) return str;
    return str.slice(0, max) + '...';
  };

  function normalizeDescriptionText(str) {
    return String(str || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function stripMarkdownForPreview(str) {
    var text = normalizeDescriptionText(str);
    text = text.replace(/```[\s\S]*?```/g, function(block) {
      return block.replace(/^\s*```[^\n]*\n?/, '').replace(/\n?\s*```\s*$/, '');
    });
    text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    text = text.replace(/^\s{0,3}>\s?/gm, '');
    text = text.replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/gm, '');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    text = text.replace(/[*_`~]/g, '');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  UI.descriptionPreview = function(str, max) {
    return UI.truncate(stripMarkdownForPreview(str), max || 100);
  };

  function safeMarkdownUrl(url) {
    var value = String(url || '').trim();
    var lower = value.toLowerCase();
    if (
      lower.indexOf('http://') === 0 ||
      lower.indexOf('https://') === 0 ||
      lower.indexOf('mailto:') === 0
    ) {
      return value;
    }
    return '';
  }

  function safeLanguageClass(value) {
    var lang = String(value || '').trim().toLowerCase();
    return /^[a-z0-9_-]{1,32}$/.test(lang) ? lang : '';
  }

  function renderInlineMarkdown(str) {
    var placeholders = [];
    var source = String(str || '');

    function stash(html) {
      placeholders.push(html);
      return '\u0000' + (placeholders.length - 1) + '\u0000';
    }

    source = source.replace(/\{\{link:([^|}]+)\|([^}]+)\}\}/g, function(match, target, label) {
      var safeUrl = safeMarkdownUrl(target);
      var safeLabel = UI.escapeHtml(label);
      if (!safeUrl) {
        return stash('<span class="decidr-rich-ref">' + safeLabel + '</span>');
      }
      return stash('<a href="' + UI.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + safeLabel + '</a>');
    });

    source = source.replace(/\[\[([a-zA-Z0-9_-]+):([^\]|]+)(?:\|([^\]]+))?\]\]/g, function(match, refType, refValue, label) {
      var display = label || refValue || refType;
      return stash('<span class="decidr-rich-ref"><span class="decidr-rich-ref-type">' + UI.escapeHtml(refType) + '</span>' + UI.escapeHtml(display) + '</span>');
    });

    source = source.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function(match, alt, url) {
      var safeUrl = safeMarkdownUrl(url);
      if (!safeUrl) return UI.escapeHtml(alt || '');
      return stash('<img src="' + UI.escapeHtml(safeUrl) + '" alt="' + UI.escapeHtml(alt || '') + '" loading="lazy" />');
    });

    source = source.replace(/`([^`]+)`/g, function(match, code) {
      return stash('<code>' + UI.escapeHtml(code) + '</code>');
    });

    source = source.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function(match, label, url) {
      var safeUrl = safeMarkdownUrl(url);
      if (!safeUrl) return label;
      return stash('<a href="' + UI.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + UI.escapeHtml(label) + '</a>');
    });

    source = source.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, function(match, url) {
      var safeUrl = safeMarkdownUrl(url);
      if (!safeUrl) return match;
      return stash('<a href="' + UI.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + UI.escapeHtml(url) + '</a>');
    });

    var html = UI.escapeHtml(source);

    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    html = html.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    html = html.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    html = html.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');

    return html.replace(/\u0000(\d+)\u0000/g, function(match, index) {
      return placeholders[Number(index)] || '';
    });
  }

  function isBlankLine(line) {
    return /^\s*$/.test(line || '');
  }

  function unorderedListMatch(line) {
    return String(line || '').match(/^\s{0,3}[-*+]\s+(.+)$/);
  }

  function orderedListMatch(line) {
    return String(line || '').match(/^\s{0,3}\d+[.)]\s+(.+)$/);
  }

  function headingMatch(line) {
    return String(line || '').match(/^\s{0,3}(#{1,6})\s+(.+)$/);
  }

  function blockquoteMatch(line) {
    return String(line || '').match(/^\s{0,3}>\s?(.*)$/);
  }

  function horizontalRuleMatch(line) {
    return String(line || '').match(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/);
  }

  function isPotentialTableRow(line) {
    var text = String(line || '').trim();
    return text.indexOf('|') !== -1 && text.length > 2;
  }

  function splitTableRow(line) {
    var text = String(line || '').trim();
    if (text.charAt(0) === '|') text = text.slice(1);
    if (text.charAt(text.length - 1) === '|') text = text.slice(0, -1);
    var cells = [];
    var cell = '';
    var escaped = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (escaped) {
        cell += ch;
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '|') {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  function tableDividerCells(line) {
    if (!isPotentialTableRow(line)) return null;
    var cells = splitTableRow(line);
    if (cells.length === 0) return null;
    for (var i = 0; i < cells.length; i++) {
      if (!/^:?-{3,}:?$/.test(cells[i])) return null;
    }
    return cells;
  }

  function tableAlignments(dividerCells) {
    var alignments = [];
    for (var i = 0; i < dividerCells.length; i++) {
      var cell = dividerCells[i];
      if (/^:-+:$/.test(cell)) alignments.push('center');
      else if (/^-+:$/.test(cell)) alignments.push('right');
      else if (/^:-+$/.test(cell)) alignments.push('left');
      else alignments.push('');
    }
    return alignments;
  }

  function isTableStart(lines, index) {
    return index + 1 < lines.length &&
      isPotentialTableRow(lines[index]) &&
      tableDividerCells(lines[index + 1]);
  }

  function isBlockStart(line) {
    return /^\s*```/.test(line || '') ||
      horizontalRuleMatch(line) ||
      unorderedListMatch(line) ||
      orderedListMatch(line) ||
      headingMatch(line) ||
      blockquoteMatch(line);
  }

  function renderListItemContent(item) {
    var task = String(item || '').match(/^\[( |x|X)\]\s+([\s\S]+)$/);
    if (!task) return renderInlineMarkdown(item).replace(/\n/g, '<br>');
    var checked = task[1].toLowerCase() === 'x';
    return '<span class="decidr-rich-task-item"><input type="checkbox" disabled ' + (checked ? 'checked ' : '') + 'aria-hidden="true" />'
      + '<span>' + renderInlineMarkdown(task[2]).replace(/\n/g, '<br>') + '</span></span>';
  }

  function renderTable(lines, startIndex) {
    var headers = splitTableRow(lines[startIndex]);
    var divider = tableDividerCells(lines[startIndex + 1]) || [];
    var alignments = tableAlignments(divider);
    var rows = [];
    var i = startIndex + 2;
    while (i < lines.length && isPotentialTableRow(lines[i]) && !isBlankLine(lines[i])) {
      rows.push(splitTableRow(lines[i]));
      i++;
    }

    var html = '<div class="decidr-rich-table-wrap"><table><thead><tr>';
    for (var h = 0; h < headers.length; h++) {
      var hAlign = alignments[h] ? ' style="text-align:' + alignments[h] + ';"' : '';
      html += '<th' + hAlign + '>' + renderInlineMarkdown(headers[h]) + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (var r = 0; r < rows.length; r++) {
      html += '<tr>';
      for (var c = 0; c < headers.length; c++) {
        var align = alignments[c] ? ' style="text-align:' + alignments[c] + ';"' : '';
        html += '<td' + align + '>' + renderInlineMarkdown(rows[r][c] || '') + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return { html: html, nextIndex: i };
  }

  function renderMermaidBlock(source) {
    var encoded = encodeBase64Utf8(source);
    if (!encoded) {
      return '<pre data-language="mermaid"><code class="language-mermaid">' + UI.escapeHtml(source) + '</code></pre>';
    }
    return '<div class="mermaid-placeholder" data-mermaid="' + UI.escapeHtml(encoded) + '">'
      + '<div class="mermaid-loading">Rendering diagram...</div>'
      + '</div>';
  }

  function renderMarkdownLines(lines) {
    var html = '';
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (isBlankLine(line)) {
        i++;
        continue;
      }

      var fence = String(line || '').match(/^\s*```([A-Za-z0-9_-]+)?/);
      if (fence) {
        var codeLines = [];
        var lang = safeLanguageClass(fence[1] || '');
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        if (String(lang || '').toLowerCase() === 'mermaid') {
          html += renderMermaidBlock(codeLines.join('\n'));
        } else {
          html += '<pre' + (lang ? ' data-language="' + UI.escapeHtml(lang) + '"' : '') + '><code' + (lang ? ' class="language-' + UI.escapeHtml(lang) + '"' : '') + '>' + UI.escapeHtml(codeLines.join('\n')) + '</code></pre>';
        }
        continue;
      }

      if (horizontalRuleMatch(line)) {
        html += '<hr />';
        i++;
        continue;
      }

      if (isTableStart(lines, i)) {
        var table = renderTable(lines, i);
        html += table.html;
        i = table.nextIndex;
        continue;
      }

      var heading = headingMatch(line);
      if (heading) {
        var level = Math.min(6, heading[1].length);
        html += '<h' + level + '>' + renderInlineMarkdown(heading[2]) + '</h' + level + '>';
        i++;
        continue;
      }

      var quote = blockquoteMatch(line);
      if (quote) {
        var quoteLines = [];
        while (i < lines.length) {
          quote = blockquoteMatch(lines[i]);
          if (!quote) break;
          quoteLines.push(quote[1]);
          i++;
        }
        html += '<blockquote>' + renderMarkdownLines(quoteLines) + '</blockquote>';
        continue;
      }

      var unordered = unorderedListMatch(line);
      var ordered = orderedListMatch(line);
      if (unordered || ordered) {
        var listTag = ordered ? 'ol' : 'ul';
        var items = [];
        while (i < lines.length) {
          var match = listTag === 'ol' ? orderedListMatch(lines[i]) : unorderedListMatch(lines[i]);
          if (match) {
            items.push(match[1]);
            i++;
            continue;
          }
          if (!isBlankLine(lines[i]) && items.length > 0 && /^\s{2,}\S/.test(lines[i])) {
            items[items.length - 1] += '\n' + lines[i].trim();
            i++;
            continue;
          }
          break;
        }
        html += '<' + listTag + '>';
        for (var li = 0; li < items.length; li++) {
          html += '<li>' + renderListItemContent(items[li]) + '</li>';
        }
        html += '</' + listTag + '>';
        continue;
      }

      var paragraphLines = [];
      while (i < lines.length && !isBlankLine(lines[i]) && !isBlockStart(lines[i]) && !isTableStart(lines, i)) {
        paragraphLines.push(lines[i]);
        i++;
      }
      html += '<p>' + renderInlineMarkdown(paragraphLines.join('\n')).replace(/\n/g, '<br>') + '</p>';
    }

    return html;
  }

  function renderHostMarkdownHtml(text, className) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return '';
    var utils = window.__companionUtils || {};
    if (typeof utils.renderMarkdown !== 'function') return '';
    try {
      var rendered = utils.renderMarkdown(text);
      if (!rendered || rendered.nodeType !== 1) return '';
      var wrapper = document.createElement('div');
      wrapper.className = className;
      wrapper.appendChild(rendered);
      return wrapper.outerHTML;
    } catch (e) {
      console.warn('[decidr] Host rich text renderer failed, using fallback:', e);
      return '';
    }
  }

  function openExternalUrlInMcpviewsTab(url, options) {
    if (!url) return false;
    options = options || {};
    var host = window.__mcpviewsHost || {};
    var utils = window.__companionUtils || {};
    var opener = typeof host.openExternalUrlInTab === 'function'
      ? host.openExternalUrlInTab
      : utils.openExternalUrlInTab;
    if (typeof opener !== 'function') return false;
    opener(url, {
      title: options.title || 'Stripe Billing',
      returnOrigins: Array.isArray(options.returnOrigins) ? options.returnOrigins : []
    });
    return true;
  }

  function renderSelectOptions(items, labelKey, selectedId, emptyLabel) {
    var html = '';
    if (emptyLabel) {
      html += '<option value="">' + UI.escapeHtml(emptyLabel) + '</option>';
    }
    items = Array.isArray(items) ? items : [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {};
      var id = item.id || '';
      if (!id) continue;
      var label = item[labelKey] || item.title || item.name || id;
      html += '<option value="' + UI.escapeHtml(id) + '"' + (id === selectedId ? ' selected' : '') + '>'
        + UI.escapeHtml(label) + '</option>';
    }
    return html;
  }

  UI.headerActionButton = function(opts) {
    var o = opts || {};
    var label = o.label || 'Add';
    var classes = 'decidr-header-action';
    if (o.variant === 'primary') classes += ' decidr-header-action-primary';
    if (o.className) classes += ' ' + UI.escapeHtml(o.className);
    var attrs = '';
    if (o.id) attrs += ' id="' + UI.escapeHtml(o.id) + '"';
    if (o.action) attrs += ' data-create-action="' + UI.escapeHtml(o.action) + '"';
    if (o.contextId) attrs += ' data-context-id="' + UI.escapeHtml(o.contextId) + '"';
    if (o.title) attrs += ' title="' + UI.escapeHtml(o.title) + '"';
    if (o.disabled) attrs += ' disabled aria-disabled="true"';
    return '<button type="button" class="' + classes + '"' + attrs + '>'
      + '<span class="decidr-header-action-plus">+</span>'
      + '<span>' + UI.escapeHtml(label.replace(/^\+\s*/, '')) + '</span>'
      + '</button>';
  };

  UI.headerActions = function(actions) {
    actions = Array.isArray(actions) ? actions : [];
    if (!actions.length) return '';
    var html = '<div class="decidr-header-actions">';
    for (var i = 0; i < actions.length; i++) {
      html += UI.headerActionButton(actions[i]);
    }
    html += '</div>';
    return html;
  };

  UI.createEntityDialog = function(opts) {
    var o = opts || {};
    var type = o.type || '';
    if (!type) return '';

    var initiatives = Array.isArray(o.initiatives) ? o.initiatives : [];
    var projects = Array.isArray(o.projects) ? o.projects : [];
    var decisions = Array.isArray(o.decisions) ? o.decisions : [];
    var titleMap = {
      initiative: 'New Initiative',
      project: 'New Project',
      decision: 'New Decision',
      task: 'New Task'
    };
    var labelMap = {
      initiative: 'Create initiative',
      project: 'Create project',
      decision: 'Create decision',
      task: 'Create task'
    };
    var needsProjectParent = type === 'project' && initiatives.length === 0;
    var needsDecisionParent = type === 'decision' && initiatives.length === 0 && projects.length === 0;
    var needsTaskParent = type === 'task' && projects.length === 0 && decisions.length === 0;
    var disableSubmit = !!o.busy || needsProjectParent || needsDecisionParent || needsTaskParent;
    var parentType = o.parentType || (projects.length ? 'PROJECT' : (initiatives.length ? 'INITIATIVE' : 'DECISION'));
    var taskParentType = o.parentType || (projects.length ? 'PROJECT' : 'DECISION');

    var html = '<div class="decidr-create-overlay" role="presentation">'
      + '<div class="decidr-create-dialog" role="dialog" aria-modal="true" aria-labelledby="decidr-create-title">'
      + '<form id="decidr-create-form" data-create-type="' + UI.escapeHtml(type) + '">'
      + '<div class="decidr-create-header">'
      + '<h2 id="decidr-create-title">' + UI.escapeHtml(titleMap[type] || 'New Item') + '</h2>'
      + '<button type="button" class="decidr-create-close" id="decidr-create-cancel" aria-label="Close">&times;</button>'
      + '</div>';

    if (o.error) {
      html += '<div class="decidr-create-error">' + UI.escapeHtml(o.error) + '</div>';
    }

    if (type === 'initiative' || type === 'project') {
      html += '<label for="decidr-create-name">Name</label>'
        + '<input id="decidr-create-name" name="name" type="text" autocomplete="off" required autofocus>';
    } else {
      html += '<label for="decidr-create-title-input">Title</label>'
        + '<input id="decidr-create-title-input" name="title" type="text" autocomplete="off" required autofocus>';
    }

    html += '<label for="decidr-create-description">Description</label>'
      + '<textarea id="decidr-create-description" name="description" rows="4" placeholder="Optional context..."></textarea>';

    if (type === 'project') {
      html += '<label for="decidr-create-initiative-id">Initiative</label>'
        + '<select id="decidr-create-initiative-id" name="initiativeId" required' + (needsProjectParent ? ' disabled' : '') + '>'
        + renderSelectOptions(initiatives, 'name', o.parentId || '', needsProjectParent ? 'Create an initiative first' : 'Choose initiative')
        + '</select>';
    }

    if (type === 'decision') {
      html += '<div class="decidr-create-grid">'
        + '<div><label for="decidr-create-parent-type">Parent</label>'
        + '<select id="decidr-create-parent-type" name="parentType">'
        + '<option value="PROJECT"' + (parentType === 'PROJECT' ? ' selected' : '') + (projects.length ? '' : ' disabled') + '>Project</option>'
        + '<option value="INITIATIVE"' + (parentType === 'INITIATIVE' ? ' selected' : '') + (initiatives.length ? '' : ' disabled') + '>Initiative</option>'
        + '</select></div>'
        + '<div><label for="decidr-create-status">Initial status</label>'
        + '<select id="decidr-create-status" name="status">'
        + '<option value="DRAFT">Draft</option>'
        + '<option value="BACKLOG">Backlog</option>'
        + '</select></div>'
        + '</div>'
        + '<div class="decidr-create-help">Only Draft and Backlog are available until you create and link a document for this decision.</div>'
        + '<div class="decidr-create-parent-select" data-parent-select="PROJECT" style="display:' + (parentType === 'PROJECT' ? 'block' : 'none') + ';">'
        + '<label for="decidr-create-parent-project-id">Project</label>'
        + '<select id="decidr-create-parent-project-id" name="projectId" ' + (projects.length ? '' : 'disabled') + '>'
        + renderSelectOptions(projects, 'name', o.parentType === 'PROJECT' ? o.parentId : '', projects.length ? 'Choose project' : 'No projects available')
        + '</select></div>'
        + '<div class="decidr-create-parent-select" data-parent-select="INITIATIVE" style="display:' + (parentType === 'INITIATIVE' ? 'block' : 'none') + ';">'
        + '<label for="decidr-create-parent-initiative-id">Initiative</label>'
        + '<select id="decidr-create-parent-initiative-id" name="initiativeId" ' + (initiatives.length ? '' : 'disabled') + '>'
        + renderSelectOptions(initiatives, 'name', o.parentType === 'INITIATIVE' ? o.parentId : '', initiatives.length ? 'Choose initiative' : 'No initiatives available')
        + '</select></div>';
    }

    if (type === 'task') {
      html += '<div class="decidr-create-grid">'
        + '<div><label for="decidr-create-task-parent-type">Parent</label>'
        + '<select id="decidr-create-task-parent-type" name="parentType">'
        + '<option value="PROJECT"' + (taskParentType === 'PROJECT' ? ' selected' : '') + (projects.length ? '' : ' disabled') + '>Project</option>'
        + '<option value="DECISION"' + (taskParentType === 'DECISION' ? ' selected' : '') + (decisions.length ? '' : ' disabled') + '>Decision</option>'
        + '</select></div>'
        + '<div><label for="decidr-create-task-status">Initial status</label>'
        + '<select id="decidr-create-task-status" name="status">'
        + '<option value="TODO">To Do</option>'
        + '<option value="BACKLOG">Backlog</option>'
        + '</select></div>'
        + '</div>'
        + '<div class="decidr-create-parent-select" data-parent-select="PROJECT" style="display:' + (taskParentType === 'PROJECT' ? 'block' : 'none') + ';">'
        + '<label for="decidr-create-task-project-id">Project</label>'
        + '<select id="decidr-create-task-project-id" name="projectId" ' + (projects.length ? '' : 'disabled') + '>'
        + renderSelectOptions(projects, 'name', o.parentType === 'PROJECT' ? o.parentId : '', projects.length ? 'Choose project' : 'No projects available')
        + '</select></div>'
        + '<div class="decidr-create-parent-select" data-parent-select="DECISION" style="display:' + (taskParentType === 'DECISION' ? 'block' : 'none') + ';">'
        + '<label for="decidr-create-task-decision-id">Decision</label>'
        + '<select id="decidr-create-task-decision-id" name="decisionId" ' + (decisions.length ? '' : 'disabled') + '>'
        + renderSelectOptions(decisions, 'title', o.parentType === 'DECISION' ? o.parentId : '', decisions.length ? 'Choose decision' : 'No decisions available')
        + '</select></div>';
    }

    html += '<div class="decidr-create-actions">'
      + '<button type="button" class="decidr-create-secondary" id="decidr-create-cancel-secondary">Cancel</button>'
      + '<button type="submit" class="decidr-create-primary" id="decidr-create-submit"' + (disableSubmit ? ' disabled' : '') + '>'
      + UI.escapeHtml(o.busy ? 'Creating...' : (labelMap[type] || 'Create'))
      + '</button>'
      + '</div>'
      + '</form></div></div>';
    return html;
  };

  UI.projectDecisionCreateForm = function(open) {
    var html = '<div class="decidr-so-inline-form' + (open ? ' visible' : '') + '" id="decidr-so-form-add-project-decision">';
    html += '<input type="text" id="decidr-so-input-project-decision-title" placeholder="Decision title...">';
    html += '<textarea id="decidr-so-input-project-decision-description" placeholder="Optional context..." rows="3"></textarea>';
    html += '<label for="decidr-so-input-project-decision-status">Status</label>';
    html += '<select id="decidr-so-input-project-decision-status">'
      + '<option value="DRAFT">Draft</option>'
      + '<option value="BACKLOG">Backlog</option>'
      + '</select>';
    html += '<div class="decidr-so-form-help">Only Draft and Backlog are available until you create and link a document for this decision.</div>';
    html += '<div class="decidr-so-form-actions">'
      + '<button class="decidr-so-btn decidr-so-btn-sm" id="decidr-so-btn-cancel-project-decision">Cancel</button>'
      + '<button class="decidr-so-btn decidr-so-btn-primary decidr-so-btn-sm" id="decidr-so-btn-save-project-decision">Save</button>'
      + '</div></div>';
    return html;
  };

  UI.richDescription = function(str, opts) {
    if (!str) return '';
    opts = opts || {};
    var className = 'decidr-rich-text';
    if (opts.className) className += ' ' + UI.escapeHtml(opts.className);
    var text = normalizeDescriptionText(str);
    var hostHtml = opts.useHostRenderer === false ? '' : renderHostMarkdownHtml(text, className);
    if (hostHtml) return hostHtml;
    return '<div class="' + className + '">' + renderMarkdownLines(text.split('\n')) + '</div>';
  };

  UI.renderRichEmbeds = function(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return;

    var tables = container.querySelectorAll('.decidr-rich-text table');
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      if (table.parentNode && table.parentNode.classList && table.parentNode.classList.contains('decidr-rich-table-wrap')) {
        continue;
      }
      var wrap = document.createElement('div');
      wrap.className = 'decidr-rich-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }

    var utils = window.__companionUtils || {};
    if (typeof utils.renderMermaidBlocks === 'function') {
      try {
        utils.renderMermaidBlocks(container);
      } catch (e) {
        console.warn('[decidr] Mermaid render failed:', e);
      }
    }
  };

  function parseMcpToolResponse(result) {
    if (!result) throw new Error('No response returned from MCP proxy.');
    if (result.isError) {
      var errorText = result.content && result.content[0] && result.content[0].text;
      throw new Error(errorText || 'MCP tool returned an error.');
    }
    if (!result.content || !result.content[0] || typeof result.content[0].text !== 'string') return result;
    try {
      return JSON.parse(result.content[0].text) || {};
    } catch (e) {
      throw new Error('Failed to parse MCP payload.');
    }
  }

  function localMcpToolFetch(toolName, args) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('MCP fetch unavailable.'));
    return fetch('http://localhost:4200/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args || {}
        }
      })
    }).then(function(res) {
      if (!res.ok) throw new Error('MCP request failed: ' + res.status);
      return res.json();
    }).then(function(payload) {
      if (payload && payload.error && payload.error.message) throw new Error(payload.error.message);
      return parseMcpToolResponse(payload && payload.result ? payload.result : payload);
    });
  }

  function mcpToolFetch(toolName, args) {
    var utils = window.__companionUtils || {};
    if (typeof utils.companionFetch === 'function') {
      return utils.companionFetch(toolName, args || {})
        .then(parseMcpToolResponse)
        .catch(function() {
          return localMcpToolFetch(toolName, args || {});
        });
    }
    return localMcpToolFetch(toolName, args || {});
  }

  function normalizeMcpData(payload) {
    return payload && payload.data ? payload.data : payload;
  }

  function ludflowVersionHasContent(version) {
    return !!(version && (version.content || version.body || version.extractedText));
  }

  function normalizeLudflowVersionMeta(version, fallbackDoc) {
    var meta = version || {};
    var fallback = fallbackDoc || {};
    return {
      id: meta.id || '',
      content: meta.content || meta.body || meta.extractedText || '',
      format: meta.format || fallback.format || 'MARKDOWN',
      mimeType: meta.mimeType || meta.mime_type || fallback.mimeType || fallback.mime_type || '',
      versionNumber: meta.versionNumber || meta.version_number,
      label: meta.label || null,
      sourceArtifactVersion: meta.sourceArtifactVersion || meta.source_artifact_version || fallback.sourceArtifactVersion || fallback.source_artifact_version || null,
      decisionId: meta.decisionId || meta.decision_id || fallback.decisionId || fallback.decision_id || null,
      decisionLifecycleStage: meta.decisionLifecycleStage || meta.decision_lifecycle_stage || fallback.decisionLifecycleStage || fallback.decision_lifecycle_stage || null,
      createdAt: meta.createdAt || meta.created_at || null
    };
  }

  UI.fetchLudflowDocumentVersions = function(documentId, baseDoc) {
    if (!documentId) return Promise.resolve([]);
    var existing = baseDoc || {};
    return mcpToolFetch('ludflow__get_document', {
      document_id: documentId,
      include_links: false,
      include_children: false
    }).then(function(payload) {
      var doc = normalizeMcpData(payload) || {};
      var versions = Array.isArray(doc.versions) ? doc.versions.slice() : [];
      if (!versions.length) return [];
      versions.sort(function(left, right) {
        return Number(right.versionNumber || right.version_number || 0) - Number(left.versionNumber || left.version_number || 0);
      });
      return Promise.all(versions.map(function(version) {
        var normalized = normalizeLudflowVersionMeta(version, doc);
        var versionNumber = Number(version && (version.versionNumber || version.version_number));
        if (!versionNumber || ludflowVersionHasContent(version)) {
          return normalized;
        }
        return mcpToolFetch('ludflow__get_document', {
          document_id: documentId,
          version_number: versionNumber,
          include_links: false,
          include_children: false
        }).then(function(versionPayload) {
          var versionDoc = normalizeMcpData(versionPayload) || {};
          normalized.content = versionDoc.content || '';
          normalized.format = normalized.format || versionDoc.format || doc.format || existing.format || 'MARKDOWN';
          normalized.mimeType = normalized.mimeType || versionDoc.mimeType || versionDoc.mime_type || doc.mimeType || doc.mime_type || existing.mimeType || existing.mime_type || '';
          normalized.sourceArtifactVersion = normalized.sourceArtifactVersion || versionDoc.sourceArtifactVersion || versionDoc.source_artifact_version || null;
          return normalized;
        }).catch(function(err) {
          console.warn('[decidr] Failed to load Ludflow document version content:', err);
          return normalized;
        });
      }));
    });
  };

  function validDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'object') {
      if (typeof value.toISOString === 'function') {
        return validDate(value.toISOString());
      }
      return null;
    }
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  UI.timeAgo = function(dateStr) {
    var then = validDate(dateStr);
    if (!then) return '';
    var now = new Date();
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
    var d = validDate(dateStr);
    if (!d) return '';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  UI.isCatchUpDecision = function(decision) {
    return normalizeStatus(decision && (decision.kind || decision.decisionKind || decision.decision_kind)) === 'catch_up';
  };

  UI.decisionKindBadge = function(decision) {
    if (!UI.isCatchUpDecision(decision)) return '';
    return '<span class="decidr-badge decidr-decision-kind-catch-up">Catch-up</span>';
  };

  // ─── Activity Label ─────────────────────────────────────────────────

  UI.activityLabel = function(lastActivity) {
    if (!lastActivity) return '';
    var action = lastActivity.action ? String(lastActivity.action).toUpperCase() : '';
    var label = lastActivity.label || action || '';
    var time = lastActivity.createdAt ? UI.timeAgo(lastActivity.createdAt) : '';
    if (!label) return '';
    var actionClass = 'decidr-activity-' + action.toLowerCase().replace(/_/g, '-');
    return '<span class="decidr-activity-label ' + actionClass + '">'
      + UI.escapeHtml(label) + '</span>'
      + (time ? '<span class="decidr-activity-time"> \u00b7 ' + UI.escapeHtml(time) + '</span>' : '');
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
      + '</svg>',
    issue: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="11" r="1" fill="currentColor"/><path d="M8 5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    audit_event: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3.5h10"/><path d="M3 8h10"/><path d="M3 12.5h6"/><circle cx="12" cy="12.5" r="1.5"/></svg>',
    pull_request: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="11" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 6v4M11 4v6" stroke="currentColor" stroke-width="1.5"/></svg>',
    repo: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5v-9z" fill="currentColor"/></svg>'
  };

  var ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z"/><line x1="9" y1="4.5" x2="11.5" y2="7"/></svg>';
  var ICON_CHEVRON_DOWN = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l5 5 5-5"/></svg>';
  var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10"/><path d="M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1"/><path d="M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9"/></svg>';
  var ICON_CALENDAR = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5" y1="1.5" x2="5" y2="4.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/></svg>';
  var ICON_COPY = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V4.5A1.5 1.5 0 014.5 3H11"/></svg>';
  var ICON_BUILDING = '<svg class="decidr-org-picker-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/></svg>';
  var ICON_CHEVRON_SMALL = '<svg class="decidr-org-picker-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5"/></svg>';
  var ICON_SETTINGS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.2 1.2a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.7a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.2-1.2a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.7a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.2-1.2a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.7a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v1.7a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6z"></path></svg>';
  var ICON_STAR_FILLED = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  var ICON_STAR_OUTLINE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  var ICON_CHECK_BOLD = '<svg class="decidr-org-picker-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  function entityIcon(type) {
    return ENTITY_ICONS[type] || ENTITY_ICONS.project;
  }

  function fallbackCopyText(text) {
    return new Promise(function(resolve, reject) {
      if (typeof document === 'undefined' || !document.body) {
        reject(new Error('Clipboard fallback unavailable'));
        return;
      }
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        if (document.execCommand('copy')) resolve();
        else reject(new Error('Copy command failed'));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(textarea);
      }
    });
  }

  UI.copyRefType = function(type) {
    var norm = normalizeStatus(type || '');
    var map = {
      initiative: 'initiative',
      initiatives: 'initiative',
      project: 'project',
      projects: 'project',
      decision: 'decision',
      decisions: 'decision',
      task: 'task',
      tasks: 'task'
    };
    return map[norm] || '';
  };

  UI.copyRefText = function(type, id) {
    var norm = UI.copyRefType(type);
    if (!norm || !id) return '';
    return norm + ' ' + String(id);
  };

  UI.copyRefButton = function(type, id) {
    var norm = UI.copyRefType(type);
    if (!norm || !id) return '';
    var label = 'Copy ' + norm + ' ID';
    return '<button type="button" class="decidr-copy-ref-btn" '
      + 'data-decidr-copy-ref="1" '
      + 'data-decidr-copy-type="' + UI.escapeHtml(norm) + '" '
      + 'data-decidr-copy-id="' + UI.escapeHtml(id) + '" '
      + 'title="' + UI.escapeHtml(label) + '" '
      + 'aria-label="' + UI.escapeHtml(label) + '">'
      + ICON_COPY
      + '</button>';
  };

  UI.copyRefToClipboard = function(type, id) {
    var text = UI.copyRefText(type, id);
    if (!text) return Promise.reject(new Error('Unsupported DecidR reference'));
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function() {
        return fallbackCopyText(text);
      }).then(function() {
        return text;
      });
    }
    return fallbackCopyText(text).then(function() {
      return text;
    });
  };

  UI.wireCopyRefButtons = function(root) {
    if (!root || !root.querySelectorAll) return;
    var buttons = root.querySelectorAll('[data-decidr-copy-ref]');
    for (var i = 0; i < buttons.length; i++) {
      (function(btn) {
        if (btn._decidrCopyWired) return;
        btn._decidrCopyWired = true;
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          var type = btn.getAttribute('data-decidr-copy-type');
          var id = btn.getAttribute('data-decidr-copy-id');
          UI.copyRefToClipboard(type, id).then(function() {
            btn.classList.remove('decidr-copy-ref-failed');
            btn.classList.add('decidr-copy-ref-copied');
            btn.setAttribute('title', 'Copied');
            btn.setAttribute('aria-label', 'Copied ' + UI.copyRefText(type, id));
            clearTimeout(btn._decidrCopyResetTimer);
            btn._decidrCopyResetTimer = setTimeout(function() {
              btn.classList.remove('decidr-copy-ref-copied');
              btn.setAttribute('title', 'Copy ' + type + ' ID');
              btn.setAttribute('aria-label', 'Copy ' + type + ' ID');
            }, 1400);
          }).catch(function(err) {
            console.warn('[decidr] Copy reference failed:', err);
            btn.classList.remove('decidr-copy-ref-copied');
            btn.classList.add('decidr-copy-ref-failed');
            btn.setAttribute('title', 'Copy failed');
            btn.setAttribute('aria-label', 'Copy failed');
            clearTimeout(btn._decidrCopyResetTimer);
            btn._decidrCopyResetTimer = setTimeout(function() {
              btn.classList.remove('decidr-copy-ref-failed');
              btn.setAttribute('title', 'Copy ' + type + ' ID');
              btn.setAttribute('aria-label', 'Copy ' + type + ' ID');
            }, 1600);
          });
        });
      })(buttons[i]);
    }
  };

  UI.bridgeEndpointLabel = function(bridge, side) {
    if (!bridge) return '';
    var isFrom = side === 'from';
    var decision = isFrom ? bridge.fromDecision : bridge.toDecision;
    var project = isFrom ? bridge.fromProject : bridge.toProject;
    var decisionId = isFrom
      ? (bridge.fromDecisionId || bridge.from_decision_id)
      : (bridge.toDecisionId || bridge.to_decision_id);
    var projectId = isFrom
      ? (bridge.fromProjectId || bridge.from_project_id || bridge.sourceProjectId || bridge.source_project_id)
      : (bridge.toProjectId || bridge.to_project_id || bridge.targetProjectId || bridge.target_project_id);

    if (decision) return decision.title || decision.name || decision.id || decisionId || '';
    if (project) return project.name || project.title || project.id || projectId || '';
    return decisionId || projectId || '';
  };

  UI.bridgeEndpointProjectId = function(bridge, side) {
    if (!bridge) return '';
    var isFrom = side === 'from';
    var decision = isFrom ? bridge.fromDecision : bridge.toDecision;
    if (decision && decision.projectId) return decision.projectId;
    if (decision && decision.project_id) return decision.project_id;
    return isFrom
      ? (bridge.fromProjectId || bridge.from_project_id || bridge.sourceProjectId || bridge.source_project_id || '')
      : (bridge.toProjectId || bridge.to_project_id || bridge.targetProjectId || bridge.target_project_id || '');
  };

  UI.bridgeEndpointProjectName = function(bridge, side) {
    if (!bridge) return '';
    var isFrom = side === 'from';
    var decision = isFrom ? bridge.fromDecision : bridge.toDecision;
    var project = isFrom ? bridge.fromProject : bridge.toProject;
    if (decision && decision.project) return decision.project.name || decision.project.title || decision.project.id || '';
    if (project) return project.name || project.title || project.id || '';
    return '';
  };

  UI.bridgeEndpointSummary = function(bridge) {
    var fromName = UI.bridgeEndpointLabel(bridge, 'from');
    var toName = UI.bridgeEndpointLabel(bridge, 'to');
    if (!fromName && !toName) return '';
    return (fromName || 'Source') + ' \u2192 ' + (toName || 'Target');
  };

  // ─── Card Components ──────────────────────────────────────────────

  UI.projectCard = function(project, opts) {
    var o = opts || {};
    var decisions = o.decisions || [];
    var tasks = o.tasks || [];
    var bridges = o.bridges || [];

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
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.descriptionPreview(project.description, 120)) + '</div>'
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
    if (bridges.length > 0) {
      metaParts.push(bridges.length + ' bridge' + (bridges.length !== 1 ? 's' : ''));
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
      + UI.copyRefButton('project', project.id)
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
    var bridges = o.bridges || [];
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
    if (bridges.length > 0) {
      statParts.push('<span class="decidr-inline-icon">' + ENTITY_ICONS.bridge + '</span>'
        + bridges.length + ' bridge' + (bridges.length !== 1 ? 's' : ''));
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
      + '<div class="decidr-dash-proj-title-row">'
      + '<div class="decidr-dash-proj-name">' + UI.escapeHtml(project.name) + '</div>'
      + UI.copyRefButton('project', project.id)
      + '</div>'
      + ownerHtml
      + '<div class="decidr-dash-proj-meta">'
      + UI.statusBadge(project.status)
      + (badgesHtml ? ' ' + badgesHtml : '')
      + '</div>'
      + statHtml
      + UI.githubCountBadges(o.githubCounts)
      + progressHtml
      + '</div>';
  };

  // ─── GitHub Helper Components ─────────────────────────────────────

  UI.labelBadge = function(label) {
    var lblName = typeof label === 'string' ? label : (label.name || '');
    var lblColor = (typeof label === 'object' && label.color) ? label.color : '';
    if (lblColor && lblColor.charAt(0) !== '#') lblColor = '#' + lblColor;
    var lblStyle = lblColor
      ? 'background:' + UI.sanitizeColor(lblColor) + '22;color:' + UI.sanitizeColor(lblColor) + ';border:1px solid ' + UI.sanitizeColor(lblColor) + '44;'
      : 'background:var(--glass-bg);color:var(--text-secondary);border:1px solid var(--border-subtle);';
    return '<span style="' + lblStyle + 'padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">' + UI.escapeHtml(lblName) + '</span>';
  };

  UI.githubIssuesList = function(issues, opts) {
    opts = opts || {};
    var limit = opts.limit || 5;
    var items = issues.slice(0, limit);
    if (!items.length) {
      return opts.showEmpty !== false ? '<div class="decidr-so-empty-hint">No linked issues</div>' : '';
    }
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var issue = items[i];
      html += '<div class="decidr-so-doc-item" data-entity-type="issue" data-entity-id="' + issue.id + '">';
      html += '<span class="decidr-so-doc-link" style="pointer-events:none;">';
      html += '<span style="color:var(--text-tertiary);font-weight:var(--weight-medium);margin-right:4px;">#' + (issue.githubIssueNumber || '') + '</span>';
      html += UI.escapeHtml(issue.githubIssueTitle || 'Untitled');
      html += '</span>';
      if (issue.githubState) {
        html += UI.statusBadge(issue.githubState);
      }
      if (issue.source) {
        html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(issue.source) + '</span>';
      }
      html += '</div>';
    }
    if (issues.length > limit) {
      html += '<div class="decidr-so-empty-hint">+ ' + (issues.length - limit) + ' more</div>';
    }
    return html;
  };

  UI.githubPRsList = function(prs, opts) {
    opts = opts || {};
    var limit = opts.limit || 5;
    var items = prs.slice(0, limit);
    if (!items.length) {
      return opts.showEmpty !== false ? '<div class="decidr-so-empty-hint">No linked pull requests</div>' : '';
    }
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var pr = items[i];
      html += '<div class="decidr-so-decision-item" data-entity-type="pull_request" data-entity-id="' + pr.id + '">';
      html += UI.statusBadge(pr.status || 'OPEN');
      html += '<span class="decidr-so-decision-title">';
      html += '<span style="color:var(--text-tertiary);margin-right:4px;">#' + (pr.githubPrNumber || '') + '</span>';
      html += UI.escapeHtml(pr.branchName || 'Unknown branch');
      html += '</span>';
      if (pr.reviewer) {
        html += '<span class="decidr-so-doc-type-badge">' + UI.escapeHtml(pr.reviewer.name || 'Reviewer') + '</span>';
      }
      html += '<span class="decidr-so-decision-chevron">\u203a</span>';
      html += '</div>';
    }
    if (prs.length > limit) {
      html += '<div class="decidr-so-empty-hint">+ ' + (prs.length - limit) + ' more</div>';
    }
    return html;
  };

  UI.githubCountBadges = function(counts) {
    if (!counts) return '';
    var html = '';
    var any = false;
    if (counts.issues > 0) {
      html += '<span class="decidr-dash-proj-badge decidr-gh-badge-issues">' + counts.issues + ' issue' + (counts.issues !== 1 ? 's' : '') + '</span>';
      any = true;
    }
    if (counts.openPrs > 0) {
      html += '<span class="decidr-dash-proj-badge decidr-gh-badge-prs">' + counts.openPrs + ' open PR' + (counts.openPrs !== 1 ? 's' : '') + '</span>';
      any = true;
    }
    if (counts.pendingReviewPrs > 0) {
      html += '<span class="decidr-dash-proj-badge decidr-gh-badge-review">' + counts.pendingReviewPrs + ' needs review</span>';
      any = true;
    }
    return any ? html : '';
  };

  // ─── Graph Project Card (SVG foreignObject content) ───────────────

  /** @private Status color map for graph nodes */
  function _graphStatusColor(status) {
    var map = { active: '#22c55e', planning: '#3b82f6', completed: '#6b7280',
                backlog: '#9ca3af', proposed: '#f59e0b', in_progress: '#3b82f6', implemented: '#22c55e' };
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
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.descriptionPreview(decision.description, 120)) + '</div>'
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
      + UI.decisionKindBadge(decision)
      + UI.copyRefButton('decision', decision.id)
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(decision.title) + '</div>'
      + descHtml
      + metaHtml
      + '</div>'
      + '</div>';
  };

  UI.auditEventCard = function(event, opts) {
    var o = opts || {};

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    var category = event.category && event.category.name ? event.category.name : event.category;
    var descHtml = event.summary
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.truncate(event.summary, 120)) + '</div>'
      : '';

    var metaParts = [];
    if (category) metaParts.push(category);
    if (event.occurredAt) metaParts.push(UI.formatDate(event.occurredAt));
    else if (event.createdAt) metaParts.push(UI.timeAgo(event.createdAt));
    if (event.createdByClient) metaParts.push(event.createdByClient);
    var metaHtml = metaParts.length > 0
      ? '<div class="decidr-card-meta">' + UI.escapeHtml(metaParts.join(' \u00b7 ')) + '</div>'
      : '';

    return '<div class="decidr-card decidr-audit-event-card" '
      + 'data-entity-type="audit_event" data-entity-id="' + UI.escapeHtml(event.id) + '"'
      + animStyle + '>'
      + '<div class="decidr-card-icon">' + entityIcon('audit_event') + '</div>'
      + '<div class="decidr-card-body">'
      + '<div class="decidr-card-header">'
      + '<span class="decidr-card-type-label">Audit Event</span>'
      + UI.statusBadge(event.status || 'OPEN')
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(event.title || 'Untitled event') + '</div>'
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
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.descriptionPreview(task.description, 100)) + '</div>'
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
      + UI.copyRefButton('task', task.id)
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
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.descriptionPreview(bridge.description, 120)) + '</div>'
      : '';

    var metaParts = [];
    if (o.endpointSummary) {
      metaParts.push(o.endpointSummary);
    } else if (o.fromProjectName || o.toProjectName) {
      var fromName = o.fromProjectName || '?';
      var toName = o.toProjectName || '?';
      metaParts.push(fromName + ' \u2192 ' + toName);
    } else {
      var endpointSummary = UI.bridgeEndpointSummary(bridge);
      if (endpointSummary) metaParts.push(endpointSummary);
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
        + (initiative.description ? '<span class="decidr-init-description">' + UI.escapeHtml(UI.descriptionPreview(initiative.description, 80)) + '</span>' : '')
        + '</div>'
        + '<div class="decidr-init-stats">'
        + '<span class="decidr-init-stat">' + projectCount + ' project' + (projectCount !== 1 ? 's' : '') + '</span>'
        + '<span class="decidr-init-stat">' + totalDecisions + ' decision' + (totalDecisions !== 1 ? 's' : '') + '</span>'
        + '</div>'
        + '<div class="decidr-init-health">'
        + legendHtml
        + decHealthHtml
        + '</div>'
        + UI.copyRefButton('initiative', initiative.id)
        + '</div>'
        + '</div>';
    }

    // Fallback: simple card (backward-compatible for list.js)
    var descHtml = initiative.description
      ? '<div class="decidr-card-desc">' + UI.escapeHtml(UI.descriptionPreview(initiative.description, 100)) + '</div>'
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
      + UI.copyRefButton('initiative', initiative.id)
      + '</div>'
      + '<div class="decidr-card-title">' + UI.escapeHtml(initiative.name) + '</div>'
      + descHtml
      + metaHtml
      + '</div>'
      + '</div>';
  };

  UI.issueCard = function(issue, opts) {
    var o = opts || {};
    var delay = o.animDelay || 0;
    var html = '<div class="decidr-card" data-entity-type="issue" data-entity-id="' + UI.escapeHtml(issue.id) + '" style="cursor:pointer;animation-delay:' + delay + 's;">';
    html += '<div class="decidr-card-header">';
    html += '<span class="decidr-entity-icon">' + (ENTITY_ICONS.issue || '') + '</span>';
    html += '<span class="decidr-card-title">' + UI.escapeHtml(issue.githubIssueTitle || issue.title || '') + '</span>';
    if (issue.source) html += UI.statusBadge(issue.source);
    html += '</div>';
    html += '<div class="decidr-card-meta">';
    if (issue.githubIssueNumber) html += '<span>#' + issue.githubIssueNumber + '</span>';
    if (issue.githubAuthorUsername) html += '<span>by ' + UI.escapeHtml(issue.githubAuthorUsername) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  };

  UI.prArtifactCard = function(pr, opts) {
    var o = opts || {};
    var delay = o.animDelay || 0;
    var html = '<div class="decidr-card" data-entity-type="pull_request" data-entity-id="' + UI.escapeHtml(pr.id) + '" style="cursor:pointer;animation-delay:' + delay + 's;">';
    html += '<div class="decidr-card-header">';
    html += '<span class="decidr-entity-icon">' + (ENTITY_ICONS.pull_request || '') + '</span>';
    html += '<span class="decidr-card-title">PR #' + (pr.githubPrNumber || '') + '</span>';
    if (pr.status) html += UI.statusBadge(pr.status);
    html += '</div>';
    html += '<div class="decidr-card-meta">';
    if (pr.branchName) html += '<span>' + UI.escapeHtml(pr.branchName) + '</span>';
    if (pr.githubAuthorUsername) html += '<span>by ' + UI.escapeHtml(pr.githubAuthorUsername) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  };

  UI.repoCard = function(repo, opts) {
    var o = opts || {};
    var delay = o.animDelay || 0;
    var html = '<div class="decidr-card" data-entity-type="repo" data-entity-id="' + UI.escapeHtml(repo.id) + '" style="cursor:pointer;animation-delay:' + delay + 's;">';
    html += '<div class="decidr-card-header">';
    html += '<span class="decidr-entity-icon">' + (ENTITY_ICONS.repo || '') + '</span>';
    html += '<span class="decidr-card-title">' + UI.escapeHtml(repo.githubOwner + '/' + repo.githubRepo) + '</span>';
    html += '</div>';
    html += '<div class="decidr-card-meta">';
    if (repo.defaultBranch) html += '<span>' + UI.escapeHtml(repo.defaultBranch) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  };

  UI.actionItemCard = function(item, opts) {
    var o = opts || {};

    var animStyle = typeof o.animDelay === 'number'
      ? ' style="animation-delay: ' + o.animDelay.toFixed(2) + 's;"' : '';

    // Reason text removed — status badge in header is sufficient
    var reasonHtml = '';

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
      + UI.copyRefButton(entityType, item.entityId || item.id || '')
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

    // Build subtitle: "for "parent" · time ago"
    var subtitleParts = [];
    if (item.parentName) subtitleParts.push('for \u201c' + item.parentName + '\u201d');
    if (item.createdAt) subtitleParts.push(UI.timeAgo(item.createdAt));
    var subtitleHtml = subtitleParts.length > 0
      ? '<div class="decidr-next-step-meta">' + UI.escapeHtml(subtitleParts.join(' \u00b7 ')) + '</div>'
      : '';

    // Last activity line
    var activityHtml = '';
    if (o.lastActivity) {
      var actContent = UI.activityLabel(o.lastActivity);
      if (actContent) {
        activityHtml = '<div class="decidr-next-step-activity">' + actContent + '</div>';
      }
    }

    return '<div class="decidr-next-step-item" '
      + 'data-entity-type="' + UI.escapeHtml(entityType) + '" '
      + 'data-entity-id="' + UI.escapeHtml(item.entityId || item.id || '') + '"'
      + animStyle + '>'
      + '<div class="decidr-next-step-icon">' + entityIcon(entityType) + '</div>'
      + '<div class="decidr-next-step-body">'
      + '<div class="decidr-next-step-header">'
      + '<span class="decidr-next-step-type-label">' + UI.escapeHtml(typeLabel) + '</span>'
      + actionBadgeHtml
      + (item.status ? ' ' + UI.statusBadge(item.status) : '')
      + UI.copyRefButton(entityType, item.entityId || item.id || '')
      + '</div>'
      + '<div class="decidr-next-step-title">' + UI.escapeHtml(item.title) + '</div>'
      + subtitleHtml
      + activityHtml
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

    // Last activity indicator
    var activityHtml = '';
    if (o.lastActivity) {
      var actContent = UI.activityLabel(o.lastActivity);
      if (actContent) {
        activityHtml = '<div class="decidr-decision-item-activity">' + actContent + '</div>';
      }
    }

    var html = '<div class="decidr-decision-item" data-entity-type="decision" data-entity-id="' + UI.escapeHtml(decision.id) + '"' + animStyle + '>'
      + '<div class="decidr-decision-item-body">'
      + '<div class="decidr-decision-item-title">' + UI.escapeHtml(decision.title) + '</div>'
      + '<div class="decidr-decision-item-meta">' + UI.escapeHtml(ago) + '</div>'
      + activityHtml
      + '</div>'
      + UI.statusBadge(decision.status)
      + UI.decisionKindBadge(decision)
      + supersedesBadge
      + UI.copyRefButton('decision', decision.id)
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
        + UI.decisionKindBadge(supersededDec)
        + prevStatusHtml
        + '</div>'
        + UI.copyRefButton('decision', supersededDec.id)
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
      + UI.decisionKindBadge(decision)
      + UI.copyRefButton('decision', decision.id)
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

  // UI.section(title, count, content, opts) — backward-compatible
  // UI.section(icon, title, count, content, opts) — with icon
  UI.section = function(a, b, c, d, e) {
    var icon, title, count, content, opts;
    if (typeof b === 'string') {
      // Called with icon: section(icon, title, count, content)
      icon = a; title = b; count = c; content = d; opts = e || {};
    } else {
      // Called without icon: section(title, count, content)
      icon = null; title = a; count = b; content = c; opts = d || {};
    }
    var iconHtml = icon && SECTION_ICONS[icon]
      ? '<span class="decidr-section-icon">' + SECTION_ICONS[icon] + '</span>'
      : '';
    var countHtml = (count !== null && count !== undefined)
      ? ' <span class="decidr-section-count">(' + count + ')</span>'
      : '';
    var actionsHtml = opts.actionsHtml || UI.headerActions(opts.actions || []);
    return '<div class="decidr-section">'
      + '<div class="decidr-section-header">'
      + '<span class="decidr-section-title-text">' + iconHtml + UI.escapeHtml(title) + countHtml + '</span>'
      + actionsHtml
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
    _contexts: {},
    _contextSeq: 0,
    _currentContextKey: null,
    _contextScopeDepth: 0,
    _lastRenderedContextKey: null,
    _ludflowOutsideClickHandlerBound: false,

    _resolveHost: function(source) {
      var node = source && source.nodeType === 1 ? source : null;
      if (node) {
        if (node.classList && node.classList.contains('session-content')) {
          return node;
        }
        if (typeof node.closest === 'function') {
          var sessionHost = node.closest('.session-content');
          if (sessionHost) return sessionHost;
        }
      }
      return document.querySelector('.session-content.active') || document.body;
    },

    _getContextKeyForHost: function(host) {
      if (!host || host === document.body) return '__body__';
      if (!host.__decidrSlideOutContextKey) {
        UI.SlideOut._contextSeq += 1;
        host.__decidrSlideOutContextKey = 'decidr-so-context-' + UI.SlideOut._contextSeq;
      }
      return host.__decidrSlideOutContextKey;
    },

    _activateContext: function(source) {
      var host = UI.SlideOut._resolveHost(source);
      var key = UI.SlideOut._getContextKeyForHost(host);
      UI.SlideOut._currentContextKey = key;
      UI.SlideOut._getContext(key, host);
      return key;
    },

    _baseContextKey: function(contextKey) {
      return String(contextKey || '').replace(/:ludflow-document-preview$/, '');
    },

    _panelContextKey: function(type, baseContextKey) {
      var key = UI.SlideOut._baseContextKey(baseContextKey);
      return type === 'ludflow_document' ? key + ':ludflow-document-preview' : key;
    },

    _isLudflowDocumentContextKey: function(contextKey) {
      return /:ludflow-document-preview$/.test(String(contextKey || ''));
    },

    _resolveContextKey: function(sourceOrKey) {
      if (typeof sourceOrKey === 'string' && sourceOrKey) return sourceOrKey;
      if (sourceOrKey && sourceOrKey.nodeType === 1) {
        var explicitKey = null;
        if (typeof sourceOrKey.getAttribute === 'function') {
          explicitKey = sourceOrKey.getAttribute('data-decidr-so-context');
        }
        if (!explicitKey && typeof sourceOrKey.closest === 'function') {
          var scoped = sourceOrKey.closest('[data-decidr-so-context]');
          if (scoped) explicitKey = scoped.getAttribute('data-decidr-so-context');
        }
        if (explicitKey) return explicitKey;
      }
      if (UI.SlideOut._contextScopeDepth > 0 && UI.SlideOut._currentContextKey) {
        return UI.SlideOut._currentContextKey;
      }
      return UI.SlideOut._activateContext(sourceOrKey);
    },

    _getContext: function(contextKey, host) {
      var key = contextKey || UI.SlideOut._resolveContextKey();
      var context = UI.SlideOut._contexts[key];
      if (!context) {
        context = {
          key: key,
          host: null,
          stack: [],
          overlay: null,
          panel: null,
          onCloseCallback: null,
          onMutateCallback: null,
          busy: false,
          escapeHandlerBound: false
        };
        UI.SlideOut._contexts[key] = context;
      }
      if (host) context.host = host;
      return context;
    },

    _activeLudflowDocumentContext: function(target) {
      var targetElement = target && target.nodeType === 1 ? target : (target && target.parentElement ? target.parentElement : null);
      var targetHost = UI.SlideOut._resolveHost(targetElement);
      var fallback = null;
      for (var key in UI.SlideOut._contexts) {
        if (!Object.prototype.hasOwnProperty.call(UI.SlideOut._contexts, key)) continue;
        if (!UI.SlideOut._isLudflowDocumentContextKey(key)) continue;
        var context = UI.SlideOut._contexts[key];
        if (!context || !context.stack || context.stack.length === 0 || !context.panel || !context.panel.isConnected) continue;
        var open = context.panel.classList && context.panel.classList.contains('decidr-so-open');
        if (!open && context.panel.style.display === 'none') continue;
        if (targetHost && context.host === targetHost) return { key: key, context: context };
        if (!fallback) fallback = { key: key, context: context };
      }
      return fallback;
    },

    _ensureLudflowOutsideClickHandler: function() {
      if (UI.SlideOut._ludflowOutsideClickHandlerBound) return;
      document.addEventListener('click', function(e) {
        var active = UI.SlideOut._activeLudflowDocumentContext(e.target);
        if (!active || !active.context || !active.context.panel) return;
        if (active.context.panel.contains(e.target)) return;

        var targetElement = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement ? e.target.parentElement : null);
        var docLink = targetElement && typeof targetElement.closest === 'function'
          ? targetElement.closest('[data-entity-type="ludflow_document"][data-entity-id]')
          : null;
        if (docLink) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        UI.SlideOut.close(active.key);
      }, true);
      UI.SlideOut._ludflowOutsideClickHandlerBound = true;
    },

    _withContextKey: function(contextKey, fn) {
      var prevKey = UI.SlideOut._currentContextKey;
      var prevDepth = UI.SlideOut._contextScopeDepth;
      UI.SlideOut._currentContextKey = contextKey;
      UI.SlideOut._contextScopeDepth = prevDepth + 1;
      try {
        return fn();
      } finally {
        UI.SlideOut._contextScopeDepth = prevDepth;
        UI.SlideOut._currentContextKey = prevKey;
      }
    },

    open: function(type, id, opts) {
      type = (type || '').toLowerCase();
      var o = opts || {};
      var rawContextKey = UI.SlideOut._resolveContextKey(o.contextKey || o.source);
      var baseContextKey = UI.SlideOut._baseContextKey(rawContextKey);
      var baseContext = UI.SlideOut._getContext(baseContextKey);
      if (!baseContext.host) {
        baseContext.host = UI.SlideOut._resolveHost(o.source);
      }
      var contextKey = UI.SlideOut._panelContextKey(type, baseContextKey);
      UI.SlideOut._getContext(contextKey, baseContext.host);

      UI.SlideOut._withContextKey(contextKey, function() {
        // Store onClose callback only when opening root panel
        if (UI.SlideOut._stack.length === 0 && o.onClose) {
          UI.SlideOut._onCloseCallback = o.onClose;
        }
        if (UI.SlideOut._stack.length === 0 && o.onMutate) {
          UI.SlideOut._onMutateCallback = o.onMutate;
        }

        // If preloaded data is provided, push and render immediately
        if (o.data) {
          UI.SlideOut._stack.push({ type: type, id: id, data: o.data, stale: false });
          UI.SlideOut._render(contextKey);
          return;
        }

        // Push a loading state and render
        UI.SlideOut._stack.push({ type: type, id: id, data: null, stale: false });
        UI.SlideOut._render(contextKey);

        // Fetch from API
        var API = window.__decidrAPI;
        if (!API) return;

        var fetchFn = null;
        if (type === 'project' || type === 'project-timeline') fetchFn = API.getProject;
        else if (type === 'decision' || type === 'decision-timeline') fetchFn = API.getDecision;
        else if (type === 'task') fetchFn = API.getTask;
        else if (type === 'bridge') fetchFn = API.getBridge;
        else if (type === 'initiative') fetchFn = API.getInitiative;
        else if (type === 'audit_event') fetchFn = API.getAuditEvent;
        else if (type === 'organization-settings') fetchFn = API.getOrganizationMemberSettings;
        else if (type === 'ludflow_document') fetchFn = API.getLudflowDocument;
        else if (type === 'issue') fetchFn = function(id) { return API.getIssue(id); };
        else if (type === 'pull_request') fetchFn = function(id) { return API.getPR(id); };
        else if (type === 'repo') fetchFn = function(id) { return API.getRepo(id); };

        if (fetchFn) {
          fetchFn(id).then(function(data) {
            UI.SlideOut._withContextKey(contextKey, function() {
              // Update the top of stack with fetched data
              var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
              if (top && top.id === id && top.type === type) {
                top.data = data;
                // Don't render yet — wait for enrichment to complete
                // so the glass loader stays visible until everything is ready
                UI.SlideOut._enrichAndRender(type, id, data, contextKey);
              }
            });
          }).catch(function(err) {
            UI.SlideOut._withContextKey(contextKey, function() {
              // Render error state with debug info
              console.error('[decidr] SlideOut fetch failed:', err);
              console.error('[decidr] API baseUrl:', window.__decidrAPI ? window.__decidrAPI._baseUrl : 'NO API');
              console.error('[decidr] API token:', window.__decidrAPI ? (window.__decidrAPI._hasToken ? 'present' : 'EMPTY') : 'NO API');
              var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
              if (top && top.id === id && top.type === type) {
                top.data = { _error: true, _errorMsg: String(err.message || err) };
                UI.SlideOut._render(contextKey);
              }
            });
          });
        }
      });
    },

    _render: function(contextKey) {
      var resolvedKey = UI.SlideOut._resolveContextKey(contextKey);
      return UI.SlideOut._withContextKey(resolvedKey, function() {
        if (UI.SlideOut._stack.length === 0) return;
        var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
        var els = UI.SlideOut._ensureDOM(resolvedKey);
        if (!els) return;
        var isLeftPanel = top.type === 'ludflow_document';
        UI.SlideOut._lastRenderedContextKey = resolvedKey;
        els.panel.classList.toggle('decidr-so-panel-left', isLeftPanel);
        els.overlay.classList.toggle('decidr-so-overlay-left', isLeftPanel);
        if (isLeftPanel) UI.SlideOut._ensureLudflowOutsideClickHandler();

        // Header
        var hasStack = UI.SlideOut._stack.length > 1;
        var backLabel = hasStack ? 'Back' : 'Close';
        var backSvg = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" '
          + 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" '
          + 'stroke-linejoin="round"><path d="M10 3l-5 5 5 5"/></svg>';

        var typeLabels = {
          project: 'Project', decision: 'Decision',
          audit_event: 'Audit Event',
          task: 'Task', bridge: 'Bridge', initiative: 'Initiative',
          ludflow_document: 'LudFlow Document',
          'project-timeline': 'Timeline', 'decision-timeline': 'Timeline',
          'organization-settings': 'Organization'
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
        UI.renderRichEmbeds(els.content);

        // Show
        els.overlay.style.display = 'block';
        els.panel.style.display = 'flex';
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            els.overlay.classList.add('decidr-so-open');
            els.panel.classList.add('decidr-so-open');
          });
        });
      });
    },

    _getTitle: function(entry) {
      if (!entry.data) return '...';
      if (entry.data._error) return 'Error';
      if (entry.type === 'project-timeline') return 'Project Timeline';
      if (entry.type === 'decision-timeline') return 'Decision Timeline';
      if (entry.type === 'organization-settings' && entry.data.organization) {
        return entry.data.organization.name || entry.id || '';
      }
      var d = entry.data;
      return d.name || d.title || d.id || '';
    },

    _detailRenderers: {
      project: function(data) { return UI.slideOutProject(data); },
      decision: function(data) { return UI.slideOutDecision(data); },
      task: function(data) { return UI.slideOutTask(data); },
      bridge: function(data) { return UI.slideOutBridge(data); },
      initiative: function(data) { return UI.slideOutInitiative(data); },
      ludflow_document: function(data) { return UI.slideOutLudflowDocument(data); },
      'organization-settings': function(data) { return UI.slideOutOrganizationSettings(data); },
      'project-timeline': function(data) { return UI.slideOutTimeline(data, 'project'); },
      'decision-timeline': function(data) { return UI.slideOutTimeline(data, 'decision'); },
      issue: function(data) { return UI.slideOutIssue(data); },
      audit_event: function(data) { return UI.slideOutAuditEvent(data); },
      pull_request: function(data) { return UI.slideOutPR(data); },
      repo: function(data) { return UI.slideOutRepo(data); }
    },

    _renderDetail: function(type, data) {
      var renderer = UI.SlideOut._detailRenderers[type];
      if (renderer) return renderer(data);
      return UI.emptyState('Unknown entity type: ' + UI.escapeHtml(type));
    },

    // ─── Enrichment Infrastructure ──────────────────────────────────

    _enrichAndRender: function(type, id, data, contextKey) {
      var resolvedKey = UI.SlideOut._resolveContextKey(contextKey);
      UI.SlideOut._withContextKey(resolvedKey, function() {
        // Phase 1: already rendered with primary data
        data._enriched = {};

        // Phase 2: determine needed fetches
        var fetches = UI.SlideOut._getEnrichmentFetches(type, id, data);
        if (fetches.length === 0) {
          data._enrichmentDone = true;
          UI.SlideOut._render(resolvedKey);
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
          UI.SlideOut._withContextKey(resolvedKey, function() {
            // Stale guard
            var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
            if (!top || top.type !== type || top.id !== id) return;

            for (var i = 0; i < keys.length; i++) {
              if (results[i] != null) {
                if (keys[i] === 'documents') {
                  top.data.documents = UI.SlideOut._normalizeListPayload(results[i]);
                  top.data._enriched[keys[i]] = top.data.documents;
                  continue;
                }
                top.data._enriched[keys[i]] = results[i];
              }
            }
            top.data._enrichmentDone = true;
            UI.SlideOut._render(resolvedKey);
          });
        });
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
    _preserveTransientData: function(type, previousData, freshData) {
      if (type === 'project' && previousData && previousData._activeTab) {
        freshData._activeTab = previousData._activeTab;
      }
      return freshData;
    },

    _refetchAndRender: function() {
      var contextKey = UI.SlideOut._resolveContextKey();
      UI.SlideOut._withContextKey(contextKey, function() {
        var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
        if (!top) { UI.SlideOut._busy = false; return; }
        var API = window.__decidrAPI;
        if (!API) { UI.SlideOut._busy = false; return; }

        var type = top.type;
        var id = top.id;
        var previousData = top.data;

        API.getEntity(type, id).then(function(freshData) {
          UI.SlideOut._withContextKey(contextKey, function() {
            UI.SlideOut._busy = false;
            var current = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
            if (!current || current.type !== type || current.id !== id) return;
            current.data = UI.SlideOut._preserveTransientData(type, previousData, freshData);
            // Mark parent stack entries as stale so they re-fetch on Back navigation
            for (var i = 0; i < UI.SlideOut._stack.length - 1; i++) {
              UI.SlideOut._stack[i].stale = true;
            }
            UI.SlideOut._render(contextKey);
            UI.SlideOut._enrichAndRender(type, id, current.data, contextKey);
            if (UI.SlideOut._onMutateCallback) {
              try { UI.SlideOut._onMutateCallback(type, id); } catch(e) { console.error('[decidr] onMutate callback error:', e); }
            }
          });
        }).catch(function(err) {
          UI.SlideOut._withContextKey(contextKey, function() {
            UI.SlideOut._busy = false;
            console.error('[decidr] Refetch failed:', err);
          });
        });
      });
    },

    _getEnrichmentFetches: function(type, id, data) {
      var API = window.__decidrAPI;
      if (!API) return [];
      var fetches = [];
      var documentEntityTypes = {
        decision: 'DECISION',
        project: 'PROJECT',
        task: 'TASK',
        bridge: 'BRIDGE',
        initiative: 'INITIATIVE'
      };

      if (documentEntityTypes[type]) {
        fetches.push({
          key: 'documents',
          promise: API.listEntityDocuments(documentEntityTypes[type], id)
        });
      }

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
        fetches.push({ key: 'auditEvents', promise: API.listAuditEvents({ decisionId: id, take: 50 }) });
        fetches.push({ key: 'bridges', promise: API.listBridges({ decisionId: id }) });
        // GitHub summary
        fetches.push({ key: 'githubSummary', promise: API.getEntityGithubSummary('DECISION', id) });
      } else if (type === 'project') {
        fetches.push({ key: 'decisions', promise: API.listDecisions({ projectId: id }) });
        fetches.push({ key: 'auditEvents', promise: API.listAuditEvents({ projectId: id, take: 100 }) });
        fetches.push({ key: 'tasks', promise: API.listTasks({ projectId: id }) });
        fetches.push({ key: 'bridges', promise: API.listBridges({ projectId: id }) });
        fetches.push({ key: 'timeline', promise: API.getTimeline({ projectId: id, take: 20 }) });
        fetches.push({ key: 'githubSummary', promise: API.getEntityGithubSummary('PROJECT', id) });
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
        fetches.push({ key: 'githubSummary', promise: API.getEntityGithubSummary('TASK', id) });
      } else if (type === 'issue') {
        fetches.push({ key: 'linkedPRs', promise: API.listPRs({ issueRefId: id }) });
      } else if (type === 'audit_event') {
        if (data.projectId) {
          fetches.push({ key: 'project', promise: API.getProject(data.projectId) });
        }
      } else if (type === 'bridge') {
        fetches.push({ key: 'timeline', promise: API.getTimeline({ bridgeId: id, take: 20 }) });
      } else if (type === 'initiative') {
        fetches.push({ key: 'projects', promise: API.listProjects({ initiativeId: id }) });
        fetches.push({ key: 'decisions', promise: API.listDecisions({ initiativeId: id }) });
      } else if (type === 'organization-settings') {
        fetches.push({ key: 'githubStatus', promise: API.getLudflowGitHubStatus() });
        fetches.push({ key: 'githubRepositories', promise: API.listLudflowGitHubRepositories({ page: 1, limit: 100 }) });
        fetches.push({ key: 'nodeBilling', promise: API.getOrganizationNodeBilling(id) });
      } else if (type === 'project-timeline') {
        fetches.push({ key: 'timeline', promise: API.getTimeline({ projectId: id, take: 100 }) });
      } else if (type === 'decision-timeline') {
        fetches.push({ key: 'timeline', promise: API.getTimeline({ decisionId: id, take: 100 }) });
      }

      return fetches;
    },

    _normalizeListPayload: function(payload) {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.data)) return payload.data;
      return [];
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
        + UI.copyRefButton(entityType, entity.id)
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

    _renderSectionHeader: function(title, count, actionsHtml) {
      var countHtml = (count != null) ? ' <span class="decidr-so-section-count">(' + count + ')</span>' : '';
      if (actionsHtml) {
        return '<div class="decidr-so-section-title-row">'
          + '<div class="decidr-so-section-title">' + UI.escapeHtml(title) + countHtml + '</div>'
          + actionsHtml
          + '</div>';
      }
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
        var rowType = o.showTypeBadge && item.entityType ? item.entityType : entityType;
        html += '<div class="decidr-so-list-item" data-entity-type="' + UI.escapeHtml((rowType || '').toLowerCase()) + '" '
          + 'data-entity-id="' + UI.escapeHtml(item.id) + '" style="cursor:pointer;">';
        if (o.showTypeBadge && item.entityType) {
          html += UI.entityTypeBadge(item.entityType);
        }
        html += '<span class="decidr-so-list-title">' + UI.escapeHtml(title) + '</span>'
          + UI.statusBadge(item.status)
          + (normalizeStatus(rowType || entityType) === 'decision' ? UI.decisionKindBadge(item) : '')
          + UI.copyRefButton(rowType || entityType, item.id)
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
      addTaskFormOpen: false,
      addDecisionFormOpen: false,
      docFormTab: 'search'
    },

    _auditEventPanelState: {
      editMode: false
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

    _organizationSettingsPanelState: {
      activeTab: 'members'
    },

    // ─── Detail Renderers (delegated to UI.slideOutX functions) ─────

    back: function(sourceOrKey) {
      var contextKey = UI.SlideOut._resolveContextKey(sourceOrKey);
      UI.SlideOut._withContextKey(contextKey, function() {
        UI.SlideOut._stack.pop();
        if (UI.SlideOut._stack.length === 0) {
          UI.SlideOut.close(contextKey);
        } else {
          var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
          if (top.stale) {
            top.stale = false;
            // Re-fetch entity data and enrichments
            var API = window.__decidrAPI;
            if (API && top.type && top.id) {
              var previousData = top.data;
              UI.SlideOut._render(contextKey); // Show current (stale) data immediately
              API.getEntity(top.type, top.id).then(function(freshData) {
                UI.SlideOut._withContextKey(contextKey, function() {
                  var current = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
                  if (!current || current.type !== top.type || current.id !== top.id) return;
                  current.data = UI.SlideOut._preserveTransientData(top.type, previousData, freshData);
                  UI.SlideOut._enrichAndRender(top.type, top.id, current.data, contextKey);
                });
              }).catch(function(err) {
                console.error('[decidr] Stale refetch failed:', err);
              });
            } else {
              UI.SlideOut._render(contextKey);
            }
          } else {
            UI.SlideOut._render(contextKey);
          }
        }
      });
    },

    close: function(sourceOrKey) {
      var contextKey = UI.SlideOut._resolveContextKey(sourceOrKey);
      UI.SlideOut._withContextKey(contextKey, function() {
        UI.SlideOut._stack = [];
        var els = UI.SlideOut._ensureDOM(contextKey);
        if (!els) return;
        els.overlay.classList.remove('decidr-so-open');
        els.panel.classList.remove('decidr-so-open');
        if (UI.SlideOut._lastRenderedContextKey === contextKey) {
          UI.SlideOut._lastRenderedContextKey = null;
        }
        var callback = UI.SlideOut._onCloseCallback;
        UI.SlideOut._onCloseCallback = null;
        UI.SlideOut._onMutateCallback = null;
        setTimeout(function() {
          els.overlay.style.display = 'none';
          els.panel.style.display = 'none';
          if (callback) callback();
        }, 300);
      });
    },

    _ensureDOM: function(contextKey) {
      var resolvedKey = UI.SlideOut._resolveContextKey(contextKey);
      return UI.SlideOut._withContextKey(resolvedKey, function() {
        var context = UI.SlideOut._getContext(resolvedKey);
        var host = context.host;
        if (!host) {
          host = UI.SlideOut._resolveHost();
          context.host = host;
        }
        if (host !== document.body && !host.isConnected) {
          return null;
        }

        var overlay = context.overlay;
        if (!overlay || !overlay.isConnected) {
          var overlays = host.querySelectorAll('.decidr-so-overlay');
          for (var oi = 0; oi < overlays.length; oi++) {
            if (overlays[oi].getAttribute('data-decidr-so-context') === resolvedKey) {
              overlay = overlays[oi];
              break;
            }
          }
        }

        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'decidr-so-overlay';
          overlay.setAttribute('data-decidr-so-context', resolvedKey);
          overlay.addEventListener('click', function() {
            UI.SlideOut.close(resolvedKey);
          });
          host.appendChild(overlay);
        }
        context.overlay = overlay;

        var panel = context.panel;
        if (!panel || !panel.isConnected) {
          var panels = host.querySelectorAll('.decidr-so-panel');
          for (var pi = 0; pi < panels.length; pi++) {
            if (panels[pi].getAttribute('data-decidr-so-context') === resolvedKey) {
              panel = panels[pi];
              break;
            }
          }
        }

        if (!panel) {
          panel = document.createElement('div');
          panel.className = 'decidr-so-panel';
          panel.setAttribute('data-decidr-so-context', resolvedKey);
          panel.addEventListener('mousedown', function() {
            UI.SlideOut._lastRenderedContextKey = resolvedKey;
          });
          panel.addEventListener('focusin', function() {
            UI.SlideOut._lastRenderedContextKey = resolvedKey;
          });

          var header = document.createElement('div');
          header.className = 'decidr-so-header';

          var content = document.createElement('div');
          content.className = 'decidr-so-content';

          panel.appendChild(header);
          panel.appendChild(content);
          host.appendChild(panel);
        }
        context.panel = panel;

        if (!context.escapeHandlerBound) {
          document.addEventListener('keydown', function(e) {
            if (e.key !== 'Escape') return;
            var activeHost = UI.SlideOut._resolveHost();
            if (activeHost !== host) return;
            var activeContext = UI.SlideOut._getContext(resolvedKey, host);
            if (UI.SlideOut._lastRenderedContextKey && UI.SlideOut._lastRenderedContextKey !== resolvedKey) return;
            if (activeContext.stack.length > 0) {
              UI.SlideOut.close(resolvedKey);
            }
          });
          context.escapeHandlerBound = true;
        }

        return {
          overlay: overlay,
          panel: panel,
          header: panel.querySelector('.decidr-so-header'),
          content: panel.querySelector('.decidr-so-content')
        };
      });
    },

    _wirePanel: function(panel) {
      var API = window.__decidrAPI;
      var panelContextKey = UI.SlideOut._resolveContextKey(panel);

      // Back / close button
      var backBtn = panel.querySelector('#decidr-so-btn-back');
      if (backBtn) {
        backBtn.onclick = function() {
          UI.SlideOut._withContextKey(panelContextKey, function() {
            if (UI.SlideOut._stack.length > 1) {
              UI.SlideOut.back(panelContextKey);
            } else {
              UI.SlideOut.close(panelContextKey);
            }
          });
        };
      }

      UI.wireCopyRefButtons(panel);

      // Wire all entity navigation links
      var navItems = panel.querySelectorAll('[data-entity-type][data-entity-id]');
      for (var i = 0; i < navItems.length; i++) {
        (function(el) {
          el.onclick = function(e) {
            if (e.target.closest && e.target.closest('[data-decidr-copy-ref]')) return;
            // Don't navigate if clicking a task checkbox
            if (e.target.hasAttribute('data-task-toggle')) return;
            e.preventDefault();
            e.stopPropagation();
            var entityType = el.getAttribute('data-entity-type');
            var entityId = el.getAttribute('data-entity-id');
            if (entityType && entityId) {
              UI.SlideOut.open(entityType, entityId, { source: panel });
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

      // --- Audit event events ---
      if (top.type === 'audit_event') {
        UI.SlideOut._wireAuditEventEvents(panel, top.id, top.data);
      }

      // --- Bridge events ---
      if (top.type === 'bridge') {
        UI.SlideOut._wireBridgeEvents(panel, top.id, top.data);
      }

      // --- Initiative events ---
      if (top.type === 'initiative') {
        UI.SlideOut._wireInitiativeEvents(panel, top.id, top.data);
      }

      // --- LudFlow document preview events ---
      if (top.type === 'ludflow_document') {
        UI.SlideOut._wireLudflowDocumentEvents(panel, top.id, top.data);
      }

      // --- Organization settings events ---
      if (top.type === 'organization-settings') {
        UI.SlideOut._wireOrganizationSettingsEvents(panel, top.id, top.data);
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

    _wireArchiveEvent: function(panel, btnSelector, entityType, id, archiveFn) {
      var btn = panel.querySelector(btnSelector);
      if (btn) {
        btn.onclick = function() {
          if (!confirm('Archive this ' + entityType + '?')) return;
          var API = window.__decidrAPI;
          if (API) {
            if (UI.SlideOut._guardBusy()) return;
            archiveFn(id).then(function() {
              UI.SlideOut._busy = false;
              if (UI.SlideOut._onMutateCallback) {
                try { UI.SlideOut._onMutateCallback(entityType, id); } catch(e) { console.error('[decidr] onMutate callback error:', e); }
              }
              UI.SlideOut.back(panel);
            }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Archive failed:', err); });
          }
        };
      }
    },

    _wireBridgeToggles: function(panel) {
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
    },

    _wireLudflowDocumentEvents: function(panel, id, data) {
      var contextKey = UI.SlideOut._resolveContextKey(panel);
      var versionButtons = panel.querySelectorAll('[data-ludflow-version-id]');
      for (var i = 0; i < versionButtons.length; i++) {
        (function(btn) {
          btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            var versionId = btn.getAttribute('data-ludflow-version-id') || '__current';
            UI.SlideOut._withContextKey(contextKey, function() {
              var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
              if (!top || top.type !== 'ludflow_document' || top.id !== id || !top.data) return;
              top.data._selectedVersionId = versionId;
              UI.SlideOut._render(contextKey);
            });
          };
        })(versionButtons[i]);
      }
      UI.SlideOut._loadLudflowDocumentVersions(panel, id, data);
    },

    _shouldLoadLudflowDocumentVersions: function(data) {
      if (!data || data._versionFetchState === 'loading' || data._versionFetchState === 'loaded') return false;
      var versions = Array.isArray(data.versions) ? data.versions : [];
      if (versions.length === 0) return true;
      for (var i = 0; i < versions.length; i++) {
        if (!ludflowVersionHasContent(versions[i])) return true;
      }
      return false;
    },

    _loadLudflowDocumentVersions: function(panel, id, data) {
      if (!UI.SlideOut._shouldLoadLudflowDocumentVersions(data)) return;
      if (typeof UI.fetchLudflowDocumentVersions !== 'function') return;

      var contextKey = UI.SlideOut._resolveContextKey(panel);
      data._versionFetchState = 'loading';
      setTimeout(function() {
        UI.SlideOut._withContextKey(contextKey, function() {
          var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
          if (!top || top.type !== 'ludflow_document' || top.id !== id || !top.data) return;
          if (top.data._versionFetchState === 'loading') UI.SlideOut._render(contextKey);
        });
      }, 0);
      UI.fetchLudflowDocumentVersions(id, data).then(function(versions) {
        UI.SlideOut._withContextKey(contextKey, function() {
          var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
          if (!top || top.type !== 'ludflow_document' || top.id !== id || !top.data) return;
          top.data._versionFetchState = 'loaded';
          top.data._versionFetchError = '';
          if (Array.isArray(versions) && versions.length > 0) {
            top.data.versions = versions;
            if (!top.data._selectedVersionId || top.data._selectedVersionId === '__current') {
              top.data._selectedVersionId = versions[0].id || '__current';
            }
          }
          UI.SlideOut._render(contextKey);
        });
      }).catch(function(err) {
        console.warn('[decidr] Failed to load Ludflow document versions:', err);
        UI.SlideOut._withContextKey(contextKey, function() {
          var top = UI.SlideOut._stack[UI.SlideOut._stack.length - 1];
          if (!top || top.type !== 'ludflow_document' || top.id !== id || !top.data) return;
          top.data._versionFetchState = 'error';
          top.data._versionFetchError = err && err.message ? err.message : 'Failed to load version history';
          UI.SlideOut._render(contextKey);
        });
      });
    },

    _wireDecisionEvents: function(panel, id, data) {
      var state = UI.SlideOut._decisionPanelState;
      var API = window.__decidrAPI;

      UI.SlideOut._wireBridgeToggles(panel);

      // View All Activity
      var viewAllDecBtn = panel.querySelector('#decidr-so-btn-view-all-decision-timeline');
      if (viewAllDecBtn) {
        viewAllDecBtn.onclick = function() {
          UI.SlideOut.open('decision-timeline', id, { source: panel });
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

      function responsibilityMemberId(member) {
        if (!member) return '';
        if (member.userId) return member.userId;
        if (member.user && member.user.id) return member.user.id;
        return member.id || '';
      }

      function responsibilityMemberName(member) {
        if (!member) return 'Unknown';
        if (member.name) return member.name;
        if (member.user && member.user.name) return member.user.name;
        if (member.email) return member.email;
        if (member.user && member.user.email) return member.user.email;
        return responsibilityMemberId(member) || 'Unknown';
      }

      function isAssignableResponsibilityMember(member) {
        var memberId = responsibilityMemberId(member);
        if (!memberId) return false;
        if (member.isActive === false || member.active === false) return false;
        var status = String(member.status || member.membershipStatus || member.inviteStatus || member.invitationStatus || 'ACTIVE').toUpperCase();
        if (status.indexOf('PENDING') !== -1 || status.indexOf('INVITE') !== -1) return false;
        return true;
      }

      function fillResponsibilitySelect(select, members, currentId, emptyLabel) {
        if (!select) return;
        var html = '<option value="">' + UI.escapeHtml(emptyLabel) + '</option>';
        for (var m = 0; m < members.length; m++) {
          var member = members[m];
          var memberId = responsibilityMemberId(member);
          if (!memberId) continue;
          html += '<option value="' + UI.escapeHtml(memberId) + '"' + (memberId === currentId ? ' selected' : '') + '>'
            + UI.escapeHtml(responsibilityMemberName(member)) + '</option>';
        }
        select.innerHTML = html;
        select.disabled = false;
      }

      function wireDecisionResponsibilities() {
        var ownerSelect = panel.querySelector('#decidr-so-owner-select');
        var implementerSelect = panel.querySelector('#decidr-so-implementer-select');
        var saveBtn = panel.querySelector('#decidr-so-btn-save-responsibilities');
        if (!ownerSelect || !implementerSelect || !saveBtn || !API || !API.listMembers) return;

        var currentOwnerId = ownerSelect.getAttribute('data-current-value') || '';
        var currentImplementerId = implementerSelect.getAttribute('data-current-value') || '';

        API.listMembers().then(function(result) {
          var members = (result && result.data) || result || [];
          if (!Array.isArray(members)) members = [];
          var assignable = [];
          for (var mi = 0; mi < members.length; mi++) {
            if (isAssignableResponsibilityMember(members[mi])) assignable.push(members[mi]);
          }
          fillResponsibilitySelect(ownerSelect, assignable, currentOwnerId, 'No owner assigned');
          fillResponsibilitySelect(implementerSelect, assignable, currentImplementerId, 'No implementer assigned');
          saveBtn.disabled = false;
        }).catch(function(err) {
          ownerSelect.innerHTML = '<option value="">Failed to load members</option>';
          implementerSelect.innerHTML = '<option value="">Failed to load members</option>';
          console.error('[decidr] List members failed:', err);
        });

        saveBtn.onclick = function() {
          if (!API || !API.updateDecision) return;
          if (UI.SlideOut._guardBusy()) return;
          API.updateDecision(id, {
            ownerId: ownerSelect.value || null,
            implementerId: implementerSelect.value || null
          }).then(function() {
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) {
            UI.SlideOut._busy = false;
            console.error('[decidr] Update decision responsibilities failed:', err);
          });
        };
      }

      wireDecisionResponsibilities();

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

      // Archive
      UI.SlideOut._wireArchiveEvent(panel, '#decidr-so-btn-archive', 'decision', id, API.archiveDecision);

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
              UI.SlideOut.open('decision', result.id, { source: panel });
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

    _wireAuditEventEvents: function(panel, id, data) {
      var state = UI.SlideOut._auditEventPanelState;
      var API = window.__decidrAPI;

      var editBtn = panel.querySelector('#decidr-so-btn-audit-edit');
      if (editBtn) {
        editBtn.onclick = function() {
          state.editMode = !state.editMode;
          UI.SlideOut._render();
        };
      }

      var cancelBtn = panel.querySelector('#decidr-so-btn-cancel-audit-edit');
      if (cancelBtn) {
        cancelBtn.onclick = function() {
          state.editMode = false;
          UI.SlideOut._render();
        };
      }

      var saveBtn = panel.querySelector('#decidr-so-btn-save-audit-edit');
      if (saveBtn) {
        saveBtn.onclick = function() {
          if (!API) return;
          var titleInput = panel.querySelector('#decidr-so-audit-title');
          var summaryInput = panel.querySelector('#decidr-so-audit-summary');
          var statusInput = panel.querySelector('#decidr-so-audit-status');
          var categoryInput = panel.querySelector('#decidr-so-audit-category');
          var linksInput = panel.querySelector('#decidr-so-audit-links');
          var payloadInput = panel.querySelector('#decidr-so-audit-payload');
          var sourceInput = panel.querySelector('#decidr-so-audit-source-context');
          var reasonInput = panel.querySelector('#decidr-so-audit-edit-reason');

          var payload = {};
          var sourceContext = {};
          try {
            payload = payloadInput && payloadInput.value.trim() ? JSON.parse(payloadInput.value) : {};
            sourceContext = sourceInput && sourceInput.value.trim() ? JSON.parse(sourceInput.value) : {};
          } catch (err) {
            alert('Payload and source context must be valid JSON.');
            return;
          }

          var links = [];
          if (linksInput && linksInput.value.trim()) {
            var rawLinks = linksInput.value.split(/\n+/);
            for (var li = 0; li < rawLinks.length; li++) {
              var link = rawLinks[li].trim();
              if (link) links.push(link);
            }
          }

          var category = categoryInput ? categoryInput.value.trim() : '';
          var updates = {
            title: titleInput ? titleInput.value.trim() : data.title,
            summary: summaryInput ? summaryInput.value.trim() : data.summary,
            status: statusInput ? statusInput.value : data.status,
            links: links,
            payload: payload,
            sourceContext: sourceContext,
            editReason: reasonInput ? reasonInput.value.trim() : undefined
          };
          if (category) updates.category = category;

          if (!updates.title) return;
          if (UI.SlideOut._guardBusy()) return;
          API.updateAuditEvent(id, updates).then(function() {
            state.editMode = false;
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) {
            UI.SlideOut._busy = false;
            console.error('[decidr] Update audit event failed:', err);
          });
        };
      }

      UI.SlideOut._wireArchiveEvent(panel, '#decidr-so-btn-audit-archive', 'audit event', id, API.archiveAuditEvent);
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

      // Archive
      UI.SlideOut._wireArchiveEvent(panel, '#decidr-so-btn-task-archive', 'task', id, API.archiveTask);

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'TASK', id, state);
    },

    _wireProjectEvents: function(panel, id, data) {
      var state = UI.SlideOut._projectPanelState;
      var API = window.__decidrAPI;

      var tabButtons = panel.querySelectorAll('[data-project-tab]');
      for (var pt = 0; pt < tabButtons.length; pt++) {
        (function(btn) {
          btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            data._activeTab = btn.getAttribute('data-project-tab') === 'audit-events'
              ? 'audit-events' : 'decisions';
            UI.SlideOut._render();
          };
        })(tabButtons[pt]);
      }

      // View All Activity
      var viewAllBtn = panel.querySelector('#decidr-so-btn-view-all-project-timeline');
      if (viewAllBtn) {
        viewAllBtn.onclick = function() {
          UI.SlideOut.open('project-timeline', id, { source: panel });
        };
      }

      UI.SlideOut._wireBridgeToggles(panel);

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

      // Add Task form (project)
      var addTaskBtn = panel.querySelector('#decidr-so-btn-add-project-task');
      if (addTaskBtn) {
        addTaskBtn.onclick = function() {
          state.addTaskFormOpen = true;
          var form = panel.querySelector('#decidr-so-form-add-project-task');
          if (form) form.classList.add('visible');
        };
      }
      var cancelTaskBtn = panel.querySelector('#decidr-so-btn-cancel-project-task');
      if (cancelTaskBtn) {
        cancelTaskBtn.onclick = function() {
          state.addTaskFormOpen = false;
          var form = panel.querySelector('#decidr-so-form-add-project-task');
          if (form) form.classList.remove('visible');
        };
      }
      var saveTaskBtn = panel.querySelector('#decidr-so-btn-save-project-task');
      if (saveTaskBtn) {
        saveTaskBtn.onclick = function() {
          var titleInput = panel.querySelector('#decidr-so-input-project-task-title');
          var title = titleInput ? titleInput.value.trim() : '';
          if (!title || !API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.createTask({
            title: title,
            projectId: id
          }).then(function() {
            state.addTaskFormOpen = false;
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Create task failed:', err); });
        };
      }

      // Add Decision form (project)
      var addDecisionBtn = panel.querySelector('#decidr-so-btn-add-project-decision');
      if (addDecisionBtn) {
        addDecisionBtn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          state.addDecisionFormOpen = true;
          UI.SlideOut._render();
        };
      }
      var cancelDecisionBtn = panel.querySelector('#decidr-so-btn-cancel-project-decision');
      if (cancelDecisionBtn) {
        cancelDecisionBtn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          state.addDecisionFormOpen = false;
          UI.SlideOut._render();
        };
      }
      var saveDecisionBtn = panel.querySelector('#decidr-so-btn-save-project-decision');
      if (saveDecisionBtn) {
        saveDecisionBtn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          var titleInput = panel.querySelector('#decidr-so-input-project-decision-title');
          var descriptionInput = panel.querySelector('#decidr-so-input-project-decision-description');
          var statusInput = panel.querySelector('#decidr-so-input-project-decision-status');
          var title = titleInput ? titleInput.value.trim() : '';
          if (!title || !API) return;
          if (UI.SlideOut._guardBusy()) return;
          API.createDecision({
            title: title,
            description: descriptionInput ? descriptionInput.value.trim() : '',
            entityType: 'PROJECT',
            projectId: id,
            status: statusInput ? statusInput.value : 'DRAFT'
          }).then(function(result) {
            UI.SlideOut._busy = false;
            state.addDecisionFormOpen = false;
            var createdId = result && (result.id || (result.data && result.data.id));
            var stack = UI.SlideOut._stack || [];
            var top = stack.length ? stack[stack.length - 1] : null;
            if (top && top.type === 'project' && top.id === id) top.stale = true;
            if (UI.SlideOut._onMutateCallback) {
              try { UI.SlideOut._onMutateCallback('decision', createdId || id); } catch(err) { console.error('[decidr] onMutate callback error:', err); }
            }
            if (createdId) {
              UI.SlideOut.open('decision', createdId, { source: panel });
            } else {
              UI.SlideOut._refetchAndRender();
            }
          }).catch(function(err) { UI.SlideOut._busy = false; console.error('[decidr] Create decision failed:', err); });
        };
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

      // Archive
      UI.SlideOut._wireArchiveEvent(panel, '#decidr-so-btn-project-archive', 'project', id, API.archiveProject);

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

      // Archive
      UI.SlideOut._wireArchiveEvent(panel, '#decidr-so-btn-bridge-archive', 'bridge', id, API.archiveBridge);

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'BRIDGE', id, state);
    },

    _wireInitiativeEvents: function(panel, id, data) {
      var state = UI.SlideOut._initiativePanelState;
      var API = window.__decidrAPI;

      // Archive
      UI.SlideOut._wireArchiveEvent(panel, '#decidr-so-btn-initiative-archive', 'initiative', id, API.archiveInitiative);

      // Document linking (shared helper)
      UI.SlideOut._wireDocumentEvents(panel, 'INITIATIVE', id, state);
    },

    _wireOrganizationSettingsEvents: function(panel, id, data) {
      var state = UI.SlideOut._organizationSettingsPanelState;
      var API = window.__decidrAPI;
      if (!API) return;

      var tabButtons = panel.querySelectorAll('[data-org-settings-tab]');
      for (var tb = 0; tb < tabButtons.length; tb++) {
        (function(btn) {
          btn.onclick = function(e) {
            e.preventDefault();
            state.activeTab = btn.getAttribute('data-org-settings-tab') || 'members';
            UI.SlideOut._render();
          };
        })(tabButtons[tb]);
      }

      var billingBtn = panel.querySelector('#decidr-so-btn-billing');
      if (billingBtn) {
        billingBtn.onclick = function() {
          if (billingBtn.disabled) return;
          if (UI.SlideOut._guardBusy()) return;
          billingBtn.textContent = 'Opening...';
          API.openOrganizationBilling(id, billingBtn.getAttribute('data-billing-status')).then(function(result) {
            UI.SlideOut._busy = false;
            var billingUrl = result && (result.portalUrl || result.url);
            if (billingUrl) {
              if (openExternalUrlInMcpviewsTab(billingUrl, { title: 'Stripe Billing' })) {
                UI.SlideOut._render();
              } else if (window.location && typeof window.location.assign === 'function') {
                window.location.assign(billingUrl);
              } else {
                window.location.href = billingUrl;
              }
              return;
            }
            UI.SlideOut._render();
          }).catch(function(err) {
            UI.SlideOut._busy = false;
            console.error('[decidr] Open billing failed:', err);
            alert('Failed to open billing. Please try again.');
            UI.SlideOut._render();
          });
        };
      }

      var connectGitHubBtn = panel.querySelector('#decidr-so-btn-connect-ludflow-github');
      if (connectGitHubBtn) {
        connectGitHubBtn.onclick = function() {
          if (UI.SlideOut._guardBusy()) return;
          API.connectLudflowGitHub().then(function(result) {
            UI.SlideOut._busy = false;
            if (result && result.installUrl) {
              window.open(result.installUrl, '_blank');
            }
          }).catch(function(err) {
            UI.SlideOut._busy = false;
            console.error('[decidr] Connect Ludflow GitHub failed:', err);
          });
        };
      }

      var metadataToggleButtons = panel.querySelectorAll('[data-ludflow-github-toggle-id]');
      for (var mt = 0; mt < metadataToggleButtons.length; mt++) {
        (function(btn) {
          btn.onclick = function() {
            var repoId = btn.getAttribute('data-ludflow-github-toggle-id');
            if (!repoId) return;
            var currentlyEnabled = btn.getAttribute('data-ludflow-github-toggle-enabled') === '1';
            if (UI.SlideOut._guardBusy()) return;
            API.updateLudflowGitHubRepository(repoId, {
              metadataSyncEnabled: !currentlyEnabled
            }).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) {
              UI.SlideOut._busy = false;
              console.error('[decidr] Update Ludflow GitHub repository failed:', err);
            });
          };
        })(metadataToggleButtons[mt]);
      }

      var metadataRefreshButtons = panel.querySelectorAll('[data-ludflow-github-refresh-id]');
      for (var mr = 0; mr < metadataRefreshButtons.length; mr++) {
        (function(btn) {
          btn.onclick = function() {
            var repoId = btn.getAttribute('data-ludflow-github-refresh-id');
            if (!repoId) return;
            if (UI.SlideOut._guardBusy()) return;
            API.refreshLudflowGitHubRepository(repoId).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) {
              UI.SlideOut._busy = false;
              console.error('[decidr] Refresh Ludflow GitHub repository failed:', err);
            });
          };
        })(metadataRefreshButtons[mr]);
      }

      var inviteBtn = panel.querySelector('#decidr-so-btn-send-org-invite');
      if (inviteBtn) {
        inviteBtn.onclick = function() {
          var emailInput = panel.querySelector('#decidr-so-input-org-invite-email');
          var roleInput = panel.querySelector('#decidr-so-input-org-invite-role');
          var email = emailInput ? emailInput.value.trim() : '';
          var role = roleInput ? roleInput.value : 'MEMBER';
          if (!email) return;
          if (UI.SlideOut._guardBusy()) return;
          API.inviteOrgMember(id, {
            email: email,
            role: role,
            targetProduct: 'DECIDR'
          }).then(function() {
            if (emailInput) emailInput.value = '';
            if (roleInput) roleInput.value = 'MEMBER';
            UI.SlideOut._refetchAndRender();
          }).catch(function(err) {
            UI.SlideOut._busy = false;
            console.error('[decidr] Invite member failed:', err);
          });
        };
      }

      var resendButtons = panel.querySelectorAll('[data-resend-invitation-id]');
      for (var ri = 0; ri < resendButtons.length; ri++) {
        (function(btn) {
          btn.onclick = function() {
            if (btn.disabled) return;
            var invitationId = btn.getAttribute('data-resend-invitation-id');
            if (!invitationId) return;
            if (UI.SlideOut._guardBusy()) return;
            API.resendOrgInvitation(id, invitationId).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) {
              UI.SlideOut._busy = false;
              console.error('[decidr] Resend invitation failed:', err);
            });
          };
        })(resendButtons[ri]);
      }

      var roleSelects = panel.querySelectorAll('[data-member-role-user-id]');
      for (var i = 0; i < roleSelects.length; i++) {
        (function(select) {
          select.onchange = function() {
            if (select.disabled) return;
            var userId = select.getAttribute('data-member-role-user-id');
            var currentRole = select.getAttribute('data-current-role') || '';
            var nextRole = select.value;
            if (!userId || !nextRole || nextRole === currentRole) return;
            if (UI.SlideOut._guardBusy()) {
              select.value = currentRole;
              return;
            }
            API.updateOrgMemberRole(id, userId, nextRole).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) {
              UI.SlideOut._busy = false;
              select.value = currentRole;
              console.error('[decidr] Update member role failed:', err);
            });
          };
        })(roleSelects[i]);
      }

      var removeButtons = panel.querySelectorAll('[data-remove-member-user-id]');
      for (var r = 0; r < removeButtons.length; r++) {
        (function(btn) {
          btn.onclick = function() {
            if (btn.disabled) return;
            var userId = btn.getAttribute('data-remove-member-user-id');
            if (!userId) return;
            if (!confirm('Remove this member from the organization?')) return;
            if (UI.SlideOut._guardBusy()) return;
            API.removeOrgMember(id, userId).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) {
              UI.SlideOut._busy = false;
              console.error('[decidr] Remove member failed:', err);
            });
          };
        })(removeButtons[r]);
      }

      var cancelButtons = panel.querySelectorAll('[data-cancel-invitation-id]');
      for (var c = 0; c < cancelButtons.length; c++) {
        (function(btn) {
          btn.onclick = function() {
            if (btn.disabled) return;
            var invitationId = btn.getAttribute('data-cancel-invitation-id');
            if (!invitationId) return;
            if (!confirm('Cancel this pending invitation?')) return;
            if (UI.SlideOut._guardBusy()) return;
            API.cancelOrgInvitation(id, invitationId).then(function() {
              UI.SlideOut._refetchAndRender();
            }).catch(function(err) {
              UI.SlideOut._busy = false;
              console.error('[decidr] Cancel invitation failed:', err);
            });
          };
        })(cancelButtons[c]);
      }
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
            html += '<button type="button" class="decidr-so-doc-link decidr-so-doc-ludflow" data-entity-type="ludflow_document" data-entity-id="' + UI.escapeHtml(doc.ludflowDocumentId || doc.id) + '">'
              + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> '
              + UI.escapeHtml(doc.title || 'LudFlow Document')
              + '</button>';
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

  Object.defineProperties(UI.SlideOut, {
    _stack: {
      get: function() { return UI.SlideOut._getContext().stack; },
      set: function(value) { UI.SlideOut._getContext().stack = value; }
    },
    _overlay: {
      get: function() { return UI.SlideOut._getContext().overlay; },
      set: function(value) { UI.SlideOut._getContext().overlay = value; }
    },
    _onCloseCallback: {
      get: function() { return UI.SlideOut._getContext().onCloseCallback; },
      set: function(value) { UI.SlideOut._getContext().onCloseCallback = value; }
    },
    _onMutateCallback: {
      get: function() { return UI.SlideOut._getContext().onMutateCallback; },
      set: function(value) { UI.SlideOut._getContext().onMutateCallback = value; }
    },
    _busy: {
      get: function() { return UI.SlideOut._getContext().busy; },
      set: function(value) { UI.SlideOut._getContext().busy = value; }
    }
  });

  // ─── Expose private vars for 03-slideouts.js ──────────────────────
  UI._ENTITY_ICONS = ENTITY_ICONS;
  UI._ICON_TRASH = ICON_TRASH;
  UI._ICON_EDIT = ICON_EDIT;
  UI._ICON_CHEVRON_DOWN = ICON_CHEVRON_DOWN;
  UI._ICON_CALENDAR = ICON_CALENDAR;
  UI._STATUS_LABELS = STATUS_LABELS;
  UI._statusLabel = statusLabel;

  UI.orgPicker = function(orgs, activeOrgId, opts) {
    opts = opts || {};
    if (!orgs || orgs.length === 0) return '';

    var defaultOrgId = opts.defaultOrgId || null;

    var activeOrg = null;
    for (var i = 0; i < orgs.length; i++) {
      if (orgs[i].id === activeOrgId) {
        activeOrg = orgs[i];
        break;
      }
    }

    var rawLabel = activeOrg ? (activeOrg.name || activeOrg.id) : 'Select Organization';
    var truncatedLabel = rawLabel.length > 28 ? rawLabel.substring(0, 25) + '...' : rawLabel;

    var html = '<div class="decidr-org-picker">'
      + '<button class="decidr-org-picker-btn" id="decidr-org-picker-toggle" aria-haspopup="listbox" aria-label="Switch organization">'
      + ICON_BUILDING
      + '<span class="decidr-org-picker-label">' + UI.escapeHtml(truncatedLabel) + '</span>'
      + ICON_CHEVRON_SMALL
      + '</button>'
      + '<div class="decidr-org-picker-menu" id="decidr-org-picker-menu" role="listbox">'
      + '<div class="decidr-org-picker-menu-header">Organizations</div>';

    for (var j = 0; j < orgs.length; j++) {
      var org = orgs[j];
      var isActive = org.id === activeOrgId;
      var isDefault = org.id === defaultOrgId;
      var canManageOrg = org.role && String(org.role).toUpperCase() !== 'MEMBER';
      var tokenStatus = org.tokenStatus || 'no-token';
      var needsConnect = tokenStatus === 'no-token'
        || tokenStatus === 'missing'
        || tokenStatus === 'expired_unrefreshable';
      var safeName = UI.escapeHtml(org.name || org.id);
      var safeId = UI.escapeHtml(org.id);
      var rowClasses = 'decidr-org-picker-option-row'
        + (isActive ? ' is-active' : '')
        + (needsConnect ? ' is-untrusted' : '');
      var starTitle = isDefault ? 'Current default organization' : 'Set as default';
      var safeStarTitle = UI.escapeHtml(starTitle);

      html += '<div class="' + rowClasses + '" role="option" aria-selected="' + (isActive ? 'true' : 'false') + '">'
        + (canManageOrg
            ? '<button class="decidr-org-picker-settings" data-org-id="' + safeId + '" data-action="open-settings" aria-label="Open organization settings" title="Organization settings">'
              + ICON_SETTINGS
              + '</button>'
            : '<span class="decidr-org-picker-settings-spacer" aria-hidden="true"></span>')
        + '<button class="decidr-org-picker-option" data-org-id="' + safeId + '" title="' + safeName + '">'
        + '<span class="decidr-org-picker-check-slot">' + (isActive ? ICON_CHECK_BOLD : '') + '</span>'
        + '<span class="decidr-org-picker-name">' + safeName + '</span>'
        + (needsConnect
            ? '<span class="decidr-org-picker-badge">Connect</span>'
            : (tokenStatus === 'expired_refreshable'
              ? '<span class="decidr-org-picker-badge">Refreshable</span>'
            : (isDefault ? '<span class="decidr-org-picker-badge is-default-badge">Default</span>' : ''))
          )
        + '</button>'
        + '<button class="decidr-org-picker-star' + (isDefault ? ' is-default' : '') + '"'
        + ' data-org-id="' + safeId + '" data-action="set-default"'
        + ' aria-label="' + safeStarTitle + '" title="' + safeStarTitle + '">'
        + (isDefault ? ICON_STAR_FILLED : ICON_STAR_OUTLINE)
        + '</button>'
        + '</div>';
    }

    html += '</div></div>';
    return html;
  };

})();

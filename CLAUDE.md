# DecidR Plugin — MCPViews Plugin for DecidR

## What is this?

MCPViews plugin that renders DecidR MCP tool output in the Ludflow Companion. Three renderers (list, dashboard, graph) connected to the DecidR backend via REST API.

## File Structure

```
manifest.json          → Tool-to-renderer mappings + MCP config
build.sh               → Produces decidr-plugin.zip
renderers/
  list.js              → Universal list/detail renderer
  dashboard.js         → Initiative dashboard renderer
  graph.js             → Force-directed graph renderer
  shared/
    00-api-client.js   → REST fetch wrapper + autoInit bootstrap
    01-theme.js        → CSS token injection
    02-components.js   → Shared component library (list/card/meta/SlideOut core)
    03-slideouts.js    → Entity slideout renderers (project/decision/task/issue/PR/repo/etc.)
```

## Key Commands

```bash
bash build.sh                              # Build decidr-plugin.zip
node -c renderers/list.js                  # Syntax check a renderer
node -c renderers/shared/02-components.js  # Syntax check shared code
node -c renderers/shared/03-slideouts.js   # Syntax check slideout renderers
```

## JavaScript Conventions

- Every file wrapped in `(function() { 'use strict'; ... })();` — no exceptions.
- `var` and `function` only. No `const`, `let`, or arrow functions.
- No `import`/`export` — everything registers on `window` globals.
- Three globals: `window.__renderers` (renderers), `window.__decidrUI` (components), `window.__decidrAPI` (API client).

## Renderer Registration

- Signature: `window.__renderers.<name> = function(container, data, meta, toolArgs, reviewRequired, onDecision) { ... }`
- Renderer names must match `manifest.json` `renderer_definitions[].name`.
- First line of every renderer: `container.innerHTML = '';`

## CSS & Styling

- All CSS classes prefixed with `decidr-` to avoid companion conflicts.
- Design tokens injected by `theme.js` — use `var(--token-name)` in inline styles.
- No external CSS files. All styles live in `theme.js` or are inlined.
- Support dark and light mode via `prefers-color-scheme` media query.

## Component Rules (SOLID)

- **SRP**: `__decidrUI.*` functions return HTML strings only. No DOM queries, no event binding.
- **Exception**: SlideOut system may call `window.__decidrAPI` for fetching related entity data.
- **OCP**: Extend components via `opts` parameter. Never fork or copy a shared component into a renderer.
- **DIP**: Renderers depend on `__decidrUI` and `__decidrAPI`. Components never depend on renderers.
- **Navigation**: All clickable entities use `data-entity-type` and `data-entity-id` attributes.

## Manifest Rules

- Every MCP tool must map to a renderer in the `renderers` object.
- `renderer_definitions` must include `data_hint` describing the expected data shape.
- `tool_prefix` must be `"decidr_"`.
- `plugin_rules` is an array of plain-English behavioral rules injected into agent sessions. Use for renderer routing guidance (e.g., which renderer to use for action items vs dashboards) AND for short always-on guardrail pointers at behavioral runbooks. Keep rules short and unambiguous.
- `tool_rules` provide per-tool routing hints. Must be consistent with `plugin_rules` — if a plugin rule says "always use decidr_list for X", the corresponding tool_rule must not suggest an alternative.
- `prompt_definitions` hosts two flavors of prompt:
  1. **Task prompts** (e.g. `initiative_planning`, `fix_generation`, `review_generation`) — take arguments and walk the agent through one specific task. The prompt file is written as imperative instructions to the agent.
  2. **Behavioral runbooks** (e.g. `github_pr_lifecycle`) — argument-less reference contracts that an agent fetches and follows before acting on a governed lifecycle. The prompt file is written as a runbook with role detection, sequence diagrams, a reconciliation/safety protocol, and explicit non-goals. Always paired with a short `plugin_rules` line telling agents when to fetch the runbook.

## Adding a Behavioral Runbook Prompt

1. Write the runbook at `prompts/<lifecycle-name>.md`. Start with prime directives, then role detection, then per-role sequence (mermaid diagrams use `<br/>` for line breaks in nodes, never `\n`), then any cross-cutting protocol (reconciliation, rollback), then failure modes, then explicit non-goals.
2. Register it in `manifest.json` `prompt_definitions` with `arguments: []` and a description that explains what lifecycle it governs.
3. Add a single short line to `plugin_rules` telling agents when to fetch and follow it. Do not restate the runbook content in `plugin_rules` — the rule is a pointer, not a summary.
4. Bump `version` and `download_url`, add a release note, rebuild.

## Adding New Components

1. Check if an existing `__decidrUI.*` function can be extended via `opts`.
2. Add new functions to `renderers/shared/02-components.js` on the `UI` alias.
3. Entity slideout renderers (`UI.slideOut<Entity>`) go in `renderers/shared/03-slideouts.js`.
4. Add CSS tokens to `renderers/shared/01-theme.js` if new design tokens are needed.
5. Never add reusable markup directly in a renderer file.
6. When adding a new shared file under `renderers/shared/`, append it to the `SHARED_BUNDLE` cat in `build.sh`.

## Build & Verification

- Build: `bash build.sh` produces `decidr-plugin.zip`.
- Syntax check: `node -c renderers/<file>.js` for each file.
- No automated test runner — verify via companion preview.

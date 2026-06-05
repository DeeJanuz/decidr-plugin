# 0.1.33-rc.8

- **feat**: Lazy-load DecidR timeline windows from `/timeline/window` instead of front-loading every page, with range cache reuse, cursor paging, stale-response protection, dense lane virtualization, and retry status for failed window loads.

- **feat**: Add DecidR timeline stage timestamp correction guidance for `update_decision_stage_time` and `update_task_stage_time`, and render timeline events by `occurredAt` when available.

# 0.1.33-rc.5

- **feat**: Rework the DecidR timeline renderer around actionable visibility: preset ranges, horizontal day panning, stacked decision bars, legend visibility toggles, decision span states, overflow indicators, and unified month/week/day rendering.
- **fix**: Keep decision actual-time indicators bounded to real event times so month views no longer project decision activity into the future.

# 0.1.33-rc.4

- **feat**: Add Backlog as a non-actionable decision/task status in renderer labels, dashboard filters, graph legends, MCP tool guidance, and planning prompts so future work can be logged without appearing as Next Steps.
- **feat**: Expose the new `unlink_document` MCP tool in the DecidR plugin manifest so agents can remove linked files/documents from projects, decisions, and tasks after discovering the link with `list_entity_documents`.

# 0.1.32

- **fix**: Tighten commit-governance discovery so agents search existing decisions and tasks before proposing new DecidR records, avoiding duplicate lightweight task proposals.

# 0.1.31

- **feat**: Extend planning decision governance so agents propose missing DecidR records through MCPViews review. Durable implementation choices should be proposed as decisions; lightweight work that did not require approval should be proposed as tasks under the relevant project or existing decision.

# 0.1.30

- **feat**: Add DecidR decision `STAGED` lifecycle guidance for commit governance. Installed plugin rules now tell agents committing code in any codebase to search authenticated DecidR organizations for matching existing decisions and move confident matches to `STAGED`, reserving `IMPLEMENTED` for deployment-codebase migration.

# 0.1.29

- **feat**: Render DecidR entity descriptions with a safe Markdown subset in list/detail and slideout views, including paragraphs, lists, emphasis, code, blockquotes, and safe links while keeping compact cards as plaintext previews.
- **fix**: Remove audit-event counts and the recent audit trail section from the main dashboard so audit review stays in the dedicated audit renderers and object slideouts.

# 0.1.28

- **fix**: Reset advanced filter values when changing a rule to a different field type, so category multi-select values do not leak into numeric/date filters.

# 0.1.27

- **feat**: Add checkbox-based multi-value advanced filters for non-date and non-number audit report fields. `equals` and `not equals` filters can now store arrays of selected values, and users can add custom comma-separated values when the cached field catalog does not include the value they need.

# 0.1.23

- **feat**: Add the standalone `decidr_audit_reports` renderer and routing guidance for custom audit reporting, Salesforce-like payload filtering, saved report definitions, sharing, version history, and CSV export. The shared API client now includes audit-report endpoints, field catalog loading, text-response CSV export support, and member lookup for report sharing.
- **fix**: Harden audit-report follow-ups by rejecting dot path segments while preserving `export.csv`, keeping saved rule fields selectable when the live field catalog is missing them, and filtering the field palette in place so search input focus is not lost while typing.

# 0.1.22

- **feat**: Add DecidR audit event support to the plugin manifest and list/detail renderer. Agents can route audit ledger tools through `decidr_list`, project slideouts expose an Audit Events tab, decision slideouts show linked audit events, and audit event slideouts show linked decisions, payload/source context, URL links, and revision history.
- **fix**: Keep project audit tabs scoped to the current slideout instead of shared global panel state, and normalize audit event categories consistently for string and object-shaped API payloads.

# 0.1.21

- **fix**: Keep DecidR decision discovery quiet by disabling auto-push for `search`, `list_decisions`, and `get_decision`; agents now only push `decidr_list` when the user explicitly asks to see decision results or details.

# 0.1.20

- **feat**: Add DecidR guidance for supporting LudFlow document placement so agents reuse existing relevant folder structures or fall back to a folder named after the DecidR project before linking documents to governed work.

# 0.1.19

- **feat**: Add the standalone `decidr_timeline` renderer for executive roadmap scanning across initiatives, blending task due dates, entity lifecycle markers, GitHub items, and `/timeline` activity into all-initiatives and focused-initiative views with org switching and slideout drill-in.

# 0.1.18

- **feat**: Add the `planning_decision_governance` behavioral runbook and an always-on plugin rule that breadcrumbs agents to ask before logging DecidR-looking implementation plans, discover the right organization/context, prefer updating existing decisions and docs, and review batch decision/document mutations before execution.

# 0.1.17

- **fix**: Hydrate linked documents through the shared slideout enrichment pipeline for project, decision, task, bridge, and initiative panels. These slideouts all render the shared document section from `entity.documents`, but some detail endpoints do not include linked documents in their primary payloads. The slideout now calls `listEntityDocuments(...)` during enrichment and normalizes that response back onto `entity.documents`, so linked LudFlow documents reliably appear in the project slideout instead of incorrectly showing "No linked documents."

# 0.1.15

- **fix**: Align `review_pr` plugin guidance with the live backend's flexible PR status transitions. The manifest now describes `review_pr` as assigning the reviewer and moving the PR artifact to the requested status instead of implying it can only set `IN_REVIEW`.
- **fix**: Update the `github_pr_lifecycle` runbook to use explicit `review_pr(status: ...)` calls for `APPROVED` and `CHANGES_REQUESTED`, removing the prompt/tool mismatch that left BitBooks PR artifacts parked in `IN_REVIEW`.

# 0.1.14

- **fix**: Scope DecidR slideout DOM and state per session container instead of a single global `.decidr-so-panel` / `.decidr-so-overlay`. This fixes the standalone-dashboard bug where opening a decision in a new tab reused the slideout from a previously visited tab.
- **fix**: Pass renderer container context from dashboard, list, and graph views into `UI.SlideOut.open(...)` so entity details, nested navigation, archive/back flows, and org settings all stay bound to the tab the user is actively viewing.

# 0.1.13

- **feat**: Allow decisions to transition directly from `DRAFT` to `IMPLEMENTED` when they already have linked supporting documents. This supports post-hoc architecture and implementation records without forcing a retroactive review workflow through `PROPOSED`, `APPROVED`, and `IN_PROGRESS`.
- **fix**: Update plugin manifest guidance for `get_decision`, `create_decision`, and `update_decision` so agents know draft decisions can either go to `PROPOSED` for review or straight to `IMPLEMENTED` for already-completed work, while still requiring linked documents before leaving `DRAFT`.

# 0.1.8

- **fix**: Distinguish DecidR auth failures from PAT rejection in `decidr_github_auth` renderer. Previously the PAT form swallowed all non-2xx responses as a generic "Failed to connect" error, so users with an expired or missing Ludflow OAuth session thought their PAT was being rejected when the request never reached the PAT check. The shared API client (`renderers/shared/00-api-client.js`) now reads the response body in `_handleResponse` and throws a structured `Error` with `.status`, `.statusText`, `.body`, `.bodyText`, and `.bodyMessage` so callers can branch on status code and surface the server's message. A new public `API.hasToken()` method lets renderers preflight without reaching into the non-enumerable `_hasToken` getter. The `github-auth` renderer now preflights the DecidR session before POSTing — if there is no token it shows an amber warning telling the user to complete plugin sign-in instead of submitting and getting a misleading 401. `describeError` maps 401/403/400/422/5xx/network into distinct, actionable messages (401/403 use a new amber `warning` variant that explicitly clarifies "PAT was not rejected"). Help text under the PAT field now states the user must be signed in to DecidR in the companion first for the PAT to be saved.

# 0.1.6

- **fix**: GitHub auth renderer filename now matches the companion's renderer-name → filename resolution rule. The companion converts ALL underscores in a renderer name to hyphens (e.g. `decidr_github_auth` → `decidr-github-auth.js`), but `build.sh` was producing `decidr-github_auth.js`, leaving the second underscore intact. The companion could not locate the renderer, so the `decidr_github_auth` content type appeared as "no renderer for content type" on stricter platforms (Windows in particular). All other renderers were unaffected because their names had no internal underscores.

# 0.1.5

- **feat**: `github_pr_lifecycle` behavioral runbook — new plugin prompt (`prompts/github-pr-lifecycle.md`) that teaches agents how to participate in the GitHub PR lifecycle governed by DecidR. Covers two role-keyed playbooks (coder and reviewer) meeting at GitHub's PR state via async PR review assignment, a reconciliation protocol as a no-webhook workaround (diff GitHub vs DecidR before/after every step, update DecidR to match GitHub, never the reverse), and explicit failure modes (branch protection, CI red, review rejected, merge conflict, stale branch, truncated-context resume). Explicitly out of scope: fix code generation, review heuristics, DecidR-side enforcement. Resolves decision `cmno0e9kw0003lb04rdc3105k`.
- **feat**: `plugin_rules` — added an always-on guardrail directing agents to fetch and follow the `github_pr_lifecycle` runbook before taking any action on a GitHub issue or PR linked to DecidR, and to reconcile DecidR state to match GitHub before and after every lifecycle step.

# 0.1.4-unreleased

- **fix**: Issue and PR slideouts now render linked-entity cards through the canonical `UI.SlideOut._renderEntityList` helper (with new `opts.showTypeBadge` for heterogeneous lists) instead of hand-rolling `decidr-so-decision-item` markup — matches the design pattern used by decision/bridge/initiative slideouts
- **fix**: PR slideout title row now always renders a status badge, falling back to `githubState` then `OPEN` so the status is visible even when DecidR hasn't tracked a review state yet
- **refactor**: Resolve tech debt in shared components and graph — extract `UI.labelBadge`, `UI.githubSection`, `UI.SlideOut._wireArchiveEvent`, and standalone `UI.slideOutIssue`/`slideOutPR`/`slideOutRepo`; move all slideout renderers to new `renderers/shared/03-slideouts.js` (02-components.js: 3735 → 2753 lines); trigger graph re-render when GitHub counts arrive so badges appear immediately
- **feat**: Rich issue slideout with description, labels, linked entity names, and state badge; githubState badge on issue list rows; closed issues and merged PRs filtered from dashboard Next Steps
- **feat**: Surface GitHub issues and PRs across all views — issue/PR sections in project, decision, and task slideouts via enrichment; issues and pull requests groups in dashboard Next Steps; GitHub count badges on dashboard project cards and graph nodes; fix pre-existing meta rendering bug in issue/PR/repo slideouts
- **fix**: Pass organization_id through withReady so non-default orgs load correctly — dashboard and graph renderers now sync _activeOrgId before token fetch, fixing org-specific data not loading
- **fix**: Graph node clicks swallowed by pan detection — added 5px dead zone so sub-pixel mouse movement during clicks no longer suppresses click events; raised action/zoom button z-index from 10 to 100 to prevent overlap
- **feat**: Org picker in dashboard and graph renderers — switch between organizations without re-pushing from the agent
- **fix**: Make org fetch non-fatal in dashboard and graph renderers — gracefully handle missing or expired org tokens
- **fix**: Scope slideout panels to session container instead of viewport — prevents slideouts from overlapping other companion panels
- **feat**: Task creation from project slideout — create tasks directly from the project detail panel, not just from decisions
- **feat**: Dashboard next steps grouped by type — action items organized by category for better scanning
- **feat**: Dashboard status visibility, dynamic filters, and activity indicators — filter projects by status, see recent activity at a glance
- **feat**: Parent renderer refresh on SlideOut mutations — dashboard and graph auto-refresh when entities are changed, deleted, or approved from the slide-out panel
- **fix**: Refresh parent slideouts when mutations occur in nested views — parent stack entries marked stale after child mutations, re-fetched on Back navigation

# 0.1.4

- **fix**: `my_action_items` tool_rule now directs agents to ALWAYS push to `decidr_list` — removes ambiguous dashboard suggestion that caused agents to open `decidr_dashboard` for action item requests
- **fix**: Action Items tool_group hint clarified to reference `decidr_list` instead of "Dashboard"
- **feat**: `plugin_rules` — two high-level behavioral rules that agents see every session: action items always go to `decidr_list`, entity views always go to `decidr_list`, dashboard/graph only on explicit request

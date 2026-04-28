# Unreleased

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

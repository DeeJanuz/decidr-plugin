# Unreleased

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

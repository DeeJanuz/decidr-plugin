# Unreleased

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

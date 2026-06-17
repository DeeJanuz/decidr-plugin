# Unreleased

## 0.1.44

- Add a DecidR Work Session Bootstrap startup rule so fresh agents and subagents discover the Work Sessions tool group after `init_session`.
- Point Work Session bootstrap guidance at the stable `active work sessions` discovery query and prefer normal MCPViews/DecidR tools over direct MCP HTTP fallbacks.

## 0.1.43

- Add Active Work Sessions guidance and tool routing for lazy cross-agent handoff.
- Capture compact summaries and artifact references only, with MCPViews row-level review before multi-item DecidR logging or promotion.
- Guard native rule-file edits behind explicit approval guidance.

## 0.1.42

- Move owner and implementor out of workflow header pills and render full names inline on dashboard activity/meta rows.
- Keep workflow header pills focused on stage and next action while color-coding owner and implementor names.

## 0.1.41

- Add compact workflow pills to dashboard and slideout task/decision UI, showing stage, owner, implementor, and next action.
- Use stronger role/status/action colors, remove redundant task badges, and keep next-action text fully visible.

## 0.1.40

- Add copy reference buttons for initiatives, projects, decisions, and tasks across dashboard cards, action rows, and slideout child lists.
- Copy DecidR references as plain `<type> <id>` strings for quick AI chat lookup, with clipboard fallback handling and click guards that preserve existing navigation.

## 0.1.39

- Split DecidR workflow breadcrumbs into compact global `plugin_rules` and filterable `plugin_rule_definitions`.
- Scoped governance lifecycle, document versioning, member assignment, GitHub, audit, archive, and status-transition guidance to the relevant tools/groups so `get_plugin_docs` stays token-efficient.
- Shortened the DecidR governance mode setup persisted rule so upgraded installs do not keep replaying full lifecycle text in every init response.

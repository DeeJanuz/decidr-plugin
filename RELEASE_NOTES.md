# 0.1.33-rc.15

- **feat**: Add the direct `invite_member` DecidR organization tool to plugin metadata so agents can invite team members without routing through `manage_member(action=add)`.
- **fix**: Teach setup, initiative-planning, and tool rules to resolve referenced people with `list_members`, invite missing people by email, and avoid assigning pending invitation IDs to owner, member, assignee, or reviewer fields.

# 0.1.33-rc.14

- **feat**: Add deterministic owner color and initials treatment to the DecidR timeline so lane people chips, decision spans, decision markers, and scan items stay attributable even when users share initials or lack avatars.

# 0.1.33-rc.13

- **fix**: Add an explicit DecidR implementation-start gate to setup breadcrumbs, governance runbooks, registry hints, and decision tool rules so agents verify or propose governed records before leaving discovery/planning for code, packaging, deployment prep, or external writes.
- **fix**: Clarify DecidR MCPViews review thresholds so ordinary low-risk decision, task, and accompanying-document writes proceed directly, while review is reserved for significant, ambiguous, destructive, high-impact, hard-to-undo, or row-level approval-worthy changes.
- **fix**: Clarify DecidR release breadcrumbs so agents move matching `STAGED` decisions to `IMPLEMENTED` after production-equivalent pushes, merges, or versioned releases, while avoiding false implementation state for staging-only `main` or `master` branches.

# 0.1.33-rc.12

- **fix**: Add a backward-compatible governance-mode setup rule to plugin_rules so older MCPViews builds can prompt for DecidR team-vs-solo defaults without needing core setup_questions support.

# 0.1.33-rc.11

- **feat**: Add DecidR governance lifecycle and governance check-in prompts, plus setup-question metadata so MCPViews setup can persist a compact default governance mode rule.

# 0.1.33-rc.10

- **feat**: Improve DecidR timeline review ergonomics with a sticky filterable legend that follows vertical scroll without pinning the full filter panel.

- **fix**: Polish light-mode timeline rendering with consistent project wrappers, translucent timeline surfaces, bounded decision bars, and visible grid lines under decision spans.

# 0.1.33-rc.9

- **feat**: Surface catch-up decisions as first-class decision records across DecidR MCP guidance, decision slideouts, list cards, and project-grouped timeline bars, including direct post-implementation capture affordances.

- **feat**: Group DecidR timeline rows by project inside initiatives so dense initiative views show which project each decision, task, and activity belongs to.

# 0.1.33-rc.8

- **feat**: Surface catch-up decisions for post-implementation governance capture with manifest guidance, timeline anchoring to historical status events, and a visible Catch-up badge in decision cards, slideouts, lists, and timeline bars.

- **feat**: Lazy-load DecidR timeline windows from `/timeline/window` instead of front-loading every page, with range cache reuse, cursor paging, stale-response protection, dense lane virtualization, and retry status for failed window loads.

- **feat**: Add DecidR timeline stage timestamp correction guidance for `update_decision_stage_time` and `update_task_stage_time`, and render timeline events by `occurredAt` when available.

# 0.1.33-rc.5

- **feat**: Rework the DecidR timeline renderer around actionable visibility: preset ranges, horizontal day panning, stacked decision bars, legend visibility toggles, decision span states, overflow indicators, and unified month/week/day rendering.
- **fix**: Keep decision actual-time indicators bounded to real event times so month views no longer project decision activity into the future.

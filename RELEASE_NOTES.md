# Unreleased

- Improve DecidR dashboard accessibility by making initiative collapse headers keyboard-operable buttons with explicit expanded state and project-region controls.
- Improve mobile dashboard and timeline behavior with overflow-safe dashboard rows, stacked decision/pending cards, and a mobile timeline agenda view that preserves Now/Next/Risk scan paths.
- Improve GitHub PAT and slideout accessibility with labeled form fields, live validation feedback, invalid-field focus, escaped error details, and named close/back controls.
- Strengthen the auto-log DecidR setup rule so meaningful work is logged under the closest product/company initiative or project when no exact parent match exists, instead of being skipped.

## 0.1.51

- Add provider-neutral external document links in decision/project/task slideouts, with a Notion-default external link form and provider badges.
- Add external document sidecars that load captured lifecycle evidence snapshots and preview the latest evidence with source URL fallback.
- Register new provider-neutral document evidence tools in the manifest and route them to the DecidR list renderer.

## 0.1.50

- Fix Ludflow document sidecars so delayed repeated opens reuse the existing loading/data stack entry instead of pushing duplicate previews.
- Attach left document sidecars to the right slideout, flip the sidecar chevron, remove duplicate header titles, and add truncation/tooltips for long document and version names.

## 0.1.49

- Increase DecidR `init_context` timeout to 2500 ms so MCPViews startup can reliably return current-user recent decision breadcrumbs from the last 24 hours during cold hosted calls.

## 0.1.48

- Declare DecidR's plugin-controlled `init_context` provider for recent decision breadcrumbs during MCPViews `init_session`.
- Remove Active Work Session startup rules, tool groups, renderer routing, and no-auto-push entries from the active manifest.
- Reframe work logging setup guidance around durable decisions, tasks, documents, and lifecycle proof without temporary session handoff state.

## 0.1.47

- Make DecidR startup-rule language more agent-agnostic by referring to provided tools instead of Codex-specific tool names.
- Bias governance lifecycle and work logging triggers toward durable user intent: accepted plans, selected options, agreed findings, meaningful discoveries, persistent objects, tasks, and lifecycle proof.

## 0.1.46

- Rewrite DecidR startup rules into concise trigger/action/review/example blocks so fresh agents have explicit run conditions and concrete behavior examples.
- Bump DecidR startup rule versions to force local startup-rule update detection after the instruction rewrite.

## 0.1.45

- Add a setup-configured DecidR Work Logging Runtime startup rule sourced from the selected setup answer.
- Add setup-configured DecidR Governance Lifecycle Runtime startup rules for team and solo-builder modes so agents know lifecycle gates from native startup context.
- Replace the legacy work-style setup question with a decision-first work logging policy, defaulting to auto-log confident low-risk work while review-gating ambiguous or high-impact writes.
- Update the governance lifecycle runbook so installed local logging policy controls whether agents create formal DecidR records directly, through review, or only after explicit approval.

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

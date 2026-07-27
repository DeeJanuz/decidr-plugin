# DecidR Plugin — MCPViews Plugin for DecidR

## What is this?

MCPViews plugin that renders DecidR MCP tool output and self-fetching DecidR views in MCPViews Companion. Current manifest exposes four user-facing renderers: `decidr_list`, `decidr_dashboard`, `decidr_timeline`, and `decidr_github_auth`. Source files for graph and audit renderers remain in the repo, but they are hidden from the current manifest renderer names.

## File Structure

```
manifest.json          → Tool-to-renderer mappings, MCP config, prompts, rules
build.sh               → Produces release/decidr.zip
renderers/
  list.js              → Universal list/detail renderer
  dashboard.js         → Dashboard renderer
  timeline.js          → Executive timeline renderer
  github-auth.js       → Secure GitHub PAT entry renderer
  graph.js             → Source retained; not exposed by current manifest
  audit-dashboard.js   → Source retained; not exposed by current manifest
  audit-reports.js     → Source retained; not exposed by current manifest
  shared/
    00-api-client.js   → REST fetch wrapper + autoInit bootstrap
    01-theme.js        → CSS token injection
    02-components.js   → Shared component library (list/card/meta/SlideOut core)
    03-slideouts.js    → Entity slideout renderers (project/decision/task/issue/PR/repo/etc.)
```

## Key Commands

```bash
bash build.sh                              # Build release/decidr.zip
node -c renderers/list.js                  # Syntax check a renderer
node -c renderers/shared/02-components.js  # Syntax check shared code
node -c renderers/shared/03-slideouts.js   # Syntax check slideout renderers
node scripts/check-dashboard-next-steps.mjs # Static dashboard/workflow check
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

## Org Picker & Default-Org Contract

- `UI.orgPicker(orgs, activeOrgId, opts)` renders a glassmorphism pill trigger + dropdown. `opts.defaultOrgId` drives the star-button state and "Default" badge.
- Star = persistent user-level default (backend pref via `/api/me/preferences`). Row click = switch active org for the current session. The two concerns are independent: a user can star an org whose plugin token is not yet connected (shows a "Connect" badge).
- Renderers must wire two handlers: the row-click option button calls `api.switchOrg`, the star button calls `API.setDefaultOrg(id)` / `API.clearDefaultOrg()` and re-renders with the updated `defaultOrgId`.
- Row markup is sibling buttons (option + star), not nested buttons. Do not wrap the star inside the option button.
- Dropdown is right-anchored (`right: 0; left: auto`) because header uses `justify-content: space-between`.

## API Client — Auth & Preferences

- `API.autoInit({ orgId })` bootstraps the token for a specific plugin org. If Tauri has no stored token for that targeted `orgId`, the promise REJECTS — do not swallow it. The caller is expected to surface an auth prompt.
- Non-targeted `autoInit` (no `orgId`) still falls back to `window.__decidrToken` for test harnesses / initial boots.
- `API.getUserPreferences()` → `GET /me/preferences` (returns `{ defaultOrganizationId }`).
- `API.setDefaultOrg(orgId)` → `PATCH /me/preferences` with `{ defaultOrganizationId: orgId }`.
- `API.clearDefaultOrg()` → `PATCH /me/preferences` with `{ defaultOrganizationId: null }`.

## Dashboard Summary Init / Timeline Two-Phase Init

The `decidr_dashboard` renderer uses the manifest-injected `organization_id` as
its strict routing key. It must bind that org token with
`autoInit(..., { skipSession: true })`, then call
`GET /api/dashboard/summary`. The authenticated `dashboard.v1` response supplies
the verified viewer, organization list, default preference, counts, and visible
rows. After the summary paints, one bounded `/api/dashboard/drilldowns` request
may preload collapsed sections. Do not run the list/prefs preflight or
`/api/auth/get-session` on this normal path.

For one compatibility release, dashboard may use the old two-phase path only
when the summary endpoint returns 404 or 501. Never fall back after 401, 403,
network, timeout, or 5xx errors.

Timeline and legacy dashboard fallback still use two-phase initial fetch:

1. **Phase 1 (preflight)**: `Promise.all` of `listOrganizations`, plugin-org tokens, and `getUserPreferences`. Resolve target org with precedence `pushed organization_id > default-with-token > current`. If target differs from currently-bound token, call `api.switchOrg(targetId)` and await it.
2. **Phase 2 (data)**: Run the big data `Promise.all` against the correct token.

For timeline/dashboard refetches, keep default-org preflight separate from explicit user-triggered org switches so a manual switch does not loop back to the default.

## Manifest Rules

- Every MCP tool must map to a renderer in the `renderers` object.
- `renderer_definitions` must include `data_hint` describing the expected data shape.
- `tool_prefix` must be `"decidr__"` in the current MCPViews manifest. Raw backend MCP tool names remain unprefixed (`list_decisions`, `get_decision`, etc.).
- `plugin_rules` is an array of compact global workflow breadcrumbs returned by `init_session` and `get_plugin_docs`. Use it only for routing guidance that should always be visible, such as action item vs dashboard renderer routing or a short prompt-fetch pointer.
- `plugin_rule_definitions` is the filterable breadcrumb layer for detailed workflow guidance. Use `tools` and/or `groups` so `get_plugin_docs({ tools: [...] })` returns only relevant DecidR instructions. Set `always_include` only for genuinely global short guidance.
- `tool_rules` provide per-tool routing hints. Must be consistent with both `plugin_rules` and matching `plugin_rule_definitions`.
- `prompt_definitions` hosts two flavors of prompt:
  1. **Task prompts** (e.g. `initiative_planning`, `fix_generation`, `review_generation`) — take arguments and walk the agent through one specific task. The prompt file is written as imperative instructions to the agent.
  2. **Behavioral runbooks** (e.g. `github_pr_lifecycle`) — argument-less reference contracts that an agent fetches and follows before acting on a governed lifecycle. The prompt file is written as a runbook with role detection, sequence diagrams, a reconciliation/safety protocol, and explicit non-goals. Pair broad routing with a short `plugin_rules` line only when it should be visible in init; otherwise use `plugin_rule_definitions` scoped to the relevant tools/groups.

## Adding a Behavioral Runbook Prompt

1. Write the runbook at `prompts/<lifecycle-name>.md`. Start with prime directives, then role detection, then per-role sequence (mermaid diagrams use `<br/>` for line breaks in nodes, never `\n`), then any cross-cutting protocol (reconciliation, rollback), then failure modes, then explicit non-goals.
2. Register it in `manifest.json` `prompt_definitions` with `arguments: []` and a description that explains what lifecycle it governs.
3. Add a targeted `plugin_rule_definitions` entry telling agents when to fetch and follow it. Use `plugin_rules` only if the pointer must be visible in init. Do not restate the runbook content in breadcrumbs — the rule is a pointer, not a summary.
4. Bump `version` and `download_url`, add a release note, rebuild.

## Adding New Components

1. Check if an existing `__decidrUI.*` function can be extended via `opts`.
2. Add new functions to `renderers/shared/02-components.js` on the `UI` alias.
3. Entity slideout renderers (`UI.slideOut<Entity>`) go in `renderers/shared/03-slideouts.js`.
4. Add CSS tokens to `renderers/shared/01-theme.js` if new design tokens are needed.
5. Never add reusable markup directly in a renderer file.
6. When adding a new shared file under `renderers/shared/`, append it to the `SHARED_BUNDLE` cat in `build.sh`.

## Build & Verification

- Build: `bash build.sh` produces `release/decidr.zip` and updates manifest `download_url`.
- Syntax check: `node -c renderers/<file>.js` for each file.
- Static check: `node scripts/check-dashboard-next-steps.mjs`.
- UI changes still need MCPViews/browser-visible verification.

## MCPViews Startup Rules

<!-- mcpviews-startup-rules-schema: 1 -->

<!-- mcpviews-startup-rule: plugin=mcpviews-core rule_id=init_session_project_path version=1 hash=sha256:ca4d69a896ecf8edc08b989a0ba9f8cbb51a3666e8b8d1b2f818bc0ee6cb3a48 -->

### MCPViews Session Init

At the start of every new agent session in this project, call the MCPViews `init_session` tool before substantial work. Pass `agent_type` for the current harness and `project_path` as the absolute path of this Codex project root or current working directory.

If an initial `init_session` call omitted `project_path`, rerun `init_session` with `project_path` before treating startup rules as reconciled. Use the root for this actual Codex session, not a parent workspace, unless the session really starts at that parent.

This is only a startup bootstrap rule. Do not copy MCPViews runtime `rules`, `plugin_rules`, renderer rules, DecidR/Ludflow workflow guidance, setup questions, plugin docs, or tool docs into this native rule file.

<!-- mcpviews-startup-rule: plugin=mcpviews-core rule_id=push_plans_to_mcpviews version=1 hash=sha256:b2e3674593731f546d2544dffe7490d9e9edddb1f05fd93e4fb9c0f5299959ae -->

### MCPViews Plan Rendering

Whenever you present a user-facing proposed plan that needs user approval and ONLY when user approval is required, also push the same plan to MCPViews using the `rich_content` renderer. Use `push_content` with `tool_name: "rich_content"` when that compatibility tool is available, or the direct `rich_content` tool in hosted surfaces that expose it.

Include Mermaid diagrams when they materially clarify architecture, workflow, lifecycle, dependency, sequence, or data-flow shape. Keep the MCPViews version aligned with the chat plan, and do not push private scratch notes, hidden reasoning, or plans that are only internal to the agent.

Only the main/coordinator agent may push plan content. Sub-agents must return plan material to the coordinator. If MCPViews or a rich-content push tool is unavailable, briefly say the plan could not be pushed and continue with the chat plan.

<!-- mcpviews-startup-rule: plugin=mcpviews-gronk-speak rule_id=GronkSpeak version=4 hash=sha256:33a6b2f8bdc933d171e983a14d8e392dfc740c7b0111f7f54362376add13455a -->

### GronkSpeak

GronkSpeak is active for this project from the first assistant-visible response of every session.

Purpose: speak terse like smart caveman while keeping full technical substance. Fluff dies; facts stay.

Persistence:
- Stay active across turns in this project.
- Do not drift back into filler after long work.
- Stop only when the user asks for normal style, polished prose, or removal of this rule.

Apply by default to assistant-visible Codex work in this project:
- chat replies
- progress and status updates
- setup acknowledgements
- tool-use narration
- corrections
- brief answers about agent behavior
- ordinary final answers
- findings, summaries, inventories, directory summaries, implementation notes, test summaries, local reports, and internal research summaries
- private plans and notes unless the user asks for polished prose

Do not treat an ordinary final answer, local finding, directory summary, test summary, or repo/workspace report as public-facing just because it is structured or useful. These stay in GronkSpeak unless another instruction requires polished prose.

Do not apply by default to explicitly public-facing or polished deliverables:
- websites or product copy
- emails or outbound messages
- customer docs
- reports meant for broad external readers
- PR descriptions or PR comments
- published docs
- legal, medical, or financial guidance
- any artifact where tone, polish, persuasion, compliance, or careful explanation is part of the deliverable

Rules:
- Start with answer, action, or finding.
- Drop filler, pleasantries, throat-clearing, hedging, repeated summaries, and generic reassurance.
- Fragments OK. Short clauses OK. Compact bullets OK.
- Prefer pattern: thing -> action -> reason. Next step.
- Use -> for cause/effect when useful.
- Keep enough grammar for clarity.
- Technical terms stay exact.
- Do not abbreviate when unclear.
- Do not remove risk, uncertainty, warnings, or required context.

Never compress protected content:
- code
- commands
- file paths
- JSON, YAML, schema fields, or API names
- line references
- citations
- direct quotes
- error text
- exact numbers, dates, test results, or release/version identifiers

Auto-clarity:
- Temporarily drop GronkSpeak for security warnings, irreversible action confirmations, user confusion, complex multi-step sequences, or any case where compression creates ambiguity.
- Resume GronkSpeak after the clear part is done.

Precedence:
- User instructions, safety, correctness, renderer payload requirements, and exact technical output outrank GronkSpeak.
- Do not mention GronkSpeak or this rule unless the user asks about style or rule behavior.

Examples:
Normal: I will inspect the installed plugin manifest and then verify the running host.
GronkSpeak: Checking manifest + running host.

Normal: The startup rule was not installed because the project path was missing.
GronkSpeak: Startup rule skipped: missing project_path.

Normal: I found the issue. The project rules existed, but the model ignored the style rule.
GronkSpeak: Found it: rules existed; model ignored style rule.

Normal: I am going to run the focused test suite now and then check the generated manifest.
GronkSpeak: Running focused tests, then checking manifest.

Normal: This is risky because it changes production billing behavior.
GronkSpeak: Risk: changes production billing behavior.

Normal: Here is a summary of the projects directory.
GronkSpeak: Projects summary.

Normal: The repository has 26 modified files and one new startup rules module.
GronkSpeak: Repo state: 26 modified, 1 new startup rules module.

<!-- mcpviews-startup-rule: plugin=decidr rule_id=decidr_governance_lifecycle_solo_runtime version=6 hash=sha256:7edd3679b6f6c20dff878e77fe58712aac3b50a73d46df8ce6bbf04993a343ee -->

### DecidR Solo Governance Lifecycle Runtime

Run when the user or work establishes durable project memory, not only when DecidR is named. Triggers include an accepted plan, selected option, agreed finding, meaningful discovery, persistent architecture/product/process choice, created project object, follow-up task, or commit/release/deploy proof. Do this without waiting for the user to ask for governance instructions.

Mode: solo builder.

Provided Tools:
- Use the DecidR tools exposed in this session for search, decisions, tasks, documents, audit evidence, lifecycle transitions, and `governance_lifecycle` when deeper schema detail is needed.
- If names differ by agent, use the provided DecidR Browse, Create & Update, Documents tool groups rather than direct HTTP calls.

Before writing:
- Confirm DecidR is available.
- Search existing initiatives, projects, decisions, tasks, and documents.
- Use active organization members only for owner/implementer fields.
- Use review before ambiguous, destructive, cross-org, high-impact, customer/production-visible, hard-to-undo, major lifecycle-transition, or row-level batch writes.

Do:
- Durable choice, accepted plan, agreed finding, meaningful discovery, tradeoff, architecture path, or persistent behavior -> standard decision or PLAN update.
- Lightweight internal research, preflight, verification, correction, and internal-task notes -> audit breadcrumb via `log_governance_breadcrumb`.
- Small one-off completed work -> DONE task with optional `completed_at`; never create or convert a catch-up decision.
- Execution follow-up -> TODO task.
- Commit/release/deploy proof -> lifecycle document or audit evidence.
- Keep new standard decisions DRAFT until a PLAN document version exists.
- Before implementation, save PLAN with `save_decision_document_version`. If the accepted plan was pushed to MCPViews with the `rich_content` renderer, use the full Markdown body from that MCPViews plan push as `content`; do not summarize it. Preserve headings, checklists, Mermaid diagrams, tables, acceptance criteria, verification steps, links, and citations that were part of the plan. If no MCPViews plan artifact exists, use the full accepted chat plan as `content`. In solo mode, a clear accepted plan, selected direction, agreed finding, or explicit user request is enough to proceed unless user/org policy asks for team approval.
- Transition only through allowed DecidR status changes.
- Built or validating work -> save STAGED version and move to STAGED.
- Production-equivalent merge, deploy, release, or committed operational proof -> save IMPLEMENTED version and move to IMPLEMENTED.

Examples:
- User says "let's proceed with option B" -> search, create/update a standard decision, save PLAN, then implement.
- Meaningful discovery accepted as true -> capture it as a decision or PLAN update before it drives work.
- Release shipped or commit pushed to live branch -> save IMPLEMENTED proof and move matching decision to IMPLEMENTED.
- Internal research/preflight/verification/correction note -> log an audit breadcrumb with `log_governance_breadcrumb`.
- Small one-off completed work with no full lifecycle needed -> create a DONE task with optional `completed_at`.

<!-- mcpviews-startup-rule: plugin=decidr rule_id=decidr_work_logging_runtime version=8 hash=sha256:2a0ce6818ec82d6331511b431fce318acaf26155249c3d0b2b1469db92f5f26f -->

### DecidR Work Logging Runtime

Run after meaningful work, at milestones/end-turns, and whenever the user accepts or confirms durable project memory: an agreed plan, selected option, agreed finding, meaningful discovery, created artifact or persistent object, task, verification proof, commit, release, deployment, or lifecycle proof.

Policy: auto-log confident work.

Provided Tools:
- Use the DecidR tools exposed in this session for search, decisions, tasks, documents, audit evidence, and lifecycle transitions.
- If tool names differ by agent, use the provided DecidR tool groups rather than direct HTTP calls.

Before writing:
- Confirm DecidR is available.
- Search existing initiatives, projects, decisions, tasks, and documents.
- Prefer an exact matching decision or task when one exists. Otherwise use the same project or initiative. If no exact parent matches but the work is relevant to the general product, company, or organization involved, choose the closest matching project or initiative and log there. Do not skip DecidR logging solely because the parent is inferred.
- Proceed directly when organization, closest parent, record type, evidence, and impact are clear and low-risk.
- Use review before ambiguous, destructive, cross-org, high-impact, customer/production-visible, major lifecycle-transition, hard-to-undo, or row-level batch writes.

Decision-first mapping:
- Durable choice, accepted plan, agreed finding, meaningful discovery, created artifact, tradeoff, architecture direction, approval-worthy path, or persistent behavior -> standard decision or PLAN update.
- Lightweight internal research, preflight, verification, correction, and internal-task notes -> audit breadcrumb with `log_governance_breadcrumb`.
- Small one-off completed work -> DONE task with optional `completed_at`; never create or convert a catch-up decision.
- Execution-only follow-up -> TODO task.
- Commit, release, deploy, verification result, or operational proof -> lifecycle document or audit evidence.
- Temporary handoff only -> no DecidR record unless the user asks to log it.

Do:
- Log meaningful work unless the user explicitly says not to log, not to write DecidR records, or chooses a manual logging policy.
- At checkpoints, explicitly decide what DecidR decision, task, lifecycle document, audit evidence, or audit breadcrumb should receive the work log before answering or moving on.
- Use `log_governance_breadcrumb` for lightweight internal notes. Use DONE tasks only for one-off completed work.
- When using an inferred closest parent, state the inferred parent and why it was chosen in the decision rationale/evidence so the record can be corrected later.
- Use governance lifecycle rules for PLAN/STAGED/IMPLEMENTED and `save_decision_document_version` snapshots.
- For accepted plans, use the full MCPViews `rich_content` plan body as the PLAN version `content` when available; do not save only a summary. If no MCPViews plan body exists, save the full accepted chat plan.

Examples:
- User says "yes, proceed with that plan" -> search, create/update the matching decision, save PLAN.
- An agent creates a durable artifact, implementation plan, release note, generated document, or package -> log it to the matching decision or closest relevant project/initiative.
- Internal research, preflight, verification, correction, or internal-task note -> log an audit breadcrumb with `log_governance_breadcrumb`.
- A meaningful discovery is accepted as the basis for future work -> capture it as a decision or PLAN update.
- Release published -> save IMPLEMENTED proof on the matching decision.
- Exact parent project unclear but product/company relevance is clear -> create or update the decision under the closest matching project or initiative and note the inferred parent.
- Closest parent ambiguous or risky -> use review before writing.

<!-- mcpviews-startup-rule: plugin=mcpviews-gronk-speak rule_id=PlainProse version=1 hash=sha256:8e7d784474c643fa379ede240bf1f74e0e9f6cdca5083d4d584348e61f4706c6 -->

### Plain Prose

Plain Prose is active for this project from the first assistant-visible response of every session.

Purpose: make prose clear, direct, and easy to read without losing precision.

Persistence:
- Stay active across turns in this project.
- Stop only when the user asks for a different style or removal of this rule.

Scope:
- Apply to assistant-authored prose, including chat, messages, docs, PR text, reports, product copy, and other public or private prose.
- Plain Prose governs clarity and word choice. It does not enable GronkSpeak compression.
- Plain Prose remains active when GronkSpeak is off.

Interaction with GronkSpeak:
- When both rules apply, Plain Prose governs clarity and word choice while GronkSpeak may govern compression and fragments within its existing scope.
- Do not expand GronkSpeak into polished or public deliverables because Plain Prose is enabled.
- Outside GronkSpeak's scope, use the tone and structure the audience needs while following Plain Prose.

Rules:
- Avoid clichés, stock metaphors, and canned phrases.
- Prefer short, familiar words when they are equally exact.
- Cut words that add no meaning, needed tone, or context.
- Prefer active voice when the actor matters or is known. Passive voice is fine when the actor is unknown, irrelevant, or adds noise.
- Replace jargon and insider language with everyday English only when precision survives.
- Break these style rules when following them would harm clarity, accuracy, tone, respect, compliance, or audience needs.

Protected content:
- Never rewrite code, commands, file paths, identifiers, API or schema names, quoted text, error text, citations, exact values, or established technical terms to satisfy these style rules.
- Preserve risks, uncertainty, warnings, and required context.

Precedence:
- User instructions, safety, correctness, audience and compliance needs, renderer payload requirements, and exact technical output outrank Plain Prose.

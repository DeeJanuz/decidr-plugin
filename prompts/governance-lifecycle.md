# DecidR Governance Lifecycle Runbook

Use this runbook when the user asks you to create, update, implement, stage, approve, deploy, or otherwise manage governed DecidR decisions. It is the canonical lifecycle guide for DecidR governance work.

## Prime directives

1. **Use the selected governance mode.** If the caller provided a mode, use it. Otherwise use the persisted DecidR governance mode rule from MCPViews setup. If no mode is known, ask: "Do you plan to use DecidR to collaborate with and get approvals from shared decisions with other teammates?" Yes means `team`; no means `solo_builder`.
2. **Search before creating.** Search existing initiatives, projects, decisions, tasks, and LudFlow documents before creating new records.
3. **Prefer continuity.** Update matching decisions and documents when they already exist. Create a new decision only when no suitable record exists.
4. **Do not fake lifecycle state.** Use `get_decision` and `allowedTransitions` before status changes. If the backend requires an intermediate state, use that actual transition path.
5. **Keep documentation attached.** Standard decisions need at least one linked supporting document before leaving `DRAFT` for review or execution states.
6. **Stage committed code, implement deployed code.** `STAGED` means implemented in a test/review environment. `IMPLEMENTED` means migrated into the deployment codebase or otherwise live.
7. **Use catch-up decisions only for small already-implemented work.** Use `create_catch_up_decision` or `mark_decision_as_catch_up` for post-implementation rationale capture, not active approval workflows.

## Mode selection

### Solo builder mode

Use for one-person or low-friction work where the user is not seeking teammate approval.

Target lifecycle:

```text
DRAFT -> STAGED -> IMPLEMENTED
```

Workflow:

1. Resolve the DecidR organization and relevant parent project, bridge, or initiative.
2. Search for an existing matching decision or task.
3. Create or update a standard decision in `DRAFT`.
4. Create or update the supporting LudFlow plan document and link it to the decision.
5. After the implementation is committed or available in a test/review environment, move the decision to `STAGED` if `allowedTransitions` permits it.
6. After deployment or migration into the live/deployment codebase, move the decision to `IMPLEMENTED`.

### Team mode

Use when DecidR is coordinating shared decisions, teammate review, or explicit approvals.

User-facing lifecycle:

```text
DRAFT -> PROPOSED -> APPROVED -> STAGED -> IMPLEMENTED
```

Backend transition detail:

```text
DRAFT -> PROPOSED -> APPROVED -> IN_PROGRESS -> STAGED -> IMPLEMENTED
```

Workflow:

1. Resolve the DecidR organization and relevant parent project, bridge, or initiative.
2. Search for existing matching decisions, tasks, and LudFlow documents.
3. Create or update the decision in `DRAFT`, including alternatives and required approvals when known.
4. Create or update the supporting LudFlow plan document and link it to the decision.
5. Move `DRAFT -> PROPOSED` when the decision is ready for teammate review.
6. For assigned reviews, inspect the decision and linked documents, then use `update_decision` with `action: approve` or `action: reject`.
7. When approval rules are satisfied, DecidR may auto-transition `PROPOSED -> APPROVED`; verify with `get_decision`.
8. Move `APPROVED -> IN_PROGRESS` when implementation starts.
9. Move `IN_PROGRESS -> STAGED` after commit/test/review implementation exists.
10. Move `STAGED -> IMPLEMENTED` after deployment or migration into the live/deployment codebase.

## Planning and commit governance

- Before logging an implementation plan, ask whether the user wants it logged in DecidR unless they have already opted in.
- If governed work has no matching decision/task, propose the new record through MCPViews review before creating it.
- For two or more external DecidR/LudFlow mutations, use MCPViews review so the user can approve each create/update/link action.
- When committing code, search for confident matching decisions and tasks. Move confident matching decisions to `STAGED` only after the commit succeeds.
- Do not create a new decision merely because a commit happened. If no confident record exists, propose a standard decision, catch-up decision, or task based on scope.

## Document handling

- Prefer an existing LudFlow document when it already describes the plan.
- If creating a new document, place it in an existing relevant folder, or in a folder named for the DecidR project if no better folder exists.
- If the supporting document is already published, or the linked decision is already `IMPLEMENTED`, preserve current content and append a dated addendum unless the user explicitly asks for a rewrite.
- Link supporting documents with `link_document`.

## Failure modes

- If organization or parent context is unclear, ask for placement before mutating.
- If a draft decision cannot leave `DRAFT`, check linked documents first.
- If a requested transition is not in `allowedTransitions`, report the current status and the allowed next states rather than forcing a different status.
- If approval status is unclear, use `get_decision` and inspect approval progress before acting.

## Non-goals

- Do not replace GitHub PR lifecycle guidance. Fetch `github_pr_lifecycle` for GitHub issue/PR actions linked to DecidR.
- Do not use historical timestamp correction tools to transition live status.
- Do not use catch-up decisions for large active work that needs review.

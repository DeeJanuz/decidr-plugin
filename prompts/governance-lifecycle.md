# DecidR Governance Lifecycle Runbook

Use this runbook when the user asks you to create, update, implement, stage, approve, deploy, or otherwise manage governed DecidR decisions. It is the canonical lifecycle guide for DecidR governance work.

## Prime directives

1. **Use the selected governance mode.** If the caller provided a mode, use it. Otherwise use the persisted DecidR governance mode rule from MCPViews setup. If no mode is known, ask: "Do you plan to use DecidR to collaborate with and get approvals from shared decisions with other teammates?" Yes means `team`; no means `solo_builder`.
2. **Search before creating.** Search existing initiatives, projects, decisions, tasks, and LudFlow documents before creating new records.
3. **Prefer continuity.** Update matching decisions and documents when they already exist. Create a new decision only when no suitable record exists.
4. **Do not fake lifecycle state.** Use `get_decision` and `allowedTransitions` before status changes. If the backend requires an intermediate state, use that actual transition path.
5. **Keep documentation attached.** Standard decisions need at least one linked supporting document before leaving `DRAFT` for review or execution states.
6. **Run the implementation start gate.** When leaving discovery or planning for governed feature/process work, fetch this runbook and verify or propose the governing decision/task before the first repo edit, packaging command, deployment prep, or external write.
7. **Stage built work, implement live work.** `STAGED` means built/configured and in test/review or non-production validation. It is not approval-to-build or acceptance of a plan. `IMPLEMENTED` means migrated into the deployment codebase or otherwise live.
8. **Use catch-up decisions only for small already-implemented work.** Use `create_catch_up_decision` or `mark_decision_as_catch_up` for post-implementation rationale capture, not active approval workflows.

## Discovery and implementation gates

Use these checkpoints whenever a new feature, process, public/plugin packaging change, onboarding flow, deployment path, or cross-system behavior may be DecidR-governed:

1. **Open discovery:** Gather facts and draft options. Keep DecidR/LudFlow mutations read-only unless the user explicitly asks to log during discovery.
2. **Human-accepted direction:** When the human says the direction is good enough to preserve, create or update the DecidR decision and link the discovery artifact. Do not mark the decision `STAGED` merely because the plan is accepted.
3. **Implementation start gate:** Before the first implementation action after discovery/planning, search for a matching decision or task. If a confident record exists, attach work to it. If none exists, choose the right creation path: proceed directly for clear low-risk records after search/context checks, or use MCPViews review for significant, ambiguous, destructive, high-impact, or hard-to-undo changes. If the parent initiative/project/bridge is unclear, ask where the work should live.
4. **Built and validating:** Move the matching standard decision to `STAGED` only after the code/process/configuration exists and is being tested, reviewed, or validated outside production.
5. **Live release:** Move a matching `STAGED` decision to `IMPLEMENTED` only after production deployment or the agreed production-equivalent operational release.

## Mode selection

### Solo builder mode

Use for one-person or low-friction work where the user is not seeking teammate approval.

Target lifecycle:

```text
discovery -> DRAFT + linked discovery artifact -> implementation -> STAGED -> IMPLEMENTED
```

Workflow:

1. Resolve the DecidR organization and relevant parent project, bridge, or initiative.
2. Search for an existing matching decision or task.
3. When the human accepts the discovery direction, create or update a standard decision in `DRAFT`.
4. Create or update the supporting LudFlow plan/discovery document and link it to the decision.
5. Before implementation starts, run the implementation start gate and verify the work is attached to this decision/task.
6. After the implementation is committed or available in a test/review environment, move the decision to `STAGED` if `allowedTransitions` permits it.
7. After deployment or migration into the live/deployment codebase, move the decision to `IMPLEMENTED`.

### Team mode

Use when DecidR is coordinating shared decisions, teammate review, or explicit approvals.

User-facing lifecycle:

```text
discovery -> DRAFT -> PROPOSED -> APPROVED -> implementation -> STAGED -> IMPLEMENTED
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
5. Move `DRAFT -> PROPOSED` when the human-accepted discovery direction is ready for teammate review.
6. For assigned reviews, inspect the decision and linked documents, then use `update_decision` with `action: approve` or `action: reject`.
7. When approval rules are satisfied, DecidR may auto-transition `PROPOSED -> APPROVED`; verify with `get_decision`.
8. Run the implementation start gate, then move `APPROVED -> IN_PROGRESS` when implementation starts.
9. Move `IN_PROGRESS -> STAGED` after commit/test/review implementation exists.
10. Move `STAGED -> IMPLEMENTED` after deployment or migration into the live/deployment codebase.

## Planning, implementation-start, and commit governance

- Before logging an implementation plan, ask whether the user wants it logged in DecidR unless they have already opted in or the user has explicitly accepted the discovery direction as the decision artifact.
- Before leaving plan mode or discovery for implementation, run the implementation start gate. Do not treat local repo work as ordinary implementation prep when it plausibly affects governed DecidR/plugin/process behavior.
- If governed work has no matching decision/task, create clear low-risk records directly after search/context checks; use MCPViews review only when the proposed mutation is significant, ambiguous, destructive, high-impact, hard to undo, cross-organization, customer/production-visible, or needs row-level accept/reject control.
- Do not require MCPViews review solely because there are multiple related DecidR/LudFlow writes. Creating one new decision with a linked discovery document, or updating one decision and its accompanying documents, can proceed directly when the user intent, organization, parent entity, and target documents are clear.
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

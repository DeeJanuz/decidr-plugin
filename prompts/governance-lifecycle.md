# DecidR Governance Lifecycle Runbook

Use this runbook when the user asks you to create, update, implement, stage, approve, deploy, or otherwise manage governed DecidR decisions. It is the canonical lifecycle guide for DecidR governance work.

## Prime directives

1. **Use the selected governance mode.** If a DecidR governance lifecycle startup rule is installed, follow it first. If the caller provided a mode, use it. Otherwise use the persisted DecidR governance mode rule from MCPViews setup. If no mode is known, ask: "Do you plan to use DecidR to collaborate with and get approvals from shared decisions with other teammates?" Yes means `team`; no means `solo_builder`.
2. **Use the selected work logging policy.** If a DecidR work logging startup rule is installed, follow it. `auto_log_confident` means clear low-risk DecidR writes may proceed directly after search/context checks; `review_first` means present formal writes for review before execution; `capture_only` means manual logging only: summarize candidate durable memory and ask before formal DecidR writes.
3. **Search before creating.** Search existing initiatives, projects, decisions, tasks, and LudFlow documents before creating new records.
4. **Prefer continuity.** Update matching decisions and documents when they already exist. Create a new decision only when no suitable record exists.
5. **Use decision-first mapping.** Durable choices, tradeoffs, architecture direction, approval-worthy implementation paths, or persistent behavior become standard decisions. Small already-completed rationale becomes catch-up decisions. Lightweight execution follow-up becomes tasks. Commit, release, deploy, or operational proof updates lifecycle documents or audit evidence.
6. **Do not fake lifecycle state.** Use `get_decision` and `allowedTransitions` before status changes. If the backend requires an intermediate state, use that actual transition path.
7. **Save lifecycle document versions.** Standard decisions need a linked LudFlow document with a `PLAN` version before leaving `DRAFT`, a `STAGED` version before moving to `STAGED`, and an `IMPLEMENTED` version before moving to `IMPLEMENTED`. Use `save_decision_document_version` for these snapshots. Approval remains DecidR status/progress, not LudFlow version metadata.
8. **Run the implementation start gate.** When leaving discovery or planning for governed feature/process work, fetch this runbook and verify or propose the governing decision/task before the first repo edit, packaging command, deployment prep, or external write.
9. **Stage built work, implement live work.** `STAGED` means built/configured and in test/review or non-production validation. It is not approval-to-build or acceptance of a plan. `IMPLEMENTED` means the work is live or production-equivalent: deployed to production, merged/pushed to a branch that is the repository's live release source such as `main`, `master`, `prod`, or `production`, or published as a versioned release, tag, or package users or downstream systems can install. Do not treat `main` or `master` as `IMPLEMENTED` when that branch is only staging or pre-production.
10. **Use catch-up decisions only for small already-implemented work.** Use `create_catch_up_decision` or `mark_decision_as_catch_up` for post-implementation rationale capture, not active approval workflows.

## Discovery and implementation gates

Use these checkpoints whenever a new feature, process, public/plugin packaging change, onboarding flow, deployment path, or cross-system behavior may be DecidR-governed:

1. **Open discovery:** Gather facts and draft options. Keep DecidR/LudFlow mutations read-only unless the user explicitly asks to log during discovery.
2. **Human-accepted direction:** When the human says the direction is good enough to preserve, create or update the DecidR decision and save the accepted plan with `save_decision_document_version` using stage `PLAN`. Revisions during approval create additional `PLAN` versions on the same document. Do not mark the decision `STAGED` merely because the plan is accepted.
3. **Implementation start gate:** Before the first implementation action after discovery/planning, search for a matching decision or task. If a confident record exists, attach work to it. If none exists, choose the closest relevant project or initiative when product/company context is clear and proceed directly for clear low-risk records after search/context checks. Use MCPViews review or ask for placement only when the closest parent is ambiguous, cross-organization, customer/production-visible, destructive, high-impact, or hard to undo. When using an inferred closest parent, record why it was chosen in the decision rationale or evidence.
4. **Built and validating:** Move the matching standard decision to `STAGED` only after the code/process/configuration exists and is being tested, reviewed, or validated outside production.
5. **Live release:** Move a matching `STAGED` decision to `IMPLEMENTED` only after production deployment or the agreed production-equivalent operational release. This includes a successful push/merge to `main`, `master`, `prod`, or another production branch only when that branch is the live release source, and a new versioned release/tag/package only when it is available for users or downstream systems to install.

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
4. Save the supporting LudFlow plan/discovery snapshot with `save_decision_document_version` using stage `PLAN`. If the decision has no linked LudFlow document, this creates and links the first plan document.
5. Before implementation starts, run the implementation start gate and verify the work is attached to this decision/task.
6. After the implementation is committed or available in a test/review environment, save the staged state with `save_decision_document_version` using stage `STAGED`, then move the decision to `STAGED` if `allowedTransitions` permits it.
7. After deployment, migration into the live/deployment codebase, push/merge to the repository's production release branch, or publication of an installable versioned release, save the implemented state with `save_decision_document_version` using stage `IMPLEMENTED`, then move the decision to `IMPLEMENTED`.

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
4. Save the supporting LudFlow plan snapshot with `save_decision_document_version` using stage `PLAN`. If the decision has no linked LudFlow document, this creates and links the first plan document.
5. Move `DRAFT -> PROPOSED` when the human-accepted discovery direction is ready for teammate review.
6. For assigned reviews, inspect the decision and linked documents, then use `update_decision` with `action: approve` or `action: reject`.
7. When approval rules are satisfied, DecidR may auto-transition `PROPOSED -> APPROVED`; verify with `get_decision`.
8. Run the implementation start gate, then move `APPROVED -> IN_PROGRESS` when implementation starts.
9. Move `IN_PROGRESS -> STAGED` after commit/test/review implementation exists and a `STAGED` document version has been saved.
10. Move `STAGED -> IMPLEMENTED` after deployment, migration into the live/deployment codebase, push/merge to the repository's production release branch, or publication of an installable versioned release, after saving an `IMPLEMENTED` document version.

## Planning, implementation-start, and commit governance

- Before logging an implementation plan, follow the selected DecidR work logging startup rule when one is installed. If no policy is known, ask whether the user wants the plan logged in DecidR unless they have already opted in or the user has explicitly accepted the discovery direction as the decision artifact.
- With `auto_log_confident`, clear low-risk governance writes may proceed directly after search/context checks when organization, closest parent, target, and impact are confident. Do not skip logging only because the parent is inferred from the closest relevant project or initiative.
- With `review_first`, present proposed formal writes for review and execute accepted rows only.
- With `capture_only`, summarize candidate durable memory and ask before creating, updating, or lifecycle-transitioning formal DecidR records.
- Before leaving plan mode or discovery for implementation, run the implementation start gate. Do not treat local repo work as ordinary implementation prep when it plausibly affects governed DecidR/plugin/process behavior.
- If governed work has no matching decision/task, create clear low-risk records under the closest relevant project or initiative after search/context checks; use MCPViews review only when the proposed mutation is significant, ambiguous, destructive, high-impact, hard to undo, cross-organization, customer/production-visible, or needs row-level accept/reject control.
- Do not require MCPViews review solely because there are multiple related DecidR/LudFlow writes. Creating one new decision with a linked discovery document, or updating one decision and its accompanying documents, can proceed directly when the user intent, organization, parent entity, and target documents are clear.
- When committing code, search for confident matching decisions and tasks. Save a `STAGED` LudFlow document version and move confident matching decisions to `STAGED` only after the commit succeeds.
- When the same workflow also pushes or merges that work to the repository's production release branch, or publishes a versioned release/tag/package that users or downstream systems can install, save an `IMPLEMENTED` LudFlow document version and move confident matching `STAGED` decisions to `IMPLEMENTED` after that release action succeeds.
- Do not create a new decision merely because a commit happened. If no confident record exists, create or propose a standard decision, catch-up decision, or task under the closest relevant project or initiative based on scope and risk.

## Document handling

- Prefer an existing LudFlow document when it already describes the plan.
- If creating a new document, place it in an existing relevant folder, or in a folder named for the DecidR project if no better folder exists.
- If the supporting document is already published, or the linked decision is already `IMPLEMENTED`, preserve current content and append a dated addendum unless the user explicitly asks for a rewrite.
- For standard decision lifecycle snapshots, use `save_decision_document_version` so the linked LudFlow document records `PLAN`, `STAGED`, and `IMPLEMENTED` versions on the same document. Use `link_document` only for ordinary supporting links that are not lifecycle snapshots.

## Failure modes

- If organization context is unclear, ask for placement before mutating. If parent context is only inferred but the closest relevant project or initiative is clear and low-risk, log there and state the inference in the rationale/evidence.
- If a draft decision cannot leave `DRAFT`, check whether a linked LudFlow document has a `PLAN` version first.
- If `STAGED` or `IMPLEMENTED` transitions fail, save the matching lifecycle document version before retrying the status transition.
- If a requested transition is not in `allowedTransitions`, report the current status and the allowed next states rather than forcing a different status.
- If approval status is unclear, use `get_decision` and inspect approval progress before acting.

## Non-goals

- Do not replace GitHub PR lifecycle guidance. Fetch `github_pr_lifecycle` for GitHub issue/PR actions linked to DecidR.
- Do not use historical timestamp correction tools to transition live status.
- Do not use catch-up decisions for large active work that needs review.

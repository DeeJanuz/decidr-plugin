# Planning Decision Governance Runbook

You are an agent creating or implementing a plan that appears related to DecidR-managed work. This runbook governs when and how to log that work as DecidR decisions and supporting documents.

## Prime directives

1. **Ask before logging.** Before creating or updating DecidR decisions, documents, or links for an implementation plan, ask the user whether this plan should be logged in DecidR. If they say no, do not perform DecidR logging for that plan.
2. **Do not guess the organization.** Use available org/token context and `decidr_list_organizations` to identify the correct organization. If the correct org or context is unclear, ask the user for pointers.
3. **Search before creating.** Look for existing initiatives, projects, decisions, tasks, and LudFlow documents before creating new DecidR records.
4. **Prefer continuity.** Update existing decisions and linked docs when the plan refines, implements, supersedes, or documents prior work. Create new decisions, tasks, and supporting docs only when no suitable existing record exists.
5. **Run the implementation start gate.** Before leaving discovery or planning for governed implementation, search for a matching decision/task and verify or propose the governing record before the first repo edit, packaging command, deployment prep, or external write.
6. **Stage built work, implement deployed code.** When committing code and DecidR has registered/authenticated organizations, search existing matching decisions and move confident matches to `STAGED` after the commit. `STAGED` means built/configured and in test/review or non-production validation, not approval-to-build. Reserve `IMPLEMENTED` for work migrated into the deployment codebase.
7. **Backlog future work.** Use `BACKLOG` status for future, deferred, or intentionally non-actionable decisions and tasks. Backlog records document possible work without putting it in Next Steps or action-item queues.
8. **Create low-risk records directly, review risky ones.** If governed implementation work has no confident matching decision or task, create clear low-risk standard decisions, catch-up decisions, or tasks directly after search/context checks. Use catch-up decisions for small already-implemented work that needs rationale/governance capture after the fact without the full standard decision workflow. Use MCPViews review only for significant, ambiguous, destructive, high-impact, hard-to-undo, cross-organization, customer/production-visible, or row-level approval-worthy changes.
9. **Preserve implemented records.** When a linked LudFlow document is already published or its DecidR decision is already implemented, fetch the current content first and append new information as a dated addendum. Do not replace or restructure the implemented record unless the user explicitly asks for a rewrite.
10. **Review by risk, not by count alone.** Do not require MCPViews review solely because there are several related DecidR/LudFlow mutations. Creating one new decision with a linked discovery document, or updating one decision and its accompanying documents, can proceed directly when the user intent, organization, parent entity, and target documents are clear.

## Trigger

Use this runbook when an implementation plan mentions or strongly implies governed work, decisions, initiatives, projects, tasks, DecidR entities, or existing DecidR/LudFlow documentation.

Also use this runbook before the first implementation action after discovery/planning, and before or immediately after committing code in any codebase, when DecidR is installed and the MCPViews session reports registered/authenticated DecidR organizations.

Do not use it for casual planning or exploratory notes that have no apparent relationship to DecidR-managed work unless the user explicitly asks to log them.

## Workflow

### 1. Confirm logging intent

If the user has not already explicitly opted in, ask one concise question: "Should I log this plan in DecidR?"

- If yes, continue.
- If no, proceed with the plan without DecidR logging.
- If unclear, ask for a yes/no answer before any DecidR mutation.

### 2. Resolve organization and context

1. Inspect the current MCPViews org token context from `init_session`.
2. Call `decidr_list_organizations` when organization choice is not already obvious.
3. If multiple organizations could apply, ask the user which organization to use.
4. If a likely organization lacks a usable token, ask the user to connect that org before attempting DecidR writes.
5. Search by the plan's key terms with `decidr_search`; if needed, also call `decidr_list_initiatives`, `decidr_list_projects`, `decidr_list_decisions`, and `decidr_search_ludflow_documents`.

Stop and ask the user for pointers if search results do not identify the relevant initiative, project, decision, task, or document context with reasonable confidence.

### 3. Choose update vs create

Use these defaults:

| Situation | Action |
|---|---|
| Plan implements or refines an existing decision | Update that decision and its linked docs. |
| Human accepts discovery as the durable direction | Create or update the decision and link the discovery artifact; do not mark it `STAGED` until implementation exists. |
| Implementation is about to start after discovery/planning | Search for a matching decision/task. If none confidently exists, create a clear low-risk governing decision/task directly after context checks, or use MCPViews review when the target, parent, or impact is significant or ambiguous. |
| A commit implements an existing decision in a test/review environment | Update that decision to `STAGED` after the commit. |
| Work is migrated into the deployment codebase | Update the matching `STAGED` decision to `IMPLEMENTED`. |
| Plan records future or deferred work that should not appear as immediately actionable | Create or update the relevant decision or task with status `BACKLOG`. |
| Plan supersedes a previous direction | Update or supersede the existing decision; link the new supporting doc. |
| Plan fills in missing implementation detail for an existing project/task | Create or update a child decision under the relevant project, bridge, or task context. |
| No matching decision or task exists after search and the work records a durable choice, tradeoff, architecture direction, or approval-worthy implementation path | Create a new decision under the best matching parent entity directly when the target and impact are clear and low-risk; use MCPViews review for significant, ambiguous, destructive, high-impact, or hard-to-undo changes. |
| No matching decision or task exists after search and the work is small already-implemented work that records a durable rationale or why a change happened after the fact | Create a `CATCH_UP` decision under the relevant project, bridge, or initiative directly when the target and rationale are clear. Use `create_catch_up_decision`, or `mark_decision_as_catch_up` only for an existing `DRAFT`/`BACKLOG` decision. Use MCPViews review for significant or ambiguous catch-up records. |
| No matching decision or task exists after search and the work is lightweight implementation follow-up or execution detail that did not need a decision/rationale record | Create a task under the relevant project or existing decision directly when the target is clear and low-risk; use MCPViews review for significant or ambiguous tasks. |
| No suitable parent entity exists | Ask the user where this should live before creating anything. |

Before transitioning a standard decision out of `DRAFT`, confirm it has at least one linked supporting document unless the target is `BACKLOG`. Use `decidr_list_entity_documents` to inspect existing links and `decidr_link_document` to attach the supporting doc. For accepted discovery/planning, create or update the decision and linked artifact without marking it `STAGED`. For already-built standard workflow work, transition `DRAFT -> STAGED`, not `DRAFT -> IMPLEMENTED`. If the blocker is disproportionate for small already-implemented work, propose a catch-up decision path instead. For future work that should not be actionable yet, use `BACKLOG`.

### 3a. Implementation start gate

When the user approves a plan, exits plan mode, asks you to implement, or you are otherwise about to perform the first implementation action:

1. Check the MCPViews session/org-token context for installed DecidR organizations.
2. If no DecidR organization is registered or authenticated, continue normally and do not invent DecidR context.
3. If DecidR organizations are available, search existing decisions and tasks by the feature/process name, package/plugin name, changed subsystem names, branch or issue context, and user-provided planning language.
4. If exactly one or more confident existing decisions/tasks match, attach the implementation work to those records and proceed.
5. If matches are ambiguous, report candidate decisions/tasks and ask the user which records govern the work before editing code or running implementation commands.
6. If no confident matching decision or task exists, classify the work and create clear low-risk standard decisions, catch-up decisions, or tasks directly after context checks. Use MCPViews review before creating records or starting implementation only when the change is significant, ambiguous, destructive, high-impact, hard to undo, cross-organization, customer/production-visible, or needs row-level approval.
7. Do not mark accepted discovery or an implementation plan as `STAGED`. Use `STAGED` only after the work is built/configured and in test/review or non-production validation.

### 3b. Commit governance

When the user asks you to commit code, or you otherwise reach the commit step in a code workflow:

1. Check the MCPViews session/org-token context for installed DecidR organizations.
2. If no DecidR organization is registered or authenticated, continue the commit normally and do not invent DecidR context.
3. If DecidR organizations are available, search existing decisions and tasks by branch name, issue/PR title, commit summary, changed subsystem names, and user-provided task language.
4. If exactly one or more confident existing decisions match the committed work, update those decisions to `STAGED` after the commit succeeds. Do not create new decisions solely because a commit happened.
5. If one or more confident existing tasks match the committed work, update or reference those tasks instead of proposing a duplicate task.
6. If matches are ambiguous, report candidate decisions/tasks and ask the user which records to update.
7. If no confident matching decision or task exists, classify the committed work before creating anything:
   - Propose a new decision when the work records a durable choice, tradeoff, architecture direction, approval-worthy implementation path, or behavior that should be auditable as a decision.
   - Propose a catch-up decision when the work is small, already implemented, and should be captured mainly to explain why it happened after the fact without forcing a full standard decision document workflow.
   - Propose a task when the work is lightweight implementation follow-up, cleanup, small bugfix scope, or execution detail that did not require a decision approval flow. Attach the task to the relevant project or to an existing decision when the task implements or follows up that decision.
   - Use initial status `BACKLOG` for proposed decisions or tasks that represent future/deferred work rather than immediate next steps.
8. Create clear low-risk decision/task records directly after search/context checks. Use MCPViews review and execute only accepted rows when proposed creations are significant, ambiguous, destructive, high-impact, hard to undo, cross-organization, customer/production-visible, or need row-level approval. Do not create new records silently just because a commit happened.
9. Do not move any decision to `IMPLEMENTED` during ordinary code commit. Use `IMPLEMENTED` only after the work is migrated into the deployment codebase.

### 4. Document the plan

For each logged plan, ensure there is supporting documentation:

- Prefer an existing LudFlow document when it already describes the plan or decision.
- Before creating a new LudFlow document, search or list existing LudFlow documents and folders to identify the right location.
- Reuse an existing relevant folder hierarchy when one already exists.
- If no relevant folder structure exists, create or use a folder named after the best matching DecidR project.
- If no project context is identifiable, ask the user where the document should live before creating it.
- If document creation tooling is available, create or update the supporting document before linking it, then move the document into the selected folder if the write tool created it elsewhere.
- If the supporting document is already `PUBLISHED`, or if the linked DecidR decision is already `IMPLEMENTED`, treat the existing document as the historical deployment record. Fetch the current content with `ludflow_get_document`, preserve that content, and append new findings, validation notes, follow-up decisions, or corrections as a dated addendum. If the document was published before the update, publish the appended version after the required review flow.
- If no document can be created from the current toolset, ask the user for the document URL or LudFlow document to link.
- Link supporting documents to the DecidR decision or parent entity with `decidr_link_document`.

The document should capture the plan summary, important tradeoffs, selected approach, rejected alternatives when useful, implementation notes, and test/acceptance criteria.

### 5. Review and execute mutations

Collect the intended DecidR/LudFlow mutations before executing them:

- Create/update/supersede decisions.
- Create/update tasks.
- Create/update supporting documents.
- Link documents to entities.
- Update parent projects, tasks, bridges, or initiatives when needed for the plan.

Proceed directly for clearly requested, low-risk governance writes when the organization, parent, target, and desired change are clear. This includes creating one new decision with a linked discovery document, creating a small catch-up decision, creating a straightforward task, or updating one decision and its accompanying documents.

Use MCPViews review when review adds meaningful control: destructive or hard-to-undo actions, ambiguous targets, production/customer-visible changes, cross-organization changes, major status transitions coupled with audit/document rewrites, replacement/superseding decisions, publishing or deleting documents, permission/credential changes, or batches where the user should accept/reject individual rows. Execute only accepted rows and respect user edits.

### 6. Report outcome

After logging, report:

- The organization used.
- Existing decisions/docs updated.
- New decisions/tasks/docs created.
- Documents linked.
- Any unresolved context or follow-up the user needs to provide.

## Non-goals

- Do not force DecidR logging for every plan.
- Do not create placeholder decisions without a clear parent and purpose.
- Do not create duplicate decisions when an existing one can be updated.
- Do not invent organization, initiative, project, or document context.
- Do not bypass review for batches of external mutations.

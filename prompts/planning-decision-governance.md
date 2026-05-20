# Planning Decision Governance Runbook

You are an agent creating or implementing a plan that appears related to DecidR-managed work. This runbook governs when and how to log that work as DecidR decisions and supporting documents.

## Prime directives

1. **Ask before logging.** Before creating or updating DecidR decisions, documents, or links for an implementation plan, ask the user whether this plan should be logged in DecidR. If they say no, do not perform DecidR logging for that plan.
2. **Do not guess the organization.** Use available org/token context and `decidr_list_organizations` to identify the correct organization. If the correct org or context is unclear, ask the user for pointers.
3. **Search before creating.** Look for existing initiatives, projects, decisions, tasks, and LudFlow documents before creating new DecidR records.
4. **Prefer continuity.** Update existing decisions and linked docs when the plan refines, implements, supersedes, or documents prior work. Create new decisions and supporting docs only when no suitable existing record exists.
5. **Stage committed code, implement deployed code.** When committing code and DecidR has registered/authenticated organizations, search existing matching decisions and move confident matches to `STAGED` after the commit. `STAGED` means implemented in a test/review environment. Reserve `IMPLEMENTED` for work migrated into the deployment codebase.
6. **Preserve implemented records.** When a linked LudFlow document is already published or its DecidR decision is already implemented, fetch the current content first and append new information as a dated addendum. Do not replace or restructure the implemented record unless the user explicitly asks for a rewrite.
7. **Review batch mutations.** For 2 or more DecidR/LudFlow mutations, present the planned create/update/link actions for review before executing them, following the MCPViews bulk action review rule.

## Trigger

Use this runbook when an implementation plan mentions or strongly implies governed work, decisions, initiatives, projects, tasks, DecidR entities, or existing DecidR/LudFlow documentation.

Also use this runbook before or immediately after committing code in any codebase when DecidR is installed and the MCPViews session reports registered/authenticated DecidR organizations.

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
| A commit implements an existing decision in a test/review environment | Update that decision to `STAGED` after the commit. |
| Work is migrated into the deployment codebase | Update the matching `STAGED` decision to `IMPLEMENTED`. |
| Plan supersedes a previous direction | Update or supersede the existing decision; link the new supporting doc. |
| Plan fills in missing implementation detail for an existing project/task | Create or update a child decision under the relevant project, bridge, or task context. |
| No matching decision exists after search | Create a new decision under the best matching parent entity. |
| No suitable parent entity exists | Ask the user where this should live before creating anything. |

Before transitioning a decision out of `DRAFT`, confirm it has at least one linked supporting document. Use `decidr_list_entity_documents` to inspect existing links and `decidr_link_document` to attach the supporting doc. For already-built work, transition `DRAFT -> STAGED`, not `DRAFT -> IMPLEMENTED`.

### 3a. Commit governance

When the user asks you to commit code, or you otherwise reach the commit step in a code workflow:

1. Check the MCPViews session/org-token context for installed DecidR organizations.
2. If no DecidR organization is registered or authenticated, continue the commit normally and do not invent DecidR context.
3. If DecidR organizations are available, search existing decisions by branch name, issue/PR title, commit summary, changed subsystem names, and user-provided task language.
4. If exactly one or more confident existing decisions match the committed work, update those decisions to `STAGED` after the commit succeeds. Do not create new decisions solely because a commit happened.
5. If matches are ambiguous, report candidate decisions and ask the user which ones to stage.
6. Do not move any decision to `IMPLEMENTED` during ordinary code commit. Use `IMPLEMENTED` only after the work is migrated into the deployment codebase.

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
- Create/update supporting documents.
- Link documents to entities.
- Update parent projects, tasks, bridges, or initiatives when needed for the plan.

If there are 2 or more mutations, use MCPViews bulk action review before executing. Execute only accepted rows and respect user edits.

### 6. Report outcome

After logging, report:

- The organization used.
- Existing decisions/docs updated.
- New decisions/docs created.
- Documents linked.
- Any unresolved context or follow-up the user needs to provide.

## Non-goals

- Do not force DecidR logging for every plan.
- Do not create placeholder decisions without a clear parent and purpose.
- Do not create duplicate decisions when an existing one can be updated.
- Do not invent organization, initiative, project, or document context.
- Do not bypass review for batches of external mutations.

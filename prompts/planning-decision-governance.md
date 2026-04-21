# Planning Decision Governance Runbook

You are an agent creating or implementing a plan that appears related to DecidR-managed work. This runbook governs when and how to log that work as DecidR decisions and supporting documents.

## Prime directives

1. **Ask before logging.** Before creating or updating DecidR decisions, documents, or links for an implementation plan, ask the user whether this plan should be logged in DecidR. If they say no, do not perform DecidR logging for that plan.
2. **Do not guess the organization.** Use available org/token context and `decidr_list_organizations` to identify the correct organization. If the correct org or context is unclear, ask the user for pointers.
3. **Search before creating.** Look for existing initiatives, projects, decisions, tasks, and LudFlow documents before creating new DecidR records.
4. **Prefer continuity.** Update existing decisions and linked docs when the plan refines, implements, supersedes, or documents prior work. Create new decisions and supporting docs only when no suitable existing record exists.
5. **Review batch mutations.** For 2 or more DecidR/LudFlow mutations, present the planned create/update/link actions for review before executing them, following the MCPViews bulk action review rule.

## Trigger

Use this runbook when an implementation plan mentions or strongly implies governed work, decisions, initiatives, projects, tasks, DecidR entities, or existing DecidR/LudFlow documentation.

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
| Plan supersedes a previous direction | Update or supersede the existing decision; link the new supporting doc. |
| Plan fills in missing implementation detail for an existing project/task | Create or update a child decision under the relevant project, bridge, or task context. |
| No matching decision exists after search | Create a new decision under the best matching parent entity. |
| No suitable parent entity exists | Ask the user where this should live before creating anything. |

Before transitioning a decision out of `DRAFT`, confirm it has at least one linked supporting document. Use `decidr_list_entity_documents` to inspect existing links and `decidr_link_document` to attach the supporting doc.

### 4. Document the plan

For each logged plan, ensure there is supporting documentation:

- Prefer an existing LudFlow document when it already describes the plan or decision.
- If document creation tooling is available, create or update the supporting document before linking it.
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

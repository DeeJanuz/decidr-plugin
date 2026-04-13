# GitHub PR Lifecycle Runbook

You are an agent participating in a GitHub PR lifecycle governed by DecidR. This runbook is the behavioral contract for every agent session that touches a GitHub issue or PR linked to a DecidR entity. Read it before taking any action.

## Prime directives (non-negotiable)

1. **GitHub is authoritative.** Inbound GitHub sync into DecidR is handled automatically through Ludflow-managed metadata. Never invent a parallel manual sync path.
2. **Never add DecidR-side enforcement.** Review policy, required approvals, branch protection, and merge gates live in GitHub. If GitHub blocks you, surface the blocker to the user in plain language. Do not route around it.
3. **Stay in your lane.** Only touch the specific issue or PR the user explicitly directed you to. Do not scan other issues, modify other PRs, or trigger side effects outside the current lifecycle step.
4. **Do not prescribe the fix.** Code generation, review heuristics, and diff analysis are owned by the user's own agent tooling. This runbook only covers the lifecycle mechanics around those steps.

## Role detection

On entry, determine your role from the user's direction:

| User said | Role | Entry artifact |
|---|---|---|
| "fix this issue" / pointed at an issue | **Coder** | `issue_ref_id` or GitHub issue URL |
| "review this PR" / pointed at a PR | **Reviewer** | `pr_artifact_id` or GitHub PR URL |

If ambiguous, ask the user (via `AskUserQuestion` or equivalent) before proceeding. Never guess a role.

## Coder path

```mermaid
sequenceDiagram
    actor User
    participant Agent as Coder Agent
    participant GH as GitHub
    participant DR as DecidR

    User->>Agent: Fix issue X
    Agent->>DR: list_issues / get entity for ref X
    Agent->>GH: fetch issue metadata
    Agent->>Agent: reconcile (DR &lt;- GH)
    Note over Agent: User tooling generates fix<br/>(out of runbook scope)
    Agent->>GH: create branch, commit, push
    Agent->>DR: create_pr (branch, issue_ref, reviewer)
    DR->>GH: opens PR, assigns reviewer
    Agent->>DR: refetch PR artifact
    Agent->>GH: verify PR state
    Agent->>Agent: reconcile (DR &lt;- GH)
    Agent->>User: report PR URL + status
```

### Coder steps

1. **Identify the issue.** Resolve the user's pointer to an `issue_ref_id`. Use `list_issues` / DecidR search if the user only gave you a partial reference or URL.
2. **Pull issue context from both sides.** Fetch the issue on GitHub and the DecidR entity linked to it. If the user asks about freshness, use the Ludflow-backed metadata refresh tools instead of hand-managed sync logic.
3. **Create a branch.** Use the convention `fix/<issue-number>-<short-description>` unless the user specifies otherwise.
4. **Generate the fix.** Hand off to the user's own agent tooling for code generation, tests, and commit messages. This runbook does not prescribe how the fix is produced.
5. **Open the PR.** Call `create_pr` with the branch name, the `issue_ref` linking it to the DecidR issue, and a reviewer assignment. The DecidR tool surfaces the PR in GitHub with the correct linkage.
6. **Confirm creation.** Refetch the PR artifact from DecidR and the PR state from GitHub. Report any residual mismatch as a warning, not a silent fix.
7. **Report back.** Give the user the PR URL, the reviewer, the DecidR PR artifact ID, and the current status. Stop. Your job is done until the reviewer responds.

## Reviewer path

```mermaid
sequenceDiagram
    actor User
    participant Agent as Reviewer Agent
    participant GH as GitHub
    participant DR as DecidR

    User->>Agent: Review PR Y
    Agent->>DR: list_prs / get_pr (Y)
    Agent->>GH: fetch PR + branch state
    Agent->>Agent: reconcile (DR &lt;- GH)
    Note over Agent: User tooling runs review<br/>(diff analysis out of scope)
    alt Approve as-is
        Agent->>DR: review_pr (status: APPROVED)
        Agent->>GH: submit approval
    else Approve with follow-up commit
        Agent->>GH: commit, push to PR branch
        Agent->>DR: review_pr (status: APPROVED)
    else Reject
        Agent->>DR: review_pr (status: CHANGES_REQUESTED)
        Agent->>GH: submit review with comments
    else Close + new PR
        Agent->>GH: close PR
        Agent->>DR: reconcile closed state
        Note over Agent: Hand back to coder path<br/>with same issue_ref
    end
    Agent->>Agent: reconcile (DR &lt;- GH)
    Agent->>User: report outcome
```

### Reviewer steps

1. **Identify the PR.** Resolve the user's pointer to a DecidR PR artifact ID. Use `list_prs` if needed.
2. **Pull PR context from both sides.** Fetch the PR from GitHub and the PR artifact from DecidR. Include the linked issue, the branch state, CI status, and any existing review decisions.
3. **Run the review.** Hand off to the user's own agent tooling for diff analysis. This runbook does not prescribe review heuristics.
4. **Act on the review decision.** Exactly one of:
   - **Approve as-is.** Call `review_pr` with `status: "APPROVED"`.
   - **Approve with a follow-up commit.** Push your commit to the PR branch first, then call `review_pr` with `status: "APPROVED"`. Never approve code you modified without also committing that modification visibly on the PR branch.
   - **Reject.** Call `review_pr` with `status: "CHANGES_REQUESTED"`. Leave the PR open for the coder to respond.
   - **Close and restart.** Close the PR on GitHub, reconcile DecidR to reflect the closed state, then hand the original issue back to a coder session to open a fresh PR.
5. **Confirm the action.** Refetch both sides and confirm the write completed.
6. **Report back.** Give the user the outcome, the linked issue, the coder to notify (if rejecting), and the DecidR PR artifact status.

## Sync model

Inbound GitHub state flows into DecidR from Ludflow-managed metadata sync. Use `get_repo_last_sync` or `refresh_repo_metadata` if the user needs to verify freshness. Outbound actions such as `create_issue`, `create_pr`, `review_pr`, and `merge_pr` still use the caller's DecidR GitHub PAT connection.

## Failure modes

| Failure | Agent behavior |
|---|---|
| GitHub branch protection blocks merge | Report the required reviews or checks to the user in plain language. Do not attempt a workaround. Do not alter branch protection rules. |
| CI red | Report the failing checks with links. Do not retry silently. Ask the user whether to investigate or abandon. |
| Review rejected | Summarize the reviewer's comments. Ask the user whether to address the feedback or escalate. |
| Merge conflict | Report the conflict. Do not auto-resolve. Ask the user whether to rebase manually or abandon. |
| Stale branch (behind base) | Report the drift. Ask the user whether to rebase the branch. |
| Context truncated mid-lifecycle | The next agent session resumes by querying `list_prs` filtered by the `issue_ref`. No resume token is required — the PR artifact is the resume point. |
| DecidR / GitHub mismatch after a write action | Report the exact mismatch to the user. Use the Ludflow-backed refresh tools if the issue is on the inbound sync side. |

## What this runbook deliberately does NOT cover

- Fix code generation (owned by the user's agent tooling)
- Review heuristics or diff analysis (owned by the user's agent tooling or the reviewer's judgment)
- DecidR-side approval gates (none exist; governance lives in GitHub)
- Non-PR lifecycles such as issue triage or decision approval (separate runbooks)
- Cross-repo coordination or stacked PRs (single PR scope only in v1)
- Alternate manual sync workflows outside Ludflow-managed metadata

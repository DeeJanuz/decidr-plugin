# 0.1.15 — Flexible PR Review Statuses

## Fixes

- **`review_pr` can now move a PR artifact beyond `IN_REVIEW`.** The plugin guidance now matches the backend behavior, so agents can call `review_pr` with statuses like `APPROVED` or `CHANGES_REQUESTED` instead of being steered back into review.
- **GitHub PR lifecycle instructions now use explicit `review_pr(status: ...)` calls.** This removes the mismatch where the runbook described approval/rejection flows that the installed plugin metadata still framed as `IN_REVIEW`-only.

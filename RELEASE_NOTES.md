# 0.1.13 — Direct Draft Implementation

## Features

- **Direct `DRAFT` to `IMPLEMENTED` decision transitions**. DecidR can now record already-completed work without forcing the decision through `PROPOSED`, `APPROVED`, and `IN_PROGRESS` first.

## Fixes

- **Manifest guidance now reflects the direct-implementation path**. Agents are told that draft decisions can move straight to `IMPLEMENTED` once they have linked supporting documents.

# 0.1.12 — Resend pending invites

## Features

- **Pending invite resend action**. Organization settings now include a `Resend` button for each pending invite so admins can re-send the invitation email without canceling and recreating it.
- **Clearer invite entry point**. The member form action now reads `Send New Invite`, which makes the difference between creating a fresh invite and resending an existing one much more obvious.

## Fixes

- **Plugin API client now supports resend_invite** against the DecidR MCP org-members endpoint, keeping the renderer aligned with the latest backend contract.
- **Manifest tool guidance reflects the resend action** so MCPViews has the current member-management semantics for pending invites.
